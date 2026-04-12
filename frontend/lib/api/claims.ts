"use client";

import { apiRequest, buildApiUrl } from "@/lib/apiClient";
import { getCurrentUser } from "@/lib/api/auth";
import {
  addLocalClaimComment,
  addLocalClaimDocument,
  getLocalBootstrap,
  recordLocalDecision,
  requestLocalDocuments,
  runLocalClaimPipeline,
  setSyncMode,
  submitLocalClaim,
} from "@/lib/localWorkflow";
import { useAppStore } from "@/store/useAppStore";
import type {
  AppUser,
  Claim,
  ClaimEmail,
  ClaimStatus,
  Comment,
  Notification,
  OcrExtractedData,
  UploadedDocument,
  UserRole,
} from "@/types";

const buildId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;

const collectClaimFlags = (claim: Claim) => [
  claim.aiResults.policy.status === "flag" ? `Policy review: ${claim.aiResults.policy.reason}` : null,
  claim.aiResults.medical.status === "flag" ? `Medical review: ${claim.aiResults.medical.reason}` : null,
  claim.aiResults.cross.status === "flag" ? `Cross-validation: ${claim.aiResults.cross.reason}` : null,
].filter(Boolean) as string[];

const resolvePatientEmail = (claim: Claim) => claim.patientEmail || "patient@claimheart.ai";

const buildBootstrapQuery = (user: AppUser) => {
  const params = new URLSearchParams();
  params.set("role", user.role);
  params.set("user_id", user.id);
  if (user.patientId) {
    params.set("patient_id", user.patientId);
  }
  if (user.role === "hospital") {
    params.set("hospital_name", user.name);
  }
  return params.toString();
};

export const syncWorkflowSnapshot = async (user?: AppUser | null) => {
  const resolvedUser = user ?? (await getCurrentUser());
  const store = useAppStore.getState();

  if (!resolvedUser) {
    store.setClaims([]);
    store.setNotifications([]);
    return { claims: [] as Claim[], notifications: [] as Notification[] };
  }

  let snapshot: { claims: Claim[]; notifications: Notification[] };
  try {
    snapshot = await apiRequest<{ claims: Claim[]; notifications: Notification[] }>(
      `/api/workflow/bootstrap?${buildBootstrapQuery(resolvedUser)}`,
    );
    setSyncMode("live");
  } catch {
    snapshot = getLocalBootstrap(resolvedUser);
    setSyncMode("fallback");
  }

  store.setClaims(snapshot.claims);
  store.setNotifications(snapshot.notifications);
  return snapshot;
};

export const buildDecisionLetter = (claim: Claim): string => {
  if (claim.decisionLetter) {
    return claim.decisionLetter;
  }

  const flags = collectClaimFlags(claim).join("\n");

  return `Dear ${claim.patientName},\n\nYour claim ${claim.id} for Rs ${Number(claim.amount).toLocaleString("en-IN")} at ${claim.hospital} has been ${claim.status === "under_review" ? "placed under review" : claim.status}.\n\n${flags ? `Notes:\n${flags}\n\n` : ""}Contact your insurer for queries.\n\nRegards,\nClaimHeart Adjudication System`;
};

export const buildDecisionEmail = (claim: Claim): ClaimEmail => {
  const subject =
    claim.status === "denied"
      ? `Claim decision for ${claim.id} - Rejected`
      : claim.status === "under_review"
        ? `Claim update for ${claim.id} - Manual review`
        : `Claim decision for ${claim.id}`;
  const reasons = collectClaimFlags(claim);
  const sentAt = new Date().toISOString();

  return {
    id: buildId("MAIL"),
    to: resolvePatientEmail(claim),
    subject,
    body: [
      `Dear ${claim.patientName},`,
      "",
      claim.status === "denied"
        ? `We regret to inform you that claim ${claim.id} has been rejected after insurer review.`
        : `This is an update regarding claim ${claim.id}.`,
      "",
      reasons.length > 0 ? "Reason for the decision:" : "Decision summary:",
      ...(reasons.length > 0
        ? reasons.map((reason, index) => `${index + 1}. ${reason}`)
        : [claim.decisionNote || "Please review the attached decision summary."]),
      "",
      "If you would like to challenge this outcome, please reply with any supporting records or continuity documents.",
      "",
      "Regards,",
      "ClaimHeart Adjudication Desk",
    ].join("\n"),
    sentAt,
    sentBy: "Insurer Decision Desk",
    status: "sent",
  };
};


// ── Client-side text parser ──────────────────────────────────────────────────
// Used when the document is already plain text (e.g. .txt demo docs).
// Returns structured fields extracted via regex without needing image OCR.

const extractField = (text: string, ...patterns: RegExp[]): string | undefined => {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]?.trim()) {
      return match[1].trim();
    }
  }
  return undefined;
};

const parseTextDocument = (rawText: string, docName: string): OcrExtractedData => {
  const t = rawText;

  // Patient name
  const patientName = extractField(t,
    /Patient\s+Name\s*:\s*(.+)/i,
    /Patient\s*:\s*(.+)/i,
  );

  // Hospital name
  const hospitalName = extractField(t,
    /Hospital\s+Name\s*:\s*(.+)/i,
    /^([A-Z][A-Z\s]+(?:HOSPITAL|CLINIC|MEDICAL|CARE)[^\n]*)/m,
  );

  // Diagnosis — capture the part before any ICD code in parentheses
  const diagnosisRaw = extractField(t,
    /Diagnosis\s*:\s*([^\n(]+)/i,
    /Dx\s*:\s*([^\n(]+)/i,
  );
  const diagnosis = diagnosisRaw?.replace(/\(.*?\)/g, "").trim();

  // ICD code
  const icdCode = extractField(t,
    /ICD[-\s]?10\s*:\s*([A-Z0-9.]+)/i,
    /\(ICD[-\s]?10\s*:\s*([A-Z0-9.]+)\)/i,
    /ICD\s*Code\s*:\s*([A-Z0-9.]+)/i,
  );

  // Admission date
  const admissionDate = extractField(t,
    /(?:Proposed\s+)?Date\s+of\s+Admission\s*:\s*(.+)/i,
    /Admission\s*:\s*([0-9A-Za-z\s]+?)(?:\s*\||\n)/i,
    /Date\s*:\s*(.+)/i,
  );

  // Discharge date
  const dischargeDate = extractField(t,
    /Discharge\s*:\s*([0-9A-Za-z\s]+?)(?:\s*\||\n)/i,
    /Date\s+of\s+Discharge\s*:\s*(.+)/i,
  );

  // Total / grand total amount
  const totalAmount = extractField(t,
    /GRAND\s+TOTAL\s*:\s*(INR\s*[\d,]+)/i,
    /Cashless\s+Claim\s+Amount\s+Requested\s*:\s*(INR\s*[\d,]+)/i,
    /Estimated\s+Cost\s*:\s*(INR\s*[\d,]+)/i,
    /TOTAL\s+BILLED\s*:\s*(INR\s*[\d,]+)/i,
  );

  // Doctor name
  const doctorName = extractField(t,
    /Attending\s+Doctor\s*:\s*([^\n(|]+)/i,
    /Dr\.\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/,
    /Signed\s+by\s*:\s*(.+)/i,
  );

  // Policy number
  const policyNumber = extractField(t,
    /Policy\s+(?:Number|No\.?)\s*:\s*(\S+)/i,
    /Policy\s+No\s*:\s*(\S+)/i,
  );

  const structured: Record<string, unknown> = {};
  if (patientName) structured.patient_name = patientName;
  if (hospitalName) structured.hospital_name = hospitalName;
  if (diagnosis) structured.diagnosis = diagnosis;
  if (icdCode) structured.icd_code = icdCode;
  if (admissionDate) structured.admission_date = admissionDate;
  if (dischargeDate) structured.discharge_date = dischargeDate;
  if (totalAmount) structured.total_amount = totalAmount;
  if (doctorName) structured.doctor_name = doctorName;
  if (policyNumber) structured.policy_number = policyNumber;

  console.info(`[OCR:text-parse] "${docName}" →`, structured);

  return {
    raw_text: rawText,
    structured_data: structured,
    diagnosis,
    icdCode,
    admissionDate,
    dischargeDate,
    totalAmount,
    patientName,
    hospitalName,
    doctorName,
  };
};

// ── Main OCR dispatcher ───────────────────────────────────────────────────────

/**
 * Extracts structured data from a single document.
 *
 * Strategy:
 *  • text/plain (.txt) documents → parse in the browser with regex (no image OCR needed)
 *  • image / PDF documents       → POST to backend /api/ocr/upload
 *
 * Falls back gracefully — never throws to the caller.
 */
export const runOcrOnDocument = async (document: UploadedDocument): Promise<OcrExtractedData | null> => {
  if (!document.sourceUrl) {
    return null;
  }

  try {
    const fileResponse = await fetch(document.sourceUrl);
    if (!fileResponse.ok) {
      throw new Error(`Failed to fetch document from ${document.sourceUrl}`);
    }

    const serverContentType = fileResponse.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
    const sourceExt = document.sourceUrl.split(".").pop()?.toLowerCase() ?? "";
    const isPlainText = sourceExt === "txt" || serverContentType === "text/plain";

    // ── Path A: plain-text document — parse directly, no backend round-trip ──
    if (isPlainText) {
      const rawText = await fileResponse.text();
      return parseTextDocument(rawText, document.name);
    }

    // ── Path B: image / PDF — send to backend OCR endpoint ──
    const blob = await fileResponse.blob();
    const fileName = document.uploadedFileName ?? document.name ?? "document.pdf";
    const mimeType =
      serverContentType && serverContentType !== "application/octet-stream"
        ? serverContentType
        : sourceExt === "pdf"
          ? "application/pdf"
          : document.type || "application/pdf";

    const form = new FormData();
    form.append("file", new File([blob], fileName, { type: mimeType }));

    const response = await fetch(buildApiUrl("/api/ocr/upload"), {
      method: "POST",
      body: form,
    });

    if (!response.ok) {
      throw new Error(`OCR backend returned ${response.status}`);
    }

    const data = (await response.json()) as {
      extracted_data?: {
        raw_text?: string;
        structured_data?: Record<string, unknown>;
      };
    };

    const extracted = data.extracted_data ?? {};
    const structured = (extracted.structured_data ?? {}) as Record<string, unknown>;

    const ocrResult: OcrExtractedData = {
      raw_text: extracted.raw_text,
      structured_data: structured,
      diagnosis: (structured.diagnosis as string) || (structured.Diagnosis as string) || undefined,
      icdCode: (structured.icd_code as string) || (structured.ICD_Code as string) || undefined,
      admissionDate: (structured.admission_date as string) || (structured.Admission_Date as string) || undefined,
      dischargeDate: (structured.discharge_date as string) || (structured.Discharge_Date as string) || undefined,
      totalAmount: (structured.total_amount as string) || (structured.Total_Amount as string) || undefined,
      patientName: (structured.patient_name as string) || (structured.Patient_Name as string) || undefined,
      hospitalName: (structured.hospital_name as string) || (structured.Hospital_Name as string) || undefined,
      doctorName: (structured.doctor_name as string) || (structured.Doctor_Name as string) || undefined,
      note: (structured.note as string) || undefined,
    };

    return ocrResult;
  } catch (error) {
    console.warn("[OCR] Could not process document:", document.name, error);
    return null;
  }
};


/**
 * Runs OCR on all hospital-uploaded documents for a claim.
 * Returns a map of document name → OCR result.
 */
export const runOcrOnClaimDocuments = async (
  documents: UploadedDocument[],
  onDocumentProcessed?: (docName: string, result: OcrExtractedData | null) => void,
): Promise<Map<string, OcrExtractedData | null>> => {
  const results = new Map<string, OcrExtractedData | null>();

  // Process documents sequentially to avoid overwhelming the server
  for (const doc of documents) {
    const result = await runOcrOnDocument(doc);
    results.set(doc.name, result);
    onDocumentProcessed?.(doc.name, result);
  }

  return results;
};

/** @deprecated Use runOcrOnDocument instead — this was hardcoded placeholder data */
export const simulateOCR = () => ({
  diagnosis: "Dengue Fever",
  icdCode: "A90",
  admissionDate: "2025-03-18",
  dischargeDate: "2025-03-22",
  totalAmount: "Rs 1,24,500",
  note: "NS1 antigen positive. Platelet count 45,000.",
});


export const getClaims = async () => {
  return useAppStore.getState().claims;
};

export const getNotifications = async () => {
  return useAppStore.getState().notifications;
};

export const getClaimById = async (id: string) => {
  return useAppStore.getState().claims.find((claim) => claim.id === id) ?? null;
};

export const getClaimsByPatient = async (patientId: string) => {
  return useAppStore.getState().claims.filter((claim) => claim.patientId === patientId);
};

export const getClaimsByHospital = async (hospital: string) => {
  return useAppStore.getState().claims.filter((claim) => claim.hospital === hospital);
};

export const submitClaim = async (claimInput: Partial<Claim>) => {
  let claim: Claim;
  try {
    claim = await apiRequest<Claim>("/api/workflow/claims", {
      method: "POST",
      body: {
        patientId: claimInput.patientId,
        patientName: claimInput.patientName,
        patientEmail: claimInput.patientEmail,
        hospital: claimInput.hospital,
        caseType: claimInput.caseType,
        serviceType: claimInput.serviceType,
        diagnosis: claimInput.diagnosis,
        icdCode: claimInput.icdCode,
        amount: claimInput.amount,
        documents: claimInput.documents ?? [],
        workflowCaseId: claimInput.workflowCaseId,
        caseLabel: claimInput.caseLabel,
        policyNumber: claimInput.policyNumber,
        policyStartDate: claimInput.policyStartDate,
        insurerName: claimInput.insurerName,
        hospitalRegNo: claimInput.hospitalRegNo,
        attendingDoctor: claimInput.attendingDoctor,
      },
    });
    setSyncMode("live");
  } catch {
    claim = submitLocalClaim(claimInput);
    setSyncMode("fallback");
  }

  useAppStore.getState().addClaim(claim);
  await syncWorkflowSnapshot();
  return claim;
};

export const runClaimPipeline = async (id: string) => {
  let result: { claim: Claim; pipeline_result: Record<string, unknown> };
  try {
    result = await apiRequest<{ claim: Claim; pipeline_result: Record<string, unknown> }>(
      `/api/workflow/claims/${id}/run-pipeline`,
      { method: "POST" },
    );
    setSyncMode("live");
  } catch {
    result = runLocalClaimPipeline(id);
    setSyncMode("fallback");
  }
  useAppStore.getState().updateClaim(id, result.claim);
  await syncWorkflowSnapshot();
  return result;
};

export const recordDecision = async (id: string, status: ClaimStatus, note?: string) => {
  let claim: Claim | null;
  try {
    claim = await apiRequest<Claim>(`/api/workflow/claims/${id}/decision`, {
      method: "POST",
      body: { status, note },
    });
    setSyncMode("live");
  } catch {
    claim = recordLocalDecision(id, status, note);
    setSyncMode("fallback");
  }
  if (!claim) {
    return null;
  }
  useAppStore.getState().updateClaim(id, claim);
  await syncWorkflowSnapshot();
  return claim;
};

export const sendDecisionEmail = async (id: string) => {
  const claim = useAppStore.getState().claims.find((entry) => entry.id === id);
  if (!claim) {
    return null;
  }

  const email = buildDecisionEmail(claim);
  const emails = [email, ...(claim.emails ?? [])];
  useAppStore.getState().updateClaim(id, { emails });
  return { claim: { ...claim, emails }, email };
};

export const requestMoreDocuments = async (id: string, requestNote: string) => {
  let claim: Claim | null;
  try {
    claim = await apiRequest<Claim>(`/api/workflow/claims/${id}/request-documents`, {
      method: "POST",
      body: { requestNote },
    });
    setSyncMode("live");
  } catch {
    claim = requestLocalDocuments(id, requestNote);
    setSyncMode("fallback");
  }
  if (!claim) {
    return null;
  }
  useAppStore.getState().updateClaim(id, claim);
  await syncWorkflowSnapshot();
  return claim;
};

export const addClaimDocument = async (id: string, document: UploadedDocument, uploaderRole: UserRole) => {
  let claim: Claim | null;
  try {
    claim = await apiRequest<Claim>(`/api/workflow/claims/${id}/documents`, {
      method: "POST",
      body: {
        document,
        uploaderRole,
      },
    });
    setSyncMode("live");
  } catch {
    claim = addLocalClaimDocument(id, document, uploaderRole);
    setSyncMode("fallback");
  }
  if (!claim) {
    return null;
  }
  useAppStore.getState().updateClaim(id, claim);
  await syncWorkflowSnapshot();
  return claim;
};

export const addClaimComment = async (
  id: string,
  payload: { text: string; author: string; role: UserRole; visibleTo: Comment["visibleTo"] },
) => {
  let claim: Claim | null;
  try {
    claim = await apiRequest<Claim>(`/api/workflow/claims/${id}/comments`, {
      method: "POST",
      body: payload,
    });
    setSyncMode("live");
  } catch {
    claim = addLocalClaimComment(id, payload);
    setSyncMode("fallback");
  }
  if (!claim) {
    return null;
  }
  useAppStore.getState().updateClaim(id, claim);
  await syncWorkflowSnapshot();
  return claim;
};
