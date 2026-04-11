#!/usr/bin/env python3
"""
Flexible OCR extraction script with command-line arguments

Usage:
    python extract_ocr.py                                    # Uses default image
    python extract_ocr.py temp_uploads/my_image.jpg          # Process specific image
    python extract_ocr.py my_image.jpg -o results/output.json # Custom output location
"""

import json
import os
import sys
from datetime import datetime

# Add the app directory to the path
sys.path.insert(0, os.path.dirname(__file__))

from app.tasks.extraction import process_document


# ============================================================================
# CONFIGURATION - Change these defaults
# ============================================================================

DEFAULT_IMAGE_PATH = "D:\claimHeart\backend\temp_uploads\image.png"  # 👈 CHANGE THIS to your default image
DEFAULT_OUTPUT_DIR = "outputs"              # 👈 CHANGE THIS to your output folder
DEFAULT_OUTPUT_FILE = "ocr_output.json"     # 👈 CHANGE THIS to your output filename

# ============================================================================


def ensure_dir(directory):
    """Create directory if it doesn't exist"""
    if directory and not os.path.exists(directory):
        os.makedirs(directory)
        print(f"📁 Created directory: {directory}")


def main():
    # Parse command line arguments
    image_path = DEFAULT_IMAGE_PATH
    output_path = DEFAULT_OUTPUT_FILE
    
    if len(sys.argv) > 1:
        image_path = sys.argv[1]
    
    if len(sys.argv) > 3 and sys.argv[2] in ["-o", "--output"]:
        output_path = sys.argv[3]
    
    # Validate input file
    if not os.path.exists(image_path):
        print(f"❌ Error: File not found at '{image_path}'")
        print(f"\n💡 Usage:")
        print(f"   python extract_ocr.py <image_path> [-o <output_path>]")
        print(f"\n📝 Examples:")
        print(f"   python extract_ocr.py temp_uploads/my_image.jpg")
        print(f"   python extract_ocr.py my_doc.png -o results/output.json")
        return 1
    
    # Ensure output directory exists
    output_dir = os.path.dirname(output_path)
    if output_dir:
        ensure_dir(output_dir)
    
    # Process the image
    print("=" * 70)
    print("🔍 OCR EXTRACTION STARTED")
    print("=" * 70)
    print(f"📄 Input:  {os.path.abspath(image_path)}")
    print(f"💾 Output: {os.path.abspath(output_path)}")
    print("⏳ Processing... (this may take a few seconds)")
    print()

    try:
        result = process_document(image_path)

        # Display results
        print("✅ OCR EXTRACTION COMPLETE")
        print("=" * 70)
        print("\n📋 EXTRACTED TEXT:")
        print("-" * 70)
        print(result.get("raw_text", "")[:500])  # Show first 500 chars
        if len(result.get("raw_text", "")) > 500:
            print("... (truncated, see full text in output file)")
        print("-" * 70)
        
        print("\n📊 STRUCTURED DATA:")
        print("-" * 70)
        print(json.dumps(result.get("structured_data", {}), indent=2))
        print("-" * 70)

        # Save output to file
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2, ensure_ascii=False)

        print(f"\n💾 Full output saved to: {os.path.abspath(output_path)}")
        print("=" * 70)
        return 0

    except Exception as e:
        print(f"\n❌ Error during OCR processing:")
        print(f"   {str(e)}")
        print("\n🔧 Troubleshooting:")
        print("   1. Check if the image file is valid")
        print("   2. Ensure EasyOCR/Tesseract is installed")
        print("   3. Try with a different image")
        import traceback
        print("\n📋 Full error trace:")
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
