"""
Decision Routing — Nodes R5, R3, R4

This module is the core routing brain of the ClaimHeart pipeline.
It sits between Agent A3 (Fraud Investigator) and Agent 04 (Mediator).

Flow:
  Agent A3 output (DecisionResponse)
       │
       ▼
    ┌──────┐
    │  R5  │  ← Fraud Verdict Gate
    └──┬───┘
       │
  ┌────┴────┐
  │         │
  ▼         ▼
 YES       NO
  │         │
  │    ┌────┴────┐
  │    │  R3/R4  │  ← Clean Claim Handler
  │    └─────────┘
  │         │
  ▼         ▼
Mediator   Approve / Request Docs
"""

from __future__ import annotations

import logging
from enum import Enum
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, field

from app.schemas.fraud import DecisionResponse, FraudDecision

logger = logging.getLogger(__name__)


class RoutingVerdict(str, Enum):
    """The final routing outcome after R5 evaluation."""
    FRAUD_CONFIRMED = "FRAUD_CONFIRMED"         # R5 -> YES -> Mediator
    CLEAN_APPROVED = "CLEAN_APPROVED"            # R5 -> NO -> R3 -> Approve
    NEEDS_DOCUMENTS = "NEEDS_DOCUMENTS"          # R5 -> NO -> R4 -> Request more docs
    ESCALATE_HUMAN = "ESCALATE_HUMAN"            # Ambiguous -> Human reviewer


@dataclass
class RoutingResult:
    """Output of the Decision Routing pipeline."""
    verdict: RoutingVerdict
    claim_id: str
    risk_score: int
    confidence: float
    fraud_decision: str                          # Original A3 decision string
    route_path: List[str]                        # Trace of nodes visited
    action_required: str                         # Human-readable next action
    supplementary_data: Dict[str, Any] = field(default_factory=dict)


# ─── Thresholds ──────────────────────────────────────────────────────
# These thresholds define how each node evaluates the incoming signal.
# They are intentionally conservative: the system NEVER hard-rejects
# autonomously on ambiguity (per the escalation policy).

R5_FRAUD_RISK_THRESHOLD = 45       # risk_score >= this → YES (fraud detected)
R5_CLEAN_RISK_CEILING = 25         # risk_score < this → definitely NO
R3_CONFIDENCE_FLOOR = 0.60         # confidence >= this → auto-approve clean claim
R4_MISSING_SIGNAL_CODES = {        # If any of these signals fired, request documents
    "MISSING_CLAIM_ID",
    "MISSING_PATIENT_ID",
    "MISSING_CLAIM_AMOUNT",
    "MISSING_INCIDENT_DATE",
    "LOW_OCR_CONFIDENCE",
    "NOISY_OCR_TEXT",
}


def route_claim(fraud_output: DecisionResponse, claim_id: str = "UNKNOWN") -> RoutingResult:
    """
    Main entry point. Takes the Agent A3 DecisionResponse and determines
    the final routing verdict through nodes R5 → R3/R4.
    """
    route_path = []

    # ─── Node R5: Fraud Verdict Gate ────────────────────────────────
    route_path.append("R5_FRAUD_VERDICT")

    r5_verdict = _evaluate_r5(fraud_output)
    logger.info(f"[R5] Claim {claim_id} | risk={fraud_output.risk_score} | "
                f"decision={fraud_output.decision.value} | r5_verdict={r5_verdict}")

    if r5_verdict == "YES":
        # ─── Route YES → Mediator Agent ─────────────────────────────
        route_path.append("R5_YES")
        route_path.append("ROUTE_TO_MEDIATOR")

        return RoutingResult(
            verdict=RoutingVerdict.FRAUD_CONFIRMED,
            claim_id=claim_id,
            risk_score=fraud_output.risk_score,
            confidence=fraud_output.confidence,
            fraud_decision=fraud_output.decision.value,
            route_path=route_path,
            action_required="Trigger Mediator Agent: aggregate evidence, fire Email + OTP channels.",
            supplementary_data={
                "signals_count": len(fraud_output.signals),
                "reasons": fraud_output.reasons[:5],
            }
        )

    # ─── Route NO → Nodes R3 & R4 ──────────────────────────────────
    route_path.append("R5_NO")

    # Check if we need more documents (R4) before we can approve (R3)
    missing_signals = _detect_missing_document_signals(fraud_output)

    if missing_signals:
        # ─── Node R4: Request Additional Documents ──────────────────
        route_path.append("R4_NEEDS_DOCUMENTS")

        return RoutingResult(
            verdict=RoutingVerdict.NEEDS_DOCUMENTS,
            claim_id=claim_id,
            risk_score=fraud_output.risk_score,
            confidence=fraud_output.confidence,
            fraud_decision=fraud_output.decision.value,
            route_path=route_path,
            action_required=f"Request additional documents. Missing signals: {', '.join(missing_signals)}",
            supplementary_data={
                "missing_signals": missing_signals,
                "reasons": fraud_output.reasons[:5],
            }
        )

    # ─── Node R3: Clean Claim Confirmation ──────────────────────────
    route_path.append("R3_CLEAN_CLAIM")

    if fraud_output.confidence >= R3_CONFIDENCE_FLOOR:
        route_path.append("R3_AUTO_APPROVE")

        return RoutingResult(
            verdict=RoutingVerdict.CLEAN_APPROVED,
            claim_id=claim_id,
            risk_score=fraud_output.risk_score,
            confidence=fraud_output.confidence,
            fraud_decision=fraud_output.decision.value,
            route_path=route_path,
            action_required="Claim is clean. Auto-approve and proceed to settlement.",
            supplementary_data={
                "reasons": fraud_output.reasons[:5],
            }
        )
    else:
        # Confidence too low to auto-approve, escalate to human
        route_path.append("R3_ESCALATE_HUMAN")

        return RoutingResult(
            verdict=RoutingVerdict.ESCALATE_HUMAN,
            claim_id=claim_id,
            risk_score=fraud_output.risk_score,
            confidence=fraud_output.confidence,
            fraud_decision=fraud_output.decision.value,
            route_path=route_path,
            action_required="Confidence is below threshold. Escalate to Doctor / Verification Member for manual review.",
            supplementary_data={
                "confidence_floor": R3_CONFIDENCE_FLOOR,
                "reasons": fraud_output.reasons[:5],
            }
        )


def _evaluate_r5(fraud_output: DecisionResponse) -> str:
    """
    Node R5: The Fraud Verdict. 
    
    Returns "YES" if fraud is detected, "NO" otherwise.
    
    Logic:
    - If A3 explicitly said REJECT → YES 
    - If risk_score >= threshold → YES
    - If A3 said FLAG but risk is moderate → YES (conservative)
    - Otherwise → NO
    """
    if fraud_output.decision == FraudDecision.REJECT:
        return "YES"

    if fraud_output.risk_score >= R5_FRAUD_RISK_THRESHOLD:
        return "YES"

    if fraud_output.decision == FraudDecision.FLAG and fraud_output.risk_score >= R5_CLEAN_RISK_CEILING:
        # FLAG with moderate risk: still route to mediator for safety
        return "YES"

    return "NO"


def _detect_missing_document_signals(fraud_output: DecisionResponse) -> list:
    """
    Node R4 helper: scans fraud signals for any that indicate 
    incomplete or missing documentation.
    """
    missing = []
    for signal in fraud_output.signals:
        if signal.code in R4_MISSING_SIGNAL_CODES:
            missing.append(signal.code)
    return missing
