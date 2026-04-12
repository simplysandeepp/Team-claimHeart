from typing import Any, Dict, Optional

from fastapi import APIRouter, Query

from app.schemas.platform import (
    AddCommentRequest,
    AddDocumentRequest,
    BootstrapResponse,
    ClaimCreateRequest,
    ClaimDecisionRequest,
    ClaimDocumentRequest,
    ClaimRecord,
    NotificationRecord,
)
from app.services.workflow_service import workflow_service


router = APIRouter()


@router.get("/bootstrap", response_model=BootstrapResponse)
def bootstrap(
    role: Optional[str] = Query(default=None),
    user_id: Optional[str] = Query(default=None),
    patient_id: Optional[str] = Query(default=None),
    hospital_name: Optional[str] = Query(default=None),
) -> BootstrapResponse:
    return workflow_service.bootstrap(
        role=role,
        user_id=user_id,
        patient_id=patient_id,
        hospital_name=hospital_name,
    )


@router.get("/claims", response_model=list[ClaimRecord])
def list_claims(
    role: Optional[str] = Query(default=None),
    user_id: Optional[str] = Query(default=None),
    patient_id: Optional[str] = Query(default=None),
    hospital_name: Optional[str] = Query(default=None),
) -> list[ClaimRecord]:
    return workflow_service.list_claims(
        role=role,
        user_id=user_id,
        patient_id=patient_id,
        hospital_name=hospital_name,
    )


@router.post("/claims", response_model=ClaimRecord)
def create_claim(request: ClaimCreateRequest) -> ClaimRecord:
    return workflow_service.create_claim(request)


@router.get("/claims/{claim_id}", response_model=ClaimRecord)
def get_claim(claim_id: str) -> ClaimRecord:
    return workflow_service.get_claim(claim_id)


@router.post("/claims/{claim_id}/documents", response_model=ClaimRecord)
def add_document(claim_id: str, request: AddDocumentRequest) -> ClaimRecord:
    return workflow_service.add_document(claim_id, request)


@router.post("/claims/{claim_id}/comments", response_model=ClaimRecord)
def add_comment(claim_id: str, request: AddCommentRequest) -> ClaimRecord:
    return workflow_service.add_comment(claim_id, request)


@router.post("/claims/{claim_id}/request-documents", response_model=ClaimRecord)
def request_documents(claim_id: str, request: ClaimDocumentRequest) -> ClaimRecord:
    return workflow_service.request_documents(claim_id, request)


@router.post("/claims/{claim_id}/decision", response_model=ClaimRecord)
def record_decision(claim_id: str, request: ClaimDecisionRequest) -> ClaimRecord:
    return workflow_service.record_decision(claim_id, request)


@router.post("/claims/{claim_id}/run-pipeline")
def run_pipeline(claim_id: str) -> Dict[str, Any]:
    return workflow_service.run_pipeline(claim_id)


@router.get("/notifications", response_model=list[NotificationRecord])
def list_notifications(
    role: Optional[str] = Query(default=None),
    user_id: Optional[str] = Query(default=None),
    patient_id: Optional[str] = Query(default=None),
) -> list[NotificationRecord]:
    return workflow_service.list_notifications(role=role, user_id=user_id, patient_id=patient_id)


@router.post("/notifications/{notification_id}/read", response_model=NotificationRecord)
def mark_notification_read(notification_id: str) -> NotificationRecord:
    return workflow_service.mark_notification_read(notification_id)


@router.post("/notifications/read-all")
def mark_all_notifications_read(
    role: str = Query(...),
    user_id: Optional[str] = Query(default=None),
    patient_id: Optional[str] = Query(default=None),
) -> Dict[str, int]:
    return workflow_service.mark_all_notifications_read(role=role, user_id=user_id, patient_id=patient_id)
