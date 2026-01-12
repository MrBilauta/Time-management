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
    milestone_name: Optional[str] = None
    milestone_description: Optional[str] = None
    milestone_due_date: Optional[str] = None
    estimated_hours: float
    estimated_cost: float
    actual_hours: float = 0.0
    actual_cost: float = 0.0
    status: str = "draft"  # draft, submitted, approved, paid
    payment_terms: Optional[str] = None
    notes: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class InvoiceCreate(BaseModel):
    project_id: str
    milestone_name: Optional[str] = None
    milestone_description: Optional[str] = None
    milestone_due_date: Optional[str] = None
    estimated_hours: float
    estimated_cost: float
    payment_terms: Optional[str] = None
    notes: Optional[str] = None

class Reimbursement(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    amount: float
    description: str
    receipt: Optional[Dict[str, str]] = None  # {filename, content_type, data}
    status: str = "pending"  # pending, approved, rejected, paid
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[str] = None
    comments: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class ReimbursementCreate(BaseModel):
    amount: float
    description: str
    receipt: Optional[Dict[str, str]] = None

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

# ============ EMAIL HELPER ============

async def send_email_notification(recipient_email: str, subject: str, html_content: str):
    """Send email notification asynchronously"""
    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not configured, skipping email")
        return
    
    try:
        params = {
            "from": SENDER_EMAIL,
            "to": [recipient_email],
            "subject": subject,
            "html": html_content
        }
        await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Email sent to {recipient_email}")
    except Exception as e:
        logger.error(f"Failed to send email to {recipient_email}: {str(e)}")

def create_approval_email(user_name: str, item_type: str, status: str, comments: str = None):
    """Create HTML email for approval/rejection"""
    status_color = "#22c55e" if status == "approved" else "#ef4444"
    status_text = status.capitalize()
    
    html = f"""
    <html>
        <body style="font-family: Arial, sans-serif; padding: 20px; background-color: #f9fafb;">
            <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <h2 style="color: #1e40af; margin-bottom: 20px;">Project Management System</h2>
                <p style="font-size: 16px; color: #374151;">Hello {user_name},</p>
                <p style="font-size: 16px; color: #374151;">Your {item_type} has been <strong style="color: {status_color};">{status_text}</strong>.</p>
                {f'<div style="background-color: #fef3c7; padding: 15px; border-radius: 6px; margin: 20px 0;"><p style="margin: 0; color: #92400e;"><strong>Manager Comments:</strong><br>{comments}</p></div>' if comments else ''}
                <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">Login to your dashboard to view details.</p>
            </div>
        </body>
    </html>
    """
    return html

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
async def update_user(user_id: str, updates: dict, current_user: dict = Depends(require_role(["admin", "manager"]))):
    if "password" in updates:
        updates["password"] = get_password_hash(updates["password"])
    
    # Manager can only update leave_balance, admin can update everything
    if current_user["role"] == "manager":
        allowed_fields = ["leave_balance"]
        updates = {k: v for k, v in updates.items() if k in allowed_fields}
    
    result = await db.users.update_one({"id": user_id}, {"$set": updates})
    if result.modified_count == 0 and result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    updated_user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    return updated_user

@api_router.get("/users/{user_id}")
async def get_user(user_id: str, current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(require_role(["admin"]))):
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted successfully"}

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

@api_router.delete("/projects/{project_id}")
async def delete_project(project_id: str, current_user: dict = Depends(require_role(["admin", "manager"]))):
    result = await db.projects.delete_one({"id": project_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"message": "Project deleted successfully"}

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
    timesheet = await db.timesheets.find_one({"id": timesheet_id}, {"_id": 0})
    if not timesheet:
        raise HTTPException(status_code=404, detail="Timesheet not found")
    
    updates = {
        "status": "approved",
        "reviewed_by": current_user["id"],
        "reviewed_at": datetime.now(timezone.utc).isoformat(),
        "comments": comments
    }
    await db.timesheets.update_one({"id": timesheet_id}, {"$set": updates})
    
    # Send email notification
    user = await db.users.find_one({"id": timesheet["user_id"]}, {"_id": 0})
    if user:
        email_html = create_approval_email(user["name"], "timesheet", "approved", comments)
        await send_email_notification(user["email"], "Timesheet Approved", email_html)
    
    updated = await db.timesheets.find_one({"id": timesheet_id}, {"_id": 0})
    return updated

@api_router.post("/timesheets/{timesheet_id}/reject")
async def reject_timesheet(timesheet_id: str, comments: str, current_user: dict = Depends(require_role(["admin", "manager"]))):
    timesheet = await db.timesheets.find_one({"id": timesheet_id}, {"_id": 0})
    if not timesheet:
        raise HTTPException(status_code=404, detail="Timesheet not found")
    
    updates = {
        "status": "rejected",
        "reviewed_by": current_user["id"],
        "reviewed_at": datetime.now(timezone.utc).isoformat(),
        "comments": comments
    }
    await db.timesheets.update_one({"id": timesheet_id}, {"$set": updates})
    
    # Send email notification
    user = await db.users.find_one({"id": timesheet["user_id"]}, {"_id": 0})
    if user:
        email_html = create_approval_email(user["name"], "timesheet", "rejected", comments)
        await send_email_notification(user["email"], "Timesheet Rejected", email_html)
    
    updated = await db.timesheets.find_one({"id": timesheet_id}, {"_id": 0})
    return updated

@api_router.delete("/timesheets/{timesheet_id}")
async def delete_timesheet(timesheet_id: str, current_user: dict = Depends(get_current_user)):
    timesheet = await db.timesheets.find_one({"id": timesheet_id}, {"_id": 0})
    if not timesheet:
        raise HTTPException(status_code=404, detail="Timesheet not found")
    
    # Only allow deletion of own draft timesheets
    if timesheet["user_id"] != current_user["id"] or timesheet["status"] != "draft":
        raise HTTPException(status_code=403, detail="Cannot delete this timesheet")
    
    result = await db.timesheets.delete_one({"id": timesheet_id})
    return {"message": "Timesheet deleted successfully"}

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
async def approve_leave(leave_id: str, comments: Optional[str] = Form(None), current_user: dict = Depends(require_role(["admin", "manager"]))):
    try:
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
        result = await db.leaves.update_one({"id": leave_id}, {"$set": updates})
        
        if result.modified_count == 0:
            raise HTTPException(status_code=500, detail="Failed to update leave")
        
        # Send email notification
        user = await db.users.find_one({"id": leave["user_id"]}, {"_id": 0})
        if user:
            email_html = create_approval_email(user["name"], "leave request", "approved", comments)
            await send_email_notification(user["email"], "Leave Request Approved", email_html)
        
        updated = await db.leaves.find_one({"id": leave_id}, {"_id": 0})
        return {"status": "success", "data": updated, "message": "Leave approved successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error approving leave: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to approve leave: {str(e)}")

@api_router.post("/leaves/{leave_id}/reject")
async def reject_leave(leave_id: str, comments: str = Form(...), current_user: dict = Depends(require_role(["admin", "manager"]))):
    try:
        leave = await db.leaves.find_one({"id": leave_id}, {"_id": 0})
        if not leave:
            raise HTTPException(status_code=404, detail="Leave not found")
        
        updates = {
            "status": "rejected",
            "reviewed_by": current_user["id"],
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
            "comments": comments
        }
        result = await db.leaves.update_one({"id": leave_id}, {"$set": updates})
        
        if result.modified_count == 0:
            raise HTTPException(status_code=500, detail="Failed to update leave")
        
        # Send email notification
        user = await db.users.find_one({"id": leave["user_id"]}, {"_id": 0})
        if user:
            email_html = create_approval_email(user["name"], "leave request", "rejected", comments)
            await send_email_notification(user["email"], "Leave Request Rejected", email_html)
        
        updated = await db.leaves.find_one({"id": leave_id}, {"_id": 0})
        return {"status": "success", "data": updated, "message": "Leave rejected successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error rejecting leave: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to reject leave: {str(e)}")

@api_router.delete("/leaves/{leave_id}")
async def delete_leave(leave_id: str, current_user: dict = Depends(get_current_user)):
    leave = await db.leaves.find_one({"id": leave_id}, {"_id": 0})
    if not leave:
        raise HTTPException(status_code=404, detail="Leave not found")
    
    # Only allow deletion of own pending leaves
    if leave["user_id"] != current_user["id"] or leave["status"] != "pending":
        raise HTTPException(status_code=403, detail="Cannot delete this leave")
    
    result = await db.leaves.delete_one({"id": leave_id})
    return {"message": "Leave deleted successfully"}

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

@api_router.delete("/invoices/{invoice_id}")
async def delete_invoice(invoice_id: str, current_user: dict = Depends(require_role(["admin", "manager"]))):
    result = await db.invoices.delete_one({"id": invoice_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return {"message": "Invoice deleted successfully"}

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

@api_router.post("/reimbursements/with-file")
async def create_reimbursement_with_file(
    amount: float = Form(...),
    description: str = Form(...),
    file: Optional[UploadFile] = File(None),
    current_user: dict = Depends(get_current_user)
):
    receipt_data = None
    if file:
        # Read and encode file
        content = await file.read()
        receipt_data = {
            "filename": file.filename,
            "content_type": file.content_type,
            "data": base64.b64encode(content).decode('utf-8')
        }
    
    reimbursement = Reimbursement(
        user_id=current_user["id"],
        amount=amount,
        description=description,
        receipt=receipt_data
    )
    await db.reimbursements.insert_one(reimbursement.model_dump())
    return reimbursement.model_dump()

@api_router.post("/reimbursements/{reimbursement_id}/approve")
async def approve_reimbursement(reimbursement_id: str, comments: Optional[str] = Form(None), current_user: dict = Depends(require_role(["admin", "manager"]))):
    try:
        reimbursement = await db.reimbursements.find_one({"id": reimbursement_id}, {"_id": 0})
        if not reimbursement:
            raise HTTPException(status_code=404, detail="Reimbursement not found")
        
        updates = {
            "status": "approved",
            "reviewed_by": current_user["id"],
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
            "comments": comments
        }
        result = await db.reimbursements.update_one({"id": reimbursement_id}, {"$set": updates})
        
        if result.modified_count == 0:
            raise HTTPException(status_code=500, detail="Failed to update reimbursement")
        
        # Send email notification
        user = await db.users.find_one({"id": reimbursement["user_id"]}, {"_id": 0})
        if user:
            email_html = create_approval_email(user["name"], "reimbursement", "approved", comments)
            await send_email_notification(user["email"], "Reimbursement Approved", email_html)
        
        updated = await db.reimbursements.find_one({"id": reimbursement_id}, {"_id": 0})
        return {"status": "success", "data": updated, "message": "Reimbursement approved successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error approving reimbursement: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to approve reimbursement: {str(e)}")

@api_router.post("/reimbursements/{reimbursement_id}/reject")
async def reject_reimbursement(reimbursement_id: str, comments: str = Form(...), current_user: dict = Depends(require_role(["admin", "manager"]))):
    try:
        reimbursement = await db.reimbursements.find_one({"id": reimbursement_id}, {"_id": 0})
        if not reimbursement:
            raise HTTPException(status_code=404, detail="Reimbursement not found")
        
        updates = {
            "status": "rejected",
            "reviewed_by": current_user["id"],
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
            "comments": comments
        }
        result = await db.reimbursements.update_one({"id": reimbursement_id}, {"$set": updates})
        
        if result.modified_count == 0:
            raise HTTPException(status_code=500, detail="Failed to update reimbursement")
        
        # Send email notification
        user = await db.users.find_one({"id": reimbursement["user_id"]}, {"_id": 0})
        if user:
            email_html = create_approval_email(user["name"], "reimbursement", "rejected", comments)
            await send_email_notification(user["email"], "Reimbursement Rejected", email_html)
        
        updated = await db.reimbursements.find_one({"id": reimbursement_id}, {"_id": 0})
        return {"status": "success", "data": updated, "message": "Reimbursement rejected successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error rejecting reimbursement: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to reject reimbursement: {str(e)}")

@api_router.get("/reimbursements/{reimbursement_id}/download")
async def download_reimbursement_receipt(reimbursement_id: str, current_user: dict = Depends(get_current_user)):
    try:
        reimbursement = await db.reimbursements.find_one({"id": reimbursement_id}, {"_id": 0})
        if not reimbursement:
            raise HTTPException(status_code=404, detail="Reimbursement not found")
        
        if not reimbursement.get("receipt"):
            raise HTTPException(status_code=404, detail="No receipt attached")
        
        receipt = reimbursement["receipt"]
        content = base64.b64decode(receipt["data"])
        
        return StreamingResponse(
            io.BytesIO(content),
            media_type=receipt["content_type"],
            headers={"Content-Disposition": f"attachment; filename={receipt['filename']}"}
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading receipt: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to download receipt")

@api_router.delete("/reimbursements/{reimbursement_id}")
async def delete_reimbursement(reimbursement_id: str, current_user: dict = Depends(get_current_user)):
    reimbursement = await db.reimbursements.find_one({"id": reimbursement_id}, {"_id": 0})
    if not reimbursement:
        raise HTTPException(status_code=404, detail="Reimbursement not found")
    
    # Only allow deletion of own pending reimbursements
    if reimbursement["user_id"] != current_user["id"] or reimbursement["status"] != "pending":
        raise HTTPException(status_code=403, detail="Cannot delete this reimbursement")
    
    result = await db.reimbursements.delete_one({"id": reimbursement_id})
    return {"message": "Reimbursement deleted successfully"}

# ============ REPORTS ROUTES ============

@api_router.get("/reports/timesheet-summary")
async def get_timesheet_summary(current_user: dict = Depends(require_role(["admin", "manager"]))):
    try:
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
    except Exception as e:
        logger.error(f"Error fetching timesheet summary: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch reports: {str(e)}")

@api_router.get("/reports/project-hours")
async def get_project_hours(current_user: dict = Depends(require_role(["admin", "manager"]))):
    try:
        timesheets = await db.timesheets.find({"status": "approved"}, {"_id": 0}).to_list(1000)
        
        # Calculate hours by project
        project_hours = {}
        for ts in timesheets:
            for entry in ts["entries"]:
                project_code = entry.get("project_code", "")
                if project_code:
                    if project_code not in project_hours:
                        project_hours[project_code] = 0
                    # Sum all daily hours - convert to float to handle string values
                    daily_hours = sum([
                        float(entry.get("mon", 0) or 0),
                        float(entry.get("tue", 0) or 0),
                        float(entry.get("wed", 0) or 0),
                        float(entry.get("thu", 0) or 0),
                        float(entry.get("fri", 0) or 0)
                    ])
                    project_hours[project_code] += daily_hours
        
        return project_hours
    except Exception as e:
        logger.error(f"Error fetching project hours: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch reports: {str(e)}")

# ============ CSV EXPORT ROUTES ============

@api_router.get("/reports/export/timesheets")
async def export_timesheets_csv(current_user: dict = Depends(require_role(["admin", "manager"]))):
    timesheets = await db.timesheets.find({"status": "approved"}, {"_id": 0}).to_list(1000)
    users = await db.users.find({}, {"_id": 0}).to_list(1000)
    user_map = {u["id"]: u for u in users}
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Employee", "Week Start", "Total Hours", "Status", "Submitted At"])
    
    for ts in timesheets:
        user = user_map.get(ts["user_id"], {})
        writer.writerow([
            user.get("name", "Unknown"),
            ts["week_start"],
            ts["total_hours"],
            ts["status"],
            ts.get("submitted_at", "")
        ])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=timesheets.csv"}
    )

@api_router.get("/reports/export/leaves")
async def export_leaves_csv(current_user: dict = Depends(require_role(["admin", "manager"]))):
    leaves = await db.leaves.find({}, {"_id": 0}).to_list(1000)
    users = await db.users.find({}, {"_id": 0}).to_list(1000)
    user_map = {u["id"]: u for u in users}
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Employee", "Start Date", "End Date", "Days", "Status", "Reason"])
    
    for leave in leaves:
        user = user_map.get(leave["user_id"], {})
        writer.writerow([
            user.get("name", "Unknown"),
            leave["start_date"],
            leave["end_date"],
            leave["days"],
            leave["status"],
            leave["reason"]
        ])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=leaves.csv"}
    )

# ============ FILE UPLOAD ROUTES ============

@api_router.post("/upload/user/{user_id}/document")
async def upload_user_document(
    user_id: str,
    file: UploadFile = File(...),
    document_type: str = Form(...),
    current_user: dict = Depends(require_role(["admin"]))
):
    # Read file content
    content = await file.read()
    encoded_content = base64.b64encode(content).decode('utf-8')
    
    # Create document entry
    document = {
        "type": document_type,
        "filename": file.filename,
        "content_type": file.content_type,
        "data": encoded_content,
        "uploaded_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Update user documents
    await db.users.update_one(
        {"id": user_id},
        {"$push": {"documents": document}}
    )
    
    return {"message": "Document uploaded successfully", "filename": file.filename}

@api_router.post("/upload/project/{project_id}/document")
async def upload_project_document(
    project_id: str,
    file: UploadFile = File(...),
    document_type: str = Form(...),
    current_user: dict = Depends(require_role(["admin", "manager"]))
):
    # Read file content
    content = await file.read()
    encoded_content = base64.b64encode(content).decode('utf-8')
    
    # Create document entry
    document = {
        "type": document_type,
        "filename": file.filename,
        "content_type": file.content_type,
        "data": encoded_content,
        "uploaded_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Update project documents
    await db.projects.update_one(
        {"id": project_id},
        {"$push": {"documents": document}}
    )
    
    return {"message": "Document uploaded successfully", "filename": file.filename}

@api_router.get("/download/document/{entity_type}/{entity_id}/{doc_index}")
async def download_document(
    entity_type: str,
    entity_id: str,
    doc_index: int,
    current_user: dict = Depends(get_current_user)
):
    collection = db.users if entity_type == "user" else db.projects
    entity = await collection.find_one({"id": entity_id}, {"_id": 0})
    
    if not entity or not entity.get("documents") or doc_index >= len(entity["documents"]):
        raise HTTPException(status_code=404, detail="Document not found")
    
    document = entity["documents"][doc_index]
    content = base64.b64decode(document["data"])
    
    return StreamingResponse(
        io.BytesIO(content),
        media_type=document["content_type"],
        headers={"Content-Disposition": f"attachment; filename={document['filename']}"}
    )

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