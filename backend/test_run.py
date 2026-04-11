from app.tasks.extraction import process_document
from app.services.claim_builder import build_unified_claim
from app.services.rag_service import analyze_claim


# Change img path accor to need...(thinking to use random in the temp uplode folder so each time we run the test it will pick a random image from the folder and run the pipeline on it, this will help us to test the pipeline on different types of documents and also to check the robustness of the pipeline.)
file_path = "temp_uploads/sample_image1.png"


def main():
    print("\nRunning ClaimSmart Pipeline...\n")

    #ocr+ pasring agent 1 (rag 1)
    ocr_result = process_document(file_path)

    structured = ocr_result["structured_data"]

    print("STRUCTURED DATA:")
    print(structured)

    # building a unified claim format... to be sent to rag agent for analysis and decision making
    unified = build_unified_claim(structured)

    print("UNIFIED CLAIM:")
    print(unified)

    #now data is send to agent 3 (rag 3)...
    result = analyze_claim(unified)

    print("\n FINAL DECISION:")
    print(result)


if __name__ == "__main__":
    main()