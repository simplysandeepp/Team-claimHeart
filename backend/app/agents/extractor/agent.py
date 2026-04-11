# from app.utils.ocr import extract_text_from_image
# from app.utils.parser import parse_medical_text


# def extractor_agent(file_path):
#     raw_text = extract_text_from_image(file_path)

#     # Parse structured data
#     parsed_data = parse_medical_text(raw_text)

#     return {
#         "raw_text": raw_text,
#         "structured_data": parsed_data
#     }

# from app.utils.ocr import extract_text_from_image
# from app.utils.parser import parse_medical_text as extract_structured_data

# def extractor_agent(file_path):
#     raw_text = extract_text_from_image(file_path)

#     structured = extract_structured_data(raw_text)

#     return {
#         "raw_text": raw_text,
#         "structured_data": structured
#     }


from app.utils.ocr import extract_document_layout
from app.utils.parser import parse_medical_text
from app.services.claim_builder import build_unified_claim
from app.services.rag_service import analyze_claim

def extractor_agent(file_path):
    document_payload = extract_document_layout(file_path)
    raw_text = document_payload["raw_text"]

    structured = parse_medical_text(raw_text, document_payload=document_payload)

    unified_claim = build_unified_claim(structured)
    rag_result = analyze_claim(unified_claim)

    return {
        "raw_text": raw_text,
        "structured_data": structured,
        "unified_claim": unified_claim,
        "analysis": rag_result
    }
