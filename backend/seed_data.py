import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from datetime import datetime, timezone
import uuid

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def seed_database():
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'test_database')
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # Clear existing data
    await db.users.delete_many({})
    await db.projects.delete_many({})
    
    print("Creating demo users...")
    
    # Create users
    admin_id = str(uuid.uuid4())
    manager_id = str(uuid.uuid4())
    employee_id = str(uuid.uuid4())
    
    users = [
        {
            "id": admin_id,
            "email": "admin@company.com",
            "password": pwd_context.hash("admin123"),
            "name": "Admin User",
            "role": "admin",
            "date_of_joining": "2020-01-15",
            "date_of_birth": "1985-05-20",
            "designation": "System Administrator",
            "practice": "IT Operations",
            "reporting_manager_id": None,
            "leave_balance": 20.0,
            "documents": [],
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": manager_id,
            "email": "manager@company.com",
            "password": pwd_context.hash("manager123"),
            "name": "Manager User",
            "role": "manager",
            "date_of_joining": "2021-03-10",
            "date_of_birth": "1988-08-15",
            "designation": "Project Manager",
            "practice": "Consulting",
            "reporting_manager_id": admin_id,
            "leave_balance": 18.0,
            "documents": [],
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": employee_id,
            "email": "employee@company.com",
            "password": pwd_context.hash("employee123"),
            "name": "Employee User",
            "role": "employee",
            "date_of_joining": "2023-06-01",
            "date_of_birth": "1995-11-25",
            "designation": "Software Developer",
            "practice": "Engineering",
            "reporting_manager_id": manager_id,
            "leave_balance": 20.0,
            "documents": [],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    await db.users.insert_many(users)
    print(f"✓ Created {len(users)} demo users")
    
    # Create demo projects
    projects = [
        {
            "id": str(uuid.uuid4()),
            "project_code": "PROJ-2025-001",
            "description": "Internal Operations Platform Development",
            "project_manager_id": manager_id,
            "estimated_hours": 500.0,
            "sub_codes": [
                {"code": "PROJ-2025-001-UI", "description": "Frontend Development"},
                {"code": "PROJ-2025-001-API", "description": "Backend API"}
            ],
            "team_members": [employee_id],
            "documents": [],
            "milestones": [],
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "project_code": "CLIENT-2025-002",
            "description": "Client Portal Integration",
            "project_manager_id": manager_id,
            "estimated_hours": 300.0,
            "sub_codes": [],
            "team_members": [employee_id],
            "documents": [],
            "milestones": [],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    await db.projects.insert_many(projects)
    print(f"✓ Created {len(projects)} demo projects")
    
    print("\n=== Demo Credentials ===")
    print("Admin: admin@company.com / admin123")
    print("Manager: manager@company.com / manager123")
    print("Employee: employee@company.com / employee123")
    print("========================\n")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(seed_database())
