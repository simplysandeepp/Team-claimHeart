import Link from "next/link";
import { fraudAlerts, fraudScatterData } from "@/lib/data";

export default function FraudAlertsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-[-0.04em] text-slate-900 md:text-[2.1rem]">Fraud Alerts</h1>
        <p className="mt-2 text-base text-[var(--ch-muted)] md:text-lg">Real-time anomaly detection powered by hybrid AI reasoning</p>
      </div>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <h2 className="text-2xl font-bold text-slate-900 md:text-[1.7rem]">Fraud Score vs Claim Amount</h2>
          <p className="mt-1 text-lg text-[var(--ch-subtle)]">High-score claims require immediate review</p>
          <div className="mt-8 grid gap-3 md:grid-cols-2">
            {fraudScatterData.slice(0, 8).map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-900">{item.id}</p>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${item.fraudScore >= 0.8 ? "bg-red-50 text-red-500" : item.fraudScore >= 0.5 ? "bg-amber-50 text-amber-500" : "bg-green-50 text-green-600"}`}>{item.type}</span>
                </div>
                <p className="mt-3 text-sm text-[var(--ch-muted)]">Amount: Rs {item.claimAmount.toLocaleString("en-IN")}</p>
                <div className="mt-3 h-2 rounded-full bg-slate-200">
                  <div className={`h-2 rounded-full ${item.fraudScore >= 0.8 ? "bg-red-500" : item.fraudScore >= 0.5 ? "bg-amber-500" : "bg-green-500"}`} style={{ width: `${item.fraudScore * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <h2 className="text-2xl font-bold text-slate-900 md:text-[1.7rem]">Active Alert Feed</h2>
          <div className="mt-6 space-y-3">
            {fraudAlerts.map((alert) => (
              <div key={alert.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{alert.id}</p>
                    <p className="mt-1 text-sm text-[var(--ch-muted)]">{alert.type}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${alert.severity === "critical" ? "bg-red-50 text-red-500" : alert.severity === "high" ? "bg-amber-50 text-amber-500" : "bg-[var(--ch-blue-light)] text-[var(--ch-blue)]"}`}>{alert.severity}</span>
                </div>
                <p className="mt-3 text-sm text-slate-700">{alert.patient} - {alert.provider}</p>
                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="text-[var(--ch-muted)]">Score {alert.score}</span>
                  <Link href={`/claims/${alert.claimId}`} className="font-semibold text-[var(--ch-blue)]">Open Claim</Link>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
