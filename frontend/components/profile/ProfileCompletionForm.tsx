"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Building2, CheckCircle2, FileBadge2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { updateCurrentUserProfile, type ProfileUpdatePayload } from "@/lib/api/auth";
import { getProfileCompletion, getProfileRequirements, getSignupCollectedFields, type ProfileRequirement } from "@/lib/profileCompletion";
import type { AppUser } from "@/types";

type ProfileCompletionFormProps = {
  user: AppUser;
  title: string;
  description: string;
  submitLabel?: string;
  showSkip?: boolean;
  onSkip?: () => void;
  onSaved?: (user: AppUser) => void;
  variant?: "modal" | "page";
};

type FormState = Partial<Record<ProfileRequirement["key"], string>>;

const npiPattern = /^\d{10}$/;
const gstPattern = /^[0-9A-Z]{15}$/i;
const panPattern = /^[A-Z]{5}[0-9]{4}[A-Z]$/i;

const createFormState = (user: AppUser, requirements: ProfileRequirement[]): FormState =>
  Object.fromEntries(
    requirements.map((field) => [field.key, typeof user[field.key] === "string" ? user[field.key] : ""]),
  ) as FormState;

const getRoleIcon = (role: AppUser["role"]) => {
  if (role === "hospital") {
    return Building2;
  }

  if (role === "insurer") {
    return ShieldCheck;
  }

  return FileBadge2;
};

const buildDraftUser = (user: AppUser, requirements: ProfileRequirement[], form: FormState) => {
  const draft = { ...user } as AppUser;

  requirements.forEach((field) => {
    const nextValue = (form[field.key] ?? "").trim();
    draft[field.key] = (nextValue || undefined) as AppUser[typeof field.key];
  });

  return draft;
};

const validateField = (field: ProfileRequirement, value: string, form: FormState) => {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return `Enter ${field.label.toLowerCase()}.`;
  }

  if (field.key === "npi" && !npiPattern.test(normalizedValue)) {
    return "Enter a valid 10-digit NPI number.";
  }

  if (field.key === "gstNumber" && !gstPattern.test(normalizedValue)) {
    return "Enter a valid 15-character GST number.";
  }

  if (field.key === "panNumber" && !panPattern.test(normalizedValue)) {
    return "Enter a valid PAN number.";
  }

  if (field.key === "policyEndDate") {
    const startDate = form.policyStartDate?.trim();
    if (startDate && normalizedValue < startDate) {
      return "Policy end date must be after the start date.";
    }
  }

  return null;
};

const getRoleDetailHeading = (role: AppUser["role"]) => {
  if (role === "hospital") {
    return "Hospital verification details";
  }

  if (role === "insurer") {
    return "Insurer compliance details";
  }

  return "Patient policy details";
};

export default function ProfileCompletionForm({
  user,
  title,
  description,
  submitLabel = "Save profile",
  showSkip = false,
  onSkip,
  onSaved,
  variant = "page",
}: ProfileCompletionFormProps) {
  const requirements = useMemo(() => getProfileRequirements(user.role), [user.role]);
  const [form, setForm] = useState<FormState>(() => createFormState(user, requirements));
  const [isSaving, setIsSaving] = useState(false);
  const RoleIcon = getRoleIcon(user.role);

  useEffect(() => {
    setForm(createFormState(user, requirements));
  }, [requirements, user]);

  const signupFields = useMemo(() => getSignupCollectedFields(user), [user]);
  const draftUser = useMemo(() => buildDraftUser(user, requirements, form), [form, requirements, user]);
  const completion = useMemo(() => getProfileCompletion(draftUser), [draftUser]);

  const setField = (key: ProfileRequirement["key"], value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async () => {
    for (const field of requirements) {
      const error = validateField(field, form[field.key] ?? "", form);
      if (error) {
        toast.error(error);
        return;
      }
    }

    setIsSaving(true);

    try {
      const payload = requirements.reduce<ProfileUpdatePayload>((current, field) => {
        current[field.key] = (form[field.key] ?? "").trim() as never;
        return current;
      }, {});

      const nextUser = await updateCurrentUserProfile(payload);
      toast.success("Profile details saved.");
      onSaved?.(nextUser);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save profile details right now.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={`grid gap-5 ${variant === "page" ? "xl:grid-cols-[minmax(0,1fr)_22rem]" : ""}`}>
      <div className="rounded-[1.9rem] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-5 shadow-[0_18px_44px_rgba(15,23,42,0.08)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--ch-blue-border)] bg-[var(--ch-blue-light)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ch-blue-dark)]">
              <RoleIcon className="h-3.5 w-3.5" />
              {user.role} profile setup
            </div>
            <h2 className="mt-3 text-[1.7rem] font-bold tracking-[-0.04em] text-slate-900">{title}</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--ch-muted)] sm:text-[15px]">{description}</p>
          </div>

          {variant === "modal" ? (
            <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-[0_12px_24px_rgba(15,23,42,0.05)]">
              {completion.completedCount}/{completion.totalCount} complete
            </div>
          ) : null}
        </div>

        <div className="mt-6 rounded-[1.5rem] border border-slate-200/80 bg-white/90 p-4 shadow-[0_12px_24px_rgba(15,23,42,0.04)]">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[var(--ch-blue)]" />
            <p className="text-sm font-semibold text-slate-900">Already captured during signup</p>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            These basics stay linked to your account, so this step only asks for the extra details needed for your role.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {signupFields.map((field) => (
              <div key={field.label} className="rounded-[1.15rem] border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{field.label}</p>
                <p className="mt-1 truncate text-sm font-medium text-slate-900">{field.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 rounded-[1.5rem] border border-slate-200/80 bg-white/95 p-4 shadow-[0_12px_24px_rgba(15,23,42,0.04)] sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ch-blue-dark)]">Role-specific details</p>
              <h3 className="mt-2 text-[1.2rem] font-semibold tracking-[-0.03em] text-slate-900">{getRoleDetailHeading(user.role)}</h3>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Fill these now for a more complete dashboard experience, or skip and finish them later from Profile.
              </p>
            </div>
            {showSkip ? (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-500">
                Optional right now
              </span>
            ) : null}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {requirements.map((field) => {
              const value = form[field.key] ?? "";
              const sharedClassName =
                "mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-[var(--ch-blue)] focus:shadow-[0_0_0_4px_rgba(74,142,219,0.12)]";

              return (
                <div key={field.key} className={field.type === "textarea" ? "sm:col-span-2" : ""}>
                  <label htmlFor={`profile-${field.key}`} className="text-sm font-semibold text-slate-800">
                    {field.label}
                  </label>

                  {field.type === "textarea" ? (
                    <textarea
                      id={`profile-${field.key}`}
                      value={value}
                      onChange={(event) => setField(field.key, event.target.value)}
                      placeholder={field.placeholder}
                      autoComplete={field.autoComplete}
                      rows={4}
                      className={`${sharedClassName} min-h-[110px] py-3`}
                    />
                  ) : field.type === "select" ? (
                    <select
                      id={`profile-${field.key}`}
                      value={value}
                      onChange={(event) => setField(field.key, event.target.value)}
                      className={`${sharedClassName} h-12 py-2.5`}
                    >
                      <option value="">{field.placeholder}</option>
                      {field.options?.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={`profile-${field.key}`}
                      value={value}
                      onChange={(event) => setField(field.key, event.target.value)}
                      placeholder={field.placeholder}
                      type={field.type ?? "text"}
                      autoComplete={field.autoComplete}
                      className={`${sharedClassName} h-12 py-2.5`}
                    />
                  )}

                  <p className="mt-1.5 text-xs leading-5 text-slate-500">{field.description}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
          {showSkip ? (
            <button
              type="button"
              onClick={onSkip}
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition-all hover:bg-slate-50"
            >
              Skip for now
            </button>
          ) : null}

          <button
            type="button"
            disabled={isSaving}
            onClick={() => {
              void handleSubmit();
            }}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[var(--ch-blue)] px-5 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(74,142,219,0.18)] transition-all hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {isSaving ? "Saving..." : submitLabel}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {variant === "page" ? (
        <div className="space-y-4">
          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-[0_16px_34px_rgba(15,23,42,0.06)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Profile status</p>
            <p className="mt-3 text-lg font-semibold tracking-[-0.03em] text-slate-900">
              {completion.completedCount} of {completion.totalCount} role-specific details added
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              {completion.missingRequirements.length
                ? "Finish the remaining items below whenever you are ready."
                : "Everything needed for this role is already in place."}
            </p>

            <div className="mt-4 space-y-3">
              {completion.missingRequirements.length ? (
                completion.missingRequirements.map((field) => (
                  <div key={field.key} className="rounded-[1rem] border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">{field.label}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{field.description}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  Your profile setup is complete for this role.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
