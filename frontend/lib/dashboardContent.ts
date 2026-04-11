import { getDemoCaseById, type DemoCaseId } from "@/lib/demoWorkflow";
import type { Claim, TimelineEntry, WorkflowAuditEntry } from "@/types";

export type CoverageLineItem = {
  name: string;
  approvedAmount: number;
  covered: boolean;
  reason?: string;
};

export type DocumentExtractionField = {
  label: string;
  value: string;
  lowConfidence?: boolean;
};

export type ChecklistDocument = {
  key: string;
  label: string;
  status: "missing" | "scanning" | "ready" | "issue";
  fileName?: string;
  sizeLabel?: string;
  extractedFields: DocumentExtractionField[];
  billingRows?: { item: string; amount: number }[];
};

export const dashboardCoverageByCase: Record<
  DemoCaseId,
  {
    policyName: string;
    sumInsured: number;
    usedThisYear: number;
    renewalDate: string;
    insurerName: string;
    documentRequest?: string;
    lineItems: CoverageLineItem[];
    policyExcerpt: { clause: string; title: string; body: string };
    clauseReasons: { title: string; tone: "green" | "red" | "amber"; description: string }[];
  }
> = {
  "case-1": {
    policyName: "Smart Health Plus - Individual",
    sumInsured: 500000,
    usedThisYear: 28000,
    renewalDate: "25 Jan 2027",
    insurerName: "HDFC ERGO General Insurance",
    documentRequest: "Your insurer has requested proof of prior policy continuity by April 15.",
    lineItems: [
      { name: "Room charges", approvedAmount: 0, covered: false, reason: "This admission falls inside the 24-month waiting period for general hospitalisation." },
      { name: "Doctor consultation", approvedAmount: 0, covered: false, reason: "The policy waiting period applies to the full treatment episode, not just selected items." },
      { name: "Medicines and consumables", approvedAmount: 0, covered: false, reason: "These charges cannot be released when the admission itself is not yet payable." },
    ],
    policyExcerpt: {
      clause: "Clause 3.2",
      title: "General hospitalisation waiting period",
      body: "Non-accidental hospitalisation benefits become payable after 24 continuous months from the policy start date. Claims raised before that point are not eligible unless continuity proof changes the waiting-period calculation.",
    },
    clauseReasons: [
      {
        title: "Waiting period still applies",
        tone: "red",
        description: "Your policy started on 25 Jan 2025, so the admission date is still inside the 24-month waiting period for this type of treatment.",
      },
      {
        title: "Clinical records are otherwise acceptable",
        tone: "green",
        description: "The hospital documents are readable and consistent, but coverage is blocked by the policy timing rather than the medical evidence.",
      },
    ],
  },
  "case-2": {
    policyName: "Smart Health Plus - Individual",
    sumInsured: 500000,
    usedThisYear: 22150,
    renewalDate: "10 Mar 2027",
    insurerName: "HDFC ERGO General Insurance",
    documentRequest: "Your insurer has requested your discharge summary by April 15.",
    lineItems: [
      { name: "Room charges", approvedAmount: 6850, covered: true },
      { name: "PlateMax dose 1", approvedAmount: 4200, covered: true },
      { name: "PlateMax dose 2", approvedAmount: 4200, covered: true },
      { name: "PlateMax dose 3", approvedAmount: 0, covered: false, reason: "PlateMax dose 3 was not covered because your plan allows a maximum of 2 doses within 24 hours." },
      { name: "Lab and diagnostics", approvedAmount: 6900, covered: true },
    ],
    policyExcerpt: {
      clause: "Section 5.2",
      title: "Platelet-supportive treatment limits",
      body: "Platelet-supportive injectable agents are covered for a maximum of two administrations in any 24-hour period unless extra clinical justification is submitted and accepted during manual review.",
    },
    clauseReasons: [
      {
        title: "Base policy eligibility passed",
        tone: "green",
        description: "The plan is active and the diagnosis is covered, so the claim itself remains eligible for review.",
      },
      {
        title: "Billing needs clarification",
        tone: "amber",
        description: "The invoice shows a third PlateMax dose within one day, so settlement is paused until the insurer receives supporting records.",
      },
    ],
  },
  "case-3": {
    policyName: "Smart Health Plus - Individual",
    sumInsured: 500000,
    usedThisYear: 17740,
    renewalDate: "10 Mar 2027",
    insurerName: "HDFC ERGO General Insurance",
    lineItems: [
      { name: "Room charges", approvedAmount: 6850, covered: true },
      { name: "PlateMax dose 1", approvedAmount: 4200, covered: true },
      { name: "PlateMax dose 2", approvedAmount: 4200, covered: true },
      { name: "Lab and diagnostics", approvedAmount: 2490, covered: true },
    ],
    policyExcerpt: {
      clause: "Section 5.2",
      title: "Platelet-supportive treatment limits",
      body: "Platelet-supportive injectable agents are covered when the dosing stays within the permitted frequency and the diagnosis is supported by the submitted clinical evidence.",
    },
    clauseReasons: [
      {
        title: "Policy checks passed",
        tone: "green",
        description: "Coverage is active, the diagnosis is supported by the submitted reports, and the corrected bill stays within the allowed dosing rule.",
      },
      {
        title: "No further action needed",
        tone: "green",
        description: "Settlement has already been released to the hospital because the document set and billing rules now align.",
      },
    ],
  },
};

type TrackerState = "complete" | "active" | "upcoming";

export const buildPatientSteps = (claim: Claim | null): { label: string; state: TrackerState }[] => {
  const finalStepLabel = claim?.status === "denied" ? "Denied" : "Approved";
  const paymentStepState: TrackerState = claim?.status === "approved" ? "complete" : claim?.status === "denied" ? "upcoming" : "active";

  return [
    { label: "Submitted", state: claim ? "complete" : "active" },
    { label: "Documents verified", state: claim ? "complete" : "upcoming" },
    { label: "Policy checked", state: claim ? "complete" : "upcoming" },
    {
      label: finalStepLabel,
      state: claim?.status === "approved" || claim?.status === "denied" || claim?.status === "under_review" ? "complete" : "upcoming",
    },
    { label: "Payment sent", state: paymentStepState },
  ];
};

export const buildClaimActivity = (timeline: TimelineEntry[]) =>
  [...timeline]
    .sort((left, right) => new Date(right.time).getTime() - new Date(left.time).getTime())
    .map((entry) => ({
      ...entry,
      tone:
        /approved|settlement|released/i.test(entry.label)
          ? "green"
          : /uploaded|appeal|patient/i.test(entry.label)
            ? "purple"
            : /system|queued|policy|validation|review started/i.test(entry.label)
              ? "blue"
              : "gray",
    }));

export const buildTechnicalDetails = (auditTrail: WorkflowAuditEntry[], claim: Claim) => ({
  auditTrail,
  policyJson: {
    claimId: claim.id,
    policyNumber: claim.policyNumber,
    insurerName: claim.insurerName,
    riskScore: claim.riskScore,
    workflowState: claim.workflowState,
  },
});

export const buildHospitalChecklist = (caseId: DemoCaseId, uploads: Record<string, { fileName: string; size: number } | undefined>) => {
  const demoCase = getDemoCaseById(caseId);

  return demoCase.requiredDocuments.map<ChecklistDocument>((requirement, index) => {
    const uploaded = uploads[requirement.slotId];
    const baseFields: DocumentExtractionField[] = [
      { label: "Patient name", value: demoCase.patient.name },
      { label: "ICD-10", value: demoCase.icdCode, lowConfidence: caseId === "case-2" && requirement.slotId === "billing" },
      { label: "Admission date", value: "05 Apr 2026" },
      { label: "Discharge date", value: "06 Apr 2026" },
    ];

    return {
      key: requirement.slotId,
      label: requirement.label,
      status: !uploaded ? "missing" : caseId === "case-2" && requirement.slotId === "billing" ? "issue" : index === 0 ? "ready" : "ready",
      fileName: uploaded?.fileName,
      sizeLabel: uploaded ? `${Math.max(1, Math.round(uploaded.size / 1024))} KB` : undefined,
      extractedFields: baseFields,
      billingRows:
        requirement.slotId === "billing"
          ? [
              { item: "Room charges", amount: 6850 },
              { item: "PlateMax dose 1", amount: 4200 },
              { item: "PlateMax dose 2", amount: 4200 },
              { item: "PlateMax dose 3", amount: caseId === "case-3" ? 0 : 4200 },
            ]
          : undefined,
    };
  });
};

export const resolveHospitalScenario = (diagnosis: string, amount: number): DemoCaseId => {
  const diagnosisValue = diagnosis.toLowerCase();
  if (diagnosisValue.includes("dengue")) {
    return amount <= 18000 ? "case-3" : "case-2";
  }
  return "case-1";
};
