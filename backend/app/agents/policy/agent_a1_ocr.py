import logging
from app.utils.policy_loader import get_policy_data
from app.services.rag_2_ingestion import rag_2_ingestion_service

logger = logging.getLogger(__name__)

class PolicyOCRAgent:
    """
    Agent A1 — Policy OCR Agent.
    Simulates OCR extraction of Policy documents by loading and validating the canonical
    mock_policies.json struct, and routes it to RAG 2 to power the Policy Chatbot.
    """
    def __init__(self):
        pass

    def extract_and_route_policy(self) -> dict:
        """
        Retrieves the hard-coded JSON (which represents the 100% accurate OCR output of policy info),
        and pipes it into the RAG 2 engine.
        """
        logger.info("Agent A1 initiated: Extracting policy structure.")
        
        # This loader features the lru_cache and structural validation
        structured_policy_json = get_policy_data()
        
        # Route the extracted data to Rag 2 Service
        rag_2_response = rag_2_ingestion_service.ingest_policy_document(structured_policy_json)
        
        return {
            "agent": "Agent_A1",
            "extraction_status": "success",
            "document_count": len(structured_policy_json.keys()),
            "routing_status": rag_2_response
        }

agent_a1_ocr = PolicyOCRAgent()
