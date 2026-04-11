"use client";

import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { firestore } from "@/lib/firebase";
import type { AppUser } from "@/types";

const USERS_COLLECTION = "users";

const serializeProfile = (profile: AppUser) =>
  Object.fromEntries(Object.entries(profile).filter(([, value]) => value !== undefined));

type RawUserRole = AppUser["role"];

const isUserRole = (value: unknown): value is RawUserRole =>
  value === "patient" || value === "hospital" || value === "insurer";

export const normalizeStoredUserProfile = (
  uid: string,
  value: Record<string, unknown>,
  deriveRoleId: (role: AppUser["role"], uid: string) => string,
  normalizeEmail: (email: string) => string,
  deriveDisplayName: (email: string, name?: string | null) => string,
) => {
  const email = typeof value.email === "string" ? normalizeEmail(value.email) : "";
  const role = value.role;

  if (!email || !isUserRole(role)) {
    return null;
  }

  return {
    uid,
    id: typeof value.id === "string" ? value.id : deriveRoleId(role, uid),
    name: deriveDisplayName(email, typeof value.name === "string" ? value.name : undefined),
    email,
    role,
    authProvider:
      value.authProvider === "google" ||
      value.authProvider === "apple" ||
      value.authProvider === "microsoft" ||
      value.authProvider === "password"
        ? value.authProvider
        : undefined,
    address: typeof value.address === "string" ? value.address.trim() || undefined : undefined,
    phone: typeof value.phone === "string" ? value.phone.trim() || undefined : undefined,
    state: typeof value.state === "string" ? value.state.trim() || undefined : undefined,
    patientId:
      role === "patient"
        ? typeof value.patientId === "string"
          ? value.patientId.trim() || deriveRoleId("patient", uid)
          : deriveRoleId("patient", uid)
        : undefined,
    dob: typeof value.dob === "string" ? value.dob.trim() || undefined : undefined,
    policyNumber: typeof value.policyNumber === "string" ? value.policyNumber.trim() || undefined : undefined,
    policyName: typeof value.policyName === "string" ? value.policyName.trim() || undefined : undefined,
    policyType: typeof value.policyType === "string" ? value.policyType.trim() || undefined : undefined,
    policyStartDate: typeof value.policyStartDate === "string" ? value.policyStartDate.trim() || undefined : undefined,
    policyEndDate: typeof value.policyEndDate === "string" ? value.policyEndDate.trim() || undefined : undefined,
    insuranceCompany: typeof value.insuranceCompany === "string" ? value.insuranceCompany.trim() || undefined : undefined,
    sumInsured: typeof value.sumInsured === "number" && Number.isFinite(value.sumInsured) ? value.sumInsured : undefined,
    doctorName: typeof value.doctorName === "string" ? value.doctorName.trim() || undefined : undefined,
    hospitalRegNo: typeof value.hospitalRegNo === "string" ? value.hospitalRegNo.trim() || undefined : undefined,
    hospitalRegistrationId:
      typeof value.hospitalRegistrationId === "string" ? value.hospitalRegistrationId.trim() || undefined : undefined,
    city: typeof value.city === "string" ? value.city.trim() || undefined : undefined,
    department: typeof value.department === "string" ? value.department.trim() || undefined : undefined,
    employeeId: typeof value.employeeId === "string" ? value.employeeId.trim() || undefined : undefined,
    website: typeof value.website === "string" ? value.website.trim() || undefined : undefined,
    organizationType: typeof value.organizationType === "string" ? value.organizationType.trim() || undefined : undefined,
    organizationCode: typeof value.organizationCode === "string" ? value.organizationCode.trim() || undefined : undefined,
    taxId: typeof value.taxId === "string" ? value.taxId.trim() || undefined : undefined,
    gstNumber: typeof value.gstNumber === "string" ? value.gstNumber.trim() || undefined : undefined,
    panNumber: typeof value.panNumber === "string" ? value.panNumber.trim() || undefined : undefined,
    irdaiLicenseNumber: typeof value.irdaiLicenseNumber === "string" ? value.irdaiLicenseNumber.trim() || undefined : undefined,
    npi: typeof value.npi === "string" ? value.npi.trim() || undefined : undefined,
    contactName: typeof value.contactName === "string" ? value.contactName.trim() || undefined : undefined,
    contactEmail: typeof value.contactEmail === "string" ? value.contactEmail.trim() || undefined : undefined,
    contactPhone: typeof value.contactPhone === "string" ? value.contactPhone.trim() || undefined : undefined,
    registrationCertificateName:
      typeof value.registrationCertificateName === "string" ? value.registrationCertificateName.trim() || undefined : undefined,
    policyDocumentName:
      typeof value.policyDocumentName === "string" ? value.policyDocumentName.trim() || undefined : undefined,
  } satisfies AppUser;
};

export const readUserProfileFromStore = async (
  uid: string,
  deriveRoleId: (role: AppUser["role"], uid: string) => string,
  normalizeEmail: (email: string) => string,
  deriveDisplayName: (email: string, name?: string | null) => string,
) => {
  const snapshot = await getDoc(doc(firestore, USERS_COLLECTION, uid));
  if (!snapshot.exists()) {
    return null;
  }

  return normalizeStoredUserProfile(
    uid,
    snapshot.data() as Record<string, unknown>,
    deriveRoleId,
    normalizeEmail,
    deriveDisplayName,
  );
};

export const writeUserProfileToStore = async (profile: AppUser) => {
  await setDoc(
    doc(firestore, USERS_COLLECTION, profile.uid ?? profile.id),
    {
      ...serializeProfile(profile),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
};
