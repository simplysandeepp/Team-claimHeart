import json
import logging
from pathlib import Path
from app.schemas.fraud import DecisionResponse

logger = logging.getLogger(__name__)

class MockDB2Repo:
    """
    Simulates writing Fraud Findings to the DB2 (Fraud DB) storage layer.
    Pending the integration of SQLAlchemy ORM, this writes to a local log.
    """
    
    def __init__(self):
        self.db_path = Path(__file__).resolve().parent.parent / "data" / "db2_mock.jsonl"

    def save_fraud_decision(self, claim_id: str, decision_response: DecisionResponse):
        payload = {
            "claim_id": claim_id,
            "decision": decision_response.decision.value,
            "confidence": decision_response.confidence,
            "risk_score": decision_response.risk_score,
            "reasons": decision_response.reasons,
            "signals": [s.dict() for s in decision_response.signals]
        }
        
        try:
            with self.db_path.open("a", encoding="utf-8") as f:
                f.write(json.dumps(payload) + "\n")
            logger.info(f"DB2 Write Success: Logged fraud decision for Claim {claim_id}")
        except Exception as e:
            logger.error(f"Failed to write to DB2 mock store: {e}")

db2_repo = MockDB2Repo()
