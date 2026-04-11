"use client";

import { useMemo, useState } from "react";
import { policies } from "@/lib/data";

export default function PolicyLibraryPage() {
  const [activePolicyId, setActivePolicyId] = useState(policies[0]?.id ?? "");
  const [highlightedOnly, setHighlightedOnly] = useState(false);
  const [search, setSearch] = useState("");

  const policy = policies.find((item) => item.id === activePolicyId) ?? policies[0];
  const clauses = useMemo(() => {
    return policy.clauses.filter((clause) => {
      const q = search.toLowerCase();
      const matchesSearch = q.length === 0 || clause.title.toLowerCase().includes(q) || clause.summary.toLowerCase().includes(q) || clause.section.toLowerCase().includes(q);
      const matchesHighlight = !highlightedOnly || clause.highlighted;
      return matchesSearch && matchesHighlight;
    });
  }, [policy, search, highlightedOnly]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-[-0.04em] text-slate-900 md:text-[2.1rem]">Policy Library</h1>
        <p className="mt-2 text-base text-[var(--ch-muted)] md:text-lg">RAG-indexed policy documents with AI-highlighted clauses and coverage notes</p>
      </div>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.6fr]">
        <article className="rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-xl font-bold text-slate-900 md:text-[1.45rem]">Policy Documents</h2>
            <p className="mt-1 text-sm text-[var(--ch-subtle)]">{policies.length} documents indexed</p>
          </div>
          <div>
            {policies.map((item) => {
              const active = item.id === policy.id;
              return (
                <button key={item.id} onClick={() => setActivePolicyId(item.id)} className={`w-full border-b border-slate-100 px-5 py-4 text-left transition last:border-b-0 ${active ? "bg-[var(--ch-blue-light)]" : "bg-white"}`}>
                  <p className="font-semibold text-slate-900">{item.name}</p>
                  <p className="mt-1 text-sm text-[var(--ch-muted)]">{item.insurer}</p>
                  <p className="mt-2 text-xs text-[var(--ch-subtle)]">{item.version} � {item.pages} pages</p>
                </button>
              );
            })}
          </div>
        </article>

        <div className="space-y-5">
          <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
            <h2 className="text-xl font-bold text-slate-900 md:text-[1.5rem]">{policy.name}</h2>
            <p className="mt-3 text-base text-[var(--ch-muted)] md:text-lg">Insurer: {policy.insurer} � {policy.version} � Updated {policy.lastUpdated}</p>
          </article>

          <article className="rounded-[1.75rem] border border-amber-200 bg-amber-50 p-6">
            <h3 className="text-lg font-bold text-amber-700">AI Analysis Note</h3>
            <p className="mt-3 text-base leading-8 text-amber-900">{policy.aiNote}</p>
          </article>

          <div className="flex gap-3">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search clauses, sections..." className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none" />
            <button onClick={() => setHighlightedOnly((value) => !value)} className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${highlightedOnly ? "border-[var(--ch-blue)] bg-[var(--ch-blue-light)] text-[var(--ch-blue)]" : "border-slate-200 bg-white text-slate-600"}`}>Highlighted Only</button>
          </div>

          <div className="space-y-4">
            {clauses.map((clause, index) => (
              <article key={`${clause.section}-${index}`} className={`rounded-[1.75rem] border bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)] ${clause.highlighted ? "border-[var(--ch-blue)]" : "border-slate-200"}`}>
                <div className="flex items-center gap-3 text-sm">
                  <span className="rounded-full bg-[var(--ch-blue-light)] px-3 py-1 font-semibold text-[var(--ch-blue)]">{clause.section}</span>
                  <span className="text-[var(--ch-subtle)]">Page {clause.page}</span>
                </div>
                <h3 className="mt-4 text-xl font-bold text-slate-900 md:text-[1.45rem]">{clause.title}</h3>
                <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-base leading-8 text-slate-800">{clause.summary}</div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
