"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { formatDateTime, formatRelativeTime } from "@/lib/claimUi";
import type { Claim, WorkflowAuditEntry } from "@/types";

const levelClasses: Record<WorkflowAuditEntry["level"], string> = {
  info: "border-sky-200 bg-sky-50 text-sky-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
};

export default function AuditTrailDialog({
  open,
  claim,
  onClose,
}: {
  open: boolean;
  claim: Claim | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose, open]);

  if (!open || !claim) {
    return null;
  }

  const auditTrail = [...(claim.auditTrail ?? [])].sort(
    (left, right) => new Date(right.time).getTime() - new Date(left.time).getTime(),
  );

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 px-4 py-6">
      <button type="button" className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Close audit trail" />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-[1.8rem] border border-slate-200 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.24)]">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-[linear-gradient(180deg,#f8fbff_0%,#eef4fb_100%)] px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ch-blue)]">Transparency Trail</p>
            <h2 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-slate-900">{claim.id}</h2>
            <p className="mt-1 text-sm text-[var(--ch-muted)]">
              {claim.patientName} | {claim.hospital} | {claim.workflowState ?? "submitted"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition-all hover:bg-slate-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          {auditTrail.length === 0 ? (
            <div className="rounded-[1.4rem] border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-[var(--ch-muted)]">
              No audit entries are available for this claim yet.
            </div>
          ) : (
            <div className="space-y-3">
              {auditTrail.map((entry, index) => (
                <div key={`${entry.time}-${index}`} className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{entry.label}</p>
                      <p className="mt-2 text-xs text-[var(--ch-subtle)]">
                        {formatDateTime(entry.time)} | {formatRelativeTime(entry.time)}
                      </p>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${levelClasses[entry.level]}`}>
                      {entry.level}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
