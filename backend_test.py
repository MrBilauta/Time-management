#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime, timedelta

class ProjectManagementAPITester:
    def __init__(self, base_url="https://timeprojects.preview.emergentagent.com"):
        self.base_url = base_url
        self.admin_token = None
        self.manager_token = None
        self.employee_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        
        # Test data
        self.admin_creds = {"email": "admin@company.com", "password": "admin123"}
        self.manager_creds = {"email": "manager@company.com", "password": "manager123"}
        self.employee_creds = {"email": "employee@company.com", "password": "employee123"}
        
        self.test_user_id = None
        self.test_project_id = None
        self.test_timesheet_id = None
        self.test_leave_id = None
        self.test_reimbursement_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, token=None, description=""):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                self.test_results.append({
                    "test": name,
                    "status": "PASS",
                    "expected": expected_status,
                    "actual": response.status_code,
                    "description": description
                })
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}")
                self.test_results.append({
                    "test": name,
                    "status": "FAIL",
                    "expected": expected_status,
                    "actual": response.status_code,
                    "error": response.text[:200],
                    "description": description
                })

            return success, response.json() if response.content and success else {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.test_results.append({
                "test": name,
                "status": "ERROR",
                "error": str(e),
                "description": description
            })
            return False, {}

    def test_authentication(self):
        """Test authentication for all roles"""
        print("\n" + "="*50)
        print("TESTING AUTHENTICATION")
        print("="*50)
        
        # Test admin login
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data=self.admin_creds,
            description="Admin user authentication"
        )
        if success and 'access_token' in response:
            self.admin_token = response['access_token']
            print(f"   Admin token obtained: {self.admin_token[:20]}...")
        
        # Test manager login
        success, response = self.run_test(
            "Manager Login",
            "POST",
            "auth/login",
            200,
            data=self.manager_creds,
            description="Manager user authentication"
        )
        if success and 'access_token' in response:
            self.manager_token = response['access_token']
            print(f"   Manager token obtained: {self.manager_token[:20]}...")
        
        # Test employee login
        success, response = self.run_test(
            "Employee Login",
            "POST",
            "auth/login",
            200,
            data=self.employee_creds,
            description="Employee user authentication"
        )
        if success and 'access_token' in response:
            self.employee_token = response['access_token']
            print(f"   Employee token obtained: {self.employee_token[:20]}...")
        
        # Test invalid login
        self.run_test(
            "Invalid Login",
            "POST",
            "auth/login",
            401,
            data={"email": "invalid@test.com", "password": "wrong"},
            description="Invalid credentials should be rejected"
        )
        
        # Test /auth/me endpoint
        if self.admin_token:
            self.run_test(
                "Get Current User (Admin)",
                "GET",
                "auth/me",
                200,
                token=self.admin_token,
                description="Retrieve current user info"
            )

    def test_user_management(self):
        """Test user management (Admin only)"""
        print("\n" + "="*50)
        print("TESTING USER MANAGEMENT")
        print("="*50)
        
        if not self.admin_token:
            print("❌ Skipping user management tests - no admin token")
            return
        
        # Get all users
        success, response = self.run_test(
            "Get All Users",
            "GET",
            "users",
            200,
            token=self.admin_token,
            description="Admin can view all users"
        )
        
        # Create new user
        new_user_data = {
            "email": f"test_user_{datetime.now().strftime('%H%M%S')}@company.com",
            "password": "TestPass123!",
            "name": "Test User",
            "role": "employee",
            "designation": "Software Developer",
            "practice": "Engineering"
        }
        
        success, response = self.run_test(
            "Create New User",
            "POST",
            "users",
            200,
            data=new_user_data,
            token=self.admin_token,
            description="Admin can create new users"
        )
        
        if success and 'id' in response:
            self.test_user_id = response['id']
            print(f"   Created user ID: {self.test_user_id}")
        
        # Test employee cannot create users
        self.run_test(
            "Employee Cannot Create Users",
            "POST",
            "users",
            403,
            data=new_user_data,
            token=self.employee_token,
            description="Employee should not be able to create users"
        )

    def test_project_management(self):
        """Test project management"""
        print("\n" + "="*50)
        print("TESTING PROJECT MANAGEMENT")
        print("="*50)
        
        if not self.admin_token:
            print("❌ Skipping project management tests - no admin token")
            return
        
        # Get all projects
        self.run_test(
            "Get All Projects (Admin)",
            "GET",
            "projects",
            200,
            token=self.admin_token,
            description="Admin can view all projects"
        )
        
        # Create new project
        project_data = {
            "project_code": f"TEST-{datetime.now().strftime('%H%M%S')}",
            "description": "Test Project for API Testing",
            "project_manager_id": "admin-id",  # This should be a valid manager ID
            "estimated_hours": 160.0
        }
        
        success, response = self.run_test(
            "Create New Project",
            "POST",
            "projects",
            200,
            data=project_data,
            token=self.admin_token,
            description="Admin/Manager can create projects"
        )
        
        if success and 'id' in response:
            self.test_project_id = response['id']
            print(f"   Created project ID: {self.test_project_id}")
        
        # Test employee can view projects
        self.run_test(
            "Employee View Projects",
            "GET",
            "projects",
            200,
            token=self.employee_token,
            description="Employee can view assigned projects"
        )

    def test_timesheet_workflow(self):
        """Test complete timesheet workflow"""
        print("\n" + "="*50)
        print("TESTING TIMESHEET WORKFLOW")
        print("="*50)
        
        if not self.employee_token:
            print("❌ Skipping timesheet tests - no employee token")
            return
        
        # Get current week's Monday
        today = datetime.now()
        monday = today - timedelta(days=today.weekday())
        week_start = monday.strftime('%Y-%m-%d')
        
        # Create timesheet
        timesheet_data = {
            "week_start": week_start,
            "entries": [
                {
                    "project_code": "TEST-001",
                    "description": "Development work",
                    "activity_type": "billable",
                    "mon": 8, "tue": 8, "wed": 8, "thu": 8, "fri": 8
                }
            ],
            "total_hours": 40.0
        }
        
        success, response = self.run_test(
            "Create Timesheet",
            "POST",
            "timesheets",
            200,
            data=timesheet_data,
            token=self.employee_token,
            description="Employee can create timesheet"
        )
        
        if success and 'id' in response:
            self.test_timesheet_id = response['id']
            print(f"   Created timesheet ID: {self.test_timesheet_id}")
            
            # Submit timesheet
            self.run_test(
                "Submit Timesheet",
                "POST",
                f"timesheets/{self.test_timesheet_id}/submit",
                200,
                token=self.employee_token,
                description="Employee can submit timesheet for approval"
            )
            
            # Manager approve timesheet
            if self.manager_token:
                self.run_test(
                    "Approve Timesheet",
                    "POST",
                    f"timesheets/{self.test_timesheet_id}/approve",
                    200,
                    data={"comments": "Approved - good work"},
                    token=self.manager_token,
                    description="Manager can approve timesheets"
                )
        
        # Get timesheets
        self.run_test(
            "Get Employee Timesheets",
            "GET",
            "timesheets",
            200,
            token=self.employee_token,
            description="Employee can view their timesheets"
        )

    def test_leave_management(self):
        """Test leave management workflow"""
        print("\n" + "="*50)
        print("TESTING LEAVE MANAGEMENT")
        print("="*50)
        
        if not self.employee_token:
            print("❌ Skipping leave tests - no employee token")
            return
        
        # Create leave application
        leave_data = {
            "start_date": "2025-02-01",
            "end_date": "2025-02-03",
            "days": 3.0,
            "reason": "Personal leave"
        }
        
        success, response = self.run_test(
            "Apply for Leave",
            "POST",
            "leaves",
            200,
            data=leave_data,
            token=self.employee_token,
            description="Employee can apply for leave"
        )
        
        if success and 'id' in response:
            self.test_leave_id = response['id']
            print(f"   Created leave ID: {self.test_leave_id}")
            
            # Manager approve leave
            if self.manager_token:
                self.run_test(
                    "Approve Leave",
                    "POST",
                    f"leaves/{self.test_leave_id}/approve",
                    200,
                    data={"comments": "Approved"},
                    token=self.manager_token,
                    description="Manager can approve leave applications"
                )
        
        # Get leaves
        self.run_test(
            "Get Employee Leaves",
            "GET",
            "leaves",
            200,
            token=self.employee_token,
            description="Employee can view their leave applications"
        )

    def test_reimbursement_workflow(self):
        """Test reimbursement workflow"""
        print("\n" + "="*50)
        print("TESTING REIMBURSEMENT WORKFLOW")
        print("="*50)
        
        if not self.employee_token:
            print("❌ Skipping reimbursement tests - no employee token")
            return
        
        # Create reimbursement
        reimbursement_data = {
            "amount": 150.50,
            "description": "Travel expenses for client meeting"
        }
        
        success, response = self.run_test(
            "Submit Reimbursement",
            "POST",
            "reimbursements",
            200,
            data=reimbursement_data,
            token=self.employee_token,
            description="Employee can submit reimbursement requests"
        )
        
        if success and 'id' in response:
            self.test_reimbursement_id = response['id']
            print(f"   Created reimbursement ID: {self.test_reimbursement_id}")
            
            # Manager approve reimbursement
            if self.manager_token:
                self.run_test(
                    "Approve Reimbursement",
                    "POST",
                    f"reimbursements/{self.test_reimbursement_id}/approve",
                    200,
                    data={"comments": "Approved - valid expense"},
                    token=self.manager_token,
                    description="Manager can approve reimbursements"
                )

    def test_reports(self):
        """Test reporting functionality"""
        print("\n" + "="*50)
        print("TESTING REPORTS")
        print("="*50)
        
        if not self.admin_token:
            print("❌ Skipping reports tests - no admin token")
            return
        
        # Test timesheet summary report
        self.run_test(
            "Timesheet Summary Report",
            "GET",
            "reports/timesheet-summary",
            200,
            token=self.admin_token,
            description="Admin/Manager can view timesheet summary"
        )
        
        # Test project hours report
        self.run_test(
            "Project Hours Report",
            "GET",
            "reports/project-hours",
            200,
            token=self.admin_token,
            description="Admin/Manager can view project hours report"
        )
        
        # Test employee cannot access reports
        self.run_test(
            "Employee Cannot Access Reports",
            "GET",
            "reports/timesheet-summary",
            403,
            token=self.employee_token,
            description="Employee should not access admin reports"
        )

    def test_role_based_access(self):
        """Test role-based access control"""
        print("\n" + "="*50)
        print("TESTING ROLE-BASED ACCESS CONTROL")
        print("="*50)
        
        # Test admin access to invoices
        if self.admin_token:
            self.run_test(
                "Admin Access Invoices",
                "GET",
                "invoices",
                200,
                token=self.admin_token,
                description="Admin can access invoice management"
            )
        
        # Test employee cannot access invoices
        if self.employee_token:
            self.run_test(
                "Employee Cannot Access Invoices",
                "GET",
                "invoices",
                403,
                token=self.employee_token,
                description="Employee should not access invoices"
            )

    def run_all_tests(self):
        """Run all test suites"""
        print("🚀 Starting Project Management API Tests")
        print(f"Backend URL: {self.base_url}")
        
        try:
            self.test_authentication()
            self.test_user_management()
            self.test_project_management()
            self.test_timesheet_workflow()
            self.test_leave_management()
            self.test_reimbursement_workflow()
            self.test_reports()
            self.test_role_based_access()
            
        except Exception as e:
            print(f"\n❌ Test suite failed with error: {str(e)}")
        
        # Print final results
        print("\n" + "="*60)
        print("FINAL TEST RESULTS")
        print("="*60)
        print(f"📊 Tests passed: {self.tests_passed}/{self.tests_run}")
        print(f"📈 Success rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        # Print failed tests
        failed_tests = [t for t in self.test_results if t['status'] in ['FAIL', 'ERROR']]
        if failed_tests:
            print(f"\n❌ Failed Tests ({len(failed_tests)}):")
            for test in failed_tests:
                print(f"   • {test['test']}: {test.get('error', 'Status mismatch')}")
        
        return self.tests_passed == self.tests_run

def main():
    tester = ProjectManagementAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())