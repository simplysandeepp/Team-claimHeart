import json
from pathlib import Path

from app.tasks.extraction import process_document
from app.services.claim_builder import build_unified_claim
from app.services.rag_service import analyze_claim


FILE_PATH = "temp_uploads/sample_image1.png"
OUTPUT_DIR = Path("outputs")


def save_pipeline_output(file_path: str, payload: dict) -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_path = OUTPUT_DIR / f"{Path(file_path).stem}.json"
    with output_path.open("w", encoding="utf-8") as file_handle:
        json.dump(payload, file_handle, indent=2, ensure_ascii=False)
    return output_path


def main():
    print("\nRunning ClaimSmart Pipeline...\n")

    ocr_result = process_document(FILE_PATH)
    structured = ocr_result["structured_data"]

    print("STRUCTURED DATA:")
    print(structured)

    unified = build_unified_claim(structured)

    print("UNIFIED CLAIM:")
    print(unified)

    result = analyze_claim(unified)

    print("\n FINAL DECISION:")
    print(result)

    output_payload = {
        **ocr_result,
        "unified_claim": unified,
        "final_decision": result,
    }
    output_path = save_pipeline_output(FILE_PATH, output_payload)
    print(f"\nSaved pipeline output to: {output_path.resolve()}")


if __name__ == "__main__":
    main()
