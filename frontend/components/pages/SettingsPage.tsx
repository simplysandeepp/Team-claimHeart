"use client";

import { useEffect, useState } from "react";
import { getCurrentUser, subscribeToCurrentUser } from "@/lib/api/auth";
import { getProfileCompletion, getProfilePromptCopy } from "@/lib/profileCompletion";
import ProfileCompletionRing from "@/components/profile/ProfileCompletionRing";
import ProfileCompletionForm from "@/components/profile/ProfileCompletionForm";
import type { AppUser } from "@/types";

export default function SettingsPage() {
  const [user, setUser] = useState<AppUser | null>(null);

  useEffect(() => {
    getCurrentUser().then(setUser);
    const unsubscribe = subscribeToCurrentUser(setUser);
    return unsubscribe;
  }, []);

  if (!user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ch-blue-dark)]">Profile</p>
          <h1 className="mt-3 text-2xl font-bold tracking-[-0.04em] text-slate-900">Loading your profile</h1>
          <p className="mt-2 text-sm text-slate-500">Pulling the latest saved details from your workspace.</p>
        </div>
      </div>
    );
  }

  const completion = getProfileCompletion(user);
  const copy = getProfilePromptCopy(user.role);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_45%,#f8fbff_100%)] p-6 shadow-[0_18px_44px_rgba(15,23,42,0.08)] sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ch-blue-dark)]">Profile & Verification</p>
            <h1 className="mt-3 text-3xl font-bold tracking-[-0.05em] text-slate-900 md:text-[2.2rem]">Manage your workspace identity</h1>
            <p className="mt-3 text-sm leading-6 text-[var(--ch-muted)] sm:text-[15px]">
              {copy.description} Everything you skip on first login can be completed here anytime without interrupting the rest of the product.
            </p>
            <p className="mt-4 text-sm font-medium text-slate-600">
              {completion.completedCount} of {completion.totalCount} role-specific details saved.
            </p>
          </div>

          {completion.percentage < 100 ? (
            <div className="rounded-[1.5rem] border border-[var(--ch-blue-border)] bg-white/92 p-4 shadow-[0_16px_34px_rgba(74,142,219,0.08)]">
              <ProfileCompletionRing
                percentage={completion.percentage}
                size={78}
                strokeWidth={6}
                trackClassName="stroke-slate-100"
                progressClassName="stroke-[var(--ch-blue)]"
                textClassName="text-slate-900"
              />
            </div>
          ) : null}
        </div>
      </section>

      <ProfileCompletionForm
        user={user}
        title={copy.title}
        description="Update the role-specific details below. Changes save to the same profile used by the sidebar completion ring and first-login prompt."
        submitLabel="Save changes"
        onSaved={setUser}
        variant="page"
      />
    </div>
  );
}
