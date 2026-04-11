from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, validator


class FraudDecision(str, Enum):
    APPROVE = "APPROVE"
    FLAG = "FLAG"
    REJECT = "REJECT"


class FraudSignal(BaseModel):
    code: str = Field(..., description="Stable machine-readable signal code.")
    weight: float = Field(..., ge=0, le=100, description="Risk contribution weight.")
    reason: str = Field(..., min_length=3, description="Human-readable explanation.")
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ClaimContext(BaseModel):
    claim_data: Dict[str, Any] = Field(default_factory=dict)
    policy_rules: List[Dict[str, Any]] = Field(default_factory=list)
    fraud_patterns: List[Dict[str, Any]] = Field(default_factory=list)
    ocr_text: Optional[str] = None
    ocr_confidence: Optional[float] = Field(default=None, ge=0, le=1)


class DecisionRequest(BaseModel):
    claim_data: Dict[str, Any] = Field(default_factory=dict)
    policy_rules: List[Dict[str, Any]] = Field(default_factory=list)
    fraud_patterns: List[Dict[str, Any]] = Field(default_factory=list)
    ocr_text: Optional[str] = None
    ocr_confidence: Optional[float] = Field(default=None, ge=0, le=1)

    def to_context(self) -> ClaimContext:
        return ClaimContext(
            claim_data=self.claim_data,
            policy_rules=self.policy_rules,
            fraud_patterns=self.fraud_patterns,
            ocr_text=self.ocr_text,
            ocr_confidence=self.ocr_confidence,
        )


class LLMDecisionPayload(BaseModel):
    decision: FraudDecision
    confidence: float = Field(..., ge=0, le=1)
    reasons: List[str] = Field(default_factory=list, min_items=1)

    @validator("reasons", pre=True, always=True)
    def normalize_reasons(cls, value: Any) -> List[str]:
        if value is None:
            return ["LLM response did not provide a reason."]
        if isinstance(value, str):
            value = [value]
        cleaned = [str(item).strip() for item in value if str(item).strip()]
        return cleaned or ["LLM response did not provide a reason."]


class DecisionResponse(BaseModel):
    decision: FraudDecision
    confidence: float = Field(..., ge=0, le=1)
    risk_score: int = Field(..., ge=0, le=100)
    reasons: List[str] = Field(default_factory=list)
    signals: List[FraudSignal] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)

    @validator("reasons", pre=True, always=True)
    def ensure_reason_list(cls, value: Any) -> List[str]:
        if value is None:
            return []
        if isinstance(value, str):
            value = [value]
        return [str(item).strip() for item in value if str(item).strip()]
