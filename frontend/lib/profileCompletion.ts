"use client";

import type { AppUser, UserRole } from "@/types";

type ProfileFieldKey =
  | "policyNumber"
  | "policyName"
  | "policyType"
  | "policyStartDate"
  | "policyEndDate"
  | "hospitalRegistrationId"
  | "npi"
  | "gstNumber"
  | "panNumber"
  | "address"
  | "irdaiLicenseNumber";

export type ProfileRequirementOption = {
  label: string;
  value: string;
};

export type ProfileRequirement = {
  key: ProfileFieldKey;
  label: string;
  placeholder: string;
  description: string;
  type?: "text" | "textarea" | "date" | "select";
  autoComplete?: string;
  options?: ProfileRequirementOption[];
};

export const getSignupCollectedFields = (user: AppUser) => [
  { label: "Full name", value: user.name },
  { label: "Email", value: user.email },
  { label: "Phone", value: user.phone?.trim() || "Not provided during signup" },
];

const PATIENT_POLICY_TYPE_OPTIONS: ProfileRequirementOption[] = [
  { label: "Individual", value: "individual" },
  { label: "Family Floater", value: "family_floater" },
  { label: "Corporate", value: "corporate" },
];

const ROLE_REQUIREMENTS: Record<UserRole, ProfileRequirement[]> = {
  patient: [
    {
      key: "policyNumber",
      label: "Policy Number",
      placeholder: "Enter your policy number",
      description: "Shown on your dashboard for tracking and claim support.",
      autoComplete: "off",
    },
    {
      key: "policyName",
      label: "Policy Name",
      placeholder: "Enter your plan name",
      description: "Displayed on the patient dashboard alongside claim coverage details.",
      autoComplete: "organization-title",
    },
    {
      key: "policyType",
      label: "Policy Type",
      placeholder: "Select policy type",
      description: "Keeps the dashboard aligned with the kind of coverage you hold.",
      type: "select",
      options: PATIENT_POLICY_TYPE_OPTIONS,
    },
    {
      key: "policyStartDate",
      label: "Policy Start Date",
      placeholder: "Select policy start date",
      description: "Used to show the active coverage period on your dashboard.",
      type: "date",
    },
    {
      key: "policyEndDate",
      label: "Policy End Date",
      placeholder: "Select policy end date",
      description: "Helps you track the current policy validity window.",
      type: "date",
    },
  ],
  hospital: [
    {
      key: "hospitalRegistrationId",
      label: "Registration Identifier",
      placeholder: "Enter hospital registration identifier",
      description: "Used to validate the provider identity in the workspace.",
      autoComplete: "organization-title",
    },
    {
      key: "npi",
      label: "NPI Number",
      placeholder: "Enter the 10-digit NPI number",
      description: "Trust verification for hospital submissions.",
      autoComplete: "off",
    },
  ],
  insurer: [
    {
      key: "gstNumber",
      label: "GST Number",
      placeholder: "Enter GST number",
      description: "Used for insurer organization verification.",
      autoComplete: "off",
    },
    {
      key: "panNumber",
      label: "PAN Number",
      placeholder: "Enter PAN number",
      description: "Required for organization identity checks.",
      autoComplete: "off",
    },
    {
      key: "address",
      label: "Registered Address",
      placeholder: "Enter the registered office address",
      description: "Shown in profile and verification records.",
      type: "textarea",
      autoComplete: "street-address",
    },
    {
      key: "irdaiLicenseNumber",
      label: "IRDAI License Number",
      placeholder: "Enter IRDAI license number",
      description: "Verification reference for the insurer workspace.",
      autoComplete: "off",
    },
  ],
};

const hasValue = (value: AppUser[keyof AppUser]) => {
  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  return value !== undefined && value !== null;
};

export const getProfileRequirements = (role: UserRole) => ROLE_REQUIREMENTS[role];

export const getProfileCompletion = (user: AppUser | null) => {
  if (!user) {
    return {
      completedCount: 0,
      totalCount: 0,
      percentage: 0,
      missingRequirements: [] as ProfileRequirement[],
      requirements: [] as ProfileRequirement[],
    };
  }

  const requirements = getProfileRequirements(user.role);
  const missingRequirements = requirements.filter((field) => !hasValue(user[field.key]));
  const completedCount = requirements.length - missingRequirements.length;
  const percentage = requirements.length === 0 ? 0 : Math.round((completedCount / requirements.length) * 100);

  return {
    completedCount,
    totalCount: requirements.length,
    percentage,
    missingRequirements,
    requirements,
  };
};

export const getProfilePromptCopy = (role: UserRole) => {
  if (role === "hospital") {
    return {
      title: "Complete hospital verification",
      description: "Add the provider identifiers we need for hospital submissions now, or skip and come back from Profile later.",
    };
  }

  if (role === "insurer") {
    return {
      title: "Complete insurer verification",
      description: "Add the compliance details for your insurer workspace now, or skip and update them later from Profile.",
    };
  }

  return {
    title: "Add your policy details",
    description: "Share your policy basics now so the patient dashboard can show the right coverage details, or skip and fill them later from Profile.",
  };
};
