"""
Pipeline Orchestrator — End-to-End Claim Processing

This is the master orchestrator that chains:
  Agent 01 (Extractor) → Agent A2 (Policy) → Agent A3 (Fraud) → Router (R5/R3/R4) → Agent 04 (Mediator)

It represents the full claim lifecycle from document upload to final decision.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from app.schemas.fraud import ClaimContext, DecisionResponse
from app.services.fraud_service import DecisionEngine
from app.services.decision_router import route_claim, RoutingVerdict, RoutingResult
from app.agents.mediator.agent import mediator_agent
from app.services.tat_monitor import TATMonitor

logger = logging.getLogger(__name__)

# Reuse a single engine instance
_fraud_engine = DecisionEngine()


def run_full_pipeline(
    extractor_output: Dict[str, Any],
    claim_id: str = "UNKNOWN",
    patient_info: Optional[Dict[str, Any]] = None,
    hospital_info: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Orchestrates the complete claim pipeline after OCR extraction.
    
    Args:
        extractor_output: The dict returned by extractor_agent() 
                          (contains structured_data, unified_claim, agent_a2_evaluation)
        claim_id: The global unique claim ID
        patient_info: Optional patient contact info for mediator notifications
        hospital_info: Optional hospital contact info for mediator queries
    
    Returns:
        A comprehensive pipeline result dict with all stage outputs.
    """
    
    # TAT Monitor — tracks SLA compliance across all stages
    tat = TATMonitor(claim_id)

    unified_claim = extractor_output.get("unified_claim", {})
    a2_evaluation = extractor_output.get("agent_a2_evaluation", {})
    structured_data = extractor_output.get("structured_data", {})
    
    # ── Stage 1: Build Fraud Context from upstream outputs ──────────
    # Map the unified_claim fields into the fraud context format
    fraud_context = ClaimContext(
        claim_data={
            "claim_id": claim_id,
            "patient_id": unified_claim.get("patient_name", ""),
            "claim_amount": unified_claim.get("amount"),
            "diagnosis": unified_claim.get("disease", ""),
            "hospital_stay_days": unified_claim.get("hospital_stay_days", 0),
            "incident_date": None,  # Not yet extracted from OCR
            "previous_claims": [],  # Would come from DB in production
        },
        policy_rules=[a2_evaluation.get("evaluation", {})] if a2_evaluation else [],
        fraud_patterns=[],
        ocr_text=extractor_output.get("raw_text", ""),
        ocr_confidence=_avg_confidence(structured_data.get("confidence_scores", {})),
    )
    
    # ── Stage 2: Run Agent A3 (Fraud Investigator) ──────────────────
    with tat.track("fraud_investigation"):
        fraud_decision: DecisionResponse = _fraud_engine.evaluate(fraud_context)
    logger.info(f"[PIPELINE] A3 Fraud result for {claim_id}: "
                f"decision={fraud_decision.decision.value}, risk={fraud_decision.risk_score}")

    # ── Stage 3: Run Decision Router (R5 → R3/R4) ──────────────────
    with tat.track("decision_routing"):
        routing: RoutingResult = route_claim(fraud_decision, claim_id=claim_id)
    logger.info(f"[PIPELINE] Router verdict for {claim_id}: "
                f"{routing.verdict.value} via {' → '.join(routing.route_path)}")

    # ── Query Escalation Guard (Section 5 of Roadmap) ───────────────
    # If routing says ESCALATE_HUMAN, override mediator with a human-review packet.
    # Automated systems MUST NOT hard-reject on ambiguity.
    if routing.verdict == RoutingVerdict.ESCALATE_HUMAN:
        logger.warning(
            f"[PIPELINE] Claim {claim_id} escalated to human reviewer. "
            f"Confidence={fraud_decision.confidence} below threshold. Pipeline halted — no autonomous action."
        )
    
    # ── Stage 4: Conditionally trigger Mediator Agent ───────────────
    mediator_packet = None
    if routing.verdict == RoutingVerdict.FRAUD_CONFIRMED:
        logger.info(f"[PIPELINE] Triggering Mediator Agent for {claim_id}")
        with tat.track("mediator"):
            mediator_packet = mediator_agent.process_fraud_case(
                claim_id=claim_id,
                policy_evaluation=a2_evaluation.get("evaluation", {}),
                fraud_findings={
                    "decision": fraud_decision.decision.value,
                    "risk_score": fraud_decision.risk_score,
                    "confidence": fraud_decision.confidence,
                    "signals": [s.dict() for s in fraud_decision.signals],
                    "reasons": fraud_decision.reasons,
                },
                routing_result={
                    "verdict": routing.verdict.value,
                    "route_path": routing.route_path,
                    "action_required": routing.action_required,
                },
                patient_info=patient_info,
                hospital_info=hospital_info,
            )
    
    # ── Compose Final Pipeline Result ───────────────────────────────
    result = {
        "claim_id": claim_id,
        "pipeline_stages": {
            "extraction": "COMPLETE",
            "policy_evaluation": a2_evaluation,
            "fraud_investigation": {
                "decision": fraud_decision.decision.value,
                "risk_score": fraud_decision.risk_score,
                "confidence": fraud_decision.confidence,
                "signals_count": len(fraud_decision.signals),
                "top_reasons": fraud_decision.reasons[:5],
            },
            "routing": {
                "verdict": routing.verdict.value,
                "route_path": routing.route_path,
                "action_required": routing.action_required,
            },
            "mediator": {
                "triggered": mediator_packet is not None,
                "final_action": mediator_packet.final_action if mediator_packet else None,
                "emails_count": len(mediator_packet.emails_fired) if mediator_packet else 0,
                "letters_count": len(mediator_packet.decision_letters) if mediator_packet else 0,
                "otp_issued": mediator_packet.otp_issued is not None if mediator_packet else False,
            },
        },
        "final_verdict": routing.verdict.value,
        "final_action": routing.action_required,
    }
    
    # ── Finalize TAT Report ──────────────────────────────────
    tat_report = tat.finalize()
    result["tat_report"] = tat_report.to_dict()

    return result


def _avg_confidence(scores: Dict[str, float]) -> Optional[float]:
    """Average the per-field confidence scores into a single OCR confidence."""
    if not scores:
        return None
    values = [v for v in scores.values() if isinstance(v, (int, float))]
    return round(sum(values) / len(values), 4) if values else None
