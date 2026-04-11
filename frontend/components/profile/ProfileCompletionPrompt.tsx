"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { getProfileCompletion, getProfilePromptCopy } from "@/lib/profileCompletion";
import type { AppUser } from "@/types";
import ProfileCompletionForm from "@/components/profile/ProfileCompletionForm";

type ProfileCompletionPromptProps = {
  user: AppUser;
  open: boolean;
  onClose: () => void;
  onSaved: (user: AppUser) => void;
};

export default function ProfileCompletionPrompt({ user, open, onClose, onSaved }: ProfileCompletionPromptProps) {
  const completion = getProfileCompletion(user);
  const copy = getProfilePromptCopy(user.role);

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[120] bg-slate-950/45 backdrop-blur-[2px]"
            aria-label="Close profile completion prompt"
          />

          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="fixed inset-x-3 top-3 z-[130] max-h-[calc(100vh-1.5rem)] overflow-y-auto rounded-[2rem] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-3 shadow-[0_30px_90px_rgba(15,23,42,0.24)] sm:inset-x-6 sm:top-6 sm:p-4 lg:left-[max(7rem,calc(50%-36rem))] lg:right-auto lg:w-[min(72rem,calc(100vw-8rem))]"
          >
            <div className="flex items-start justify-between gap-4 px-2 py-2 sm:px-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ch-blue-dark)]">Finish now or later</p>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ch-muted)]">
                  You can skip this setup for now and come back from Profile anytime. Current completion: {completion.percentage}%.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition-all hover:bg-slate-50"
                aria-label="Dismiss prompt"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <ProfileCompletionForm
              user={user}
              title={copy.title}
              description={copy.description}
              submitLabel="Save and continue"
              showSkip
              onSkip={onClose}
              onSaved={(nextUser) => {
                onSaved(nextUser);
                onClose();
              }}
              variant="modal"
            />
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
