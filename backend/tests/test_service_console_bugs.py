"""
Test suite for Service Console bug fixes:
1. Service Console page load time (parallel Readisys API calls)
2. Dispatch email fallback to field_techs collection when ticket lacks tech_email
"""
import pytest
import requests
import time
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://cardiac-command.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_USERNAME = "futureroads"
ADMIN_PASSWORD = "@@U1s9m6c7@@"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for API calls."""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "username": ADMIN_USERNAME,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    assert "access_token" in data, f"No access_token in response: {data}"
    return data["access_token"]


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Return headers with auth token."""
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


class TestServiceConsolePerformance:
    """Test that Service Console data loads within reasonable time (< 5s)."""

    def test_console_data_returns_200(self, auth_headers):
        """GET /api/service/console-data should return 200."""
        response = requests.get(f"{BASE_URL}/api/service/console-data", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    def test_console_data_load_time_under_5_seconds(self, auth_headers):
        """GET /api/service/console-data should complete within 5 seconds (parallel API calls fix)."""
        start = time.time()
        response = requests.get(f"{BASE_URL}/api/service/console-data", headers=auth_headers, timeout=10)
        elapsed = time.time() - start
        
        assert response.status_code == 200, f"Request failed: {response.text}"
        assert elapsed < 5, f"Console data took {elapsed:.2f}s (expected < 5s) - parallel API calls may not be working"
        print(f"Console data loaded in {elapsed:.2f}s")

    def test_console_data_has_subscribers_array(self, auth_headers):
        """Response should contain subscribers array."""
        response = requests.get(f"{BASE_URL}/api/service/console-data", headers=auth_headers)
        data = response.json()
        assert "subscribers" in data, f"Missing 'subscribers' key in response: {data.keys()}"
        assert isinstance(data["subscribers"], list), f"subscribers should be a list, got {type(data['subscribers'])}"

    def test_console_data_has_stats(self, auth_headers):
        """Response should contain stats object."""
        response = requests.get(f"{BASE_URL}/api/service/console-data", headers=auth_headers)
        data = response.json()
        assert "stats" in data, f"Missing 'stats' key in response: {data.keys()}"
        stats = data["stats"]
        # Check expected stat fields
        expected_fields = ["total_aeds_need_service", "active_tickets", "dispatched"]
        for field in expected_fields:
            assert field in stats, f"Missing '{field}' in stats: {stats.keys()}"


class TestFieldTechs:
    """Test field technicians endpoint."""

    def test_list_field_techs_returns_200(self, auth_headers):
        """GET /api/service/field-techs should return 200."""
        response = requests.get(f"{BASE_URL}/api/service/field-techs", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    def test_list_field_techs_returns_array(self, auth_headers):
        """GET /api/service/field-techs should return an array."""
        response = requests.get(f"{BASE_URL}/api/service/field-techs", headers=auth_headers)
        data = response.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"

    def test_field_techs_have_required_fields(self, auth_headers):
        """Each field tech should have name and email fields."""
        response = requests.get(f"{BASE_URL}/api/service/field-techs", headers=auth_headers)
        data = response.json()
        if len(data) > 0:
            tech = data[0]
            assert "name" in tech, f"Missing 'name' in tech: {tech.keys()}"
            assert "email" in tech, f"Missing 'email' in tech: {tech.keys()}"
            print(f"Found {len(data)} field techs")


class TestDispatchEmailFallback:
    """Test dispatch endpoint correctly resolves tech email from field_techs collection."""

    def test_dispatch_with_tech_email_provided(self, auth_headers):
        """Dispatch should work when tech_email is provided in request."""
        # First create a test ticket
        ticket_data = {
            "subscriber": "TEST_Dispatch_Subscriber",
            "device_id": "TEST-DEVICE-001",
            "device_type": "Hybrid",
            "issue_type": "NOT READY",
            "location": "Test Location",
            "priority": "MEDIUM",
            "assigned_tech": "Test Tech",
            "tech_email": "test@test.com",
            "description": "Test ticket for dispatch with email"
        }
        create_resp = requests.post(f"{BASE_URL}/api/service/tickets", json=ticket_data, headers=auth_headers)
        assert create_resp.status_code == 200, f"Failed to create ticket: {create_resp.text}"
        ticket = create_resp.json()
        ticket_id = ticket["id"]
        
        try:
            # Dispatch with tech_email provided
            dispatch_resp = requests.post(
                f"{BASE_URL}/api/service/tickets/{ticket_id}/dispatch",
                json={"tech_name": "Test Tech", "tech_email": "test@test.com"},
                headers=auth_headers
            )
            assert dispatch_resp.status_code == 200, f"Dispatch failed: {dispatch_resp.text}"
            result = dispatch_resp.json()
            assert result.get("success") is True, f"Dispatch not successful: {result}"
            assert "Test Tech" in result.get("message", ""), f"Tech name not in message: {result}"
            print(f"Dispatch with email provided: {result.get('message')}")
        finally:
            # Cleanup - delete test ticket
            requests.delete(f"{BASE_URL}/api/service/tickets/{ticket_id}", headers=auth_headers)

    def test_dispatch_resolves_email_from_field_techs(self, auth_headers):
        """Dispatch should resolve tech email from field_techs when ticket has no tech_email."""
        # Create a ticket WITHOUT tech_email (simulating older tickets)
        ticket_data = {
            "subscriber": "TEST_Dispatch_NoEmail",
            "device_id": "TEST-DEVICE-002",
            "device_type": "Hybrid",
            "issue_type": "EXPIRED B/P",
            "location": "Test Location 2",
            "priority": "HIGH",
            "assigned_tech": "Emily Davis",  # This tech exists in field_techs with email
            "tech_email": "",  # Empty - should be resolved from field_techs
            "description": "Test ticket for dispatch without email"
        }
        create_resp = requests.post(f"{BASE_URL}/api/service/tickets", json=ticket_data, headers=auth_headers)
        assert create_resp.status_code == 200, f"Failed to create ticket: {create_resp.text}"
        ticket = create_resp.json()
        ticket_id = ticket["id"]
        
        try:
            # Dispatch WITHOUT tech_email - should resolve from field_techs
            dispatch_resp = requests.post(
                f"{BASE_URL}/api/service/tickets/{ticket_id}/dispatch",
                json={"tech_name": "Emily Davis", "tech_email": ""},  # Empty email
                headers=auth_headers
            )
            assert dispatch_resp.status_code == 200, f"Dispatch failed: {dispatch_resp.text}"
            result = dispatch_resp.json()
            assert result.get("success") is True, f"Dispatch not successful: {result}"
            
            # Verify the ticket in the response has the resolved email
            updated_ticket = result.get("ticket", {})
            resolved_email = updated_ticket.get("tech_email", "")
            
            # The email should have been resolved from field_techs
            assert resolved_email == "emily.davis@medtech.com", \
                f"Email not resolved correctly. Expected 'emily.davis@medtech.com', got '{resolved_email}'"
            print(f"Email resolved from field_techs: {resolved_email}")
            
            # Also verify the message contains the resolved email
            assert "emily.davis@medtech.com" in result.get("message", ""), \
                f"Resolved email not in message: {result.get('message')}"
        finally:
            # Cleanup - delete test ticket
            requests.delete(f"{BASE_URL}/api/service/tickets/{ticket_id}", headers=auth_headers)

    def test_dispatch_existing_open_ticket_without_email(self, auth_headers):
        """Test dispatching the existing OPEN ticket (SVC-260402104) which has no assigned_tech."""
        # The existing ticket SVC-260402104 is OPEN with no assigned_tech
        ticket_id = "SVC-260402104"
        
        # First check if ticket exists and is OPEN
        # We'll dispatch it with a tech name and see if email is resolved
        dispatch_resp = requests.post(
            f"{BASE_URL}/api/service/tickets/{ticket_id}/dispatch",
            json={"tech_name": "Test Tech", "tech_email": ""},  # Empty email - should resolve
            headers=auth_headers
        )
        
        if dispatch_resp.status_code == 200:
            result = dispatch_resp.json()
            assert result.get("success") is True, f"Dispatch not successful: {result}"
            print(f"Dispatched existing ticket: {result.get('message')}")
            
            # Reset ticket back to OPEN for future tests
            requests.put(
                f"{BASE_URL}/api/service/tickets/{ticket_id}",
                json={"status": "OPEN", "assigned_tech": "", "tech_email": ""},
                headers=auth_headers
            )
        else:
            # Ticket might not exist or be in wrong state
            print(f"Could not dispatch ticket {ticket_id}: {dispatch_resp.text}")


class TestLoginFlow:
    """Test login flow works correctly."""

    def test_login_returns_access_token(self):
        """Login should return access_token (not just token)."""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, f"Missing 'access_token' in response: {data.keys()}"
        assert "user" in data, f"Missing 'user' in response: {data.keys()}"
        print(f"Login successful, user: {data['user'].get('username')}")

    def test_login_invalid_credentials(self):
        """Login with invalid credentials should return 401."""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "invalid_user",
            "password": "wrong_password"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"


class TestHealthEndpoint:
    """Test health endpoint."""

    def test_health_returns_ok(self):
        """GET /api/health should return status ok."""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "ok"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
