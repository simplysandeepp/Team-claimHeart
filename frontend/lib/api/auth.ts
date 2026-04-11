"use client";

import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User as FirebaseUser,
} from "firebase/auth";
import { readUserProfileFromStore, writeUserProfileToStore } from "@/lib/api/authProfileStore";
import { readStorage, writeStorage } from "@/lib/api/storage";
import { firebaseAuth, googleAuthProvider, hasPlaceholderFirebaseConfig } from "@/lib/firebase";
import type { AppUser, UserRole } from "@/types";

const CURRENT_USER_KEY = "claimheart.currentUser";
const ROLE_KEY = "claimheart.role";

export type SignupPayload = {
  name: string;
  email: string;
  phone?: string;
  password: string;
  role: UserRole;
  state?: string;
  patientId?: string;
  dob?: string;
  policyNumber?: string;
  insuranceCompany?: string;
  sumInsured?: number;
  doctorName?: string;
  hospitalRegNo?: string;
  city?: string;
  department?: string;
  employeeId?: string;
  website?: string;
  organizationType?: string;
  organizationCode?: string;
  taxId?: string;
  npi?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  registrationCertificateName?: string;
  policyDocumentName?: string;
};

type SocialSignupPayload = Omit<SignupPayload, "password">;

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  "auth/email-already-in-use": "An account with this email already exists.",
  "auth/invalid-credential": "Incorrect email or password.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/popup-closed-by-user": "The Google sign-in popup was closed before the request finished.",
  "auth/popup-blocked": "Your browser blocked the Google sign-in popup. Allow popups and try again.",
  "auth/too-many-requests": "Too many attempts were made. Please wait a moment and try again.",
  "auth/unauthorized-domain": "This domain is not authorized for Firebase Auth yet.",
  "auth/user-not-found": "No account was found for these credentials.",
  "auth/weak-password": "Password should be at least 6 characters long.",
};

const toOptionalString = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const toOptionalNumber = (value?: number) => (typeof value === "number" && Number.isFinite(value) ? value : undefined);

const deriveRoleId = (role: UserRole, uid: string) => `${role[0].toUpperCase()}-${uid.slice(0, 8).toUpperCase()}`;

const deriveDisplayName = (email: string, name?: string | null) => {
  const trimmedName = name?.trim();
  if (trimmedName) {
    return trimmedName;
  }

  return email.split("@")[0] || "ClaimHeart User";
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const ensureFirebaseConfigured = () => {
  if (hasPlaceholderFirebaseConfig) {
    throw new Error("Update the NEXT_PUBLIC_FIREBASE_* values in your frontend .env.local before using live authentication.");
  }
};

const cacheCurrentUser = (user: AppUser | null) => {
  if (typeof window === "undefined") {
    return;
  }

  if (!user) {
    window.localStorage.removeItem("user");
    window.localStorage.removeItem("role");
    window.localStorage.removeItem(CURRENT_USER_KEY);
    window.localStorage.removeItem(ROLE_KEY);
    return;
  }

  writeStorage(CURRENT_USER_KEY, user);
  writeStorage(ROLE_KEY, user.role);
  window.localStorage.setItem("role", user.role);
  window.localStorage.setItem("user", JSON.stringify(user));
};

const buildUserProfile = ({
  uid,
  email,
  role,
  authProvider,
  name,
  phone,
  state,
  patientId,
  dob,
  policyNumber,
  insuranceCompany,
  sumInsured,
  doctorName,
  hospitalRegNo,
  city,
  department,
  employeeId,
  website,
  organizationType,
  organizationCode,
  taxId,
  npi,
  contactName,
  contactEmail,
  contactPhone,
  registrationCertificateName,
  policyDocumentName,
}: Omit<SocialSignupPayload, "email"> & {
  uid: string;
  email: string;
  authProvider: NonNullable<AppUser["authProvider"]>;
}) => ({
  uid,
  id: deriveRoleId(role, uid),
  name: deriveDisplayName(email, name),
  email: normalizeEmail(email),
  role,
  authProvider,
  phone: toOptionalString(phone),
  state: toOptionalString(state),
  patientId: role === "patient" ? toOptionalString(patientId) ?? deriveRoleId("patient", uid) : undefined,
  dob: toOptionalString(dob),
  policyNumber: toOptionalString(policyNumber),
  insuranceCompany: toOptionalString(insuranceCompany),
  sumInsured: toOptionalNumber(sumInsured),
  doctorName: toOptionalString(doctorName),
  hospitalRegNo: toOptionalString(hospitalRegNo),
  city: toOptionalString(city),
  department: toOptionalString(department),
  employeeId: toOptionalString(employeeId),
  website: toOptionalString(website),
  organizationType: toOptionalString(organizationType),
  organizationCode: toOptionalString(organizationCode),
  taxId: toOptionalString(taxId),
  npi: toOptionalString(npi),
  contactName: toOptionalString(contactName),
  contactEmail: toOptionalString(contactEmail),
  contactPhone: toOptionalString(contactPhone),
  registrationCertificateName: toOptionalString(registrationCertificateName),
  policyDocumentName: toOptionalString(policyDocumentName),
}) satisfies AppUser;

const readUserProfile = async (uid: string) => {
  return readUserProfileFromStore(uid, deriveRoleId, normalizeEmail, deriveDisplayName);
};

const writeUserProfile = async (profile: AppUser) => {
  await writeUserProfileToStore(profile);
};

const persistUserProfile = (firebaseUser: FirebaseUser, profile: AppUser) => {
  cacheCurrentUser(profile);

  void Promise.allSettled([
    updateProfile(firebaseUser, { displayName: profile.name }),
    writeUserProfile(profile),
  ]).then((results) => {
    const rejected = results.find((result) => result.status === "rejected");
    if (rejected?.status === "rejected") {
      console.error("ClaimHeart auth profile persistence failed.", rejected.reason);
    }
  });
};

const syncUserFromFirebase = async (firebaseUser: FirebaseUser) => {
  const cachedUser = readStorage<AppUser | null>(CURRENT_USER_KEY, null);
  if (cachedUser?.uid === firebaseUser.uid) {
    cacheCurrentUser(cachedUser);
    return cachedUser;
  }

  const profile = await readUserProfile(firebaseUser.uid);
  if (profile) {
    cacheCurrentUser(profile);
    return profile;
  }

  cacheCurrentUser(null);
  return null;
};

const enforceRole = async (user: AppUser | null, role: UserRole) => {
  if (!user) {
    await signOut(firebaseAuth);
    throw new Error("This account does not have a ClaimHeart workspace profile yet. Please sign up first.");
  }

  if (user.role !== role) {
    await signOut(firebaseAuth);
    throw new Error(`This account is registered for the ${user.role} workspace. Please sign in there instead.`);
  }

  cacheCurrentUser(user);
  return user;
};

const formatAuthError = (error: unknown, fallback: string) => {
  if (error instanceof Error) {
    const knownMessage = AUTH_ERROR_MESSAGES[(error as Error & { code?: string }).code ?? ""];
    return knownMessage ?? error.message ?? fallback;
  }

  return fallback;
};

export const getCurrentUser = async (): Promise<AppUser | null> => {
  return readStorage<AppUser | null>(CURRENT_USER_KEY, null);
};

export const getRole = async (): Promise<UserRole | null> => {
  const user = await getCurrentUser();
  return user?.role ?? readStorage<UserRole | null>(ROLE_KEY, null);
};

export const getDashboardPath = (role: UserRole | null) => {
  if (role === "patient") {
    return "/dashboard/patient";
  }

  if (role === "hospital") {
    return "/dashboard/hospital";
  }

  if (role === "insurer") {
    return "/dashboard/insurer";
  }

  return "/auth/login";
};

export const loginUser = async (email: string, password: string, role: UserRole) => {
  ensureFirebaseConfigured();

  try {
    const credential = await signInWithEmailAndPassword(firebaseAuth, normalizeEmail(email), password);
    const profile = await syncUserFromFirebase(credential.user);
    return await enforceRole(profile, role);
  } catch (error) {
    throw new Error(formatAuthError(error, "Unable to sign in right now."));
  }
};

export const loginWithGoogle = async (role: UserRole) => {
  ensureFirebaseConfigured();

  try {
    const result = await signInWithPopup(firebaseAuth, googleAuthProvider);
    const profile = await readUserProfile(result.user.uid);
    return await enforceRole(profile, role);
  } catch (error) {
    throw new Error(formatAuthError(error, "Unable to sign in with Google right now."));
  }
};

export const signupUser = async (payload: SignupPayload) => {
  ensureFirebaseConfigured();

  const normalizedEmail = normalizeEmail(payload.email);

  try {
    const credential = await createUserWithEmailAndPassword(firebaseAuth, normalizedEmail, payload.password);
    const profile = buildUserProfile({
      ...payload,
      uid: credential.user.uid,
      email: normalizedEmail,
      authProvider: "password",
    });

    persistUserProfile(credential.user, profile);
    return profile;
  } catch (error) {
    throw new Error(formatAuthError(error, "Unable to create the account right now."));
  }
};

export const signupWithGoogle = async (payload: SocialSignupPayload) => {
  ensureFirebaseConfigured();

  try {
    const result = await signInWithPopup(firebaseAuth, googleAuthProvider);
    const normalizedEmail = normalizeEmail(result.user.email ?? payload.email);
    const existingProfile = await readUserProfile(result.user.uid);

    if (existingProfile) {
      cacheCurrentUser(existingProfile);
      return existingProfile;
    }

    const profile = buildUserProfile({
      ...payload,
      uid: result.user.uid,
      email: normalizedEmail,
      name: payload.name || result.user.displayName || normalizedEmail.split("@")[0],
      phone: payload.phone || result.user.phoneNumber || undefined,
      authProvider: "google",
    });

    persistUserProfile(result.user, profile);
    return profile;
  } catch (error) {
    throw new Error(formatAuthError(error, "Unable to create the account with Google right now."));
  }
};

export const subscribeToAuthState = (listener: (user: AppUser | null) => void) =>
  onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
    if (!firebaseUser) {
      cacheCurrentUser(null);
      listener(null);
      return;
    }

    try {
      const profile = await syncUserFromFirebase(firebaseUser);
      listener(profile);
    } catch {
      cacheCurrentUser(null);
      listener(null);
    }
  });

export const logout = async (withConfirmation: boolean = true) => {
  if (typeof window === "undefined") {
    return;
  }

  if (withConfirmation && !window.confirm("Are you sure you want to logout?")) {
    return;
  }

  try {
    await signOut(firebaseAuth);
  } finally {
    cacheCurrentUser(null);
    window.location.href = "/auth/login";
  }
};
