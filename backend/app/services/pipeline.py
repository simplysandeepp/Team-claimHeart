"""
Pipeline Orchestrator - End-to-End Claim Processing

This is the master orchestrator that chains:
  Agent 01 (Extractor) -> Agent A2 (Policy) -> Agent A3 (Fraud) -> Router (R5/R3/R4) -> Agent 04 (Mediator)

It represents the full claim lifecycle from document upload to final decision.
"""

from __future__ import annotations

import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, Optional

from app.agents.mediator.agent import mediator_agent
from app.schemas.fraud import ClaimContext, DecisionResponse
from app.services.decision_router import RoutingResult, RoutingVerdict, route_claim
from app.services.fraud_service import DecisionEngine
from app.services.rag_1_ingestion import rag_1_ingestion_service
from app.services.rag_2_ingestion import rag_2_ingestion_service
from app.services.tat_monitor import TATMonitor
from app.utils.policy_loader import get_policy_data


logger = logging.getLogger(__name__)

# Reuse single engine and executor instances.
_fraud_engine = DecisionEngine()
_rag_executor = ThreadPoolExecutor(max_workers=2)


def _ingest_patient_rag(raw_text: str, document_payload: Dict[str, Any], claim_id: str) -> Dict[str, Any]:
    return rag_1_ingestion_service.ingest_patient_document(
        raw_text=raw_text,
        document_payload=document_payload,
        claim_id=claim_id,
    )


def _ingest_policy_rag() -> Dict[str, Any]:
    return rag_2_ingestion_service.ingest_policy_document(get_policy_data())


async def _run_rag_ingestion_tasks(
    raw_text: str,
    document_payload: Dict[str, Any],
    claim_id: str,
) -> list[object]:
    loop = asyncio.get_running_loop()
    rag_1_task = loop.run_in_executor(
        _rag_executor,
        _ingest_patient_rag,
        raw_text,
        document_payload,
        claim_id,
    )
    rag_2_task = loop.run_in_executor(_rag_executor, _ingest_policy_rag)
    return await asyncio.gather(rag_1_task, rag_2_task, return_exceptions=True)


def _run_parallel_rag_ingestion(
    raw_text: str,
    document_payload: Dict[str, Any],
    claim_id: str,
) -> list[object]:
    def runner() -> list[object]:
        return asyncio.run(_run_rag_ingestion_tasks(raw_text, document_payload, claim_id))

    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return runner()

    with ThreadPoolExecutor(max_workers=1) as loop_executor:
        return loop_executor.submit(runner).result()


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

    tat = TATMonitor(claim_id)

    unified_claim = extractor_output.get("unified_claim", {})
    a2_evaluation = extractor_output.get("agent_a2_evaluation", {})
    structured_data = extractor_output.get("structured_data", {})
    raw_text = extractor_output.get("raw_text", "")
    document_payload = extractor_output.get("document_payload", {})

    rag_ingestion_results = _run_parallel_rag_ingestion(
        raw_text=raw_text,
        document_payload=document_payload,
        claim_id=claim_id,
    )
    for service_name, result in zip(("RAG 1", "RAG 2"), rag_ingestion_results):
        if isinstance(result, Exception):
            logger.warning("[PIPELINE] %s ingestion failed for %s: %s", service_name, claim_id, result)
        else:
            logger.info("[PIPELINE] %s ingestion result for %s: %s", service_name, claim_id, result)

    fraud_context = ClaimContext(
        claim_data={
            "claim_id": claim_id,
            "patient_id": unified_claim.get("patient_name", ""),
            "claim_amount": unified_claim.get("amount"),
            "diagnosis": unified_claim.get("disease", ""),
            "hospital_stay_days": unified_claim.get("hospital_stay_days", 0),
            "incident_date": None,
            "previous_claims": [],
        },
        policy_rules=[a2_evaluation.get("evaluation", {})] if a2_evaluation else [],
        fraud_patterns=[],
        ocr_text=raw_text,
        ocr_confidence=_avg_confidence(structured_data.get("confidence_scores", {})),
    )

    with tat.track("fraud_investigation"):
        fraud_decision: DecisionResponse = _fraud_engine.evaluate(fraud_context)
    logger.info(
        "[PIPELINE] A3 Fraud result for %s: decision=%s, risk=%s",
        claim_id,
        fraud_decision.decision.value,
        fraud_decision.risk_score,
    )

    with tat.track("decision_routing"):
        routing: RoutingResult = route_claim(fraud_decision, claim_id=claim_id)
    logger.info(
        "[PIPELINE] Router verdict for %s: %s via %s",
        claim_id,
        routing.verdict.value,
        " -> ".join(routing.route_path),
    )

    if routing.verdict == RoutingVerdict.ESCALATE_HUMAN:
        logger.warning(
            "[PIPELINE] Claim %s escalated to human reviewer. Confidence=%s below threshold. "
            "Pipeline halted - no autonomous action.",
            claim_id,
            fraud_decision.confidence,
        )

    mediator_packet = None
    if routing.verdict == RoutingVerdict.FRAUD_CONFIRMED:
        logger.info("[PIPELINE] Triggering Mediator Agent for %s", claim_id)
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

    tat_report = tat.finalize()
    result["tat_report"] = tat_report.to_dict()

    return result


def _avg_confidence(scores: Dict[str, float]) -> Optional[float]:
    """Average the per-field confidence scores into a single OCR confidence."""
    if not scores:
        return None
    values = [value for value in scores.values() if isinstance(value, (int, float))]
    return round(sum(values) / len(values), 4) if values else None
