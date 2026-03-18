import requests
import sys
import json
from datetime import datetime

class CardiacSolutionsAPITester:
    def __init__(self, base_url="https://cardiac-nexus.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_data = None
        self.tests_run = 0
        self.tests_passed = 0

    def run_test(self, name, method, endpoint, expected_status, data=None, auth_required=False):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}" if not endpoint.startswith('/') else f"{self.base_url}{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if auth_required and self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)

            print(f"   Status Code: {response.status_code}")
            success = response.status_code == expected_status
            
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                
                # Try to parse JSON response
                try:
                    response_data = response.json()
                    if isinstance(response_data, dict) and len(response_data) > 0:
                        print(f"   Response Keys: {list(response_data.keys())}")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error Text: {response.text[:200]}")
                return False, {}

        except requests.exceptions.Timeout:
            print(f"❌ Failed - Request timeout")
            return False, {}
        except requests.exceptions.ConnectionError:
            print(f"❌ Failed - Connection error")
            return False, {}
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test basic connectivity"""
        success, _ = self.run_test("Health Check", "GET", "", 200)
        return success

    def test_register(self):
        """Test user registration"""
        # Use timestamp to ensure unique email
        timestamp = datetime.now().strftime('%H%M%S')
        test_user_data = {
            "email": f"test_user_{timestamp}@cardiac.com",
            "password": "TestPass123!",
            "name": f"Test User {timestamp}"
        }
        
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data=test_user_data
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_data = response.get('user', {})
            print(f"   Registered user: {self.user_data.get('name', 'Unknown')}")
            return True
        return False

    def test_login(self):
        """Test user login with existing credentials"""
        # Create a user first, then try to log in
        timestamp = datetime.now().strftime('%H%M%S%f')[:-3]  # microseconds for uniqueness
        register_data = {
            "email": f"login_test_{timestamp}@cardiac.com",
            "password": "LoginTest123!",
            "name": f"Login Test {timestamp}"
        }
        
        # First register
        success, register_response = self.run_test(
            "Pre-Login Registration",
            "POST", 
            "auth/register",
            200,
            data=register_data
        )
        
        if not success:
            return False
            
        # Now test login
        login_data = {
            "email": register_data["email"],
            "password": register_data["password"]
        }
        
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login", 
            200,
            data=login_data
        )
        
        if success and 'access_token' in response:
            # Store login token separately for protected endpoint tests
            self.token = response['access_token']
            self.user_data = response.get('user', {})
            print(f"   Logged in user: {self.user_data.get('name', 'Unknown')}")
            return True
        return False

    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        invalid_data = {
            "email": "nonexistent@cardiac.com", 
            "password": "wrongpassword"
        }
        
        success, _ = self.run_test(
            "Login Invalid Credentials",
            "POST",
            "auth/login",
            401,
            data=invalid_data
        )
        return success

    def test_get_current_user(self):
        """Test protected /auth/me endpoint"""
        if not self.token:
            print("❌ No token available for protected endpoint test")
            return False
            
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200,
            auth_required=True
        )
        return success

    def test_dashboard_stats(self):
        """Test dashboard stats endpoint"""
        if not self.token:
            print("❌ No token available for dashboard stats test")
            return False
            
        success, response = self.run_test(
            "Dashboard Stats",
            "GET",
            "dashboard/stats",
            200,
            auth_required=True
        )
        
        if success and response:
            expected_fields = ['total_monitored', 'percent_ready', 'ready', 'last_updated']
            missing_fields = [field for field in expected_fields if field not in response]
            if missing_fields:
                print(f"   Warning: Missing fields: {missing_fields}")
            else:
                print(f"   Stats: {response.get('total_monitored', 0)} monitored, {response.get('percent_ready', 0)}% ready")
                
        return success

    def test_dashboard_subscribers(self):
        """Test dashboard subscribers endpoint"""
        if not self.token:
            print("❌ No token available for dashboard subscribers test")
            return False
            
        success, response = self.run_test(
            "Dashboard Subscribers", 
            "GET",
            "dashboard/subscribers",
            200,
            auth_required=True
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} subscribers")
            if len(response) > 0:
                subscriber = response[0]
                print(f"   Sample subscriber: {subscriber.get('name', 'Unknown')} ({subscriber.get('total', 0)} devices)")
        
        return success

    def test_protected_without_auth(self):
        """Test accessing protected endpoint without authentication"""
        # Temporarily clear token
        old_token = self.token
        self.token = None
        
        success, _ = self.run_test(
            "Protected Endpoint Without Auth",
            "GET",
            "dashboard/stats",
            401
        )
        
        # Restore token
        self.token = old_token
        return success

def main():
    print("🚀 Starting Cardiac Solutions API Testing")
    print("=" * 50)
    
    tester = CardiacSolutionsAPITester()
    
    # Test sequence - order matters for authentication
    test_results = {}
    
    # Basic connectivity
    test_results['health'] = tester.test_health_check()
    
    # Authentication tests
    test_results['register'] = tester.test_register()
    test_results['login'] = tester.test_login()
    test_results['invalid_login'] = tester.test_login_invalid_credentials()
    test_results['current_user'] = tester.test_get_current_user()
    
    # Dashboard tests (require authentication)
    test_results['dashboard_stats'] = tester.test_dashboard_stats()
    test_results['dashboard_subscribers'] = tester.test_dashboard_subscribers()
    
    # Security test
    test_results['protected_no_auth'] = tester.test_protected_without_auth()
    
    # Print final results
    print("\n" + "=" * 50)
    print("📊 FINAL TEST RESULTS")
    print("=" * 50)
    
    for test_name, result in test_results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name.replace('_', ' ').title()}: {status}")
    
    print(f"\n📈 Overall: {tester.tests_passed}/{tester.tests_run} tests passed")
    success_rate = (tester.tests_passed / tester.tests_run) * 100 if tester.tests_run > 0 else 0
    print(f"Success Rate: {success_rate:.1f}%")
    
    # Determine exit code
    if success_rate >= 80:
        print("\n🎉 API Testing: SUCCESSFUL")
        return 0
    else:
        print("\n⚠️  API Testing: NEEDS ATTENTION")
        return 1

if __name__ == "__main__":
    sys.exit(main())