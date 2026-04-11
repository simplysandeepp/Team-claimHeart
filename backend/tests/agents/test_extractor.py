from app.core.ocr_engine import ClaimHeartOCR
from app.services.extractor_agent import ExtractorAgent

def test_claimheart_pipeline(image_path):
    print(f"\n Testing ClaimHeart Intelligent Pipeline")
    
    # Initialize components
    ocr = ClaimHeartOCR()
    agent = ExtractorAgent()

    # 1. OCR Stage (Image to Text)
    print("Scanning document...")
    raw_text = ocr.extract_from_image(image_path)
    
    # 2. Intelligence Stage (Auto-classify & Structure)
    print("Analyzing document structure...")
    final_json = agent.structure_text(raw_text)

    print("\nEXTRACTION COMPLETE:")
    print(final_json)

if __name__ == "__main__":
    test_claimheart_pipeline(r"app\docs\image.png")