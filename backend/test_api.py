#!/usr/bin/env python3
"""
Test script to verify the OCR API endpoints
"""

import requests
import json

BASE_URL = "http://localhost:8000"


def test_health():
    """Test health endpoint"""
    print("Testing health endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/api/health")
        print(f"✅ Health check: {response.json()}")
    except Exception as e:
        print(f"❌ Health check failed: {e}")


def test_ocr_local_path():
    """Test OCR with local path"""
    print("\nTesting OCR with local path...")
    try:
        payload = {
            "local_path": "app/docs/image.png"
        }
        response = requests.post(f"{BASE_URL}/api/ocr/process-local", json=payload)
        
        if response.status_code == 200:
            result = response.json()
            print("✅ OCR processing successful!")
            print(json.dumps(result, indent=2))
        else:
            print(f"❌ OCR failed: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"❌ OCR test failed: {e}")


if __name__ == "__main__":
    print("=" * 60)
    print("ClaimHeart API Tests")
    print("=" * 60)
    print("\nMake sure the server is running:")
    print("  cd backend")
    print("  uvicorn app.main:app --reload")
    print("\n" + "=" * 60 + "\n")
    
    test_health()
    test_ocr_local_path()
