#!/usr/bin/env python3
"""Test script to verify API endpoints handle both good and bad inputs properly."""
import requests
import json

BASE_URL = "http://localhost:8000"

def test_endpoint(path, params=None, expected_status=200, description=""):
    """Test an endpoint with given parameters."""
    url = f"{BASE_URL}{path}"
    try:
        response = requests.get(url, params=params, timeout=10)
        status = response.status_code
        
        if status == expected_status:
            result = "[PASS]"
        else:
            result = "[FAIL]"
        
        print(f"{result} {description}")
        print(f"    URL: {response.url}")
        print(f"    Status: {status} (expected: {expected_status})")
        
        if status != expected_status:
            try:
                error_data = response.json()
                print(f"    Error: {error_data}")
            except:
                print(f"    Response: {response.text[:200]}")
        print()
        
        return status == expected_status
        
    except Exception as e:
        print(f"[ERROR] {description}")
        print(f"    Exception: {e}")
        print()
        return False

def main():
    print("Testing API endpoints for safe query parameter handling...")
    print("=" * 60)
    
    # Test 1: Good requests (should return 200)
    print("1. Testing GOOD requests (expecting 200):")
    print("-" * 40)
    
    good_tests = [
        ("/api/transactions", {"txn_type": "income", "date_from": "2020-01-01", "date_to": "2025-08-23", "per_page": "10", "page": "1"}, "Transactions with valid params"),
        ("/api/transactions/categories", {"only_with_transactions": "true"}, "Categories with boolean param"),
        ("/api/dashboard/cards", {"month": "2025-08"}, "Dashboard cards with valid month"),
        ("/api/dashboard/categories", {"month": "2025-08"}, "Dashboard categories with valid month"),
        ("/api/analytics/available-months", {}, "Analytics available months"),
    ]
    
    passed = 0
    for path, params, desc in good_tests:
        if test_endpoint(path, params, 200, desc):
            passed += 1
    
    print(f"Good requests: {passed}/{len(good_tests)} passed\n")
    
    # Test 2: Bad requests (should return 400 or handle gracefully)
    print("2. Testing BAD requests (expecting 400 or graceful handling):")
    print("-" * 40)
    
    bad_tests = [
        ("/api/dashboard/cards", {"month": "banana"}, 400, "Dashboard cards with invalid month"),
        ("/api/dashboard/categories", {"month": "invalid-date"}, 400, "Dashboard categories with invalid month"),
        ("/api/analytics/summary-range", {"date_from": "banana", "date_to": "2025-08"}, 400, "Analytics summary with invalid date_from"),
        ("/api/analytics/category-series", {"category_id": "not-a-number", "date_from": "2020-01", "date_to": "2025-08"}, 400, "Category series with invalid category_id"),
    ]
    
    passed_bad = 0
    for path, params, expected, desc in bad_tests:
        if test_endpoint(path, params, expected, desc):
            passed_bad += 1
    
    print(f"Bad requests: {passed_bad}/{len(bad_tests)} handled properly\n")
    
    # Test 3: Edge cases (should not return 500)
    print("3. Testing EDGE cases (should NOT return 500):")
    print("-" * 40)
    
    edge_tests = [
        ("/api/transactions", {"per_page": "99999"}, "Transactions with very large per_page"),
        ("/api/transactions", {"page": "0"}, "Transactions with zero page"),
        ("/api/transactions", {"txn_type": "invalid"}, "Transactions with invalid txn_type"),
        ("/api/transactions", {"date_from": "", "date_to": ""}, "Transactions with empty dates"),
    ]
    
    no_500_errors = 0
    for path, params, desc in edge_tests:
        response = requests.get(f"{BASE_URL}{path}", params=params, timeout=10)
        if response.status_code != 500:
            no_500_errors += 1
            print(f"[PASS] {desc} (got {response.status_code})")
        else:
            print(f"[FAIL] {desc} (got 500 error)")
            try:
                print(f"    Error: {response.json()}")
            except:
                print(f"    Response: {response.text[:200]}")
        print()
    
    print(f"Edge cases: {no_500_errors}/{len(edge_tests)} avoided 500 errors\n")
    
    # Summary
    total_good = len(good_tests)
    total_bad = len(bad_tests) 
    total_edge = len(edge_tests)
    total_tests = total_good + total_bad + total_edge
    total_passed = passed + passed_bad + no_500_errors
    
    print("=" * 60)
    print("SUMMARY:")
    print(f"   Good requests working: {passed}/{total_good}")
    print(f"   Bad requests handled: {passed_bad}/{total_bad}")
    print(f"   Edge cases no 500s: {no_500_errors}/{total_edge}")
    print(f"   Overall success: {total_passed}/{total_tests} ({100*total_passed/total_tests:.1f}%)")
    
    if total_passed == total_tests:
        print("ALL TESTS PASSED! The 500 error fixes are working correctly.")
    else:
        print("Some tests failed. Check the output above for details.")

if __name__ == "__main__":
    main()