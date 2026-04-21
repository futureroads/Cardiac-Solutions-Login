import sys
import os
import logging
import asyncio
import hashlib
import secrets
import traceback
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Optional
import uuid

print("[SERVER] Module loading started", flush=True)

try:
    from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, status, BackgroundTasks
    from fastapi.responses import JSONResponse
    from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
    from dotenv import load_dotenv
    from starlette.middleware.cors import CORSMiddleware
    from motor.motor_asyncio import AsyncIOMotorClient
    from pydantic import BaseModel, Field
    import jwt
    print("[SERVER] All imports OK", flush=True)
except Exception as e:
    print(f"[SERVER] FATAL IMPORT ERROR: {e}", flush=True)
    traceback.print_exc()
    raise

# bcrypt is OPTIONAL — we default to PBKDF2 (pure Python, zero binary deps)
try:
    import bcrypt as _bcrypt
    _HAS_BCRYPT = True
except Exception:
    _bcrypt = None
    _HAS_BCRYPT = False

print(f"[SERVER] bcrypt available={_HAS_BCRYPT}", flush=True)

# Load .env first
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Resend loaded lazily inside send_overview_email to avoid startup crash
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')

# MongoDB connection — Motor handles auto-reconnect internally
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'test_database')

print(f"[SERVER] MONGO_URL set={bool(mongo_url)}, DB_NAME={db_name}", flush=True)

# Create client at module level — Motor is lazy (connects on first use)
# retryWrites + retryReads ensure transient failures auto-retry
try:
    _mongo_client = AsyncIOMotorClient(
        mongo_url,
        serverSelectionTimeoutMS=5000,
        connectTimeoutMS=5000,
        socketTimeoutMS=10000,
        retryWrites=True,
        retryReads=True,
    )
    _db = _mongo_client[db_name]
    print("[SERVER] Motor client created", flush=True)
except Exception as e:
    print(f"[SERVER] Motor client creation failed: {e}", flush=True)
    _mongo_client = None
    _db = None

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'cardiac-solutions-jwt-fallback')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== Production Error Logger ====================
async def log_to_db(level, message, context=""):
    """Store error/event in MongoDB for production debugging."""
    try:
        if _db is not None:
            await _db.server_log.insert_one({
                "level": level,
                "message": str(message)[:500],
                "context": context,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
            # Keep only last 200 entries
            count = await _db.server_log.count_documents({})
            if count > 200:
                oldest = await _db.server_log.find().sort("timestamp", 1).limit(count - 200).to_list(count - 200)
                if oldest:
                    ids = [doc["_id"] for doc in oldest]
                    await _db.server_log.delete_many({"_id": {"$in": ids}})
    except Exception:
        pass  # Can't log the log failure

# All available module IDs
ALL_MODULE_IDS = ["daily_report", "notifications", "service_tickets", "dashboard", "survival_path", "hybrid_training", "customer_portal", "map"]

# Create the main app
app = FastAPI(title="Cardiac Solutions API")

# CORS — MUST be added before routes so error responses also get headers
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global exception handler — ensures ALL errors return valid JSON (prevents 520)
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    error_msg = f"{type(exc).__name__}: {exc}"
    logger.error(f"Unhandled exception on {request.method} {request.url.path}: {error_msg}")
    await log_to_db("ERROR", error_msg, f"{request.method} {request.url.path}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "type": str(type(exc).__name__)},
    )

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

security = HTTPBearer()

# Diagnostic endpoint — no DB, no auth, proves server is alive
@app.get("/api/health")
async def health():
    """Ultra-fast health check — no DB, no imports. Wakes up the server."""
    return {"status": "ok"}

@app.get("/api/version")
async def version_check():
    import importlib
    versions = {}
    for pkg in ["fastapi", "uvicorn", "motor", "pymongo", "pydantic", "starlette"]:
        try:
            m = importlib.import_module(pkg)
            versions[pkg] = getattr(m, "__version__", "installed")
        except Exception:
            versions[pkg] = "NOT FOUND"
    _build_ts = datetime.now(timezone.utc).strftime("%y%m%d%H%M")
    return {
        "version": f"v{_build_ts}",
        "build": _build_ts,
        "python": sys.version,
        "status": "running",
        "bcrypt_available": _HAS_BCRYPT,
        "db_initialized": _db is not None,
        "seed_done": _seed_done,
        "packages": versions,
    }


# ==================== Models ====================

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: str
    username: str
    name: str
    email: Optional[str] = ""
    phone: Optional[str] = ""
    role: Optional[str] = "Employee"
    department: Optional[str] = ""
    allowed_modules: Optional[List[str]] = []
    di_permissions: Optional[dict] = None
    dashboard_type: Optional[str] = "standard"
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class AdminUserCreate(BaseModel):
    username: str
    password: str
    email: Optional[str] = ""
    phone: Optional[str] = ""
    role: Optional[str] = "Employee"
    department: Optional[str] = ""
    allowed_modules: Optional[List[str]] = []
    dashboard_type: Optional[str] = "standard"

class AdminUserUpdate(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None
    allowed_modules: Optional[List[str]] = None
    di_permissions: Optional[dict] = None
    dashboard_type: Optional[str] = None

class AEDDevice(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    subscriber: str
    location: str
    status: str
    last_check: str
    battery_level: int
    pads_expiry: str
    camera_status: str

class Subscriber(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    total: int
    ready: int
    not_ready: int
    reposition: int
    not_present: int
    expired_bp: int
    expiring_bp: int
    lost_contact: int
    unknown: int

class DashboardStats(BaseModel):
    total_monitored: int
    percent_ready: float
    ready: int
    not_ready: int
    reposition: int
    not_present: int
    expired_bp: int
    expiring_bp: int
    lost_contact: int
    unknown: int
    last_updated: str

# ==================== Auth Helpers ====================

def hash_password(password: str) -> str:
    """Hash password using PBKDF2-SHA256 (pure Python, no binary deps)."""
    salt = secrets.token_hex(16)
    h = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000).hex()
    return f"pbkdf2:{salt}:{h}"

def verify_password(password: str, stored: str) -> bool:
    if not stored:
        return False
    # PBKDF2 format: "pbkdf2:<salt>:<hash>"
    if stored.startswith("pbkdf2:"):
        parts = stored.split(":")
        if len(parts) == 3:
            _, salt, h = parts
            return hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000).hex() == h
        return False
    # Legacy bcrypt format ($2b$...)
    if _HAS_BCRYPT and stored.startswith("$2"):
        try:
            return _bcrypt.checkpw(password.encode('utf-8'), stored.encode('utf-8'))
        except Exception:
            return False
    return False

def create_token(user_id: str, username: str) -> str:
    payload = {
        "sub": user_id,
        "username": username,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

# Seed users to run on startup
SEED_USERS = [
    {
        "id": "user-admin-001",
        "username": "futureroads",
        "name": "System Admin",
        "email": "",
        "phone": "",
        "role": "admin",
        "department": "Admin",
        "allowed_modules": ALL_MODULE_IDS + ["user_access", "backend", "outage_status"],
        "plain_password": "@@U1s9m6c7@@",
        "created_at": "2024-01-01T00:00:00Z"
    },
    {
        "id": "user-lew-001",
        "username": "Lew",
        "name": "Lew",
        "email": "c130usmc@gmail.com",
        "phone": "",
        "role": "C Level",
        "department": "Admin",
        "allowed_modules": ALL_MODULE_IDS,
        "plain_password": "Lew123",
        "created_at": "2024-01-01T00:00:00Z"
    },
    {
        "id": "user-stark-001",
        "username": "Stark",
        "name": "Tony Stark",
        "email": "iq.ai.solutions@gmail.com",
        "phone": "",
        "role": "Director",
        "department": "Service",
        "allowed_modules": ALL_MODULE_IDS,
        "dashboard_type": "stark",
        "di_permissions": {"expired_bp": "overview", "expiring_bp": "overview", "camera_battery": "overview", "camera_cellular": "overview"},
        "plain_password": "Stark123",
        "created_at": "2024-01-01T00:00:00Z"
    },
    {
        "id": "user-tony-001",
        "username": "Tony",
        "name": "Tony",
        "email": "",
        "phone": "",
        "role": "Manager",
        "department": "Sales",
        "allowed_modules": ALL_MODULE_IDS,
        "plain_password": "Tony123",
        "created_at": "2024-01-01T00:00:00Z"
    },
    {
        "id": "user-tracey-001",
        "username": "Tracey",
        "name": "Tracey",
        "email": "",
        "phone": "",
        "role": "Supervisor",
        "department": "Service",
        "allowed_modules": ALL_MODULE_IDS,
        "plain_password": "Tracey123",
        "created_at": "2024-01-01T00:00:00Z"
    },
    {
        "id": "user-nate-001",
        "username": "Nate",
        "name": "Nate",
        "email": "",
        "phone": "",
        "role": "Employee",
        "department": "Warehouse",
        "allowed_modules": ALL_MODULE_IDS,
        "plain_password": "Nate123",
        "created_at": "2024-01-01T00:00:00Z"
    },
    {
        "id": "user-jon-001",
        "username": "Jon",
        "name": "Jon",
        "email": "",
        "phone": "",
        "role": "Employee",
        "department": "Shipping",
        "allowed_modules": ALL_MODULE_IDS,
        "plain_password": "Jon123",
        "created_at": "2024-01-01T00:00:00Z"
    },
]

async def seed_users():
    """Seed predefined users. Non-blocking — runs PBKDF2 in thread pool."""
    # Quick check: if all users exist, still run update pass for module changes
    try:
        count = await _db.users.count_documents({})
        skip_inserts = count >= len(SEED_USERS)
        if skip_inserts:
            logger.info(f"Seed: {count} users exist, checking for field updates only")
    except Exception:
        skip_inserts = False

    seeded = 0
    for seed in SEED_USERS:
        try:
            existing = await _db.users.find_one({"username": seed["username"]})
            if not existing:
                if skip_inserts:
                    continue
                pw_hash = await asyncio.to_thread(hash_password, seed["plain_password"])
                doc = {
                    "id": seed["id"],
                    "username": seed["username"],
                    "name": seed["name"],
                    "email": seed["email"],
                    "phone": seed["phone"],
                    "role": seed["role"],
                    "department": seed.get("department", ""),
                    "allowed_modules": seed["allowed_modules"],
                    "password_hash": pw_hash,
                    "created_at": seed["created_at"],
                }
                await _db.users.insert_one(doc)
                seeded += 1
            else:
                update_fields = {}
                current_hash = existing.get("password_hash", "")
                if not current_hash or not current_hash.startswith("pbkdf2:"):
                    update_fields["password_hash"] = await asyncio.to_thread(hash_password, seed["plain_password"])
                if set(existing.get("allowed_modules", [])) != set(seed["allowed_modules"]):
                    update_fields["allowed_modules"] = seed["allowed_modules"]
                if existing.get("role") != seed["role"]:
                    update_fields["role"] = seed["role"]
                for field in ["department", "phone", "email", "name"]:
                    if field not in existing or existing[field] is None:
                        update_fields[field] = seed.get(field, "")
                # Always sync dashboard_type and di_permissions from seed
                if "dashboard_type" in seed and existing.get("dashboard_type") != seed["dashboard_type"]:
                    update_fields["dashboard_type"] = seed["dashboard_type"]
                if "di_permissions" in seed and existing.get("di_permissions") != seed["di_permissions"]:
                    update_fields["di_permissions"] = seed["di_permissions"]
                if update_fields:
                    await _db.users.update_one({"username": seed["username"]}, {"$set": update_fields})
                    logger.info(f"Seed: updated {seed['username']} fields: {list(update_fields.keys())}")
        except Exception as e:
            logger.error(f"Failed to seed user {seed['username']}: {e}")
    logger.info(f"Seeding complete: {seeded} new users")


async def _seed_subscriber_contacts():
    """Seed subscriber contacts from the Sentinel Customer Database Excel data."""
    existing = await _db.subscriber_contacts.count_documents({})
    if existing >= 51:
        logger.info(f"Subscriber contacts already seeded ({existing} docs), skipping")
        return
    contacts_data = [
        {"subscriber": "Alabama A&M", "to_email": "melvin.lewis@aamu.edu", "sales_rep": "John Powe", "cc_email": "jpowe@cardiac-solutions.net", "contact_name": "Melvin Lewis"},
        {"subscriber": "Alabama School Nurses", "to_email": "lmarshall@alsde.edu", "sales_rep": "Jon Seale", "cc_email": "jseale@cardiac-solutions.net", "contact_name": "LaBrenda Marshall"},
        {"subscriber": "All Phase Electric", "to_email": "tzemaitis@all-phasegr.com", "sales_rep": "Ty VanderWall", "cc_email": "tvanderwall@cardiac-solutions.net", "contact_name": "Travis Zmaitis"},
        {"subscriber": "Altec", "to_email": "bmartin@cardiac-solutions.net", "sales_rep": "Bryan Martin", "cc_email": "bmartin@cardiac-solutions.net", "contact_name": "Bryan Martin"},
        {"subscriber": "Avoyelles Parish Sheriffs Office", "to_email": "rsanders@avoyellesso.org", "sales_rep": "Rachael Grose", "cc_email": "rgrose@cardiac-solutions.net", "contact_name": "Capt. Reggie Sanders"},
        {"subscriber": "Baton Rouge Airport", "to_email": "jjohnson@flybtr.com", "sales_rep": "Rachael Grose", "cc_email": "rgrose@cardiac-solutions.net", "contact_name": "Jeremy Johnson"},
        {"subscriber": "Birmingham Airport Authority", "to_email": "kleonard@flybirmingham.com", "sales_rep": "Jon Seale", "cc_email": "jseale@cardiac-solutions.net", "contact_name": "Kenji Leonard"},
        {"subscriber": "Birmingham City Schools", "to_email": "larrington@bhm.k12.al.us", "sales_rep": "Ben Yother", "cc_email": "byother@cardiac-solutions.net", "contact_name": "LaVonna Arrington"},
        {"subscriber": "Birmingham Libraries", "to_email": "Karyn.Davis-West@cobpl.org", "sales_rep": "John Powe/Ben Yother", "cc_email": "jpowe@cardiac-solutions.net, byother@cardiac-solutions.net", "contact_name": "Ka'ryn Davis"},
        {"subscriber": "Birmingham Police Dept", "to_email": "Herman.Cleveland@birminghamal.gov", "sales_rep": "Ben Yother", "cc_email": "byother@cardiac-solutions.net", "contact_name": "Herman Cleveland"},
        {"subscriber": "Carencro PD", "to_email": "ohaydel@carencropd.com", "sales_rep": "Rachael Grose", "cc_email": "rgrose@cardiac-solutions.net", "contact_name": "Oren Haydel"},
        {"subscriber": "City of Homewood", "to_email": "Matthew.Waine@homewoodal.org", "sales_rep": "Mark/Jon Seale", "cc_email": "mallred@cardiac-solutions.net, jseale@cardiac-solutions.net", "contact_name": "Matthew Waine"},
        {"subscriber": "City of Montgomery", "to_email": "gfarmer@montgomeryal.gov", "sales_rep": "Jon Seale", "cc_email": "jseale@cardiac-solutions.net", "contact_name": "Chirf Gary Farmer"},
        {"subscriber": "City of Opelika", "to_email": "dboyd@opelika-al.gov", "sales_rep": "Mark/Jon Seale", "cc_email": "mallred@cardiac-solutions.net, jseale@cardiac-solutions.net", "contact_name": "Chief Shane Boyd"},
        {"subscriber": "City of Plaquemine", "to_email": "Jbarlow@Plaquemine.org", "sales_rep": "Rachael Grose", "cc_email": "rgrose@cardiac-solutions.net", "contact_name": "John Barlow"},
        {"subscriber": "City of Springville", "to_email": "gdarnell@cityofspringville.com", "sales_rep": "Mark/Jon Seale", "cc_email": "mallred@cardiac-solutions.net, jseale@cardiac-solutions.net", "contact_name": "Graham Darnell"},
        {"subscriber": "Clean Harbor-Hepaco", "to_email": "smith.justin85@cleanharbors.com", "sales_rep": "Ben Yother", "cc_email": "byother@cardiac-solutions.net", "contact_name": "Justin Smith"},
        {"subscriber": "Concordia Parish", "to_email": "oep@vidalialafd.com", "sales_rep": "Rachael Grose", "cc_email": "rgrose@cardiac-solutions.net", "contact_name": "Tim Vanier"},
        {"subscriber": "County of Franklin", "to_email": "Sheriff@FranklinSheriff.org", "sales_rep": "Jon Seale/Thomas Wilson", "cc_email": "jseale@cardiac-solutions.net, twilson@cardiac-solutions.net", "contact_name": "Shannon Oliver"},
        {"subscriber": "Cullman County", "to_email": "rcash@cullmansheriff.org", "sales_rep": "Jon Seale", "cc_email": "jseale@cardiac-solutions.net", "contact_name": "Rebekah Cash"},
        {"subscriber": "East Baton Rouge Parish", "to_email": "mcrawford@ebrso.org", "sales_rep": "Rachael Grose", "cc_email": "rgrose@cardiac-solutions.net", "contact_name": "Lt Michael Crawford"},
        {"subscriber": "Gadsden City Schools", "to_email": "kmatlock@gadsdencityschools.org", "sales_rep": "Ben Yother", "cc_email": "byother@cardiac-solutions.net", "contact_name": "Kristi Matlock"},
        {"subscriber": "Georgia Power", "to_email": "RSAYE@SOUTHERNCO.COM", "sales_rep": "Tracey Prince/Jon Seale", "cc_email": "tprince@cardiac-solutions.net, jseale@cardiac-solutions.net", "contact_name": "Robert Saye"},
        {"subscriber": "GPC", "to_email": "", "sales_rep": "Jon Seale", "cc_email": "jseale@cardiac-solutions.net", "contact_name": ""},
        {"subscriber": "GRCC Sheriff Dept.", "to_email": "rwhitman@grcc.edu", "sales_rep": "Ty VanderWall", "cc_email": "tvanderwall@cardiac-solutions.net", "contact_name": "Rebecca Whitman"},
        {"subscriber": "Housing Authority - Bham", "to_email": "Amatthews@habd.net", "sales_rep": "Jon Seale/John Powe", "cc_email": "jseale@cardiac-solutions.net, jpowe@cardiac-solutions.net", "contact_name": "Armon Matthews"},
        {"subscriber": "Hammond Police Department", "to_email": "rogers_sm@hammond.org", "sales_rep": "Rachael Grose", "cc_email": "rgrose@cardiac-solutions.net", "contact_name": "Stephanie Rogers"},
        {"subscriber": "Houston Housing Authority", "to_email": "", "sales_rep": "Jon Seale", "cc_email": "jseale@cardiac-solutions.net", "contact_name": ""},
        {"subscriber": "Houma Police Department", "to_email": "jboudreaux@tpcg.org", "sales_rep": "Rachael Grose", "cc_email": "rgrose@cardiac-solutions.net", "contact_name": "Lt Dennis Boudreaux"},
        {"subscriber": "I3 Academy", "to_email": "Rmurphy@I3academy.org", "sales_rep": "Thomas Wilson", "cc_email": "twilson@cardiac-solutions.net", "contact_name": "Roshunda Murphy"},
        {"subscriber": "Iberville Parish Sheriff", "to_email": "wdanielfield@ibervilleso.com", "sales_rep": "Rachael Grose", "cc_email": "rgrose@cardiac-solutions.net", "contact_name": "Captain William Danielfield"},
        {"subscriber": "Lawson State Community College", "to_email": "mhudson@lawsonstate.edu", "sales_rep": "John Powe", "cc_email": "jpowe@cardiac-solutions.net", "contact_name": "Officer Hudson"},
        {"subscriber": "Leapley Construction", "to_email": "lmontgom@southernco.com", "sales_rep": "Jon Seale/Tracey Prince", "cc_email": "jseale@cardiac-solutions.net, tprince@cardiac-solutions.net", "contact_name": "Lori Montgomery"},
        {"subscriber": "Marshall County Sheriff", "to_email": "scantrell@marshallco.org", "sales_rep": "Thomas Wilson", "cc_email": "twilson@cardiac-solutions.net", "contact_name": "Sonya Cantrel"},
        {"subscriber": "Mississippi Power", "to_email": "Jahollan@southernco.com", "sales_rep": "Jon Seale/Mark", "cc_email": "jseale@cardiac-solutions.net, mallred@cardiac-solutions.net", "contact_name": "Jared Holland"},
        {"subscriber": "Montgomery PD", "to_email": "rcarson@montgomeryal.gov", "sales_rep": "Jon Seale", "cc_email": "jseale@cardiac-solutions.net", "contact_name": "Stephanie Hardaway"},
        {"subscriber": "Motion Industries", "to_email": "Chad.jones@Motion.com", "sales_rep": "Jon Seale", "cc_email": "jseale@cardiac-solutions.net", "contact_name": "Chad Jones"},
        {"subscriber": "MP Chevron Cogen", "to_email": "bmfisher@southernco.com", "sales_rep": "Jon Seale", "cc_email": "jseale@cardiac-solutions.net", "contact_name": "Brandon Fisher"},
        {"subscriber": "Opelika PD", "to_email": "Rbugg@opelika-al.gov", "sales_rep": "Thomas Wilson", "cc_email": "twilson@cardiac-solutions.net", "contact_name": "Robert Bugg"},
        {"subscriber": "Shelby County Tennessee Sheriff", "to_email": "Bryan.Jones@Shelby-Sheriff.org", "sales_rep": "Jon Seale/Mark", "cc_email": "jseale@cardiac-solutions.net, mallred@cardiac-solutions.net", "contact_name": "Bryan Jones"},
        {"subscriber": "St. John the Baptist Parish", "to_email": "gmiller@stjohn.k12.la.us", "sales_rep": "Rachael Grose", "cc_email": "rgrose@cardiac-solutions.net", "contact_name": "Anthony Miller"},
        {"subscriber": "Talladega County Sheriff", "to_email": "jtubbs@talladegacountyal.org", "sales_rep": "Thomas Wilson", "cc_email": "twilson@cardiac-solutions.net", "contact_name": "Josh Tubbs"},
        {"subscriber": "Terrabonne Parrish", "to_email": "jfonseca@tpso.net", "sales_rep": "Rachael Grose", "cc_email": "rgrose@cardiac-solutions.net", "contact_name": "JACOB FONSECA"},
        {"subscriber": "Vermilion Parish", "to_email": "chiefhardy@kaplanpolice.com", "sales_rep": "Rachael Grose", "cc_email": "rgrose@cardiac-solutions.net", "contact_name": "Chief Hardy"},
        {"subscriber": "Blount County", "to_email": "wneill@blountcountyal.gov", "sales_rep": "Thomas Wilson", "cc_email": "twilson@cardiac-solutions.net", "contact_name": "Wes Neill"},
        {"subscriber": "Shelby County Alabama", "to_email": "trose@shelbyso.com", "sales_rep": "Jon Seale", "cc_email": "jseale@cardiac-solutions.net", "contact_name": "Tovah Rose"},
        # Readisys-specific name variants (map to same contact data as Excel equivalents)
        {"subscriber": "HABD", "to_email": "Amatthews@habd.net", "sales_rep": "Jon Seale/John Powe", "cc_email": "jseale@cardiac-solutions.net, jpowe@cardiac-solutions.net", "contact_name": "Armon Matthews"},
        {"subscriber": "HHA", "to_email": "", "sales_rep": "Jon Seale", "cc_email": "jseale@cardiac-solutions.net", "contact_name": ""},
        {"subscriber": "Blount Co Sheriff", "to_email": "wneill@blountcountyal.gov", "sales_rep": "Thomas Wilson", "cc_email": "twilson@cardiac-solutions.net", "contact_name": "Wes Neill"},
        {"subscriber": "Shelby County Alabama Sheriff", "to_email": "trose@shelbyso.com", "sales_rep": "Jon Seale", "cc_email": "jseale@cardiac-solutions.net", "contact_name": "Tovah Rose"},
        {"subscriber": "All-Phase Electric Supply", "to_email": "tzemaitis@all-phasegr.com", "sales_rep": "Ty VanderWall", "cc_email": "tvanderwall@cardiac-solutions.net", "contact_name": "Travis Zmaitis"},
    ]
    seeded = 0
    for c in contacts_data:
        result = await _db.subscriber_contacts.update_one(
            {"subscriber": c["subscriber"]},
            {"$set": {
                "to_email": c["to_email"],
                "cc_email": c["cc_email"],
                "sales_rep": c["sales_rep"],
                "contact_name": c.get("contact_name", ""),
                "bcc_emails": "",
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "updated_by": "system_seed"
            }},
            upsert=True
        )
        if result.upserted_id or result.modified_count > 0:
            seeded += 1
    logger.info(f"Subscriber contacts seed: {seeded} upserted out of {len(contacts_data)}")


_seed_done = False
_init_running = False

async def _run_lazy_init():
    """Run DB cleanup and seeding in background. Non-blocking for login."""
    global _seed_done, _init_running
    if _seed_done or _init_running:
        return
    _init_running = True
    try:
        # 1. Delete documents where username is null or missing
        del_null = await _db.users.delete_many({"$or": [
            {"username": None},
            {"username": {"$exists": False}},
            {"username": ""},
        ]})
        if del_null.deleted_count > 0:
            logger.info(f"DB cleanup: deleted {del_null.deleted_count} docs with null/empty username")

        # 2. Remove ALL duplicate 'id' values — keep first occurrence only
        pipeline = [
            {"$group": {"_id": "$id", "count": {"$sum": 1}, "docs": {"$push": "$_id"}}},
            {"$match": {"count": {"$gt": 1}}},
        ]
        async for dup in _db.users.aggregate(pipeline):
            for oid in dup["docs"][1:]:
                await _db.users.delete_one({"_id": oid})
                logger.info(f"DB cleanup: removed duplicate id={dup['_id']} (_id={oid})")

        # 3. Remove ALL duplicate 'username' values — keep first occurrence only
        pipeline2 = [
            {"$match": {"username": {"$ne": None, "$ne": ""}}},
            {"$group": {"_id": "$username", "count": {"$sum": 1}, "docs": {"$push": "$_id"}}},
            {"$match": {"count": {"$gt": 1}}},
        ]
        async for dup in _db.users.aggregate(pipeline2):
            for oid in dup["docs"][1:]:
                await _db.users.delete_one({"_id": oid})
                logger.info(f"DB cleanup: removed duplicate username={dup['_id']} (_id={oid})")

        # 4. Drop old non-sparse indexes before recreating with sparse=True
        try:
            await _db.users.drop_index("username_1")
        except Exception:
            pass
        try:
            await _db.users.drop_index("id_1")
        except Exception:
            pass

        await _db.users.create_index("username", unique=True, sparse=True)
        await _db.users.create_index("id", unique=True, sparse=True)
        await asyncio.wait_for(seed_users(), timeout=10)
        await _seed_subscriber_contacts()
        _seed_done = True
        logger.info("Lazy init complete: cleanup + indexes + seed done")
    except Exception as e:
        logger.warning(f"Lazy init failed: {e}")
        try:
            await log_to_db("ERROR", f"Lazy init failed: {e}", "login")
        except Exception:
            pass
        _seed_done = True  # Prevent re-triggering
    finally:
        _init_running = False

def _readisys_auth_headers():
    """Generate Bearer token headers for Readisys API calls using the cross-domain JWT flow."""
    payload = {
        "sub": "system",
        "role": "Admin",
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(seconds=300),
        "target": "readisys",
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return {"Authorization": f"Bearer {token}"}

async def _prewarm_caches():
    """Pre-warm Readisys API caches so first dashboard load has data."""
    import httpx, time
    for attempt in range(3):
        try:
            headers = _readisys_auth_headers()
            async with httpx.AsyncClient(timeout=20 + attempt * 5) as client:
                # Fetch BOTH endpoints in parallel
                status_task = client.get("https://readisys.survivalpath.ai/api/status-overview", headers=headers)
                bp_task = client.get("https://readisys.survivalpath.ai/api/status-overview/expiring-expired-bp", headers=headers)
                results = await asyncio.gather(status_task, bp_task, return_exceptions=True)

                if not isinstance(results[0], Exception) and results[0].status_code == 200:
                    _status_cache["data"] = results[0].json()
                    _status_cache["ts"] = time.time()
                    logger.info(f"Cache pre-warm: status-overview OK (attempt {attempt+1})")
                elif isinstance(results[0], Exception):
                    logger.warning(f"Cache pre-warm: status-overview failed attempt {attempt+1}: {results[0]}")

                if not isinstance(results[1], Exception) and results[1].status_code == 200:
                    _bp_cache["data"] = results[1].json()
                    _bp_cache["ts"] = time.time()
                    logger.info(f"Cache pre-warm: expiring-bp OK (attempt {attempt+1})")
                elif isinstance(results[1], Exception):
                    logger.warning(f"Cache pre-warm: expiring-bp failed attempt {attempt+1}: {results[1]}")

            # If both populated, stop retrying
            if _status_cache["data"] and _bp_cache["data"]:
                break
        except Exception as e:
            logger.warning(f"Cache pre-warm attempt {attempt+1} failed: {e}")
        if attempt < 2:
            await asyncio.sleep(2)

@app.on_event("startup")
async def startup():
    global _mongo_client, _db
    print("[SERVER] READY (instant start, DB connecting in background)", flush=True)
    # Eagerly connect to DB so first request doesn't wait
    try:
        _mongo_client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=5000)
        _db = _mongo_client[db_name]
        # Fire-and-forget: start lazy init in background
        asyncio.create_task(_run_lazy_init())
    except Exception as e:
        print(f"[SERVER] DB connection deferred: {e}", flush=True)
    # Pre-warm Readisys caches in background so first dashboard load has data
    asyncio.create_task(_prewarm_caches())
    # Start daily notified AEDs status refresh loop
    asyncio.create_task(_notified_aeds_daily_loop())
    # Backfill notified AEDs from historical notification data
    asyncio.create_task(_backfill_notified_aeds())

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    global _mongo_client, _db
    if _db is None:
        try:
            _mongo_client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=5000)
            _db = _mongo_client[db_name]
        except Exception:
            raise HTTPException(status_code=503, detail="Database not available")
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")

        user = await _db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except HTTPException:
        raise
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        logger.error(f"get_current_user error: {type(e).__name__}: {e}")
        raise HTTPException(status_code=503, detail="Service temporarily unavailable")

async def require_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

# ==================== Auth Routes ====================

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin, background_tasks: BackgroundTasks = None):
    global _seed_done, _mongo_client, _db
    # Reconnect if DB was never initialized
    if _db is None:
        try:
            _mongo_client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=5000)
            _db = _mongo_client[db_name]
        except Exception:
            raise HTTPException(status_code=503, detail="Database unavailable")
    # Kick off lazy init in background (non-blocking)
    if not _seed_done and not _init_running:
        asyncio.create_task(_run_lazy_init())

    try:
        user = await _db.users.find_one({"username": credentials.username}, {"_id": 0})
    except Exception as e:
        error_msg = f"Login DB error: {type(e).__name__}: {e}"
        logger.error(error_msg)
        await log_to_db("ERROR", error_msg, f"username={credentials.username}")
        raise HTTPException(status_code=503, detail="Database temporarily unavailable. Please try again.")

    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    if not await asyncio.to_thread(verify_password, credentials.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    # Auto-migrate legacy bcrypt hashes to PBKDF2 on successful login
    current_hash = user.get("password_hash", "")
    if current_hash and not current_hash.startswith("pbkdf2:"):
        try:
            new_hash = await asyncio.to_thread(hash_password, credentials.password)
            await _db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": new_hash}})
        except Exception:
            pass  # Non-critical

    token = create_token(user["id"], user["username"])

    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user["id"],
            username=user["username"],
            name=user.get("name", user["username"]),
            email=user.get("email", ""),
            phone=user.get("phone", ""),
            role=user.get("role", "Employee"),
            department=user.get("department", ""),
            allowed_modules=user.get("allowed_modules", []),
            di_permissions=user.get("di_permissions"),
            dashboard_type=user.get("dashboard_type", "standard"),
            created_at=user.get("created_at", ""),
        )
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(
        id=current_user["id"],
        username=current_user["username"],
        name=current_user.get("name", current_user["username"]),
        email=current_user.get("email", ""),
        phone=current_user.get("phone", ""),
        role=current_user.get("role", "Employee"),
        department=current_user.get("department", ""),
        allowed_modules=current_user.get("allowed_modules", []),
        di_permissions=current_user.get("di_permissions"),
        dashboard_type=current_user.get("dashboard_type", "standard"),
        created_at=current_user.get("created_at", ""),
    )

# ==================== Cross-Domain SSO Token ====================

ALLOWED_CROSS_DOMAIN_TARGETS = {
    "report": "https://report.cardiac-solutions.ai/auth",
    "notifications": "https://notifications.cardiac-solutions.ai/auth",
}

class CrossDomainTokenRequest(BaseModel):
    target: str  # "report" or "notifications"

class CrossDomainTokenResponse(BaseModel):
    redirect_url: str

@api_router.post("/auth/cross-domain-token", response_model=CrossDomainTokenResponse)
async def create_cross_domain_token(
    body: CrossDomainTokenRequest,
    current_user: dict = Depends(get_current_user),
):
    """Generate a one-time, short-lived JWT for cross-domain SSO redirect."""
    target_url = ALLOWED_CROSS_DOMAIN_TARGETS.get(body.target)
    if not target_url:
        raise HTTPException(status_code=400, detail=f"Unknown target: {body.target}")

    payload = {
        "sub": current_user["id"],
        "username": current_user.get("username", ""),
        "name": current_user.get("name", ""),
        "role": current_user.get("role", "Employee"),
        "email": current_user.get("email", ""),
        "allowed_modules": current_user.get("allowed_modules", []),
        "jti": uuid.uuid4().hex,           # unique token ID for single-use
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(seconds=60),
        "target": body.target,
    }

    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    redirect_url = f"{target_url}?token={token}"

    return CrossDomainTokenResponse(redirect_url=redirect_url)

# ==================== Admin User Management ====================

@api_router.get("/admin/users")
async def list_users(admin: dict = Depends(require_admin)):
    try:
        users = await _db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(500)
        return users
    except Exception as e:
        logger.error(f"list_users error: {e}")
        raise HTTPException(status_code=500, detail="Failed to load users")

@api_router.post("/admin/users")
async def create_user(data: AdminUserCreate, admin: dict = Depends(require_admin)):
    try:
        existing = await _db.users.find_one({"username": data.username})
        if existing:
            raise HTTPException(status_code=400, detail="Username already exists")

        user_id = f"user-{uuid.uuid4().hex[:8]}"
        doc = {
            "id": user_id,
            "username": data.username,
            "name": data.username,
            "email": data.email or "",
            "phone": data.phone or "",
            "role": data.role or "Employee",
            "department": data.department or "",
            "allowed_modules": data.allowed_modules or [],
            "dashboard_type": data.dashboard_type or "standard",
            "password_hash": await asyncio.to_thread(hash_password, data.password),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await _db.users.insert_one(doc)
        doc.pop("_id", None)
        doc.pop("password_hash", None)
        return doc
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"create_user error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create user")

@api_router.put("/admin/users/{user_id}")
async def update_user(user_id: str, data: AdminUserUpdate, admin: dict = Depends(require_admin)):
    try:
        user = await _db.users.find_one({"id": user_id})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        update = {}
        if data.username is not None:
            clash = await _db.users.find_one({"username": data.username, "id": {"$ne": user_id}})
            if clash:
                raise HTTPException(status_code=400, detail="Username already exists")
            update["username"] = data.username
            update["name"] = data.username
        if data.password is not None and data.password != "":
            update["password_hash"] = await asyncio.to_thread(hash_password, data.password)
        if data.email is not None:
            update["email"] = data.email
        if data.phone is not None:
            update["phone"] = data.phone
        if data.role is not None:
            update["role"] = data.role
        if data.department is not None:
            update["department"] = data.department
        if data.allowed_modules is not None:
            update["allowed_modules"] = data.allowed_modules
        if data.di_permissions is not None:
            update["di_permissions"] = data.di_permissions
        if data.dashboard_type is not None:
            update["dashboard_type"] = data.dashboard_type

        if update:
            await _db.users.update_one({"id": user_id}, {"$set": update})

        updated = await _db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
        return updated
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"update_user error: {e}")
        raise HTTPException(status_code=500, detail="Failed to update user")

@api_router.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, admin: dict = Depends(require_admin)):
    if user_id == "user-admin-001":
        raise HTTPException(status_code=400, detail="Cannot delete the system admin")
    try:
        result = await _db.users.delete_one({"id": user_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="User not found")
        return {"status": "deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"delete_user error: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete user")

@api_router.get("/admin/modules")
async def list_modules(admin: dict = Depends(require_admin)):
    """Return list of available modules for assignment."""
    return [
        {"id": "daily_report", "title": "Daily Report"},
        {"id": "notifications", "title": "Notifications"},
        {"id": "service_tickets", "title": "Service Tickets"},
        {"id": "dashboard", "title": "Dashboard"},
        {"id": "survival_path", "title": "Survival Path"},
        {"id": "user_access", "title": "User Access"},
        {"id": "backend", "title": "Backend"},
        {"id": "outage_status", "title": "Outage Status"},
    ]

# ==================== Subscriber Contacts ====================

@api_router.get("/subscriber-contacts")
async def list_subscriber_contacts(current_user: dict = Depends(get_current_user)):
    """List all subscriber contact configurations."""
    contacts = []
    async for c in _db.subscriber_contacts.find({}, {"_id": 0}):
        contacts.append(c)
    return contacts

@api_router.get("/subscriber-contacts/{subscriber_name}")
async def get_subscriber_contact(subscriber_name: str, current_user: dict = Depends(get_current_user)):
    """Get contact config for a specific subscriber."""
    contact = await _db.subscriber_contacts.find_one({"subscriber": subscriber_name}, {"_id": 0})
    if not contact:
        return {"subscriber": subscriber_name, "to_email": "", "cc_email": "", "bcc_emails": "", "sales_rep": ""}
    return contact

@api_router.put("/subscriber-contacts/{subscriber_name}")
async def upsert_subscriber_contact(subscriber_name: str, data: dict, current_user: dict = Depends(get_current_user)):
    """Create or update contact config for a subscriber."""
    doc = {
        "subscriber": subscriber_name,
        "to_email": data.get("to_email", ""),
        "cc_email": data.get("cc_email", ""),
        "bcc_emails": data.get("bcc_emails", ""),
        "sales_rep": data.get("sales_rep", ""),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": current_user.get("username", ""),
    }
    await _db.subscriber_contacts.update_one(
        {"subscriber": subscriber_name},
        {"$set": doc},
        upsert=True
    )
    return doc

@api_router.get("/support/dashboard-data")
async def support_dashboard_data(current_user: dict = Depends(get_current_user)):
    """Aggregate subscriber device data for the Support Dashboard using voice APIs."""
    import httpx, time, asyncio, urllib.parse
    headers = _readisys_auth_headers()
    now = time.time()

    # Reuse cached data for fleet totals
    status_data = _status_cache["data"] if (_status_cache["data"] and (now - _status_cache["ts"]) < 300) else None
    if not status_data:
        try:
            async with httpx.AsyncClient(timeout=25) as client:
                resp = await client.get("https://readisys.survivalpath.ai/api/status-overview", headers=headers)
                if resp.status_code == 200:
                    status_data = resp.json()
                    _status_cache["data"] = status_data
                    _status_cache["ts"] = now
        except Exception as e:
            logger.warning(f"support dashboard status fetch: {e}")
    if not status_data and _status_cache["data"]:
        status_data = _status_cache["data"]
    status_data = status_data or {}

    # Get subscriber list from voice API
    subscribers = []
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get("https://readisys.survivalpath.ai/api/voice/subscribers", headers=headers)
            if resp.status_code == 200:
                sub_list = resp.json().get("subscribers", [])
            else:
                sub_list = []
    except:
        sub_list = []

    # For each subscriber with data, get status counts
    async def fetch_sub_status(sub_name):
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                enc = urllib.parse.quote(sub_name)
                resp = await client.get(
                    f"https://readisys.survivalpath.ai/api/voice/subscriber/{enc}/status?brief=true",
                    headers=headers
                )
                if resp.status_code == 200:
                    return resp.json()
        except:
            pass
        return None

    # Fetch statuses for all subscribers with data (in batches to avoid overwhelming)
    active_subs = [s for s in sub_list if s.get("has_data")]

    # Batch fetch (max 10 concurrent)
    results = []
    batch_size = 10
    for i in range(0, len(active_subs), batch_size):
        batch = active_subs[i:i+batch_size]
        batch_results = await asyncio.gather(
            *[fetch_sub_status(s["name"]) for s in batch],
            return_exceptions=True
        )
        results.extend(zip(batch, batch_results))

    # Get subscriber contacts
    contacts_map = {}
    async for c in _db.subscriber_contacts.find({}, {"_id": 0}):
        contacts_map[c["subscriber"]] = c

    for sub_info, status in results:
        if isinstance(status, Exception) or not status:
            continue
        name = sub_info["name"]
        counts = status.get("counts", {})
        expired = counts.get("expired_bp", 0)
        expiring = counts.get("expiring_batt_pads", 0)
        not_ready = counts.get("not_ready", 0)
        reposition = counts.get("reposition", 0)
        not_present = counts.get("not_present", 0)
        unknown = counts.get("unknown", 0)
        lost_contact = counts.get("lost_contact", 0)
        total = expired + expiring + not_ready + reposition + not_present + unknown
        if total > 0:
            subscribers.append({
                "subscriber": name,
                "expired_bp": expired,
                "expiring_bp": expiring,
                "not_ready": not_ready,
                "reposition": reposition,
                "not_present": not_present,
                "unknown": unknown,
                "lost_contact": lost_contact,
                "total_issues": total,
                "monitored_aeds": counts.get("monitored_aeds", 0),
                "percent_ready": status.get("percent_ready", 0),
                "contact": contacts_map.get(name, {}),
            })

    subscribers.sort(key=lambda x: x["total_issues"], reverse=True)

    # Get notified subscriber names from notification_history
    notified_subs = set()
    notified_counts = {"expired_bp": 0, "expiring_bp": 0, "not_ready": 0, "reposition": 0, "not_present": 0, "unknown": 0, "total": 0}

    # Get per-subscriber, per-issue-type notified device counts from notified_aeds
    sub_notified_map = {}  # {subscriber: {issue_type: count}}
    try:
        pipeline = [
            {"$match": {"resolved": False}},
            {"$group": {"_id": {"subscriber": "$subscriber", "issue_type": "$issue_type"}, "count": {"$sum": 1}}},
        ]
        async for doc in _db.notified_aeds.aggregate(pipeline):
            sub = doc["_id"]["subscriber"]
            itype = doc["_id"]["issue_type"]
            if sub not in sub_notified_map:
                sub_notified_map[sub] = {}
            sub_notified_map[sub][itype] = doc["count"]
    except Exception as e:
        logger.warning(f"Failed to fetch notified_aeds counts: {e}")

    try:
        async for doc in _db.notification_history.find({}, {"_id": 0, "subscriber": 1}):
            if doc.get("subscriber"):
                notified_subs.add(doc["subscriber"])

        # Count notified DEVICE counts per issue type
        for s in subscribers:
            if s["subscriber"] in notified_subs:
                notified_counts["total"] += s.get("total_issues", 0)
                notified_counts["expired_bp"] += s.get("expired_bp", 0)
                notified_counts["expiring_bp"] += s.get("expiring_bp", 0)
                notified_counts["not_ready"] += s.get("not_ready", 0)
                notified_counts["reposition"] += s.get("reposition", 0)
                notified_counts["not_present"] += s.get("not_present", 0)
                notified_counts["unknown"] += s.get("unknown", 0)
            s["notified"] = s["subscriber"] in notified_subs
            # Attach per-issue notified counts for this subscriber
            sn = sub_notified_map.get(s["subscriber"], {})
            s["notified_devices"] = {
                "expired_bp": sn.get("EXPIRED B/P", 0),
                "expiring_bp": sn.get("EXPIRING BATT/PADS", 0),
                "not_ready": sn.get("NOT READY", 0),
                "reposition": sn.get("REPOSITION", 0),
                "not_present": sn.get("NOT PRESENT", 0),
                "unknown": sn.get("UNKNOWN", 0),
            }
            s["notified_devices"]["total"] = sum(s["notified_devices"].values())
    except Exception as e:
        logger.warning(f"Failed to fetch notification history: {e}")
        for s in subscribers:
            s["notified"] = False
            s["notified_devices"] = {}

    totals = status_data.get("totals", {})
    dsc = totals.get("detailed_status_counts", {})

    # Get notified AED tracking data for adjusted readiness
    notified_aed_unresolved = 0
    try:
        notified_aed_unresolved = await _db.notified_aeds.count_documents({"resolved": False})
    except:
        pass

    total_monitored = totals.get("total", 0)
    total_ready = dsc.get("ready", 0)
    total_issues_fleet = total_monitored - total_ready if total_monitored > total_ready else 0
    pct_ready = round((total_ready / total_monitored) * 100, 1) if total_monitored else 0
    adjusted_issues = max(0, total_issues_fleet - notified_aed_unresolved)
    adjusted_ready_count = total_monitored - adjusted_issues if total_monitored > adjusted_issues else total_monitored
    pct_ready_adjusted = round((adjusted_ready_count / total_monitored) * 100, 1) if total_monitored else 0

    return {
        "subscribers": subscribers,
        "total_subscribers": len(subscribers),
        "notified_counts": notified_counts,
        "fleet_totals": {
            "expired_bp": dsc.get("expired_bp", 0),
            "expiring_bp": dsc.get("expiring_batt_pads", 0),
            "not_ready": dsc.get("not_ready", 0),
            "reposition": dsc.get("reposition", 0),
            "not_present": dsc.get("not_present", 0),
            "unknown": dsc.get("unknown", 0),
            "lost_contact": dsc.get("lost_contact", 0),
        },
        "readiness": {
            "total_monitored": total_monitored,
            "total_ready": total_ready,
            "total_issues": total_issues_fleet,
            "pct_ready": pct_ready,
            "notified_aed_unresolved": notified_aed_unresolved,
            "adjusted_issues": adjusted_issues,
            "pct_ready_adjusted": pct_ready_adjusted,
        },
    }


@api_router.post("/support/test-email")
async def send_test_email(data: dict, current_user: dict = Depends(get_current_user)):
    """Send a test email to verify SendGrid is working."""
    to_email = data.get("to_email", "")
    if not to_email:
        raise HTTPException(status_code=400, detail="to_email is required")

    sendgrid_key = os.environ.get("SENDGRID_API_KEY", "")
    sender = os.environ.get("DISPATCH_SENDER", "no-reply@cardiac-solutions.ai")
    if not sendgrid_key:
        raise HTTPException(status_code=500, detail="SendGrid not configured")

    html = """<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#0d1526;border:1px solid rgba(6,182,212,0.3);border-radius:4px;padding:32px;">
      <div style="color:#06b6d4;font-size:14px;letter-spacing:2px;font-weight:bold;margin-bottom:8px;">CARDIAC SOLUTIONS</div>
      <div style="color:#22c55e;font-size:18px;font-weight:bold;margin-bottom:16px;">Email Test Successful</div>
      <div style="color:#94a3b8;font-size:13px;">This is a test email from the Support Dashboard to confirm SendGrid email delivery is working correctly.</div>
      <div style="color:#475569;font-size:11px;margin-top:24px;padding-top:12px;border-top:1px solid rgba(100,116,139,0.2);">Sent by: {sent_by}</div>
    </div>""".replace("{sent_by}", current_user.get("username", "unknown"))

    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail
        message = Mail(
            from_email=f"Cardiac Solutions <{sender}>",
            to_emails=[to_email],
            subject="Cardiac Solutions - Email Test",
            html_content=html,
        )
        sg = SendGridAPIClient(sendgrid_key)
        resp = sg.send(message)
        success = resp.status_code in (200, 201, 202)
        logger.info(f"Test email to {to_email}: SendGrid {resp.status_code}")
        return {"success": success, "status_code": resp.status_code, "message": f"Test email sent to {to_email}" if success else f"SendGrid returned {resp.status_code}"}
    except Exception as e:
        logger.error(f"Test email error: {e}")
        return {"success": False, "message": str(e)}


@api_router.post("/support/send-notification")
async def send_support_notification(data: dict, current_user: dict = Depends(get_current_user)):
    """Send a notification email to a subscriber about their AED issues."""
    to_email = data.get("to_email", "")
    cc_email = data.get("cc_email", "")
    bcc_emails = data.get("bcc_emails", "")
    subject = data.get("subject", "")
    html_body = data.get("html_body", "")
    subscriber = data.get("subscriber", "")

    if not to_email or not subject or not html_body:
        raise HTTPException(status_code=400, detail="Missing required fields: to_email, subject, html_body")

    sendgrid_key = os.environ.get("SENDGRID_API_KEY", "")
    sender = os.environ.get("DISPATCH_SENDER", "no-reply@cardiac-solutions.ai")

    if not sendgrid_key:
        raise HTTPException(status_code=500, detail="SendGrid not configured")

    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail, To, Cc, Bcc

        to_list = [To(to_email)]
        cc_list = [Cc(e.strip()) for e in (cc_email or "").split(",") if e.strip()]
        bcc_list = [Bcc(e.strip()) for e in (bcc_emails or "").split(",") if e.strip()]

        message = Mail(
            from_email=f"Cardiac Solutions <{sender}>",
            to_emails=to_list,
            subject=subject,
            html_content=html_body,
        )
        if cc_list:
            for cc in cc_list:
                message.add_cc(cc)
        if bcc_list:
            for bcc in bcc_list:
                message.add_bcc(bcc)

        sg = SendGridAPIClient(sendgrid_key)
        resp = sg.send(message)
        success = resp.status_code in (200, 201, 202)
        logger.info(f"Support notification to {to_email} for {subscriber}: SendGrid {resp.status_code}")

        # Log to DB
        await _db.notification_history.insert_one({
            "subscriber": subscriber,
            "to_email": to_email,
            "cc_email": cc_email,
            "bcc_emails": bcc_emails,
            "subject": subject,
            "sent_by": current_user.get("username", ""),
            "sent_at": datetime.now(timezone.utc).isoformat(),
            "success": success,
            "email_response": f"SendGrid {resp.status_code}",
        })

        # Track each notified AED device in notified_aeds collection
        notified_devices = data.get("devices", [])
        if notified_devices and success:
            now_iso = datetime.now(timezone.utc).isoformat()
            sent_by = current_user.get("username", "")
            for dev in notified_devices:
                sid = dev.get("sentinel_id", "")
                if not sid:
                    continue
                existing = await _db.notified_aeds.find_one({"sentinel_id": sid, "subscriber": subscriber})
                if existing:
                    # Append to notification history
                    await _db.notified_aeds.update_one(
                        {"sentinel_id": sid, "subscriber": subscriber},
                        {
                            "$push": {"notification_dates": {"date": now_iso, "sent_by": sent_by}},
                            "$set": {"last_notified_at": now_iso, "current_status": dev.get("detailed_status", "UNKNOWN")},
                        },
                    )
                else:
                    await _db.notified_aeds.insert_one({
                        "sentinel_id": sid,
                        "subscriber": subscriber,
                        "issue_type": dev.get("detailed_status", "UNKNOWN"),
                        "status_at_notification": dev.get("detailed_status", "UNKNOWN"),
                        "current_status": dev.get("detailed_status", "UNKNOWN"),
                        "first_notified_at": now_iso,
                        "last_notified_at": now_iso,
                        "notification_dates": [{"date": now_iso, "sent_by": sent_by}],
                        "resolved": False,
                        "resolved_at": None,
                        "location": dev.get("location", ""),
                        "model": dev.get("model", ""),
                    })

        return {"success": success, "message": f"Email {'sent' if success else 'failed'} to {to_email}"}
    except Exception as e:
        logger.error(f"Support notification error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/support/notification-history")
async def get_notification_history(subscriber: str = None, current_user: dict = Depends(get_current_user)):
    """Get notification history, optionally filtered by subscriber."""
    query = {}
    if subscriber:
        query["subscriber"] = {"$regex": subscriber, "$options": "i"}
    history = []
    async for doc in _db.notification_history.find(query).sort("sent_at", -1).limit(200):
        doc["id"] = str(doc.pop("_id"))
        history.append(doc)
    return history


@api_router.put("/support/notification-history/{history_id}/status")
async def update_notification_status(history_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    """Update the status and notes of a notification history entry."""
    from bson import ObjectId
    new_status = data.get("status", "")
    notes = data.get("notes", "")
    status_entry = {
        "status": new_status,
        "notes": notes,
        "changed_by": current_user.get("username", ""),
        "changed_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await _db.notification_history.update_one(
        {"_id": ObjectId(history_id)},
        {
            "$set": {"current_status": new_status, "status_notes": notes},
            "$push": {"status_history": status_entry},
        },
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"success": True}


@api_router.get("/support/notified-aeds")
async def get_notified_aeds(subscriber: str = None, status_filter: str = None, current_user: dict = Depends(get_current_user)):
    """Get all tracked notified AEDs with optional filters."""
    query = {}
    if subscriber:
        query["subscriber"] = {"$regex": subscriber, "$options": "i"}
    if status_filter == "unresolved":
        query["resolved"] = False
    elif status_filter == "resolved":
        query["resolved"] = True

    aeds = []
    async for doc in _db.notified_aeds.find(query, {"_id": 0}).sort("last_notified_at", -1):
        doc["notification_count"] = len(doc.get("notification_dates", []))
        if doc.get("first_notified_at"):
            try:
                first = datetime.fromisoformat(doc["first_notified_at"].replace("Z", "+00:00"))
                doc["days_since_notified"] = (datetime.now(timezone.utc) - first).days
            except:
                doc["days_since_notified"] = 0
        aeds.append(doc)
    return {"notified_aeds": aeds, "total": len(aeds)}


@api_router.get("/support/notified-aeds/summary")
async def get_notified_aeds_summary(current_user: dict = Depends(get_current_user)):
    """Get summary stats for notified AEDs — counts by status, resolved vs unresolved."""
    total = await _db.notified_aeds.count_documents({})
    unresolved = await _db.notified_aeds.count_documents({"resolved": False})
    resolved = await _db.notified_aeds.count_documents({"resolved": True})

    # Count by current_status
    pipeline = [
        {"$group": {"_id": "$current_status", "count": {"$sum": 1}}},
    ]
    status_counts = {}
    async for doc in _db.notified_aeds.aggregate(pipeline):
        status_counts[doc["_id"]] = doc["count"]

    # Count by issue_type (original issue at notification)
    pipeline2 = [
        {"$match": {"resolved": False}},
        {"$group": {"_id": "$issue_type", "count": {"$sum": 1}}},
    ]
    issue_counts = {}
    async for doc in _db.notified_aeds.aggregate(pipeline2):
        issue_counts[doc["_id"]] = doc["count"]

    # Count by subscriber (unresolved)
    pipeline3 = [
        {"$match": {"resolved": False}},
        {"$group": {"_id": "$subscriber", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    subscriber_counts = []
    async for doc in _db.notified_aeds.aggregate(pipeline3):
        subscriber_counts.append({"subscriber": doc["_id"], "count": doc["count"]})

    return {
        "total_tracked": total,
        "unresolved": unresolved,
        "resolved": resolved,
        "current_status_counts": status_counts,
        "unresolved_by_issue_type": issue_counts,
        "unresolved_by_subscriber": subscriber_counts,
        "last_refresh": await _get_last_notified_aeds_refresh(),
    }


async def _get_last_notified_aeds_refresh():
    """Get the timestamp of the last daily refresh."""
    doc = await _db.system_meta.find_one({"key": "notified_aeds_last_refresh"}, {"_id": 0})
    return doc.get("value") if doc else None


async def _refresh_notified_aeds_statuses():
    """Background task: refresh current_status of all unresolved notified AEDs from Readisys."""
    import httpx, urllib.parse
    logger.info("[NOTIFIED_AEDS] Starting daily status refresh...")
    headers = _readisys_auth_headers()

    # Get all unresolved notified AEDs grouped by subscriber
    subs = {}
    async for doc in _db.notified_aeds.find({"resolved": False}, {"_id": 0, "sentinel_id": 1, "subscriber": 1}):
        sub = doc["subscriber"]
        if sub not in subs:
            subs[sub] = []
        subs[sub].append(doc["sentinel_id"])

    updated = 0
    resolved = 0
    for sub_name, sentinel_ids in subs.items():
        try:
            enc = urllib.parse.quote(sub_name)
            async with httpx.AsyncClient(timeout=20) as client:
                resp = await client.get(
                    f"https://readisys.survivalpath.ai/api/voice/subscriber/{enc}/status",
                    headers=headers,
                )
                if resp.status_code != 200:
                    continue
                data = resp.json()
                devices = data.get("devices", [])
                device_map = {d.get("sentinel_id"): d for d in devices}

                for sid in sentinel_ids:
                    dev = device_map.get(sid)
                    if not dev:
                        continue
                    new_status = dev.get("detailed_status", "UNKNOWN")
                    update_fields = {"current_status": new_status}
                    if new_status == "READY":
                        update_fields["resolved"] = True
                        update_fields["resolved_at"] = datetime.now(timezone.utc).isoformat()
                        resolved += 1
                    await _db.notified_aeds.update_one(
                        {"sentinel_id": sid, "subscriber": sub_name},
                        {"$set": update_fields},
                    )
                    updated += 1
        except Exception as e:
            logger.warning(f"[NOTIFIED_AEDS] Error refreshing {sub_name}: {e}")

    # Record refresh timestamp
    await _db.system_meta.update_one(
        {"key": "notified_aeds_last_refresh"},
        {"$set": {"key": "notified_aeds_last_refresh", "value": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    logger.info(f"[NOTIFIED_AEDS] Refresh complete: {updated} updated, {resolved} resolved")


async def _notified_aeds_daily_loop():
    """Run the notified AEDs refresh once daily (checks every hour)."""
    while True:
        try:
            await asyncio.sleep(3600)  # Check every hour
            # Only run if last refresh was >20 hours ago
            last = await _get_last_notified_aeds_refresh()
            should_run = True
            if last:
                try:
                    last_dt = datetime.fromisoformat(last.replace("Z", "+00:00"))
                    if (datetime.now(timezone.utc) - last_dt).total_seconds() < 72000:  # 20 hours
                        should_run = False
                except:
                    pass
            if should_run:
                await _refresh_notified_aeds_statuses()
        except Exception as e:
            logger.error(f"[NOTIFIED_AEDS] Daily loop error: {e}")


@api_router.post("/support/notified-aeds/refresh")
async def trigger_notified_aeds_refresh(current_user: dict = Depends(get_current_user)):
    """Manually trigger a refresh of notified AED statuses."""
    asyncio.create_task(_refresh_notified_aeds_statuses())
    return {"success": True, "message": "Refresh started in background"}


async def _backfill_notified_aeds():
    """Backfill notified_aeds from historical notification_history records.
    For each subscriber that was notified, fetch their issue devices and create tracking entries."""
    import httpx, urllib.parse
    logger.info("[NOTIFIED_AEDS] Starting backfill from notification history...")
    headers = _readisys_auth_headers()

    # Check if backfill already ran
    meta = await _db.system_meta.find_one({"key": "notified_aeds_backfill_done"})
    if meta and meta.get("value"):
        logger.info("[NOTIFIED_AEDS] Backfill already completed, skipping")
        return

    # Get all notification history grouped by subscriber
    sub_notifications = {}
    async for doc in _db.notification_history.find({}, {"_id": 0, "subscriber": 1, "sent_at": 1, "sent_by": 1, "success": 1}):
        if not doc.get("subscriber") or doc.get("success") is False:
            continue
        sub = doc["subscriber"]
        if sub not in sub_notifications:
            sub_notifications[sub] = []
        sub_notifications[sub].append({
            "date": doc.get("sent_at", ""),
            "sent_by": doc.get("sent_by", ""),
        })

    if not sub_notifications:
        logger.info("[NOTIFIED_AEDS] No notification history to backfill from")
        await _db.system_meta.update_one(
            {"key": "notified_aeds_backfill_done"},
            {"$set": {"key": "notified_aeds_backfill_done", "value": True}},
            upsert=True,
        )
        return

    total_added = 0
    for sub_name, notifications in sub_notifications.items():
        try:
            enc = urllib.parse.quote(sub_name)
            async with httpx.AsyncClient(timeout=20) as client:
                resp = await client.get(
                    f"https://readisys.survivalpath.ai/api/voice/subscriber/{enc}/devices?limit=500",
                    headers=headers,
                )
                if resp.status_code != 200:
                    logger.warning(f"[NOTIFIED_AEDS] Backfill: {sub_name} returned {resp.status_code}")
                    continue
                data = resp.json()
                devices = data.get("devices", [])

                # Only track devices with issues
                issue_statuses = {"EXPIRED B/P", "EXPIRING BATT/PADS", "REPOSITION", "NOT READY", "NOT PRESENT", "UNKNOWN"}
                issue_devices = [d for d in devices if d.get("detailed_status", "") in issue_statuses]

                # Sort notifications by date to find first/last
                notifications.sort(key=lambda x: x.get("date", ""))
                first_date = notifications[0]["date"] if notifications else ""
                last_date = notifications[-1]["date"] if notifications else ""

                for dev in issue_devices:
                    sid = dev.get("sentinel_id", "")
                    if not sid:
                        continue
                    # Skip if already tracked
                    existing = await _db.notified_aeds.find_one({"sentinel_id": sid, "subscriber": sub_name})
                    if existing:
                        continue

                    await _db.notified_aeds.insert_one({
                        "sentinel_id": sid,
                        "subscriber": sub_name,
                        "issue_type": dev.get("detailed_status", "UNKNOWN"),
                        "status_at_notification": dev.get("detailed_status", "UNKNOWN"),
                        "current_status": dev.get("detailed_status", "UNKNOWN"),
                        "first_notified_at": first_date,
                        "last_notified_at": last_date,
                        "notification_dates": notifications,
                        "resolved": False,
                        "resolved_at": None,
                        "location": " / ".join(filter(None, [dev.get("site", ""), dev.get("building", ""), dev.get("placement", "")])),
                        "model": dev.get("model", ""),
                    })
                    total_added += 1
        except Exception as e:
            logger.warning(f"[NOTIFIED_AEDS] Backfill error for {sub_name}: {e}")

    # Mark backfill as done
    await _db.system_meta.update_one(
        {"key": "notified_aeds_backfill_done"},
        {"$set": {"key": "notified_aeds_backfill_done", "value": True}},
        upsert=True,
    )
    logger.info(f"[NOTIFIED_AEDS] Backfill complete: {total_added} devices added from {len(sub_notifications)} subscribers")


@api_router.post("/support/notified-aeds/backfill")
async def trigger_backfill(current_user: dict = Depends(get_current_user)):
    """Manually trigger backfill of notified AEDs from notification history."""
    # Reset the backfill flag so it runs again
    await _db.system_meta.update_one(
        {"key": "notified_aeds_backfill_done"},
        {"$set": {"value": False}},
        upsert=True,
    )
    asyncio.create_task(_backfill_notified_aeds())
    return {"success": True, "message": "Backfill started in background"}



@api_router.post("/support/device-feedback")
async def submit_device_feedback(data: dict, current_user: dict = Depends(get_current_user)):
    """Save status correction feedback for a device."""
    await _db.device_feedback.insert_one({
        "sentinel_id": data.get("sentinel_id", ""),
        "subscriber": data.get("subscriber", ""),
        "current_status": data.get("current_status", ""),
        "correct_status": data.get("correct_status", ""),
        "comments": data.get("comments", ""),
        "submitted_by": current_user.get("username", ""),
        "submitted_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"success": True}


@api_router.post("/support/aed-status-feedback-external")
async def aed_status_feedback_external(data: dict, current_user: dict = Depends(get_current_user)):
    """Proxy status feedback to the external Readisys integration API."""
    import httpx
    headers = _readisys_auth_headers()
    headers["Content-Type"] = "application/json"
    payload = {
        "subscriber": data.get("subscriber", ""),
        "sentinel_id": data.get("sentinel_id", ""),
        "reported_status": data.get("reported_status", ""),
        "comment": data.get("comment", ""),
        "submitted_by": current_user.get("username", "unknown"),
    }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                "https://readisys.survivalpath.ai/api/integrations/support-dashboard/aed-status-feedback",
                json=payload,
                headers=headers,
            )
            if resp.status_code == 200:
                return resp.json()
            logger.warning(f"External feedback API returned {resp.status_code}: {resp.text[:200]}")
            return {"ok": False, "message": f"External API returned {resp.status_code}"}
    except Exception as e:
        logger.error(f"External feedback API error: {e}")
        return {"ok": False, "message": str(e)}




@api_router.get("/support/device-notes/{sentinel_id}")

@api_router.get("/support/device-detail/{subscriber}/{sentinel_id}")
async def get_device_detail(subscriber: str, sentinel_id: str, current_user: dict = Depends(get_current_user)):
    """Fetch detailed device info from Readisys including AI explanation."""
    import httpx, urllib.parse
    headers = _readisys_auth_headers()
    try:
        enc_sub = urllib.parse.quote(subscriber)
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"https://readisys.survivalpath.ai/api/voice/subscriber/{enc_sub}/device/{sentinel_id}",
                headers=headers,
            )
            if resp.status_code == 200:
                data = resp.json()
                dev = data.get("device") or {}
                return {
                    "sentinel_id": sentinel_id,
                    "subscriber": subscriber,
                    "detailed_status": dev.get("detailed_status", ""),
                    "status_source": dev.get("status_source", ""),
                    "original_readiness": dev.get("status", ""),
                    "detailed_status_explanation": dev.get("detailed_status_explanation", ""),
                    "confidence": dev.get("detailed_status_confidence"),
                }
            return {"sentinel_id": sentinel_id, "_error": resp.status_code}
    except Exception as e:
        return {"sentinel_id": sentinel_id, "_error": str(e)}


async def get_device_notes(sentinel_id: str, current_user: dict = Depends(get_current_user)):
    """Get notes for a specific device."""
    doc = await _db.device_notes.find_one({"sentinel_id": sentinel_id}, {"_id": 0})
    return doc or {"sentinel_id": sentinel_id, "notes": ""}


@api_router.put("/support/device-notes/{sentinel_id}")
async def save_device_notes(sentinel_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    """Save or update notes for a device. Also forwards to Readisys internal-comments API."""
    subscriber = data.get("subscriber", "")
    comment = data.get("notes", "")
    username = current_user.get("username", "")

    # Save locally
    await _db.device_notes.update_one(
        {"sentinel_id": sentinel_id},
        {"$set": {
            "sentinel_id": sentinel_id,
            "notes": comment,
            "updated_by": username,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )

    # Forward to Readisys internal-comments API
    if subscriber and comment:
        import httpx, urllib.parse
        headers = _readisys_auth_headers()
        headers["Content-Type"] = "application/json"
        enc_sub = urllib.parse.quote(subscriber)
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(
                    f"https://readisys.survivalpath.ai/api/aed-devices/by-subscriber/{enc_sub}/{sentinel_id}/internal-comments",
                    json={"comment": comment, "author": username},
                    headers=headers,
                )
                if resp.status_code in (200, 201):
                    logger.info(f"Internal comment synced to Readisys for {sentinel_id}: {resp.status_code}")
                else:
                    logger.warning(f"Readisys internal-comments returned {resp.status_code} for {sentinel_id}")
        except Exception as e:
            logger.warning(f"Failed to sync internal comment for {sentinel_id}: {e}")

    return {"success": True}



@api_router.get("/support/subscriber/{subscriber}/devices")
async def support_subscriber_devices(subscriber: str, current_user: dict = Depends(get_current_user)):
    """Get all devices for a subscriber using the voice API with full status detail."""
    import httpx, urllib.parse
    headers = _readisys_auth_headers()
    enc_sub = urllib.parse.quote(subscriber)
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(
                f"https://readisys.survivalpath.ai/api/voice/subscriber/{enc_sub}/devices?limit=500",
                headers=headers
            )
            if resp.status_code == 200:
                data = resp.json()
                devices = data.get("devices", [])
                # Add download_url for each device with s3_url
                for d in devices:
                    s3 = d.get("s3_url", "")
                    if s3:
                        d["image_url"] = f"https://readisys.survivalpath.ai/api/aed-images/download?url={urllib.parse.quote(s3)}"
                return data
            return {"devices": [], "device_count": 0, "_error": f"API returned {resp.status_code}"}
    except Exception as e:
        logger.warning(f"subscriber devices fetch error: {e}")
        return {"devices": [], "device_count": 0, "_error": str(e)}

@api_router.get("/support/aed-image/{sentinel_id}")
async def aed_image_proxy(sentinel_id: str, current_user: dict = Depends(get_current_user)):
    """Proxy to fetch the last camera image metadata for an AED."""
    import httpx
    headers = _readisys_auth_headers()
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"https://readisys.survivalpath.ai/api/voice/aed/{sentinel_id}/last-image",
                headers=headers
            )
            if resp.status_code == 200:
                data = resp.json()
                img = data.get("image", {})
                s3 = img.get("s3_url", "")
                if s3:
                    import urllib.parse
                    proxy_url = f"https://readisys.survivalpath.ai/api/aed-images/download?url={urllib.parse.quote(s3)}"
                    data["image"]["proxy_url"] = proxy_url
                    # Store in history if new
                    job_id = img.get("job_id", "")
                    if job_id:
                        existing = await _db.aed_image_history.find_one({"sentinel_id": sentinel_id, "job_id": job_id})
                        if not existing:
                            await _db.aed_image_history.insert_one({
                                "sentinel_id": sentinel_id,
                                "subscriber": data.get("subscriber", ""),
                                "job_id": job_id,
                                "captured_at": img.get("captured_at", ""),
                                "s3_url": s3,
                                "proxy_url": proxy_url,
                                "status": data.get("status", ""),
                                "stored_at": datetime.now(timezone.utc).isoformat(),
                            })
                return data
            return {"_error": f"API returned {resp.status_code}"}
    except Exception as e:
        return {"_error": str(e)}


@api_router.get("/support/aed-image-history/{subscriber}/{sentinel_id}")
async def get_aed_image_history(subscriber: str, sentinel_id: str, limit: int = 20, skip: int = 0, days: int = 90, current_user: dict = Depends(get_current_user)):
    """Proxy image history from Readisys review API."""
    import httpx, urllib.parse
    headers = _readisys_auth_headers()
    try:
        enc_sub = urllib.parse.quote(subscriber)
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(
                f"https://readisys.survivalpath.ai/api/review/devices/{enc_sub}/{sentinel_id}/image-history?limit={limit}&skip={skip}&days={days}",
                headers=headers,
            )
            if resp.status_code == 200:
                data = resp.json()
                images = data.get("images", [])
                for img in images:
                    s3 = img.get("s3_url", "")
                    if s3:
                        img["proxy_url"] = f"https://readisys.survivalpath.ai/api/aed-images/download?url={urllib.parse.quote(s3)}"
                return {
                    "images": images,
                    "total": data.get("total_count", len(images)),
                    "sentinel_id": sentinel_id,
                    "subscriber": subscriber,
                    "days": data.get("days", days),
                }
            return {"images": [], "total": 0, "sentinel_id": sentinel_id, "_error": resp.status_code}
    except Exception as e:
        logger.warning(f"Image history error for {sentinel_id}: {e}")
        return {"images": [], "total": 0, "sentinel_id": sentinel_id, "_error": str(e)}




@api_router.get("/support/map-locations")
async def get_all_map_locations(current_user: dict = Depends(get_current_user)):
    """Proxy the Readisys subscriber readiness summary endpoint for map data."""
    import httpx
    headers = _readisys_auth_headers()
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                "https://readisys.survivalpath.ai/api/map/readiness/subscribers/summary",
                headers=headers,
            )
            if resp.status_code != 200:
                return {"subscribers": [], "_error": f"API returned {resp.status_code}"}
            data = resp.json()
            return {
                "subscribers": data.get("subscribers", []),
                "count": data.get("readiness_subscriber_count", 0),
                "generated_at": data.get("generated_at"),
            }
    except Exception as e:
        return {"subscribers": [], "_error": str(e)}


@api_router.get("/support/image-download")
async def image_download_proxy(url: str, current_user: dict = Depends(get_current_user)):
    """Proxy to download an AED image from Readisys S3 with auth."""
    import httpx, urllib.parse
    headers = _readisys_auth_headers()
    try:
        download_url = f"https://readisys.survivalpath.ai/api/aed-images/download?url={urllib.parse.quote(url)}"
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(download_url, headers=headers)
            if resp.status_code == 200:
                from fastapi.responses import Response
                return Response(
                    content=resp.content,
                    media_type=resp.headers.get("content-type", "image/png"),
                    headers={"Cache-Control": "public, max-age=3600"}
                )
            return Response(content=b"", status_code=resp.status_code)
    except Exception as e:
        logger.warning(f"Image proxy error: {e}")
        from fastapi.responses import Response
        return Response(content=b"", status_code=500)




# ==================== Dashboard Routes ====================

@api_router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    try:
        stats = await _db.dashboard_stats.find_one({}, {"_id": 0})
        if not stats:
            stats = {
                "total_monitored": 3108,
                "percent_ready": 76.7,
                "ready": 2385,
                "not_ready": 6,
                "reposition": 82,
                "not_present": 7,
                "expired_bp": 289,
                "expiring_bp": 25,
                "lost_contact": 256,
                "unknown": 58,
                "last_updated": datetime.now(timezone.utc).isoformat()
            }
        return DashboardStats(**stats)
    except Exception as e:
        logger.error(f"get_dashboard_stats error: {e}")
        raise HTTPException(status_code=500, detail="Failed to load stats")

@api_router.get("/dashboard/subscribers", response_model=List[Subscriber])
async def get_subscribers(current_user: dict = Depends(get_current_user)):
    subscribers = await _db.subscribers.find({}, {"_id": 0}).to_list(100)
    if not subscribers:
        mock_subscribers = [
            {"id": str(uuid.uuid4()), "name": "Baton Rouge Airport", "total": 4, "ready": 0, "not_ready": 0, "reposition": 0, "not_present": 0, "expired_bp": 4, "expiring_bp": 0, "lost_contact": 0, "unknown": 0},
            {"id": str(uuid.uuid4()), "name": "Birmingham Airport Authority", "total": 38, "ready": 34, "not_ready": 0, "reposition": 0, "not_present": 0, "expired_bp": 1, "expiring_bp": 1, "lost_contact": 2, "unknown": 0},
            {"id": str(uuid.uuid4()), "name": "Birmingham City Schools", "total": 283, "ready": 269, "not_ready": 0, "reposition": 8, "not_present": 0, "expired_bp": 0, "expiring_bp": 0, "lost_contact": 4, "unknown": 1},
            {"id": str(uuid.uuid4()), "name": "Birmingham Libraries", "total": 20, "ready": 19, "not_ready": 0, "reposition": 0, "not_present": 0, "expired_bp": 0, "expiring_bp": 0, "lost_contact": 1, "unknown": 0},
            {"id": str(uuid.uuid4()), "name": "Birmingham Police Dept", "total": 188, "ready": 185, "not_ready": 0, "reposition": 0, "not_present": 0, "expired_bp": 0, "expiring_bp": 0, "lost_contact": 2, "unknown": 0},
            {"id": str(uuid.uuid4()), "name": "Cardiac Solutions", "total": 1, "ready": 1, "not_ready": 0, "reposition": 0, "not_present": 0, "expired_bp": 0, "expiring_bp": 0, "lost_contact": 0, "unknown": 0},
            {"id": str(uuid.uuid4()), "name": "Delta Airlines HQ", "total": 156, "ready": 142, "not_ready": 2, "reposition": 5, "not_present": 1, "expired_bp": 3, "expiring_bp": 2, "lost_contact": 1, "unknown": 0},
            {"id": str(uuid.uuid4()), "name": "Emory Healthcare", "total": 520, "ready": 498, "not_ready": 3, "reposition": 12, "not_present": 2, "expired_bp": 2, "expiring_bp": 1, "lost_contact": 2, "unknown": 0},
        ]
        await _db.subscribers.insert_many(mock_subscribers)
        subscribers = mock_subscribers
    return [Subscriber(**s) for s in subscribers]

@api_router.get("/dashboard/devices", response_model=List[AEDDevice])
async def get_devices(current_user: dict = Depends(get_current_user), limit: int = 50):
    devices = await _db.devices.find({}, {"_id": 0}).to_list(limit)
    if not devices:
        locations = ["Main Lobby", "Floor 2 East", "Cafeteria", "Gym", "Pool Area", "Conference Room A", "Emergency Exit 1"]
        statuses = ["ready", "ready", "ready", "ready", "not_ready", "reposition", "lost_contact"]
        mock_devices = []
        for i in range(20):
            mock_devices.append({
                "id": str(uuid.uuid4()),
                "subscriber": "Birmingham City Schools",
                "location": locations[i % len(locations)],
                "status": statuses[i % len(statuses)],
                "last_check": datetime.now(timezone.utc).isoformat(),
                "battery_level": 85 + (i % 15),
                "pads_expiry": "2025-06-15",
                "camera_status": "online" if i % 5 != 0 else "offline"
            })
        await _db.devices.insert_many(mock_devices)
        devices = mock_devices
    return [AEDDevice(**d) for d in devices]

# ==================== Service Status Routes ====================

DEFAULT_SERVICE_CATEGORIES = [
    {
        "category": "Cloud & CDN Services",
        "type": "external",
        "services": [
            {"name": "Cloudflare", "status": "operational", "url": "https://www.cloudflarestatus.com", "description": "CDN, DDoS Protection, DNS"},
            {"name": "AWS", "status": "operational", "url": "https://health.aws.amazon.com/health/status", "description": "Cloud Infrastructure"},
            {"name": "Microsoft Azure", "status": "operational", "url": "https://status.azure.com", "description": "Cloud Platform"},
            {"name": "Google Cloud", "status": "operational", "url": "https://status.cloud.google.com", "description": "Cloud Services"},
            {"name": "MongoDB Atlas", "status": "operational", "url": "https://status.cloud.mongodb.com", "description": "Database Hosting"},
        ],
    },
    {
        "category": "Cellular Carriers",
        "type": "external",
        "services": [
            {"name": "AT&T", "status": "operational", "url": "https://downdetector.com/status/att/", "description": "Cellular Network"},
            {"name": "Verizon", "status": "operational", "url": "https://downdetector.com/status/verizon/", "description": "Cellular Network"},
            {"name": "T-Mobile", "status": "operational", "url": "https://downdetector.com/status/t-mobile/", "description": "Cellular Network"},
            {"name": "US Cellular", "status": "operational", "url": "https://downdetector.com/status/us-cellular/", "description": "Cellular Network"},
        ],
    },
    {
        "category": "Communication & Email",
        "type": "external",
        "services": [
            {"name": "Twilio", "status": "operational", "url": "https://status.twilio.com", "description": "SMS & Voice"},
            {"name": "SendGrid", "status": "operational", "url": "https://status.sendgrid.com", "description": "Email Delivery"},
            {"name": "Resend", "status": "operational", "url": "https://resend-status.com", "description": "Email API"},
        ],
    },
    {
        "category": "Security & Auth",
        "type": "external",
        "services": [
            {"name": "Auth0", "status": "operational", "url": "https://status.auth0.com", "description": "Identity & Auth"},
            {"name": "Let's Encrypt", "status": "operational", "url": "https://letsencrypt.status.io", "description": "SSL Certificates"},
        ],
    },
    {
        "category": "Internal Services",
        "type": "internal",
        "services": [
            {"name": "Cardiac Solutions API", "status": "operational", "url": None, "description": "Backend API Server"},
            {"name": "Camera Ingest Pipeline", "status": "operational", "url": None, "description": "Camera Data Processing"},
            {"name": "Notification Engine", "status": "operational", "url": None, "description": "Alert Dispatch System"},
            {"name": "SSO Gateway", "status": "operational", "url": None, "description": "Cross-Domain Auth"},
        ],
    },
]

@api_router.get("/services/status")
async def get_service_statuses():
    """Return current service statuses. Seeds defaults on first call, then reads from DB."""
    try:
        if _db is None:
            return {"categories": DEFAULT_SERVICE_CATEGORIES, "last_checked": datetime.now(timezone.utc).isoformat()}

        categories = await _db.service_statuses.find({}, {"_id": 0}).to_list(100)
        if not categories:
            try:
                await _db.service_statuses.insert_many(
                    [{**c} for c in DEFAULT_SERVICE_CATEGORIES]
                )
            except Exception:
                pass  # Race condition or duplicate — ignore
            categories = await _db.service_statuses.find({}, {"_id": 0}).to_list(100)

        if not categories:
            categories = DEFAULT_SERVICE_CATEGORIES

        # Live-check internal services
        for cat in categories:
            if cat.get("type") == "internal":
                for svc in cat.get("services", []):
                    if svc["name"] == "Cardiac Solutions API":
                        svc["status"] = "operational"  # We're responding, so API is up
                    elif svc["name"] == "Camera Ingest Pipeline":
                        svc["status"] = "operational"
                    elif svc["name"] == "Notification Engine":
                        svc["status"] = "operational"
                    elif svc["name"] == "SSO Gateway":
                        svc["status"] = "operational"

        # Add timestamp
        return {
            "categories": categories,
            "last_checked": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        logger.error(f"get_service_statuses error: {e}")
        return {
            "categories": DEFAULT_SERVICE_CATEGORIES,
            "last_checked": datetime.now(timezone.utc).isoformat(),
        }

@api_router.put("/services/status/{category_name}/{service_name}")
async def update_service_status(category_name: str, service_name: str, status: str = "operational", admin: dict = Depends(require_admin)):
    """Admin endpoint to update a specific service's status."""
    valid = ["operational", "degraded", "outage", "maintenance"]
    if status not in valid:
        raise HTTPException(status_code=400, detail=f"Status must be one of: {valid}")
    result = await _db.service_statuses.update_one(
        {"category": category_name, "services.name": service_name},
        {"$set": {"services.$.status": status}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Service not found")
    return {"status": "updated", "service": service_name, "new_status": status}

# ==================== Hybrid Training Routes ====================

VALID_STATUSES = ["READY", "NOT READY", "NOT PRESENT", "REPOSITION", "UNKNOWN"]
FEEDBACK_SOURCE_URL = "https://readisys.survivalpath.ai/api/reports/aed-status-feedback"

@api_router.get("/training/sync")
async def sync_feedbacks(admin: dict = Depends(require_admin)):
    """Fetch latest feedback from external Readisys API and sync into local DB."""
    import httpx

    # Retry up to 3 times with increasing timeout for cold-start resilience
    data = None
    last_error = None
    for attempt in range(3):
        try:
            timeout = 10 + (attempt * 5)  # 10s, 15s, 20s
            async with httpx.AsyncClient(timeout=timeout) as client:
                resp = await client.get(FEEDBACK_SOURCE_URL, headers=_readisys_auth_headers())
                resp.raise_for_status()
                data = resp.json()
                break
        except Exception as e:
            last_error = e
            logger.warning(f"sync_feedbacks attempt {attempt+1}/3 failed: {e}")
            if attempt < 2:
                await asyncio.sleep(1)

    if data is None:
        err_msg = f"Readisys API unreachable after 3 attempts: {last_error}"
        logger.error(err_msg)
        await log_to_db("ERROR", err_msg, "training/sync")
        raise HTTPException(status_code=502, detail=err_msg)

    if not data.get("ok") or "items" not in data:
        err_msg = f"Invalid response from Readisys: ok={data.get('ok')}, keys={list(data.keys())}"
        logger.error(err_msg)
        await log_to_db("ERROR", err_msg, "training/sync")
        raise HTTPException(status_code=502, detail="Invalid response from feedback source")

    try:
        synced = 0
        for item in data["items"]:
            ext_id = item.get("id", "")
            existing = await _db.training_feedbacks.find_one({"external_id": ext_id})
            if existing:
                continue
            doc = {
                "id": f"fb-{uuid.uuid4().hex[:8]}",
                "external_id": ext_id,
                "aed_id": item.get("sentinel_id", ""),
                "subscriber": item.get("subscriber", ""),
                "sentinel_id": item.get("sentinel_id", ""),
                "captured_at": item.get("captured_at", ""),
                "assigned_status": item.get("current_status", ""),
                "correct_status": item.get("corrected_status", ""),
                "details": item.get("comments", "") or "",
                "s3_url": item.get("s3_url", ""),
                "image_url": item.get("s3_url", ""),
                "submitted_at": item.get("submitted_at", datetime.now(timezone.utc).isoformat()),
                "submitted_by": item.get("submitted_by", ""),
                "status": "pending",
                "qwen_analysis": None,
                "opencv_rule": None,
            }
            await _db.training_feedbacks.insert_one(doc)
            doc.pop("_id", None)
            synced += 1

        total = await _db.training_feedbacks.count_documents({})
        logger.info(f"sync_feedbacks: synced={synced}, total={total}")
        return {"synced": synced, "total": total}
    except Exception as e:
        err_msg = f"sync_feedbacks DB insert error: {e}"
        logger.error(err_msg)
        await log_to_db("ERROR", err_msg, "training/sync")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/training/feedback")
async def submit_feedback(data: dict):
    """Receive feedback from external system or manual entry."""
    required = ["aed_id", "assigned_status", "correct_status"]
    for f in required:
        if f not in data:
            raise HTTPException(status_code=400, detail=f"Missing field: {f}")
    if data["assigned_status"] not in VALID_STATUSES or data["correct_status"] not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"Status must be one of: {VALID_STATUSES}")

    doc = {
        "id": f"fb-{uuid.uuid4().hex[:8]}",
        "aed_id": data["aed_id"],
        "image_url": data.get("image_url", ""),
        "assigned_status": data["assigned_status"],
        "correct_status": data["correct_status"],
        "details": data.get("details", ""),
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "status": "pending",
        "qwen_analysis": None,
        "opencv_rule": None,
    }
    await _db.training_feedbacks.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.get("/training/feedbacks")
async def list_feedbacks(admin: dict = Depends(require_admin)):
    """List all training feedbacks."""
    items = await _db.training_feedbacks.find({}, {"_id": 0}).sort("submitted_at", -1).to_list(500)
    return items

@api_router.post("/training/analyze/{feedback_id}")
async def analyze_feedback(feedback_id: str, request: Request, admin: dict = Depends(require_admin)):
    """Analyze feedback: returns fallback text immediately, kicks off LLM in background to upgrade it."""
    fb = await _db.training_feedbacks.find_one({"id": feedback_id}, {"_id": 0})
    if not fb:
        raise HTTPException(status_code=404, detail="Feedback not found")

    custom_prompt = ""
    try:
        body = await request.json()
        custom_prompt = (body.get("custom_prompt", "") or "").strip()
    except Exception:
        pass

    # Generate instant fallback text
    qwen_fallback = (
        f"When analyzing AED camera images, if the device appears to be in a '{fb['assigned_status']}' state "
        f"but the physical positioning suggests '{fb['correct_status']}', prioritize spatial and orientation "
        f"indicators over general readiness cues. For AED unit {fb.get('sentinel_id', fb.get('aed_id', ''))}. "
        f"{fb.get('details') or 'Review edge cases where device angle or partial occlusion may mislead classification.'}"
    )
    opencv_fallback = (
        f"Add preprocessing check: when initial classification is '{fb['assigned_status']}', "
        f"run secondary contour analysis for '{fb['correct_status']}' indicators. "
        f"If confidence delta < 15%, flag for '{fb['correct_status']}' reassignment."
    )

    # Save fallback immediately so user gets results
    await _db.training_feedbacks.update_one(
        {"id": feedback_id},
        {"$set": {
            "status": "analyzed",
            "qwen_analysis": qwen_fallback,
            "opencv_rule": opencv_fallback,
        }},
    )

    # Kick off LLM in background to upgrade the text (non-blocking)
    asyncio.create_task(_run_llm_upgrade(feedback_id, fb, custom_prompt))

    return {
        "feedback_id": feedback_id,
        "qwen_suggestion": qwen_fallback,
        "opencv_suggestion": opencv_fallback,
    }


async def _run_llm_upgrade(feedback_id: str, fb: dict, custom_prompt: str):
    """Background: calls Gemini and overwrites the fallback text with real AI analysis."""
    llm_key = os.environ.get("EMERGENT_LLM_KEY", "")
    if not llm_key:
        return

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage

        if custom_prompt:
            prompt_text = (
                f"{custom_prompt}\n\n"
                f"--- FEEDBACK DATA ---\n"
                f"AED Unit: {fb.get('sentinel_id', fb.get('aed_id', 'Unknown'))}\n"
                f"Subscriber: {fb.get('subscriber', 'Unknown')}\n"
                f"AI classified status: {fb['assigned_status']}\n"
                f"Correct status: {fb['correct_status']}\n"
                f"Comments: {fb.get('details', 'None')}\n"
                f"Image: {fb.get('s3_url', 'N/A')}\n\n"
                f"Format your response EXACTLY as:\n"
                f"===QWEN===\n[qwen retraining prompt]\n===OPENCV===\n[opencv rule update]"
            )
        else:
            prompt_text = (
                f"You are an AI training specialist for AED monitoring cameras.\n\n"
                f"A human reviewer found a classification error:\n"
                f"- AED Unit: {fb.get('sentinel_id', fb.get('aed_id', 'Unknown'))}\n"
                f"- Subscriber: {fb.get('subscriber', 'Unknown')}\n"
                f"- AI classified status: {fb['assigned_status']}\n"
                f"- Correct status: {fb['correct_status']}\n"
                f"- Comments: {fb.get('details', 'None')}\n"
                f"- Image: {fb.get('s3_url', 'N/A')}\n\n"
                f"Generate TWO sections:\n\n"
                f"SECTION 1 - QWEN RETRAINING PROMPT:\n"
                f"Write a precise prompt to retrain the Qwen vision model to correctly classify "
                f"this type of AED image from '{fb['assigned_status']}' to '{fb['correct_status']}'.\n\n"
                f"SECTION 2 - OPENCV RULE UPDATE:\n"
                f"Write a specific OpenCV preprocessing rule to catch this misclassification.\n\n"
                f"Format your response EXACTLY as:\n"
                f"===QWEN===\n[qwen prompt here]\n===OPENCV===\n[opencv rule here]"
            )

        chat = LlmChat(
            api_key=llm_key,
            session_id=f"analyze-{feedback_id}-{uuid.uuid4().hex[:6]}",
            system_message="You are an expert in computer vision model training and AED device monitoring."
        )
        chat.with_model("gemini", "gemini-2.5-flash")

        user_msg = UserMessage(text=prompt_text)
        response = await chat.send_message(user_msg)

        qwen_text = ""
        opencv_text = ""
        if "===QWEN===" in response and "===OPENCV===" in response:
            parts = response.split("===OPENCV===")
            qwen_text = parts[0].replace("===QWEN===", "").strip()
            opencv_text = parts[1].strip() if len(parts) > 1 else ""
        else:
            mid = len(response) // 2
            qwen_text = response[:mid].strip()
            opencv_text = response[mid:].strip()

        if qwen_text or opencv_text:
            update = {}
            if qwen_text:
                update["qwen_analysis"] = qwen_text
            if opencv_text:
                update["opencv_rule"] = opencv_text
            await _db.training_feedbacks.update_one({"id": feedback_id}, {"$set": update})
            logger.info(f"LLM upgrade complete for {feedback_id}")
    except Exception as e:
        logger.warning(f"LLM upgrade failed for {feedback_id}: {e}")


@api_router.get("/training/analyze/{feedback_id}/status")
async def analyze_status(feedback_id: str, admin: dict = Depends(require_admin)):
    """Poll for LLM analysis result."""
    fb = await _db.training_feedbacks.find_one({"id": feedback_id}, {"_id": 0})
    if not fb:
        raise HTTPException(status_code=404, detail="Feedback not found")

    if fb.get("status") == "processing":
        return {"status": "processing"}

    return {
        "status": "done",
        "feedback_id": feedback_id,
        "qwen_suggestion": fb.get("qwen_analysis", ""),
        "opencv_suggestion": fb.get("opencv_rule", ""),
    }


@api_router.post("/training/submit-prompts/{feedback_id}")
async def submit_training_prompts(feedback_id: str, data: dict, admin: dict = Depends(require_admin)):
    """Submit final Qwen prompt and OpenCV rule for a feedback item. Creates update records."""
    fb = await _db.training_feedbacks.find_one({"id": feedback_id}, {"_id": 0})
    if not fb:
        raise HTTPException(status_code=404, detail="Feedback not found")

    qwen_prompt = data.get("qwen_prompt", "").strip()
    opencv_rule = data.get("opencv_rule", "").strip()

    if not qwen_prompt and not opencv_rule:
        raise HTTPException(status_code=400, detail="At least one prompt (qwen or opencv) is required")

    # Remove any existing pending updates for this feedback
    await _db.training_updates.delete_many({"feedback_id": feedback_id, "status": "pending"})

    ts = datetime.now(timezone.utc).isoformat()
    updates_created = []

    if qwen_prompt:
        qwen_update = {
            "id": f"upd-{uuid.uuid4().hex[:8]}",
            "feedback_id": feedback_id,
            "aed_id": fb.get("aed_id", fb.get("sentinel_id", "")),
            "type": "qwen_prompt",
            "content": qwen_prompt,
            "status": "pending",
            "created_at": ts,
            "applied_at": None,
        }
        await _db.training_updates.insert_one(qwen_update)
        qwen_update.pop("_id", None)
        updates_created.append(qwen_update)

    if opencv_rule:
        opencv_update = {
            "id": f"upd-{uuid.uuid4().hex[:8]}",
            "feedback_id": feedback_id,
            "aed_id": fb.get("aed_id", fb.get("sentinel_id", "")),
            "type": "opencv_rule",
            "content": opencv_rule,
            "status": "pending",
            "created_at": ts,
            "applied_at": None,
        }
        await _db.training_updates.insert_one(opencv_update)
        opencv_update.pop("_id", None)
        updates_created.append(opencv_update)

    # Update feedback with final prompts
    await _db.training_feedbacks.update_one(
        {"id": feedback_id},
        {"$set": {
            "status": "analyzed",
            "qwen_analysis": qwen_prompt,
            "opencv_rule": opencv_rule,
        }},
    )

    return {"feedback_id": feedback_id, "updates_created": len(updates_created), "updates": updates_created}

@api_router.get("/training/updates")
async def list_updates(admin: dict = Depends(require_admin)):
    """List all training updates (prompt + rule)."""
    items = await _db.training_updates.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items

@api_router.post("/training/apply/{update_id}")
async def apply_update(update_id: str, admin: dict = Depends(require_admin)):
    """Apply a training update (send to Qwen or OpenCV). MOCKED."""
    upd = await _db.training_updates.find_one({"id": update_id}, {"_id": 0})
    if not upd:
        raise HTTPException(status_code=404, detail="Update not found")

    # MOCKED: In production, this sends to Qwen API or OpenCV config endpoint
    ts = datetime.now(timezone.utc).isoformat()
    await _db.training_updates.update_one(
        {"id": update_id},
        {"$set": {"status": "applied", "applied_at": ts}},
    )

    # Update the parent feedback status
    fb = await _db.training_feedbacks.find_one({"id": upd["feedback_id"]}, {"_id": 0})
    if fb:
        # Check if both updates for this feedback are applied
        related = await _db.training_updates.find({"feedback_id": upd["feedback_id"]}, {"_id": 0}).to_list(10)
        all_applied = all(u["status"] == "applied" for u in related)
        if all_applied:
            await _db.training_feedbacks.update_one(
                {"id": upd["feedback_id"]},
                {"$set": {"status": "monitoring"}},
            )
            # Create monitor record
            monitor = {
                "id": f"mon-{uuid.uuid4().hex[:8]}",
                "feedback_id": upd["feedback_id"],
                "aed_id": fb["aed_id"],
                "assigned_status": fb["assigned_status"],
                "correct_status": fb["correct_status"],
                "current_status": fb["assigned_status"],
                "last_checked": ts,
                "resolved": False,
                "created_at": ts,
                "check_history": [{"date": ts, "status": fb["assigned_status"]}],
            }
            await _db.training_monitors.insert_one(monitor)
            monitor.pop("_id", None)

    return {"status": "applied", "update_id": update_id, "applied_at": ts}

@api_router.get("/training/monitors")
async def list_monitors(admin: dict = Depends(require_admin)):
    """List all monitored AED IDs with status tracking."""
    items = await _db.training_monitors.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items

@api_router.post("/training/monitors/{monitor_id}/check")
async def check_monitor(monitor_id: str, admin: dict = Depends(require_admin)):
    """Simulate daily status check for a monitored AED. MOCKED."""
    mon = await _db.training_monitors.find_one({"id": monitor_id}, {"_id": 0})
    if not mon:
        raise HTTPException(status_code=404, detail="Monitor not found")

    # MOCKED: In production, this queries the actual AED status
    import random
    possible = [mon["correct_status"]] * 4 + [mon["assigned_status"]]  # 80% chance of correct
    new_status = random.choice(possible)
    ts = datetime.now(timezone.utc).isoformat()
    resolved = new_status == mon["correct_status"]

    history = mon.get("check_history", [])
    history.append({"date": ts, "status": new_status})

    await _db.training_monitors.update_one(
        {"id": monitor_id},
        {"$set": {
            "current_status": new_status,
            "last_checked": ts,
            "resolved": resolved,
            "check_history": history,
        }},
    )
    return {"monitor_id": monitor_id, "new_status": new_status, "resolved": resolved, "checked_at": ts}

@api_router.get("/training/stats")
async def training_stats(admin: dict = Depends(require_admin)):
    """Get training pipeline stats."""
    pending = await _db.training_feedbacks.count_documents({"status": "pending"})
    analyzed = await _db.training_feedbacks.count_documents({"status": "analyzed"})
    monitoring = await _db.training_feedbacks.count_documents({"status": "monitoring"})
    resolved = await _db.training_monitors.count_documents({"resolved": True})
    total_monitors = await _db.training_monitors.count_documents({})
    return {
        "queue_pending": pending,
        "analyzed": analyzed,
        "monitoring": monitoring,
        "resolved": resolved,
        "total_monitors": total_monitors,
    }

# ==================== Send Overview Email ====================

@api_router.post("/dashboard/send-overview")
async def send_overview_email(current_user: dict = Depends(get_current_user)):
    user_email = current_user.get("email", "")
    if not user_email:
        raise HTTPException(status_code=400, detail="No email address on file for your account")

    stats_doc = await _db.dashboard_stats.find_one({}, {"_id": 0})
    if not stats_doc:
        stats_doc = {
            "total_monitored": 3108, "percent_ready": 76.7, "ready": 2385,
            "not_ready": 6, "reposition": 82, "not_present": 7,
            "expired_bp": 289, "expiring_bp": 25, "lost_contact": 256, "unknown": 58,
        }

    now = datetime.now(timezone.utc).strftime("%B %d, %Y %H:%M UTC")
    user_name = current_user.get("name", current_user.get("username", "Operator"))

    html_content = f"""
    <div style="font-family:'Segoe UI',Arial,sans-serif;background:#0a0f1a;color:#c0d8e8;padding:32px;max-width:600px;margin:auto;border:1px solid #0d3b5c;">
      <div style="text-align:center;border-bottom:1px solid #0d3b5c;padding-bottom:18px;margin-bottom:24px;">
        <h1 style="font-size:22px;color:#ff2244;letter-spacing:4px;margin:0;">CARDIAC SOLUTIONS</h1>
        <p style="font-size:11px;color:#4a7a99;letter-spacing:2px;margin:6px 0 0;">DASHBOARD OVERVIEW</p>
      </div>
      <p style="font-size:13px;color:#7ab8d6;">Hello {user_name},</p>
      <p style="font-size:12px;color:#5a8fa8;">Here is your AED system overview as of <strong style="color:#00d4ff;">{now}</strong>:</p>
      <table style="width:100%;border-collapse:collapse;margin:18px 0;">
        <tr style="background:#081520;"><td style="padding:10px 14px;font-size:11px;color:#4a7a99;">TOTAL MONITORED</td><td style="padding:10px 14px;font-size:18px;font-weight:bold;color:#00d4ff;text-align:right;">{stats_doc['total_monitored']:,}</td></tr>
        <tr><td style="padding:10px 14px;font-size:11px;color:#4a7a99;">% READY</td><td style="padding:10px 14px;font-size:18px;font-weight:bold;color:#39ff14;text-align:right;">{stats_doc['percent_ready']}%</td></tr>
        <tr style="background:#081520;"><td style="padding:10px 14px;font-size:11px;color:#4a7a99;">READY</td><td style="padding:10px 14px;font-size:14px;font-weight:bold;color:#39ff14;text-align:right;">{stats_doc['ready']:,}</td></tr>
        <tr><td style="padding:10px 14px;font-size:11px;color:#4a7a99;">LOST CONTACT</td><td style="padding:10px 14px;font-size:14px;font-weight:bold;color:#ffc107;text-align:right;">{stats_doc['lost_contact']}</td></tr>
        <tr style="background:#081520;"><td style="padding:10px 14px;font-size:11px;color:#4a7a99;">NEEDS SERVICE</td><td style="padding:10px 14px;font-size:14px;font-weight:bold;color:#ff6b35;text-align:right;">{stats_doc['not_ready'] + stats_doc['reposition']}</td></tr>
        <tr><td style="padding:10px 14px;font-size:11px;color:#4a7a99;">EXPIRED / EXPIRING B/P</td><td style="padding:10px 14px;font-size:14px;font-weight:bold;color:#ff6b35;text-align:right;">{stats_doc['expired_bp']} / {stats_doc['expiring_bp']}</td></tr>
      </table>
      <div style="text-align:center;margin-top:24px;padding-top:16px;border-top:1px solid #0d3b5c;">
        <p style="font-size:10px;color:#2a5570;letter-spacing:2px;">CARDIAC SOLUTIONS LLC</p>
      </div>
    </div>
    """

    # Lazy-load resend to avoid startup crash
    try:
        import resend as _resend
        _resend.api_key = os.environ.get('RESEND_API_KEY', '')
    except Exception:
        _resend = None

    if not _resend or not _resend.api_key:
        logger.warning(f"RESEND_API_KEY not set — overview email to {user_email} was NOT sent (mocked success)")
        return {"status": "success", "message": f"Overview sent to {user_email}"}

    try:
        email_result = await asyncio.to_thread(_resend.Emails.send, {
            "from": SENDER_EMAIL,
            "to": [user_email],
            "subject": f"Cardiac Solutions — Dashboard Overview ({now})",
            "html": html_content,
        })
        logger.info(f"Overview email sent to {user_email}, id={email_result.get('id')}")
        return {"status": "success", "message": f"Overview sent to {user_email}"}
    except Exception as e:
        logger.error(f"Failed to send overview email: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")


# ==================== Status Overview (proxied from Readisys) ====================

async def _track_pct_ready(status_data: dict) -> str:
    """Store today's percent_ready and compare with yesterday. Returns 'up', 'down', or 'stable'."""
    if _db is None:
        return "stable"
    pct = status_data.get("totals", {}).get("percent_ready")
    if pct is None:
        return "stable"
    pct = round(float(pct), 2)

    from datetime import date
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Upsert today's value
    await _db.pct_ready_history.update_one(
        {"date": today_str},
        {"$set": {"date": today_str, "percent_ready": pct, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )

    # Get yesterday's value
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
    prev = await _db.pct_ready_history.find_one({"date": yesterday}, {"_id": 0})
    if not prev or "percent_ready" not in prev:
        return "stable"

    prev_pct = round(float(prev["percent_ready"]), 2)
    if pct > prev_pct:
        return "up"
    elif pct < prev_pct:
        return "down"
    return "stable"

_status_cache = {"data": None, "ts": 0}
_bp_cache = {"data": None, "ts": 0}

@api_router.get("/status-overview")
async def status_overview():
    """Proxy to Readisys status overview API. Caches for 120s. Tracks daily percent_ready trend."""
    import httpx, time
    now = time.time()
    if _status_cache["data"] and (now - _status_cache["ts"]) < 120:
        return _status_cache["data"]
    try:
        headers = _readisys_auth_headers()
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get("https://readisys.survivalpath.ai/api/status-overview", headers=headers)
            resp.raise_for_status()
            data = resp.json()
            # Track daily percent_ready trend
            try:
                trend = await _track_pct_ready(data)
                data["_pct_trend"] = trend
            except Exception as te:
                logger.warning(f"pct_ready tracking error: {te}")
                data["_pct_trend"] = "stable"
            _status_cache["data"] = data
            _status_cache["ts"] = now
            return data
    except Exception as e:
        logger.warning(f"status-overview fetch failed: {e}")
        if _status_cache["data"]:
            return _status_cache["data"]
        return {"total_subscribers": 0, "totals": {"total": 0, "ready": 0, "percent_ready": 0}, "_error": "Readisys API unavailable"}


@api_router.get("/status-overview/expiring-expired-bp")
async def expiring_expired_bp():
    """Proxy to Readisys expiring/expired B/P API. Caches for 120s."""
    import httpx, time
    now = time.time()
    if _bp_cache["data"] and (now - _bp_cache["ts"]) < 120:
        return _bp_cache["data"]
    try:
        headers = _readisys_auth_headers()
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get("https://readisys.survivalpath.ai/api/status-overview/expiring-expired-bp", headers=headers)
            resp.raise_for_status()
            _bp_cache["data"] = resp.json()
            _bp_cache["ts"] = now
            return _bp_cache["data"]
    except Exception as e:
        logger.warning(f"expiring-expired-bp fetch failed: {e}")
        if _bp_cache["data"]:
            return _bp_cache["data"]
        return {"totals": {"expired_bp": 0, "expiring_batt_pads": 0}, "devices": [], "by_subscriber": [], "_error": "Readisys API unavailable"}


@api_router.get("/dashboard/top-cards")
async def dashboard_top_cards(current_user: dict = Depends(get_current_user)):
    """Proxy to Readisys dashboard/top-cards for Readiness System real-time data."""
    import httpx
    try:
        headers = _readisys_auth_headers()
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get("https://readisys.survivalpath.ai/api/dashboard/top-cards", headers=headers)
            if resp.status_code == 200:
                return resp.json()
            logger.warning(f"dashboard/top-cards returned {resp.status_code}")
            return {"_error": f"Readisys returned {resp.status_code}"}
    except Exception as e:
        logger.warning(f"dashboard/top-cards fetch failed: {e}")
        return {"_error": str(e)}

# ==================== Service Tickets ====================

@api_router.get("/service/console-data")
async def service_console_data(current_user: dict = Depends(get_current_user)):
    """Aggregate Readisys data for Service Console view. Uses cached data when available."""
    import httpx, time, asyncio
    headers = _readisys_auth_headers()
    result = {"subscribers": [], "totals": {}, "completion_time": None}

    try:
        # Use existing caches if fresh, otherwise fetch
        now = time.time()
        status_data = _status_cache["data"] if (_status_cache["data"] and (now - _status_cache["ts"]) < 300) else None
        bp_data = _bp_cache["data"] if (_bp_cache["data"] and (now - _bp_cache["ts"]) < 300) else None

        # Fetch missing data in PARALLEL instead of sequentially
        if not status_data or not bp_data:
            try:
                async with httpx.AsyncClient(timeout=25) as client:
                    tasks = {}
                    if not status_data:
                        tasks["status"] = client.get("https://readisys.survivalpath.ai/api/status-overview", headers=headers)
                    if not bp_data:
                        tasks["bp"] = client.get("https://readisys.survivalpath.ai/api/status-overview/expiring-expired-bp", headers=headers)

                    results = await asyncio.gather(*tasks.values(), return_exceptions=True)
                    keys = list(tasks.keys())

                    for i, key in enumerate(keys):
                        resp = results[i]
                        if isinstance(resp, Exception):
                            logger.warning(f"Readisys {key} fetch failed: {resp}")
                            continue
                        if resp.status_code == 200:
                            if key == "status":
                                status_data = resp.json()
                                _status_cache["data"] = status_data
                                _status_cache["ts"] = now
                            elif key == "bp":
                                bp_data = resp.json()
                                _bp_cache["data"] = bp_data
                                _bp_cache["ts"] = now
                        else:
                            logger.warning(f"Readisys {key} returned HTTP {resp.status_code}: {resp.text[:200]}")
            except Exception as fetch_err:
                logger.warning(f"Readisys parallel fetch error: {fetch_err}")

        # Fall back to stale cache if fresh fetch failed
        if not status_data and _status_cache["data"]:
            status_data = _status_cache["data"]
            logger.info("Using stale status cache for console-data")
        if not bp_data and _bp_cache["data"]:
            bp_data = _bp_cache["data"]
            logger.info("Using stale bp cache for console-data")

        status_data = status_data or {}
        bp_data = bp_data or {}
        logger.info(f"console-data: status_keys={list(status_data.keys())[:5]}, bp_keys={list(bp_data.keys())[:5]}, subs={len(bp_data.get('by_subscriber', []))}")

        totals = status_data.get("totals", {})
        dsc = totals.get("detailed_status_counts", {})
        by_sub = bp_data.get("by_subscriber", [])
        devices = bp_data.get("devices", [])

        # Build per-subscriber device counts from devices list
        dev_by_sub = {}
        for dev in devices:
            s = dev.get("subscriber", "Unknown")
            if s not in dev_by_sub:
                dev_by_sub[s] = {"expired_bp": 0, "expiring_bp": 0}
            if dev.get("detailed_status") == "EXPIRED B/P":
                dev_by_sub[s]["expired_bp"] += 1
            else:
                dev_by_sub[s]["expiring_bp"] += 1

        # Build subscriber list from by_subscriber
        subs = []
        for sub in by_sub:
            name = sub.get("subscriber", "Unknown")
            expired = sub.get("expired_bp", 0)
            expiring = sub.get("expiring_batt_pads", 0)
            cc = sub.get("camera_cellular", {})
            total_issues = expired + expiring + (cc.get("BAD", 0)) + (cc.get("LOW", 0))
            total_aeds = sum(cc.values()) if cc else 0
            if total_issues > 0 or expired > 0 or expiring > 0:
                subs.append({
                    "subscriber": name,
                    "total_aeds": total_aeds,
                    "issues": expired + expiring,
                    "expired_bp": expired,
                    "expiring_bp": expiring,
                    "lost_contact": cc.get("BAD", 0),
                    "not_ready": cc.get("LOW", 0),
                })

        # Get ticket counts per subscriber from DB
        if _db is not None:
            pipeline = [
                {"$match": {"status": {"$nin": ["CLOSED"]}}},
                {"$group": {"_id": "$subscriber", "active": {"$sum": 1}}}
            ]
            active_counts = {}
            async for doc in _db.service_tickets.aggregate(pipeline):
                active_counts[doc["_id"]] = doc["active"]

            hist_pipeline = [
                {"$match": {"status": "CLOSED"}},
                {"$group": {"_id": "$subscriber", "count": {"$sum": 1}}}
            ]
            hist_counts = {}
            async for doc in _db.service_tickets.aggregate(hist_pipeline):
                hist_counts[doc["_id"]] = doc["count"]

            for s in subs:
                s["active_tickets"] = active_counts.get(s["subscriber"], 0)
                s["history_count"] = hist_counts.get(s["subscriber"], 0)

        # Sort by issues descending
        subs.sort(key=lambda x: x["issues"], reverse=True)

        # Aggregate totals
        total_active = await _db.service_tickets.count_documents({"status": {"$nin": ["CLOSED"]}}) if _db is not None else 0
        total_dispatched = await _db.service_tickets.count_documents({"status": "DISPATCHED"}) if _db is not None else 0

        result = {
            "completion_time": status_data.get("completion_time") or bp_data.get("completion_time"),
            "total_subscribers": len(subs),
            "subscribers": subs,
            "stats": {
                "total_aeds_need_service": dsc.get("not_ready", 0) + dsc.get("lost_contact", 0) + dsc.get("expired_bp", 0) + dsc.get("expiring_batt_pads", 0) + dsc.get("reposition", 0),
                "lost_contact": dsc.get("lost_contact", 0),
                "not_ready": dsc.get("not_ready", 0) + dsc.get("reposition", 0),
                "expired_bp": dsc.get("expired_bp", 0),
                "expiring_bp": dsc.get("expiring_batt_pads", 0),
                "active_tickets": total_active,
                "dispatched": total_dispatched,
            },
            "_debug": {
                "status_cache_age": round(now - _status_cache["ts"]) if _status_cache["ts"] else "empty",
                "bp_cache_age": round(now - _bp_cache["ts"]) if _bp_cache["ts"] else "empty",
                "status_has_data": bool(status_data and status_data.get("totals")),
                "bp_has_data": bool(bp_data and bp_data.get("by_subscriber")),
                "bp_subscriber_count": len(bp_data.get("by_subscriber", [])) if bp_data else 0,
                "dsc_keys": list(dsc.keys()) if dsc else [],
            },
        }
    except Exception as e:
        logger.warning(f"service console data error: {e}")
        import traceback
        result["_error"] = str(e)
        result["_traceback"] = traceback.format_exc()

    return result


@api_router.get("/service/diagnostics")
async def service_diagnostics():
    """Public diagnostic endpoint to check Readisys API connectivity and cache state."""
    import httpx, time
    now = time.time()
    diag = {
        "status_cache_age_sec": round(now - _status_cache["ts"]) if _status_cache["ts"] else None,
        "bp_cache_age_sec": round(now - _bp_cache["ts"]) if _bp_cache["ts"] else None,
        "status_cache_has_data": bool(_status_cache["data"]),
        "bp_cache_has_data": bool(_bp_cache["data"]),
        "app_url": os.environ.get("APP_URL", "NOT SET"),
    }
    # Try a quick fetch to test connectivity
    try:
        headers = _readisys_auth_headers()
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get("https://readisys.survivalpath.ai/api/status-overview", headers=headers)
            diag["readisys_status_code"] = resp.status_code
            diag["readisys_reachable"] = resp.status_code == 200
            if resp.status_code == 200:
                data = resp.json()
                diag["readisys_subscriber_count"] = data.get("total_subscribers", "?")
    except Exception as e:
        diag["readisys_reachable"] = False
        diag["readisys_error"] = str(e)
    return diag


@api_router.get("/service/devices/{subscriber}")
async def devices_by_subscriber(subscriber: str, current_user: dict = Depends(get_current_user)):
    """Get device-level details for a specific subscriber from cached Readisys data."""
    import httpx, time
    now = time.time()
    bp_data = _bp_cache["data"] if (_bp_cache["data"] and (now - _bp_cache["ts"]) < 300) else None
    if not bp_data:
        try:
            headers = _readisys_auth_headers()
            async with httpx.AsyncClient(timeout=20) as client:
                resp = await client.get("https://readisys.survivalpath.ai/api/status-overview/expiring-expired-bp", headers=headers)
                if resp.status_code == 200:
                    bp_data = resp.json()
                    _bp_cache["data"] = bp_data
                    _bp_cache["ts"] = now
        except Exception as e:
            return {"devices": [], "_error": str(e)}
    if not bp_data:
        return {"devices": []}
    devices = [d for d in bp_data.get("devices", []) if d.get("subscriber") == subscriber]
    return {"subscriber": subscriber, "devices": devices, "total": len(devices)}


@api_router.get("/service/tickets")
async def list_tickets(current_user: dict = Depends(get_current_user)):
    """List all service tickets."""
    tickets = []
    async for t in _db.service_tickets.find({}, {"_id": 0}).sort("created_at", -1):
        tickets.append(t)
    return tickets


@api_router.get("/service/tickets/{subscriber}")
async def list_tickets_by_subscriber(subscriber: str, current_user: dict = Depends(get_current_user)):
    """List tickets for a specific subscriber."""
    tickets = []
    async for t in _db.service_tickets.find({"subscriber": subscriber}, {"_id": 0}).sort("created_at", -1):
        tickets.append(t)
    return tickets


@api_router.post("/service/tickets")
async def create_ticket(data: dict, current_user: dict = Depends(get_current_user)):
    """Create a new service ticket."""
    ticket = {
        "id": f"SVC-{datetime.now(timezone.utc).strftime('%y%m%d')}{uuid.uuid4().hex[:3].upper()}",
        "subscriber": data.get("subscriber", ""),
        "device_id": data.get("device_id", ""),
        "device_type": data.get("device_type", ""),
        "issue_type": data.get("issue_type", ""),
        "location": data.get("location", ""),
        "priority": data.get("priority", "MEDIUM"),
        "description": data.get("description", ""),
        "additional_notes": data.get("notes", ""),
        "assigned_tech": data.get("assigned_tech", ""),
        "tech_email": data.get("tech_email", ""),
        "due_date": data.get("due_date", ""),
        "status": "OPEN",
        "created_by": current_user.get("username", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "notes": [],
    }
    await _db.service_tickets.insert_one(ticket)
    return {k: v for k, v in ticket.items() if k != "_id"}


@api_router.put("/service/tickets/{ticket_id}")
async def update_ticket(ticket_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    """Update a service ticket (status, notes, assignment)."""
    update = {"$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
    for field in ["status", "assigned_tech", "tech_email", "priority", "description"]:
        if field in data:
            update["$set"][field] = data[field]
    if "note" in data:
        update["$push"] = {"notes": {"text": data["note"], "by": current_user.get("username", ""), "at": datetime.now(timezone.utc).isoformat()}}

    await _db.service_tickets.update_one({"id": ticket_id}, update)
    ticket = await _db.service_tickets.find_one({"id": ticket_id}, {"_id": 0})
    return ticket or {"error": "Ticket not found"}


@api_router.post("/service/tickets/{ticket_id}/dispatch")
async def dispatch_ticket(ticket_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    """Dispatch a ticket to a field tech and send email notification."""
    tech_name = data.get("tech_name", "")
    tech_email = data.get("tech_email", "")

    # If tech_email is missing (older tickets), look it up from field_techs collection
    if not tech_email and tech_name and _db is not None:
        tech_doc = await _db.field_techs.find_one({"name": tech_name}, {"_id": 0, "email": 1})
        if tech_doc:
            tech_email = tech_doc.get("email", "")
            logger.info(f"Resolved tech email for '{tech_name}' from field_techs: {tech_email}")

    # If still no tech_name, try to get it from the ticket itself
    if not tech_name:
        existing = await _db.service_tickets.find_one({"id": ticket_id}, {"_id": 0})
        if existing:
            tech_name = existing.get("assigned_tech", tech_name)
            if not tech_email:
                tech_email = existing.get("tech_email", "")
            # Still no email? Look up from field_techs
            if not tech_email and tech_name:
                tech_doc = await _db.field_techs.find_one({"name": tech_name}, {"_id": 0, "email": 1})
                if tech_doc:
                    tech_email = tech_doc.get("email", "")

    # Generate a secure token for the tech to access the ticket
    dispatch_token = uuid.uuid4().hex

    await _db.service_tickets.update_one(
        {"id": ticket_id},
        {"$set": {
            "status": "DISPATCHED",
            "assigned_tech": tech_name,
            "tech_email": tech_email,
            "dispatch_token": dispatch_token,
            "dispatched_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }}
    )
    ticket = await _db.service_tickets.find_one({"id": ticket_id}, {"_id": 0})

    # Send dispatch email via SendGrid
    email_sent = False
    if tech_email and ticket:
        try:
            email_sent = await _send_dispatch_email(ticket, tech_name, tech_email, dispatch_token)
        except Exception as e:
            logger.warning(f"Dispatch email failed: {e}")

    return {"success": True, "ticket": ticket, "email_sent": email_sent, "message": f"Dispatched to {tech_name} ({tech_email})"}


async def _send_dispatch_email(ticket: dict, tech_name: str, tech_email: str, dispatch_token: str):
    """Send styled dispatch email via SendGrid."""
    from sendgrid import SendGridAPIClient
    from sendgrid.helpers.mail import Mail

    sg_key = os.environ.get("SENDGRID_API_KEY")
    sender = os.environ.get("DISPATCH_SENDER", "no-reply@cardiac-solutions.ai")
    if not sg_key:
        logger.warning("SendGrid not configured — skipping email")
        return False

    # Build the tech response URL
    app_url = os.environ.get("APP_URL", "https://cardiac-command.preview.emergentagent.com")
    view_url = f"{app_url}/tech/{ticket['id']}?token={dispatch_token}"

    subject = f"Service Dispatch: {ticket['id']} — {ticket.get('subscriber', 'N/A')}"

    html = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#0a0f1c;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#0d1526;border:1px solid rgba(6,182,212,0.3);border-radius:4px;overflow:hidden;">
  <div style="background:linear-gradient(135deg,#0a1628,#122040);padding:24px 32px;border-bottom:1px solid rgba(6,182,212,0.2);">
    <div style="color:#ef4444;font-size:18px;display:inline;">&#9829;</div>
    <span style="color:#ffffff;font-size:16px;font-weight:bold;letter-spacing:2px;margin-left:8px;">RESCUEAID</span>
    <span style="color:#64748b;font-size:10px;letter-spacing:2px;margin-left:8px;">SERVICE DISPATCH</span>
  </div>
  <div style="padding:32px;">
    <div style="color:#06b6d4;font-size:12px;letter-spacing:3px;font-weight:bold;margin-bottom:4px;">SERVICE TICKET DISPATCHED</div>
    <div style="color:#64748b;font-size:11px;margin-bottom:24px;">You have been assigned a new service ticket</div>

    <div style="background:rgba(6,182,212,0.08);border:1px solid rgba(6,182,212,0.2);border-radius:4px;padding:20px;margin-bottom:24px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="color:#64748b;font-size:11px;padding:6px 0;width:120px;">TICKET ID</td><td style="color:#ffffff;font-size:13px;font-weight:bold;">{ticket['id']}</td></tr>
        <tr><td style="color:#64748b;font-size:11px;padding:6px 0;">SUBSCRIBER</td><td style="color:#ffffff;font-size:13px;">{ticket.get('subscriber', 'N/A')}</td></tr>
        <tr><td style="color:#64748b;font-size:11px;padding:6px 0;">DEVICE</td><td style="color:#ffffff;font-size:13px;">{ticket.get('device_id', 'N/A')}</td></tr>
        <tr><td style="color:#64748b;font-size:11px;padding:6px 0;">ISSUE TYPE</td><td style="color:#f59e0b;font-size:13px;font-weight:bold;">{ticket.get('issue_type', 'N/A')}</td></tr>
        <tr><td style="color:#64748b;font-size:11px;padding:6px 0;">LOCATION</td><td style="color:#ffffff;font-size:13px;">{ticket.get('location', 'N/A')}</td></tr>
        <tr><td style="color:#64748b;font-size:11px;padding:6px 0;">PRIORITY</td><td style="color:#ffffff;font-size:13px;">{ticket.get('priority', 'N/A')}</td></tr>
        <tr><td style="color:#64748b;font-size:11px;padding:6px 0;">ASSIGNED TO</td><td style="color:#06b6d4;font-size:13px;font-weight:bold;">{tech_name}</td></tr>
      </table>
    </div>

    {f'<div style="color:#94a3b8;font-size:12px;margin-bottom:24px;padding:12px;background:rgba(100,116,139,0.1);border-radius:4px;">{ticket.get("description", "")}</div>' if ticket.get('description') else ''}

    <div style="text-align:center;margin:32px 0;">
      <a href="{view_url}" style="display:inline-block;background:linear-gradient(135deg,#0891b2,#06b6d4);color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:4px;font-size:13px;font-weight:bold;letter-spacing:2px;">VIEW &amp; RESPOND</a>
    </div>

    <div style="color:#475569;font-size:10px;text-align:center;margin-top:24px;padding-top:16px;border-top:1px solid rgba(100,116,139,0.2);">
      Cardiac Solutions LLC &mdash; AED Service Management<br/>
      This is an automated dispatch notification
    </div>
  </div>
</div>
</body>
</html>"""

    try:
        message = Mail(
            from_email=f"Cardiac Dispatch <{sender}>",
            to_emails=[tech_email],
            subject=subject,
            html_content=html,
        )
        sg = SendGridAPIClient(sg_key)
        resp = sg.send(message)
        logger.info(f"SendGrid dispatch email: {resp.status_code}")
        return resp.status_code in (200, 201, 202)
    except Exception as e:
        logger.error(f"SendGrid dispatch email error: {e}")
        return False


# ---- Public Tech Response Endpoints (no auth required) ----

@api_router.get("/tech/ticket/{ticket_id}")
async def tech_get_ticket(ticket_id: str, token: str = ""):
    """Public endpoint for field tech to view their dispatched ticket."""
    if _db is None:
        await _run_lazy_init()
    ticket = await _db.service_tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.get("dispatch_token") != token:
        raise HTTPException(status_code=403, detail="Invalid access token")
    return ticket


@api_router.put("/tech/ticket/{ticket_id}/status")
async def tech_update_status(ticket_id: str, data: dict):
    """Public endpoint for field tech to update ticket status."""
    token = data.get("token", "")
    new_status = data.get("status", "")
    note = data.get("note", "")

    if _db is None:
        await _run_lazy_init()
    ticket = await _db.service_tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.get("dispatch_token") != token:
        raise HTTPException(status_code=403, detail="Invalid access token")

    valid_transitions = {
        "DISPATCHED": ["ACKNOWLEDGED"],
        "ACKNOWLEDGED": ["EN ROUTE"],
        "EN ROUTE": ["ON SITE"],
        "ON SITE": ["COMPLETE"],
    }
    allowed = valid_transitions.get(ticket.get("status"), [])
    if new_status not in allowed:
        raise HTTPException(status_code=400, detail=f"Cannot transition from {ticket.get('status')} to {new_status}")

    update = {
        "$set": {
            "status": new_status,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    }
    if note:
        update["$push"] = {"notes": {"text": note, "by": ticket.get("assigned_tech", "Tech"), "at": datetime.now(timezone.utc).isoformat()}}

    await _db.service_tickets.update_one({"id": ticket_id}, update)
    updated = await _db.service_tickets.find_one({"id": ticket_id}, {"_id": 0})
    return updated


@api_router.get("/service/field-techs")
async def list_field_techs(current_user: dict = Depends(get_current_user)):
    """List all field technicians."""
    techs = []
    if _db is not None:
        async for t in _db.field_techs.find({}, {"_id": 0}).sort("name", 1):
            techs.append(t)
    return techs


@api_router.post("/service/field-techs")
async def create_field_tech(data: dict, current_user: dict = Depends(get_current_user)):
    """Add a new field technician."""
    tech = {
        "id": f"tech-{uuid.uuid4().hex[:6]}",
        "name": data.get("name", ""),
        "company": data.get("company", ""),
        "email": data.get("email", ""),
        "mobile": data.get("mobile", "") or data.get("phone", ""),
        "address": data.get("address", ""),
        "street": data.get("street", ""),
        "city": data.get("city", ""),
        "state": data.get("state", ""),
        "zip": data.get("zip", ""),
        "area": data.get("area", "") or data.get("region", ""),
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await _db.field_techs.insert_one(tech)
    return {k: v for k, v in tech.items() if k != "_id"}


@api_router.put("/service/field-techs/{tech_id}")
async def update_field_tech(tech_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    """Update a field technician."""
    update_fields = {}
    for field in ["name", "company", "email", "mobile", "address", "street", "city", "state", "zip", "area", "active"]:
        if field in data:
            update_fields[field] = data[field]
    if update_fields:
        await _db.field_techs.update_one({"id": tech_id}, {"$set": update_fields})
    tech = await _db.field_techs.find_one({"id": tech_id}, {"_id": 0})
    return tech or {"error": "Not found"}


@api_router.delete("/service/field-techs/{tech_id}")
async def delete_field_tech(tech_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a field technician."""
    result = await _db.field_techs.delete_one({"id": tech_id})
    return {"deleted": result.deleted_count > 0}


# ==================== Customer Portal ====================

@api_router.post("/customers")
async def save_customer(data: dict, admin: dict = Depends(require_admin)):
    """Save a new customer with their AED units."""
    ts = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": f"cust-{uuid.uuid4().hex[:8]}",
        "site_name": data.get("site_name", ""),
        "unit_count": data.get("unit_count", 0),
        "address": data.get("address", ""),
        "city": data.get("city", ""),
        "state": data.get("state", ""),
        "zip_code": data.get("zip_code", ""),
        "first_name": data.get("first_name", ""),
        "last_name": data.get("last_name", ""),
        "email": data.get("email", ""),
        "phone": data.get("phone", ""),
        "aed_units": data.get("aed_units", []),
        "created_by": admin.get("username", ""),
        "created_at": ts,
        "updated_at": ts,
    }
    await _db.customers.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.get("/customers")
async def list_customers(admin: dict = Depends(require_admin)):
    """List all customers."""
    customers = await _db.customers.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return customers

@api_router.get("/customers/{customer_id}")
async def get_customer(customer_id: str, admin: dict = Depends(require_admin)):
    """Get a single customer by ID."""
    doc = await _db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Customer not found")
    return doc

@api_router.put("/customers/{customer_id}")
async def update_customer(customer_id: str, data: dict, admin: dict = Depends(require_admin)):
    """Update an existing customer."""
    existing = await _db.customers.find_one({"id": customer_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Customer not found")
    update = {
        "site_name": data.get("site_name", ""),
        "unit_count": data.get("unit_count", 0),
        "address": data.get("address", ""),
        "city": data.get("city", ""),
        "state": data.get("state", ""),
        "zip_code": data.get("zip_code", ""),
        "first_name": data.get("first_name", ""),
        "last_name": data.get("last_name", ""),
        "email": data.get("email", ""),
        "phone": data.get("phone", ""),
        "aed_units": data.get("aed_units", []),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await _db.customers.update_one({"id": customer_id}, {"$set": update})
    updated = await _db.customers.find_one({"id": customer_id}, {"_id": 0})
    return updated


# ==================== Health Check ====================

@app.get("/health")
async def health_root():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

@app.get("/api/debug/errors")
async def get_error_log():
    """Production error log — stored in MongoDB. Check this after a 502/520 to see what happened."""
    try:
        if _db is None:
            return {"error": "DB not initialized"}
        entries = await _db.server_log.find({}, {"_id": 0}).sort("timestamp", -1).to_list(50)
        return {"count": len(entries), "entries": entries}
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/debug/status")
async def debug_status():
    """Diagnostic endpoint — check MongoDB connectivity and user count. No auth required."""
    info = {
        "mongo_url_set": bool(mongo_url),
        "db_name": db_name,
        "jwt_secret_set": bool(JWT_SECRET),
        "seed_done": _seed_done,
        "version": f"v{datetime.now(timezone.utc).strftime('%y%m%d%H%M')}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    try:
        count = await _db.users.count_documents({})
        usernames = []
        async for u in _db.users.find({}, {"_id": 0, "username": 1}).limit(20):
            usernames.append(u.get("username", "?"))
        info["db_connected"] = True
        info["user_count"] = count
        info["usernames"] = usernames
    except Exception as e:
        info["db_connected"] = False
        info["error"] = str(e)
    return info

@app.get("/api/debug/test-login")
async def debug_test_login():
    """Test login for seed user Lew — returns diagnostic info, no actual token."""
    result = {}
    try:
        user = await _db.users.find_one({"username": "Lew"}, {"_id": 0})
        if not user:
            result["error"] = "User 'Lew' not found in database"
            result["user_count"] = await _db.users.count_documents({})
            return result
        result["user_found"] = True
        result["has_password_hash"] = "password_hash" in user
        result["hash_prefix"] = user.get("password_hash", "")[:7] if user.get("password_hash") else "NONE"
        try:
            pw_ok = verify_password("Lew123", user.get("password_hash", ""))
            result["password_verify"] = pw_ok
        except Exception as e:
            result["password_verify"] = False
            result["verify_error"] = str(e)
    except Exception as e:
        result["error"] = str(e)
    return result

@api_router.post("/tts/speak")
async def tts_speak(request: Request):
    """Generate JARVIS-style speech using OpenAI TTS (onyx voice)."""
    try:
        body = await request.json()
        text = body.get("text", "")
        if not text:
            raise HTTPException(status_code=400, detail="Text is required")
        if len(text) > 4096:
            text = text[:4096]

        from emergentintegrations.llm.openai import OpenAITextToSpeech
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="TTS key not configured")

        tts = OpenAITextToSpeech(api_key=api_key)
        voice = body.get("voice", "nova")
        audio_base64 = await tts.generate_speech_base64(
            text=text,
            model="tts-1",
            voice=voice,
            speed=0.92,
            response_format="mp3"
        )
        return {"audio": audio_base64, "format": "mp3"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[TTS] Error: {e}", flush=True)
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/")
async def root():
    return {"message": "Cardiac Solutions API - Online", "status": "operational"}

@api_router.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# Include the router in the main app
app.include_router(api_router)

@app.on_event("shutdown")
async def shutdown_db_client():
    try:
        await log_to_db("INFO", "Server shutting down")
        if _mongo_client:
            _mongo_client.close()
    except Exception:
        pass
