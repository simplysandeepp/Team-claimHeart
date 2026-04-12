from __future__ import annotations

import base64
import hashlib
import hmac
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from uuid import uuid4

from fastapi import HTTPException

from app.schemas.platform import (
    AddCommentRequest,
    AddDocumentRequest,
    AgentResult,
    AppUser,
    BootstrapResponse,
    ClaimAiResults,
    ClaimCreateRequest,
    ClaimDecisionRequest,
    ClaimDocumentRequest,
    ClaimEmail,
    ClaimRecord,
    Comment,
    LoginRequest,
    NotificationRecord,
    ProfileUpdateRequest,
    SignupRequest,
    TimelineEntry,
    UploadedDocument,
    UserRecord,
    WorkflowAuditEntry,
)
from app.services.pipeline import run_full_pipeline
from app.services.platform_store import PlatformStore


logger = logging.getLogger(__name__)

_BASE_DIR = Path(__file__).resolve().parents[1]
_STORE = PlatformStore(_BASE_DIR / "data" / "platform_state.json")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _optional(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    trimmed = value.strip()
    return trimmed or None


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _pending_agent(reason: str) -> AgentResult:
    return AgentResult(status="pending", reason=reason)


def _normalize_diagnosis(diagnosis: Optional[str]) -> str:
    cleaned = (diagnosis or "").strip()
    lowered = cleaned.lower()
    if "dengue" in lowered:
        return "Dengue Fever"
    if "febrile" in lowered:
        return "Acute Febrile Illness"
    if "appendic" in lowered:
        return "Appendicitis and Appendectomy"
    if "typhoid" in lowered:
        return "Typhoid Fever"
    return cleaned


def _hash_password(password: str) -> str:
    salt = os.urandom(16)
    rounds = 200_000
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, rounds)
    return f"{rounds}${base64.b64encode(salt).decode()}${base64.b64encode(digest).decode()}"


def _verify_password(password: str, stored_hash: str) -> bool:
    try:
        rounds_raw, salt_raw, digest_raw = stored_hash.split("$", 2)
        rounds = int(rounds_raw)
        salt = base64.b64decode(salt_raw.encode())
        expected = base64.b64decode(digest_raw.encode())
    except Exception:
        return False

    candidate = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, rounds)
    return hmac.compare_digest(candidate, expected)


def _user_prefix(role: str) -> str:
    return {
        "patient": "P",
        "hospital": "H",
        "insurer": "I",
    }[role]


def _user_id(role: str) -> str:
    return f"{_user_prefix(role)}-{uuid4().hex[:8].upper()}"


def _claim_id() -> str:
    return f"CLM-{uuid4().hex[:8].upper()}"


def _claim_process_id() -> str:
    return f"Id-claim{uuid4().hex[:6]}"


def _notification_id() -> str:
    return f"N-{uuid4().hex[:10].upper()}"


def _comment_id() -> str:
    return f"COM-{uuid4().hex[:10].upper()}"


def _email_id() -> str:
    return f"MAIL-{uuid4().hex[:10].upper()}"


def _state() -> Dict[str, Any]:
    return _STORE.load()


def _save(state: Dict[str, Any]) -> None:
    _STORE.save(state)


def _user_from_dict(record: Dict[str, Any]) -> AppUser:
    sanitized = dict(record)
    sanitized.pop("passwordHash", None)
    return AppUser(**sanitized)


def _claim_from_dict(record: Dict[str, Any]) -> ClaimRecord:
    return ClaimRecord(**record)


def _notification_from_dict(record: Dict[str, Any]) -> NotificationRecord:
    return NotificationRecord(**record)


def _find_user_record(state: Dict[str, Any], user_id: str) -> Dict[str, Any]:
    record = next((item for item in state["users"] if item["id"] == user_id), None)
    if not record:
        raise HTTPException(status_code=404, detail="User not found.")
    return record


def _find_claim_record(state: Dict[str, Any], claim_id: str) -> Dict[str, Any]:
    record = next((item for item in state["claims"] if item["id"] == claim_id), None)
    if not record:
        raise HTTPException(status_code=404, detail="Claim not found.")
    return record


def _add_notification(
    state: Dict[str, Any],
    *,
    target_role: str,
    title: str,
    message: str,
    claim_id: Optional[str] = None,
    target_user_id: Optional[str] = None,
    notification_type: str = "info",
) -> None:
    notification = NotificationRecord(
        id=_notification_id(),
        targetRole=target_role,  # type: ignore[arg-type]
        targetUserId=target_user_id,
        claimId=claim_id,
        title=title,
        message=message,
        type=notification_type,  # type: ignore[arg-type]
        read=False,
        time=_now_iso(),
    )
    state["notifications"].insert(0, notification.dict())


def _append_timeline(claim_record: Dict[str, Any], label: str, actor: str) -> None:
    claim_record["timeline"].append(
        TimelineEntry(label=label, time=_now_iso(), actor=actor).dict()  # type: ignore[arg-type]
    )


def _append_audit(claim_record: Dict[str, Any], label: str, level: str = "info") -> None:
    claim_record["auditTrail"].append(
        WorkflowAuditEntry(time=_now_iso(), label=label, level=level).dict()  # type: ignore[arg-type]
    )


def _status_level(status: str) -> str:
    if status == "pass":
        return "success"
    if status == "flag":
        return "warning"
    return "info"


def _publish_agent_result(claim_record: Dict[str, Any], agent_name: str, result: AgentResult) -> None:
    _append_timeline(claim_record, f"{agent_name} decision published", "system")
    confidence_note = f" Confidence {result.confidence}%." if result.confidence is not None else ""
    _append_audit(
        claim_record,
        f"{agent_name} marked the claim as {result.status}. {result.reason}{confidence_note}",
        _status_level(result.status),
    )


def _has_document(claim_record: Dict[str, Any], pattern: str) -> bool:
    pattern_lower = pattern.lower()
    for doc in claim_record.get("documents", []):
        haystack = " ".join(
            filter(
                None,
                [
                    doc.get("name"),
                    doc.get("category"),
                    doc.get("previewText"),
                    doc.get("uploadedFileName"),
                ],
            )
        ).lower()
        if pattern_lower in haystack:
            return True
    return False


def _build_medical_result(claim_record: Dict[str, Any]) -> AgentResult:
    documents = claim_record.get("documents", [])
    if not documents:
        return AgentResult(
            status="flag",
            reason="No medical documents were attached to the claim packet.",
            confidence=28,
        )

    if claim_record.get("serviceType") == "reimbursement":
        required = {
            "discharge": "Discharge summary is missing from the reimbursement packet.",
            "prescription": "Prescription is missing from the reimbursement packet.",
        }
        missing = [message for key, message in required.items() if not _has_document(claim_record, key)]
        if missing:
            return AgentResult(
                status="flag",
                reason=missing[0],
                confidence=61,
                highlights=["Patient handles reimbursement queries directly."],
            )

    return AgentResult(
        status="pass",
        reason="Document set contains the core medical evidence required for review.",
        confidence=89,
        highlights=[doc.get("category") or doc.get("name") for doc in documents[:3]],
    )


def _build_policy_result(policy_evaluation: Dict[str, Any]) -> AgentResult:
    decision = policy_evaluation.get("decision", "")
    reasons = policy_evaluation.get("reason") or []
    validation_issues = policy_evaluation.get("validation_issues") or []
    flags = policy_evaluation.get("flags") or []

    if decision == "APPROVE":
        return AgentResult(
            status="pass",
            reason=reasons[0] if reasons else "Policy agent approved the claim against the configured rulebook.",
            confidence=94,
            highlights=flags,
        )

    message = validation_issues[0] if validation_issues else (reasons[0] if reasons else "Policy review raised a verification flag.")
    return AgentResult(
        status="flag",
        reason=message,
        confidence=78,
        highlights=flags,
    )


def _build_cross_result(pipeline_result: Dict[str, Any], claim_record: Dict[str, Any]) -> AgentResult:
    fraud_stage = pipeline_result["pipeline_stages"]["fraud_investigation"]
    routing_stage = pipeline_result["pipeline_stages"]["routing"]
    reasons = fraud_stage.get("top_reasons") or []
    verdict = routing_stage.get("verdict")

    if verdict == "CLEAN_APPROVED":
        return AgentResult(
            status="pass",
            reason=reasons[0] if reasons else "Fraud checks cleared without suspicious signals.",
            confidence=min(99, max(70, 100 - int(fraud_stage.get("risk_score", 0)))),
            highlights=routing_stage.get("route_path") or [],
        )

    if verdict == "NEEDS_DOCUMENTS":
        query_owner = "patient" if claim_record.get("serviceType") == "reimbursement" else "hospital"
        return AgentResult(
            status="flag",
            reason="Additional documents are required before the claim can move forward.",
            confidence=73,
            highlights=[f"Query owner: {query_owner}", *(routing_stage.get("route_path") or [])],
        )

    return AgentResult(
        status="flag",
        reason=reasons[0] if reasons else "Cross-validation escalated this case for human review.",
        confidence=max(55, min(97, 100 - int(fraud_stage.get("risk_score", 0)))),
        highlights=routing_stage.get("route_path") or [],
    )


def _build_decision_letter(claim_record: Dict[str, Any]) -> str:
    status = claim_record.get("status")
    patient_name = claim_record.get("patientName") or "Member"
    amount = claim_record.get("amountApproved") if status == "approved" else claim_record.get("amount")
    amount_text = f"INR {float(amount or 0):,.0f}"
    note = claim_record.get("decisionNote") or "Please contact your insurer for more details."

    if status == "approved":
        outcome = f"has been approved for {amount_text}"
    elif status == "denied":
        outcome = "has been denied"
    else:
        outcome = "is under review"

    return (
        f"Dear {patient_name},\n\n"
        f"Your claim {claim_record['id']} {outcome}.\n\n"
        f"Service type: {claim_record.get('serviceType', 'cashless').title()}\n"
        f"Hospital: {claim_record.get('hospital')}\n"
        f"Diagnosis: {claim_record.get('diagnosis')}\n\n"
        f"Notes:\n{note}\n\n"
        "Regards,\nClaimHeart Decision Desk"
    )


def _build_decision_email(claim_record: Dict[str, Any]) -> ClaimEmail:
    status = claim_record.get("status")
    subject = (
        f"Claim decision for {claim_record['id']}"
        if status == "approved"
        else f"Claim update for {claim_record['id']}"
    )
    return ClaimEmail(
        id=_email_id(),
        to=claim_record.get("patientEmail") or "member@claimheart.local",
        subject=subject,
        body=_build_decision_letter(claim_record),
        sentAt=_now_iso(),
        sentBy="ClaimHeart Decision Desk",
    )


class WorkflowService:
    def signup(self, payload: SignupRequest) -> AppUser:
        state = _state()
        email = _normalize_email(str(payload.email))
        if any(item["email"] == email for item in state["users"]):
            raise HTTPException(status_code=409, detail="An account with this email already exists.")

        user_id = _user_id(payload.role)
        user = UserRecord(
            uid=user_id.lower(),
            id=user_id,
            name=payload.name.strip(),
            email=email,
            phone=_optional(payload.phone),
            role=payload.role,
            address=_optional(payload.address),
            state=_optional(payload.state),
            patientId=_optional(payload.patientId) or (user_id if payload.role == "patient" else None),
            dob=_optional(payload.dob),
            policyNumber=_optional(payload.policyNumber),
            policyName=_optional(payload.policyName),
            policyType=_optional(payload.policyType),
            policyStartDate=_optional(payload.policyStartDate),
            policyEndDate=_optional(payload.policyEndDate),
            insuranceCompany=_optional(payload.insuranceCompany),
            sumInsured=payload.sumInsured,
            doctorName=_optional(payload.doctorName),
            hospitalRegNo=_optional(payload.hospitalRegNo),
            hospitalRegistrationId=_optional(payload.hospitalRegistrationId),
            city=_optional(payload.city),
            department=_optional(payload.department),
            employeeId=_optional(payload.employeeId),
            website=_optional(payload.website),
            organizationType=_optional(payload.organizationType),
            organizationCode=_optional(payload.organizationCode),
            taxId=_optional(payload.taxId),
            gstNumber=_optional(payload.gstNumber),
            panNumber=_optional(payload.panNumber),
            irdaiLicenseNumber=_optional(payload.irdaiLicenseNumber),
            npi=_optional(payload.npi),
            contactName=_optional(payload.contactName),
            contactEmail=_optional(payload.contactEmail),
            contactPhone=_optional(payload.contactPhone),
            registrationCertificateName=_optional(payload.registrationCertificateName),
            policyDocumentName=_optional(payload.policyDocumentName),
            passwordHash=_hash_password(payload.password),
        )
        state["users"].append(user.dict())
        _save(state)
        return _user_from_dict(user.dict())

    def login(self, payload: LoginRequest) -> AppUser:
        state = _state()
        email = _normalize_email(str(payload.email))
        record = next((item for item in state["users"] if item["email"] == email), None)
        if not record or not _verify_password(payload.password, record["passwordHash"]):
            raise HTTPException(status_code=401, detail="Incorrect email or password.")
        if record["role"] != payload.role:
            raise HTTPException(
                status_code=403,
                detail=f"This account is registered for the {record['role']} workspace.",
            )
        return _user_from_dict(record)

    def get_user(self, user_id: str) -> AppUser:
        return _user_from_dict(_find_user_record(_state(), user_id))

    def update_user(self, user_id: str, payload: ProfileUpdateRequest) -> AppUser:
        state = _state()
        record = _find_user_record(state, user_id)
        updates = payload.dict(exclude_unset=True)
        for key, value in updates.items():
            record[key] = _optional(value) if isinstance(value, str) else value
        _save(state)
        return _user_from_dict(record)

    def list_claims(
        self,
        *,
        patient_id: Optional[str] = None,
        hospital_name: Optional[str] = None,
        user_id: Optional[str] = None,
        role: Optional[str] = None,
    ) -> List[ClaimRecord]:
        claims = [_claim_from_dict(item) for item in _state()["claims"]]

        if patient_id:
            claims = [item for item in claims if item.patientId == patient_id]
        if hospital_name:
            claims = [item for item in claims if item.hospital == hospital_name]
        if role == "patient" and user_id:
            claims = [item for item in claims if item.patientId == user_id or item.patientId == patient_id]
        if role == "hospital" and user_id:
            user = self.get_user(user_id)
            claim_hospital = hospital_name or user.name
            claims = [item for item in claims if item.hospital == claim_hospital]

        return sorted(claims, key=lambda item: item.submittedAt, reverse=True)

    def list_notifications(
        self,
        *,
        role: Optional[str] = None,
        user_id: Optional[str] = None,
        patient_id: Optional[str] = None,
    ) -> List[NotificationRecord]:
        notifications = [_notification_from_dict(item) for item in _state()["notifications"]]
        if role:
            notifications = [item for item in notifications if item.targetRole in {role, "all"}]
        if user_id or patient_id:
            visible_ids = {value for value in [user_id, patient_id] if value}
            notifications = [
                item
                for item in notifications
                if item.targetUserId is None or item.targetUserId in visible_ids
            ]
        return sorted(notifications, key=lambda item: item.time, reverse=True)

    def bootstrap(
        self,
        *,
        role: Optional[str] = None,
        user_id: Optional[str] = None,
        patient_id: Optional[str] = None,
        hospital_name: Optional[str] = None,
    ) -> BootstrapResponse:
        return BootstrapResponse(
            claims=self.list_claims(
                patient_id=patient_id,
                hospital_name=hospital_name,
                user_id=user_id,
                role=role,
            ),
            notifications=self.list_notifications(role=role, user_id=user_id, patient_id=patient_id),
        )

    def create_claim(self, payload: ClaimCreateRequest) -> ClaimRecord:
        state = _state()
        now = _now_iso()
        claim = ClaimRecord(
            id=_claim_id(),
            claimProcessId=_claim_process_id(),
            patientId=payload.patientId,
            patientName=payload.patientName,
            patientEmail=_optional(payload.patientEmail),
            hospital=payload.hospital,
            caseType=payload.caseType,
            serviceType=payload.serviceType,
            diagnosis=payload.diagnosis,
            icdCode=payload.icdCode,
            amount=payload.amount,
            status="pending",
            riskScore=0,
            submittedAt=now,
            documents=payload.documents,
            timeline=[
                TimelineEntry(label="Claim submitted", time=now, actor="hospital"),
                TimelineEntry(label="Claim queued for insurer review", time=now, actor="system"),
            ],
            aiResults=ClaimAiResults(
                policy=_pending_agent("Awaiting insurer workflow."),
                medical=_pending_agent("Awaiting insurer workflow."),
                cross=_pending_agent("Awaiting insurer workflow."),
            ),
            comments=[],
            emails=[],
            workflowCaseId=payload.workflowCaseId,
            caseLabel=payload.caseLabel,
            policyNumber=_optional(payload.policyNumber),
            policyStartDate=_optional(payload.policyStartDate),
            insurerName=_optional(payload.insurerName),
            hospitalRegNo=_optional(payload.hospitalRegNo),
            attendingDoctor=_optional(payload.attendingDoctor),
            amountApproved=0,
            workflowState="submitted",
            auditTrail=[
                WorkflowAuditEntry(time=now, label="Claim created from the hospital dashboard.", level="info"),
            ],
        )
        state["claims"].insert(0, claim.dict())
        _add_notification(
            state,
            target_role="insurer",
            title="New claim received",
            message=f"{claim.patientName} - INR {claim.amount:,.0f} from {claim.hospital}",
            claim_id=claim.id,
            notification_type="info",
        )
        _add_notification(
            state,
            target_role="patient",
            target_user_id=claim.patientId,
            title="Claim submitted",
            message=f"Your claim {claim.id} has been submitted and is waiting for insurer review.",
            claim_id=claim.id,
            notification_type="info",
        )
        _save(state)
        return claim

    def get_claim(self, claim_id: str) -> ClaimRecord:
        return _claim_from_dict(_find_claim_record(_state(), claim_id))

    def add_document(self, claim_id: str, payload: AddDocumentRequest) -> ClaimRecord:
        state = _state()
        claim = _find_claim_record(state, claim_id)
        document = payload.document.dict()
        claim["documents"].append(document)
        _append_timeline(claim, f"Document uploaded by {payload.uploaderRole}: {payload.document.name}", payload.uploaderRole)
        _append_audit(claim, f"{payload.uploaderRole.title()} uploaded {payload.document.name}.")

        if claim["status"] == "under_review":
            claim["status"] = "pending"
            claim["workflowState"] = "submitted"
            claim["pipelineCompletedAt"] = None
            claim["aiResults"]["cross"] = _pending_agent("Awaiting re-run after the new document upload.").dict()
            _append_audit(claim, "Claim moved back to pending after new document upload.", "info")

        _add_notification(
            state,
            target_role="insurer",
            title="New document uploaded",
            message=f"{payload.document.name} was added to claim {claim_id} by {payload.uploaderRole}.",
            claim_id=claim_id,
            notification_type="info",
        )
        _save(state)
        return _claim_from_dict(claim)

    def add_comment(self, claim_id: str, payload: AddCommentRequest) -> ClaimRecord:
        state = _state()
        claim = _find_claim_record(state, claim_id)
        comment = Comment(
            id=_comment_id(),
            text=payload.text,
            author=payload.author,
            role=payload.role,
            time=_now_iso(),
            visibleTo=payload.visibleTo,
        )
        claim["comments"].insert(0, comment.dict())
        _append_timeline(claim, f"Comment added by {payload.role}", payload.role)
        _append_audit(claim, f"{payload.role.title()} added a comment.")
        visible_roles = set(payload.visibleTo or ["all"])
        if "all" in visible_roles:
            visible_roles = {"patient", "hospital", "insurer"}
        visible_roles.discard(payload.role)

        for role in sorted(visible_roles):
            _add_notification(
                state,
                target_role=role,  # type: ignore[arg-type]
                target_user_id=claim.get("patientId") if role == "patient" else None,
                title="New workflow comment",
                message=f"{payload.author} added a note on claim {claim_id}.",
                claim_id=claim_id,
                notification_type="info",
            )
        _save(state)
        return _claim_from_dict(claim)

    def request_documents(self, claim_id: str, payload: ClaimDocumentRequest) -> ClaimRecord:
        state = _state()
        claim = _find_claim_record(state, claim_id)
        claim["status"] = "under_review"
        claim["decisionNote"] = payload.requestNote.strip()
        claim["workflowState"] = "completed"
        _append_timeline(claim, f"Documents requested by insurer: {claim['decisionNote']}", "insurer")
        _append_audit(claim, "Insurer requested additional documents.", "warning")

        target_role = "patient" if claim.get("serviceType") == "reimbursement" else "hospital"
        target_user_id = claim.get("patientId") if target_role == "patient" else None
        _add_notification(
            state,
            target_role=target_role,
            target_user_id=target_user_id,
            title="Action required - documents needed",
            message=f"Additional documents were requested for claim {claim_id}: {claim['decisionNote']}",
            claim_id=claim_id,
            notification_type="action",
        )
        _save(state)
        return _claim_from_dict(claim)

    def record_decision(self, claim_id: str, payload: ClaimDecisionRequest) -> ClaimRecord:
        state = _state()
        claim = _find_claim_record(state, claim_id)
        claim["status"] = payload.status
        claim["decisionNote"] = _optional(payload.note) or claim.get("decisionNote")
        claim["workflowState"] = "completed"
        if payload.status == "approved":
            claim["amountApproved"] = claim.get("amountApproved") or claim["amount"]
        _append_timeline(
            claim,
            "Approved by insurer" if payload.status == "approved" else "Denied by insurer" if payload.status == "denied" else "Placed under manual review by insurer",
            "insurer",
        )
        _append_audit(claim, f"Insurer recorded a {payload.status} decision.", "success" if payload.status == "approved" else "warning")
        claim["decisionLetter"] = _build_decision_letter(claim)
        email = _build_decision_email(claim)
        claim["emails"].insert(0, email.dict())

        _add_notification(
            state,
            target_role="patient",
            target_user_id=claim.get("patientId"),
            title="Claim update",
            message=f"Your claim {claim_id} is now {payload.status.replace('_', ' ')}.",
            claim_id=claim_id,
            notification_type="success" if payload.status == "approved" else "warning",
        )
        _add_notification(
            state,
            target_role="hospital",
            title=f"Claim {claim_id} - {payload.status.replace('_', ' ')}",
            message=f"{claim.get('patientName')}'s claim has been marked {payload.status.replace('_', ' ')} by the insurer.",
            claim_id=claim_id,
            notification_type="info",
        )
        _save(state)
        return _claim_from_dict(claim)

    def mark_notification_read(self, notification_id: str) -> NotificationRecord:
        state = _state()
        notification = next((item for item in state["notifications"] if item["id"] == notification_id), None)
        if not notification:
            raise HTTPException(status_code=404, detail="Notification not found.")
        notification["read"] = True
        _save(state)
        return _notification_from_dict(notification)

    def mark_all_notifications_read(self, *, role: str, user_id: Optional[str] = None, patient_id: Optional[str] = None) -> Dict[str, int]:
        state = _state()
        visible_ids = {value for value in [user_id, patient_id] if value}
        updated = 0
        for notification in state["notifications"]:
            matches_role = notification["targetRole"] in {role, "all"}
            matches_user = not notification.get("targetUserId") or notification["targetUserId"] in visible_ids
            if matches_role and matches_user and not notification["read"]:
                notification["read"] = True
                updated += 1
        _save(state)
        return {"updated": updated}

    def run_pipeline(self, claim_id: str) -> Dict[str, Any]:
        state = _state()
        claim = _find_claim_record(state, claim_id)

        claim["workflowState"] = "adjudicating"
        _append_timeline(claim, "Insurer workflow started", "insurer")
        _append_audit(claim, "Insurer workflow started.", "info")
        _save(state)

        normalized_diagnosis = _normalize_diagnosis(claim.get("diagnosis"))
        raw_text = "\n".join(
            filter(
                None,
                [
                    normalized_diagnosis,
                    *(doc.get("previewText") or doc.get("category") or doc.get("name") for doc in claim.get("documents", [])),
                ],
            )
        )
        meds_count = sum(
            1
            for doc in claim.get("documents", [])
            if "prescription" in f"{doc.get('name', '')} {doc.get('category', '')}".lower()
        )
        tests_count = sum(
            1
            for doc in claim.get("documents", [])
            if any(token in f"{doc.get('name', '')} {doc.get('category', '')}".lower() for token in ["report", "test", "lab"])
        )
        hospital_days = 3
        if _has_document(claim, "discharge"):
            hospital_days = 5

        extractor_output = {
            "raw_text": raw_text,
            "document_payload": {"source": "workflow_service"},
            "unified_claim": {
                "patient_name": claim.get("patientName"),
                "disease": normalized_diagnosis,
                "amount": claim.get("amount"),
                "hospital_stay_days": hospital_days,
                "medications": [doc.get("name") for doc in claim.get("documents", []) if "prescription" in f"{doc.get('category', '')}".lower()],
                "medications_count": max(1, meds_count),
                "diagnostic_tests_count": max(1, tests_count),
                "has_prescription": _has_document(claim, "prescription"),
                "has_billing": _has_document(claim, "bill"),
            },
            "agent_a2_evaluation": {
                "source": "Agent_A2",
                "evaluation": {
                    "decision": "INCOMPLETE",
                    "flags": ["missing_policy_number"] if not claim.get("policyNumber") else [],
                    "reason": ["Policy number missing from claim packet."] if not claim.get("policyNumber") else [],
                    "validation_issues": ["Policy number missing"] if not claim.get("policyNumber") else [],
                },
            },
            "structured_data": {
                "confidence_scores": {
                    "patient_name": 0.95,
                    "diagnosis": 0.92 if claim.get("diagnosis") else 0.25,
                    "billing_items": 0.88 if _has_document(claim, "bill") else 0.51,
                    "hospital_stay_days": 0.81,
                }
            },
        }

        if claim.get("policyNumber"):
            from app.agents.policy.policy_agent import agent_a2_policy

            extractor_output["agent_a2_evaluation"] = agent_a2_policy.evaluate_claim(extractor_output["unified_claim"])

        pipeline_result = run_full_pipeline(
            extractor_output=extractor_output,
            claim_id=claim_id,
            patient_info={
                "name": claim.get("patientName"),
                "email": claim.get("patientEmail"),
            },
            hospital_info={
                "name": claim.get("hospital"),
                "email": None,
            },
        )

        policy_result = _build_policy_result(extractor_output["agent_a2_evaluation"]["evaluation"])
        medical_result = _build_medical_result(claim)
        cross_result = _build_cross_result(pipeline_result, claim)

        claim["aiResults"] = ClaimAiResults(
            policy=policy_result,
            medical=medical_result,
            cross=cross_result,
        ).dict()
        claim["riskScore"] = int(pipeline_result["pipeline_stages"]["fraud_investigation"]["risk_score"])
        claim["pipelineCompletedAt"] = _now_iso()
        claim["workflowState"] = "completed"
        _publish_agent_result(claim, "Policy agent", policy_result)
        _publish_agent_result(claim, "Medical agent", medical_result)
        _publish_agent_result(claim, "Cross-check agent", cross_result)
        _append_audit(
            claim,
            f"Workflow routing verdict: {pipeline_result['final_verdict']} with risk score {claim['riskScore']}.",
            "info",
        )

        verdict = pipeline_result["final_verdict"]
        if verdict == "CLEAN_APPROVED":
            claim["status"] = "approved"
            claim["amountApproved"] = claim.get("amount")
            claim["decisionNote"] = "Automated policy, medical, and fraud checks cleared the claim."
            _append_timeline(claim, "Automatically approved by insurer workflow", "system")
            _append_audit(claim, "Workflow completed with automatic approval.", "success")
            _add_notification(
                state,
                target_role="patient",
                target_user_id=claim.get("patientId"),
                title="Claim approved",
                message=f"Your claim {claim_id} was approved by the automated workflow.",
                claim_id=claim_id,
                notification_type="success",
            )
            _add_notification(
                state,
                target_role="hospital",
                title="Claim approved",
                message=f"Claim {claim_id} cleared the automated workflow and is approved.",
                claim_id=claim_id,
                notification_type="success",
            )
        elif verdict == "NEEDS_DOCUMENTS":
            claim["status"] = "under_review"
            claim["decisionNote"] = "More documents are required before the claim can be decided."
            _append_timeline(claim, "Workflow requested more documents", "system")
            _append_audit(claim, "Workflow requested more supporting documents.", "warning")
            target_role = "patient" if claim.get("serviceType") == "reimbursement" else "hospital"
            target_user_id = claim.get("patientId") if target_role == "patient" else None
            _add_notification(
                state,
                target_role=target_role,
                target_user_id=target_user_id,
                title="Documents required",
                message=f"Claim {claim_id} needs more documents before review can continue.",
                claim_id=claim_id,
                notification_type="action",
            )
            _add_notification(
                state,
                target_role="patient",
                target_user_id=claim.get("patientId"),
                title="Claim waiting for documents",
                message=f"Claim {claim_id} needs more documents before the insurer can finish review.",
                claim_id=claim_id,
                notification_type="warning",
            )
        else:
            claim["status"] = "under_review"
            claim["decisionNote"] = "Suspicious signals were detected. The claim was escalated for human verification."
            _append_timeline(claim, "Workflow escalated case for human verification", "system")
            _append_audit(claim, "Workflow escalated the claim for manual verification.", "warning")
            _add_notification(
                state,
                target_role="insurer",
                title="Human verification needed",
                message=f"Claim {claim_id} was escalated after the automated workflow.",
                claim_id=claim_id,
                notification_type="warning",
            )
            _add_notification(
                state,
                target_role="patient",
                target_user_id=claim.get("patientId"),
                title="Claim moved to manual review",
                message=f"Claim {claim_id} needs human verification before a final decision is made.",
                claim_id=claim_id,
                notification_type="warning",
            )
            _add_notification(
                state,
                target_role="hospital",
                title="Claim moved to manual review",
                message=f"Claim {claim_id} needs additional insurer review after automated checks.",
                claim_id=claim_id,
                notification_type="warning",
            )

        claim["decisionLetter"] = _build_decision_letter(claim)
        _save(state)
        return {
            "claim": _claim_from_dict(claim),
            "pipeline_result": pipeline_result,
        }


workflow_service = WorkflowService()
