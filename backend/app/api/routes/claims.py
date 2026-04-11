from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.rag_1_ingestion import rag_1_ingestion_service
from app.services.rag_2_ingestion import rag_2_ingestion_service


router = APIRouter()


class PatientChatRequest(BaseModel):
    claim_id: str = Field(..., description="Claim identifier for patient-specific retrieval.")
    question: str = Field(..., description="Doctor's question about the patient.")


class PolicyChatRequest(BaseModel):
    question: str = Field(..., description="Patient question about policy coverage.")


@router.post("/patient-chat")
def patient_chat(request: PatientChatRequest) -> dict:
    return rag_1_ingestion_service.query_patient_context_with_sources(
        question=request.question,
        claim_id=request.claim_id,
    )


@router.post("/policy-chat")
def policy_chat(request: PolicyChatRequest) -> dict:
    return {
        "answer": rag_2_ingestion_service.query_policy(request.question),
        "policy_id": rag_2_ingestion_service.default_policy_id,
    }
