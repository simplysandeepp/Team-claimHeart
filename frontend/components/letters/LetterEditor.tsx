"use client";

import { useEffect, useState } from "react";
import { Copy, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { buildDecisionLetter } from "@/lib/api/claims";
import { formatDateTime, formatRelativeTime } from "@/lib/claimUi";
import type { Claim } from "@/types";

export default function LetterEditor({ claim }: { claim: Claim }) {
  const [letterText, setLetterText] = useState("");

  useEffect(() => {
    setLetterText(buildDecisionLetter(claim));
  }, [claim]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(letterText);
    toast.success(`Decision letter for ${claim.id} copied.`);
  };

  return (
    <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ch-blue)]">Decision Output</p>
          <h2 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-slate-900">{claim.id}</h2>
          <p className="mt-2 text-sm text-[var(--ch-muted)]">
            {claim.patientName} | {claim.patientEmail || "member@claimheart.local"} | {claim.status.replaceAll("_", " ")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-600">
            Updated {formatRelativeTime(claim.pipelineCompletedAt ?? claim.submittedAt)}
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex h-10 items-center gap-2 rounded-2xl bg-[var(--ch-blue)] px-4 text-sm font-semibold text-white transition-all hover:opacity-95"
          >
            <Copy className="h-4 w-4" />
            Copy letter
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-[var(--ch-subtle)]">Recipient</p>
          <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Mail className="h-4 w-4 text-[var(--ch-blue)]" />
            {claim.patientEmail || "member@claimheart.local"}
          </div>
        </div>
        <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-[var(--ch-subtle)]">Workflow state</p>
          <div className="mt-3 flex items-center gap-2 text-sm font-semibold capitalize text-slate-900">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            {claim.workflowState ?? "submitted"}
          </div>
        </div>
        <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-[var(--ch-subtle)]">Decision published</p>
          <p className="mt-3 text-sm font-semibold text-slate-900">
            {formatDateTime(claim.pipelineCompletedAt ?? claim.submittedAt)}
          </p>
        </div>
      </div>

      <label className="mt-5 block text-sm font-semibold text-slate-900" htmlFor={`letter-${claim.id}`}>
        Letter preview
      </label>
      <textarea
        id={`letter-${claim.id}`}
        value={letterText}
        onChange={(event) => setLetterText(event.target.value)}
        className="mt-3 min-h-[24rem] w-full rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-700 outline-none transition-all focus:border-[var(--ch-blue)] focus:shadow-[0_0_0_4px_rgba(74,142,219,0.12)]"
      />
    </div>
  );
}
