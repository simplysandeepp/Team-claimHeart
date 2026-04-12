"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock3, FileText, ScrollText, ShieldCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/api/auth";
import { formatRelativeTime } from "@/lib/claimUi";
import { getSyncMode } from "@/lib/localWorkflow";
import { useAppStore } from "@/store/useAppStore";
import usePageReady from "@/hooks/usePageReady";
import { SkeletonBlock, SkeletonCard } from "@/components/ui/Skeleton";
import AuditTrailDialog from "@/components/letters/AuditTrailDialog";
import LetterEditor from "@/components/letters/LetterEditor";
import type { AppUser, Claim, ClaimStatus } from "@/types";

const statusFilters: Array<{ label: string; value: "all" | ClaimStatus }> = [
  { label: "All letters", value: "all" },
  { label: "Approved", value: "approved" },
  { label: "Under review", value: "under_review" },
  { label: "Denied", value: "denied" },
];

export default function LettersPage() {
  const ready = usePageReady();
  const claims = useAppStore((state) => state.claims);
  const [viewer, setViewer] = useState<AppUser | null>(null);
  const [activeFilter, setActiveFilter] = useState<"all" | ClaimStatus>("all");
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [auditClaimId, setAuditClaimId] = useState<string | null>(null);

  useEffect(() => {
    getCurrentUser().then(setViewer);
  }, []);

  const letterClaims = useMemo(
    () =>
      [...claims]
        .filter((claim) => claim.decisionLetter || claim.pipelineCompletedAt || claim.status !== "pending")
        .filter((claim) => activeFilter === "all" || claim.status === activeFilter)
        .sort((left, right) => {
          const rightTime = new Date(right.pipelineCompletedAt ?? right.submittedAt).getTime();
          const leftTime = new Date(left.pipelineCompletedAt ?? left.submittedAt).getTime();
          return rightTime - leftTime;
        }),
    [activeFilter, claims],
  );

  useEffect(() => {
    if (!selectedClaimId && letterClaims[0]) {
      setSelectedClaimId(letterClaims[0].id);
    }
    if (selectedClaimId && !letterClaims.some((claim) => claim.id === selectedClaimId)) {
      setSelectedClaimId(letterClaims[0]?.id ?? null);
    }
  }, [letterClaims, selectedClaimId]);

  const selectedClaim =
    letterClaims.find((claim) => claim.id === selectedClaimId) ??
    letterClaims[0] ??
    null;
  const auditClaim = letterClaims.find((claim) => claim.id === auditClaimId) ?? null;
  const syncMode = getSyncMode();

  const summaryCards = [
    {
      label: "Published letters",
      value: letterClaims.length,
      helper: "Decision outputs generated from the shared workflow state.",
      icon: FileText,
    },
    {
      label: "Completed workflows",
      value: claims.filter((claim) => claim.workflowState === "completed").length,
      helper: "Claims with agent decisions and final routing captured.",
      icon: ShieldCheck,
    },
    {
      label: "Recent update",
      value: selectedClaim ? formatRelativeTime(selectedClaim.pipelineCompletedAt ?? selectedClaim.submittedAt) : "No activity",
      helper: selectedClaim ? `${selectedClaim.id} is selected in the review panel.` : "Run a workflow to generate a letter.",
      icon: Clock3,
    },
  ];

  if (!ready) {
    return (
      <div className="space-y-6">
        <div className="space-y-3">
          <SkeletonBlock className="h-10 w-64" />
          <SkeletonBlock className="h-5 w-96" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <SkeletonCard key={index} lines={2} />
          ))}
        </div>
        <SkeletonCard lines={8} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[1.9rem] border border-slate-200 bg-[linear-gradient(135deg,#f7fbff_0%,#eef5ff_52%,#ffffff_100%)] p-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ch-blue)]">Letters And Audit Evidence</p>
            <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em] text-slate-900 md:text-[2.1rem]">
              Publish decisions with traceable workflow proof
            </h1>
            <p className="mt-3 max-w-3xl text-base text-[var(--ch-muted)] md:text-lg">
              This page ties the final member-facing decision letter back to the claim status, the agent outputs, and the audit entries created during review.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">
              {viewer?.name ?? "Insurer workspace"}
            </span>
            <span
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                syncMode === "live"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              }`}
            >
              {syncMode === "live" ? "Live backend sync" : "Fallback demo sync"}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {summaryCards.map((item) => (
          <article key={item.label} className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--ch-blue-light)] text-[var(--ch-blue)]">
                <item.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-[var(--ch-subtle)]">{item.label}</p>
                <p className="mt-1 text-2xl font-bold tracking-[-0.04em] text-slate-900">{item.value}</p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-[var(--ch-muted)]">{item.helper}</p>
          </article>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {statusFilters.map((filter) => {
          const active = activeFilter === filter.value;
          return (
            <button
              key={filter.value}
              type="button"
              onClick={() => setActiveFilter(filter.value)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition-all ${
                active
                  ? "border-[var(--ch-blue)] bg-[var(--ch-blue)] text-white shadow-[0_10px_24px_rgba(74,142,219,0.18)]"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900 md:text-[1.45rem]">Generated Letters</h2>
              <p className="mt-1 text-sm text-[var(--ch-muted)]">Select any claim to inspect the issued decision output and its audit trail.</p>
            </div>
            <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
              {letterClaims.length} items
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {letterClaims.length === 0 ? (
              <div className="rounded-[1.4rem] border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-[var(--ch-muted)]">
                No decision output is available yet. Run the insurer workflow or record a decision to generate the first letter.
              </div>
            ) : (
              letterClaims.map((claim) => {
                const selected = selectedClaim?.id === claim.id;
                return (
                  <button
                    key={claim.id}
                    type="button"
                    onClick={() => setSelectedClaimId(claim.id)}
                    className={`w-full rounded-[1.4rem] border p-4 text-left transition-all ${
                      selected
                        ? "border-[var(--ch-blue)] bg-[var(--ch-blue-light)] shadow-[0_12px_24px_rgba(74,142,219,0.12)]"
                        : "border-slate-200 bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900">{claim.id}</p>
                        <p className="mt-1 text-sm text-[var(--ch-muted)]">
                          {claim.patientName} | {claim.status.replaceAll("_", " ")}
                        </p>
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--ch-muted)]">
                          {claim.decisionNote ?? claim.auditTrail?.at(-1)?.label ?? "Awaiting decision summary."}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                          {claim.workflowState ?? "submitted"}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                          {formatRelativeTime(claim.pipelineCompletedAt ?? claim.submittedAt)}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setAuditClaimId(claim.id);
                        }}
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-50"
                      >
                        <ScrollText className="h-4 w-4" />
                        Open audit trail
                      </button>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {selectedClaim ? (
          <LetterEditor claim={selectedClaim} />
        ) : (
          <div className="rounded-[1.75rem] border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-[var(--ch-muted)]">
            Select a claim to review the generated decision letter.
          </div>
        )}
      </div>

      <AuditTrailDialog open={Boolean(auditClaimId)} claim={auditClaim} onClose={() => setAuditClaimId(null)} />
    </div>
  );
}
