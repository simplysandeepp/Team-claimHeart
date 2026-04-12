"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Building2, Check, FileText, Landmark, ShieldCheck, Wallet, X } from "lucide-react";
import { DashboardCard, DecisionBanner, DecisionSupportCard, EvidenceDrawer, MetricCard, StepTracker, StatusChip } from "@/components/dashboard/SharedDashboard";
import { SkeletonBlock, SkeletonCard } from "@/components/ui/Skeleton";
import usePageReady from "@/hooks/usePageReady";
import { getCurrentUser, subscribeToCurrentUser } from "@/lib/api/auth";
import { addClaimDocument } from "@/lib/api/claims";
import { formatCurrency, formatRelativeTime } from "@/lib/claimUi";
import { canRoleUploadForClaim, getDocumentsUploadedBy, getLatestInsurerDocumentRequest, getSharedDocuments, getQueryOwnerRole, isPdfFile } from "@/lib/claimSync";
import { buildClaimActivity, buildPatientSteps, dashboardCoverageByCase, type PatientJourneyMode } from "@/lib/dashboardContent";
import { getActiveDemoCaseId, getDemoCaseById, resolveViewerForRole, type DemoCaseId } from "@/lib/demoWorkflow";
import { useAppStore } from "@/store/useAppStore";
import type { AppUser, UploadedDocument } from "@/types";

const activityDotClasses = {
  green: "bg-[var(--ch-green)]",
  blue: "bg-[var(--ch-blue)]",
  purple: "bg-violet-500",
  gray: "bg-slate-400",
} as const;

const inferJourneyMode = (requestedAtLabel: string, decisionLetter: string): PatientJourneyMode =>
  /cashless|pre-auth/i.test(`${requestedAtLabel} ${decisionLetter}`) ? "cashless" : "reimbursement";

const formatProfileDate = (value?: string) => {
  if (!value) {
    return "Not added yet";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const formatPolicyType = (value?: string) => {
  if (!value) {
    return "Not added yet";
  }

  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
};

export default function PatientDashboardPage() {
  const ready = usePageReady();
  const claims = useAppStore((state) => state.claims);
  const [viewer, setViewer] = useState<AppUser | null>(null);
  const [activeCaseId, setActiveCaseId] = useState<DemoCaseId>("case-2");
  const [journeyMode, setJourneyMode] = useState<PatientJourneyMode>("cashless");
  const [appealFiles, setAppealFiles] = useState<UploadedDocument[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const caseId = getActiveDemoCaseId();
    setActiveCaseId(caseId);
    getCurrentUser().then((currentUser) => setViewer(resolveViewerForRole("patient", currentUser, caseId)));
    const unsubscribe = subscribeToCurrentUser((currentUser) => setViewer(resolveViewerForRole("patient", currentUser, caseId)));
    return unsubscribe;
  }, []);

  const patientClaims = useMemo(() => {
    if (!viewer?.patientId) {
      return [];
    }

    return [...claims]
      .filter((claim) => claim.patientId === viewer.patientId)
      .sort((left, right) => new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime());
  }, [claims, viewer?.patientId]);

  const activeClaim = patientClaims[0] ?? null;
  const caseId = (activeClaim?.workflowCaseId as DemoCaseId | undefined) ?? activeCaseId;
  const demoCase = getDemoCaseById(caseId);
  const coverage = dashboardCoverageByCase[caseId];
  const inferredJourneyMode = inferJourneyMode(demoCase.requestedAtLabel, demoCase.decisionLetter);

  useEffect(() => {
    setJourneyMode(inferredJourneyMode);
  }, [caseId, inferredJourneyMode]);

  const requestedAmount = activeClaim?.amount ?? demoCase.amount;
  const approvedAmount = activeClaim?.amountApproved ?? demoCase.amountApproved;
  const status = activeClaim?.status ?? demoCase.finalStatus;
  const bannerTone = status === "approved" ? "green" : status === "denied" ? "red" : "amber";
  const bannerTitle = status === "approved" ? "Approved" : status === "denied" ? "Denied" : "In review";
  const bannerBackgroundClassName =
    status === "approved"
      ? "bg-[linear-gradient(135deg,#123f64_0%,#1f5f95_54%,#1d7ca8_100%)]"
      : status === "denied"
        ? "bg-[linear-gradient(135deg,#112843_0%,#164876_54%,#1f6e9d_100%)]"
        : "bg-[linear-gradient(135deg,#17324f_0%,#23517a_54%,#3a6f97_100%)]";
  const bannerAmount =
    status === "approved"
      ? journeyMode === "cashless"
        ? `${formatCurrency(approvedAmount)} settlement`
        : `${formatCurrency(approvedAmount)} approved`
      : status === "denied"
        ? `${formatCurrency(requestedAmount)} request`
        : `${formatCurrency(requestedAmount)} in review`;

  const activity = buildClaimActivity(activeClaim?.timeline ?? []);
  const latestTimelineTime = activeClaim?.timeline.length ? activeClaim.timeline[activeClaim.timeline.length - 1]?.time : activeClaim?.submittedAt;
  const steps = buildPatientSteps(activeClaim ?? ({ status } as typeof activeClaim), journeyMode);
  const activeStepIndex = steps.findIndex((step) => step.state === "active");
  const sharedDocuments = activeClaim ? getSharedDocuments(activeClaim) : [];
  const patientUploadedDocs = activeClaim ? getDocumentsUploadedBy(activeClaim, "patient") : [];
  const hospitalUploadedDocs = activeClaim ? getDocumentsUploadedBy(activeClaim, "hospital") : [];
  const latestDocumentRequest = activeClaim ? getLatestInsurerDocumentRequest(activeClaim) : null;
  const queryOwnerRole = activeClaim ? getQueryOwnerRole(activeClaim) : "hospital";
  const patientCanUpload = activeClaim ? canRoleUploadForClaim(activeClaim, "patient") : false;
  const decisionReason = activeClaim?.decisionNote ?? demoCase.decisionNote;
  const claimReference = activeClaim?.id ?? demoCase.shortLabel;
  const isDemoViewer = viewer?.id.startsWith("P-DEMO") ?? false;
  const policyName = viewer?.policyName ?? coverage.policyName ?? demoCase.insurer.planName;
  const policyNumber = viewer?.policyNumber ?? activeClaim?.policyNumber ?? demoCase.patient.policyNumber ?? "Not added yet";
  const policyType = formatPolicyType(viewer?.policyType ?? (isDemoViewer ? "individual" : undefined));
  const policyStartDate = formatProfileDate(viewer?.policyStartDate ?? activeClaim?.policyStartDate ?? demoCase.policyStartDate);
  const policyEndDate = formatProfileDate(viewer?.policyEndDate ?? (isDemoViewer ? coverage.renewalDate : undefined));
  const sumInsuredValue = viewer?.sumInsured ?? coverage.sumInsured;
  const insurerName = viewer?.insuranceCompany ?? coverage.insurerName ?? demoCase.insurer.name;
  const annualLimitUsedPercent = Math.round((coverage.usedThisYear / sumInsuredValue) * 100);

  const journeyMeta =
    journeyMode === "cashless"
      ? {
          label: "Cashless",
          badge: "Hospital settlement",
          title: "Hospital bills the insurer directly",
          summary: "Hospital handles insurer settlement during treatment.",
          destinationLabel: "Settlement destination",
          destinationValue: activeClaim?.hospital ?? demoCase.hospital.name,
          destinationHelper:
            status === "approved"
              ? "The approved amount moves directly to the treating hospital."
              : "The hospital remains the settlement destination for this claim.",
          documentTitle: "Documents to keep ready",
          documentList: [
            coverage.documentRequest ?? "Discharge summary if requested by the insurer.",
            "Pre-authorisation form or admission note from the hospital.",
            "Doctor notes, investigations, and any clarifications requested during review.",
          ],
          breakdownTitle: "Cashless settlement breakdown",
          breakdownDescription: "Covered hospital charges are listed below with the approved amount and any reduction reason.",
        }
      : {
          label: "Reimbursement",
          badge: "Member payout",
          title: "You pay first and claim after discharge",
          summary: "Submit final bills after treatment to get paid back.",
          destinationLabel: "Payout destination",
          destinationValue: "Your registered bank account",
          destinationHelper:
            status === "approved"
              ? "The approved amount is reimbursed to the account linked with your claim profile."
              : "Payout is released after bill and receipt review is completed.",
          documentTitle: "Documents usually required",
          documentList: [
            "Final hospital bill and payment receipt.",
            coverage.documentRequest ?? "Discharge summary and treating doctor papers.",
            "Prescriptions, reports, and any insurer clarification requested for repayment.",
          ],
          breakdownTitle: "Reimbursement review breakdown",
          breakdownDescription: "Eligible expenses are checked against your submitted bills and payment proofs.",
        };

  const nextAction =
    status === "approved"
      ? journeyMode === "cashless"
        ? "Keep discharge and decision records."
        : "Track bank payout status."
      : status === "denied"
        ? "Upload documents if you want to appeal."
        : journeyMode === "cashless"
          ? coverage.documentRequest ?? "Wait for the insurer to finish hospital review."
          : coverage.documentRequest ?? "Keep bills, receipts, and discharge papers ready.";

  const bannerDetail =
    status === "approved"
      ? journeyMode === "cashless"
        ? `Your insurer approved ${formatCurrency(approvedAmount)} and released settlement to ${activeClaim?.hospital ?? demoCase.hospital.name}.`
        : `Your insurer approved ${formatCurrency(approvedAmount)} and will release reimbursement to your registered bank account.`
      : status === "denied"
        ? activeClaim?.decisionNote ?? demoCase.decisionNote
        : journeyMode === "cashless"
          ? activeClaim?.decisionNote ?? "The insurer is still reviewing the hospital file before releasing settlement."
          : activeClaim?.decisionNote ?? "The insurer is still reviewing your bills, receipts, and discharge papers before releasing reimbursement.";

  const summaryCards: Array<{
    label: string;
    value: string;
    helper: string;
    tone: "blue" | "green" | "red" | "amber" | "gray";
    badge: string;
    className: string;
    valueClassName?: string;
  }> = [
    {
      label: "Claim path",
      value: journeyMeta.label,
      helper: journeyMode === "cashless" ? "Hospital coordinates settlement with the insurer." : "You pay first and claim repayment later.",
      tone: "blue" as const,
      badge: journeyMeta.badge,
      className: "bg-[linear-gradient(180deg,#ffffff_0%,#eef6ff_100%)]",
    },
    {
      label: "Status",
      value: bannerTitle,
      helper:
        status === "approved"
          ? "The insurer has finished review for this claim."
          : status === "denied"
            ? "The insurer shared a denial and appeal is still possible."
            : "The claim is moving through insurer review.",
      tone: bannerTone,
      badge: status === "approved" ? "Closed" : status === "denied" ? "Appeal open" : "Processing",
      className:
        status === "approved"
          ? "bg-[linear-gradient(180deg,#ffffff_0%,#ecfbf1_100%)]"
          : status === "denied"
            ? "bg-[linear-gradient(180deg,#ffffff_0%,#fff0ef_100%)]"
            : "bg-[linear-gradient(180deg,#ffffff_0%,#fff3e6_100%)]",
    },
    {
      label: journeyMode === "cashless" ? (status === "approved" ? "Settlement amount" : "Requested amount") : status === "approved" ? "Reimbursement amount" : "Claimed amount",
      value: formatCurrency(status === "approved" ? approvedAmount : requestedAmount),
      helper:
        journeyMode === "cashless"
          ? status === "approved"
            ? "This amount is settled directly with the hospital."
            : "This is the amount currently under hospital-settlement review."
          : status === "approved"
            ? "This amount is approved for repayment to you."
            : "This is the amount currently under reimbursement review.",
      tone: status === "approved" ? "green" as const : "blue" as const,
      badge: journeyMode === "cashless" ? "Hospital" : "Member",
      className: "bg-[linear-gradient(180deg,#ffffff_0%,#f3f8ff_100%)]",
    },
    {
      label: "Next action",
      value:
        status === "approved"
          ? journeyMode === "cashless"
            ? "No action needed"
            : "Watch for payout"
          : status === "denied"
            ? "Prepare appeal"
            : coverage.documentRequest
              ? "Share documents"
              : "Wait for update",
      helper: nextAction,
      tone: status === "approved" ? "gray" as const : "amber" as const,
      badge: status === "approved" ? "Stable" : "Actionable",
      className: "bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]",
      valueClassName: "text-[17px] sm:text-[18px]",
    },
  ];

  const overviewCard =
    status === "approved"
      ? {
          tone: "green" as const,
          title: journeyMode === "cashless" ? "Cashless settlement approved" : "Reimbursement approved",
          summary:
            journeyMode === "cashless"
              ? `The insurer approved ${formatCurrency(approvedAmount)} and released it to ${activeClaim?.hospital ?? demoCase.hospital.name}.`
              : `The insurer approved ${formatCurrency(approvedAmount)} for reimbursement and payout is ready for member disbursal.`,
          points: [
            { label: "Review stage", value: "Approved and closed", helper: journeyMode === "cashless" ? "Cashless review is complete and the hospital settlement has been released." : "Reimbursement review is complete and member payout can proceed." },
            { label: journeyMeta.destinationLabel, value: journeyMeta.destinationValue, helper: journeyMeta.destinationHelper },
            { label: "Your next step", value: journeyMode === "cashless" ? "Keep records" : "Watch payout", helper: nextAction },
          ],
        }
      : status === "denied"
        ? {
            tone: "red" as const,
            title: journeyMode === "cashless" ? "Cashless request denied" : "Reimbursement claim denied",
            summary: "The insurer has shared a denial. You can still upload stronger supporting documents if you want to appeal the decision.",
            points: [
              { label: "Review stage", value: "Decision issued", helper: journeyMode === "cashless" ? "Cashless review is complete and the insurer has shared its decision." : "Reimbursement review is complete and the insurer has shared its decision." },
              { label: "Decision note", value: "Review insurer reason", helper: activeClaim?.decisionNote ?? demoCase.decisionNote },
              { label: "Next step", value: "Upload appeal proof", helper: "Share any missing document, clarification, or continuity evidence." },
            ],
          }
        : {
            tone: "amber" as const,
            title: journeyMode === "cashless" ? "Cashless review in progress" : "Reimbursement review in progress",
            summary:
              journeyMode === "cashless"
                ? "The insurer is still checking the hospital file before it releases settlement."
                : "The insurer is still reviewing your bills, receipts, and discharge papers before it releases reimbursement.",
            points: [
              {
                label: "Review stage",
                value: journeyMode === "cashless" ? "Hospital file under review" : "Bills under review",
                helper: journeyMode === "cashless" ? "The insurer is checking the hospital pack before settlement is released." : "The insurer is checking bills, receipts, and discharge papers before payout is released.",
              },
              {
                label: "Open requirement",
                value: coverage.documentRequest ? "Documents requested" : "Review in progress",
                helper:
                  coverage.documentRequest ??
                  (journeyMode === "cashless"
                    ? "No new hospital file is needed from you right now."
                    : "No extra reimbursement proof is needed from you right now."),
              },
              {
                label: "Expected outcome",
                value: journeyMode === "cashless" ? "Hospital settlement update" : "Member payout update",
                helper: "You will get a notification once this review is closed.",
              },
            ],
          };

  const documentButtonLabel =
    status === "denied"
      ? "Upload appeal proof"
      : journeyMode === "reimbursement"
        ? "Upload requested PDF"
        : latestDocumentRequest
          ? "Upload requested PDF"
          : "Upload supporting PDF";

  const uploadSuccessMessage =
    journeyMode === "cashless"
      ? "Your supporting documents were shared for the hospital-settlement review."
      : "Your reimbursement documents were shared with the insurer.";

  const selectAppealFiles = (incoming: FileList | null) => {
    if (!incoming) {
      return;
    }

    const pdfFiles = Array.from(incoming).filter((file) => {
      if (isPdfFile(file)) {
        return true;
      }

      toast.error(`${file.name} is not a PDF.`);
      return false;
    });

    const mapped = pdfFiles.map<UploadedDocument>((file) => ({
      name: file.name,
      type: "application/pdf",
      size: file.size,
      uploadedAt: new Date().toISOString(),
      uploadedBy: "patient",
      category: status === "denied" ? "Appeal PDF" : "Patient Response PDF",
      processingStatus: "ready",
    }));
    setAppealFiles((current) => [...current, ...mapped]);
  };

  const removeAppealFile = (name: string) => {
    setAppealFiles((current) => current.filter((file) => file.name !== name));
  };

  const uploadAppealFiles = async () => {
    if (!activeClaim || appealFiles.length === 0) {
      toast.error("Add at least one document to continue.");
      return;
    }

    for (const file of appealFiles) {
      await addClaimDocument(activeClaim.id, file, "patient");
    }

    setAppealFiles([]);
    toast.success(uploadSuccessMessage);
  };

  if (!ready || !viewer) {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <SkeletonBlock className="h-10 w-80" />
          <SkeletonBlock className="h-5 w-72" />
        </div>
        <SkeletonCard lines={5} />
        <div className="grid gap-4 lg:grid-cols-2">
          <SkeletonCard lines={7} />
          <SkeletonCard lines={6} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 lg:space-y-6">
      <DecisionBanner
        backgroundClassName={bannerBackgroundClassName}
        amount={bannerAmount}
        title={bannerTitle}
        tone={bannerTone}
        timestamp={formatRelativeTime(activeClaim?.pipelineCompletedAt ?? activeClaim?.submittedAt ?? new Date().toISOString())}
        subtitle={`${claimReference} • ${journeyMeta.label} claim • ${activeClaim?.hospital ?? demoCase.hospital.name}`}
        detail={bannerDetail}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((item) => (
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

      <DashboardCard
        className={
          status === "approved"
            ? "bg-[linear-gradient(180deg,#ffffff_0%,#ecfbf1_100%)]"
            : status === "denied"
              ? "bg-[linear-gradient(180deg,#ffffff_0%,#fff1ef_100%)]"
              : "bg-[linear-gradient(180deg,#ffffff_0%,#fff8eb_100%)]"
        }
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Live Claim Status</p>
            <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.04em] text-slate-900">
              {status === "approved" ? "Insurer approved this claim" : status === "denied" ? "Insurer denied this claim" : "Insurer review is active"}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-700">
              {decisionReason}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusChip label={bannerTitle} tone={bannerTone} />
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600">
              Updated {formatRelativeTime(activeClaim?.pipelineCompletedAt ?? latestTimelineTime ?? new Date().toISOString())}
            </span>
          </div>
        </div>
        {status === "denied" ? (
          <div className="mt-4 rounded-[14px] border border-red-200 bg-white/80 p-4">
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-red-600">Reason For Denial</p>
            <p className="mt-2 text-sm leading-7 text-slate-700">{decisionReason}</p>
          </div>
        ) : null}
      </DashboardCard>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]">
        <DecisionSupportCard
          eyebrow="Claim overview"
          title={overviewCard.title}
          summary={overviewCard.summary}
          tone={overviewCard.tone}
          points={overviewCard.points}
          pointsClassName="lg:grid-cols-3"
          contentClassName="max-w-none"
          className="self-start"
          footer={
            <div className="flex flex-wrap gap-2.5 border-t border-slate-200/80 pt-4">
              <div className="rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-[11px] font-medium text-slate-600">
                {journeyMeta.label}
              </div>
              <div className="rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-[11px] font-medium text-slate-600">
                {bannerTitle}
              </div>
              <div className="rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-[11px] font-medium text-slate-600">
                {status === "denied" ? "Appeal option" : coverage.documentRequest ? "Docs needed" : "On track"}
              </div>
            </div>
          }
        />

        <DashboardCard className="bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_100%)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Claim path</p>
              <p className="mt-2 max-w-[28rem] text-[20px] font-semibold tracking-[-0.04em] text-slate-900">
                Switch between cashless and reimbursement journeys.
              </p>
            </div>
            <StatusChip label={journeyMeta.badge} tone="blue" />
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {(["cashless", "reimbursement"] as PatientJourneyMode[]).map((mode) => {
              const selected = journeyMode === mode;
              const iconClassName = selected ? "border-[var(--ch-blue)] bg-[var(--ch-blue)] text-white" : "border-slate-200 bg-white text-slate-500";

              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setJourneyMode(mode)}
                  className={`h-full rounded-[20px] border p-5 text-left transition-all ${
                    selected
                      ? "border-[var(--ch-blue)] bg-[linear-gradient(180deg,rgba(74,142,219,0.1),rgba(255,255,255,0.98))] shadow-[0_14px_32px_rgba(74,142,219,0.12)]"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex h-full items-start gap-4">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border ${iconClassName}`}>
                      {mode === "cashless" ? <Building2 className="h-4 w-4" /> : <Wallet className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold text-slate-900">{mode === "cashless" ? "Cashless" : "Reimbursement"}</p>
                      <p className="mt-2 max-w-[20rem] text-[13px] leading-6 text-slate-500">
                        {mode === "cashless"
                          ? "Hospital coordinates insurer settlement during treatment."
                          : "Patient pays first and submits final documents later."}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="h-full rounded-[18px] border border-slate-200 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
              <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">{journeyMeta.destinationLabel}</p>
              <p className="mt-2 text-[15px] font-semibold text-slate-900">{journeyMeta.destinationValue}</p>
              <p className="mt-2 text-[12px] leading-6 text-slate-500">{journeyMeta.destinationHelper}</p>
            </div>
            <div className="h-full rounded-[18px] border border-slate-200 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
              <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Last update</p>
              <p className="mt-2 text-[15px] font-semibold text-slate-900">{formatRelativeTime(latestTimelineTime ?? new Date().toISOString())}</p>
              <p className="mt-2 text-[12px] leading-6 text-slate-500">Most recent workflow activity on this claim.</p>
            </div>
          </div>
        </DashboardCard>
      </div>

      <StepTracker steps={steps} activeIndex={activeStepIndex >= 0 ? activeStepIndex : undefined} />

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <DashboardCard>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[14px] font-medium text-slate-900">{journeyMeta.breakdownTitle}</p>
              <p className="mt-1 text-[12px] text-slate-500">{journeyMeta.breakdownDescription}</p>
            </div>
            <StatusChip label={bannerTitle} tone={bannerTone} />
          </div>

          <div className="mt-4 space-y-3">
            {coverage.lineItems.map((item) => (
              <div key={item.name} className="rounded-[14px] border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <span className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full ${item.covered ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                      {item.covered ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{item.name}</p>
                      {item.reason ? <p className="mt-1 text-[12px] leading-5 text-slate-500">{item.reason}</p> : null}
                    </div>
                  </div>
                  <p className="text-sm font-medium text-slate-900">{formatCurrency(item.approvedAmount)}</p>
                </div>
              </div>
            ))}

            <div className="flex items-center justify-between rounded-[14px] border border-slate-200 bg-white p-3">
              <p className="text-[14px] font-medium text-slate-900">{status === "approved" ? "Total approved" : "Amount under review"}</p>
              <p className="text-base font-semibold text-slate-900">{formatCurrency(status === "approved" ? approvedAmount : requestedAmount)}</p>
            </div>
          </div>
        </DashboardCard>

        <DashboardCard>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[var(--ch-blue)]" />
            <p className="text-[14px] font-medium text-slate-900">Policy and documents</p>
          </div>

          <div className="mt-4 space-y-3 text-[12px] text-slate-600">
            <div className="rounded-[14px] border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-start gap-2">
                <FileText className="mt-0.5 h-4 w-4 text-slate-500" />
                <div>
                  <p className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Policy name</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{policyName}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{insurerName}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[14px] border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Policy number</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{policyNumber}</p>
              </div>
              <div className="rounded-[14px] border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Policy type</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{policyType}</p>
              </div>
              <div className="rounded-[14px] border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Policy start date</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{policyStartDate}</p>
              </div>
              <div className="rounded-[14px] border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Policy end date</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{policyEndDate}</p>
              </div>
            </div>

            <div className="rounded-[14px] border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-start gap-2">
                <Landmark className="mt-0.5 h-4 w-4 text-slate-500" />
                <div>
                  <p className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Sum insured</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{formatCurrency(sumInsuredValue)}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[14px] border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <span>Annual limit used</span>
                <span className="font-medium text-slate-900">{annualLimitUsedPercent}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-[var(--ch-blue)]" style={{ width: `${(coverage.usedThisYear / sumInsuredValue) * 100}%` }} />
              </div>
              <p className="mt-2 text-[11px] text-slate-500">{formatCurrency(coverage.usedThisYear)} used this year</p>
            </div>

            <div className="rounded-[14px] border border-dashed border-slate-200 bg-white p-3">
              <p className="text-[11px] uppercase tracking-[0.08em] text-slate-500">{journeyMeta.documentTitle}</p>
              <div className="mt-3 space-y-2">
                {journeyMeta.documentList.map((item) => (
                  <div key={item} className="flex items-start gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-[var(--ch-blue)]" />
                    <p className="text-[12px] leading-5 text-slate-600">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[14px] border border-dashed border-slate-200 bg-white p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[14px] font-medium text-slate-900">Upload documents</p>
                  <p className={`mt-1 text-[12px] ${coverage.documentRequest ? "text-amber-700" : "text-slate-500"}`}>
                    {status === "denied"
                      ? "Add stronger evidence if you want the insurer to review an appeal."
                      : journeyMode === "reimbursement"
                        ? coverage.documentRequest ?? "Share bills, receipts, discharge papers, or any requested proof."
                        : coverage.documentRequest ?? "Share any hospital document or clarification requested by the insurer."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {patientCanUpload ? (
                    <>
                      <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" multiple className="hidden" onChange={(event) => selectAppealFiles(event.target.files)} />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className={`rounded-[12px] px-3 py-2 text-[12px] font-semibold ${latestDocumentRequest || status === "denied" ? "bg-amber-500 text-white" : "border border-slate-200 bg-white text-slate-700"}`}
                      >
                        {documentButtonLabel}
                      </button>
                      {appealFiles.length ? (
                        <button
                          type="button"
                          onClick={uploadAppealFiles}
                          className="rounded-[12px] bg-[var(--ch-blue)] px-3 py-2 text-[12px] font-semibold text-white shadow-[0_12px_24px_rgba(90,151,216,0.22)]"
                        >
                          Send
                        </button>
                      ) : null}
                    </>
                  ) : (
                    <span className="rounded-[12px] border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] font-medium text-slate-600">
                      {latestDocumentRequest && queryOwnerRole === "hospital" ? "Hospital is handling this request" : "No patient upload needed"}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[14px] border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Fetched automatically</p>
                  <div className="mt-3 space-y-2 text-[12px] text-slate-600">
                    <p>Policy number from patient profile: {policyNumber}</p>
                    <p>Hospital upload bundle: {hospitalUploadedDocs.length} PDF{hospitalUploadedDocs.length === 1 ? "" : "s"}</p>
                    <p>Hospital registration: {activeClaim?.hospitalRegNo ?? demoCase.hospital.regNo}</p>
                  </div>
                </div>
                <div className="rounded-[14px] border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Your shared uploads</p>
                  <div className="mt-3 space-y-2 text-[12px] text-slate-600">
                    <p>Uploaded by you: {patientUploadedDocs.length} PDF{patientUploadedDocs.length === 1 ? "" : "s"}</p>
                    <p>Current query owner: {queryOwnerRole === "patient" ? "Patient" : "Hospital"}</p>
                    <p>{latestDocumentRequest ? `Latest insurer request: ${latestDocumentRequest.note}` : "No active insurer request right now."}</p>
                  </div>
                </div>
              </div>

              {appealFiles.length ? (
                <div className="mt-4 space-y-2">
                  {appealFiles.map((file) => (
                    <div key={`${file.name}-${file.uploadedAt}`} className="flex items-center justify-between gap-3 rounded-[14px] border border-slate-200 bg-slate-50 p-3 text-[12px]">
                      <div>
                        <p className="font-medium text-slate-900">{file.name}</p>
                        <p className="text-slate-500">{Math.max(1, Math.round(file.size / 1024))} KB</p>
                      </div>
                      <button type="button" onClick={() => removeAppealFile(file.name)} className="text-slate-500 hover:text-slate-900">
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              {sharedDocuments.length ? (
                <div className="mt-4 space-y-2">
                  <p className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Shared claim PDFs</p>
                  {sharedDocuments.map((file) => (
                    <div key={`${file.name}-${file.uploadedAt}`} className="flex items-center justify-between gap-3 rounded-[14px] border border-slate-200 bg-slate-50 p-3 text-[12px]">
                      <div>
                        <p className="font-medium text-slate-900">{file.category ?? file.name}</p>
                        <p className="text-slate-500">
                          {file.uploadedBy} - {Math.max(1, Math.round(file.size / 1024))} KB - {formatRelativeTime(file.uploadedAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </DashboardCard>
      </div>

      <EvidenceDrawer buttonLabel="Claim activity" title="Recent events for this claim, newest first">
        <div className="space-y-3">
          {activity.length === 0 ? (
            <p className="text-sm text-slate-500">Activity will appear here once a claim is submitted.</p>
          ) : (
            activity.map((entry, index) => (
              <div key={`${entry.time}-${index}`} className="flex gap-3 rounded-[14px] border border-slate-200 bg-slate-50 p-3">
                <span className={`mt-1 h-2.5 w-2.5 rounded-full ${activityDotClasses[entry.tone as keyof typeof activityDotClasses]}`} />
                <div>
                  <p className="text-sm text-slate-700">{entry.label}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{formatRelativeTime(entry.time)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </EvidenceDrawer>

      <EvidenceDrawer buttonLabel="View decision letter" title="Formal patient communication">
        {activeClaim?.decisionLetter ?? demoCase.decisionLetter ? (
          <div className="whitespace-pre-wrap rounded-[14px] border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-700">
            {activeClaim?.decisionLetter ?? demoCase.decisionLetter}
          </div>
        ) : (
          <p className="text-sm text-slate-500">The full letter will appear after the insurer finishes review.</p>
        )}
      </EvidenceDrawer>
    </div>
  );
}
