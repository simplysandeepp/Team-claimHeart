"use client";

import { useEffect, useState } from "react";
import { getCurrentUser } from "@/lib/api/auth";
import { buildDecisionLetter } from "@/lib/api/claims";
import { getLatestInsurerDocumentRequest, getQueryOwnerRole, getSharedDocuments } from "@/lib/claimSync";
import { getSyncMode } from "@/lib/localWorkflow";
import { useAppStore } from "@/store/useAppStore";
import AgentResultCard from "@/components/claims/AgentResultCard";
import TimelineView from "@/components/claims/TimelineView";
import StatusBadge from "@/components/claims/StatusBadge";
import MotionCard from "@/components/ui/MotionCard";
import { SkeletonBlock, SkeletonCard } from "@/components/ui/Skeleton";
import usePageReady from "@/hooks/usePageReady";
import type { AppUser, UserRole } from "@/types";

export default function RoleClaimPage({ claimId, role }: { claimId: string; role: UserRole }) {
  const claim = useAppStore((state) => state.claims.find((entry) => entry.id === claimId) ?? null);
  const [user, setUser] = useState<AppUser | null>(null);
  const ready = usePageReady();

  useEffect(() => {
    getCurrentUser().then(setUser);
  }, []);

  if (!ready) {
    return (
      <div className="space-y-6">
        <SkeletonBlock className="h-9 w-48" />
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <SkeletonCard lines={4} />
            <SkeletonCard lines={4} />
          </div>
          <div className="space-y-6">
            <SkeletonCard lines={4} />
            <SkeletonCard lines={3} />
          </div>
        </div>
      </div>
    );
  }

  if (!claim) {
    return <div className="text-sm text-[var(--ch-muted)]">Claim not found.</div>;
  }

  const comments = claim.comments.filter((entry) => entry.visibleTo.includes(role) || entry.visibleTo.includes("all"));
  const letter = buildDecisionLetter(claim);
  const sharedDocuments = getSharedDocuments(claim);
  const latestDocumentRequest = getLatestInsurerDocumentRequest(claim);
  const queryOwnerRole = getQueryOwnerRole(claim);
  const syncMode = getSyncMode();
  const auditTrail = [...(claim.auditTrail ?? [])].sort((left, right) => new Date(right.time).getTime() - new Date(left.time).getTime());
  const workflowSteps = [
    {
      label: "Submission",
      detail: `Claim submitted on ${new Date(claim.submittedAt).toLocaleString("en-IN")}`,
      state: "done",
    },
    {
      label: "Agent processing",
      detail:
        claim.workflowState === "completed"
          ? "All available agent outputs have been published."
          : claim.workflowState === "adjudicating"
            ? "Agents are actively processing this claim."
            : "The claim is queued for agent processing.",
      state: claim.workflowState === "adjudicating" ? "active" : "done",
    },
    {
      label: "Decision",
      detail: `Current claim status: ${claim.status.replace("_", " ")}`,
      state: claim.status === "pending" ? "active" : "done",
    },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--ch-blue)]">{claim.id}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em] text-slate-900 md:text-[2.1rem]">
            {claim.caseLabel || claim.diagnosis}
          </h1>
          <p className="mt-2 text-base text-[var(--ch-muted)] md:text-lg">{claim.hospital}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
              {claim.claimProcessId || claim.id}
            </span>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${
                syncMode === "live"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              }`}
            >
              {syncMode === "live" ? "Live backend sync" : "Demo fallback sync"}
            </span>
          </div>
        </div>
        <StatusBadge status={claim.status} />
      </div>

      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <MotionCard className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
            <h2 className="text-xl font-bold text-slate-900 md:text-[1.45rem]">Claim Summary</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[
                { label: "Patient", value: claim.patientName },
                { label: "Requested Amount", value: `Rs ${claim.amount.toLocaleString("en-IN")}` },
                { label: "Approved Amount", value: `Rs ${(claim.amountApproved ?? 0).toLocaleString("en-IN")}` },
                { label: "Case Type", value: claim.caseType.replace("_", " ") },
                { label: "ICD Code", value: claim.icdCode },
                { label: "Policy Number", value: claim.policyNumber || "-" },
              ].map((item) => (
                <div key={item.label} className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm text-[var(--ch-subtle)]">{item.label}</p>
                  <p className="mt-2 font-semibold capitalize text-slate-900">{item.value}</p>
                </div>
              ))}
            </div>
          </MotionCard>

          <MotionCard className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
            <h2 className="text-xl font-bold text-slate-900 md:text-[1.45rem]">AI Results</h2>
            <div className="mt-5 space-y-4">
              <AgentResultCard
                agentName="Policy Agent"
                status={claim.aiResults.policy.status}
                reason={claim.aiResults.policy.reason}
                confidence={claim.aiResults.policy.confidence}
                highlights={claim.aiResults.policy.highlights}
              />
              <AgentResultCard
                agentName="Medical Agent"
                status={claim.aiResults.medical.status}
                reason={claim.aiResults.medical.reason}
                confidence={claim.aiResults.medical.confidence}
                highlights={claim.aiResults.medical.highlights}
              />
              <AgentResultCard
                agentName="Cross-Check Agent"
                status={claim.aiResults.cross.status}
                reason={claim.aiResults.cross.reason}
                confidence={claim.aiResults.cross.confidence}
                highlights={claim.aiResults.cross.highlights}
              />
            </div>
          </MotionCard>

          <MotionCard className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
            <h2 className="text-xl font-bold text-slate-900 md:text-[1.45rem]">Shared Documents</h2>
            <p className="mt-2 text-sm text-[var(--ch-muted)]">
              Query owner: {queryOwnerRole}.{" "}
              {latestDocumentRequest ? `Latest insurer request: ${latestDocumentRequest.note}` : "No insurer document request is active."}
            </p>
            <div className="mt-5 space-y-3">
              {sharedDocuments.length === 0 ? (
                <p className="text-sm text-[var(--ch-muted)]">No documents are attached to this claim yet.</p>
              ) : (
                sharedDocuments.map((document) => (
                  <div key={`${document.name}-${document.uploadedAt}`} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">{document.category || document.name}</p>
                    <p className="mt-2 text-xs text-[var(--ch-muted)]">
                      {document.uploadedBy} · {Math.max(1, Math.round(document.size / 1024))} KB
                    </p>
                  </div>
                ))
              )}
            </div>
          </MotionCard>
        </div>

        <div className="space-y-6">
          <MotionCard className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
            <h2 className="text-xl font-bold text-slate-900 md:text-[1.45rem]">Timeline</h2>
            <div className="mt-5">
              <TimelineView timeline={claim.timeline} />
            </div>
          </MotionCard>

          <MotionCard className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
            <h2 className="text-xl font-bold text-slate-900 md:text-[1.45rem]">Transparency Trail</h2>
            <p className="mt-2 text-sm text-[var(--ch-muted)]">
              Workflow state: {claim.workflowState ?? "submitted"} • Query owner: {queryOwnerRole}
            </p>
            <div className="mt-5 space-y-3">
              {workflowSteps.map((step) => (
                <div key={step.label} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-semibold text-slate-900">{step.label}</p>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                        step.state === "done" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {step.state}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[var(--ch-muted)]">{step.detail}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 space-y-3">
              {auditTrail.length === 0 ? (
                <p className="text-sm text-[var(--ch-muted)]">No workflow log is available yet.</p>
              ) : (
                auditTrail.map((entry, index) => (
                  <div key={`${entry.time}-${index}`} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">{entry.label}</p>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                          entry.level === "success"
                            ? "bg-emerald-100 text-emerald-700"
                            : entry.level === "warning"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-sky-100 text-sky-700"
                        }`}
                      >
                        {entry.level}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-[var(--ch-muted)]">{new Date(entry.time).toLocaleString("en-IN")}</p>
                  </div>
                ))
              )}
            </div>
          </MotionCard>

          <MotionCard className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
            <h2 className="text-xl font-bold text-slate-900 md:text-[1.45rem]">Comments</h2>
            <div className="mt-5 space-y-3">
              {comments.length === 0 ? (
                <p className="text-sm text-[var(--ch-muted)]">No comments visible to you.</p>
              ) : (
                comments.map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <p className="text-sm leading-6 text-slate-800">{entry.text}</p>
                    <p className="mt-2 text-xs text-[var(--ch-muted)]">
                      {entry.author} · {entry.role}
                    </p>
                  </div>
                ))
              )}
            </div>
          </MotionCard>

          <MotionCard className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
            <h2 className="text-xl font-bold text-slate-900 md:text-[1.45rem]">Decision Letter</h2>
            <pre className="mt-4 max-h-[22rem] overflow-auto whitespace-pre-wrap rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-700">
              {letter}
            </pre>
          </MotionCard>

          <MotionCard className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
            <h2 className="text-xl font-bold text-slate-900 md:text-[1.45rem]">Viewer</h2>
            <p className="mt-2 text-sm text-[var(--ch-muted)]">Signed in as {user?.name ?? role}.</p>
          </MotionCard>
        </div>
      </section>
    </div>
  );
}
