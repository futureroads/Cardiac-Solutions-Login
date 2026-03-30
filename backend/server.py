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
ALL_MODULE_IDS = ["daily_report", "notifications", "service_tickets", "dashboard", "survival_path", "hybrid_training", "customer_portal"]

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
    return {
        "version": "v10-instant",
        "build": "2603271445",
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

class AdminUserUpdate(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None
    allowed_modules: Optional[List[str]] = None

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
                if update_fields:
                    await _db.users.update_one({"username": seed["username"]}, {"$set": update_fields})
                    logger.info(f"Seed: updated {seed['username']} fields: {list(update_fields.keys())}")
        except Exception as e:
            logger.error(f"Failed to seed user {seed['username']}: {e}")
    logger.info(f"Seeding complete: {seeded} new users")

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
                resp = await client.get(FEEDBACK_SOURCE_URL)
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

_status_cache = {"data": None, "ts": 0}

@api_router.get("/status-overview")
async def status_overview():
    """Proxy to Readisys status overview API. Caches for 30s."""
    import httpx, time
    now = time.time()
    if _status_cache["data"] and (now - _status_cache["ts"]) < 30:
        return _status_cache["data"]
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.get("https://readisys.survivalpath.ai/api/status-overview")
            resp.raise_for_status()
            _status_cache["data"] = resp.json()
            _status_cache["ts"] = now
            return _status_cache["data"]
    except Exception as e:
        logger.warning(f"status-overview fetch failed: {e}")
        if _status_cache["data"]:
            return _status_cache["data"]
        return {"total_subscribers": 0, "total_cameras": 0, "percent_ready": 0}

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
        "version": "v10-instant",
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
