import logging
from app.services.rag_service import analyze_claim

logger = logging.getLogger(__name__)

class PolicyAgent:
    """
    Agent A2 — Policy Agent.
    Cross-references extracted patient data against policy rules.
    """
    
    def __init__(self):
        pass

    def evaluate_claim(self, unified_claim: dict) -> dict:
        """
        Receives OCR structured data + unified claim data.
        Evaluates against Policy Database / Mock Policies.
        """
        logger.info(f"Agent A2 (Policy Agent) evaluating claim with disease: {unified_claim.get('disease')}")
        
        # We hand off to the rag_service check (which will be refactored to support new structure)
        analysis_result = analyze_claim(unified_claim)
        
        return {
            "source": "Agent_A2",
            "evaluation": analysis_result
        }

agent_a2_policy = PolicyAgent()
