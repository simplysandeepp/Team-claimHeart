"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  CircleDashed,
  LoaderCircle,
  Minus,
  Trash2,
  Upload,
} from "lucide-react";
import { ActionPanel, ConfidenceBar, DashboardCard, DecisionSupportCard, MetricCard, StepTracker, StatusChip } from "@/components/dashboard/SharedDashboard";
import { SkeletonBlock, SkeletonCard } from "@/components/ui/Skeleton";
import usePageReady from "@/hooks/usePageReady";
import { getCurrentUser } from "@/lib/api/auth";
import { submitClaim } from "@/lib/api/claims";
import { formatCurrency, formatRelativeTime } from "@/lib/claimUi";
import { resolveHospitalScenario } from "@/lib/dashboardContent";
import {
  createWorkflowClaimInput,
  getDemoCaseById,
  loadDemoDocumentCorpus,
  resolveViewerForRole,
  setActiveDemoCaseId,
  type DemoUploadSelection,
} from "@/lib/demoWorkflow";
import { useAppStore } from "@/store/useAppStore";
import type { AppUser, Claim } from "@/types";

type UploadStatus = "missing" | "scanning" | "ready" | "issue";

type UploadItem = {
  slotId: string;
  fileName: string;
  type: string;
  size: number;
  status: UploadStatus;
};

const trackSteps = (claim: Claim) => [
  { label: "Submitted", state: "complete" as const },
  { label: "Documents verified", state: claim.documents.length > 0 ? "complete" as const : "active" as const },
  { label: "Policy checked", state: claim.status !== "pending" ? "complete" as const : "active" as const },
  { label: claim.status === "denied" ? "Denied" : claim.status === "approved" ? "Approved" : "Manual review", state: claim.status === "pending" ? "upcoming" as const : "complete" as const },
  { label: "Payment sent", state: claim.status === "approved" ? "complete" as const : "upcoming" as const },
];

const statusChipTone = (status: Claim["status"]): "green" | "red" | "amber" | "blue" =>
  status === "approved" ? "green" : status === "denied" ? "red" : status === "under_review" ? "amber" : "blue";

export default function HospitalDashboardPage() {
  const ready = usePageReady();
  const claims = useAppStore((state) => state.claims);
  const [viewer, setViewer] = useState<AppUser | null>(null);
  const [corpusLoaded, setCorpusLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<"submit" | "track">("submit");
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [previewDocId, setPreviewDocId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    patientName: "Arjun Mehta",
    policyNumber: "HDFC-ERGO-2025-991203",
    hospital: "City Care Hospital, Mumbai",
    diagnosis: "Dengue Fever with Thrombocytopenia",
    requestedAmount: 22150,
  });
  const [uploads, setUploads] = useState<Record<string, UploadItem>>({});

  useEffect(() => {
    getCurrentUser().then((currentUser) => setViewer(resolveViewerForRole("hospital", currentUser)));
    loadDemoDocumentCorpus().then(() => setCorpusLoaded(true));
  }, []);

  const scenarioId = useMemo(() => resolveHospitalScenario(form.diagnosis, Number(form.requestedAmount)), [form.diagnosis, form.requestedAmount]);
  const demoCase = getDemoCaseById(scenarioId);
  const workflowClaims = useMemo(
    () => [...claims]
      .filter((claim) => claim.workflowCaseId)
      .sort((left, right) => new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime()),
    [claims],
  );
  const selectedClaim = workflowClaims.find((claim) => claim.id === selectedClaimId) ?? workflowClaims[0] ?? null;
  const averageTat = workflowClaims.length ? `${(workflowClaims.length * 2.4 / workflowClaims.length).toFixed(1)}h` : "2.4h";
  const approvedToday = workflowClaims.filter((claim) => claim.status === "approved").reduce((sum, claim) => sum + (claim.amountApproved ?? 0), 0);
  const firstPassRate = workflowClaims.length ? Math.round((workflowClaims.filter((claim) => claim.status === "approved").length / workflowClaims.length) * 100) : 82;
  const riskClaims = workflowClaims.filter((claim) => claim.status === "under_review" || claim.status === "denied").length;
  const pendingDocuments = demoCase.requiredDocuments.filter((item) => !uploads[item.slotId] || uploads[item.slotId].status === "missing").length;
  const readyDocuments = demoCase.requiredDocuments.filter((item) => uploads[item.slotId] && uploads[item.slotId].status !== "scanning").length;
  const allRequiredUploaded = demoCase.requiredDocuments.every((item) => uploads[item.slotId] && uploads[item.slotId].status !== "scanning");
  const hasDocumentIssues = demoCase.requiredDocuments.some((item) => uploads[item.slotId]?.status === "issue");
  const submissionConfidence = scenarioId === "case-3" ? 94 : scenarioId === "case-2" ? 68 : 88;
  const confidenceTone = submissionConfidence >= 90 ? "green" : submissionConfidence >= 75 ? "blue" : "amber";
  const uploadCompletionRate = Math.round((readyDocuments / demoCase.requiredDocuments.length) * 100);
  const latestInsurerMessage = selectedClaim?.timeline.filter((entry) => entry.actor === "insurer").at(-1);
  const commandStats = [
    {
      label: "Live claims",
      value: workflowClaims.length,
      tone: "blue" as const,
      badge: "Queue",
      helper: "Cases already handed to the insurer queue.",
      className: "bg-[linear-gradient(180deg,#ffffff_0%,#eaf4ff_100%)]",
    },
    {
      label: "Pending documents",
      value: pendingDocuments,
      tone: pendingDocuments > 0 ? "amber" as const : "gray" as const,
      badge: pendingDocuments > 0 ? "Blocked" : "Clear",
      helper: pendingDocuments > 0 ? "Missing files are holding submissions back." : "Every required file is already attached.",
      className: pendingDocuments > 0 ? "bg-[linear-gradient(180deg,#ffffff_0%,#fff4e6_100%)]" : "bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]",
    },
    {
      label: "Average TAT",
      value: averageTat,
      tone: "green" as const,
      badge: "Speed",
      helper: "Current adjudication turnaround speed.",
      className: "bg-[linear-gradient(180deg,#ffffff_0%,#ecfbf1_100%)]",
    },
    {
      label: "Total approved today",
      value: formatCurrency(approvedToday),
      tone: "blue" as const,
      badge: "Released",
      helper: "Settlement value already cleared today.",
      className: "bg-[linear-gradient(180deg,#ffffff_0%,#eef6ff_100%)]",
      valueClassName: "text-[17px] sm:text-[18px]",
    },
    {
      label: "Escalation risk",
      value: riskClaims,
      tone: riskClaims > 0 ? "amber" as const : "green" as const,
      badge: riskClaims > 0 ? "Watch" : "Healthy",
      helper: riskClaims > 0 ? "Claims likely to need manual insurer scrutiny." : "No high-risk submissions in queue.",
      className: riskClaims > 0 ? "bg-[linear-gradient(180deg,#ffffff_0%,#fff3ea_100%)]" : "bg-[linear-gradient(180deg,#ffffff_0%,#eefcf4_100%)]",
    },
  ];

  const decisionDesk =
    activeTab === "submit"
      ? {
          tone: !allRequiredUploaded || hasDocumentIssues ? "amber" as const : "green" as const,
          title: !allRequiredUploaded ? "Submission blocked" : hasDocumentIssues ? "Ready with review note" : "Ready for insurer",
          summary: !allRequiredUploaded
            ? "Finish the remaining intake files before you submit this case to the insurer queue."
            : hasDocumentIssues
              ? "The claim package is complete, but the document scan suggests the insurer may hold this for clarification."
              : "The package is complete and aligned. This case is in a strong state for first-pass insurer review.",
          points: [
            { label: "Case path", value: demoCase.shortLabel, helper: demoCase.expectedOutcome },
            { label: "Readiness", value: `${uploadCompletionRate}% complete`, helper: `${readyDocuments} of ${demoCase.requiredDocuments.length} required files are ready.` },
            {
              label: "Next action",
              value: !allRequiredUploaded ? `${pendingDocuments} files remaining` : hasDocumentIssues ? "Expect manual check" : "Submit now",
              helper: !allRequiredUploaded
                ? `Add ${demoCase.requiredDocuments.find((item) => !uploads[item.slotId])?.label?.toLowerCase() ?? "the remaining documents"} to unlock submission.`
                : hasDocumentIssues
                  ? "Billing or extraction anomalies should be called out in handoff notes."
                  : "No blocking intake issues are visible right now.",
            },
          ],
        }
      : selectedClaim
        ? {
            tone: statusChipTone(selectedClaim.status),
            title:
              selectedClaim.status === "approved"
                ? "Approved by insurer"
                : selectedClaim.status === "denied"
                  ? "Denied by insurer"
                  : selectedClaim.status === "under_review"
                    ? "Manual review in progress"
                    : "Queued with insurer",
            summary:
              selectedClaim.decisionNote ??
              (selectedClaim.status === "approved"
                ? "This claim has been cleared and settlement instructions are now moving to the provider."
                : selectedClaim.status === "denied"
                  ? "The insurer has issued a denial and supporting rationale for this case."
                  : "The insurer is still working through the case and may request clarifications."),
            points: [
              { label: "Claim", value: selectedClaim.id, helper: selectedClaim.patientName },
              { label: "Requested amount", value: formatCurrency(selectedClaim.amount), helper: `Submitted ${formatRelativeTime(selectedClaim.submittedAt)}` },
              {
                label: "Latest insurer note",
                value: latestInsurerMessage ? formatRelativeTime(latestInsurerMessage.time) : "No note yet",
                helper: latestInsurerMessage?.label ?? "Waiting for the first insurer update on this case.",
              },
            ],
          }
        : {
            tone: "gray" as const,
            title: "No tracked claim selected",
            summary: "Pick a submitted case to see its insurer state, recent messages, and required follow-up.",
            points: [
              { label: "Queue", value: `${workflowClaims.length} live claims`, helper: "All recent submissions appear in the tracking table below." },
            ],
          };

  const snapshotItems =
    activeTab === "submit"
      ? [
          { label: "Submission confidence", value: `${submissionConfidence}%`, helper: "Overall readiness based on documents and scenario quality." },
          { label: "First-pass approval rate", value: `${firstPassRate}%`, helper: "Recent command-center performance for cleaner submissions." },
          { label: "Open risk", value: riskClaims > 0 ? `${riskClaims} flagged` : "Low", helper: "Claims likely to need extra insurer attention." },
        ]
      : [
          { label: "Selected patient", value: selectedClaim?.patientName ?? "No claim", helper: selectedClaim?.hospital ?? "Choose a row from the tracking list." },
          { label: "Current status", value: selectedClaim ? selectedClaim.status.replace("_", " ") : "Idle", helper: selectedClaim ? `Case type: ${selectedClaim.caseType.replace("_", " ")}` : "No insurer workflow selected." },
          { label: "Progress", value: selectedClaim ? `${trackSteps(selectedClaim).filter((step) => step.state === "complete").length}/5 steps` : "0/5 steps", helper: "End-to-end claim movement through intake and insurer review." },
        ];

  useEffect(() => {
    setUploads((current) => {
      const next = { ...current };
      for (const key of Object.keys(next)) {
        if (!demoCase.requiredDocuments.find((item) => item.slotId === key)) {
          delete next[key];
        }
      }
      return next;
    });
  }, [demoCase.requiredDocuments]);

  const updateUploadStatus = (slotId: string, status: UploadStatus) => {
    setUploads((current) => ({
      ...current,
      [slotId]: {
        ...current[slotId],
        status,
      },
    }));
  };

  const handleFileSelect = (slotId: string, file?: File | null) => {
    if (!file) {
      return;
    }

    setUploads((current) => ({
      ...current,
      [slotId]: {
        slotId,
        fileName: file.name,
        type: file.type || "application/pdf",
        size: file.size,
        status: "scanning",
      },
    }));

    window.setTimeout(() => {
      const shouldFlag = resolveHospitalScenario(form.diagnosis, Number(form.requestedAmount)) === "case-2" && slotId === "billing";
      updateUploadStatus(slotId, shouldFlag ? "issue" : "ready");
    }, 1200);
  };

  const removeUpload = (slotId: string) => {
    setUploads((current) => {
      const next = { ...current };
      delete next[slotId];
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!allRequiredUploaded || !corpusLoaded || submitting) {
      return;
    }

    try {
      setSubmitting(true);
      setActiveDemoCaseId(scenarioId);
      const corpus = await loadDemoDocumentCorpus();
      const uploadPayload = demoCase.requiredDocuments.map<DemoUploadSelection>((item) => ({
        slotId: item.slotId,
        fileName: uploads[item.slotId].fileName,
        type: uploads[item.slotId].type,
        size: uploads[item.slotId].size,
      }));

      const claimInput = createWorkflowClaimInput({
        demoCase,
        uploads: uploadPayload,
        corpus,
      });

      claimInput.patientName = form.patientName;
      claimInput.policyNumber = form.policyNumber;
      claimInput.hospital = form.hospital;
      claimInput.diagnosis = form.diagnosis;
      claimInput.amount = Number(form.requestedAmount);

      const claim = await submitClaim(claimInput);
      setSelectedClaimId(claim.id);
      setActiveTab("track");
      toast.success(`Claim ${claim.id} sent to the insurer queue.`);
    } finally {
      setSubmitting(false);
    }
  };

  if (!ready || !viewer) {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <SkeletonBlock className="h-10 w-72" />
          <SkeletonBlock className="h-5 w-64" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => <SkeletonCard key={index} lines={2} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="relative isolate space-y-5 lg:space-y-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[320px] bg-[radial-gradient(circle_at_top_left,rgba(90,151,216,0.14),transparent_40%),radial-gradient(circle_at_top_right,rgba(34,197,94,0.08),transparent_34%)]" />

      <DashboardCard visual="plain" surfaceClassName="bg-[linear-gradient(132deg,#0e2e4f_0%,#13548a_48%,#1d7ca8_100%)]" className="overflow-hidden border-slate-800/10 text-white shadow-[0_24px_60px_rgba(16,35,60,0.2)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/65">Hospital operations cockpit</p>
            <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.04em] text-white">Submit cleaner claims, spot document gaps early, and track insurer responses without leaving the dashboard.</h2>
            <p className="mt-3 text-sm leading-6 text-white/78">This workspace keeps intake simple, surfaces submission quality in real time, and helps hospital teams avoid preventable review delays.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <div className="rounded-full border border-white/12 bg-white/10 px-3 py-1.5 text-[11px] font-medium text-white/86">
                {readyDocuments} of {demoCase.requiredDocuments.length} documents ready
              </div>
              <div className="rounded-full border border-white/12 bg-white/10 px-3 py-1.5 text-[11px] font-medium text-white/86">
                Confidence {submissionConfidence}%
              </div>
              <div className="rounded-full border border-white/12 bg-white/10 px-3 py-1.5 text-[11px] font-medium text-white/86">
                {averageTat} average turnaround
              </div>
              <div className="rounded-full border border-white/12 bg-white/10 px-3 py-1.5 text-[11px] font-medium text-white/86">
                {firstPassRate}% first-pass approval
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { key: "submit", label: "Submit claim" },
              { key: "track", label: "Track claims" },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key as "submit" | "track")}
                className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition ${activeTab === tab.key ? "bg-white text-[var(--ch-blue-dark)] shadow-[0_14px_28px_rgba(16,35,60,0.2)]" : "border border-white/14 bg-white/10 text-white/80 hover:bg-white/16"}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </DashboardCard>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        {commandStats.map((item) => (
          <MetricCard
            key={item.label}
            label={item.label}
            value={item.value}
            helper={item.helper}
            tone={item.tone}
            badge={item.badge}
            className={item.className}
            valueClassName={item.valueClassName}
          />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <DecisionSupportCard eyebrow="Decision board" title={decisionDesk.title} summary={decisionDesk.summary} tone={decisionDesk.tone} points={decisionDesk.points} />

        <DashboardCard className="bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_100%)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Operations snapshot</p>
              <p className="mt-2 text-[20px] font-semibold tracking-[-0.04em] text-slate-900">
                {activeTab === "submit" ? "See submission strength before you hand off the case." : "Stay ahead of insurer messages and case movement."}
              </p>
            </div>
            <StatusChip label={activeTab === "submit" ? "Intake" : "Tracking"} tone={activeTab === "submit" ? "blue" : "green"} />
          </div>

          <div className="mt-4 space-y-3">
            {snapshotItems.map((item) => (
              <div key={item.label} className="rounded-[16px] border border-slate-200 bg-white p-3 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">{item.label}</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{item.value}</p>
                <p className="mt-1 text-[12px] leading-5 text-slate-500">{item.helper}</p>
              </div>
            ))}
          </div>
        </DashboardCard>
      </div>

      {activeTab === "submit" ? (
        <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <DashboardCard className="bg-[linear-gradient(180deg,#ffffff_0%,var(--ch-blue-light)_100%)]">
            <p className="text-[14px] font-medium text-slate-900">Patient and claim details</p>
            <p className="mt-1 text-[12px] text-slate-500">Capture the essentials here. The document checklist on the right controls readiness and submission confidence.</p>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="text-[12px] text-slate-600">
                Patient name
                <input value={form.patientName} onChange={(event) => setForm((current) => ({ ...current, patientName: event.target.value }))} className="mt-1 h-11 w-full rounded-[14px] border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[var(--ch-blue)]" />
              </label>
              <label className="text-[12px] text-slate-600">
                Policy number
                <input value={form.policyNumber} onChange={(event) => setForm((current) => ({ ...current, policyNumber: event.target.value }))} className="mt-1 h-11 w-full rounded-[14px] border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[var(--ch-blue)]" />
              </label>
              <label className="text-[12px] text-slate-600">
                Hospital
                <input value={form.hospital} onChange={(event) => setForm((current) => ({ ...current, hospital: event.target.value }))} className="mt-1 h-11 w-full rounded-[14px] border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[var(--ch-blue)]" />
              </label>
              <label className="text-[12px] text-slate-600">
                Requested amount
                <input value={form.requestedAmount} type="number" onChange={(event) => setForm((current) => ({ ...current, requestedAmount: Number(event.target.value) }))} className="mt-1 h-11 w-full rounded-[14px] border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[var(--ch-blue)]" />
              </label>
              <label className="text-[12px] text-slate-600 md:col-span-2">
                Diagnosis
                <textarea value={form.diagnosis} onChange={(event) => setForm((current) => ({ ...current, diagnosis: event.target.value }))} className="mt-1 min-h-32 w-full rounded-[14px] border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-[var(--ch-blue)]" />
              </label>
            </div>
          </DashboardCard>

          <div className="space-y-4">
            <DashboardCard>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[14px] font-medium text-slate-900">Document checklist</p>
                  <p className="mt-1 text-[12px] text-slate-500">Files move from missing to scanning to ready, and flagged fields stay visible without crowding the main flow.</p>
                </div>
                <StatusChip label={`${readyDocuments} of ${demoCase.requiredDocuments.length} ready`} tone={readyDocuments === demoCase.requiredDocuments.length ? "green" : "amber"} />
              </div>

              <div className="mt-4 space-y-3">
                {demoCase.requiredDocuments.map((requirement) => {
                  const upload = uploads[requirement.slotId];
                  const status = upload?.status ?? "missing";
                  const toneWrap =
                    status === "ready"
                      ? "bg-green-50 text-green-700"
                      : status === "issue"
                        ? "bg-red-50 text-red-600"
                        : status === "scanning"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-slate-100 text-slate-500";

                  return (
                    <div key={requirement.slotId} className="rounded-[14px] border border-slate-200 bg-slate-50 p-3">
                      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                        <div className="flex items-start gap-3">
                          <div className={`flex h-9 w-9 items-center justify-center rounded-full ${toneWrap}`}>
                            {status === "ready" ? (
                              <Check className="h-4 w-4" />
                            ) : status === "issue" ? (
                              <AlertTriangle className="h-4 w-4" />
                            ) : status === "scanning" ? (
                              <LoaderCircle className="h-4 w-4 animate-spin" />
                            ) : (
                              <Minus className="h-4 w-4" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-900">{requirement.label}</p>
                            <p className="mt-1 text-[12px] text-slate-500">
                              {upload ? `${upload.fileName} - ${Math.max(1, Math.round(upload.size / 1024))} KB` : "No file uploaded yet"}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <label className="inline-flex cursor-pointer items-center gap-1 rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-[12px] font-medium text-slate-700">
                            <Upload className="h-3.5 w-3.5" />
                            {upload ? "Replace" : "Upload"}
                            <input type="file" className="hidden" onChange={(event) => handleFileSelect(requirement.slotId, event.target.files?.[0])} />
                          </label>
                          {status !== "missing" ? (
                            <>
                              {(status === "ready" || status === "issue") ? (
                                <button type="button" onClick={() => setPreviewDocId(requirement.slotId)} className="rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-[12px] font-medium text-slate-700">
                                  Preview extraction
                                </button>
                              ) : null}
                              <button type="button" onClick={() => removeUpload(requirement.slotId)} className="rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-[12px] font-medium text-slate-700">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="mt-4 text-[12px] text-slate-600">
                {readyDocuments} of {demoCase.requiredDocuments.length} documents ready
                {readyDocuments === demoCase.requiredDocuments.length ? " - ready for insurer submission." : ` - upload ${demoCase.requiredDocuments.find((item) => !uploads[item.slotId])?.label?.toLowerCase() ?? "remaining documents"} to proceed.`}
              </p>
            </DashboardCard>

            <DashboardCard className="bg-[linear-gradient(180deg,#ffffff_0%,#f3f9ff_100%)]">
              <p className="text-[14px] font-medium text-slate-900">Submission confidence</p>
              <p className="mt-1 text-[12px] text-slate-500">
                Confidence {submissionConfidence}% - {scenarioId === "case-3" ? "All documents verified, no billing anomalies detected." : scenarioId === "case-2" ? "Billing amount exceeds the allowed treatment pattern and should be reviewed." : "Coverage timing may require policy continuity proof."}
              </p>
              <div className="mt-4">
                <ConfidenceBar label="Confidence" value={submissionConfidence} tone={confidenceTone} />
              </div>
            </DashboardCard>

            <ActionPanel>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!allRequiredUploaded || submitting}
                title={!allRequiredUploaded ? "Upload every required document before submitting." : undefined}
                className="w-full rounded-[14px] bg-[var(--ch-blue)] px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_28px_rgba(90,151,216,0.22)] disabled:cursor-not-allowed disabled:opacity-45"
              >
                {submitting ? "Submitting..." : "Submit to insurer"}
              </button>
              {!allRequiredUploaded ? (
                <p className="mt-2 text-[11px] text-slate-500">All required documents must finish uploading before submission.</p>
              ) : hasDocumentIssues ? (
                <p className="mt-2 text-[11px] text-amber-700">One document has a field that should be checked by the insurer during review.</p>
              ) : null}
            </ActionPanel>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <DashboardCard className="overflow-hidden p-0">
            <div className="hidden lg:block">
              <div className="grid grid-cols-[1fr_1fr_0.9fr_0.9fr_0.8fr_0.8fr] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-[11px] uppercase tracking-[0.08em] text-slate-500">
                <span>Claim ID</span>
                <span>Patient</span>
                <span>Type</span>
                <span>Requested</span>
                <span>Status</span>
                <span>Days</span>
              </div>
              <div>
                {workflowClaims.length === 0 ? (
                  <div className="p-4 text-sm text-slate-500">Submitted claims will appear here.</div>
                ) : (
                  workflowClaims.map((claim) => (
                    <button
                      key={claim.id}
                      type="button"
                      onClick={() => setSelectedClaimId(claim.id)}
                      className={`grid w-full grid-cols-[1fr_1fr_0.9fr_0.9fr_0.8fr_0.8fr] gap-3 border-b border-slate-100 px-4 py-3 text-left text-sm ${selectedClaim?.id === claim.id ? "bg-[var(--ch-blue-light)]" : "bg-white hover:bg-slate-50"}`}
                    >
                      <span className="font-medium text-slate-900">{claim.id}</span>
                      <span className="text-slate-700">{claim.patientName}</span>
                      <span className="text-slate-600 capitalize">{claim.caseType.replace("_", " ")}</span>
                      <span className="text-slate-700">{formatCurrency(claim.amount)}</span>
                      <span><StatusChip label={claim.status.replace("_", " ")} tone={statusChipTone(claim.status)} /></span>
                      <span className="text-slate-500">{Math.max(1, Math.ceil((Date.now() - new Date(claim.submittedAt).getTime()) / 86400000))}</span>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-3 p-4 lg:hidden">
              {workflowClaims.length === 0 ? (
                <div className="text-sm text-slate-500">Submitted claims will appear here.</div>
              ) : (
                workflowClaims.map((claim) => (
                  <button
                    key={`mobile-${claim.id}`}
                    type="button"
                    onClick={() => setSelectedClaimId(claim.id)}
                    className={`w-full rounded-[14px] border p-3 text-left ${selectedClaim?.id === claim.id ? "border-[var(--ch-blue-border)] bg-[var(--ch-blue-light)]" : "border-slate-200 bg-white"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{claim.id}</p>
                        <p className="mt-1 text-[12px] text-slate-500">{claim.patientName}</p>
                      </div>
                      <StatusChip label={claim.status.replace("_", " ")} tone={statusChipTone(claim.status)} />
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 text-[12px] text-slate-600">
                      <p>Requested: {formatCurrency(claim.amount)}</p>
                      <p>Type: {claim.caseType.replace("_", " ")}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </DashboardCard>

          <DashboardCard>
            {selectedClaim ? (
              <div className="space-y-4">
                <div>
                  <p className="text-[15px] font-semibold text-slate-900">{selectedClaim.patientName}</p>
                  <p className="mt-1 text-[12px] text-slate-500">{selectedClaim.id} - {selectedClaim.hospital}</p>
                </div>
                <StepTracker steps={trackSteps(selectedClaim)} activeIndex={trackSteps(selectedClaim).findIndex((step) => step.state === "active")} />
                <div>
                  <p className="text-[12px] font-medium text-slate-900">Insurer messages</p>
                  <div className="mt-3 space-y-2">
                    {selectedClaim.timeline.filter((entry) => entry.actor === "insurer").length === 0 ? (
                      <p className="text-sm text-slate-500">No insurer messages yet.</p>
                    ) : (
                      selectedClaim.timeline
                        .filter((entry) => entry.actor === "insurer")
                        .map((entry, index) => (
                          <div key={`${entry.time}-${index}`} className="rounded-[14px] border border-slate-200 bg-slate-50 p-3">
                            <p className="text-sm text-slate-700">{entry.label}</p>
                            <p className="mt-1 text-[11px] text-slate-500">{formatRelativeTime(entry.time)}</p>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[240px] flex-col items-center justify-center text-center">
                <CircleDashed className="h-6 w-6 text-slate-400" />
                <p className="mt-3 text-sm text-slate-500">Select a submitted claim to see its progress.</p>
              </div>
            )}
          </DashboardCard>
        </div>
      )}

      {previewDocId ? (
        <>
          <button type="button" className="fixed inset-0 z-40 bg-slate-950/30" onClick={() => setPreviewDocId(null)} aria-label="Close extraction preview" />
          <aside className="fixed right-0 top-0 z-50 h-screen w-full max-w-[560px] overflow-y-auto border-l border-slate-200 bg-white p-4 shadow-[-12px_0_30px_rgba(15,23,42,0.14)]">
            {(() => {
              const requirement = demoCase.requiredDocuments.find((item) => item.slotId === previewDocId);
              const upload = previewDocId ? uploads[previewDocId] : null;
              if (!requirement || !upload) {
                return null;
              }

              const fields = [
                { label: "Patient name", value: form.patientName },
                { label: "ICD-10", value: demoCase.icdCode, lowConfidence: previewDocId === "billing" && scenarioId === "case-2" },
                { label: "Admission date", value: "05 Apr 2026" },
                { label: "Discharge date", value: "06 Apr 2026" },
              ];
              const billingRows = previewDocId === "billing"
                ? [
                    { item: "Room charges", amount: 6850 },
                    { item: "PlateMax dose 1", amount: 4200 },
                    { item: "PlateMax dose 2", amount: 4200 },
                    { item: "PlateMax dose 3", amount: scenarioId === "case-3" ? 0 : 4200 },
                  ]
                : [];

              return (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[14px] font-medium text-slate-900">{requirement.label}</p>
                      <p className="mt-1 text-[12px] text-slate-500">{upload.fileName}</p>
                    </div>
                    <button type="button" onClick={() => setPreviewDocId(null)} className="rounded-[12px] border border-slate-200 px-3 py-1 text-[12px] text-slate-600">
                      Close
                    </button>
                  </div>
                  <div className="grid gap-4 md:grid-cols-[180px_1fr]">
                    <div className="rounded-[14px] border border-slate-200 bg-slate-50 p-3">
                      <p className="text-[12px] font-medium text-slate-900">Document thumbnail</p>
                      <div className="mt-3 flex h-[220px] items-center justify-center rounded-[14px] border border-dashed border-slate-300 bg-white text-[12px] text-slate-400">
                        {requirement.label}
                      </div>
                    </div>
                    <div className="rounded-[14px] border border-slate-200 bg-slate-50 p-3">
                      <p className="text-[12px] font-medium text-slate-900">Extracted fields</p>
                      <div className="mt-3 space-y-2">
                        {fields.map((field) => (
                          <div key={field.label} className={`rounded-[14px] border p-3 ${field.lowConfidence ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"}`}>
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[12px] text-slate-500">{field.label}</p>
                              {field.lowConfidence ? <span className="text-[11px] text-amber-700">Verify this field</span> : null}
                            </div>
                            <p className="mt-1 text-sm text-slate-800">{field.value}</p>
                          </div>
                        ))}
                      </div>
                      {billingRows.length ? (
                        <div className="mt-4">
                          <p className="text-[12px] font-medium text-slate-900">Billing line items</p>
                          <div className="mt-2 overflow-hidden rounded-[14px] border border-slate-200 bg-white">
                            {billingRows.map((row) => (
                              <div key={row.item} className="flex items-center justify-between border-b border-slate-100 px-3 py-2 text-sm last:border-b-0">
                                <span className="text-slate-700">{row.item}</span>
                                <span className="text-slate-900">{formatCurrency(row.amount)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })()}
          </aside>
        </>
      ) : null}
    </div>
  );
}
