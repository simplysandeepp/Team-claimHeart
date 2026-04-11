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
from app.services.rag_1_ingestion import rag_1_ingestion_service
from app.agents.policy.policy_agent import agent_a2_policy

def extractor_agent(file_path):
    # 1. OCR Intake
    document_payload = extract_document_layout(file_path)
    raw_text = document_payload["raw_text"]

    # 2. Extract into Structure (now with confidence scoring)
    structured = parse_medical_text(raw_text, document_payload=document_payload)

    # 3. Route to Rag 1 (Patient Documents for Dr. Chats)
    # Using a dummy claim_id here, normally generated globally
    rag_1_response = rag_1_ingestion_service.ingest_patient_document(
        raw_text=raw_text, 
        document_payload=document_payload,
        claim_id="pending"
    )

    # 4. Route to Agent A2 (Policy Agent)
    unified_claim = build_unified_claim(structured)
    agent_a2_response = agent_a2_policy.evaluate_claim(unified_claim)

    return {
        "raw_text": raw_text,
        "structured_data": structured,
        "unified_claim": unified_claim,
        "rag_1_status": rag_1_response,
        "agent_a2_evaluation": agent_a2_response
    }
