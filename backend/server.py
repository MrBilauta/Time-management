from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
import base64
import asyncio
import resend
import csv
import io

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480

# Email Configuration
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

security = HTTPBearer()

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# ============ MODELS ============

class UserRole(BaseModel):
    ADMIN: str = "admin"
    MANAGER: str = "manager"
    EMPLOYEE: str = "employee"

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: str
    role: str  # admin, manager, employee
    date_of_joining: Optional[str] = None
    date_of_birth: Optional[str] = None
    designation: Optional[str] = None
    practice: Optional[str] = None
    reporting_manager_id: Optional[str] = None
    leave_balance: float = 20.0
    documents: Optional[List[Dict[str, str]]] = []
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "employee"
    date_of_joining: Optional[str] = None
    date_of_birth: Optional[str] = None
    designation: Optional[str] = None
    practice: Optional[str] = None
    reporting_manager_id: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Project(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    project_code: str
    description: str
    project_manager_id: str
    estimated_hours: float
    sub_codes: Optional[List[Dict[str, str]]] = []
    team_members: Optional[List[str]] = []
    documents: Optional[List[Dict[str, str]]] = []
    milestones: Optional[List[Dict[str, Any]]] = []
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class ProjectCreate(BaseModel):
    project_code: str
    description: str
    project_manager_id: str
    estimated_hours: float
    sub_codes: Optional[List[Dict[str, str]]] = []
    team_members: Optional[List[str]] = []

class Timesheet(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    week_start: str  # ISO date of Monday
    entries: List[Dict[str, Any]]  # [{project_code, description, activity_type, mon, tue, wed, thu, fri}]
    total_hours: float = 0.0
    status: str = "draft"  # draft, submitted, approved, rejected
    submitted_at: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[str] = None
    comments: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class TimesheetCreate(BaseModel):
    week_start: str
    entries: List[Dict[str, Any]]
    total_hours: float

class Leave(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    start_date: str
    end_date: str
    days: float
    reason: str
    status: str = "pending"  # pending, approved, rejected
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[str] = None
    comments: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class LeaveCreate(BaseModel):
    start_date: str
    end_date: str
    days: float
    reason: str

class Invoice(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    project_id: str
    milestone: Optional[str] = None
    estimated_hours: float
    estimated_cost: float
    actual_hours: float = 0.0
    actual_cost: float = 0.0
    status: str = "draft"  # draft, submitted, approved, paid
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class InvoiceCreate(BaseModel):
    project_id: str
    milestone: Optional[str] = None
    estimated_hours: float
    estimated_cost: float

class Reimbursement(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    amount: float
    description: str
    receipt: Optional[str] = None  # base64 or file path
    status: str = "pending"  # pending, approved, rejected, paid
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[str] = None
    comments: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class ReimbursementCreate(BaseModel):
    amount: float
    description: str
    receipt: Optional[str] = None

# ============ AUTH UTILITIES ============

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication")
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication")

def require_role(allowed_roles: List[str]):
    async def role_checker(current_user: dict = Depends(get_current_user)):
        if current_user["role"] not in allowed_roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return role_checker

# ============ AUTH ROUTES ============

@api_router.post("/auth/register")
async def register(user_data: UserCreate):
    # Check if user exists
    existing = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Hash password
    hashed_password = get_password_hash(user_data.password)
    
    # Create user
    user_dict = user_data.model_dump(exclude={"password"})
    user = User(**user_dict)
    doc = user.model_dump()
    doc["password"] = hashed_password
    
    await db.users.insert_one(doc)
    
    # Create token
    access_token = create_access_token(data={"sub": user.id, "role": user.role})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user.model_dump()
    }

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    access_token = create_access_token(data={"sub": user["id"], "role": user["role"]})
    
    user_data = {k: v for k, v in user.items() if k != "password"}
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_data
    }

@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {k: v for k, v in current_user.items() if k != "password"}

# ============ USER ROUTES ============

@api_router.get("/users")
async def get_users(current_user: dict = Depends(require_role(["admin", "manager"]))):
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(1000)
    return users

@api_router.post("/users")
async def create_user(user_data: UserCreate, current_user: dict = Depends(require_role(["admin"]))):
    existing = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")
    
    hashed_password = get_password_hash(user_data.password)
    user_dict = user_data.model_dump(exclude={"password"})
    user = User(**user_dict)
    doc = user.model_dump()
    doc["password"] = hashed_password
    
    await db.users.insert_one(doc)
    return user.model_dump()

@api_router.put("/users/{user_id}")
async def update_user(user_id: str, updates: dict, current_user: dict = Depends(require_role(["admin"]))):
    if "password" in updates:
        updates["password"] = get_password_hash(updates["password"])
    
    result = await db.users.update_one({"id": user_id}, {"$set": updates})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    updated_user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    return updated_user

@api_router.get("/users/{user_id}")
async def get_user(user_id: str, current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# ============ PROJECT ROUTES ============

@api_router.get("/projects")
async def get_projects(current_user: dict = Depends(get_current_user)):
    if current_user["role"] in ["admin", "manager"]:
        projects = await db.projects.find({}, {"_id": 0}).to_list(1000)
    else:
        # Employees see only their assigned projects
        projects = await db.projects.find(
            {"team_members": current_user["id"]}, 
            {"_id": 0}
        ).to_list(1000)
    return projects

@api_router.post("/projects")
async def create_project(project_data: ProjectCreate, current_user: dict = Depends(require_role(["admin", "manager"]))):
    # Check if project code exists
    existing = await db.projects.find_one({"project_code": project_data.project_code}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Project code already exists")
    
    project = Project(**project_data.model_dump())
    await db.projects.insert_one(project.model_dump())
    return project.model_dump()

@api_router.put("/projects/{project_id}")
async def update_project(project_id: str, updates: dict, current_user: dict = Depends(require_role(["admin", "manager"]))):
    result = await db.projects.update_one({"id": project_id}, {"$set": updates})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    
    updated = await db.projects.find_one({"id": project_id}, {"_id": 0})
    return updated

@api_router.get("/projects/{project_id}")
async def get_project(project_id: str, current_user: dict = Depends(get_current_user)):
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

# ============ TIMESHEET ROUTES ============

@api_router.get("/timesheets")
async def get_timesheets(current_user: dict = Depends(get_current_user)):
    if current_user["role"] in ["admin", "manager"]:
        timesheets = await db.timesheets.find({}, {"_id": 0}).to_list(1000)
    else:
        timesheets = await db.timesheets.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(1000)
    return timesheets

@api_router.post("/timesheets")
async def create_timesheet(timesheet_data: TimesheetCreate, current_user: dict = Depends(get_current_user)):
    # Check if timesheet for this week exists
    existing = await db.timesheets.find_one({
        "user_id": current_user["id"],
        "week_start": timesheet_data.week_start
    }, {"_id": 0})
    
    if existing:
        raise HTTPException(status_code=400, detail="Timesheet for this week already exists")
    
    timesheet = Timesheet(
        user_id=current_user["id"],
        **timesheet_data.model_dump()
    )
    await db.timesheets.insert_one(timesheet.model_dump())
    return timesheet.model_dump()

@api_router.put("/timesheets/{timesheet_id}")
async def update_timesheet(timesheet_id: str, updates: dict, current_user: dict = Depends(get_current_user)):
    timesheet = await db.timesheets.find_one({"id": timesheet_id}, {"_id": 0})
    if not timesheet:
        raise HTTPException(status_code=404, detail="Timesheet not found")
    
    # Only draft timesheets can be edited by employees
    if timesheet["status"] != "draft" and current_user["role"] not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Cannot edit submitted timesheet")
    
    result = await db.timesheets.update_one({"id": timesheet_id}, {"$set": updates})
    updated = await db.timesheets.find_one({"id": timesheet_id}, {"_id": 0})
    return updated

@api_router.post("/timesheets/{timesheet_id}/submit")
async def submit_timesheet(timesheet_id: str, current_user: dict = Depends(get_current_user)):
    updates = {
        "status": "submitted",
        "submitted_at": datetime.now(timezone.utc).isoformat()
    }
    result = await db.timesheets.update_one({"id": timesheet_id, "user_id": current_user["id"]}, {"$set": updates})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Timesheet not found")
    
    updated = await db.timesheets.find_one({"id": timesheet_id}, {"_id": 0})
    return updated

@api_router.post("/timesheets/{timesheet_id}/approve")
async def approve_timesheet(timesheet_id: str, comments: Optional[str] = None, current_user: dict = Depends(require_role(["admin", "manager"]))):
    updates = {
        "status": "approved",
        "reviewed_by": current_user["id"],
        "reviewed_at": datetime.now(timezone.utc).isoformat(),
        "comments": comments
    }
    result = await db.timesheets.update_one({"id": timesheet_id}, {"$set": updates})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Timesheet not found")
    
    updated = await db.timesheets.find_one({"id": timesheet_id}, {"_id": 0})
    return updated

@api_router.post("/timesheets/{timesheet_id}/reject")
async def reject_timesheet(timesheet_id: str, comments: str, current_user: dict = Depends(require_role(["admin", "manager"]))):
    updates = {
        "status": "rejected",
        "reviewed_by": current_user["id"],
        "reviewed_at": datetime.now(timezone.utc).isoformat(),
        "comments": comments
    }
    result = await db.timesheets.update_one({"id": timesheet_id}, {"$set": updates})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Timesheet not found")
    
    updated = await db.timesheets.find_one({"id": timesheet_id}, {"_id": 0})
    return updated

# ============ LEAVE ROUTES ============

@api_router.get("/leaves")
async def get_leaves(current_user: dict = Depends(get_current_user)):
    if current_user["role"] in ["admin", "manager"]:
        leaves = await db.leaves.find({}, {"_id": 0}).to_list(1000)
    else:
        leaves = await db.leaves.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(1000)
    return leaves

@api_router.post("/leaves")
async def create_leave(leave_data: LeaveCreate, current_user: dict = Depends(get_current_user)):
    # Check leave balance
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    if user["leave_balance"] < leave_data.days:
        raise HTTPException(status_code=400, detail="Insufficient leave balance")
    
    leave = Leave(
        user_id=current_user["id"],
        **leave_data.model_dump()
    )
    await db.leaves.insert_one(leave.model_dump())
    return leave.model_dump()

@api_router.post("/leaves/{leave_id}/approve")
async def approve_leave(leave_id: str, comments: Optional[str] = None, current_user: dict = Depends(require_role(["admin", "manager"]))):
    leave = await db.leaves.find_one({"id": leave_id}, {"_id": 0})
    if not leave:
        raise HTTPException(status_code=404, detail="Leave not found")
    
    # Deduct leave balance
    await db.users.update_one(
        {"id": leave["user_id"]},
        {"$inc": {"leave_balance": -leave["days"]}}
    )
    
    updates = {
        "status": "approved",
        "reviewed_by": current_user["id"],
        "reviewed_at": datetime.now(timezone.utc).isoformat(),
        "comments": comments
    }
    await db.leaves.update_one({"id": leave_id}, {"$set": updates})
    updated = await db.leaves.find_one({"id": leave_id}, {"_id": 0})
    return updated

@api_router.post("/leaves/{leave_id}/reject")
async def reject_leave(leave_id: str, comments: str, current_user: dict = Depends(require_role(["admin", "manager"]))):
    updates = {
        "status": "rejected",
        "reviewed_by": current_user["id"],
        "reviewed_at": datetime.now(timezone.utc).isoformat(),
        "comments": comments
    }
    result = await db.leaves.update_one({"id": leave_id}, {"$set": updates})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Leave not found")
    
    updated = await db.leaves.find_one({"id": leave_id}, {"_id": 0})
    return updated

# ============ INVOICE ROUTES ============

@api_router.get("/invoices")
async def get_invoices(current_user: dict = Depends(require_role(["admin", "manager"]))):
    invoices = await db.invoices.find({}, {"_id": 0}).to_list(1000)
    return invoices

@api_router.post("/invoices")
async def create_invoice(invoice_data: InvoiceCreate, current_user: dict = Depends(require_role(["admin", "manager"]))):
    invoice = Invoice(**invoice_data.model_dump())
    await db.invoices.insert_one(invoice.model_dump())
    return invoice.model_dump()

@api_router.put("/invoices/{invoice_id}")
async def update_invoice(invoice_id: str, updates: dict, current_user: dict = Depends(require_role(["admin", "manager"]))):
    result = await db.invoices.update_one({"id": invoice_id}, {"$set": updates})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    updated = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    return updated

# ============ REIMBURSEMENT ROUTES ============

@api_router.get("/reimbursements")
async def get_reimbursements(current_user: dict = Depends(get_current_user)):
    if current_user["role"] in ["admin", "manager"]:
        reimbursements = await db.reimbursements.find({}, {"_id": 0}).to_list(1000)
    else:
        reimbursements = await db.reimbursements.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(1000)
    return reimbursements

@api_router.post("/reimbursements")
async def create_reimbursement(reimbursement_data: ReimbursementCreate, current_user: dict = Depends(get_current_user)):
    reimbursement = Reimbursement(
        user_id=current_user["id"],
        **reimbursement_data.model_dump()
    )
    await db.reimbursements.insert_one(reimbursement.model_dump())
    return reimbursement.model_dump()

@api_router.post("/reimbursements/{reimbursement_id}/approve")
async def approve_reimbursement(reimbursement_id: str, comments: Optional[str] = None, current_user: dict = Depends(require_role(["admin", "manager"]))):
    updates = {
        "status": "approved",
        "reviewed_by": current_user["id"],
        "reviewed_at": datetime.now(timezone.utc).isoformat(),
        "comments": comments
    }
    result = await db.reimbursements.update_one({"id": reimbursement_id}, {"$set": updates})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Reimbursement not found")
    
    updated = await db.reimbursements.find_one({"id": reimbursement_id}, {"_id": 0})
    return updated

@api_router.post("/reimbursements/{reimbursement_id}/reject")
async def reject_reimbursement(reimbursement_id: str, comments: str, current_user: dict = Depends(require_role(["admin", "manager"]))):
    updates = {
        "status": "rejected",
        "reviewed_by": current_user["id"],
        "reviewed_at": datetime.now(timezone.utc).isoformat(),
        "comments": comments
    }
    result = await db.reimbursements.update_one({"id": reimbursement_id}, {"$set": updates})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Reimbursement not found")
    
    updated = await db.reimbursements.find_one({"id": reimbursement_id}, {"_id": 0})
    return updated

# ============ REPORTS ROUTES ============

@api_router.get("/reports/timesheet-summary")
async def get_timesheet_summary(current_user: dict = Depends(require_role(["admin", "manager"]))):
    timesheets = await db.timesheets.find({"status": "approved"}, {"_id": 0}).to_list(1000)
    
    # Calculate summary by user
    summary = {}
    for ts in timesheets:
        user_id = ts["user_id"]
        if user_id not in summary:
            summary[user_id] = {"total_hours": 0, "weeks": 0}
        summary[user_id]["total_hours"] += ts["total_hours"]
        summary[user_id]["weeks"] += 1
    
    return summary

@api_router.get("/reports/project-hours")
async def get_project_hours(current_user: dict = Depends(require_role(["admin", "manager"]))):
    timesheets = await db.timesheets.find({"status": "approved"}, {"_id": 0}).to_list(1000)
    
    # Calculate hours by project
    project_hours = {}
    for ts in timesheets:
        for entry in ts["entries"]:
            project_code = entry.get("project_code", "")
            if project_code:
                if project_code not in project_hours:
                    project_hours[project_code] = 0
                # Sum all daily hours
                daily_hours = sum([
                    entry.get("mon", 0),
                    entry.get("tue", 0),
                    entry.get("wed", 0),
                    entry.get("thu", 0),
                    entry.get("fri", 0)
                ])
                project_hours[project_code] += daily_hours
    
    return project_hours

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()