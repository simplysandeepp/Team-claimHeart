"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, Copy, Database, Mail, Send, ShieldAlert, UserCheck } from "lucide-react";
import {
  ActionPanel,
  ConfidenceBar,
  DashboardCard,
  DecisionSupportCard,
  EvidenceDrawer,
  LoadingChip,
  MetricCard,
  StatusChip,
} from "@/components/dashboard/SharedDashboard";
import { SkeletonBlock, SkeletonCard } from "@/components/ui/Skeleton";
import ClaimHeartLogo from "@/components/ui/ClaimHeartLogo";
import usePageReady from "@/hooks/usePageReady";
import { getCurrentUser } from "@/lib/api/auth";
import { buildDecisionLetter, recordDecision } from "@/lib/api/claims";
import { formatCurrency, formatRelativeTime } from "@/lib/claimUi";
import { dashboardCoverageByCase } from "@/lib/dashboardContent";
import { getDemoCaseById, resolveViewerForRole, type DemoCaseId } from "@/lib/demoWorkflow";
import { useAppStore } from "@/store/useAppStore";
import type { AppUser, Claim, TimelineEntry, WorkflowAuditEntry } from "@/types";

/* ------------------------------------------------------------------ */
/*  Types & Helpers                                                    */
/* ------------------------------------------------------------------ */

type ScanStageKey = "ingest" | "rag" | "grounding" | "evidence";
type ScanStageState = "idle" | "running" | "done";
type AgentLane = "policy" | "medical" | "cross";
type ServiceFilter = "all" | "cashless" | "reimbursement";
type QuadrantKey = "new" | "pending" | "completed" | "decision";

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const stageLabels: Record<ScanStageKey, string> = {
  ingest: "Doc ingestion",
  rag: "RAG retrieval",
  grounding: "Policy grounding",
  evidence: "Evidence bundle",
};

const defaultScanState = (): Record<ScanStageKey, ScanStageState> => ({
  ingest: "idle",
  rag: "idle",
  grounding: "idle",
  evidence: "idle",
});

const agentNames: Record<AgentLane, string> = {
  policy: "Policy Agent",
  medical: "Medical Agent",
  cross: "Cross Validation",
};

const appendTimeline = (timeline: TimelineEntry[], label: string, actor: TimelineEntry["actor"]): TimelineEntry[] => [
  ...timeline,
  { label, time: new Date().toISOString(), actor },
];

const getClaimServiceType = (claim: Claim): NonNullable<Claim["serviceType"]> => claim.serviceType ?? "cashless";
const getClaimProcessId = (claim: Claim) => claim.claimProcessId ?? claim.id;

const getClaimRouting = (claim: Claim) =>
  claim.status === "under_review" || claim.aiResults.policy.status === "flag" || claim.aiResults.medical.status === "flag" || claim.aiResults.cross.status === "flag"
    ? "Human Verification Needed"
    : "Agent Workflow";

const getQueryOwnerLabel = (claim: Claim) =>
  getClaimServiceType(claim) === "reimbursement" ? "Patient self-handles queries" : "Hospital handles insurer queries";

const recommendationForClaim = (claim: Claim) => {
  const caseId = claim.workflowCaseId as DemoCaseId | undefined;
  const demoCase = caseId ? getDemoCaseById(caseId) : null;
  const targetStatus = demoCase?.finalStatus ?? claim.status;

  if (targetStatus === "approved") {
    return { label: "Approve", tone: "green" as const, dot: "bg-[#22C55E]" };
  }
  if (targetStatus === "denied") {
    return { label: "Flagged", tone: "red" as const, dot: "bg-[#EF4444]" };
  }
  return { label: "Manual", tone: "amber" as const, dot: "bg-[#F59E0B]" };
};

const quadrantConfig: { key: QuadrantKey; label: string; color: string; bg: string }[] = [
  { key: "new", label: "New Claim", color: "text-blue-700", bg: "bg-[linear-gradient(180deg,#ffffff_0%,#eaf4ff_100%)]" },
  { key: "pending", label: "Pending Claim", color: "text-amber-700", bg: "bg-[linear-gradient(180deg,#ffffff_0%,#fff7eb_100%)]" },
  { key: "completed", label: "Completed Claim", color: "text-green-700", bg: "bg-[linear-gradient(180deg,#ffffff_0%,#ecfbf1_100%)]" },
  { key: "decision", label: "Decision", color: "text-slate-700", bg: "bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]" },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function InsurerCommandCenter({ claimId }: { claimId?: string }) {
  const ready = usePageReady();
  const claims = useAppStore((state) => state.claims);
  const updateClaim = useAppStore((state) => state.updateClaim);
  const [viewer, setViewer] = useState<AppUser | null>(null);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(claimId ?? null);
  const [activeFilter, setActiveFilter] = useState<"all" | "flagged" | "manual" | "approved">("all");
  const [serviceFilter, setServiceFilter] = useState<ServiceFilter>("all");
  const [activeQuadrant, setActiveQuadrant] = useState<QuadrantKey | null>(null);
  const [decisionNote, setDecisionNote] = useState("");
  const [emailPreviewOpen, setEmailPreviewOpen] = useState(false);
  const [scanState, setScanState] = useState<Record<ScanStageKey, ScanStageState>>(defaultScanState());
  const [agentState, setAgentState] = useState<Record<AgentLane, "idle" | "running" | "done">>({
    policy: "idle",
    medical: "idle",
    cross: "idle",
  });
  const [auditEntries, setAuditEntries] = useState<WorkflowAuditEntry[]>([]);
  const [escalationBanner, setEscalationBanner] = useState(false);
  const runningClaimIdRef = useRef<string | null>(null);

  useEffect(() => {
    getCurrentUser().then((currentUser) => setViewer(resolveViewerForRole("insurer", currentUser)));
  }, []);

  const workflowClaims = useMemo(
    () => [...claims]
      .filter((claim) => claim.workflowCaseId)
      .sort((left, right) => new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime()),
    [claims],
  );

  const serviceScopedClaims = useMemo(() => {
    if (serviceFilter === "all") {
      return workflowClaims;
    }

    return workflowClaims.filter((claim) => getClaimServiceType(claim) === serviceFilter);
  }, [serviceFilter, workflowClaims]);

  useEffect(() => {
    if (claimId) {
      setSelectedClaimId(claimId);
    } else if (!selectedClaimId && workflowClaims[0]) {
      setSelectedClaimId(workflowClaims[0].id);
    }
  }, [claimId, selectedClaimId, workflowClaims]);

  // Quadrant counts
  const quadrantCounts: Record<QuadrantKey, number> = useMemo(() => ({
    new: serviceScopedClaims.filter((c) => c.status === "pending" && !c.pipelineCompletedAt).length,
    pending:
      serviceScopedClaims.filter((c) => c.status === "pending" && c.pipelineCompletedAt).length +
      serviceScopedClaims.filter((c) => c.status === "under_review").length,
    completed: serviceScopedClaims.filter((c) => c.status === "approved" || c.status === "denied").length,
    decision: serviceScopedClaims.filter((c) => c.pipelineCompletedAt).length,
  }), [serviceScopedClaims]);

  const filteredClaims = useMemo(() => {
    let filtered = serviceScopedClaims;

    // Quadrant filter
    if (activeQuadrant === "new") {
      filtered = filtered.filter((c) => c.status === "pending" && !c.pipelineCompletedAt);
    } else if (activeQuadrant === "pending") {
      filtered = filtered.filter((c) => (c.status === "pending" && c.pipelineCompletedAt) || c.status === "under_review");
    } else if (activeQuadrant === "completed") {
      filtered = filtered.filter((c) => c.status === "approved" || c.status === "denied");
    }

    // Recommendation filter
    return filtered.filter((claim) => {
      const recommendation = recommendationForClaim(claim);
      if (activeFilter === "all") return true;
      if (activeFilter === "approved") return recommendation.label === "Approve";
      if (activeFilter === "manual") return recommendation.label === "Manual";
      return recommendation.label === "Flagged";
    });
  }, [activeFilter, activeQuadrant, serviceScopedClaims]);

  const activeClaim =
    filteredClaims.find((claim) => claim.id === (selectedClaimId ?? claimId)) ??
    filteredClaims[0] ??
    serviceScopedClaims[0] ??
    null;
  const activeCase = activeClaim?.workflowCaseId ? getDemoCaseById(activeClaim.workflowCaseId as DemoCaseId) : null;
  const policyExcerpt = activeCase ? dashboardCoverageByCase[activeCase.id].policyExcerpt : null;
  const decisionLetter = activeClaim ? buildDecisionLetter(activeClaim) : "";
  const queueStats = {
    awaitingReview: serviceScopedClaims.filter((claim) => claim.status === "pending").length,
    manual: serviceScopedClaims.filter((claim) => claim.status === "under_review").length,
    approved: serviceScopedClaims.filter((claim) => claim.status === "approved").length,
    denied: serviceScopedClaims.filter((claim) => claim.status === "denied").length,
  };
  const routingStats = {
    agentWorkflow: serviceScopedClaims.filter((claim) => getClaimRouting(claim) === "Agent Workflow").length,
    humanVerification: serviceScopedClaims.filter((claim) => getClaimRouting(claim) === "Human Verification Needed").length,
  };
  const serviceBreakdown = {
    cashless: workflowClaims.filter((claim) => getClaimServiceType(claim) === "cashless").length,
    reimbursement: workflowClaims.filter((claim) => getClaimServiceType(claim) === "reimbursement").length,
  };
  const reviewedClaims = queueStats.approved + queueStats.manual + queueStats.denied;
  const autoDecisionRate = reviewedClaims > 0 ? Math.round((queueStats.approved / reviewedClaims) * 100) : 0;
  const slaRiskClaims = serviceScopedClaims.filter((claim) => {
    const claimAgeDays = Math.max(1, Math.ceil((Date.now() - new Date(claim.submittedAt).getTime()) / 86400000));
    return claimAgeDays >= 2 && claim.status !== "approved" && claim.status !== "denied";
  }).length;
  const activeRecommendation = activeClaim ? recommendationForClaim(activeClaim) : null;
  const activeClaimAgeDays = activeClaim ? Math.max(1, Math.ceil((Date.now() - new Date(activeClaim.submittedAt).getTime()) / 86400000)) : 0;
  const latestTimelineEntry = activeClaim?.timeline.at(-1);
  const insurerVerificationFields = [
    viewer?.gstNumber,
    viewer?.panNumber,
    viewer?.address,
    viewer?.irdaiLicenseNumber,
  ];
  const insurerVerificationReady = insurerVerificationFields.filter(Boolean).length;

  const summaryCards = [
    {
      label: "Agent workflow",
      value: routingStats.agentWorkflow,
      tone: "blue" as const,
      badge: "Automated",
      helper: "Claims currently moving through the automated agent pipeline.",
      className: "bg-[linear-gradient(180deg,#ffffff_0%,#eaf4ff_100%)]",
    },
    {
      label: "Human verification",
      value: routingStats.humanVerification,
      tone: "amber" as const,
      badge: "Escalated",
      helper: "Cases routed to a doctor or verification member.",
      className: "bg-[linear-gradient(180deg,#ffffff_0%,#fff4e8_100%)]",
    },
    {
      label: "Awaiting review",
      value: queueStats.awaitingReview,
      tone: "blue" as const,
      badge: "Queue",
      helper: "Fresh claims still waiting for an insurer decision.",
      className: "bg-[linear-gradient(180deg,#ffffff_0%,#eaf4ff_100%)]",
    },
    {
      label: "Approved today",
      value: queueStats.approved,
      tone: "green" as const,
      badge: "Released",
      helper: "Claims already cleared for settlement today.",
      className: "bg-[linear-gradient(180deg,#ffffff_0%,#ecfbf1_100%)]",
    },
    {
      label: "Denied today",
      value: queueStats.denied,
      tone: "red" as const,
      badge: "Closed",
      helper: "Claims that received a final denial outcome today.",
      className: "bg-[linear-gradient(180deg,#ffffff_0%,#fff0ef_100%)]",
    },
    {
      label: "SLA risk",
      value: slaRiskClaims,
      tone: slaRiskClaims > 0 ? "amber" as const : "green" as const,
      badge: slaRiskClaims > 0 ? "Watch" : "Healthy",
      helper: slaRiskClaims > 0 ? "Open claims that may slip beyond the target turnaround." : "No open claims are currently breaching risk thresholds.",
      className: slaRiskClaims > 0 ? "bg-[linear-gradient(180deg,#ffffff_0%,#fff3e8_100%)]" : "bg-[linear-gradient(180deg,#ffffff_0%,#edf9f2_100%)]",
    },
  ];

  const decisionDesk =
    activeClaim && activeCase && activeRecommendation
      ? {
          tone: activeRecommendation.tone,
          title:
            activeCase.finalStatus === "approved"
              ? "Recommended approval"
              : activeCase.finalStatus === "denied"
                ? "Recommended denial"
                : "Recommended manual review",
          summary: activeCase.decisionNote,
          points: [
            {
              label: "Requested amount",
              value: formatCurrency(activeClaim.amount),
              helper: activeCase.finalStatus === "approved" ? `Proposed payable amount ${formatCurrency(activeCase.amountApproved)}.` : "Current requested amount under review.",
            },
            {
              label: "Risk score",
              value: `${activeClaim.riskScore}`,
              helper: activeCase.expectedOutcome,
            },
            {
              label: "Reviewer next move",
              value:
                activeCase.finalStatus === "approved"
                  ? "Approve and release"
                  : activeCase.finalStatus === "denied"
                    ? "Issue denial letter"
                    : "Escalate with note",
              helper: latestTimelineEntry ? `${latestTimelineEntry.label} ${formatRelativeTime(latestTimelineEntry.time)}.` : activeCase.requestedAtLabel,
            },
          ],
        }
      : null;

  useEffect(() => {
    if (!activeClaim) {
      return;
    }

    setDecisionNote(activeClaim.decisionNote ?? "");
    setAuditEntries(activeClaim.auditTrail ?? []);
    setEscalationBanner(false);

    if (activeClaim.pipelineCompletedAt || activeClaim.workflowState === "completed") {
      setScanState({ ingest: "done", rag: "done", grounding: "done", evidence: "done" });
      setAgentState({ policy: "done", medical: "done", cross: "done" });
      // Show escalation banner if the completed pipeline had flags
      const hasFlags = activeClaim.aiResults.policy.status === "flag" || activeClaim.aiResults.medical.status === "flag" || activeClaim.aiResults.cross.status === "flag";
      if (hasFlags && activeClaim.status !== "approved" && activeClaim.status !== "denied") {
        setEscalationBanner(true);
      }
      runningClaimIdRef.current = null;
      return;
    }

    setScanState(defaultScanState());
    setAgentState({ policy: "idle", medical: "idle", cross: "idle" });
    runningClaimIdRef.current = null;
  }, [activeClaim]);

  const runPipeline = async () => {
    if (!activeClaim || !activeCase || runningClaimIdRef.current === activeClaim.id || activeClaim.pipelineCompletedAt) {
      return;
    }

    runningClaimIdRef.current = activeClaim.id;
    updateClaim(activeClaim.id, {
      workflowState: "adjudicating",
      timeline: appendTimeline(activeClaim.timeline, "Insurer review started", "insurer"),
    });

    const appendAudit = (entry: WorkflowAuditEntry) => {
      setAuditEntries((current) => [...current, entry]);
      const latest = useAppStore.getState().claims.find((item) => item.id === activeClaim.id);
      updateClaim(activeClaim.id, { auditTrail: [...(latest?.auditTrail ?? []), entry] });
    };

    const stageOrder: ScanStageKey[] = ["ingest", "rag", "grounding", "evidence"];
    for (const stage of stageOrder) {
      setScanState((current) => ({ ...current, [stage]: "running" }));
      appendAudit({ time: new Date().toISOString(), label: `${stageLabels[stage]} running.`, level: "info" });
      await sleep(900);
      setScanState((current) => ({ ...current, [stage]: "done" }));
      appendAudit({ time: new Date().toISOString(), label: `${stageLabels[stage]} complete.`, level: "success" });
    }

    for (const lane of ["policy", "medical", "cross"] as AgentLane[]) {
      setAgentState((current) => ({ ...current, [lane]: "running" }));
      await sleep(950);
      const latest = useAppStore.getState().claims.find((item) => item.id === activeClaim.id) ?? activeClaim;
      updateClaim(activeClaim.id, {
        aiResults: {
          ...latest.aiResults,
          [lane]: activeCase.agentResults[lane],
        },
      });
      setAgentState((current) => ({ ...current, [lane]: "done" }));
      appendAudit({
        time: new Date().toISOString(),
        label: `${agentNames[lane]} ${activeCase.agentResults[lane].status === "pass" ? "passed" : "flagged"} with ${activeCase.agentResults[lane].confidence ?? 0}% confidence.`,
        level: activeCase.agentResults[lane].status === "pass" ? "success" : "warning",
      });
    }

    const latest = useAppStore.getState().claims.find((item) => item.id === activeClaim.id) ?? activeClaim;
    updateClaim(activeClaim.id, {
      status: activeCase.finalStatus,
      amountApproved: activeCase.amountApproved,
      decisionNote: activeCase.decisionNote,
      decisionLetter: activeCase.decisionLetter,
      aiResults: activeCase.agentResults,
      pipelineCompletedAt: new Date().toISOString(),
      workflowState: "completed",
      timeline: appendTimeline(latest.timeline, activeCase.finalStatus === "approved" ? "Approved by insurer" : activeCase.finalStatus === "denied" ? "Denied by insurer" : "Moved to manual review by insurer", "insurer"),
    });

    // Show escalation banner if flags were found
    const hasFlags = activeCase.agentResults.policy.status === "flag" || activeCase.agentResults.medical.status === "flag" || activeCase.agentResults.cross.status === "flag";
    if (hasFlags && activeCase.finalStatus !== "approved") {
      setEscalationBanner(true);
    }

    runningClaimIdRef.current = null;
  };

  const handleDecision = async (status: "approved" | "denied" | "under_review") => {
    if (!activeClaim) {
      return;
    }
    await recordDecision(activeClaim.id, status, decisionNote || undefined);
    setEscalationBanner(false);
    toast.success(status === "approved" ? "Claim approved." : status === "denied" ? "Claim denied." : "Escalated for manual review.");
  };

  const handleEscalate = (target: "doctor" | "verification") => {
    const label = target === "doctor" ? "Doctor" : "Verification Team Member";
    toast.success(`Case transferred to ${label} for manual assessment.`);
    setEscalationBanner(false);
    if (activeClaim) {
      handleDecision("under_review");
    }
  };

  const handleCopyClaimId = (id: string) => {
    navigator.clipboard.writeText(id).then(() => toast.success("Claim ID copied."));
  };

  if (!ready || !viewer) {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <SkeletonBlock className="h-10 w-72" />
          <SkeletonBlock className="h-5 w-56" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => <SkeletonCard key={index} lines={2} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Hero banner ── */}
      <DashboardCard visual="plain" surfaceClassName="bg-[linear-gradient(134deg,#112843_0%,#164876_48%,#1f6e9d_100%)]" className="overflow-hidden border-slate-800/10 text-white shadow-[0_24px_60px_rgba(16,35,60,0.2)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/65">Insurer adjudication command center</p>
            <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.04em] text-white">Review cashless and reimbursement claims through one insurer workflow.</h2>
            <p className="mt-3 text-sm leading-6 text-white/78">This dashboard pulls live claim context from patient and hospital workspaces, assigns a unique claim process ID, and routes each case through agent workflow or human verification.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <div className="rounded-full border border-white/12 bg-white/10 px-3 py-1.5 text-[11px] font-medium text-white/86">
                {workflowClaims.length} total claim processes
              </div>
              <div className="rounded-full border border-white/12 bg-white/10 px-3 py-1.5 text-[11px] font-medium text-white/86">
                {serviceBreakdown.cashless} cashless
              </div>
              <div className="rounded-full border border-white/12 bg-white/10 px-3 py-1.5 text-[11px] font-medium text-white/86">
                {serviceBreakdown.reimbursement} reimbursement
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-3">
            <div className="rounded-[16px] border border-white/12 bg-white/10 px-4 py-3 text-right">
              <p className="text-[11px] uppercase tracking-[0.12em] text-white/70">Verification readiness</p>
              <p className="mt-1 text-[24px] font-semibold tracking-[-0.03em] text-white">{insurerVerificationReady}/4</p>
              <p className="text-[11px] text-white/75">
                {insurerVerificationReady === 4 ? "GST, PAN, address, and IRDAI ready" : "Complete insurer verification fields from Profile"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/10 px-2.5 py-1 text-[10px] font-medium text-white/80">
                <Database className="h-3 w-3" /> Patient Dashboard ✓
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/10 px-2.5 py-1 text-[10px] font-medium text-white/80">
                <Database className="h-3 w-3" /> Hospital Dashboard ✓
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/10 px-2.5 py-1 text-[10px] font-medium text-white/80">
                <ShieldAlert className="h-3 w-3" /> {routingStats.humanVerification} human checks
              </span>
            </div>
          </div>
        </div>
      </DashboardCard>

      {/* ── Service type toggle ── */}
      <DashboardCard>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[14px] font-medium text-slate-900">Service type</p>
            <p className="mt-1 text-[12px] text-slate-500">Switch between cashless and reimbursement lanes while keeping the same new, pending, completed, and decision views.</p>
          </div>
          <div className="flex gap-2">
            {(["all", "cashless", "reimbursement"] as ServiceFilter[]).map((svc) => (
              <button
                key={svc}
                type="button"
                onClick={() => { setServiceFilter(svc); setActiveQuadrant(null); }}
                className={`rounded-full px-4 py-2 text-[12px] font-semibold capitalize transition ${serviceFilter === svc ? "bg-[#2C6BE4] text-white shadow-[0_10px_24px_rgba(44,107,228,0.18)]" : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}
              >
                {svc === "all" ? "All Claims" : svc}
              </button>
            ))}
          </div>
        </div>
      </DashboardCard>

      {/* ── 4-Quadrant Grid ── */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {quadrantConfig.map((quad) => {
          const count = quadrantCounts[quad.key];
          const isActive = activeQuadrant === quad.key;
          return (
            <button
              key={quad.key}
              type="button"
              onClick={() => setActiveQuadrant(isActive ? null : quad.key)}
              className={`rounded-[22px] border p-4 text-left shadow-[0_14px_36px_rgba(15,23,42,0.06)] transition-all ${isActive ? "border-[#2C6BE4] ring-2 ring-[#2C6BE4]/20" : "border-slate-200/90 hover:border-slate-300"} ${quad.bg}`}
            >
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{quad.label}</p>
              <p className={`mt-3 text-[28px] font-semibold tracking-[-0.04em] ${quad.color}`}>{count}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[12px] text-slate-500">{isActive ? "Showing filtered view" : "Click to filter"}</span>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Metric cards ── */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {summaryCards.map((item) => (
          <MetricCard
            key={item.label}
            label={item.label}
            value={item.value}
            helper={item.helper}
            tone={item.tone}
            badge={item.badge}
            className={item.className}
          />
        ))}
      </div>

      {/* ── Query Escalation Banner ── */}
      {escalationBanner && activeClaim ? (
        <DashboardCard className="border-l-4 border-l-amber-500 bg-[linear-gradient(180deg,#ffffff_0%,#fffbeb_100%)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-amber-900">⚠️ Query raised during model check</p>
                <p className="mt-1 text-sm text-amber-700">The AI review flagged issues in this case. It can be transferred to a Doctor or Verification team member for manual assessment instead of auto-rejection.</p>
                <p className="mt-2 text-[12px] text-amber-600">Claim: {activeClaim.id} — {activeClaim.patientName}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleEscalate("doctor")}
                className="inline-flex items-center gap-1.5 rounded-[12px] bg-amber-600 px-4 py-2.5 text-[12px] font-semibold text-white shadow-[0_12px_24px_rgba(245,158,11,0.2)]"
              >
                <UserCheck className="h-3.5 w-3.5" />
                Transfer to Doctor
              </button>
              <button
                type="button"
                onClick={() => handleEscalate("verification")}
                className="inline-flex items-center gap-1.5 rounded-[12px] border border-amber-300 bg-white px-4 py-2.5 text-[12px] font-semibold text-amber-700"
              >
                <UserCheck className="h-3.5 w-3.5" />
                Transfer to Verification Team
              </button>
              <button
                type="button"
                onClick={() => setEscalationBanner(false)}
                className="rounded-[12px] border border-slate-200 bg-white px-4 py-2.5 text-[12px] font-semibold text-slate-600"
              >
                Keep in queue
              </button>
            </div>
          </div>
        </DashboardCard>
      ) : null}

      {/* ── Decision desk + Queue focus ── */}
      {decisionDesk && activeCase ? (
        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <DecisionSupportCard
            eyebrow="Decision board"
            title={decisionDesk.title}
            summary={decisionDesk.summary}
            tone={decisionDesk.tone}
            points={decisionDesk.points}
            actions={
              <>
                {!activeClaim?.pipelineCompletedAt ? (
                  <button type="button" onClick={runPipeline} className="rounded-[12px] bg-[var(--ch-blue)] px-3 py-2 text-[12px] font-semibold text-white shadow-[0_12px_24px_rgba(90,151,216,0.18)]">
                    {runningClaimIdRef.current === activeClaim?.id ? "Running review..." : "Run AI review"}
                  </button>
                ) : null}
                <button type="button" onClick={() => setEmailPreviewOpen(true)} className="rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700">
                  Preview letter
                </button>
              </>
            }
            footer={
              <div className="mt-4 flex flex-wrap gap-2">
                <div className="rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-[11px] font-medium text-slate-600">
                  {activeClaimAgeDays} day review age
                </div>
                <div className="rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-[11px] font-medium text-slate-600">
                  {activeCase.shortLabel}
                </div>
              </div>
            }
          />

          <DashboardCard className="bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_100%)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Routing view</p>
                <p className="mt-2 text-[20px] font-semibold tracking-[-0.04em] text-slate-900">See whether this claim stays in agent workflow or moves to human verification.</p>
              </div>
              <StatusChip label={activeRecommendation?.label ?? "Pending"} tone={activeRecommendation?.tone ?? "gray"} />
            </div>

            <div className="mt-4 grid gap-3">
              <div className="rounded-[16px] border border-slate-200 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">Claim process ID</p>
                  <button type="button" onClick={() => handleCopyClaimId(getClaimProcessId(activeClaim))} className="rounded-[8px] border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-100">
                    <Copy className="mr-1 inline h-3 w-3" />
                    Copy
                  </button>
                </div>
                <p className="mt-2 text-sm text-slate-700">{getClaimProcessId(activeClaim)}</p>
              </div>

              <div className="rounded-[16px] border border-slate-200 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                <p className="text-sm font-semibold text-slate-900">Current route</p>
                <p className="mt-2 text-sm text-slate-700">{getClaimRouting(activeClaim)}</p>
                <p className="mt-2 text-[12px] leading-6 text-slate-500">{getQueryOwnerLabel(activeClaim)}</p>
              </div>

              {activeCase.queueHighlights.map((highlight) => (
                <div key={highlight} className="rounded-[16px] border border-slate-200 bg-white p-3 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                  <p className="text-sm leading-6 text-slate-700">{highlight}</p>
                </div>
              ))}
            </div>
          </DashboardCard>
        </div>
      ) : null}

      {!activeClaim || !activeCase ? (
        <DashboardCard className="text-center">
          <p className="text-sm text-slate-500">No workflow claims are available yet.</p>
          <Link href="/dashboard/hospital" className="mt-4 inline-flex rounded-[10px] bg-[#2C6BE4] px-3 py-2 text-[12px] font-semibold text-white">
            Open hospital dashboard
          </Link>
        </DashboardCard>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)_320px]">
          {/* ── Queue selector ── */}
          <div className="space-y-4">
            <DashboardCard>
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Queue selector</p>
                <p className="mt-2 text-[15px] font-semibold text-slate-900">Switch between flagged, manual, and approval-ready claims.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: "all", label: "All" },
                  { key: "flagged", label: "Flagged" },
                  { key: "manual", label: "Manual" },
                  { key: "approved", label: "Approved" },
                ].map((filter) => (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => setActiveFilter(filter.key as typeof activeFilter)}
                    className={`rounded-full px-3 py-1.5 text-[12px] font-medium ${activeFilter === filter.key ? "bg-[#2C6BE4] text-white" : "border border-slate-200 bg-white text-slate-600"}`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
              <div className="mt-4 space-y-2">
                {filteredClaims.map((claim) => {
                  const recommendation = recommendationForClaim(claim);
                  const selected = claim.id === activeClaim.id;
                  return (
                    <button
                      key={claim.id}
                      type="button"
                      onClick={() => setSelectedClaimId(claim.id)}
                      className={`w-full rounded-[10px] border p-3 text-left ${selected ? "border-blue-200 bg-blue-50 shadow-[inset_3px_0_0_#2C6BE4]" : "border-slate-200 bg-white hover:bg-slate-50"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2">
                          <span className={`mt-1 h-2.5 w-2.5 rounded-full ${recommendation.dot}`} />
                          <div>
                            <p className="text-sm font-medium text-slate-900">{claim.patientName}</p>
                            <p className="mt-1 text-[12px] text-slate-500 capitalize">
                              {getClaimServiceType(claim)} • {getClaimRouting(claim)}
                            </p>
                          </div>
                        </div>
                        <StatusChip label={recommendation.label} tone={recommendation.tone} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </DashboardCard>
          </div>

          {/* ── Case review (center) ── */}
          <div className="space-y-4">
            <DashboardCard>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Case review</p>
                  <p className="text-[16px] font-semibold text-slate-900">{activeClaim.patientName}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <p className="text-[12px] text-slate-500">{getClaimProcessId(activeClaim)} - {activeClaim.hospital}</p>
                    <button type="button" onClick={() => handleCopyClaimId(getClaimProcessId(activeClaim))} className="rounded-[8px] border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-100" title="Copy claim ID">
                      <Copy className="mr-1 inline h-3 w-3" />ID
                    </button>
                  </div>
                  <p className="mt-3 text-sm text-slate-700">Requested amount: {formatCurrency(activeClaim.amount)}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 capitalize">
                      {getClaimServiceType(activeClaim)}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                      {getQueryOwnerLabel(activeClaim)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusChip label={activeClaim.status.replace("_", " ")} tone={activeClaim.status === "approved" ? "green" : activeClaim.status === "denied" ? "red" : activeClaim.status === "under_review" ? "amber" : "blue"} />
                  {!activeClaim.pipelineCompletedAt ? (
                    <button type="button" onClick={runPipeline} className="rounded-[10px] bg-[#2C6BE4] px-3 py-2 text-[12px] font-semibold text-white">
                      {runningClaimIdRef.current === activeClaim.id ? "Running..." : "Run AI review"}
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {(["ingest", "rag", "grounding", "evidence"] as ScanStageKey[]).map((stage) =>
                  scanState[stage] === "done" ? (
                    <span key={stage} className="inline-flex items-center rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-[11px] font-semibold text-green-700">
                      Done - {stageLabels[stage]}
                    </span>
                  ) : scanState[stage] === "running" ? (
                    <LoadingChip key={stage} label={stageLabels[stage]} />
                  ) : (
                    <StatusChip key={stage} label={stageLabels[stage]} tone="gray" />
                  ),
                )}
              </div>
            </DashboardCard>

            <div className="space-y-3">
              {(["policy", "medical", "cross"] as AgentLane[]).map((lane) => {
                const result = activeClaim.aiResults[lane];
                const running = agentState[lane] === "running";
                const tone = running ? "amber" : result.status === "pass" ? "green" : result.status === "flag" ? "red" : "gray";

                return (
                  <DashboardCard key={lane} className={`border-l-4 ${result.status === "pass" ? "border-l-green-500" : result.status === "flag" ? "border-l-red-500" : "border-l-slate-300"}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[14px] font-medium text-slate-900">{agentNames[lane]}</p>
                      <div className="flex items-center gap-2">
                        <StatusChip label={running ? "Running" : result.status === "pass" ? "PASS" : result.status === "flag" ? "FLAG" : "Pending"} tone={tone} />
                        {typeof result.confidence === "number" ? <span className="text-[11px] text-slate-500">{result.confidence}%</span> : null}
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-700">
                      {running ? "Review is still running for this agent. The final grounded reasoning will appear here once the evidence bundle completes." : result.reason}
                    </p>
                  </DashboardCard>
                );
              })}
            </div>

            <EvidenceDrawer buttonLabel="View cited policy clauses" title={policyExcerpt ? `${policyExcerpt.clause} - ${policyExcerpt.title}` : "Policy evidence"}>
              {policyExcerpt ? (
                <div className="rounded-[10px] border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[12px] font-medium text-slate-900">{policyExcerpt.clause} - {policyExcerpt.title}</p>
                  <blockquote className="mt-3 text-sm leading-7 text-slate-700">{policyExcerpt.body}</blockquote>
                </div>
              ) : null}
            </EvidenceDrawer>

            <DashboardCard>
              <label className="text-[12px] text-slate-600">
                Decision note (optional)
                <textarea value={decisionNote} onChange={(event) => setDecisionNote(event.target.value)} className="mt-1 min-h-24 w-full rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#2C6BE4]" />
              </label>
            </DashboardCard>

            <ActionPanel>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => handleDecision("approved")} className="rounded-[10px] bg-green-600 px-4 py-2 text-[12px] font-semibold text-white">
                  Approve
                </button>
                <button type="button" onClick={() => handleDecision("denied")} className="rounded-[10px] bg-red-500 px-4 py-2 text-[12px] font-semibold text-white">
                  Deny
                </button>
                <button type="button" onClick={() => handleDecision("under_review")} className="rounded-[10px] border border-[#2C6BE4] bg-white px-4 py-2 text-[12px] font-semibold text-[#2C6BE4]">
                  Escalate to senior
                </button>
                <button
                  type="button"
                  onClick={() => handleEscalate("doctor")}
                  className="inline-flex items-center gap-1 rounded-[10px] border border-amber-300 bg-amber-50 px-4 py-2 text-[12px] font-semibold text-amber-700"
                >
                  <UserCheck className="h-3.5 w-3.5" />
                  Escalate to Doctor
                </button>
              </div>
            </ActionPanel>

            <EvidenceDrawer buttonLabel="Full audit trail" title="Complete workflow history" defaultOpen={false}>
              <div className="space-y-2">
                {auditEntries.length === 0 ? (
                  <p className="text-sm text-slate-500">The audit trail will appear once review starts.</p>
                ) : (
                  auditEntries.map((entry, index) => (
                    <div key={`${entry.time}-${index}`} className="rounded-[10px] border border-slate-200 bg-slate-50 p-3">
                      <p className="text-sm text-slate-700">{entry.label}</p>
                      <p className="mt-1 text-[11px] text-slate-500">{formatRelativeTime(entry.time)}</p>
                    </div>
                  ))
                )}
              </div>
            </EvidenceDrawer>
          </div>

          {/* ── Right sidebar ── */}
          <div className="space-y-4">
            <DashboardCard>
              <p className="text-[14px] font-medium text-slate-900">Agent consensus</p>
              <div className="mt-4 space-y-3">
                {(["policy", "medical", "cross"] as AgentLane[]).map((lane) => {
                  const result = activeClaim.aiResults[lane];
                  return (
                    <div key={`consensus-${lane}`} className="rounded-[10px] border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[12px] font-medium text-slate-900">{agentNames[lane]}</p>
                        <StatusChip label={result.status === "pass" ? "PASS" : result.status === "flag" ? "FLAG" : "Pending"} tone={result.status === "pass" ? "green" : result.status === "flag" ? "red" : "gray"} />
                      </div>
                      <div className="mt-3">
                        <ConfidenceBar label="Confidence" value={result.confidence ?? 0} tone={result.status === "pass" ? "green" : result.status === "flag" ? "red" : "gray"} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </DashboardCard>

            <DashboardCard>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#0A1628] text-white">
                  <ClaimHeartLogo className="h-5 w-5" imageClassName="scale-105" />
                </div>
                <div>
                  <p className="text-[14px] font-medium text-slate-900">Decision Letter</p>
                  <p className="text-[11px] text-slate-500">{activeClaim.patientName} - {activeClaim.id}</p>
                </div>
              </div>
              <div className="mt-4 rounded-[10px] border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">{activeClaim.status === "approved" ? "Approved" : activeClaim.status === "denied" ? "Denied" : "Manual review"}</p>
                <p className="mt-2 text-sm leading-7 text-slate-700 whitespace-pre-wrap">{decisionLetter}</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => toast.success("Decision draft sent to the patient inbox preview.")} className="inline-flex items-center gap-2 rounded-[10px] bg-[#2C6BE4] px-3 py-2 text-[12px] font-semibold text-white">
                  <Send className="h-3.5 w-3.5" />
                  Send to patient
                </button>
                <button type="button" onClick={() => toast.success("Decision draft sent to the hospital inbox preview.")} className="rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700">
                  Send to hospital
                </button>
                <button type="button" onClick={() => setEmailPreviewOpen(true)} className="inline-flex items-center gap-2 rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700">
                  <Mail className="h-3.5 w-3.5" />
                  Preview as email
                </button>
              </div>
            </DashboardCard>

            <DashboardCard>
              <p className="text-[14px] font-medium text-slate-900">Agent workflow map</p>
              <div className="mt-4 space-y-2 text-[12px] text-slate-600">
                {[
                  "A1 Policy OCR extracts policy evidence",
                  "RAG 2 and patient structured info align coverage context",
                  "OCR + RAG 1 process patient and hospital documents",
                  "A2 policy agent grounds structured claim data",
                  "Fraud agent checks anomalies before decision routing",
                  "Mediator agent handles email and OTP when fraud is detected",
                ].map((step) => (
                  <div key={step} className="rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2.5">
                    {step}
                  </div>
                ))}
              </div>
            </DashboardCard>

            <DashboardCard>
              <p className="text-[14px] font-medium text-slate-900">Routing breakdown</p>
              <div className="mt-4 space-y-2 text-[12px] text-slate-600">
                <div className="flex items-center justify-between"><span>Agent workflow</span><span>{routingStats.agentWorkflow}</span></div>
                <div className="flex items-center justify-between"><span>Human verification needed</span><span>{routingStats.humanVerification}</span></div>
                <div className="flex items-center justify-between"><span>Cashless claims</span><span>{serviceBreakdown.cashless}</span></div>
                <div className="flex items-center justify-between"><span>Reimbursement claims</span><span>{serviceBreakdown.reimbursement}</span></div>
              </div>
            </DashboardCard>
          </div>
        </div>
      )}

      {emailPreviewOpen ? (
        <>
          <button type="button" className="fixed inset-0 z-40 bg-slate-950/35" onClick={() => setEmailPreviewOpen(false)} aria-label="Close preview" />
          <div className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,720px)] -translate-x-1/2 -translate-y-1/2 rounded-[10px] border border-slate-200 bg-white p-4 shadow-[0_20px_50px_rgba(15,23,42,0.2)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[14px] font-medium text-slate-900">Email preview</p>
                <p className="mt-1 text-[12px] text-slate-500">This is the patient-facing message body.</p>
              </div>
              <button type="button" onClick={() => setEmailPreviewOpen(false)} className="rounded-[10px] border border-slate-200 px-3 py-1 text-[12px] text-slate-600">
                Close
              </button>
            </div>
            <div className="mt-4 rounded-[10px] border border-slate-200 bg-slate-50 p-4">
              <p className="text-[12px] text-slate-500">To: {activeClaim?.patientEmail ?? "patient@claimheart.ai"}</p>
              <p className="mt-2 text-sm leading-7 text-slate-700 whitespace-pre-wrap">{decisionLetter}</p>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
