"""
Test suite for the new Gemini Prompt feature in Step 2:
- POST /api/training/analyze/{id} accepts custom_prompt in body
- POST /api/training/submit-prompts/{id} creates update records (regression)
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestGeminiPromptFeature:
    """Tests for the new custom_prompt feature in analyze endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: login and get token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "username": "futureroads",
            "password": "@@U1s9m6c7@@"
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        token = login_resp.json()["access_token"]
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
    def test_health_check(self):
        """Verify API is accessible"""
        resp = self.session.get(f"{BASE_URL}/api/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"
        print("PASS: Health check OK")
        
    def test_get_feedbacks_returns_list(self):
        """Verify feedbacks endpoint returns data"""
        resp = self.session.get(f"{BASE_URL}/api/training/feedbacks")
        assert resp.status_code == 200
        feedbacks = resp.json()
        assert isinstance(feedbacks, list)
        print(f"PASS: Got {len(feedbacks)} feedbacks")
        return feedbacks
        
    def test_analyze_with_custom_prompt(self):
        """Test POST /api/training/analyze/{id} with custom_prompt in body"""
        # First get a feedback to analyze
        feedbacks_resp = self.session.get(f"{BASE_URL}/api/training/feedbacks")
        assert feedbacks_resp.status_code == 200
        feedbacks = feedbacks_resp.json()
        
        if not feedbacks:
            pytest.skip("No feedbacks available to test")
            
        feedback = feedbacks[0]
        feedback_id = feedback["id"]
        
        # Custom prompt to send
        custom_prompt = (
            "This is a TEST custom prompt for Gemini.\n"
            f"Analyze the AED feedback for unit {feedback.get('sentinel_id', feedback.get('aed_id', 'Unknown'))}.\n"
            f"The AI classified it as {feedback.get('assigned_status')} but it should be {feedback.get('correct_status')}.\n"
            "Generate a Qwen retraining prompt and an OpenCV rule."
        )
        
        # Send analyze request with custom_prompt
        print(f"Testing analyze endpoint with custom_prompt for feedback {feedback_id}...")
        resp = self.session.post(
            f"{BASE_URL}/api/training/analyze/{feedback_id}",
            json={"custom_prompt": custom_prompt}
        )
        
        assert resp.status_code == 200, f"Analyze failed: {resp.status_code} - {resp.text}"
        data = resp.json()
        
        # Verify response structure
        assert "feedback_id" in data, "Response missing feedback_id"
        assert "qwen_suggestion" in data, "Response missing qwen_suggestion"
        assert "opencv_suggestion" in data, "Response missing opencv_suggestion"
        assert data["feedback_id"] == feedback_id
        assert len(data["qwen_suggestion"]) > 0, "qwen_suggestion is empty"
        assert len(data["opencv_suggestion"]) > 0, "opencv_suggestion is empty"
        
        print(f"PASS: Analyze with custom_prompt returned valid response")
        print(f"  - qwen_suggestion length: {len(data['qwen_suggestion'])} chars")
        print(f"  - opencv_suggestion length: {len(data['opencv_suggestion'])} chars")
        
    def test_analyze_without_custom_prompt(self):
        """Test POST /api/training/analyze/{id} without custom_prompt (uses default)"""
        feedbacks_resp = self.session.get(f"{BASE_URL}/api/training/feedbacks")
        assert feedbacks_resp.status_code == 200
        feedbacks = feedbacks_resp.json()
        
        if not feedbacks:
            pytest.skip("No feedbacks available to test")
            
        feedback = feedbacks[0]
        feedback_id = feedback["id"]
        
        # Send analyze request without custom_prompt (empty body)
        print(f"Testing analyze endpoint without custom_prompt for feedback {feedback_id}...")
        resp = self.session.post(
            f"{BASE_URL}/api/training/analyze/{feedback_id}",
            json={}
        )
        
        assert resp.status_code == 200, f"Analyze failed: {resp.status_code} - {resp.text}"
        data = resp.json()
        
        assert "qwen_suggestion" in data
        assert "opencv_suggestion" in data
        print(f"PASS: Analyze without custom_prompt works (uses default prompt)")
        
    def test_analyze_nonexistent_feedback_returns_404(self):
        """Test POST /api/training/analyze with non-existent ID returns 404"""
        resp = self.session.post(
            f"{BASE_URL}/api/training/analyze/nonexistent-id-12345",
            json={"custom_prompt": "test"}
        )
        assert resp.status_code == 404
        print("PASS: Non-existent feedback returns 404")
        
    def test_submit_prompts_creates_updates(self):
        """Test POST /api/training/submit-prompts/{id} creates update records"""
        feedbacks_resp = self.session.get(f"{BASE_URL}/api/training/feedbacks")
        assert feedbacks_resp.status_code == 200
        feedbacks = feedbacks_resp.json()
        
        if not feedbacks:
            pytest.skip("No feedbacks available to test")
            
        feedback = feedbacks[0]
        feedback_id = feedback["id"]
        
        # Submit prompts
        resp = self.session.post(
            f"{BASE_URL}/api/training/submit-prompts/{feedback_id}",
            json={
                "qwen_prompt": "TEST Qwen prompt for retraining",
                "opencv_rule": "TEST OpenCV rule for preprocessing"
            }
        )
        
        assert resp.status_code == 200, f"Submit prompts failed: {resp.status_code} - {resp.text}"
        data = resp.json()
        
        assert "updates_created" in data
        assert data["updates_created"] >= 1
        assert "updates" in data
        print(f"PASS: Submit prompts created {data['updates_created']} update(s)")
        
    def test_submit_prompts_requires_at_least_one_prompt(self):
        """Test POST /api/training/submit-prompts requires at least one prompt"""
        feedbacks_resp = self.session.get(f"{BASE_URL}/api/training/feedbacks")
        feedbacks = feedbacks_resp.json()
        
        if not feedbacks:
            pytest.skip("No feedbacks available to test")
            
        feedback_id = feedbacks[0]["id"]
        
        # Submit with empty prompts
        resp = self.session.post(
            f"{BASE_URL}/api/training/submit-prompts/{feedback_id}",
            json={"qwen_prompt": "", "opencv_rule": ""}
        )
        
        assert resp.status_code == 400
        print("PASS: Empty prompts return 400")
        
    def test_get_updates_returns_list(self):
        """Verify updates endpoint returns data"""
        resp = self.session.get(f"{BASE_URL}/api/training/updates")
        assert resp.status_code == 200
        updates = resp.json()
        assert isinstance(updates, list)
        print(f"PASS: Got {len(updates)} updates")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
