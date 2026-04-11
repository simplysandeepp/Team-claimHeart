#!/usr/bin/env python3
"""
Flexible OCR extraction script with command-line arguments.

Usage:
    python extract_ocr.py
    python extract_ocr.py temp_uploads/my_image.jpg
    python extract_ocr.py my_image.jpg -o results/output.json
"""

import json
import os
import sys
from pathlib import Path


sys.path.insert(0, os.path.dirname(__file__))

from app.tasks.extraction import process_document


DEFAULT_IMAGE_PATH = os.path.join("temp_uploads", "sample_image1.png")
DEFAULT_OUTPUT_DIR = "outputs"


def ensure_dir(directory: str) -> None:
    """Create directory if it doesn't exist."""
    if directory and not os.path.exists(directory):
        os.makedirs(directory)
        print(f"Created directory: {directory}")


def main() -> int:
    image_path = DEFAULT_IMAGE_PATH
    output_path = None

    if len(sys.argv) > 1:
        image_path = sys.argv[1]

    if len(sys.argv) > 3 and sys.argv[2] in ["-o", "--output"]:
        output_path = sys.argv[3]

    if not os.path.exists(image_path):
        print(f"Error: File not found at '{image_path}'")
        print("\nUsage:")
        print("   python extract_ocr.py <image_path> [-o <output_path>]")
        print("\nExamples:")
        print("   python extract_ocr.py temp_uploads/my_image.jpg")
        print("   python extract_ocr.py my_doc.png -o results/output.json")
        return 1

    if output_path is None:
        output_path = os.path.join(DEFAULT_OUTPUT_DIR, f"{Path(image_path).stem}.json")

    output_dir = os.path.dirname(output_path)
    if output_dir:
        ensure_dir(output_dir)

    print("=" * 70)
    print("OCR EXTRACTION STARTED")
    print("=" * 70)
    print(f"Input:  {os.path.abspath(image_path)}")
    print(f"Output: {os.path.abspath(output_path)}")
    print("Processing... (this may take a few seconds)")
    print()

    try:
        result = process_document(image_path)

        print("OCR EXTRACTION COMPLETE")
        print("=" * 70)
        print("\nEXTRACTED TEXT:")
        print("-" * 70)
        print(result.get("raw_text", "")[:500])
        if len(result.get("raw_text", "")) > 500:
            print("... (truncated, see full text in output file)")
        print("-" * 70)

        print("\nSTRUCTURED DATA:")
        print("-" * 70)
        print(json.dumps(result.get("structured_data", {}), indent=2, ensure_ascii=False))
        print("-" * 70)

        with open(output_path, "w", encoding="utf-8") as file_handle:
            json.dump(result, file_handle, indent=2, ensure_ascii=False)

        print(f"\nFull output saved to: {os.path.abspath(output_path)}")
        print("=" * 70)
        return 0

    except Exception as exc:
        print("\nError during OCR processing:")
        print(f"   {exc}")
        print("\nTroubleshooting:")
        print("   1. Check if the document path and file are valid")
        print("   2. Ensure backend requirements are installed, including PyMuPDF and EasyOCR")
        print("   3. Try with a different image or PDF")
        import traceback

        print("\nFull error trace:")
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
