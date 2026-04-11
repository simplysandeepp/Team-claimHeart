from app.schemas.fraud import ClaimContext, FraudDecision
from app.services.fraud_service import DecisionEngine


class StubLLMClient:
    def __init__(self, response: str) -> None:
        self._response = response

    def complete(self, prompt: str) -> str:
        assert '"json_schema"' in prompt
        return self._response


def test_decision_engine_approves_low_risk_claim() -> None:
    engine = DecisionEngine(
        llm_client=StubLLMClient(
            '{"decision":"APPROVE","confidence":0.93,"reasons":["Claim data is consistent with policy."]}'
        )
    )

    result = engine.evaluate(
        ClaimContext(
            claim_data={
                "claim_id": "C-100",
                "patient_id": "P-100",
                "claim_amount": 1200,
                "incident_date": "2026-04-05",
            },
            policy_rules=[],
            fraud_patterns=[],
            ocr_confidence=0.97,
            ocr_text="Invoice total 1200 paid by insurer 900.",
        )
    )

    assert result.decision == FraudDecision.APPROVE
    assert result.risk_score < 35
    assert result.confidence > 0.7


def test_decision_engine_flags_when_llm_json_is_invalid() -> None:
    engine = DecisionEngine(llm_client=StubLLMClient("not-json"))

    result = engine.evaluate(
        ClaimContext(
            claim_data={
                "claim_id": "C-200",
                "patient_id": "P-200",
                "claim_amount": 15000,
            },
            policy_rules=[],
            fraud_patterns=[],
            ocr_confidence=0.92,
            ocr_text="Clean OCR text",
        )
    )

    assert result.decision == FraudDecision.FLAG
    assert "LLM unavailable; used deterministic rule-based fallback." in result.reasons


def test_decision_engine_flags_when_input_quality_is_low() -> None:
    engine = DecisionEngine(
        llm_client=StubLLMClient(
            '{"decision":"APPROVE","confidence":0.99,"reasons":["No fraud evidence found."]}'
        )
    )

    result = engine.evaluate(
        ClaimContext(
            claim_data={
                "claim_id": "",
                "patient_id": "P-300",
                "claim_amount": "",
            },
            policy_rules=[],
            fraud_patterns=[],
            ocr_confidence=0.41,
            ocr_text="?? ??? illegible",
        )
    )

    assert result.decision == FraudDecision.FLAG
    assert result.risk_score >= 30
    assert any(reason.startswith("Claim identifier is missing.") for reason in result.reasons)


def test_decision_engine_rejects_high_risk_claim() -> None:
    engine = DecisionEngine(
        llm_client=StubLLMClient(
            '{"decision":"REJECT","confidence":0.91,"reasons":["Multiple policy and fraud indicators matched."]}'
        )
    )

    result = engine.evaluate(
        ClaimContext(
            claim_data={
                "claim_id": "C-400",
                "patient_id": "P-400",
                "claim_amount": 98000,
                "approved_amount": 20000,
                "incident_date": "2026-04-01",
            },
            policy_rules=[
                {"status": "VIOLATION", "reason": "Procedure excluded under policy."},
                {"status": "VIOLATION", "reason": "Pre-authorization missing."},
            ],
            fraud_patterns=[
                {"code": "DUPLICATE_BILLING", "severity": "HIGH", "reason": "Billing pattern matches prior duplicate claim."},
                {"code": "PROVIDER_WATCHLIST", "severity": "HIGH", "reason": "Provider appears on watchlist."},
            ],
            ocr_confidence=0.95,
            ocr_text="Readable invoice text",
        )
    )

    assert result.decision == FraudDecision.REJECT
    assert result.risk_score >= 85
