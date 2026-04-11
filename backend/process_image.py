#!/usr/bin/env python3
"""
Process image and save JSON output with image filename in outputs folder
"""

import json
import os
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(__file__))

from app.tasks.extraction import process_document


# Configuration
IMAGE_PATH = r"D:\claimHeart\backend\temp_uploads\image.png"
OUTPUT_FOLDER = "outputs"


def main():
    # Validate image exists
    if not os.path.exists(IMAGE_PATH):
        print(f"❌ Error: Image not found at {IMAGE_PATH}")
        return 1
    
    # Create output folder if it doesn't exist
    os.makedirs(OUTPUT_FOLDER, exist_ok=True)
    
    # Get image filename without extension
    image_filename = Path(IMAGE_PATH).stem  # Gets 'image' from 'image.png'
    
    # Create output JSON path
    output_json_path = os.path.join(OUTPUT_FOLDER, f"{image_filename}.json")
    
    print("=" * 70)
    print("🔍 OCR EXTRACTION")
    print("=" * 70)
    print(f"📄 Input:  {IMAGE_PATH}")
    print(f"💾 Output: {output_json_path}")
    print("⏳ Processing...")
    print()
    
    try:
        # Process the image
        result = process_document(IMAGE_PATH)
        
        # Save to JSON file
        with open(output_json_path, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        
        # Display results
        print("✅ EXTRACTION COMPLETE")
        print("=" * 70)
        print("\n📊 STRUCTURED DATA:")
        print("-" * 70)
        print(json.dumps(result["structured_data"], indent=2, ensure_ascii=False))
        print("-" * 70)
        
        print(f"\n💾 Full output saved to: {os.path.abspath(output_json_path)}")
        print("=" * 70)
        
        return 0
        
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
