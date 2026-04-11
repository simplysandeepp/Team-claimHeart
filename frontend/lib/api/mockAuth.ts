/**
 * Mock Authentication for Demo
 * Bypasses Firebase for localhost testing
 */

import type { AppUser, UserRole } from "@/types";

const MOCK_USER_KEY = "claimheart.mock.user";
const MOCK_ROLE_KEY = "claimheart.mock.role";

// Mock users for demo
const MOCK_USERS: Record<UserRole, AppUser> = {
  patient: {
    uid: "mock-patient-001",
    id: "P-MOCK001",
    name: "Demo Patient",
    email: "patient@demo.com",
    role: "patient",
    authProvider: "mock",
    patientId: "P-MOCK001",
    policyNumber: "POL-2024-001",
    policyName: "Health Plus Gold",
    phone: "+1234567890",
  },
  hospital: {
    uid: "mock-hospital-001",
    id: "H-MOCK001",
    name: "Demo Hospital",
    email: "hospital@demo.com",
    role: "hospital",
    authProvider: "mock",
    hospitalRegistrationId: "H-MOCK001",
    city: "Demo City",
    phone: "+1234567890",
  },
  insurer: {
    uid: "mock-insurer-001",
    id: "I-MOCK001",
    name: "Demo Insurer",
    email: "insurer@demo.com",
    role: "insurer",
    authProvider: "mock",
    organizationCode: "I-MOCK001",
    phone: "+1234567890",
  },
};

/**
 * Get current mock user from localStorage
 */
export const getCurrentUser = async (): Promise<AppUser | null> => {
  if (typeof window === "undefined") return null;
  
  const stored = localStorage.getItem(MOCK_USER_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
  
  // No default user - must login first
  return null;
};

/**
 * Mock login - just sets the user based on role
 * For demo: any email/password works, just need to select correct role
 */
export const loginUser = async (
  email: string,
  password: string,
  role: UserRole
): Promise<AppUser> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const user = MOCK_USERS[role];
  localStorage.setItem(MOCK_USER_KEY, JSON.stringify(user));
  localStorage.setItem(MOCK_ROLE_KEY, role);
  localStorage.setItem("user", JSON.stringify(user));
  localStorage.setItem("role", role);
  
  // Trigger auth state change event
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("auth-state-changed", { detail: user }));
  }
  
  return user;
};

/**
 * Mock Google login
 */
export const loginWithGoogle = async (role: UserRole): Promise<AppUser> => {
  return loginUser("", "", role);
};

/**
 * Mock signup - creates user based on role
 */
export const signupUser = async (payload: any): Promise<AppUser> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const user = MOCK_USERS[payload.role];
  localStorage.setItem(MOCK_USER_KEY, JSON.stringify(user));
  localStorage.setItem(MOCK_ROLE_KEY, payload.role);
  localStorage.setItem("user", JSON.stringify(user));
  localStorage.setItem("role", payload.role);
  
  // Trigger auth state change event
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("auth-state-changed", { detail: user }));
  }
  
  return user;
};

/**
 * Mock Google signup
 */
export const signupWithGoogle = async (payload: any): Promise<AppUser> => {
  return signupUser(payload);
};

/**
 * Get role
 */
export const getRole = async (): Promise<UserRole | null> => {
  if (typeof window === "undefined") return null;
  const role = localStorage.getItem(MOCK_ROLE_KEY);
  return (role as UserRole) || "hospital";
};

/**
 * Get dashboard path
 */
export const getDashboardPath = (role: UserRole | null) => {
  if (role === "patient") return "/dashboard/patient";
  if (role === "hospital") return "/dashboard/hospital";
  if (role === "insurer") return "/dashboard/insurer";
  return "/auth/login"; // Default to login page
};

/**
 * Subscribe to current user changes
 */
export const subscribeToCurrentUser = (
  listener: (user: AppUser | null) => void
) => {
  // For demo, just call once with current user
  getCurrentUser().then(listener);
  return () => {};
};

/**
 * Subscribe to auth state
 */
export const subscribeToAuthState = (
  listener: (user: AppUser | null) => void
) => {
  // Immediately call with current user
  getCurrentUser().then(listener);
  
  // Also listen for storage changes (when user logs in/out)
  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === MOCK_USER_KEY) {
      if (e.newValue) {
        try {
          listener(JSON.parse(e.newValue));
        } catch {
          listener(null);
        }
      } else {
        listener(null);
      }
    }
  };
  
  if (typeof window !== "undefined") {
    window.addEventListener("storage", handleStorageChange);
    
    // Also listen for custom event for same-tab updates
    const handleCustomEvent = (e: Event) => {
      const customEvent = e as CustomEvent<AppUser | null>;
      listener(customEvent.detail);
    };
    
    window.addEventListener("auth-state-changed", handleCustomEvent);
    
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("auth-state-changed", handleCustomEvent);
    };
  }
  
  return () => {};
};

/**
 * Update profile
 */
export const updateCurrentUserProfile = async (payload: any): Promise<AppUser> => {
  const current = await getCurrentUser();
  if (!current) throw new Error("No user logged in");
  
  const updated = { ...current, ...payload };
  localStorage.setItem(MOCK_USER_KEY, JSON.stringify(updated));
  return updated;
};

/**
 * Logout
 */
export const logout = async (withConfirmation: boolean = true) => {
  if (typeof window === "undefined") return;
  
  if (withConfirmation && !window.confirm("Are you sure you want to logout?")) {
    return;
  }
  
  localStorage.removeItem(MOCK_USER_KEY);
  localStorage.removeItem(MOCK_ROLE_KEY);
  localStorage.removeItem("user");
  localStorage.removeItem("role");
  
  // Trigger auth state change event
  window.dispatchEvent(new CustomEvent("auth-state-changed", { detail: null }));
  
  window.location.href = "/auth/login";
};
