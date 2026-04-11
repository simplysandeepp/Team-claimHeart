import { reportsData } from "@/lib/data";

export default function ReportsPage() {
  const maxProcessed = Math.max(...reportsData.monthlyTrends.map((item) => item.processed));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-[-0.04em] text-slate-900 md:text-[2.1rem]">Analytics & Reports</h1>
        <p className="mt-2 text-base text-[var(--ch-muted)] md:text-lg">Performance metrics, fraud trends, and operational insights</p>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)]"><p className="text-sm text-[var(--ch-subtle)]">Avg. Processing Time</p><p className="mt-3 text-4xl font-bold xl:text-[2.8rem] text-[var(--ch-blue)]">{reportsData.processingSpeed}s</p></article>
        <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)]"><p className="text-sm text-[var(--ch-subtle)]">Fraud Prevented</p><p className="mt-3 text-4xl font-bold xl:text-[2.8rem] text-green-600">Rs {(reportsData.fraudPrevented / 100000).toFixed(1)}L</p></article>
        <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)]"><p className="text-sm text-[var(--ch-subtle)]">Cost Per Claim</p><p className="mt-3 text-4xl font-bold xl:text-[2.8rem] text-amber-500">Rs {reportsData.costPerClaim}</p></article>
        <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)]"><p className="text-sm text-[var(--ch-subtle)]">AI Accuracy</p><p className="mt-3 text-4xl font-bold xl:text-[2.8rem] text-[var(--ch-blue-dark)]">{reportsData.accuracyRate}%</p></article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <h2 className="text-2xl font-bold text-slate-900 md:text-[1.7rem]">Monthly Claims Volume</h2>
          <div className="mt-8 space-y-5">
            {reportsData.monthlyTrends.map((item) => (
              <div key={item.month}>
                <div className="mb-2 flex items-center justify-between text-sm text-slate-500"><span>{item.month}</span><span>{item.processed}</span></div>
                <div className="h-3 rounded-full bg-slate-100"><div className="h-3 rounded-full bg-[var(--ch-blue)]" style={{ width: `${(item.processed / maxProcessed) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <h2 className="text-2xl font-bold text-slate-900 md:text-[1.7rem]">Top ICD-10 Codes</h2>
          <div className="mt-6 space-y-3">
            {reportsData.icdUsage.map((item) => (
              <div key={item.code} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-[var(--ch-blue)]">{item.code}</p>
                    <p className="mt-1 text-sm text-[var(--ch-muted)]">{item.description}</p>
                  </div>
                  <p className="text-lg font-bold text-slate-900">{item.count}</p>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
