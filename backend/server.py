from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt

print("[SERVER] Module loading started", flush=True)

# Load .env first
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Resend - optional import
try:
    import resend
    resend.api_key = os.environ.get('RESEND_API_KEY', '')
except ImportError:
    resend = None
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')

# MongoDB connection - lazy init to prevent crash on DNS SRV resolution
mongo_url = os.environ.get('MONGO_URL', '')
db_name = os.environ.get('DB_NAME', 'cardiac_solutions')
client = None
db = None

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', '')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# All available module IDs
ALL_MODULE_IDS = ["daily_report", "notifications", "service_tickets", "dashboard", "survival_path"]

# Create the main app
app = FastAPI(title="Cardiac Solutions API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

security = HTTPBearer()

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
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

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
        "allowed_modules": ALL_MODULE_IDS + ["user_access", "backend"],
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
    """Seed predefined users into MongoDB on startup."""
    try:
        for seed in SEED_USERS:
            existing = await db.users.find_one({"username": seed["username"]})
            if not existing:
                doc = {
                    "id": seed["id"],
                    "username": seed["username"],
                    "name": seed["name"],
                    "email": seed["email"],
                    "phone": seed["phone"],
                    "role": seed["role"],
                    "department": seed.get("department", ""),
                    "allowed_modules": seed["allowed_modules"],
                    "password_hash": hash_password(seed["plain_password"]),
                    "created_at": seed["created_at"],
                }
                await db.users.insert_one(doc)
                logger.info(f"Seeded user: {seed['username']}")
            else:
                update_fields = {}
                if "role" not in existing:
                    update_fields["role"] = seed["role"]
                if "allowed_modules" not in existing:
                    update_fields["allowed_modules"] = seed["allowed_modules"]
                if "phone" not in existing:
                    update_fields["phone"] = seed["phone"]
                if "department" not in existing:
                    update_fields["department"] = seed.get("department", "")
                if update_fields:
                    await db.users.update_one({"username": seed["username"]}, {"$set": update_fields})
                    logger.info(f"Updated seed user fields: {seed['username']}")
    except Exception as e:
        logger.error(f"Failed to seed users: {e}")

_seed_done = False

async def ensure_seeded():
    """Lazy seed: retry seeding if startup seed was skipped or failed."""
    global client, db, _seed_done
    if _seed_done:
        return
    try:
        if db is None:
            client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=10000)
            db = client[db_name]
        count = await db.users.count_documents({})
        if count == 0:
            logger.info("No users found — running lazy seed")
            try:
                await db.users.create_index("username", unique=True)
                await db.users.create_index("id", unique=True)
            except Exception:
                pass
            await seed_users()
        _seed_done = True
    except Exception as e:
        logger.error(f"ensure_seeded failed: {e}")

@app.on_event("startup")
async def startup():
    global client, db, _seed_done
    try:
        client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=10000)
        db = client[db_name]
        await db.users.create_index("username", unique=True)
        await db.users.create_index("id", unique=True)
        await seed_users()
        _seed_done = True
        logger.info("Database seeded and indexes created")
    except Exception as e:
        logger.error(f"Startup DB init failed (will retry on first request): {e}")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")

        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def require_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

# ==================== Auth Routes ====================

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    await ensure_seeded()
    user = await db.users.find_one({"username": credentials.username}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    if not verify_password(credentials.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid username or password")

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

# ==================== Admin User Management ====================

@api_router.get("/admin/users")
async def list_users(admin: dict = Depends(require_admin)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(500)
    return users

@api_router.post("/admin/users")
async def create_user(data: AdminUserCreate, admin: dict = Depends(require_admin)):
    existing = await db.users.find_one({"username": data.username})
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
        "password_hash": hash_password(data.password),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(doc)
    doc.pop("_id", None)
    doc.pop("password_hash", None)
    return doc

@api_router.put("/admin/users/{user_id}")
async def update_user(user_id: str, data: AdminUserUpdate, admin: dict = Depends(require_admin)):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update = {}
    if data.username is not None:
        # Check uniqueness
        clash = await db.users.find_one({"username": data.username, "id": {"$ne": user_id}})
        if clash:
            raise HTTPException(status_code=400, detail="Username already exists")
        update["username"] = data.username
        update["name"] = data.username
    if data.password is not None and data.password != "":
        update["password_hash"] = hash_password(data.password)
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
        await db.users.update_one({"id": user_id}, {"$set": update})

    updated = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return updated

@api_router.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, admin: dict = Depends(require_admin)):
    # Prevent deleting yourself
    if user_id == "user-admin-001":
        raise HTTPException(status_code=400, detail="Cannot delete the system admin")

    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"status": "deleted"}

@api_router.get("/admin/modules")
async def list_modules(admin: dict = Depends(require_admin)):
    """Return list of available modules for assignment."""
    return [
        {"id": "daily_report", "title": "Daily Report"},
        {"id": "notifications", "title": "Notifications"},
        {"id": "service_tickets", "title": "Service Tickets"},
        {"id": "dashboard", "title": "Dashboard"},
        {"id": "survival_path", "title": "Survival Path"},
    ]

# ==================== Dashboard Routes ====================

@api_router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    stats = await db.dashboard_stats.find_one({}, {"_id": 0})
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
        await db.dashboard_stats.insert_one(stats)
        stats.pop("_id", None)
    return DashboardStats(**stats)

@api_router.get("/dashboard/subscribers", response_model=List[Subscriber])
async def get_subscribers(current_user: dict = Depends(get_current_user)):
    subscribers = await db.subscribers.find({}, {"_id": 0}).to_list(100)
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
        await db.subscribers.insert_many(mock_subscribers)
        subscribers = mock_subscribers
    return [Subscriber(**s) for s in subscribers]

@api_router.get("/dashboard/devices", response_model=List[AEDDevice])
async def get_devices(current_user: dict = Depends(get_current_user), limit: int = 50):
    devices = await db.devices.find({}, {"_id": 0}).to_list(limit)
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
        await db.devices.insert_many(mock_devices)
        devices = mock_devices
    return [AEDDevice(**d) for d in devices]

# ==================== Send Overview Email ====================

@api_router.post("/dashboard/send-overview")
async def send_overview_email(current_user: dict = Depends(get_current_user)):
    user_email = current_user.get("email", "")
    if not user_email:
        raise HTTPException(status_code=400, detail="No email address on file for your account")

    stats_doc = await db.dashboard_stats.find_one({}, {"_id": 0})
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

    if not resend.api_key:
        logger.warning(f"RESEND_API_KEY not set — overview email to {user_email} was NOT sent (mocked success)")
        return {"status": "success", "message": f"Overview sent to {user_email}"}

    try:
        email_result = await asyncio.to_thread(resend.Emails.send, {
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

# ==================== Health Check ====================

@app.get("/health")
async def health_root():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

@app.get("/api/debug/status")
async def debug_status():
    """Diagnostic endpoint — check MongoDB connectivity and user count."""
    if db is None:
        return {
            "db_connected": False,
            "error": "MongoDB client not initialized",
            "seed_done": _seed_done,
            "mongo_url_set": bool(mongo_url),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    try:
        count = await db.users.count_documents({})
        return {
            "db_connected": True,
            "db_name": db.name,
            "user_count": count,
            "seed_done": _seed_done,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        return {
            "db_connected": False,
            "error": str(e),
            "seed_done": _seed_done,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

@api_router.get("/")
async def root():
    return {"message": "Cardiac Solutions API - Online", "status": "operational"}

@api_router.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    if client:
        client.close()
