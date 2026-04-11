"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, ShieldCheck, X } from "lucide-react";
import { DashboardCard, DecisionBanner, DecisionSupportCard, EvidenceDrawer, MetricCard, ReasonCard, StepTracker, StatusChip } from "@/components/dashboard/SharedDashboard";
import { SkeletonBlock, SkeletonCard } from "@/components/ui/Skeleton";
import usePageReady from "@/hooks/usePageReady";
import { getCurrentUser } from "@/lib/api/auth";
import { addClaimDocument } from "@/lib/api/claims";
import { formatCurrency, formatRelativeTime } from "@/lib/claimUi";
import { buildClaimActivity, buildPatientSteps, buildTechnicalDetails, dashboardCoverageByCase } from "@/lib/dashboardContent";
import { getActiveDemoCaseId, getDemoCaseById, resolveViewerForRole, type DemoCaseId } from "@/lib/demoWorkflow";
import { useAppStore } from "@/store/useAppStore";
import type { AppUser, UploadedDocument } from "@/types";

const activityDotClasses = {
  green: "bg-[var(--ch-green)]",
  blue: "bg-[var(--ch-blue)]",
  purple: "bg-violet-500",
  gray: "bg-slate-400",
} as const;

export default function PatientDashboardPage() {
  const ready = usePageReady();
  const claims = useAppStore((state) => state.claims);
  const [viewer, setViewer] = useState<AppUser | null>(null);
  const [activeCaseId, setActiveCaseId] = useState<DemoCaseId>("case-2");
  const [appealFiles, setAppealFiles] = useState<UploadedDocument[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const caseId = getActiveDemoCaseId();
    setActiveCaseId(caseId);
    getCurrentUser().then((currentUser) => setViewer(resolveViewerForRole("patient", currentUser, caseId)));
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
  const approvedAmount = activeClaim?.amountApproved ?? demoCase.amountApproved;
  const status = activeClaim?.status ?? demoCase.finalStatus;
  const bannerTone = status === "approved" ? "green" : status === "denied" ? "red" : "amber";
  const bannerTitle = status === "approved" ? "Approved" : status === "denied" ? "Denied" : "Manual review";
  const bannerAmount = status === "denied" ? formatCurrency(0) : formatCurrency(approvedAmount);
  const bannerBackgroundClassName =
    status === "approved"
      ? "bg-[linear-gradient(135deg,#123f64_0%,#1f5f95_54%,#1d7ca8_100%)]"
      : status === "denied"
        ? "bg-[linear-gradient(135deg,#112843_0%,#164876_54%,#1f6e9d_100%)]"
        : "bg-[linear-gradient(135deg,#17324f_0%,#23517a_54%,#3a6f97_100%)]";
  const steps = buildPatientSteps(activeClaim ?? ({ status } as typeof activeClaim));
  const activity = buildClaimActivity(activeClaim?.timeline ?? []);
  const technical = activeClaim ? buildTechnicalDetails(activeClaim.auditTrail ?? [], activeClaim) : null;
  const annualLimitUsedPercent = Math.round((coverage.usedThisYear / coverage.sumInsured) * 100);
  const claimAgeDays = activeClaim ? Math.max(1, Math.ceil((Date.now() - new Date(activeClaim.submittedAt).getTime()) / 86400000)) : 0;
  const latestTimelineTime = activeClaim?.timeline.length ? activeClaim.timeline[activeClaim.timeline.length - 1]?.time : activeClaim?.submittedAt;

  const bannerDetail =
    status === "approved"
      ? `Settlement has been released to ${activeClaim?.hospital ?? demoCase.hospital.name} - no action needed from you.`
      : status === "denied"
        ? activeClaim?.decisionNote ?? demoCase.decisionNote
        : activeClaim?.decisionNote ?? "Your insurer is reviewing one billed item before settlement can be released.";

  const summaryCards = [
    {
      label: "Decision state",
      value: bannerTitle,
      helper: status === "approved" ? "Claim closed and settlement released." : status === "denied" ? "Formal denial shared for appeal review." : "One billed item is still under review.",
      tone: status === "approved" ? "green" as const : status === "denied" ? "red" as const : "amber" as const,
      badge: status === "approved" ? "Closed" : status === "denied" ? "Appeal open" : "In review",
      className:
        status === "approved"
          ? "bg-[linear-gradient(180deg,#ffffff_0%,#ecfbf1_100%)]"
          : status === "denied"
            ? "bg-[linear-gradient(180deg,#ffffff_0%,#fff0ef_100%)]"
            : "bg-[linear-gradient(180deg,#ffffff_0%,#fff3e6_100%)]",
    },
    {
      label: "Settlement destination",
      value: activeClaim?.hospital ?? demoCase.hospital.name,
      helper: status === "approved" ? "Funds move directly to the treating hospital." : "Provider tied to the current claim record.",
      tone: "blue" as const,
      badge: "Provider",
      className: "bg-[linear-gradient(180deg,#ffffff_0%,#eaf4ff_100%)]",
      valueClassName: "text-[17px] sm:text-[18px]",
    },
    {
      label: "Annual cover used",
      value: `${annualLimitUsedPercent}%`,
      helper: `${formatCurrency(coverage.usedThisYear)} used from your yearly limit.`,
      tone: annualLimitUsedPercent >= 70 ? "amber" as const : "blue" as const,
      badge: annualLimitUsedPercent >= 70 ? "Watch limit" : "Healthy",
      className: "bg-[linear-gradient(180deg,#ffffff_0%,#f0f7ff_100%)]",
    },
    {
      label: "Next step",
      value: status === "approved" ? "No action needed" : status === "denied" ? "Raise appeal" : "Wait for review",
      helper: status === "approved" ? "Keep the decision letter for your records." : status === "denied" ? "Upload supporting documents if you want to challenge the outcome." : "We will notify you when the insurer clears the last check.",
      tone: status === "approved" ? "gray" as const : "amber" as const,
      badge: status === "approved" ? "Stable" : "Actionable",
      className:
        status === "approved"
          ? "bg-[linear-gradient(180deg,#ffffff_0%,#f7fafc_100%)]"
          : status === "denied"
            ? "bg-[linear-gradient(180deg,#ffffff_0%,#fff4e8_100%)]"
            : "bg-[linear-gradient(180deg,#ffffff_0%,#fff4e8_100%)]",
      valueClassName: "text-[17px] sm:text-[18px]",
    },
    {
      label: "Claim age",
      value: `${claimAgeDays} days`,
      helper: claimAgeDays <= 2 ? "Within expected processing window." : "Keep notifications on for final closure updates.",
      tone: claimAgeDays <= 2 ? "green" as const : "amber" as const,
      badge: claimAgeDays <= 2 ? "On time" : "Keep watch",
      className: claimAgeDays <= 2 ? "bg-[linear-gradient(180deg,#ffffff_0%,#ecfbf3_100%)]" : "bg-[linear-gradient(180deg,#ffffff_0%,#fff3e8_100%)]",
    },
  ];

  const decisionSupport =
    status === "approved"
      ? {
          tone: "green" as const,
          title: "Settlement cleared",
          summary: `Your insurer has approved ${formatCurrency(approvedAmount)} and released settlement instructions to ${activeClaim?.hospital ?? demoCase.hospital.name}.`,
          points: [
            { label: "Amount settled", value: formatCurrency(approvedAmount), helper: "This is the final approved amount for the current claim." },
            { label: "Money goes to", value: activeClaim?.hospital ?? demoCase.hospital.name, helper: "Hospital settlement is handled directly." },
            { label: "Your next step", value: "Keep records", helper: "Save the decision letter and policy excerpt for future reference." },
          ],
        }
      : status === "denied"
        ? {
            tone: "red" as const,
            title: "Appeal path open",
            summary: "This claim is currently denied, but you can still add supporting evidence and challenge the outcome with a clearer medical or policy record.",
            points: [
              { label: "Decision basis", value: "Policy or document mismatch", helper: activeClaim?.decisionNote ?? demoCase.decisionNote },
              { label: "Best next move", value: "Upload supporting proof", helper: "Use discharge papers, continuity proof, or doctor clarification." },
              { label: "Member task", value: "Review the letter", helper: "The formal reason is available in the drawer below." },
            ],
          }
        : {
            tone: "amber" as const,
            title: "Review still in progress",
            summary: "The claim is mostly processed, but one billed item still needs insurer confirmation before settlement can be released.",
            points: [
              { label: "Current blocker", value: "Manual insurer check", helper: activeClaim?.decisionNote ?? "One billed item needs additional review before closure." },
              { label: "What to expect", value: "Final update soon", helper: "You will receive a notification when the insurer closes the review." },
              { label: "Member action", value: coverage.documentRequest ? "Keep documents ready" : "Wait for update", helper: coverage.documentRequest ?? "No extra file is required from you right now." },
            ],
          };

  const coveragePulse = [
    {
      label: "Covered items",
      value: `${coverage.lineItems.filter((item) => item.covered).length}/${coverage.lineItems.length}`,
      helper: "Approved line items in the billed treatment set.",
    },
    {
      label: "Plan name",
      value: coverage.policyName,
      helper: "Active policy used for this claim.",
    },
    {
      label: "Requested document",
      value: coverage.documentRequest ? "Needed" : "Clear",
      helper: coverage.documentRequest ?? "No open document request on this case.",
    },
    {
      label: "Last update",
      value: formatRelativeTime(latestTimelineTime ?? new Date().toISOString()),
      helper: "Most recent workflow event shown in your claim activity.",
    },
  ];

  const selectAppealFiles = (incoming: FileList | null) => {
    if (!incoming) {
      return;
    }

    const mapped = Array.from(incoming).map<UploadedDocument>((file) => ({
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      uploadedAt: new Date().toISOString(),
      uploadedBy: "patient",
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
    toast.success("Your supporting documents were shared with the insurer.");
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
        amount={`${bannerAmount} ${bannerTitle.toLowerCase()}`}
        title={bannerTitle}
        tone={bannerTone}
        timestamp={formatRelativeTime(activeClaim?.pipelineCompletedAt ?? activeClaim?.submittedAt ?? new Date().toISOString())}
        subtitle={`${activeClaim?.id ?? "No active claim"} - ${activeClaim?.hospital ?? demoCase.hospital.name}`}
        detail={bannerDetail}
        actions={
          status === "denied" ? (
            <>
              <button
                type="button"
                onClick={() => toast.success("Decision letter ready in the evidence drawer below.")}
                className="rounded-[12px] border border-white/15 bg-white/8 px-3 py-2 text-[12px] font-semibold text-white"
              >
                Download letter
              </button>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-[12px] bg-[var(--ch-blue)] px-3 py-2 text-[12px] font-semibold text-white shadow-[0_12px_24px_rgba(90,151,216,0.22)]">
                Raise appeal
              </button>
            </>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
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

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <DecisionSupportCard
          eyebrow="Decision desk"
          title={decisionSupport.title}
          summary={decisionSupport.summary}
          tone={decisionSupport.tone}
          points={decisionSupport.points}
          actions={
            <>
              <button
                type="button"
                onClick={() => toast.success("Decision letter ready in the evidence drawer below.")}
                className="rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700"
              >
                View letter
              </button>
              {status !== "approved" ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-[12px] bg-[var(--ch-blue)] px-3 py-2 text-[12px] font-semibold text-white shadow-[0_12px_24px_rgba(90,151,216,0.18)]"
                >
                  {status === "denied" ? "Upload appeal proof" : "Upload requested file"}
                </button>
              ) : null}
            </>
          }
          footer={
            <div className="flex flex-wrap gap-2">
              <div className="rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-[11px] font-medium text-slate-600">
                {activeClaim?.id ?? "Pending claim"}
              </div>
              <div className="rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-[11px] font-medium text-slate-600">
                {coverage.policyName}
              </div>
            </div>
          }
        />

        <DashboardCard className="bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_100%)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Coverage pulse</p>
              <p className="mt-2 text-[20px] font-semibold tracking-[-0.04em] text-slate-900">See coverage health and open requests in one glance.</p>
            </div>
            <StatusChip label={bannerTitle} tone={bannerTone} />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {coveragePulse.map((item) => (
              <div key={item.label} className="rounded-[16px] border border-slate-200 bg-white p-3 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">{item.label}</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{item.value}</p>
                <p className="mt-1 text-[12px] leading-5 text-slate-500">{item.helper}</p>
              </div>
            ))}
          </div>
        </DashboardCard>
      </div>

      <StepTracker steps={steps} activeIndex={steps.findIndex((step) => step.state === "active")} />

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <DashboardCard>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[14px] font-medium text-slate-900">What's covered</p>
              <p className="mt-1 text-[12px] text-slate-500">Each billed item is shown with the approved amount and a plain-language reason when something changed.</p>
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
              <p className="text-[14px] font-medium text-slate-900">Total approved</p>
              <p className="text-base font-semibold text-slate-900">{formatCurrency(approvedAmount)}</p>
            </div>
          </div>
        </DashboardCard>

        <DashboardCard>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[var(--ch-blue)]" />
            <p className="text-[14px] font-medium text-slate-900">Your coverage</p>
          </div>

          <div className="mt-4 space-y-3 text-[12px] text-slate-600">
            <div className="rounded-[14px] border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Policy</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{coverage.policyName}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[14px] border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Sum insured</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{formatCurrency(coverage.sumInsured)}</p>
              </div>
              <div className="rounded-[14px] border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Renewal date</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{coverage.renewalDate}</p>
              </div>
            </div>
            <div className="rounded-[14px] border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <span>Annual limit used</span>
                <span className="font-medium text-slate-900">{annualLimitUsedPercent}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-[var(--ch-blue)]" style={{ width: `${(coverage.usedThisYear / coverage.sumInsured) * 100}%` }} />
              </div>
              <p className="mt-2 text-[11px] text-slate-500">{formatCurrency(coverage.usedThisYear)} used this year</p>
            </div>
            <div className="rounded-[14px] border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Insurer</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{coverage.insurerName}</p>
            </div>
          </div>
        </DashboardCard>
      </div>

      {coverage.clauseReasons.map((reason) => (
        <ReasonCard key={reason.title} tone={reason.tone} title={reason.title} description={reason.description} />
      ))}

      <DashboardCard className="border-dashed">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[14px] font-medium text-slate-900">Supporting documents</p>
            <p className={`mt-1 text-[12px] ${coverage.documentRequest ? "text-amber-700" : "text-slate-500"}`}>
              {coverage.documentRequest ?? "Need to add supporting documents for an appeal?"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(event) => selectAppealFiles(event.target.files)} />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`rounded-[12px] px-3 py-2 text-[12px] font-semibold ${coverage.documentRequest ? "bg-amber-500 text-white" : "border border-slate-200 bg-white text-slate-700"}`}
            >
              Upload file
            </button>
            {appealFiles.length ? (
              <button type="button" onClick={uploadAppealFiles} className="rounded-[12px] bg-[var(--ch-blue)] px-3 py-2 text-[12px] font-semibold text-white shadow-[0_12px_24px_rgba(90,151,216,0.22)]">
                Send
              </button>
            ) : null}
          </div>
        </div>

        {appealFiles.length ? (
          <div className="mt-4 space-y-2">
            {appealFiles.map((file) => (
              <div key={`${file.name}-${file.uploadedAt}`} className="flex items-center justify-between gap-3 rounded-[14px] border border-slate-200 bg-white p-3 text-[12px]">
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
      </DashboardCard>

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

      <div className="grid gap-4 xl:grid-cols-2">
        <EvidenceDrawer buttonLabel="View full decision letter" title="Formal patient communication">
          {activeClaim?.decisionLetter ?? demoCase.decisionLetter ? (
            <div className="rounded-[14px] border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-700 whitespace-pre-wrap">
              {activeClaim?.decisionLetter ?? demoCase.decisionLetter}
            </div>
          ) : (
            <p className="text-sm text-slate-500">The full letter will appear after the insurer finishes review.</p>
          )}
        </EvidenceDrawer>

        <EvidenceDrawer buttonLabel="View policy excerpt" title={`${coverage.policyExcerpt.clause} - ${coverage.policyExcerpt.title}`}>
          <blockquote className="rounded-[14px] border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-700">
            {coverage.policyExcerpt.body}
          </blockquote>
        </EvidenceDrawer>
      </div>

      <EvidenceDrawer buttonLabel="Technical details (for reference)" title="Agent outcomes, confidence, and structured data" defaultOpen={false}>
        {activeClaim ? (
          <div className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-3">
              <DashboardCard className="p-3">
                <p className="text-[12px] font-medium text-slate-900">Policy result</p>
                <p className="mt-1 text-sm text-slate-600">{activeClaim.aiResults.policy.reason}</p>
              </DashboardCard>
              <DashboardCard className="p-3">
                <p className="text-[12px] font-medium text-slate-900">Medical result</p>
                <p className="mt-1 text-sm text-slate-600">{activeClaim.aiResults.medical.reason}</p>
              </DashboardCard>
              <DashboardCard className="p-3">
                <p className="text-[12px] font-medium text-slate-900">Cross validation</p>
                <p className="mt-1 text-sm text-slate-600">{activeClaim.aiResults.cross.reason}</p>
              </DashboardCard>
            </div>
            <div className="rounded-[14px] border border-slate-200 bg-slate-50 p-4">
              <p className="text-[12px] font-medium text-slate-900">Structured claim snapshot</p>
              <pre className="mt-3 overflow-auto text-[12px] leading-6 text-slate-700">{JSON.stringify(technical?.policyJson, null, 2)}</pre>
            </div>
            <div className="rounded-[14px] border border-slate-200 bg-slate-50 p-4">
              <p className="text-[12px] font-medium text-slate-900">Workflow log</p>
              <div className="mt-3 space-y-2">
                {(technical?.auditTrail ?? []).map((entry, index) => (
                  <div key={`${entry.time}-${index}`} className="text-[12px] text-slate-600">
                    {formatRelativeTime(entry.time)} - {entry.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Technical details will appear after a claim is created.</p>
        )}
      </EvidenceDrawer>
    </div>
  );
}
