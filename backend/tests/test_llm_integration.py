"""
Test suite for Hybrid Training LLM Integration (Step 2 Analyze)
Tests:
- POST /api/training/analyze/{feedback_id} - Real Gemini LLM call
- POST /api/training/submit-prompts/{feedback_id} - Submit final prompts
- GET /api/training/updates - Verify submitted prompts appear as pending updates
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestLLMIntegration:
    """Test LLM integration for Hybrid Training Step 2"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Get admin token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "username": "futureroads",
            "password": "@@U1s9m6c7@@"
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        token = login_resp.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
    def test_health_check(self):
        """Verify API is accessible"""
        resp = self.session.get(f"{BASE_URL}/api/health")
        assert resp.status_code == 200
        assert resp.json().get("status") == "ok"
        print("✓ Health check passed")
        
    def test_get_feedbacks_list(self):
        """Get list of feedbacks to find a pending one"""
        resp = self.session.get(f"{BASE_URL}/api/training/feedbacks")
        assert resp.status_code == 200
        feedbacks = resp.json()
        assert isinstance(feedbacks, list)
        print(f"✓ Got {len(feedbacks)} feedbacks")
        return feedbacks
        
    def test_analyze_with_real_llm(self):
        """Test POST /api/training/analyze/{feedback_id} with real Gemini LLM"""
        # First get a pending feedback
        feedbacks_resp = self.session.get(f"{BASE_URL}/api/training/feedbacks")
        assert feedbacks_resp.status_code == 200
        feedbacks = feedbacks_resp.json()
        
        # Find a pending feedback
        pending = [f for f in feedbacks if f.get("status") == "pending"]
        if not pending:
            pytest.skip("No pending feedbacks available for testing")
            
        feedback_id = pending[0]["id"]
        print(f"Testing analyze on feedback: {feedback_id}")
        
        # Call analyze endpoint (this calls real Gemini LLM - may take 5-10 seconds)
        start_time = time.time()
        resp = self.session.post(f"{BASE_URL}/api/training/analyze/{feedback_id}", timeout=60)
        elapsed = time.time() - start_time
        
        assert resp.status_code == 200, f"Analyze failed: {resp.text}"
        data = resp.json()
        
        # Verify response structure
        assert "feedback_id" in data
        assert "qwen_suggestion" in data
        assert "opencv_suggestion" in data
        assert data["feedback_id"] == feedback_id
        
        # Verify suggestions are non-empty strings
        assert isinstance(data["qwen_suggestion"], str)
        assert isinstance(data["opencv_suggestion"], str)
        assert len(data["qwen_suggestion"]) > 10, "Qwen suggestion too short"
        assert len(data["opencv_suggestion"]) > 10, "OpenCV suggestion too short"
        
        print(f"✓ Analyze completed in {elapsed:.1f}s")
        print(f"  Qwen suggestion length: {len(data['qwen_suggestion'])} chars")
        print(f"  OpenCV suggestion length: {len(data['opencv_suggestion'])} chars")
        
        return feedback_id, data
        
    def test_analyze_nonexistent_feedback(self):
        """Test analyze with non-existent feedback ID returns 404"""
        resp = self.session.post(f"{BASE_URL}/api/training/analyze/nonexistent-id-12345")
        assert resp.status_code == 404
        print("✓ Non-existent feedback returns 404")
        
    def test_submit_prompts_endpoint(self):
        """Test POST /api/training/submit-prompts/{feedback_id}"""
        # Get feedbacks
        feedbacks_resp = self.session.get(f"{BASE_URL}/api/training/feedbacks")
        feedbacks = feedbacks_resp.json()
        
        # Find an analyzed feedback or any feedback
        analyzed = [f for f in feedbacks if f.get("status") == "analyzed"]
        if not analyzed:
            # Use any feedback for testing
            if not feedbacks:
                pytest.skip("No feedbacks available")
            feedback_id = feedbacks[0]["id"]
        else:
            feedback_id = analyzed[0]["id"]
            
        print(f"Testing submit-prompts on feedback: {feedback_id}")
        
        # Submit prompts
        test_qwen = "TEST: When analyzing AED images, prioritize spatial indicators for REPOSITION status."
        test_opencv = "TEST: Add contour analysis check when confidence < 85%."
        
        resp = self.session.post(
            f"{BASE_URL}/api/training/submit-prompts/{feedback_id}",
            json={"qwen_prompt": test_qwen, "opencv_rule": test_opencv}
        )
        
        assert resp.status_code == 200, f"Submit prompts failed: {resp.text}"
        data = resp.json()
        
        # Verify response
        assert "feedback_id" in data
        assert "updates_created" in data
        assert "updates" in data
        assert data["feedback_id"] == feedback_id
        assert data["updates_created"] == 2  # One for qwen, one for opencv
        assert len(data["updates"]) == 2
        
        # Verify update structure
        for update in data["updates"]:
            assert "id" in update
            assert "type" in update
            assert "content" in update
            assert "status" in update
            assert update["status"] == "pending"
            assert update["type"] in ["qwen_prompt", "opencv_rule"]
            
        print(f"✓ Submit prompts created {data['updates_created']} updates")
        return data["updates"]
        
    def test_submit_prompts_requires_content(self):
        """Test submit-prompts requires at least one prompt"""
        feedbacks_resp = self.session.get(f"{BASE_URL}/api/training/feedbacks")
        feedbacks = feedbacks_resp.json()
        if not feedbacks:
            pytest.skip("No feedbacks available")
            
        feedback_id = feedbacks[0]["id"]
        
        # Try with empty prompts
        resp = self.session.post(
            f"{BASE_URL}/api/training/submit-prompts/{feedback_id}",
            json={"qwen_prompt": "", "opencv_rule": ""}
        )
        
        assert resp.status_code == 400
        print("✓ Empty prompts correctly rejected with 400")
        
    def test_submit_prompts_nonexistent_feedback(self):
        """Test submit-prompts with non-existent feedback returns 404"""
        resp = self.session.post(
            f"{BASE_URL}/api/training/submit-prompts/nonexistent-id-12345",
            json={"qwen_prompt": "test", "opencv_rule": "test"}
        )
        assert resp.status_code == 404
        print("✓ Non-existent feedback returns 404")
        
    def test_get_updates_shows_submitted_prompts(self):
        """Test GET /api/training/updates returns submitted prompts"""
        resp = self.session.get(f"{BASE_URL}/api/training/updates")
        assert resp.status_code == 200
        updates = resp.json()
        
        assert isinstance(updates, list)
        
        # Check for pending updates
        pending = [u for u in updates if u.get("status") == "pending"]
        print(f"✓ Got {len(updates)} total updates, {len(pending)} pending")
        
        # Verify update structure
        if updates:
            update = updates[0]
            assert "id" in update
            assert "type" in update
            assert "content" in update
            assert "status" in update
            assert "feedback_id" in update
            
        return updates
        
    def test_submit_only_qwen_prompt(self):
        """Test submitting only Qwen prompt (no OpenCV rule)"""
        feedbacks_resp = self.session.get(f"{BASE_URL}/api/training/feedbacks")
        feedbacks = feedbacks_resp.json()
        if not feedbacks:
            pytest.skip("No feedbacks available")
            
        feedback_id = feedbacks[0]["id"]
        
        resp = self.session.post(
            f"{BASE_URL}/api/training/submit-prompts/{feedback_id}",
            json={"qwen_prompt": "TEST: Only Qwen prompt submitted", "opencv_rule": ""}
        )
        
        assert resp.status_code == 200
        data = resp.json()
        assert data["updates_created"] == 1
        assert data["updates"][0]["type"] == "qwen_prompt"
        print("✓ Single Qwen prompt submission works")
        
    def test_submit_only_opencv_rule(self):
        """Test submitting only OpenCV rule (no Qwen prompt)"""
        feedbacks_resp = self.session.get(f"{BASE_URL}/api/training/feedbacks")
        feedbacks = feedbacks_resp.json()
        if not feedbacks:
            pytest.skip("No feedbacks available")
            
        feedback_id = feedbacks[0]["id"]
        
        resp = self.session.post(
            f"{BASE_URL}/api/training/submit-prompts/{feedback_id}",
            json={"qwen_prompt": "", "opencv_rule": "TEST: Only OpenCV rule submitted"}
        )
        
        assert resp.status_code == 200
        data = resp.json()
        assert data["updates_created"] == 1
        assert data["updates"][0]["type"] == "opencv_rule"
        print("✓ Single OpenCV rule submission works")


class TestRegressionSyncAndQueue:
    """Regression tests for sync and queue functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Get admin token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "username": "futureroads",
            "password": "@@U1s9m6c7@@"
        })
        assert login_resp.status_code == 200
        token = login_resp.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
    def test_sync_endpoint(self):
        """Test GET /api/training/sync works"""
        resp = self.session.get(f"{BASE_URL}/api/training/sync")
        assert resp.status_code == 200
        data = resp.json()
        assert "synced" in data
        assert "total" in data
        print(f"✓ Sync: {data['synced']} new, {data['total']} total")
        
    def test_feedbacks_endpoint(self):
        """Test GET /api/training/feedbacks returns data"""
        resp = self.session.get(f"{BASE_URL}/api/training/feedbacks")
        assert resp.status_code == 200
        feedbacks = resp.json()
        assert isinstance(feedbacks, list)
        print(f"✓ Feedbacks: {len(feedbacks)} items")
        
    def test_stats_endpoint(self):
        """Test GET /api/training/stats returns stats"""
        resp = self.session.get(f"{BASE_URL}/api/training/stats")
        assert resp.status_code == 200
        stats = resp.json()
        assert "queue_pending" in stats
        assert "analyzed" in stats
        assert "monitoring" in stats
        print(f"✓ Stats: pending={stats['queue_pending']}, analyzed={stats['analyzed']}")
        
    def test_monitors_endpoint(self):
        """Test GET /api/training/monitors returns data"""
        resp = self.session.get(f"{BASE_URL}/api/training/monitors")
        assert resp.status_code == 200
        monitors = resp.json()
        assert isinstance(monitors, list)
        print(f"✓ Monitors: {len(monitors)} items")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
