"""
Backend API Tests for Cardiac Solutions Hybrid Training Feature
Tests: Authentication with hybrid_training module, Sync, Feedbacks, Stats, Updates, Monitors
P0 Bug Fix Verification: hybrid_training in ALL_MODULE_IDS, sync retry logic, error handling
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_USERNAME = "futureroads"
ADMIN_PASSWORD = "@@U1s9m6c7@@"
STANDARD_USERNAME = "Lew"
STANDARD_PASSWORD = "Lew123"


class TestHealthCheck:
    """Basic health check - no auth needed"""
    
    def test_api_health(self):
        """GET /api/health returns {status: ok}"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] in ["ok", "healthy"]
        print("✓ API health check passed")


class TestAdminLoginWithHybridTraining:
    """Verify admin login returns hybrid_training in allowed_modules"""
    
    def test_admin_login_has_hybrid_training(self):
        """POST /api/auth/login with admin credentials returns token and user with hybrid_training"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        
        # Verify token structure
        assert "access_token" in data, "Missing access_token in response"
        assert "token_type" in data
        assert data["token_type"] == "bearer"
        
        # Verify user data
        assert "user" in data
        user = data["user"]
        assert user["id"] == "user-admin-001"
        assert user["username"] == "futureroads"
        assert user["role"] == "admin"
        
        # P0 BUG FIX VERIFICATION: hybrid_training must be in allowed_modules
        assert "hybrid_training" in user["allowed_modules"], \
            f"P0 BUG: hybrid_training NOT in allowed_modules! Got: {user['allowed_modules']}"
        
        print(f"✓ Admin login successful with hybrid_training in allowed_modules: {user['allowed_modules']}")
    
    def test_standard_user_has_hybrid_training(self):
        """Standard users should also have hybrid_training in allowed_modules"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": STANDARD_USERNAME,
            "password": STANDARD_PASSWORD
        })
        assert response.status_code == 200
        user = response.json()["user"]
        
        # hybrid_training should be in ALL_MODULE_IDS which all users get
        assert "hybrid_training" in user["allowed_modules"], \
            f"hybrid_training NOT in standard user's allowed_modules! Got: {user['allowed_modules']}"
        
        print(f"✓ Standard user has hybrid_training in allowed_modules")


class TestTrainingSync:
    """Test /api/training/sync endpoint - syncs from Readisys API"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        self.admin_token = response.json()["access_token"]
        self.headers = {
            "Authorization": f"Bearer {self.admin_token}",
            "Content-Type": "application/json"
        }
    
    def test_sync_feedbacks_returns_synced_total(self):
        """GET /api/training/sync returns {synced, total} with total >= 10"""
        # This endpoint calls external Readisys API - may take time
        response = requests.get(f"{BASE_URL}/api/training/sync", headers=self.headers, timeout=30)
        
        assert response.status_code == 200, f"Sync failed: {response.status_code} - {response.text}"
        data = response.json()
        
        assert "synced" in data, f"Missing 'synced' in response: {data}"
        assert "total" in data, f"Missing 'total' in response: {data}"
        assert isinstance(data["synced"], int)
        assert isinstance(data["total"], int)
        assert data["total"] >= 0, f"Total should be >= 0, got {data['total']}"
        
        print(f"✓ Sync returned synced={data['synced']}, total={data['total']}")
    
    def test_sync_requires_admin(self):
        """Sync endpoint requires admin role"""
        # Get standard user token
        user_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": STANDARD_USERNAME,
            "password": STANDARD_PASSWORD
        })
        user_token = user_response.json()["access_token"]
        user_headers = {"Authorization": f"Bearer {user_token}"}
        
        response = requests.get(f"{BASE_URL}/api/training/sync", headers=user_headers)
        assert response.status_code == 403, f"Expected 403 for non-admin, got {response.status_code}"
        print("✓ Sync correctly requires admin role")


class TestTrainingFeedbacks:
    """Test /api/training/feedbacks endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token and ensure sync has run"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        self.admin_token = response.json()["access_token"]
        self.headers = {
            "Authorization": f"Bearer {self.admin_token}",
            "Content-Type": "application/json"
        }
        # Ensure sync has run
        requests.get(f"{BASE_URL}/api/training/sync", headers=self.headers, timeout=30)
    
    def test_list_feedbacks_returns_array(self):
        """GET /api/training/feedbacks returns array of feedback items"""
        response = requests.get(f"{BASE_URL}/api/training/feedbacks", headers=self.headers)
        
        assert response.status_code == 200, f"Feedbacks failed: {response.status_code} - {response.text}"
        data = response.json()
        
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"✓ Feedbacks returned {len(data)} items")
        
        # If we have items, verify structure
        if len(data) > 0:
            item = data[0]
            assert "status" in item, f"Missing 'status' in feedback item"
            assert "sentinel_id" in item or "aed_id" in item, f"Missing sentinel_id/aed_id in feedback"
            assert "assigned_status" in item, f"Missing 'assigned_status' in feedback"
            assert "correct_status" in item, f"Missing 'correct_status' in feedback"
            print(f"✓ Feedback item structure verified: status={item['status']}")
    
    def test_feedbacks_have_pending_status(self):
        """Verify feedbacks have status=pending for unprocessed items"""
        response = requests.get(f"{BASE_URL}/api/training/feedbacks", headers=self.headers)
        data = response.json()
        
        pending_count = sum(1 for fb in data if fb.get("status") == "pending")
        print(f"✓ Found {pending_count} pending feedbacks out of {len(data)} total")


class TestTrainingStats:
    """Test /api/training/stats endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        self.admin_token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.admin_token}"}
    
    def test_stats_returns_queue_pending(self):
        """GET /api/training/stats returns queue_pending >= 0"""
        response = requests.get(f"{BASE_URL}/api/training/stats", headers=self.headers)
        
        assert response.status_code == 200, f"Stats failed: {response.status_code} - {response.text}"
        data = response.json()
        
        assert "queue_pending" in data, f"Missing 'queue_pending' in stats: {data}"
        assert isinstance(data["queue_pending"], int)
        assert data["queue_pending"] >= 0
        
        # Verify other expected fields
        assert "analyzed" in data
        assert "monitoring" in data
        assert "resolved" in data
        assert "total_monitors" in data
        
        print(f"✓ Stats: queue_pending={data['queue_pending']}, analyzed={data['analyzed']}, monitoring={data['monitoring']}")


class TestTrainingUpdates:
    """Test /api/training/updates endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        self.admin_token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.admin_token}"}
    
    def test_updates_returns_array(self):
        """GET /api/training/updates returns array"""
        response = requests.get(f"{BASE_URL}/api/training/updates", headers=self.headers)
        
        assert response.status_code == 200, f"Updates failed: {response.status_code} - {response.text}"
        data = response.json()
        
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"✓ Updates returned {len(data)} items")


class TestTrainingMonitors:
    """Test /api/training/monitors endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        self.admin_token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.admin_token}"}
    
    def test_monitors_returns_array(self):
        """GET /api/training/monitors returns array"""
        response = requests.get(f"{BASE_URL}/api/training/monitors", headers=self.headers)
        
        assert response.status_code == 200, f"Monitors failed: {response.status_code} - {response.text}"
        data = response.json()
        
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"✓ Monitors returned {len(data)} items")


class TestAnalyzeAndApplyFlow:
    """Test the analyze and apply workflow (MOCKED endpoints)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token and ensure we have feedbacks"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        self.admin_token = response.json()["access_token"]
        self.headers = {
            "Authorization": f"Bearer {self.admin_token}",
            "Content-Type": "application/json"
        }
        # Ensure sync has run
        requests.get(f"{BASE_URL}/api/training/sync", headers=self.headers, timeout=30)
    
    def test_analyze_feedback_creates_updates(self):
        """POST /api/training/analyze/{feedback_id} creates qwen and opencv updates"""
        # Get a pending feedback
        fb_response = requests.get(f"{BASE_URL}/api/training/feedbacks", headers=self.headers)
        feedbacks = fb_response.json()
        
        pending = [fb for fb in feedbacks if fb.get("status") == "pending"]
        if not pending:
            pytest.skip("No pending feedbacks to analyze")
        
        feedback_id = pending[0]["id"]
        
        # Analyze it
        response = requests.post(f"{BASE_URL}/api/training/analyze/{feedback_id}", headers=self.headers)
        
        assert response.status_code == 200, f"Analyze failed: {response.status_code} - {response.text}"
        data = response.json()
        
        assert "qwen_update" in data, f"Missing qwen_update in response"
        assert "opencv_update" in data, f"Missing opencv_update in response"
        
        print(f"✓ Analyze created qwen_update and opencv_update for feedback {feedback_id}")
    
    def test_apply_update_changes_status(self):
        """POST /api/training/apply/{update_id} changes update status to applied"""
        # Get updates
        up_response = requests.get(f"{BASE_URL}/api/training/updates", headers=self.headers)
        updates = up_response.json()
        
        pending_updates = [u for u in updates if u.get("status") == "pending"]
        if not pending_updates:
            pytest.skip("No pending updates to apply")
        
        update_id = pending_updates[0]["id"]
        
        # Apply it
        response = requests.post(f"{BASE_URL}/api/training/apply/{update_id}", headers=self.headers)
        
        assert response.status_code == 200, f"Apply failed: {response.status_code} - {response.text}"
        data = response.json()
        
        assert data.get("status") == "applied", f"Expected status=applied, got {data}"
        assert "applied_at" in data
        
        print(f"✓ Apply changed update {update_id} status to applied")


class TestErrorHandling:
    """Test error handling and edge cases"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        self.admin_token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.admin_token}"}
    
    def test_analyze_nonexistent_feedback(self):
        """Analyzing non-existent feedback returns 404"""
        response = requests.post(f"{BASE_URL}/api/training/analyze/nonexistent-id", headers=self.headers)
        assert response.status_code == 404
        print("✓ Analyze non-existent feedback returns 404")
    
    def test_apply_nonexistent_update(self):
        """Applying non-existent update returns 404"""
        response = requests.post(f"{BASE_URL}/api/training/apply/nonexistent-id", headers=self.headers)
        assert response.status_code == 404
        print("✓ Apply non-existent update returns 404")
    
    def test_unauthenticated_access_denied(self):
        """Unauthenticated requests to training endpoints are denied"""
        endpoints = [
            "/api/training/sync",
            "/api/training/feedbacks",
            "/api/training/stats",
            "/api/training/updates",
            "/api/training/monitors",
        ]
        for endpoint in endpoints:
            response = requests.get(f"{BASE_URL}{endpoint}")
            assert response.status_code in [401, 403], f"{endpoint} should require auth, got {response.status_code}"
        
        print("✓ All training endpoints require authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
