from __future__ import annotations

import os
from functools import lru_cache

from fastapi import APIRouter

from app.schemas.fraud import DecisionRequest, DecisionResponse
from app.services.fraud_service import DecisionEngine, OpenAIDecisionClient

router = APIRouter()


@lru_cache(maxsize=1)
def get_decision_engine() -> DecisionEngine:
    api_key = os.getenv("OPENAI_API_KEY")
    if api_key:
        return DecisionEngine(llm_client=OpenAIDecisionClient(api_key=api_key))
    return DecisionEngine()


@router.post("/decision", response_model=DecisionResponse)
async def evaluate_claim_fraud(request: DecisionRequest) -> DecisionResponse:
    engine = get_decision_engine()
    return engine.evaluate(request.to_context())
