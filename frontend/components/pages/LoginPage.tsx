"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { getDashboardPath, loginUser } from "@/lib/api/auth";
import AuthShowcase from "@/components/pages/AuthShowcase";
import { AUTH_ROLE_META } from "@/components/pages/authMeta";
import ClaimHeartLogo from "@/components/ui/ClaimHeartLogo";
import type { UserRole } from "@/types";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole>("insurer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    router.prefetch(getDashboardPath(role));
  }, [role, router]);

  const handleRole = (nextRole: UserRole) => {
    setRole(nextRole);
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email.trim() || !password.trim()) {
      toast.error("Enter your email address and password.");
      return;
    }

    setIsSubmitting(true);

    try {
      const user = await loginUser(email, password, role);
      toast.success(`Welcome back to the ${AUTH_ROLE_META[user.role].label.toLowerCase()} workspace.`);
      router.push(getDashboardPath(user.role));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to sign in right now.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#eaf3fb_0%,#f8fafc_42%,#f1f5f9_100%)] p-3 sm:p-4">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-7xl xl:min-h-[calc(100dvh-2rem)]">
        <div className="grid w-full overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/80 shadow-[0_30px_80px_rgba(15,23,42,0.12)] backdrop-blur xl:min-h-full xl:grid-cols-[1.02fr_0.98fr]">
          <div className="order-1 flex bg-white/96 px-5 py-5 sm:px-7 lg:px-8 xl:order-2 xl:min-h-0 xl:overflow-y-auto">
            <div className="mx-auto flex w-full max-w-lg flex-col py-1 sm:py-3 xl:justify-start">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--ch-blue-border)] bg-[var(--ch-blue-light)] p-1">
                  <ClaimHeartLogo className="h-full w-full" imageClassName="scale-110" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ch-blue-dark)]">Sign in to your account to continue your journey</p>
                  <h2 className="text-[1.8rem] font-bold tracking-[-0.05em] text-slate-900 sm:text-[2rem]">Welcome back to ClaimHeart!</h2>
                </div>
              </div>

              <div className="mt-4 rounded-[1.6rem] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)] sm:p-5">
                <div className="rounded-[1.2rem] border border-slate-200 bg-white px-3.5 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Email and password login
                </div>

                <form onSubmit={handleLogin} className="mt-5 space-y-4">
                  <div className="grid gap-2.5 sm:grid-cols-3">
                    {(["patient", "hospital", "insurer"] as UserRole[]).map((option) => {
                      const optionMeta = AUTH_ROLE_META[option];
                      const OptionIcon = optionMeta.icon;
                      const active = role === option;

                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => handleRole(option)}
                          className={`rounded-[1rem] border p-3 text-left transition-all ${
                            active
                              ? "border-[var(--ch-blue)] bg-[linear-gradient(180deg,rgba(74,142,219,0.12),rgba(255,255,255,0.96))] shadow-[0_12px_22px_rgba(74,142,219,0.14)]"
                              : "border-slate-200 bg-slate-50 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${active ? "border-[var(--ch-blue)] bg-[var(--ch-blue)] text-white" : "border-slate-200 bg-white text-[var(--ch-blue)]"}`}>
                              <OptionIcon className="h-4 w-4" />
                            </div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ch-blue-dark)]">{optionMeta.label}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div>
                    <label htmlFor="login-email" className="text-sm font-semibold text-slate-800">Email address</label>
                    <input
                      id="login-email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="mt-1.5 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition-all focus:border-[var(--ch-blue)] focus:shadow-[0_0_0_4px_rgba(74,142,219,0.12)]"
                      placeholder="name@claimheart.ai"
                      autoComplete="email"
                    />
                  </div>

                  <div>
                    <label htmlFor="login-password" className="text-sm font-semibold text-slate-800">Password</label>
                    <div className="relative mt-1.5">
                      <input
                        id="login-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 pr-14 text-sm outline-none transition-all focus:border-[var(--ch-blue)] focus:shadow-[0_0_0_4px_rgba(74,142,219,0.12)]"
                        placeholder="Enter your password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((current) => !current)}
                        className="absolute inset-y-0 right-0 inline-flex w-12 items-center justify-center text-slate-500 transition-colors hover:text-slate-800"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--ch-blue)] px-4 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(74,142,219,0.18)] transition-all hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    {isSubmitting ? "Signing in..." : "Sign in"}
                    <ArrowRight className="h-4 w-4" />
                  </button>

                  <p className="text-center text-sm text-[var(--ch-muted)]">
                    New here?{" "}
                    <Link href="/auth/signup" className="font-semibold text-[var(--ch-blue)]">
                      Create account
                    </Link>
                  </p>
                </form>
              </div>
            </div>
          </div>

          <AuthShowcase mode="login" role={role} className="order-2 min-h-[20rem] border-t border-slate-200/70 xl:order-1 xl:min-h-0 xl:border-r xl:border-r-white/10 xl:border-t-0" />
        </div>
      </div>
    </div>
  );
}
