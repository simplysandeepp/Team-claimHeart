from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app
from app.services import workflow_service as workflow_module


client = TestClient(app)


def test_workflow_api_end_to_end(tmp_path: Path) -> None:
    original_path = workflow_module._STORE.path
    workflow_module._STORE.path = tmp_path / "platform_state.json"

    try:
        patient_response = client.post(
            "/api/auth/signup",
            json={
                "name": "Aarav Sharma",
                "email": "aarav@example.com",
                "phone": "9999999999",
                "password": "StrongPass123",
                "role": "patient",
                "policyNumber": "POL-2026-1001",
                "policyName": "Care Comprehensive",
                "policyType": "individual",
                "policyStartDate": "2024-03-10",
            },
        )
        assert patient_response.status_code == 200
        patient = patient_response.json()

        hospital_response = client.post(
            "/api/auth/signup",
            json={
                "name": "City Care Hospital, Mumbai",
                "email": "ops@citycare.example.com",
                "phone": "8888888888",
                "password": "StrongPass123",
                "role": "hospital",
                "hospitalRegistrationId": "MH-HOSP-2026-101",
                "npi": "NPI-100200300",
            },
        )
        assert hospital_response.status_code == 200

        insurer_response = client.post(
            "/api/auth/signup",
            json={
                "name": "ClaimHeart Insurance Desk",
                "email": "insurer@example.com",
                "phone": "7777777777",
                "password": "StrongPass123",
                "role": "insurer",
                "gstNumber": "27ABCDE1234F1Z5",
                "panNumber": "ABCDE1234F",
                "address": "Mumbai",
                "irdaiLicenseNumber": "IRDAI-2026-9090",
            },
        )
        assert insurer_response.status_code == 200
        insurer = insurer_response.json()

        login_response = client.post(
            "/api/auth/login",
            json={
                "email": "aarav@example.com",
                "password": "StrongPass123",
                "role": "patient",
            },
        )
        assert login_response.status_code == 200
        assert login_response.json()["id"] == patient["id"]

        claim_response = client.post(
            "/api/workflow/claims",
            json={
                "patientId": patient["patientId"],
                "patientName": patient["name"],
                "patientEmail": patient["email"],
                "hospital": "City Care Hospital, Mumbai",
                "caseType": "emergency",
                "serviceType": "cashless",
                "diagnosis": "Dengue Fever with Thrombocytopenia",
                "icdCode": "A97.1",
                "amount": 22150,
                "documents": [
                    {
                        "name": "prescription-arjun.pdf",
                        "type": "application/pdf",
                        "size": 1024,
                        "uploadedAt": "2026-04-12T10:00:00Z",
                        "uploadedBy": "hospital",
                        "category": "Prescription",
                        "previewText": "Prescription for dengue treatment.",
                        "processingStatus": "ready",
                    },
                    {
                        "name": "billing-arjun.pdf",
                        "type": "application/pdf",
                        "size": 2048,
                        "uploadedAt": "2026-04-12T10:02:00Z",
                        "uploadedBy": "hospital",
                        "category": "Billing",
                        "previewText": "Billing invoice for dengue admission.",
                        "processingStatus": "ready",
                    },
                ],
                "workflowCaseId": "case-2",
                "caseLabel": "Manual review",
                "policyNumber": patient["policyNumber"],
                "policyStartDate": patient["policyStartDate"],
                "insurerName": insurer["name"],
            },
        )
        assert claim_response.status_code == 200
        claim = claim_response.json()
        assert claim["claimProcessId"].startswith("Id-claim")
        assert claim["status"] == "pending"

        pipeline_response = client.post(f"/api/workflow/claims/{claim['id']}/run-pipeline")
        assert pipeline_response.status_code == 200
        pipeline_body = pipeline_response.json()
        assert pipeline_body["claim"]["workflowState"] == "completed"
        assert pipeline_body["claim"]["aiResults"]["policy"]["status"] in {"pass", "flag"}
        assert pipeline_body["claim"]["aiResults"]["medical"]["status"] in {"pass", "flag"}
        assert pipeline_body["claim"]["aiResults"]["cross"]["status"] in {"pass", "flag"}

        decision_response = client.post(
            f"/api/workflow/claims/{claim['id']}/decision",
            json={
                "status": "approved",
                "note": "Final insurer approval issued after workflow review.",
            },
        )
        assert decision_response.status_code == 200
        decided_claim = decision_response.json()
        assert decided_claim["status"] == "approved"
        assert decided_claim["emails"]
        assert decided_claim["decisionLetter"]

        bootstrap_response = client.get(
            "/api/workflow/bootstrap",
            params={
                "role": "patient",
                "user_id": patient["id"],
                "patient_id": patient["patientId"],
            },
        )
        assert bootstrap_response.status_code == 200
        bootstrap = bootstrap_response.json()
        assert len(bootstrap["claims"]) == 1
        assert len(bootstrap["notifications"]) >= 1

        read_all_response = client.post(
            "/api/workflow/notifications/read-all",
            params={
                "role": "patient",
                "user_id": patient["patientId"],
                "patient_id": patient["patientId"],
            },
        )
        assert read_all_response.status_code == 200
        assert read_all_response.json()["updated"] >= 0
    finally:
        workflow_module._STORE.path = original_path
