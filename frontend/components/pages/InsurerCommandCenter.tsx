"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, Copy, Mail, Send, ShieldAlert } from "lucide-react";
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
import { buildDecisionLetter, recordDecision, requestMoreDocuments, runClaimPipeline, runOcrOnClaimDocuments } from "@/lib/api/claims";
import { formatCurrency, formatRelativeTime } from "@/lib/claimUi";
import { dashboardCoverageByCase } from "@/lib/dashboardContent";
import {
  getDemoCaseById,
  resolveViewerForRole,
  type DemoCaseId,
  type DemoSuspiciousSignal,
  type DemoWorkflowCase,
} from "@/lib/demoWorkflow";
import { getSyncMode } from "@/lib/localWorkflow";
import { useAppStore } from "@/store/useAppStore";
import type { AgentResult, AppUser, Claim, OcrExtractedData, TimelineEntry, WorkflowAuditEntry } from "@/types";

type ScanStageKey = "ingest" | "rag" | "grounding" | "evidence";
type ScanStageState = "idle" | "running" | "done";
type VerificationAgentKey = "intake" | "policy" | "medical" | "fraud";
type VerificationAgentState = "idle" | "running" | "done";
type ServiceFilter = "all" | "cashless" | "reimbursement";
type QuadrantKey = "new" | "pending" | "completed" | "decision";

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const stageLabels: Record<ScanStageKey, string> = {
  ingest: "Document intake",
  rag: "Claim context retrieval",
  grounding: "Policy grounding",
  evidence: "Evidence bundle",
};

const defaultScanState = (): Record<ScanStageKey, ScanStageState> => ({
  ingest: "idle",
  rag: "idle",
  grounding: "idle",
  evidence: "idle",
});

const verificationAgentNames: Record<VerificationAgentKey, string> = {
  intake: "Intake Agent",
  policy: "Policy Agent",
  medical: "Medical Agent",
  fraud: "Fraud Agent",
};

const defaultAgentState = (): Record<VerificationAgentKey, VerificationAgentState> => ({
  intake: "idle",
  policy: "idle",
  medical: "idle",
  fraud: "idle",
});

const quadrantConfig: { key: QuadrantKey; label: string; color: string; bg: string }[] = [
  { key: "new", label: "New Claim", color: "text-blue-700", bg: "bg-[linear-gradient(180deg,#ffffff_0%,#eaf4ff_100%)]" },
  { key: "pending", label: "Pending Claim", color: "text-amber-700", bg: "bg-[linear-gradient(180deg,#ffffff_0%,#fff7eb_100%)]" },
  { key: "completed", label: "Completed Claim", color: "text-green-700", bg: "bg-[linear-gradient(180deg,#ffffff_0%,#ecfbf1_100%)]" },
  { key: "decision", label: "Decision Ready", color: "text-slate-700", bg: "bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]" },
];

const severityClassNames: Record<DemoSuspiciousSignal["severity"], string> = {
  low: "border-sky-200 bg-sky-50 text-sky-700",
  medium: "border-amber-200 bg-amber-50 text-amber-700",
  high: "border-red-200 bg-red-50 text-red-700",
};

const appendTimeline = (timeline: TimelineEntry[], label: string, actor: TimelineEntry["actor"]): TimelineEntry[] => [
  ...timeline,
  { label, time: new Date().toISOString(), actor },
];

const getClaimServiceType = (claim: Claim): NonNullable<Claim["serviceType"]> => claim.serviceType ?? "cashless";
const getClaimProcessId = (claim: Claim) => claim.claimProcessId ?? claim.id;

const getDemoCaseForClaim = (claim: Claim): DemoWorkflowCase | null =>
  claim.workflowCaseId ? getDemoCaseById(claim.workflowCaseId as DemoCaseId) : null;

const getClaimRouting = (claim: Claim, demoCase: DemoWorkflowCase | null) => {
  if (claim.status === "under_review" || demoCase?.reviewMode === "manual") {
    return "Manual verification";
  }

  if (claim.pipelineCompletedAt || claim.status === "approved" || claim.status === "denied") {
    return "Automatic decision";
  }

  return "Queued for verification";
};

const getSourceSummary = (claim: Claim) => {
  const uploaders = new Set(claim.documents.map((document) => document.uploadedBy.toLowerCase()));
  if (uploaders.has("hospital") && uploaders.has("patient")) {
    return "Linked uploads from hospital and patient";
  }
  if (uploaders.has("patient")) {
    return "Patient-submitted claim file";
  }
  if (uploaders.has("hospital")) {
    return "Hospital-submitted claim file";
  }
  return "Awaiting uploaded documents";
};

const getSourceBadge = (uploadedBy: string) => {
  const actor = uploadedBy.toLowerCase();
  if (actor === "patient") {
    return { label: "Patient Upload", className: "border-sky-200 bg-sky-50 text-sky-700" };
  }
  if (actor === "hospital") {
    return { label: "Hospital Upload", className: "border-emerald-200 bg-emerald-50 text-emerald-700" };
  }
  return { label: "System Sync", className: "border-slate-200 bg-slate-100 text-slate-600" };
};

const sortDocumentsByNewest = (documents: Claim["documents"]) =>
  [...documents].sort((left, right) => new Date(right.uploadedAt).getTime() - new Date(left.uploadedAt).getTime());

const getSuspiciousSignals = (claim: Claim, demoCase: DemoWorkflowCase | null): DemoSuspiciousSignal[] => {
  if (demoCase?.suspiciousSignals?.length) {
    return demoCase.suspiciousSignals;
  }

  if (claim.aiResults.cross.status === "flag") {
    return [
      {
        title: "Cross-check mismatch",
        detail: claim.aiResults.cross.reason,
        severity: claim.riskScore >= 80 ? "high" : "medium",
      },
    ];
  }

  return [];
};

const getIntakeAgentResult = (claim: Claim): AgentResult => {
  const uploaders = new Set(claim.documents.map((document) => document.uploadedBy.toLowerCase()));
  if (claim.documents.length === 0) {
    return {
      status: "flag",
      reason: "No uploaded documents were found for this claim.",
      confidence: 0,
    };
  }

  const sourceLabel =
    uploaders.has("hospital") && uploaders.has("patient")
      ? "patient and hospital uploads"
      : uploaders.has("patient")
        ? "patient uploads"
        : "hospital uploads";

  return {
    status: "pass",
    reason: `${claim.documents.length} uploaded file(s) were fetched from ${sourceLabel} and mapped into the insurer review packet.`,
    confidence: 99,
    highlights: claim.documents.map((document) => document.category ?? document.name).slice(0, 3),
  };
};

const getFraudAgentResult = (claim: Claim, demoCase: DemoWorkflowCase | null): AgentResult => {
  const suspiciousSignals = getSuspiciousSignals(claim, demoCase);

  if (!claim.pipelineCompletedAt && claim.aiResults.cross.status === "pending") {
    return {
      status: "pending",
      reason: "Suspicion scan will run after the intake, policy, and medical checks complete.",
    };
  }

  if (suspiciousSignals.length > 0) {
    return {
      status: "flag",
      reason: suspiciousSignals[0].detail,
      confidence: claim.aiResults.cross.confidence ?? Math.min(98, Math.max(74, claim.riskScore)),
      highlights: suspiciousSignals.map((signal) => signal.title),
    };
  }

  if (claim.aiResults.cross.status === "pending") {
    return {
      status: "pending",
      reason: "Fraud review is waiting for the supporting verification outputs.",
    };
  }

  return {
    status: "pass",
    reason: claim.aiResults.cross.reason === "Awaiting workflow execution on the insurer side."
      ? "No suspicious signal has been raised so far."
      : claim.aiResults.cross.reason,
    confidence: claim.aiResults.cross.confidence ?? Math.max(65, 100 - claim.riskScore),
    highlights: suspiciousSignals.length ? suspiciousSignals.map((signal) => signal.title) : ["No suspicious pattern raised"],
  };
};

const getVerificationAgents = (claim: Claim, demoCase: DemoWorkflowCase | null): Record<VerificationAgentKey, AgentResult> => ({
  intake: getIntakeAgentResult(claim),
  policy: claim.aiResults.policy,
  medical: claim.aiResults.medical,
  fraud: getFraudAgentResult(claim, demoCase),
});

const recommendationForClaim = (claim: Claim) => {
  const demoCase = getDemoCaseForClaim(claim);
  const targetStatus = demoCase?.finalStatus ?? claim.status;

  if (targetStatus === "approved") {
    return { label: "Approve", tone: "green" as const, dot: "bg-[#22C55E]" };
  }
  if (targetStatus === "denied") {
    return { label: "Flagged", tone: "red" as const, dot: "bg-[#EF4444]" };
  }
  return { label: "Manual", tone: "amber" as const, dot: "bg-[#F59E0B]" };
};

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
  const [agentState, setAgentState] = useState<Record<VerificationAgentKey, VerificationAgentState>>(defaultAgentState());
  const [auditEntries, setAuditEntries] = useState<WorkflowAuditEntry[]>([]);
  const [escalationBanner, setEscalationBanner] = useState(false);
  const [ocrResults, setOcrResults] = useState<Map<string, OcrExtractedData | null>>(new Map());
  const [ocrRunningForDocs, setOcrRunningForDocs] = useState<Set<string>>(new Set());
  const [ocrHasRun, setOcrHasRun] = useState(false);
  const runningClaimIdRef = useRef<string | null>(null);

  useEffect(() => {
    getCurrentUser().then((currentUser) => setViewer(resolveViewerForRole("insurer", currentUser)));
  }, []);

  const workflowClaims = useMemo(
    () =>
      [...claims]
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
      return;
    }

    if (!selectedClaimId && workflowClaims[0]) {
      setSelectedClaimId(workflowClaims[0].id);
    }
  }, [claimId, selectedClaimId, workflowClaims]);

  const quadrantCounts: Record<QuadrantKey, number> = useMemo(
    () => ({
      new: serviceScopedClaims.filter((claim) => claim.status === "pending" && !claim.pipelineCompletedAt).length,
      pending:
        serviceScopedClaims.filter((claim) => (claim.status === "pending" && claim.pipelineCompletedAt) || claim.status === "under_review").length,
      completed: serviceScopedClaims.filter((claim) => claim.status === "approved" || claim.status === "denied").length,
      decision: serviceScopedClaims.filter((claim) => claim.pipelineCompletedAt).length,
    }),
    [serviceScopedClaims],
  );

  const filteredClaims = useMemo(() => {
    let filtered = serviceScopedClaims;

    if (activeQuadrant === "new") {
      filtered = filtered.filter((claim) => claim.status === "pending" && !claim.pipelineCompletedAt);
    } else if (activeQuadrant === "pending") {
      filtered = filtered.filter((claim) => (claim.status === "pending" && claim.pipelineCompletedAt) || claim.status === "under_review");
    } else if (activeQuadrant === "completed") {
      filtered = filtered.filter((claim) => claim.status === "approved" || claim.status === "denied");
    }

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
  const activeCase = activeClaim ? getDemoCaseForClaim(activeClaim) : null;
  const activeAgents = activeClaim ? getVerificationAgents(activeClaim, activeCase) : null;
  const activeSuspiciousSignals = activeClaim ? getSuspiciousSignals(activeClaim, activeCase) : [];
  const policyExcerpt = activeCase ? dashboardCoverageByCase[activeCase.id].policyExcerpt : null;
  const decisionLetter = activeClaim ? buildDecisionLetter(activeClaim) : "";
  const latestTimelineEntry = activeClaim?.timeline.at(-1);
  const activeRecommendation = activeClaim ? recommendationForClaim(activeClaim) : null;
  const activeClaimAgeDays = activeClaim ? Math.max(1, Math.ceil((Date.now() - new Date(activeClaim.submittedAt).getTime()) / 86400000)) : 0;
  const activeDocuments = activeClaim ? sortDocumentsByNewest(activeClaim.documents) : [];
  const latestSharedDocument = activeDocuments[0] ?? null;

  const queueStats = {
    awaitingReview: serviceScopedClaims.filter((claim) => claim.status === "pending").length,
    manual: serviceScopedClaims.filter((claim) => claim.status === "under_review").length,
    approved: serviceScopedClaims.filter((claim) => claim.status === "approved").length,
    denied: serviceScopedClaims.filter((claim) => claim.status === "denied").length,
  };

  const routingStats = {
    automatic: serviceScopedClaims.filter((claim) => getClaimRouting(claim, getDemoCaseForClaim(claim)) === "Automatic decision").length,
    manual: serviceScopedClaims.filter((claim) => getClaimRouting(claim, getDemoCaseForClaim(claim)) === "Manual verification").length,
    queued: serviceScopedClaims.filter((claim) => getClaimRouting(claim, getDemoCaseForClaim(claim)) === "Queued for verification").length,
  };

  const suspiciousCount = serviceScopedClaims.reduce((count, claim) => count + getSuspiciousSignals(claim, getDemoCaseForClaim(claim)).length, 0);
  const serviceBreakdown = {
    cashless: workflowClaims.filter((claim) => getClaimServiceType(claim) === "cashless").length,
    reimbursement: workflowClaims.filter((claim) => getClaimServiceType(claim) === "reimbursement").length,
  };
  const syncMode = getSyncMode();

  const reviewedClaims = queueStats.approved + queueStats.manual + queueStats.denied;
  const autoDecisionRate = reviewedClaims > 0 ? Math.round(((queueStats.approved + queueStats.denied) / reviewedClaims) * 100) : 0;

  const insurerVerificationFields = [viewer?.gstNumber, viewer?.panNumber, viewer?.address, viewer?.irdaiLicenseNumber];
  const insurerVerificationReady = insurerVerificationFields.filter(Boolean).length;

  const summaryCards = [
    {
      label: "Queued for verification",
      value: routingStats.queued,
      tone: "blue" as const,
      badge: "Inbox",
      helper: "Claim files waiting to run through the four-agent review sequence.",
      className: "bg-[linear-gradient(180deg,#ffffff_0%,#eaf4ff_100%)]",
    },
    {
      label: "Manual review",
      value: routingStats.manual,
      tone: "amber" as const,
      badge: "Human",
      helper: "Claims currently staying with the insurer reviewer because suspicious signals were raised.",
      className: "bg-[linear-gradient(180deg,#ffffff_0%,#fff4e8_100%)]",
    },
    {
      label: "Suspicious signals",
      value: suspiciousCount,
      tone: suspiciousCount > 0 ? "red" as const : "green" as const,
      badge: suspiciousCount > 0 ? "Watch" : "Clear",
      helper: suspiciousCount > 0 ? "Signals detected by the hard-coded verification flow." : "No suspicious issue is active in the current queue.",
      className: suspiciousCount > 0 ? "bg-[linear-gradient(180deg,#ffffff_0%,#fff0ef_100%)]" : "bg-[linear-gradient(180deg,#ffffff_0%,#edf9f2_100%)]",
    },
    {
      label: "Auto decisions",
      value: routingStats.automatic,
      tone: "green" as const,
      badge: `${autoDecisionRate}%`,
      helper: "Claims that can move to approval or denial without extra manual investigation.",
      className: "bg-[linear-gradient(180deg,#ffffff_0%,#ecfbf1_100%)]",
    },
    {
      label: "Approved",
      value: queueStats.approved,
      tone: "green" as const,
      badge: "Released",
      helper: "Claims cleared by the insurer decision desk.",
      className: "bg-[linear-gradient(180deg,#ffffff_0%,#ecfbf1_100%)]",
    },
    {
      label: "Denied",
      value: queueStats.denied,
      tone: "red" as const,
      badge: "Closed",
      helper: "Claims denied after policy or suspicious-signal review.",
      className: "bg-[linear-gradient(180deg,#ffffff_0%,#fff0ef_100%)]",
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
              helper: activeCase.finalStatus === "approved" ? `Proposed payable amount ${formatCurrency(activeCase.amountApproved)}.` : "Current requested amount still under insurer review.",
            },
            {
              label: "Uploaded source",
              value: getSourceSummary(activeClaim),
              helper: `${activeClaim.documents.length} document(s) are already linked to this shared claim file.`,
            },
            {
              label: "Review route",
              value: activeCase.reviewMode === "manual" ? "Manual review path" : "Automatic decision path",
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
    // Reset OCR state when the selected claim changes
    setOcrResults(new Map());
    setOcrRunningForDocs(new Set());
    setOcrHasRun(false);

    if (activeClaim.pipelineCompletedAt || activeClaim.workflowState === "completed") {
      setScanState({ ingest: "done", rag: "done", grounding: "done", evidence: "done" });
      setAgentState({ intake: "done", policy: "done", medical: "done", fraud: "done" });
      if (getSuspiciousSignals(activeClaim, activeCase).length > 0 && activeClaim.status !== "approved" && activeClaim.status !== "denied") {
        setEscalationBanner(true);
      }
      runningClaimIdRef.current = null;
      return;
    }

    setScanState(defaultScanState());
    setAgentState(defaultAgentState());
    runningClaimIdRef.current = null;
  }, [activeCase, activeClaim]);


  const runPipeline = async () => {
    if (!activeClaim || runningClaimIdRef.current === activeClaim.id || activeClaim.pipelineCompletedAt) {
      return;
    }

    runningClaimIdRef.current = activeClaim.id;
    updateClaim(activeClaim.id, {
      workflowState: "adjudicating",
      timeline: appendTimeline(activeClaim.timeline, "Insurer verification started", "insurer"),
    });

    const appendAudit = (entry: WorkflowAuditEntry) => {
      setAuditEntries((current) => [...current, entry]);
    };

    try {
      // ── Stage 1: Document Ingest + live OCR on hospital-uploaded docs ──
      setScanState((current) => ({ ...current, ingest: "running" }));
      appendAudit({ time: new Date().toISOString(), label: `${stageLabels.ingest} running.`, level: "info" });

      const hospitalDocs = activeClaim.documents.filter(
        (doc) => doc.uploadedBy.toLowerCase() === "hospital" && doc.sourceUrl,
      );

      if (hospitalDocs.length > 0) {
        appendAudit({
          time: new Date().toISOString(),
          label: `Running OCR on ${hospitalDocs.length} hospital-uploaded document(s) via backend.`,
          level: "info",
        });

        setOcrRunningForDocs(new Set(hospitalDocs.map((d) => d.name)));

        await runOcrOnClaimDocuments(hospitalDocs, (docName, result) => {
          setOcrResults((current) => {
            const next = new Map(current);
            next.set(docName, result);
            return next;
          });
          setOcrRunningForDocs((current) => {
            const next = new Set(current);
            next.delete(docName);
            return next;
          });
          appendAudit({
            time: new Date().toISOString(),
            label: result
              ? `OCR complete for "${docName}" — extracted structured data.`
              : `OCR on "${docName}" completed (text content — no structured fields extracted).`,
            level: result ? "success" : "info",
          });
        });

        setOcrHasRun(true);
      } else {
        await sleep(700);
      }

      setScanState((current) => ({ ...current, ingest: "done" }));
      appendAudit({ time: new Date().toISOString(), label: `${stageLabels.ingest} complete.`, level: "success" });

      // ── Stages 2-4: RAG, grounding, evidence ──
      for (const stage of ["rag", "grounding", "evidence"] as ScanStageKey[]) {
        setScanState((current) => ({ ...current, [stage]: "running" }));
        appendAudit({ time: new Date().toISOString(), label: `${stageLabels[stage]} running.`, level: "info" });
        await sleep(700);
        setScanState((current) => ({ ...current, [stage]: "done" }));
        appendAudit({ time: new Date().toISOString(), label: `${stageLabels[stage]} complete.`, level: "success" });
      }

      for (const agentKey of ["intake", "policy", "medical", "fraud"] as VerificationAgentKey[]) {
        setAgentState((current) => ({ ...current, [agentKey]: "running" }));
        await sleep(850);
        setAgentState((current) => ({ ...current, [agentKey]: "done" }));
      }

      const result = await runClaimPipeline(activeClaim.id);
      const updatedClaim = result.claim;
      setDecisionNote(updatedClaim.decisionNote ?? "");
      setAuditEntries(updatedClaim.auditTrail ?? []);
      setEscalationBanner(updatedClaim.status === "under_review");
      toast.success(
        updatedClaim.status === "approved"
          ? "Backend workflow approved the claim."
          : updatedClaim.status === "under_review"
            ? "Backend workflow escalated the claim for review."
            : "Backend workflow completed.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to run the insurer workflow right now.");
      setScanState(defaultScanState());
      setAgentState(defaultAgentState());
    } finally {
      runningClaimIdRef.current = null;
    }
  };

  const handleRunOcrOnly = async () => {
    if (!activeClaim || ocrRunningForDocs.size > 0) {
      return;
    }

    const hospitalDocs = activeClaim.documents.filter(
      (doc) => doc.uploadedBy.toLowerCase() === "hospital" && doc.sourceUrl,
    );

    if (hospitalDocs.length === 0) {
      toast.info("No hospital-uploaded documents with a source URL to process.");
      return;
    }

    toast.info(`Running OCR on ${hospitalDocs.length} document(s) via backend…`);
    setOcrRunningForDocs(new Set(hospitalDocs.map((d) => d.name)));

    await runOcrOnClaimDocuments(hospitalDocs, (docName, result) => {
      setOcrResults((current) => {
        const next = new Map(current);
        next.set(docName, result);
        return next;
      });
      setOcrRunningForDocs((current) => {
        const next = new Set(current);
        next.delete(docName);
        return next;
      });
    });

    setOcrHasRun(true);
    toast.success("OCR extraction complete for all hospital documents.");
  };


  const handleDecision = async (status: "approved" | "denied" | "under_review") => {
    if (!activeClaim) {
      return;
    }

    await recordDecision(activeClaim.id, status, decisionNote || undefined);
    setEscalationBanner(false);
    toast.success(
      status === "approved"
        ? "Claim approved."
        : status === "denied"
          ? "Claim denied."
          : "Claim kept in manual review.",
    );
  };

  const handleRequestDocuments = async () => {
    if (!activeClaim) {
      return;
    }

    const requestNote = decisionNote.trim() || "Please upload the supporting file needed to verify this claim.";
    await requestMoreDocuments(activeClaim.id, requestNote);
    setDecisionNote(requestNote);
    setEscalationBanner(false);
    toast.success("Additional file request added to the shared claim record.");
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
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonCard key={index} lines={2} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DashboardCard
        visual="plain"
        surfaceClassName="bg-[linear-gradient(134deg,#112843_0%,#164876_48%,#1f6e9d_100%)]"
        className="overflow-hidden border-slate-800/10 text-white shadow-[0_24px_60px_rgba(16,35,60,0.2)]"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/65">Insurer adjudication command center</p>
            <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.04em] text-white">Review linked patient and hospital uploads through one insurer-first workflow.</h2>
            <p className="mt-3 text-sm leading-6 text-white/78">
              This frontend queue fetches uploaded claim data, runs it through four hard-coded verification agents, surfaces suspicious signals,
              and lets the insurer approve, deny, or request more files without jumping into another dashboard.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <div className="rounded-full border border-white/12 bg-white/10 px-3 py-1.5 text-[11px] font-medium text-white/86">
                {workflowClaims.length} linked claim records
              </div>
              <div className={`rounded-full border px-3 py-1.5 text-[11px] font-medium ${syncMode === "live" ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-50" : "border-amber-300/30 bg-amber-400/10 text-amber-50"}`}>
                {syncMode === "live" ? "Live backend sync" : "Demo fallback sync"}
              </div>
              <div className="rounded-full border border-white/12 bg-white/10 px-3 py-1.5 text-[11px] font-medium text-white/86">
                4 verification agents
              </div>
              <div className="rounded-full border border-white/12 bg-white/10 px-3 py-1.5 text-[11px] font-medium text-white/86">
                {suspiciousCount} suspicious signals
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
                Linked with patient and hospital views
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/10 px-2.5 py-1 text-[10px] font-medium text-white/80">
                {routingStats.manual} manual review routes
              </span>
            </div>
          </div>
        </div>
      </DashboardCard>

      <DashboardCard>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[14px] font-medium text-slate-900">Service type</p>
            <p className="mt-1 text-[12px] text-slate-500">Switch between linked claim lanes while keeping the same insurer review flow.</p>
          </div>
          <div className="flex gap-2">
            {(["all", "cashless", "reimbursement"] as ServiceFilter[]).map((service) => (
              <button
                key={service}
                type="button"
                onClick={() => {
                  setServiceFilter(service);
                  setActiveQuadrant(null);
                }}
                className={`rounded-full px-4 py-2 text-[12px] font-semibold capitalize transition ${
                  serviceFilter === service
                    ? "bg-[#2C6BE4] text-white shadow-[0_10px_24px_rgba(44,107,228,0.18)]"
                    : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                {service === "all" ? "All Claims" : service}
              </button>
            ))}
          </div>
        </div>
      </DashboardCard>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {quadrantConfig.map((quadrant) => {
          const count = quadrantCounts[quadrant.key];
          const isActive = activeQuadrant === quadrant.key;
          return (
            <button
              key={quadrant.key}
              type="button"
              onClick={() => setActiveQuadrant(isActive ? null : quadrant.key)}
              className={`rounded-[22px] border p-4 text-left shadow-[0_14px_36px_rgba(15,23,42,0.06)] transition-all ${
                isActive ? "border-[#2C6BE4] ring-2 ring-[#2C6BE4]/20" : "border-slate-200/90 hover:border-slate-300"
              } ${quadrant.bg}`}
            >
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{quadrant.label}</p>
              <p className={`mt-3 text-[28px] font-semibold tracking-[-0.04em] ${quadrant.color}`}>{count}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[12px] text-slate-500">{isActive ? "Showing filtered view" : "Click to filter"}</span>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </div>
            </button>
          );
        })}
      </div>

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

      {escalationBanner && activeClaim ? (
        <DashboardCard className="border-l-4 border-l-amber-500 bg-[linear-gradient(180deg,#ffffff_0%,#fffbeb_100%)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-amber-900">Suspicious signals were raised for this claim</p>
                <p className="mt-1 text-sm text-amber-700">
                  Keep the claim in manual review or request another file. The linked patient and hospital views will read from this same shared claim record.
                </p>
                <p className="mt-2 text-[12px] text-amber-600">
                  Claim: {activeClaim.id} - {activeClaim.patientName}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleRequestDocuments}
                className="inline-flex items-center gap-1.5 rounded-[12px] bg-amber-600 px-4 py-2.5 text-[12px] font-semibold text-white shadow-[0_12px_24px_rgba(245,158,11,0.2)]"
              >
                <Send className="h-3.5 w-3.5" />
                Request another file
              </button>
              <button
                type="button"
                onClick={() => handleDecision("under_review")}
                className="rounded-[12px] border border-amber-300 bg-white px-4 py-2.5 text-[12px] font-semibold text-amber-700"
              >
                Keep manual review
              </button>
              <button
                type="button"
                onClick={() => setEscalationBanner(false)}
                className="rounded-[12px] border border-slate-200 bg-white px-4 py-2.5 text-[12px] font-semibold text-slate-600"
              >
                Dismiss
              </button>
            </div>
          </div>
        </DashboardCard>
      ) : null}

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
                  <button
                    type="button"
                    onClick={runPipeline}
                    className="rounded-[12px] bg-[var(--ch-blue)] px-3 py-2 text-[12px] font-semibold text-white shadow-[0_12px_24px_rgba(90,151,216,0.18)]"
                  >
                    {runningClaimIdRef.current === activeClaim?.id ? "Running review..." : "Run four-agent review"}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setEmailPreviewOpen(true)}
                  className="rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700"
                >
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
                <p className="mt-2 text-[20px] font-semibold tracking-[-0.04em] text-slate-900">
                  Keep all three role views linked while the insurer controls the decision.
                </p>
              </div>
              <StatusChip label={activeRecommendation?.label ?? "Pending"} tone={activeRecommendation?.tone ?? "gray"} />
            </div>

            <div className="mt-4 grid gap-3">
              <div className="rounded-[16px] border border-slate-200 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">Claim process ID</p>
                  <button
                    type="button"
                    onClick={() => handleCopyClaimId(getClaimProcessId(activeClaim))}
                    className="rounded-[8px] border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    <Copy className="mr-1 inline h-3 w-3" />
                    Copy
                  </button>
                </div>
                <p className="mt-2 text-sm text-slate-700">{getClaimProcessId(activeClaim)}</p>
              </div>

              <div className="rounded-[16px] border border-slate-200 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                <p className="text-sm font-semibold text-slate-900">Current route</p>
                <p className="mt-2 text-sm text-slate-700">{getClaimRouting(activeClaim, activeCase)}</p>
                <p className="mt-2 text-[12px] leading-6 text-slate-500">
                  Claim updates, document requests, and final decisions stay attached to this shared record for patient, hospital, and insurer views.
                </p>
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

      {!activeClaim || !activeCase || !activeAgents ? (
        <DashboardCard className="text-center">
          <p className="text-sm text-slate-500">Preparing the linked insurer demo queue.</p>
        </DashboardCard>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <DashboardCard>
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Queue selector</p>
                <p className="mt-2 text-[15px] font-semibold text-slate-900">Filter approval-ready, flagged, and manual-review claims.</p>
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
                    className={`rounded-full px-3 py-1.5 text-[12px] font-medium ${
                      activeFilter === filter.key ? "bg-[#2C6BE4] text-white" : "border border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
              <div className="mt-4 space-y-2">
                {filteredClaims.map((claim) => {
                  const recommendation = recommendationForClaim(claim);
                  const selected = claim.id === activeClaim.id;
                  const claimCase = getDemoCaseForClaim(claim);
                  const suspiciousSignals = getSuspiciousSignals(claim, claimCase);
                  return (
                    <button
                      key={claim.id}
                      type="button"
                      onClick={() => setSelectedClaimId(claim.id)}
                      className={`w-full rounded-[10px] border p-3 text-left ${
                        selected ? "border-blue-200 bg-blue-50 shadow-[inset_3px_0_0_#2C6BE4]" : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2">
                          <span className={`mt-1 h-2.5 w-2.5 rounded-full ${recommendation.dot}`} />
                          <div>
                            <p className="text-sm font-medium text-slate-900">{claim.patientName}</p>
                            <p className="mt-1 text-[12px] text-slate-500">
                              {getClaimRouting(claim, claimCase)} - {claim.documents.length} file(s)
                            </p>
                            <p className="mt-1 text-[11px] text-slate-400">{suspiciousSignals.length > 0 ? `${suspiciousSignals.length} suspicious signal(s)` : "No suspicious signal"}</p>
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

          <div className="space-y-4">
            <DashboardCard>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Case review</p>
                  <p className="text-[16px] font-semibold text-slate-900">{activeClaim.patientName}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <p className="text-[12px] text-slate-500">
                      {getClaimProcessId(activeClaim)} - {activeClaim.hospital}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleCopyClaimId(getClaimProcessId(activeClaim))}
                      className="rounded-[8px] border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-100"
                      title="Copy claim ID"
                    >
                      <Copy className="mr-1 inline h-3 w-3" />
                      ID
                    </button>
                  </div>
                  <p className="mt-3 text-sm text-slate-700">Requested amount: {formatCurrency(activeClaim.amount)}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 capitalize">
                      {getClaimServiceType(activeClaim)}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                      {getSourceSummary(activeClaim)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusChip
                    label={activeClaim.status.replace("_", " ")}
                    tone={
                      activeClaim.status === "approved"
                        ? "green"
                        : activeClaim.status === "denied"
                          ? "red"
                          : activeClaim.status === "under_review"
                            ? "amber"
                            : "blue"
                    }
                  />
                  {!activeClaim.pipelineCompletedAt ? (
                    <button type="button" onClick={runPipeline} className="rounded-[10px] bg-[#2C6BE4] px-3 py-2 text-[12px] font-semibold text-white">
                      {runningClaimIdRef.current === activeClaim.id ? "Running..." : "Run review"}
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

            <DashboardCard>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Uploaded records</p>
                  <p className="mt-2 text-[15px] font-semibold text-slate-900">Files linked from hospital and patient workspaces.</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusChip label={`${activeClaim.documents.length} file(s)`} tone="blue" />
                  <button
                    type="button"
                    onClick={handleRunOcrOnly}
                    disabled={ocrRunningForDocs.size > 0}
                    className={`rounded-[10px] px-3 py-1.5 text-[11px] font-semibold transition ${
                      ocrRunningForDocs.size > 0
                        ? "cursor-not-allowed border border-slate-200 bg-slate-50 text-slate-400"
                        : ocrHasRun
                          ? "border border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                          : "border border-[var(--ch-blue-border)] bg-[var(--ch-blue-light)] text-[var(--ch-blue-dark)] hover:bg-blue-100"
                    }`}
                  >
                    {ocrRunningForDocs.size > 0 ? "OCR running…" : ocrHasRun ? "✓ OCR complete" : "Run OCR on docs"}
                  </button>
                </div>
              </div>
              {ocrHasRun && ocrResults.size > 0 ? (
                <div className="mt-3 rounded-[14px] border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700">Live OCR extraction complete</p>
                  <p className="mt-1 text-[12px] text-emerald-600">
                    {ocrResults.size} document(s) processed via <span className="font-mono font-semibold">/api/ocr/upload</span>. Extracted fields shown in each card below.
                  </p>
                </div>
              ) : null}
              {latestSharedDocument ? (
                <div className="mt-4 rounded-[16px] border border-[var(--ch-blue-border)] bg-[var(--ch-blue-light)]/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">Latest shared upload</p>
                    <span className="rounded-full border border-white/70 bg-white px-2.5 py-1 text-[10px] font-semibold text-[var(--ch-blue-dark)]">
                      {latestSharedDocument.uploadedBy} · {formatRelativeTime(latestSharedDocument.uploadedAt)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-800">
                    {latestSharedDocument.category ?? latestSharedDocument.name}
                  </p>
                  <p className="mt-1 text-[12px] leading-6 text-slate-600">
                    {latestSharedDocument.previewText || "New supporting evidence is available in the shared claim record."}
                  </p>
                </div>
              ) : null}
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {activeDocuments.map((document) => {
                  const badge = getSourceBadge(document.uploadedBy);
                  const isOcrRunning = ocrRunningForDocs.has(document.name);
                  const ocrResult = ocrResults.get(document.name);
                  const hasOcr = ocrResult !== undefined && ocrResults.has(document.name);
                  const ocrFields = hasOcr && ocrResult
                    ? [
                        ocrResult.patientName ? `Patient: ${ocrResult.patientName}` : null,
                        ocrResult.hospitalName ? `Hospital: ${ocrResult.hospitalName}` : null,
                        ocrResult.diagnosis ? `Diagnosis: ${ocrResult.diagnosis}` : null,
                        ocrResult.icdCode ? `ICD-10: ${ocrResult.icdCode}` : null,
                        ocrResult.admissionDate ? `Admitted: ${ocrResult.admissionDate}` : null,
                        ocrResult.dischargeDate ? `Discharged: ${ocrResult.dischargeDate}` : null,
                        ocrResult.doctorName ? `Doctor: ${ocrResult.doctorName}` : null,
                        ocrResult.totalAmount ? `Total: ${ocrResult.totalAmount}` : null,
                        (ocrResult.structured_data as Record<string, unknown>)?.policy_number
                          ? `Policy: ${(ocrResult.structured_data as Record<string, unknown>).policy_number}`
                          : null,
                        ocrResult.note ? `Note: ${ocrResult.note}` : null,
                      ].filter(Boolean)
                    : [];
                  return (
                    <div
                      key={`${document.name}-${document.uploadedAt}`}
                      className={`rounded-[16px] border p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)] transition-colors ${
                        isOcrRunning
                          ? "border-amber-200 bg-amber-50/60"
                          : hasOcr && ocrResult
                            ? "border-emerald-200 bg-emerald-50/40"
                            : hasOcr
                              ? "border-slate-200 bg-white"
                              : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">{document.category ?? document.name}</p>
                        <div className="flex items-center gap-1.5">
                          {isOcrRunning ? (
                            <span className="rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">OCR…</span>
                          ) : hasOcr && ocrResult ? (
                            <span className="rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">OCR done</span>
                          ) : hasOcr ? (
                            <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">OCR: text only</span>
                          ) : null}
                          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${badge.className}`}>{badge.label}</span>
                        </div>
                      </div>
                      <p className="mt-2 text-[12px] text-slate-600">{document.name}</p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {Math.max(1, Math.round(document.size / 1024)).toLocaleString("en-IN")} KB · {formatRelativeTime(document.uploadedAt)}
                      </p>
                      {isOcrRunning ? (
                        <div className="mt-3 flex items-center gap-2">
                          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                          <p className="text-[11px] text-amber-700">Extracting via backend OCR…</p>
                        </div>
                      ) : hasOcr && ocrResult && ocrFields.length > 0 ? (
                        <div className="mt-3 space-y-1 rounded-[10px] border border-emerald-200 bg-emerald-50 px-3 py-2">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-emerald-700">OCR extracted</p>
                          {ocrFields.map((field) => (
                            <p key={field} className="text-[11px] text-slate-700">{field}</p>
                          ))}
                        </div>
                      ) : hasOcr && ocrResult && ocrResult.raw_text ? (
                        <div className="mt-3 rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">OCR raw text (preview)</p>
                          <p className="mt-1 text-[11px] leading-5 text-slate-600 line-clamp-3">{ocrResult.raw_text.slice(0, 240)}…</p>
                        </div>
                      ) : hasOcr ? (
                        <p className="mt-3 text-[11px] text-slate-500">Text parsed — no structured fields detected.</p>
                      ) : document.previewText ? (
                        <p className="mt-3 text-[12px] leading-6 text-slate-600">{document.previewText}</p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </DashboardCard>


            <div className="space-y-3">
              {(["intake", "policy", "medical", "fraud"] as VerificationAgentKey[]).map((agentKey) => {
                const result = activeAgents[agentKey];
                const running = agentState[agentKey] === "running";
                const tone = running ? "amber" : result.status === "pass" ? "green" : result.status === "flag" ? "red" : "gray";

                return (
                  <DashboardCard
                    key={agentKey}
                    className={`border-l-4 ${
                      result.status === "pass" ? "border-l-green-500" : result.status === "flag" ? "border-l-red-500" : "border-l-slate-300"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[14px] font-medium text-slate-900">{verificationAgentNames[agentKey]}</p>
                      <div className="flex items-center gap-2">
                        <StatusChip
                          label={running ? "Running" : result.status === "pass" ? "PASS" : result.status === "flag" ? "FLAG" : "Pending"}
                          tone={tone}
                        />
                        {typeof result.confidence === "number" ? <span className="text-[11px] text-slate-500">{result.confidence}%</span> : null}
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-700">
                      {running ? "Review is still running for this agent. Final reasoning appears after the current verification step finishes." : result.reason}
                    </p>
                    {result.highlights?.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {result.highlights.map((highlight) => (
                          <span key={highlight} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                            {highlight}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </DashboardCard>
                );
              })}
            </div>

            <DashboardCard className={activeSuspiciousSignals.length > 0 ? "bg-[linear-gradient(180deg,#ffffff_0%,#fff7f5_100%)]" : "bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_100%)]"}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Suspicious signal output</p>
                  <p className="mt-2 text-[15px] font-semibold text-slate-900">
                    {activeSuspiciousSignals.length > 0 ? "Flagged items that should drive manual review." : "No suspicious signal is active for this claim."}
                  </p>
                </div>
                <StatusChip label={activeSuspiciousSignals.length > 0 ? `${activeSuspiciousSignals.length} flag(s)` : "Clear"} tone={activeSuspiciousSignals.length > 0 ? "red" : "green"} />
              </div>

              {activeSuspiciousSignals.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {activeSuspiciousSignals.map((signal) => (
                    <div key={`${signal.title}-${signal.detail}`} className="rounded-[16px] border border-slate-200 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">{signal.title}</p>
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${severityClassNames[signal.severity]}`}>
                          {signal.severity}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{signal.detail}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm leading-6 text-slate-600">
                  The current uploaded records, policy context, and fraud screen do not show a suspicious issue. The insurer can move straight to a final decision if needed.
                </p>
              )}
            </DashboardCard>

            <EvidenceDrawer
              buttonLabel="View cited policy clauses"
              title={policyExcerpt ? `${policyExcerpt.clause} - ${policyExcerpt.title}` : "Policy evidence"}
            >
              {policyExcerpt ? (
                <div className="rounded-[10px] border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[12px] font-medium text-slate-900">
                    {policyExcerpt.clause} - {policyExcerpt.title}
                  </p>
                  <blockquote className="mt-3 text-sm leading-7 text-slate-700">{policyExcerpt.body}</blockquote>
                </div>
              ) : null}
            </EvidenceDrawer>

            <DashboardCard>
              <label className="text-[12px] text-slate-600">
                Decision note or file request
                <textarea
                  value={decisionNote}
                  onChange={(event) => setDecisionNote(event.target.value)}
                  className="mt-1 min-h-24 w-full rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#2C6BE4]"
                  placeholder="Add the insurer note that should appear across the linked claim views."
                />
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
                <button type="button" onClick={handleRequestDocuments} className="rounded-[10px] border border-[#2C6BE4] bg-white px-4 py-2 text-[12px] font-semibold text-[#2C6BE4]">
                  Request another file
                </button>
                <button
                  type="button"
                  onClick={() => handleDecision("under_review")}
                  className="inline-flex items-center gap-1 rounded-[10px] border border-amber-300 bg-amber-50 px-4 py-2 text-[12px] font-semibold text-amber-700"
                >
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Keep manual review
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

          <div className="space-y-4">
            <DashboardCard>
              <p className="text-[14px] font-medium text-slate-900">Agent consensus</p>
              <div className="mt-4 space-y-3">
                {(["intake", "policy", "medical", "fraud"] as VerificationAgentKey[]).map((agentKey) => {
                  const result = activeAgents[agentKey];
                  return (
                    <div key={`consensus-${agentKey}`} className="rounded-[10px] border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[12px] font-medium text-slate-900">{verificationAgentNames[agentKey]}</p>
                        <StatusChip
                          label={result.status === "pass" ? "PASS" : result.status === "flag" ? "FLAG" : "Pending"}
                          tone={result.status === "pass" ? "green" : result.status === "flag" ? "red" : "gray"}
                        />
                      </div>
                      <div className="mt-3">
                        <ConfidenceBar
                          label="Confidence"
                          value={result.confidence ?? 0}
                          tone={result.status === "pass" ? "green" : result.status === "flag" ? "red" : "gray"}
                        />
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
                  <p className="text-[11px] text-slate-500">
                    {activeClaim.patientName} - {activeClaim.id}
                  </p>
                </div>
              </div>
              <div className="mt-4 rounded-[10px] border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">
                  {activeClaim.status === "approved" ? "Approved" : activeClaim.status === "denied" ? "Denied" : "Manual review"}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">{decisionLetter}</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => toast.success("Claimant update queued from the insurer view.")}
                  className="inline-flex items-center gap-2 rounded-[10px] bg-[#2C6BE4] px-3 py-2 text-[12px] font-semibold text-white"
                >
                  <Send className="h-3.5 w-3.5" />
                  Queue claimant update
                </button>
                <button
                  type="button"
                  onClick={() => setEmailPreviewOpen(true)}
                  className="inline-flex items-center gap-2 rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700"
                >
                  <Mail className="h-3.5 w-3.5" />
                  Preview as email
                </button>
              </div>
            </DashboardCard>

            <DashboardCard>
              <p className="text-[14px] font-medium text-slate-900">Verification flow map</p>
              <div className="mt-4 space-y-2 text-[12px] text-slate-600">
                {[
                  "Hospital or patient uploads are linked into one shared claim file",
                  "Intake agent maps the uploaded file bundle",
                  "Policy agent checks eligibility and coverage clauses",
                  "Medical agent validates diagnosis, treatment, and billing context",
                  "Fraud agent raises suspicious signals if anomalies appear",
                  "Insurer reviewer approves, denies, or requests another file",
                ].map((step) => (
                  <div key={step} className="rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2.5">
                    {step}
                  </div>
                ))}
              </div>
            </DashboardCard>

            <DashboardCard>
              <p className="text-[14px] font-medium text-slate-900">Role linkage snapshot</p>
              <div className="mt-4 space-y-2 text-[12px] text-slate-600">
                <div className="flex items-center justify-between">
                  <span>Patient-linked views</span>
                  <span>{workflowClaims.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Hospital-linked views</span>
                  <span>{workflowClaims.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Cashless claims</span>
                  <span>{serviceBreakdown.cashless}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Reimbursement claims</span>
                  <span>{serviceBreakdown.reimbursement}</span>
                </div>
              </div>
            </DashboardCard>
          </div>
        </div>
      )}

      {emailPreviewOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-slate-950/35"
            onClick={() => setEmailPreviewOpen(false)}
            aria-label="Close preview"
          />
          <div className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,720px)] -translate-x-1/2 -translate-y-1/2 rounded-[10px] border border-slate-200 bg-white p-4 shadow-[0_20px_50px_rgba(15,23,42,0.2)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[14px] font-medium text-slate-900">Email preview</p>
                <p className="mt-1 text-[12px] text-slate-500">This is the claimant-facing message body.</p>
              </div>
              <button type="button" onClick={() => setEmailPreviewOpen(false)} className="rounded-[10px] border border-slate-200 px-3 py-1 text-[12px] text-slate-600">
                Close
              </button>
            </div>
            <div className="mt-4 rounded-[10px] border border-slate-200 bg-slate-50 p-4">
              <p className="text-[12px] text-slate-500">To: {activeClaim?.patientEmail ?? "patient@claimheart.ai"}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">{decisionLetter}</p>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
