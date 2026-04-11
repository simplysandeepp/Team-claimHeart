"use client";

import { useState } from "react";

export default function SettingsPage() {
  const [autoApprove, setAutoApprove] = useState(true);
  const [fraudReview, setFraudReview] = useState(true);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [piiRedaction, setPiiRedaction] = useState(true);

  const settings = [
    ["Auto-approve low-risk claims", autoApprove, setAutoApprove],
    ["Escalate high fraud scores", fraudReview, setFraudReview],
    ["Email alerts for critical flags", emailAlerts, setEmailAlerts],
    ["PII redaction before external models", piiRedaction, setPiiRedaction],
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-[-0.04em] text-slate-900 md:text-[2.1rem]">Settings</h1>
        <p className="mt-2 text-base text-[var(--ch-muted)] md:text-lg">Configure ClaimHeart AI agents, notifications, and compliance settings</p>
      </div>

      <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <h2 className="text-2xl font-bold text-slate-900 md:text-[1.7rem]">Platform Controls</h2>
        <div className="mt-6 space-y-4">
          {settings.map(([label, value, setter]) => (
            <div key={label} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="font-medium text-slate-800">{label}</p>
              <button onClick={() => setter(!value)} className={`rounded-full px-4 py-2 text-sm font-semibold ${value ? "bg-[var(--ch-blue)] text-white" : "bg-white text-slate-600 border border-slate-200"}`}>
                {value ? "Enabled" : "Disabled"}
              </button>
            </div>
          ))}
        </div>
      </article>
    </div>
  );
}
