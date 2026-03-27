#!/usr/bin/env python
import requests
import json

BASE_URL = 'http://127.0.0.1:8000/api'

# Test Signup
print("=" * 60)
print("Testing Signup Endpoint")
print("=" * 60)

signup_data = {
    'name': 'Adaeze Nwosu',
    'email': 'adaeze@example.com',
    'username': 'swiftqueen',
    'password': 'SecurePassword123',
    'confirm_password': 'SecurePassword123'
}

response = requests.post(f'{BASE_URL}/signup/', json=signup_data)
print(f"Status Code: {response.status_code}")
print(f"Response: {json.dumps(response.json(), indent=2)}")

# Test Login with correct credentials
print("\n" + "=" * 60)
print("Testing Login with Email")
print("=" * 60)

login_data = {
    'identifier': 'adaeze@example.com',
    'password': 'SecurePassword123'
}

response = requests.post(f'{BASE_URL}/login/', json=login_data)
print(f"Status Code: {response.status_code}")
print(f"Response: {json.dumps(response.json(), indent=2)}")

# Test Login with username
print("\n" + "=" * 60)
print("Testing Login with Username")
print("=" * 60)

login_data = {
    'identifier': 'swiftqueen',
    'password': 'SecurePassword123'
}

response = requests.post(f'{BASE_URL}/login/', json=login_data)
print(f"Status Code: {response.status_code}")
print(f"Response: {json.dumps(response.json(), indent=2)}")

# Test Login with incorrect password
print("\n" + "=" * 60)
print("Testing Login with Wrong Password")
print("=" * 60)

login_data = {
    'identifier': 'swiftqueen',
    'password': 'WrongPassword'
}

response = requests.post(f'{BASE_URL}/login/', json=login_data)
print(f"Status Code: {response.status_code}")
print(f"Response: {json.dumps(response.json(), indent=2)}")

# Test Signup with duplicate email
print("\n" + "=" * 60)
print("Testing Signup with Duplicate Email")
print("=" * 60)

signup_data2 = {
    'name': 'Another User',
    'email': 'adaeze@example.com',
    'username': 'anotheruser',
    'password': 'Password123',
    'confirm_password': 'Password123'
}

response = requests.post(f'{BASE_URL}/signup/', json=signup_data2)
print(f"Status Code: {response.status_code}")
print(f"Response: {json.dumps(response.json(), indent=2)}")

print("\n" + "=" * 60)
print("Test Complete")
print("=" * 60)
