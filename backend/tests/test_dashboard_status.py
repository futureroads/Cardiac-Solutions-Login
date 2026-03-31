"""
Dashboard Status API Tests - Testing the cold start fix for System Status showing 0
Tests:
1. /api/status-overview returns real data with totals.total > 0
2. /api/status-overview/expiring-expired-bp returns devices array with data
3. Cache pre-warming works on startup
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://cardiac-command.preview.emergentagent.com').rstrip('/')


class TestStatusOverviewAPI:
    """Tests for /api/status-overview endpoint"""
    
    def test_status_overview_returns_200(self):
        """Test that status-overview endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/status-overview", timeout=15)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: /api/status-overview returns 200")
    
    def test_status_overview_has_totals(self):
        """Test that response has totals object"""
        response = requests.get(f"{BASE_URL}/api/status-overview", timeout=15)
        data = response.json()
        assert "totals" in data, "Response missing 'totals' key"
        print(f"PASS: Response has 'totals' key: {list(data['totals'].keys())}")
    
    def test_status_overview_total_greater_than_zero(self):
        """Test that totals.total > 0 (not showing 0 on cold start)"""
        response = requests.get(f"{BASE_URL}/api/status-overview", timeout=15)
        data = response.json()
        total = data.get("totals", {}).get("total", 0)
        assert total > 0, f"totals.total should be > 0, got {total}"
        print(f"PASS: totals.total = {total} (expected ~3446)")
    
    def test_status_overview_percent_ready(self):
        """Test that percent_ready is present and reasonable"""
        response = requests.get(f"{BASE_URL}/api/status-overview", timeout=15)
        data = response.json()
        pct = data.get("totals", {}).get("percent_ready", 0)
        assert pct > 0, f"percent_ready should be > 0, got {pct}"
        assert pct <= 100, f"percent_ready should be <= 100, got {pct}"
        print(f"PASS: percent_ready = {pct}% (expected ~83.8%)")
    
    def test_status_overview_ready_count(self):
        """Test that ready count is present and > 0"""
        response = requests.get(f"{BASE_URL}/api/status-overview", timeout=15)
        data = response.json()
        ready = data.get("totals", {}).get("ready", 0)
        assert ready > 0, f"ready count should be > 0, got {ready}"
        print(f"PASS: ready = {ready} (expected ~2888)")
    
    def test_status_overview_no_error_flag(self):
        """Test that response doesn't have _error flag (API is working)"""
        response = requests.get(f"{BASE_URL}/api/status-overview", timeout=15)
        data = response.json()
        assert "_error" not in data, f"Response has _error flag: {data.get('_error')}"
        print("PASS: No _error flag in response")
    
    def test_status_overview_has_total_subscribers(self):
        """Test that total_subscribers is present"""
        response = requests.get(f"{BASE_URL}/api/status-overview", timeout=15)
        data = response.json()
        subs = data.get("total_subscribers", 0)
        assert subs > 0, f"total_subscribers should be > 0, got {subs}"
        print(f"PASS: total_subscribers = {subs}")


class TestExpiringExpiredBPAPI:
    """Tests for /api/status-overview/expiring-expired-bp endpoint"""
    
    def test_expiring_bp_returns_200(self):
        """Test that expiring-expired-bp endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/status-overview/expiring-expired-bp", timeout=15)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: /api/status-overview/expiring-expired-bp returns 200")
    
    def test_expiring_bp_has_devices_array(self):
        """Test that response has devices array"""
        response = requests.get(f"{BASE_URL}/api/status-overview/expiring-expired-bp", timeout=15)
        data = response.json()
        assert "devices" in data, "Response missing 'devices' key"
        assert isinstance(data["devices"], list), "devices should be a list"
        print(f"PASS: Response has 'devices' array with {len(data['devices'])} items")
    
    def test_expiring_bp_devices_not_empty(self):
        """Test that devices array has data (not empty)"""
        response = requests.get(f"{BASE_URL}/api/status-overview/expiring-expired-bp", timeout=15)
        data = response.json()
        devices = data.get("devices", [])
        assert len(devices) > 0, "devices array should not be empty"
        print(f"PASS: devices array has {len(devices)} items")
    
    def test_expiring_bp_device_structure(self):
        """Test that device objects have expected fields"""
        response = requests.get(f"{BASE_URL}/api/status-overview/expiring-expired-bp", timeout=15)
        data = response.json()
        devices = data.get("devices", [])
        if len(devices) > 0:
            device = devices[0]
            expected_fields = ["subscriber", "sentinel_id", "detailed_status", "location", "days_summary"]
            for field in expected_fields:
                assert field in device, f"Device missing '{field}' field"
            print(f"PASS: Device has expected fields: {expected_fields}")
    
    def test_expiring_bp_has_totals(self):
        """Test that response has totals with expired_bp and expiring_batt_pads"""
        response = requests.get(f"{BASE_URL}/api/status-overview/expiring-expired-bp", timeout=15)
        data = response.json()
        assert "totals" in data, "Response missing 'totals' key"
        totals = data["totals"]
        assert "expired_bp" in totals, "totals missing 'expired_bp'"
        assert "expiring_batt_pads" in totals, "totals missing 'expiring_batt_pads'"
        print(f"PASS: totals.expired_bp = {totals['expired_bp']}, totals.expiring_batt_pads = {totals['expiring_batt_pads']}")
    
    def test_expiring_bp_no_error_flag(self):
        """Test that response doesn't have _error flag"""
        response = requests.get(f"{BASE_URL}/api/status-overview/expiring-expired-bp", timeout=15)
        data = response.json()
        assert "_error" not in data, f"Response has _error flag: {data.get('_error')}"
        print("PASS: No _error flag in response")


class TestCachePreWarming:
    """Tests for cache pre-warming on startup"""
    
    def test_immediate_response_after_health_check(self):
        """Test that status-overview returns data immediately (cache pre-warmed)"""
        # First hit health to ensure server is up
        health_resp = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert health_resp.status_code == 200
        
        # Immediately request status-overview - should have cached data
        start = time.time()
        response = requests.get(f"{BASE_URL}/api/status-overview", timeout=15)
        elapsed = time.time() - start
        
        data = response.json()
        total = data.get("totals", {}).get("total", 0)
        
        # Should return real data (not 0) and be fast (cached)
        assert total > 0, f"Expected cached data with total > 0, got {total}"
        print(f"PASS: Immediate response with total={total} in {elapsed:.2f}s")


class TestHealthEndpoint:
    """Basic health check tests"""
    
    def test_health_returns_200(self):
        """Test health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "ok"
        print("PASS: /api/health returns {status: ok}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
