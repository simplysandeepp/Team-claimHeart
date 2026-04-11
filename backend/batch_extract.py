#!/usr/bin/env python3
"""
Batch OCR extraction for multiple images

Usage:
    python batch_extract.py                           # Process all images in temp_uploads/
    python batch_extract.py my_folder/                # Process all images in specific folder
"""

import json
import os
import sys
from datetime import datetime
from pathlib import Path

# Add the app directory to the path
sys.path.insert(0, os.path.dirname(__file__))

from app.tasks.extraction import process_document


# ============================================================================
# CONFIGURATION
# ============================================================================

DEFAULT_INPUT_DIR = "temp_uploads"      # 👈 Folder containing images to process
DEFAULT_OUTPUT_DIR = "outputs/batch"    # 👈 Where to save JSON outputs

SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".pdf"}

# ============================================================================


def ensure_dir(directory):
    """Create directory if it doesn't exist"""
    if not os.path.exists(directory):
        os.makedirs(directory)


def get_image_files(directory):
    """Get all image files from directory"""
    image_files = []
    
    if not os.path.exists(directory):
        return image_files
    
    for file in os.listdir(directory):
        file_path = os.path.join(directory, file)
        if os.path.isfile(file_path):
            ext = os.path.splitext(file)[1].lower()
            if ext in SUPPORTED_EXTENSIONS:
                image_files.append(file_path)
    
    return sorted(image_files)


def main():
    # Parse command line arguments
    input_dir = DEFAULT_INPUT_DIR
    output_dir = DEFAULT_OUTPUT_DIR
    
    if len(sys.argv) > 1:
        input_dir = sys.argv[1]
    
    # Validate input directory
    if not os.path.exists(input_dir):
        print(f"❌ Error: Directory not found: '{input_dir}'")
        return 1
    
    # Get all image files
    image_files = get_image_files(input_dir)
    
    if not image_files:
        print(f"❌ No image files found in '{input_dir}'")
        print(f"   Supported formats: {', '.join(SUPPORTED_EXTENSIONS)}")
        return 1
    
    # Ensure output directory exists
    ensure_dir(output_dir)
    
    # Process all images
    print("=" * 70)
    print("🔍 BATCH OCR EXTRACTION")
    print("=" * 70)
    print(f"📁 Input directory:  {os.path.abspath(input_dir)}")
    print(f"💾 Output directory: {os.path.abspath(output_dir)}")
    print(f"📊 Found {len(image_files)} image(s) to process")
    print("=" * 70)
    print()
    
    results_summary = []
    successful = 0
    failed = 0
    
    for idx, image_path in enumerate(image_files, 1):
        filename = os.path.basename(image_path)
        base_name = os.path.splitext(filename)[0]
        output_path = os.path.join(output_dir, f"{base_name}_ocr.json")
        
        print(f"[{idx}/{len(image_files)}] Processing: {filename}")
        
        try:
            # Process the image
            result = process_document(image_path)
            
            # Save output
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(result, f, indent=2, ensure_ascii=False)
            
            # Extract summary info
            text_length = len(result.get("raw_text", ""))
            structured = result.get("structured_data", {})
            
            print(f"   ✅ Success - Extracted {text_length} characters")
            print(f"   💾 Saved to: {output_path}")
            
            results_summary.append({
                "filename": filename,
                "status": "success",
                "output_file": output_path,
                "text_length": text_length,
                "structured_data": structured
            })
            
            successful += 1
            
        except Exception as e:
            print(f"   ❌ Failed - {str(e)}")
            
            results_summary.append({
                "filename": filename,
                "status": "failed",
                "error": str(e)
            })
            
            failed += 1
        
        print()
    
    # Save summary
    summary_path = os.path.join(output_dir, f"_summary_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json")
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump({
            "timestamp": datetime.now().isoformat(),
            "input_directory": input_dir,
            "output_directory": output_dir,
            "total_files": len(image_files),
            "successful": successful,
            "failed": failed,
            "results": results_summary
        }, f, indent=2, ensure_ascii=False)
    
    # Print summary
    print("=" * 70)
    print("📊 BATCH PROCESSING COMPLETE")
    print("=" * 70)
    print(f"✅ Successful: {successful}")
    print(f"❌ Failed:     {failed}")
    print(f"📁 Total:      {len(image_files)}")
    print(f"\n💾 Summary saved to: {summary_path}")
    print("=" * 70)
    
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
