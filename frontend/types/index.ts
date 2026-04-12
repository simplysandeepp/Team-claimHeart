export type ClaimStatus = "pending" | "approved" | "denied" | "under_review";
export type AgentStatus = "pass" | "flag" | "pending";
export type NotifTarget = "patient" | "hospital" | "insurer" | "all";
export type UserRole = "patient" | "hospital" | "insurer";
export type ClaimActor = "hospital" | "insurer" | "patient" | "system";
export type ClaimCaseType = "planned" | "emergency" | "day_care";
export type WorkflowAuditLevel = "info" | "success" | "warning";

export interface WorkflowAuditEntry {
  time: string;
  label: string;
  level: WorkflowAuditLevel;
}

export interface AgentResult {
  status: AgentStatus;
  reason: string;
  confidence?: number;
  durationMs?: number;
  highlights?: string[];
}

export interface TimelineEntry {
  label: string;
  time: string;
  actor: ClaimActor;
}

export interface Comment {
  id: string;
  text: string;
  author: string;
  role: UserRole;
  time: string;
  visibleTo: NotifTarget[];
}

export interface OcrExtractedData {
  raw_text?: string;
  structured_data?: Record<string, unknown>;
  diagnosis?: string;
  icdCode?: string;
  admissionDate?: string;
  dischargeDate?: string;
  totalAmount?: string;
  patientName?: string;
  hospitalName?: string;
  doctorName?: string;
  note?: string;
  [key: string]: unknown;
}

export interface UploadedDocument {
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string;
  category?: string;
  previewText?: string;
  sourceUrl?: string;
  uploadedFileName?: string;
  processingStatus?: "queued" | "processing" | "ready";
  ocrResult?: OcrExtractedData;
  ocrStatus?: "idle" | "running" | "done" | "error";
}

export interface ClaimEmail {
  id: string;
  to: string;
  subject: string;
  body: string;
  sentAt: string;
  sentBy: string;
  status: "sent";
}

export interface Claim {
  id: string;
  claimProcessId?: string;
  patientId: string;
  patientName: string;
  patientEmail?: string;
  hospital: string;
  caseType: ClaimCaseType;
  serviceType?: "cashless" | "reimbursement";
  diagnosis: string;
  icdCode: string;
  amount: number;
  status: ClaimStatus;
  riskScore: number;
  submittedAt: string;
  documents: UploadedDocument[];
  timeline: TimelineEntry[];
  aiResults: {
    policy: AgentResult;
    medical: AgentResult;
    cross: AgentResult;
  };
  comments: Comment[];
  emails?: ClaimEmail[];
  workflowCaseId?: string;
  caseLabel?: string;
  policyNumber?: string;
  policyStartDate?: string;
  insurerName?: string;
  hospitalRegNo?: string;
  attendingDoctor?: string;
  decisionLetter?: string;
  amountApproved?: number;
  workflowState?: "draft" | "ocr_processing" | "ready_for_submission" | "submitted" | "adjudicating" | "completed";
  auditTrail?: WorkflowAuditEntry[];
  pipelineCompletedAt?: string;
  decisionNote?: string;
}

export interface Notification {
  id: string;
  targetRole: NotifTarget;
  targetUserId?: string;
  claimId?: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "action";
  read: boolean;
  time: string;
}

export interface AppUser {
  uid?: string;
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  authProvider?: "password" | "google" | "apple" | "microsoft";
  address?: string;
  state?: string;
  patientId?: string;
  dob?: string;
  policyNumber?: string;
  policyName?: string;
  policyType?: string;
  policyStartDate?: string;
  policyEndDate?: string;
  insuranceCompany?: string;
  sumInsured?: number;
  doctorName?: string;
  hospitalRegNo?: string;
  hospitalRegistrationId?: string;
  city?: string;
  department?: string;
  employeeId?: string;
  website?: string;
  organizationType?: string;
  organizationCode?: string;
  taxId?: string;
  gstNumber?: string;
  panNumber?: string;
  irdaiLicenseNumber?: string;
  npi?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  registrationCertificateName?: string;
  policyDocumentName?: string;
}
