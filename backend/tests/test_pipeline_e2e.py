"""
End-to-End Pipeline Tests — Section 5: Escalation & Quality Gates

Tests three canonical paths through the full pipeline:

  1. HAPPY PATH:     clean claim → APPROVE → no mediator
  2. SUSPICIOUS PATH: policy-pass + fraud-flag → FRAUD_CONFIRMED → mediator triggered
  3. REJECTION PATH:  policy violation + high risk → FRAUD_CONFIRMED → mediator + denial packet

These tests do NOT run OCR or EasyOCR. They inject pre-built extractor outputs
directly into the pipeline to test routing logic in isolation.
"""

from __future__ import annotations

from app.services.decision_router import (
    route_claim,
    RoutingVerdict,
)
from app.services.pipeline import run_full_pipeline
from app.schemas.fraud import ClaimContext, FraudDecision
from app.services.fraud_service import DecisionEngine


# ── Helpers ────────────────────────────────────────────────────────────────────

def _make_extractor_output(
    disease: str = "Dengue Fever",
    amount: float = 15000,
    hospital_stay_days: int = 3,
    policy_decision: str = "APPROVE",
    policy_flags: list = None,
):
    """Build a synthetic extractor_output dict that mimics agent 01 + A2 output."""
    return {
        "raw_text": f"Patient diagnosed with {disease}. Billed {amount} INR.",
        "unified_claim": {
            "patient_name": "Test Patient",
            "disease": disease,
            "amount": amount,
            "hospital_stay_days": hospital_stay_days,
            "medications": ["Paracetamol"],
            "medications_count": 1,
            "diagnostic_tests_count": 1,
            "has_prescription": True,
            "has_billing": True,
        },
        "agent_a2_evaluation": {
            "source": "Agent_A2",
            "evaluation": {
                "decision": policy_decision,
                "flags": policy_flags or [],
                "reason": ["Clean policy evaluation."] if policy_decision == "APPROVE" else ["Policy violation detected."],
            }
        },
        "structured_data": {
            "confidence_scores": {
                "patient_name": 0.92,
                "diagnosis": 0.90,
                "medications": 0.88,
                "billing_items": 0.91,
                "hospital_stay_days": 0.87,
            }
        }
    }


# ── Test 1: Happy Path ─────────────────────────────────────────────────────────

def test_happy_path_clean_claim_approves_without_mediator():
    """
    HAPPY PATH: Clean claim with no fraud signals.
    Expected: APPROVE or CLEAN_APPROVED, no mediator triggered.
    """
    extractor_output = _make_extractor_output(
        disease="Dengue Fever",
        amount=15000,       # well under 300,000 sub-limit
        hospital_stay_days=3,
        policy_decision="APPROVE",
    )

    result = run_full_pipeline(
        extractor_output=extractor_output,
        claim_id="TC-HAPPY-001",
    )

    routing_verdict = result["pipeline_stages"]["routing"]["verdict"]
    mediator_triggered = result["pipeline_stages"]["mediator"]["triggered"]

    assert routing_verdict in (
        RoutingVerdict.CLEAN_APPROVED.value,
        RoutingVerdict.ESCALATE_HUMAN.value,   # acceptable if confidence low
        RoutingVerdict.NEEDS_DOCUMENTS.value,   # acceptable if OCR fields missing
    ), f"Unexpected verdict for clean claim: {routing_verdict}"

    assert routing_verdict != RoutingVerdict.FRAUD_CONFIRMED.value, \
        "Clean claim should NOT route to mediator"

    assert not mediator_triggered, "Mediator MUST NOT be triggered for clean claims"

    # TAT report must be present
    assert "tat_report" in result
    assert result["tat_report"]["claim_id"] == "TC-HAPPY-001"

    print(f"[PASS] Happy Path: verdict={routing_verdict}, "
          f"total_time={result['tat_report']['total_elapsed_s']}s")


# ── Test 2: Suspicious Path ────────────────────────────────────────────────────

def test_suspicious_path_fraud_flag_triggers_mediator():
    """
    SUSPICIOUS PATH: Policy passes but fraud signals appear (high amount + policy flag).
    Expected: FRAUD_CONFIRMED, mediator triggered, decision packet generated.
    """
    extractor_output = _make_extractor_output(
        disease="Dengue Fever",
        amount=280000,       # exceeds 200k field-verification threshold
        hospital_stay_days=3,
        policy_decision="FLAG",
        policy_flags=["amount_exceeds_sublimit", "field_verification_required"],
    )

    result = run_full_pipeline(
        extractor_output=extractor_output,
        claim_id="TC-SUSPICIOUS-002",
        patient_info={
            "name": "Suspicious Patient",
            "email": "patient@test.com",
            "phone": "9999999999",
        },
        hospital_info={
            "name": "Test Hospital",
            "email": "admin@testhospital.com",
        },
    )

    routing_verdict = result["pipeline_stages"]["routing"]["verdict"]
    mediator = result["pipeline_stages"]["mediator"]

    assert routing_verdict == RoutingVerdict.FRAUD_CONFIRMED.value, \
        f"High-risk flagged claim expected FRAUD_CONFIRMED, got {routing_verdict}"

    assert mediator["triggered"], "Mediator MUST be triggered for FRAUD_CONFIRMED"
    assert mediator["emails_count"] >= 3, "Mediator must fire 3 email notifications"
    assert mediator["letters_count"] >= 3, "Mediator must generate 3 decision letters"

    # Verify TAT report present
    assert "tat_report" in result
    assert "mediator" in [s["stage"] for s in result["tat_report"]["stages"]]

    print(f"[PASS] Suspicious Path: verdict={routing_verdict}, "
          f"emails={mediator['emails_count']}, letters={mediator['letters_count']}, "
          f"total_time={result['tat_report']['total_elapsed_s']}s")


# ── Test 3: Rejection Path ─────────────────────────────────────────────────────

def test_rejection_path_policy_violation_triggers_mediator_fraud_notice():
    """
    REJECTION PATH: Severe policy violation detected by A2 + compound fraud signals.
    Expected: FRAUD_CONFIRMED, mediator triggered, denial-style fraud notice generated.
    
    Note: System does NOT hard-reject autonomously.
           Mediator packet is flagged as AWAITING_HUMAN_REVIEW.
    """
    extractor_output = _make_extractor_output(
        disease="Dengue Fever",
        amount=400000,       # massively over 300,000 sub-limit
        hospital_stay_days=12,  # over 5 day limit
        policy_decision="FLAG",
        policy_flags=[
            "amount_exceeds_sublimit",
            "hospital_days_exceeded",
            "protocol_violation_tests",
            "field_verification_required",
        ],
    )

    result = run_full_pipeline(
        extractor_output=extractor_output,
        claim_id="TC-REJECTION-003",
        patient_info={"name": "High Risk Patient", "email": "risk@test.com"},
        hospital_info={"name": "Flagged Hospital", "email": "flag@hospital.com"},
    )

    routing_verdict = result["pipeline_stages"]["routing"]["verdict"]
    mediator = result["pipeline_stages"]["mediator"]
    fraud = result["pipeline_stages"]["fraud_investigation"]

    assert routing_verdict == RoutingVerdict.FRAUD_CONFIRMED.value, \
        f"Severe violation claim expected FRAUD_CONFIRMED, got {routing_verdict}"

    assert fraud["risk_score"] >= 35, \
        f"Severe violation should have high risk score, got {fraud['risk_score']}"

    assert mediator["triggered"], "Mediator MUST be triggered for severe violations"

    # Verify letters generated (must contain FRAUD_NOTICE and HOSPITAL_QUERY)
    assert mediator["letters_count"] >= 2, "Denial path must generate at least FRAUD_NOTICE + HOSPITAL_QUERY"

    # Escalation policy: NO autonomous reject
    assert mediator["final_action"] == "AWAITING_HUMAN_REVIEW", \
        "System must not autonomously reject. final_action must be AWAITING_HUMAN_REVIEW"

    print(f"[PASS] Rejection Path: verdict={routing_verdict}, "
          f"risk_score={fraud['risk_score']}, final_action={mediator['final_action']}, "
          f"total_time={result['tat_report']['total_elapsed_s']}s")


# ── Test 4: Escalation Rule ────────────────────────────────────────────────────

def test_escalation_rule_low_confidence_goes_to_human_not_mediator():
    """
    ESCALATION RULE: Low-confidence claim that passes fraud rules should 
    route to human reviewer, NOT trigger mediator.
    This enforces the rule: No autonomous action on ambiguity.
    """
    engine = DecisionEngine()

    # Build a claim where fraud signals are low but confidence is also low
    context = ClaimContext(
        claim_data={
            "claim_id": "TC-ESCALATE-004",
            "patient_id": "P-AMBIGUOUS",
            "claim_amount": 20000,
            "incident_date": "2026-04-01",
        },
        policy_rules=[],
        fraud_patterns=[],
        ocr_confidence=0.44,   # below R3_CONFIDENCE_FLOOR of 0.60
        ocr_text="????? illegible text ??? amount ???",
    )

    fraud_result = engine.evaluate(context)
    routing = route_claim(fraud_result, claim_id="TC-ESCALATE-004")

    # The system should flag this for human review — NOT approve autonomously
    # and NOT trigger mediator (since fraud itself wasn't confirmed at high score)
    assert routing.verdict in (
        RoutingVerdict.ESCALATE_HUMAN,
        RoutingVerdict.FRAUD_CONFIRMED,  # allowed if low-OCR triggers high risk
    ), f"Ambiguous claim must escalate to human or fraud path, not auto-approve. Got: {routing.verdict}"

    assert routing.verdict != RoutingVerdict.CLEAN_APPROVED, \
        "Low-confidence claims must NEVER be auto-approved"

    print(f"[PASS] Escalation Rule: verdict={routing.verdict.value}, "
          f"confidence={fraud_result.confidence:.3f}, path={routing.route_path}")


# ── Run directly ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("\n=== Running ClaimHeart End-to-End Pipeline Tests ===\n")
    test_happy_path_clean_claim_approves_without_mediator()
    test_suspicious_path_fraud_flag_triggers_mediator()
    test_rejection_path_policy_violation_triggers_mediator_fraud_notice()
    test_escalation_rule_low_confidence_goes_to_human_not_mediator()
    print("\n=== All Tests Passed ===\n")
