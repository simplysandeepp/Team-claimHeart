"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { getDashboardPath, signupUser, signupWithGoogle, type SignupPayload } from "@/lib/api/auth";
import AuthProviderButtons, {
  AUTH_PROVIDER_LABELS,
  type AuthProvider,
} from "@/components/pages/AuthProviderButtons";
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
  patientPolicyNumber: string;
  patientDob: string;
  patientProviderName: string;
  hospitalName: string;
  hospitalLicenseNumber: string;
  hospitalNpi: string;
  hospitalCity: string;
  hospitalState: string;
  insurerCompanyName: string;
  insurerLicenseNumber: string;
  insurerTaxId: string;
  insurerCity: string;
  insurerState: string;
};

type StepConfig = {
  title: string;
  description: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\+?[0-9]{10,15}$/;
const alphaNumericPattern = /^[A-Za-z0-9-]+$/;
const cityStatePattern = /^[A-Za-z .'-]{2,}$/;
const npiPattern = /^[0-9]{10}$/;
const panEinPattern = /^[A-Za-z0-9]{8,15}$/;

const initialFormState: SignupFormState = {
  fullName: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
  patientPolicyNumber: "",
  patientDob: "",
  patientProviderName: "",
  hospitalName: "",
  hospitalLicenseNumber: "",
  hospitalNpi: "",
  hospitalCity: "",
  hospitalState: "",
  insurerCompanyName: "",
  insurerLicenseNumber: "",
  insurerTaxId: "",
  insurerCity: "",
  insurerState: "",
};

const stepMeta: Record<UserRole, StepConfig[]> = {
  patient: [
    {
      title: "Personal Authentication",
      description: "Create the patient account with secure login details.",
    },
    {
      title: "Insurance & Identity Context",
      description: "Capture the minimum identity and coverage context needed to start.",
    },
  ],
  hospital: [
    {
      title: "Administrator Authentication",
      description: "Create the account for the authorized hospital official.",
    },
    {
      title: "Institutional Identifiers & Context",
      description: "Add the hospital identity fields needed for verification and routing.",
    },
  ],
  insurer: [
    {
      title: "Administrator Authentication",
      description: "Create the insurance admin login for the organization.",
    },
    {
      title: "Institutional Identifiers",
      description: "Add the minimum regulatory and regional company details.",
    },
  ],
};

export default function SignupPage() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole>("patient");
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<SignupFormState>(initialFormState);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  const activeStep = useMemo(() => stepMeta[role][stepIndex], [role, stepIndex]);

  useEffect(() => {
    router.prefetch(getDashboardPath(role));
  }, [role, router]);

  const updateField = <T extends keyof SignupFormState>(key: T, value: SignupFormState[T]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleRoleChange = (nextRole: UserRole) => {
    setRole(nextRole);
    setStepIndex(0);
  };

  const validateStepOne = () => {
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

  const validatePatientStep = () => {
    if (!form.patientPolicyNumber.trim()) {
      toast.error("Enter the insurance policy number.");
      return false;
    }
    if (!alphaNumericPattern.test(form.patientPolicyNumber.trim())) {
      toast.error("Policy number must be alphanumeric.");
      return false;
    }
    if (!form.patientDob) {
      toast.error("Enter date of birth.");
      return false;
    }
    if (new Date(form.patientDob) > new Date()) {
      toast.error("Date of birth cannot be in the future.");
      return false;
    }
    if (!form.patientProviderName.trim()) {
      toast.error("Enter the provider name.");
      return false;
    }
    return true;
  };

  const validateHospitalStep = () => {
    if (!form.hospitalName.trim()) {
      toast.error("Enter the hospital or clinic name.");
      return false;
    }
    if (!form.hospitalLicenseNumber.trim()) {
      toast.error("Enter the medical provider license number.");
      return false;
    }
    if (!alphaNumericPattern.test(form.hospitalLicenseNumber.trim())) {
      toast.error("Medical provider license number must be alphanumeric.");
      return false;
    }
    if (!npiPattern.test(form.hospitalNpi.trim())) {
      toast.error("NPI must be a 10-digit number.");
      return false;
    }
    if (!cityStatePattern.test(form.hospitalCity.trim())) {
      toast.error("Enter a valid city.");
      return false;
    }
    if (!cityStatePattern.test(form.hospitalState.trim())) {
      toast.error("Enter a valid state.");
      return false;
    }
    return true;
  };

  const validateInsurerStep = () => {
    if (!form.insurerCompanyName.trim()) {
      toast.error("Enter the official company name.");
      return false;
    }
    if (!form.insurerLicenseNumber.trim()) {
      toast.error("Enter the regulatory license number.");
      return false;
    }
    if (!alphaNumericPattern.test(form.insurerLicenseNumber.trim())) {
      toast.error("Regulatory license number must be alphanumeric.");
      return false;
    }
    if (!panEinPattern.test(form.insurerTaxId.trim())) {
      toast.error("Enter a valid PAN or EIN.");
      return false;
    }
    if (!cityStatePattern.test(form.insurerCity.trim())) {
      toast.error("Enter a valid city.");
      return false;
    }
    if (!cityStatePattern.test(form.insurerState.trim())) {
      toast.error("Enter a valid state.");
      return false;
    }
    return true;
  };

  const validateCurrentStep = () => {
    if (stepIndex === 0) return validateStepOne();
    if (role === "patient") return validatePatientStep();
    if (role === "hospital") return validateHospitalStep();
    return validateInsurerStep();
  };

  const handleNext = () => {
    if (!validateCurrentStep()) return;
    setStepIndex(1);
  };

  const buildSignupPayload = (): Omit<SignupPayload, "password"> => {
    if (role === "patient") {
      return {
        name: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        role,
        policyNumber: form.patientPolicyNumber.trim(),
        dob: form.patientDob,
        insuranceCompany: form.patientProviderName.trim(),
      };
    }

    if (role === "hospital") {
      return {
        name: form.hospitalName.trim() || form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        role,
        contactName: form.fullName.trim(),
        hospitalRegNo: form.hospitalLicenseNumber.trim(),
        npi: form.hospitalNpi.trim(),
        city: form.hospitalCity.trim(),
        state: form.hospitalState.trim(),
      };
    }

    return {
      name: form.insurerCompanyName.trim() || form.fullName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      role,
      contactName: form.fullName.trim(),
      organizationCode: form.insurerLicenseNumber.trim(),
      taxId: form.insurerTaxId.trim(),
      city: form.insurerCity.trim(),
      state: form.insurerState.trim(),
    };
  };

  const handleSocialSignup = async (provider: AuthProvider) => {
    if (provider !== "google") {
      toast.info(`${AUTH_PROVIDER_LABELS[provider]} signup is not wired in this build yet.`);
      return;
    }

    if (isGoogleSubmitting || isSubmitting) {
      return;
    }

    setIsGoogleSubmitting(true);

    try {
      const user = await signupWithGoogle(buildSignupPayload());
      toast.success(`${AUTH_ROLE_META[user.role].label} account is ready. You can complete more workspace details later in Settings.`);
      router.push(getDashboardPath(user.role));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create the account with Google right now.");
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  const handleSignup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (stepIndex === 0) {
      handleNext();
      return;
    }

    if (!validateCurrentStep()) return;

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
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--ch-blue-border)] bg-[var(--ch-blue-light)] p-1">
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

              <div className="mt-3 rounded-[1.5rem] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)] sm:p-5 xl:flex xl:min-h-0 xl:flex-col">
                {stepIndex === 0 ? (
                  <div className="space-y-2.5">
                    <AuthProviderButtons
                      mode="signup"
                      onSelect={(provider) => {
                        void handleSocialSignup(provider);
                      }}
                      providers={["google"]}
                      variant="full"
                      showLabel={false}
                    />
                    <div className="flex items-center gap-3">
                      <div className="h-px flex-1 bg-slate-200" />
                      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        or sign up with email
                      </span>
                      <div className="h-px flex-1 bg-slate-200" />
                    </div>
                  </div>
                ) : null}

                <form onSubmit={handleSignup} className="mt-3 space-y-3 xl:flex-1">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ch-blue-dark)]">
                      {activeStep.title}
                    </p>
                    <p className="mt-1 text-[13px] leading-5 text-[var(--ch-muted)]">
                      {activeStep.description}
                    </p>
                  </div>

                  {stepIndex === 0 ? (
                    <>
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
                        label={role === "patient" ? "Personal Email Address" : "Official Email Address"}
                        value={form.email}
                        onChange={(value) => updateField("email", value)}
                        placeholder="Enter email address"
                        type="email"
                        autoComplete="email"
                      />
                      <InputField
                        id="signup-phone"
                        label={role === "patient" ? "Phone Number" : "Phone Number (OTP)"}
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
                    </>
                  ) : null}

                  {stepIndex === 1 && role === "patient" ? (
                    <>
                      <InputField
                        id="signup-patient-policy"
                        label="Insurance Policy Number"
                        value={form.patientPolicyNumber}
                        onChange={(value) => updateField("patientPolicyNumber", value)}
                        placeholder="Enter insurance policy number"
                      />
                      <InputField
                        id="signup-patient-dob"
                        label="Date of Birth (DOB)"
                        value={form.patientDob}
                        onChange={(value) => updateField("patientDob", value)}
                        type="date"
                      />
                      <InputField
                        id="signup-patient-provider"
                        label="Provider Name"
                        value={form.patientProviderName}
                        onChange={(value) => updateField("patientProviderName", value)}
                        placeholder="Enter provider name"
                      />
                    </>
                  ) : null}

                  {stepIndex === 1 && role === "hospital" ? (
                    <>
                      <InputField
                        id="signup-hospital-name"
                        label="Hospital / Clinic Name"
                        value={form.hospitalName}
                        onChange={(value) => updateField("hospitalName", value)}
                        placeholder="Enter hospital or clinic name"
                      />
                      <InputField
                        id="signup-hospital-license"
                        label="Medical Provider License Number"
                        value={form.hospitalLicenseNumber}
                        onChange={(value) => updateField("hospitalLicenseNumber", value)}
                        placeholder="Enter license number"
                      />
                      <InputField
                        id="signup-hospital-npi"
                        label="National Provider Identifier (NPI)"
                        value={form.hospitalNpi}
                        onChange={(value) => updateField("hospitalNpi", value)}
                        placeholder="Enter 10-digit NPI"
                        inputMode="numeric"
                      />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <InputField
                          id="signup-hospital-city"
                          label="City"
                          value={form.hospitalCity}
                          onChange={(value) => updateField("hospitalCity", value)}
                          placeholder="Enter city"
                        />
                        <InputField
                          id="signup-hospital-state"
                          label="State"
                          value={form.hospitalState}
                          onChange={(value) => updateField("hospitalState", value)}
                          placeholder="Enter state"
                        />
                      </div>
                    </>
                  ) : null}

                  {stepIndex === 1 && role === "insurer" ? (
                    <>
                      <InputField
                        id="signup-insurer-company"
                        label="Official Company Name"
                        value={form.insurerCompanyName}
                        onChange={(value) => updateField("insurerCompanyName", value)}
                        placeholder="Enter official company name"
                      />
                      <InputField
                        id="signup-insurer-license"
                        label="IRDAI / Regulatory License Number"
                        value={form.insurerLicenseNumber}
                        onChange={(value) => updateField("insurerLicenseNumber", value)}
                        placeholder="Enter license number"
                      />
                      <InputField
                        id="signup-insurer-tax-id"
                        label="Tax Identification Number (PAN/EIN)"
                        value={form.insurerTaxId}
                        onChange={(value) => updateField("insurerTaxId", value)}
                        placeholder="Enter PAN or EIN"
                      />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <InputField
                          id="signup-insurer-city"
                          label="City"
                          value={form.insurerCity}
                          onChange={(value) => updateField("insurerCity", value)}
                          placeholder="Enter city"
                        />
                        <InputField
                          id="signup-insurer-state"
                          label="State"
                          value={form.insurerState}
                          onChange={(value) => updateField("insurerState", value)}
                          placeholder="Enter state"
                        />
                      </div>
                    </>
                  ) : null}

                  <div className="flex items-center justify-between gap-3 pt-1">
                    {stepIndex === 1 ? (
                      <button
                        type="button"
                        onClick={() => setStepIndex(0)}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Back
                      </button>
                    ) : (
                      <div />
                    )}

                    <button
                      type="submit"
                      disabled={isSubmitting || isGoogleSubmitting}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[var(--ch-blue)] px-5 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(74,142,219,0.18)] transition-all hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      {stepIndex === 1 ? (isSubmitting ? "Creating..." : "Create account") : "Next"}
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
