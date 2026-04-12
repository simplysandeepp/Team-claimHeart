from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field


UserRole = Literal["patient", "hospital", "insurer"]
ClaimStatus = Literal["pending", "approved", "denied", "under_review"]
ClaimActor = Literal["hospital", "insurer", "patient", "system"]
ClaimCaseType = Literal["planned", "emergency", "day_care"]
AgentStatus = Literal["pass", "flag", "pending"]
NotificationTarget = Literal["patient", "hospital", "insurer", "all"]
NotificationType = Literal["info", "success", "warning", "action"]
WorkflowState = Literal["draft", "ocr_processing", "ready_for_submission", "submitted", "adjudicating", "completed"]


class AgentResult(BaseModel):
    status: AgentStatus
    reason: str
    confidence: Optional[int] = None
    durationMs: Optional[int] = None
    highlights: List[str] = Field(default_factory=list)


class TimelineEntry(BaseModel):
    label: str
    time: str
    actor: ClaimActor


class Comment(BaseModel):
    id: str
    text: str
    author: str
    role: UserRole
    time: str
    visibleTo: List[NotificationTarget] = Field(default_factory=list)


class UploadedDocument(BaseModel):
    name: str
    type: str
    size: int
    uploadedAt: str
    uploadedBy: str
    category: Optional[str] = None
    previewText: Optional[str] = None
    sourceUrl: Optional[str] = None
    uploadedFileName: Optional[str] = None
    processingStatus: Optional[Literal["queued", "processing", "ready"]] = None


class ClaimEmail(BaseModel):
    id: str
    to: str
    subject: str
    body: str
    sentAt: str
    sentBy: str
    status: Literal["sent"] = "sent"


class WorkflowAuditEntry(BaseModel):
    time: str
    label: str
    level: Literal["info", "success", "warning"]


class ClaimAiResults(BaseModel):
    policy: AgentResult
    medical: AgentResult
    cross: AgentResult


class ClaimRecord(BaseModel):
    id: str
    claimProcessId: str
    patientId: str
    patientName: str
    patientEmail: Optional[str] = None
    hospital: str
    caseType: ClaimCaseType
    serviceType: Literal["cashless", "reimbursement"] = "cashless"
    diagnosis: str
    icdCode: str
    amount: float
    status: ClaimStatus
    riskScore: int = 0
    submittedAt: str
    documents: List[UploadedDocument] = Field(default_factory=list)
    timeline: List[TimelineEntry] = Field(default_factory=list)
    aiResults: ClaimAiResults
    comments: List[Comment] = Field(default_factory=list)
    emails: List[ClaimEmail] = Field(default_factory=list)
    workflowCaseId: Optional[str] = None
    caseLabel: Optional[str] = None
    policyNumber: Optional[str] = None
    policyStartDate: Optional[str] = None
    insurerName: Optional[str] = None
    hospitalRegNo: Optional[str] = None
    attendingDoctor: Optional[str] = None
    decisionLetter: Optional[str] = None
    amountApproved: Optional[float] = None
    workflowState: WorkflowState = "submitted"
    auditTrail: List[WorkflowAuditEntry] = Field(default_factory=list)
    pipelineCompletedAt: Optional[str] = None
    decisionNote: Optional[str] = None


class NotificationRecord(BaseModel):
    id: str
    targetRole: NotificationTarget
    targetUserId: Optional[str] = None
    claimId: Optional[str] = None
    title: str
    message: str
    type: NotificationType
    read: bool = False
    time: str


class AppUser(BaseModel):
    uid: Optional[str] = None
    id: str
    name: str
    email: str
    phone: Optional[str] = None
    role: UserRole
    authProvider: Optional[Literal["password"]] = "password"
    address: Optional[str] = None
    state: Optional[str] = None
    patientId: Optional[str] = None
    dob: Optional[str] = None
    policyNumber: Optional[str] = None
    policyName: Optional[str] = None
    policyType: Optional[str] = None
    policyStartDate: Optional[str] = None
    policyEndDate: Optional[str] = None
    insuranceCompany: Optional[str] = None
    sumInsured: Optional[float] = None
    doctorName: Optional[str] = None
    hospitalRegNo: Optional[str] = None
    hospitalRegistrationId: Optional[str] = None
    city: Optional[str] = None
    department: Optional[str] = None
    employeeId: Optional[str] = None
    website: Optional[str] = None
    organizationType: Optional[str] = None
    organizationCode: Optional[str] = None
    taxId: Optional[str] = None
    gstNumber: Optional[str] = None
    panNumber: Optional[str] = None
    irdaiLicenseNumber: Optional[str] = None
    npi: Optional[str] = None
    contactName: Optional[str] = None
    contactEmail: Optional[str] = None
    contactPhone: Optional[str] = None
    registrationCertificateName: Optional[str] = None
    policyDocumentName: Optional[str] = None


class UserRecord(AppUser):
    passwordHash: str


class SignupRequest(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    password: str = Field(..., min_length=8)
    role: UserRole
    address: Optional[str] = None
    state: Optional[str] = None
    patientId: Optional[str] = None
    dob: Optional[str] = None
    policyNumber: Optional[str] = None
    policyName: Optional[str] = None
    policyType: Optional[str] = None
    policyStartDate: Optional[str] = None
    policyEndDate: Optional[str] = None
    insuranceCompany: Optional[str] = None
    sumInsured: Optional[float] = None
    doctorName: Optional[str] = None
    hospitalRegNo: Optional[str] = None
    hospitalRegistrationId: Optional[str] = None
    city: Optional[str] = None
    department: Optional[str] = None
    employeeId: Optional[str] = None
    website: Optional[str] = None
    organizationType: Optional[str] = None
    organizationCode: Optional[str] = None
    taxId: Optional[str] = None
    gstNumber: Optional[str] = None
    panNumber: Optional[str] = None
    irdaiLicenseNumber: Optional[str] = None
    npi: Optional[str] = None
    contactName: Optional[str] = None
    contactEmail: Optional[str] = None
    contactPhone: Optional[str] = None
    registrationCertificateName: Optional[str] = None
    policyDocumentName: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str
    role: UserRole


class ProfileUpdateRequest(BaseModel):
    policyNumber: Optional[str] = None
    policyName: Optional[str] = None
    policyType: Optional[str] = None
    policyStartDate: Optional[str] = None
    policyEndDate: Optional[str] = None
    address: Optional[str] = None
    hospitalRegistrationId: Optional[str] = None
    gstNumber: Optional[str] = None
    panNumber: Optional[str] = None
    irdaiLicenseNumber: Optional[str] = None
    npi: Optional[str] = None


class ClaimCreateRequest(BaseModel):
    patientId: str
    patientName: str
    patientEmail: Optional[str] = None
    hospital: str
    caseType: ClaimCaseType
    serviceType: Literal["cashless", "reimbursement"] = "cashless"
    diagnosis: str
    icdCode: str = ""
    amount: float
    documents: List[UploadedDocument] = Field(default_factory=list)
    workflowCaseId: Optional[str] = None
    caseLabel: Optional[str] = None
    policyNumber: Optional[str] = None
    policyStartDate: Optional[str] = None
    insurerName: Optional[str] = None
    hospitalRegNo: Optional[str] = None
    attendingDoctor: Optional[str] = None


class AddDocumentRequest(BaseModel):
    document: UploadedDocument
    uploaderRole: UserRole


class AddCommentRequest(BaseModel):
    text: str
    author: str
    role: UserRole
    visibleTo: List[NotificationTarget] = Field(default_factory=list)


class ClaimDecisionRequest(BaseModel):
    status: Literal["approved", "denied", "under_review"]
    note: Optional[str] = None


class ClaimDocumentRequest(BaseModel):
    requestNote: str


class BootstrapResponse(BaseModel):
    claims: List[ClaimRecord]
    notifications: List[NotificationRecord]
