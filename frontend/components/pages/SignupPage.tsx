"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { getDashboardPath, signupUser, type SignupPayload } from "@/lib/api/auth";
import AuthShowcase from "@/components/pages/AuthShowcase";
import { AUTH_ROLE_META } from "@/components/pages/authMeta";
import ClaimHeartLogo from "@/components/ui/ClaimHeartLogo";
import type { UserRole } from "@/types";
import { toast } from "sonner";

type SignupFormState = {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
};

type StepConfig = {
  title: string;
  description: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\+?[0-9]{10,15}$/;

const initialFormState: SignupFormState = {
  fullName: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
};

const stepMeta: Record<UserRole, StepConfig> = {
  patient: {
    title: "Personal Authentication",
    description: "Create the patient account with secure login details.",
  },
  hospital: {
    title: "Administrator Authentication",
    description: "Create the account for the authorized hospital official.",
  },
  insurer: {
    title: "Administrator Authentication",
    description: "Create the insurance admin login for the organization.",
  },
};

export default function SignupPage() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole>("patient");
  const [form, setForm] = useState<SignupFormState>(initialFormState);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeStep = stepMeta[role];

  useEffect(() => {
    router.prefetch(getDashboardPath(role));
  }, [role, router]);

  const updateField = <T extends keyof SignupFormState>(key: T, value: SignupFormState[T]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleRoleChange = (nextRole: UserRole) => {
    setRole(nextRole);
  };

  const validateSignupForm = () => {
    if (!form.fullName.trim()) {
      toast.error("Enter your full name.");
      return false;
    }
    if (form.fullName.trim().length < 2) {
      toast.error("Full name must be at least 2 characters.");
      return false;
    }
    if (!emailPattern.test(form.email.trim())) {
      toast.error("Enter a valid email address.");
      return false;
    }
    if (!phonePattern.test(form.phone.trim())) {
      toast.error("Enter a valid phone number.");
      return false;
    }
    if (form.password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return false;
    }
    if (!/[A-Za-z]/.test(form.password) || !/[0-9]/.test(form.password)) {
      toast.error("Password must include at least one letter and one number.");
      return false;
    }
    if (form.password !== form.confirmPassword) {
      toast.error("Password and confirm password must match.");
      return false;
    }
    return true;
  };

  const buildSignupPayload = (): Omit<SignupPayload, "password"> => {
    return {
      name: form.fullName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      role,
    };
  };

  const handleSignup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validateSignupForm()) return;

    setIsSubmitting(true);

    try {
      const user = await signupUser({
        ...buildSignupPayload(),
        password: form.password,
      });

      toast.success(`${AUTH_ROLE_META[user.role].label} account created successfully.`);
      router.push(getDashboardPath(user.role));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create the account right now.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,#deedf8_0%,#f4f7fb_40%,#eef2f7_100%)] p-3 sm:p-4 xl:h-[100dvh] xl:overflow-hidden">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-7xl xl:h-full">
        <div className="grid w-full overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/90 shadow-[0_24px_64px_rgba(15,23,42,0.13)] backdrop-blur xl:h-full xl:grid-cols-[0.96fr_1.04fr]">
          <div className="order-1 flex bg-white/98 px-5 py-5 sm:px-7 xl:h-full xl:min-h-0 xl:overflow-hidden">
            <div className="mx-auto flex w-full max-w-xl flex-col justify-center xl:h-full xl:min-h-0">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/90 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-1 shadow-sm">
                  <ClaimHeartLogo className="h-full w-full" imageClassName="scale-110" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--ch-blue-dark)]">
                    ClaimHeart Signup
                  </p>
                  <h2 className="text-[1.55rem] font-bold tracking-[-0.04em] text-slate-900 sm:text-[1.75rem]">
                    Create account
                  </h2>
                </div>
              </div>

              <div className="mt-2 rounded-[1.5rem] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)] sm:p-5 xl:flex xl:min-h-0 xl:flex-col">
                <div className="rounded-[1.2rem] border border-slate-200 bg-white px-3.5 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Email and password registration
                </div>

                <form onSubmit={handleSignup} className="mt-2 space-y-2.5 xl:flex-1">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ch-blue-dark)]">
                      {activeStep.title}
                    </p>
                    <p className="mt-1 text-[13px] leading-5 text-[var(--ch-muted)]">
                      {activeStep.description}
                    </p>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3">
                    {(["patient", "hospital", "insurer"] as UserRole[]).map((option) => {
                      const optionMeta = AUTH_ROLE_META[option];
                      const OptionIcon = optionMeta.icon;
                      const active = role === option;

                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => handleRoleChange(option)}
                          className={`rounded-[0.9rem] border px-2.5 py-2.5 text-left transition-all ${
                            active
                              ? "border-[var(--ch-blue)] bg-[linear-gradient(180deg,rgba(74,142,219,0.12),rgba(255,255,255,0.96))] shadow-[0_12px_22px_rgba(74,142,219,0.14)]"
                              : "border-slate-200 bg-slate-50 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                                active
                                  ? "border-[var(--ch-blue)] bg-[var(--ch-blue)] text-white"
                                  : "border-slate-200 bg-white text-[var(--ch-blue)]"
                              }`}
                            >
                              <OptionIcon className="h-3.5 w-3.5" />
                            </div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ch-blue-dark)]">
                              {optionMeta.label}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <InputField
                    id="signup-full-name"
                    label="Full Name"
                    value={form.fullName}
                    onChange={(value) => updateField("fullName", value)}
                    placeholder="Enter full name"
                    autoComplete="name"
                  />
                  <InputField
                    id="signup-email"
                    label={role === "patient" ? "Email Address" : "Email Address"}
                    value={form.email}
                    onChange={(value) => updateField("email", value)}
                    placeholder="Enter email address"
                    type="email"
                    autoComplete="email"
                  />
                  <InputField
                    id="signup-phone"
                    label={role === "patient" ? "Phone Number" : "Phone Number"}
                    value={form.phone}
                    onChange={(value) => updateField("phone", value)}
                    placeholder="Enter phone number"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                  />
                  <PasswordField
                    id="signup-password"
                    label="Password"
                    value={form.password}
                    onChange={(value) => updateField("password", value)}
                    show={showPassword}
                    onToggle={() => setShowPassword((current) => !current)}
                    placeholder="Enter password"
                    autoComplete="new-password"
                  />
                  <PasswordField
                    id="signup-confirm-password"
                    label="Confirm Password"
                    value={form.confirmPassword}
                    onChange={(value) => updateField("confirmPassword", value)}
                    show={showConfirmPassword}
                    onToggle={() => setShowConfirmPassword((current) => !current)}
                    placeholder="Re-enter password"
                    autoComplete="new-password"
                  />

                  <div className="flex items-center justify-between gap-3 pt-1">
                    <div />

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[var(--ch-blue)] px-5 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(74,142,219,0.18)] transition-all hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      {isSubmitting ? "Creating..." : "Create account"}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>

                  <p className="text-center text-sm text-[var(--ch-muted)]">
                    Already have access?{" "}
                    <Link href="/auth/login" className="font-semibold text-[var(--ch-blue)]">
                      Log in
                    </Link>
                  </p>
                </form>
              </div>
            </div>
          </div>

          <AuthShowcase
            mode="signup"
            role={role}
            className="order-2 min-h-[20rem] border-t border-slate-200/70 xl:min-h-0 xl:border-l xl:border-l-white/10 xl:border-t-0"
          />
        </div>
      </div>
    </div>
  );
}

function InputField({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  inputMode,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-slate-800">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-10 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition-all focus:border-[var(--ch-blue)] focus:shadow-[0_0_0_4px_rgba(74,142,219,0.12)]"
        placeholder={placeholder}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
      />
    </div>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  show,
  onToggle,
  placeholder,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  onToggle: () => void;
  placeholder: string;
  autoComplete?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-slate-800">
        {label}
      </label>
      <div className="relative mt-1">
        <input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-4 pr-12 text-sm outline-none transition-all focus:border-[var(--ch-blue)] focus:shadow-[0_0_0_4px_rgba(74,142,219,0.12)]"
          placeholder={placeholder}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute inset-y-0 right-0 inline-flex w-12 items-center justify-center text-slate-500 transition-colors hover:text-slate-800"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
        </button>
      </div>
    </div>
  );
}
