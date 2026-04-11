"use client";

import { useState, type ReactNode } from "react";
import { Check, ChevronDown, CircleAlert, CircleX, Info, LoaderCircle } from "lucide-react";

type SemanticTone = "blue" | "green" | "red" | "amber" | "gray";

const toneClasses: Record<SemanticTone, { chip: string; soft: string; border: string; fill: string; glow: string; text: string; tint: string }> = {
  blue: {
    chip: "border-[var(--ch-blue-border)] bg-[var(--ch-blue-light)] text-[var(--ch-blue-dark)]",
    soft: "bg-[var(--ch-blue-light)] text-[var(--ch-blue-dark)]",
    border: "border-[var(--ch-blue)]",
    fill: "bg-[var(--ch-blue)]",
    glow: "shadow-[0_16px_36px_rgba(74,142,219,0.14)]",
    text: "text-[var(--ch-blue-dark)]",
    tint: "bg-[linear-gradient(180deg,#ffffff_0%,#eef6ff_100%)]",
  },
  green: {
    chip: "border-green-200 bg-green-50 text-green-700",
    soft: "bg-green-50 text-green-700",
    border: "border-green-500",
    fill: "bg-green-500",
    glow: "shadow-[0_16px_36px_rgba(34,197,94,0.12)]",
    text: "text-green-700",
    tint: "bg-[linear-gradient(180deg,#ffffff_0%,#f1fcf5_100%)]",
  },
  red: {
    chip: "border-red-200 bg-red-50 text-red-600",
    soft: "bg-red-50 text-red-600",
    border: "border-red-500",
    fill: "bg-red-500",
    glow: "shadow-[0_16px_36px_rgba(239,68,68,0.1)]",
    text: "text-red-600",
    tint: "bg-[linear-gradient(180deg,#ffffff_0%,#fff3f2_100%)]",
  },
  amber: {
    chip: "border-amber-200 bg-amber-50 text-amber-700",
    soft: "bg-amber-50 text-amber-700",
    border: "border-amber-500",
    fill: "bg-amber-500",
    glow: "shadow-[0_16px_36px_rgba(245,158,11,0.12)]",
    text: "text-amber-700",
    tint: "bg-[linear-gradient(180deg,#ffffff_0%,#fff7eb_100%)]",
  },
  gray: {
    chip: "border-slate-200 bg-slate-100 text-slate-600",
    soft: "bg-slate-100 text-slate-600",
    border: "border-slate-300",
    fill: "bg-slate-400",
    glow: "shadow-[0_12px_28px_rgba(148,163,184,0.12)]",
    text: "text-slate-600",
    tint: "bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]",
  },
};

export function DashboardCard({
  children,
  className = "",
  visual = "decorated",
  surfaceClassName = "bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)]",
}: {
  children: ReactNode;
  className?: string;
  visual?: "decorated" | "plain";
  surfaceClassName?: string;
}) {
  return (
    <section
      className={`relative overflow-hidden rounded-[22px] border border-slate-200/90 p-4 shadow-[0_18px_48px_rgba(15,23,42,0.08)] ring-1 ring-white/70 sm:p-5 ${surfaceClassName} ${className}`}
      style={{ borderWidth: "0.5px" }}
    >
      {visual === "decorated" ? (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-[linear-gradient(180deg,rgba(255,255,255,0.28),transparent)]" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-[linear-gradient(0deg,rgba(248,250,252,0.4),transparent)]" />
          <div className="pointer-events-none absolute right-0 top-0 h-20 w-20 rounded-full bg-white/30 blur-3xl" />
        </>
      ) : null}
      <div className="relative">{children}</div>
    </section>
  );
}

export function StatusChip({
  label,
  tone,
}: {
  label: string;
  tone: SemanticTone;
}) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${toneClasses[tone].chip}`}>
      {label}
    </span>
  );
}

export function DecisionBanner({
  backgroundClassName = "bg-[var(--ch-hero)]",
  amount,
  title,
  subtitle,
  detail,
  tone,
  timestamp,
  aside,
  actions,
}: {
  backgroundClassName?: string;
  amount: string;
  title: string;
  subtitle: string;
  detail: string;
  tone: SemanticTone;
  timestamp: string;
  aside?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className={`relative overflow-hidden rounded-[28px] ${backgroundClassName} px-4 py-5 text-white shadow-[0_28px_70px_rgba(10,22,40,0.24)] ring-1 ring-white/10 sm:px-5 sm:py-6`}>
      <div className="pointer-events-none absolute -right-10 top-0 h-28 w-28 rounded-full bg-white/8 blur-2xl" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-24 w-40 bg-[linear-gradient(90deg,rgba(74,142,219,0.25),transparent)]" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-48 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.14),transparent_58%)]" />
      <div className={`relative grid gap-5 ${aside || actions ? "xl:grid-cols-[minmax(0,1.08fr)_minmax(18rem,0.92fr)] xl:items-stretch" : ""}`}>
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/76">Decision summary</p>
          <p className="mt-3 text-[22px] font-medium tracking-[-0.04em] text-white sm:text-[28px]">{amount}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusChip label={title} tone={tone} />
            <span className="text-[11px] text-white/65">{timestamp}</span>
          </div>
          <p className="mt-3 text-[12px] text-white/72">{subtitle}</p>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-white">{detail}</p>
        </div>
        {aside || actions ? (
          <div className="flex h-full flex-col justify-between rounded-[24px] border border-white/12 bg-white/[0.08] p-4 backdrop-blur-sm">
            {aside ? <div>{aside}</div> : <div />}
            {actions ? <div className="mt-4 flex flex-wrap gap-2 xl:justify-end">{actions}</div> : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function PageHero({
  eyebrow,
  title,
  description,
  badges = [],
  actions,
  aside,
  backgroundClassName = "bg-[linear-gradient(135deg,#10233c_0%,#173f67_50%,#2b74b6_100%)]",
}: {
  eyebrow: string;
  title: string;
  description: string;
  badges?: string[];
  actions?: ReactNode;
  aside?: ReactNode;
  backgroundClassName?: string;
}) {
  return (
    <section className={`relative overflow-hidden rounded-[30px] ${backgroundClassName} px-5 py-6 text-white shadow-[0_30px_80px_rgba(9,21,40,0.24)] ring-1 ring-white/10 sm:px-6 sm:py-7`}>
      <div className="pointer-events-none absolute -left-16 top-0 h-40 w-40 rounded-full bg-white/8 blur-3xl" />
      <div className="pointer-events-none absolute -right-10 bottom-0 h-36 w-36 rounded-full bg-sky-300/15 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,rgba(255,255,255,0.08),transparent_38%,rgba(255,255,255,0.03)_72%,transparent)]" />
      <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/64">{eyebrow}</p>
          <h2 className="mt-3 text-[28px] font-semibold tracking-[-0.05em] text-white sm:text-[34px]">{title}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-white/80">{description}</p>
          {badges.length ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {badges.map((badge) => (
                <span key={badge} className="rounded-full border border-white/14 bg-white/10 px-3 py-1.5 text-[11px] font-medium text-white/88">
                  {badge}
                </span>
              ))}
            </div>
          ) : null}
          {actions ? <div className="mt-5 flex flex-wrap gap-2">{actions}</div> : null}
        </div>
        {aside ? <div className="w-full max-w-sm shrink-0">{aside}</div> : null}
      </div>
    </section>
  );
}

export function MetricCard({
  label,
  value,
  helper,
  tone = "blue",
  badge,
  className = "",
  valueClassName = "",
  helperClassName = "",
}: {
  label: string;
  value: string | number;
  helper: string;
  tone?: SemanticTone;
  badge?: string;
  className?: string;
  valueClassName?: string;
  helperClassName?: string;
}) {
  return (
    <DashboardCard className={`${toneClasses[tone].tint} ${className}`}>
      <div>
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 text-[11px] uppercase tracking-[0.16em] text-slate-500">{label}</p>
          {badge ? <StatusChip label={badge} tone={tone} /> : null}
        </div>
        <p className={`mt-3 break-words text-[18px] font-semibold leading-[1.22] tracking-[-0.04em] sm:text-[20px] ${toneClasses[tone].text} ${valueClassName}`}>{value}</p>
        <p className={`mt-3 rounded-[14px] border border-white/80 bg-white/72 px-3 py-2 text-[12px] leading-6 text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] ${helperClassName}`}>{helper}</p>
      </div>
    </DashboardCard>
  );
}

export function DecisionSupportCard({
  eyebrow,
  title,
  summary,
  tone = "blue",
  points = [],
  pointsClassName = "",
  contentClassName = "max-w-3xl",
  actions,
  footer,
  className = "",
}: {
  eyebrow: string;
  title: string;
  summary: string;
  tone?: SemanticTone;
  points?: { label: string; value: string; helper?: string }[];
  pointsClassName?: string;
  contentClassName?: string;
  actions?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <DashboardCard className={`${toneClasses[tone].tint} ${className}`}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className={contentClassName}>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{eyebrow}</p>
            <StatusChip label={title} tone={tone} />
          </div>
          <p className="mt-3 text-[22px] font-semibold tracking-[-0.04em] text-slate-900">{title}</p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{summary}</p>

          {points.length ? (
            <div className={`mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 ${pointsClassName}`}>
              {points.map((point) => (
                <div key={`${point.label}-${point.value}`} className="flex h-full flex-col rounded-[16px] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.92))] p-4 shadow-[0_12px_28px_rgba(15,23,42,0.06)]">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">{point.label}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{point.value}</p>
                  {point.helper ? <p className="mt-1 text-[12px] leading-5 text-slate-500">{point.helper}</p> : null}
                </div>
              ))}
            </div>
          ) : null}

          {footer ? <div className="mt-4">{footer}</div> : null}
        </div>

        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
    </DashboardCard>
  );
}

export function StepTracker({
  steps,
  activeIndex,
}: {
  steps: { label: string; state: "complete" | "active" | "upcoming" }[];
  activeIndex?: number;
}) {
  return (
    <DashboardCard>
      <div className="overflow-x-auto pb-1">
        <div className="flex min-w-max items-start gap-1 sm:min-w-0 sm:gap-2">
          {steps.map((step, index) => {
            const state = step.state ?? (activeIndex !== undefined ? (index < activeIndex ? "complete" : index === activeIndex ? "active" : "upcoming") : "upcoming");
            const lineComplete = activeIndex !== undefined ? index <= activeIndex : state === "complete";

            return (
              <div key={step.label} className="flex min-w-[122px] flex-1 items-start">
                <div className="flex flex-1 flex-col items-center">
                  <div className="flex w-full items-center">
                    {index > 0 ? <div className={`h-[2px] flex-1 ${lineComplete ? "bg-[var(--ch-blue)]" : "bg-slate-200"}`} /> : <div className="flex-1" />}
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full border text-[11px] font-semibold ${
                        state === "complete"
                          ? "border-[var(--ch-blue)] bg-[var(--ch-blue)] text-white shadow-[0_10px_20px_rgba(74,142,219,0.22)]"
                          : state === "active"
                            ? "border-[var(--ch-blue)] bg-white text-[var(--ch-blue)] ring-4 ring-[var(--ch-blue-light)]"
                            : "border-slate-200 bg-white text-slate-400"
                      }`}
                    >
                      {state === "complete" ? <Check className="h-4 w-4" /> : index + 1}
                    </div>
                    {index < steps.length - 1 ? <div className={`h-[2px] flex-1 ${state === "complete" ? "bg-[var(--ch-blue)]" : "bg-slate-200"}`} /> : <div className="flex-1" />}
                  </div>
                  <p className="mt-2 text-center text-[11px] font-medium leading-5 text-slate-600">{step.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </DashboardCard>
  );
}

export function ReasonCard({
  tone,
  title,
  description,
  icon,
  className = "",
}: {
  tone: "green" | "red" | "amber";
  title: string;
  description: string;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <DashboardCard className={`border-l-4 ${toneClasses[tone].border} ${toneClasses[tone].glow} ${className}`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-full ${toneClasses[tone].soft}`}>
          {icon ?? (tone === "green" ? <Check className="h-4 w-4" /> : tone === "red" ? <CircleX className="h-4 w-4" /> : <CircleAlert className="h-4 w-4" />)}
        </div>
        <div className="min-w-0">
          <p className="text-[14px] font-medium text-slate-900">{title}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        </div>
      </div>
    </DashboardCard>
  );
}

export function ConfidenceBar({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: SemanticTone;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="min-w-[78px] text-[12px] text-slate-600 sm:min-w-[88px]">{label}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${toneClasses[tone].fill}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
      <span className="min-w-[42px] text-right text-[12px] font-medium text-slate-700">{value}%</span>
    </div>
  );
}

export function EvidenceDrawer({
  buttonLabel,
  title,
  children,
  defaultOpen = false,
}: {
  buttonLabel: string;
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <DashboardCard className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div>
          <p className="text-[14px] font-medium text-slate-900">{buttonLabel}</p>
          <p className="mt-1 text-[12px] text-slate-500">{title}</p>
        </div>
        <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? <div className="mt-4 border-t border-slate-200 pt-4">{children}</div> : null}
    </DashboardCard>
  );
}

export function ActionPanel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`sticky bottom-0 rounded-[22px] border border-slate-200 bg-white/96 p-4 shadow-[0_-14px_36px_rgba(15,23,42,0.08)] ring-1 ring-white/70 backdrop-blur ${className}`}
      style={{ borderWidth: "0.5px" }}
    >
      {children}
    </div>
  );
}

export function DrawerEmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-[14px] border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
      {label}
    </div>
  );
}

export function LoadingChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--ch-blue-border)] bg-[var(--ch-blue-light)] px-2.5 py-1 text-[11px] font-semibold text-[var(--ch-blue-dark)]">
      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
      {label}
    </span>
  );
}

export function InfoNote({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-[14px] border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
      <p>{text}</p>
    </div>
  );
}
