#!/usr/bin/env python3
"""
Standalone script to extract text from an image using OCR
Usage: python extract_image.py
"""

import json
import os
import sys

# Add the app directory to the path
sys.path.insert(0, os.path.dirname(__file__))

from app.tasks.extraction import process_document

# Image path
IMAGE_PATH = "app/docs/image.png"


def main():
    if not os.path.exists(IMAGE_PATH):
        print(f"❌ Error: File not found at {IMAGE_PATH}")
        return 1

    print(f"📄 Processing: {IMAGE_PATH}")
    print("⏳ Extracting text using OCR...")

    try:
        result = process_document(IMAGE_PATH)

        print("\n✅ OCR EXTRACTION COMPLETE\n")
        print("=" * 60)
        print(json.dumps(result, indent=2, ensure_ascii=False))
        print("=" * 60)

        # Save output to file
        output_path = "ocr_output.json"
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2, ensure_ascii=False)

        print(f"\n💾 Output saved to: {output_path}")
        return 0

    except Exception as e:
        print(f"\n❌ Error during OCR processing: {str(e)}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
