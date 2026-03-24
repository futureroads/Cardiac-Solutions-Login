"""
Backend API Tests for Cardiac Solutions Admin User Management Feature
Tests: Authentication, Admin CRUD operations, Role-based access control
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_USERNAME = "futureroads"
ADMIN_PASSWORD = "@@U1s9m6c7@@"
REGULAR_USERNAME = "Lew"
REGULAR_PASSWORD = "Lew123"


class TestHealthCheck:
    """Basic health check tests"""
    
    def test_api_health(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("✓ API health check passed")


class TestAuthentication:
    """Authentication endpoint tests"""
    
    def test_admin_login_success(self):
        """Test admin login with correct credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        
        # Verify token structure
        assert "access_token" in data
        assert "token_type" in data
        assert data["token_type"] == "bearer"
        
        # Verify user data
        assert "user" in data
        user = data["user"]
        assert user["id"] == "user-admin-001"
        assert user["username"] == "futureroads"
        assert user["role"] == "admin"
        assert "user_access" in user["allowed_modules"]
        assert len(user["allowed_modules"]) == 6  # 5 regular + user_access
        print("✓ Admin login successful with correct user data")
    
    def test_regular_user_login_success(self):
        """Test regular user login with correct credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": REGULAR_USERNAME,
            "password": REGULAR_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        
        # Verify user data
        user = data["user"]
        assert user["username"] == "Lew"
        assert user["role"] == "user"
        assert "user_access" not in user["allowed_modules"]
        assert len(user["allowed_modules"]) == 5  # 5 regular modules only
        print("✓ Regular user login successful - no user_access module")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "wronguser",
            "password": "wrongpass"
        })
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        print("✓ Invalid credentials correctly rejected")
    
    def test_login_wrong_password(self):
        """Test login with correct username but wrong password"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": ADMIN_USERNAME,
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✓ Wrong password correctly rejected")


class TestAdminUserManagement:
    """Admin user CRUD operations tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        self.admin_token = response.json()["access_token"]
        self.admin_headers = {
            "Authorization": f"Bearer {self.admin_token}",
            "Content-Type": "application/json"
        }
    
    def test_list_users(self):
        """Test GET /api/admin/users returns all seeded users"""
        response = requests.get(f"{BASE_URL}/api/admin/users", headers=self.admin_headers)
        assert response.status_code == 200
        users = response.json()
        
        # Should have at least 7 seeded users
        assert len(users) >= 7
        
        # Verify admin user is in list
        admin_user = next((u for u in users if u["id"] == "user-admin-001"), None)
        assert admin_user is not None
        assert admin_user["username"] == "futureroads"
        assert admin_user["role"] == "admin"
        
        # Verify regular user is in list
        lew_user = next((u for u in users if u["username"] == "Lew"), None)
        assert lew_user is not None
        assert lew_user["role"] == "user"
        
        print(f"✓ List users returned {len(users)} users including admin and regular users")
    
    def test_get_modules(self):
        """Test GET /api/admin/modules returns available modules"""
        response = requests.get(f"{BASE_URL}/api/admin/modules", headers=self.admin_headers)
        assert response.status_code == 200
        modules = response.json()
        
        assert len(modules) == 5
        module_ids = [m["id"] for m in modules]
        assert "daily_report" in module_ids
        assert "notifications" in module_ids
        assert "service_tickets" in module_ids
        assert "dashboard" in module_ids
        assert "survival_path" in module_ids
        print("✓ Get modules returned 5 available modules")
    
    def test_create_user(self):
        """Test POST /api/admin/users creates a new user"""
        test_username = f"TEST_user_{uuid.uuid4().hex[:6]}"
        
        response = requests.post(f"{BASE_URL}/api/admin/users", headers=self.admin_headers, json={
            "username": test_username,
            "password": "TestPass123",
            "email": "test@example.com",
            "phone": "555-0100",
            "role": "user",
            "allowed_modules": ["daily_report", "dashboard"]
        })
        assert response.status_code == 200
        data = response.json()
        
        # Verify created user data
        assert data["username"] == test_username
        assert data["email"] == "test@example.com"
        assert data["phone"] == "555-0100"
        assert data["role"] == "user"
        assert "daily_report" in data["allowed_modules"]
        assert "dashboard" in data["allowed_modules"]
        assert "id" in data
        
        # Verify user can login
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": test_username,
            "password": "TestPass123"
        })
        assert login_response.status_code == 200
        
        # Cleanup - delete the test user
        delete_response = requests.delete(
            f"{BASE_URL}/api/admin/users/{data['id']}", 
            headers=self.admin_headers
        )
        assert delete_response.status_code == 200
        
        print(f"✓ Created user {test_username}, verified login, and cleaned up")
    
    def test_create_user_duplicate_username(self):
        """Test creating user with existing username fails"""
        response = requests.post(f"{BASE_URL}/api/admin/users", headers=self.admin_headers, json={
            "username": "Lew",  # Already exists
            "password": "TestPass123",
            "email": "duplicate@example.com",
            "role": "user",
            "allowed_modules": []
        })
        assert response.status_code == 400
        data = response.json()
        assert "already exists" in data["detail"].lower()
        print("✓ Duplicate username correctly rejected")
    
    def test_update_user(self):
        """Test PUT /api/admin/users/{id} updates user"""
        # First create a test user
        test_username = f"TEST_update_{uuid.uuid4().hex[:6]}"
        create_response = requests.post(f"{BASE_URL}/api/admin/users", headers=self.admin_headers, json={
            "username": test_username,
            "password": "TestPass123",
            "email": "original@example.com",
            "role": "user",
            "allowed_modules": ["daily_report"]
        })
        assert create_response.status_code == 200
        user_id = create_response.json()["id"]
        
        # Update the user
        update_response = requests.put(
            f"{BASE_URL}/api/admin/users/{user_id}",
            headers=self.admin_headers,
            json={
                "email": "updated@example.com",
                "phone": "555-9999",
                "allowed_modules": ["daily_report", "dashboard", "notifications"]
            }
        )
        assert update_response.status_code == 200
        updated_data = update_response.json()
        
        assert updated_data["email"] == "updated@example.com"
        assert updated_data["phone"] == "555-9999"
        assert len(updated_data["allowed_modules"]) == 3
        
        # Verify with GET
        get_response = requests.get(f"{BASE_URL}/api/admin/users", headers=self.admin_headers)
        users = get_response.json()
        updated_user = next((u for u in users if u["id"] == user_id), None)
        assert updated_user["email"] == "updated@example.com"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/admin/users/{user_id}", headers=self.admin_headers)
        print("✓ User update successful and verified")
    
    def test_update_user_password(self):
        """Test updating user password works"""
        # Create test user
        test_username = f"TEST_pwd_{uuid.uuid4().hex[:6]}"
        create_response = requests.post(f"{BASE_URL}/api/admin/users", headers=self.admin_headers, json={
            "username": test_username,
            "password": "OldPass123",
            "role": "user",
            "allowed_modules": []
        })
        user_id = create_response.json()["id"]
        
        # Update password
        update_response = requests.put(
            f"{BASE_URL}/api/admin/users/{user_id}",
            headers=self.admin_headers,
            json={"password": "NewPass456"}
        )
        assert update_response.status_code == 200
        
        # Verify old password no longer works
        old_login = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": test_username,
            "password": "OldPass123"
        })
        assert old_login.status_code == 401
        
        # Verify new password works
        new_login = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": test_username,
            "password": "NewPass456"
        })
        assert new_login.status_code == 200
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/admin/users/{user_id}", headers=self.admin_headers)
        print("✓ Password update successful")
    
    def test_delete_user(self):
        """Test DELETE /api/admin/users/{id} removes user"""
        # Create test user
        test_username = f"TEST_delete_{uuid.uuid4().hex[:6]}"
        create_response = requests.post(f"{BASE_URL}/api/admin/users", headers=self.admin_headers, json={
            "username": test_username,
            "password": "TestPass123",
            "role": "user",
            "allowed_modules": []
        })
        user_id = create_response.json()["id"]
        
        # Delete the user
        delete_response = requests.delete(
            f"{BASE_URL}/api/admin/users/{user_id}",
            headers=self.admin_headers
        )
        assert delete_response.status_code == 200
        data = delete_response.json()
        assert data["status"] == "deleted"
        
        # Verify user no longer exists
        get_response = requests.get(f"{BASE_URL}/api/admin/users", headers=self.admin_headers)
        users = get_response.json()
        deleted_user = next((u for u in users if u["id"] == user_id), None)
        assert deleted_user is None
        
        # Verify user can no longer login
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": test_username,
            "password": "TestPass123"
        })
        assert login_response.status_code == 401
        
        print("✓ User deletion successful and verified")
    
    def test_cannot_delete_admin(self):
        """Test that system admin cannot be deleted"""
        response = requests.delete(
            f"{BASE_URL}/api/admin/users/user-admin-001",
            headers=self.admin_headers
        )
        assert response.status_code == 400
        data = response.json()
        assert "cannot delete" in data["detail"].lower() or "system admin" in data["detail"].lower()
        print("✓ System admin deletion correctly prevented")
    
    def test_delete_nonexistent_user(self):
        """Test deleting non-existent user returns 404"""
        response = requests.delete(
            f"{BASE_URL}/api/admin/users/nonexistent-user-id",
            headers=self.admin_headers
        )
        assert response.status_code == 404
        print("✓ Delete non-existent user returns 404")


class TestRoleBasedAccess:
    """Role-based access control tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get tokens for both admin and regular user"""
        # Admin token
        admin_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        self.admin_token = admin_response.json()["access_token"]
        self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Regular user token
        user_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": REGULAR_USERNAME,
            "password": REGULAR_PASSWORD
        })
        self.user_token = user_response.json()["access_token"]
        self.user_headers = {"Authorization": f"Bearer {self.user_token}"}
    
    def test_regular_user_cannot_list_users(self):
        """Test regular user cannot access admin/users endpoint"""
        response = requests.get(f"{BASE_URL}/api/admin/users", headers=self.user_headers)
        assert response.status_code == 403
        data = response.json()
        assert "admin" in data["detail"].lower()
        print("✓ Regular user correctly denied access to list users")
    
    def test_regular_user_cannot_create_user(self):
        """Test regular user cannot create users"""
        response = requests.post(f"{BASE_URL}/api/admin/users", headers=self.user_headers, json={
            "username": "hacker_user",
            "password": "HackPass123",
            "role": "admin",
            "allowed_modules": []
        })
        assert response.status_code == 403
        print("✓ Regular user correctly denied access to create users")
    
    def test_regular_user_cannot_delete_user(self):
        """Test regular user cannot delete users"""
        response = requests.delete(
            f"{BASE_URL}/api/admin/users/user-lew-001",
            headers=self.user_headers
        )
        assert response.status_code == 403
        print("✓ Regular user correctly denied access to delete users")
    
    def test_regular_user_cannot_get_modules(self):
        """Test regular user cannot access admin/modules endpoint"""
        response = requests.get(f"{BASE_URL}/api/admin/modules", headers=self.user_headers)
        assert response.status_code == 403
        print("✓ Regular user correctly denied access to modules list")
    
    def test_unauthenticated_cannot_access_admin(self):
        """Test unauthenticated requests cannot access admin endpoints"""
        response = requests.get(f"{BASE_URL}/api/admin/users")
        assert response.status_code in [401, 403]
        print("✓ Unauthenticated request correctly denied")


class TestUserModuleAccess:
    """Tests for user module access filtering"""
    
    def test_admin_has_user_access_module(self):
        """Test admin user has user_access in allowed_modules"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        user = response.json()["user"]
        assert "user_access" in user["allowed_modules"]
        print("✓ Admin has user_access module")
    
    def test_regular_user_no_user_access_module(self):
        """Test regular user does NOT have user_access in allowed_modules"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": REGULAR_USERNAME,
            "password": REGULAR_PASSWORD
        })
        user = response.json()["user"]
        assert "user_access" not in user["allowed_modules"]
        print("✓ Regular user does not have user_access module")
    
    def test_all_seeded_users_have_correct_modules(self):
        """Test all seeded users have correct module assignments"""
        # Login as admin to get user list
        admin_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        admin_token = admin_response.json()["access_token"]
        
        users_response = requests.get(
            f"{BASE_URL}/api/admin/users",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        users = users_response.json()
        
        for user in users:
            if user["role"] == "admin":
                assert "user_access" in user["allowed_modules"], f"Admin {user['username']} missing user_access"
            else:
                # Regular users should have 5 modules (not user_access)
                assert "user_access" not in user["allowed_modules"], f"Regular user {user['username']} has user_access"
        
        print("✓ All seeded users have correct module assignments")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
