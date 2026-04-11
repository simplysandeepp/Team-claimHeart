from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_fraud_decision_endpoint_returns_strict_json_shape() -> None:
    response = client.post(
        "/api/fraud/decision",
        json={
            "claim_data": {
                "claim_id": "C-500",
                "patient_id": "P-500",
                "claim_amount": 3000,
                "incident_date": "2026-04-06",
            },
            "policy_rules": [],
            "fraud_patterns": [],
            "ocr_confidence": 0.98,
            "ocr_text": "Structured OCR text",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) == {"decision", "confidence", "risk_score", "reasons", "signals", "metadata"}
    assert body["decision"] in {"APPROVE", "FLAG", "REJECT"}
    assert isinstance(body["confidence"], float)
    assert isinstance(body["risk_score"], int)
    assert isinstance(body["reasons"], list)
