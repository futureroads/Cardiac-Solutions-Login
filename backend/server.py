from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET')
if not JWT_SECRET:
    raise ValueError("JWT_SECRET environment variable must be set")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Create the main app
app = FastAPI(title="Cardiac Solutions API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

security = HTTPBearer()

# ==================== Models ====================

class UserCreate(BaseModel):
    username: str
    password: str
    name: Optional[str] = None

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: str
    username: str
    name: str
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class AEDDevice(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    subscriber: str
    location: str
    status: str  # ready, not_ready, reposition, not_present, expired_bp, expiring_bp, lost_contact, unknown
    last_check: str
    battery_level: int
    pads_expiry: str
    camera_status: str  # online, offline

class Subscriber(BaseModel):
    model_config = ConfigDict(extra="ignore")
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

# Pre-defined users
PREDEFINED_USERS = {
    "Lew": {
        "id": "user-lew-001",
        "username": "Lew",
        "name": "Lew",
        "password": "Lew123",
        "created_at": "2024-01-01T00:00:00Z"
    },
    "Stark": {
        "id": "user-stark-001", 
        "username": "Stark",
        "name": "Tony Stark",
        "password": "Stark123",
        "created_at": "2024-01-01T00:00:00Z"
    },
    "Tony": {
        "id": "user-tony-001",
        "username": "Tony",
        "name": "Tony",
        "password": "Tony123",
        "created_at": "2024-01-01T00:00:00Z"
    },
    "Tracey": {
        "id": "user-tracey-001",
        "username": "Tracey",
        "name": "Tracey",
        "password": "Tracey123",
        "created_at": "2024-01-01T00:00:00Z"
    },
    "Nate": {
        "id": "user-nate-001",
        "username": "Nate",
        "name": "Nate",
        "password": "Nate123",
        "created_at": "2024-01-01T00:00:00Z"
    },
    "Jon": {
        "id": "user-jon-001",
        "username": "Jon",
        "name": "Jon",
        "password": "Jon123",
        "created_at": "2024-01-01T00:00:00Z"
    }
}

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        # Allow demo token for demo mode
        if credentials.credentials == "demo-token":
            return {
                "id": "demo",
                "username": "demo",
                "name": "Demo User",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
        
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Check predefined users first
        for username, user_data in PREDEFINED_USERS.items():
            if user_data["id"] == user_id:
                return {
                    "id": user_data["id"],
                    "username": user_data["username"],
                    "name": user_data["name"],
                    "created_at": user_data["created_at"]
                }
        
        # Then check database
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ==================== Auth Routes ====================

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    # Check if username exists in predefined users
    if user_data.username in PREDEFINED_USERS:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Check if user exists in database
    existing = await db.users.find_one({"username": user_data.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    # Create user
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "username": user_data.username,
        "name": user_data.name or user_data.username,
        "password_hash": hash_password(user_data.password),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    
    # Generate token
    token = create_token(user_id, user_data.username)
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user_id,
            username=user_data.username,
            name=user_doc["name"],
            created_at=user_doc["created_at"]
        )
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    # Check predefined users first
    if credentials.username in PREDEFINED_USERS:
        user_data = PREDEFINED_USERS[credentials.username]
        if credentials.password == user_data["password"]:
            token = create_token(user_data["id"], user_data["username"])
            return TokenResponse(
                access_token=token,
                user=UserResponse(
                    id=user_data["id"],
                    username=user_data["username"],
                    name=user_data["name"],
                    created_at=user_data["created_at"]
                )
            )
        else:
            raise HTTPException(status_code=401, detail="Invalid username or password")
    
    # Check database users
    user = await db.users.find_one({"username": credentials.username}, {"_id": 0})
    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    token = create_token(user["id"], user["username"])
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user["id"],
            username=user["username"],
            name=user["name"],
            created_at=user["created_at"]
        )
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(
        id=current_user["id"],
        username=current_user["username"],
        name=current_user["name"],
        created_at=current_user["created_at"]
    )

# ==================== Dashboard Routes ====================

@api_router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    # Return mock data for now - in production, aggregate from AED devices
    stats = await db.dashboard_stats.find_one({}, {"_id": 0})
    if not stats:
        # Create default stats
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
        # Create mock subscribers
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
        # Create mock devices
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

# ==================== Health Check ====================

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

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
