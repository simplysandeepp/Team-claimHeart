"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Toaster } from "sonner";
import { getCurrentUser, getDashboardPath, subscribeToAuthState } from "@/lib/api/auth";
import type { AppUser, UserRole } from "@/types";

const PUBLIC_PATHS = new Set(["/", "/login", "/auth/login", "/auth/signup"]);
const INSURER_ONLY_PREFIXES = ["/dashboard/insurer", "/claims", "/letters", "/policies", "/reports", "/fraud"];
const HOSPITAL_ONLY_PREFIXES = ["/dashboard/hospital"];
const PATIENT_ONLY_PREFIXES = ["/dashboard/patient"];
const SHARED_PROTECTED_PREFIXES = ["/dashboard", "/settings"];

const matchesPath = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);

const resolveAllowedRoles = (pathname: string): UserRole[] | null => {
  if (INSURER_ONLY_PREFIXES.some((prefix) => matchesPath(pathname, prefix))) {
    return ["insurer"];
  }

  if (HOSPITAL_ONLY_PREFIXES.some((prefix) => matchesPath(pathname, prefix))) {
    return ["hospital"];
  }

  if (PATIENT_ONLY_PREFIXES.some((prefix) => matchesPath(pathname, prefix))) {
    return ["patient"];
  }

  return null;
};

const isProtectedPath = (pathname: string) =>
  !PUBLIC_PATHS.has(pathname) &&
  (resolveAllowedRoles(pathname) !== null || SHARED_PROTECTED_PREFIXES.some((prefix) => matchesPath(pathname, prefix)));

const isAuthPath = (pathname: string) => pathname === "/login" || pathname === "/auth/login" || pathname === "/auth/signup";

function BootstrapGate({
  authReady,
  currentUser,
  children,
}: {
  authReady: boolean;
  currentUser: AppUser | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const allowedRoles = useMemo(() => resolveAllowedRoles(pathname), [pathname]);
  const requiresAuth = useMemo(() => isProtectedPath(pathname), [pathname]);

  useEffect(() => {
    if (!authReady) {
      return;
    }

    if (!currentUser && requiresAuth) {
      router.replace("/auth/login");
      return;
    }

    if (currentUser && isAuthPath(pathname)) {
      router.replace(getDashboardPath(currentUser.role));
      return;
    }

    if (currentUser && allowedRoles && !allowedRoles.includes(currentUser.role)) {
      router.replace(getDashboardPath(currentUser.role));
    }
  }, [allowedRoles, authReady, currentUser, pathname, requiresAuth, router]);

  if (!authReady && requiresAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#e8f1ff_0%,#f8fafc_48%,#eef2f7_100%)] px-6 text-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ch-blue-dark)]">ClaimHeart</p>
          <h1 className="mt-3 text-2xl font-bold tracking-[-0.04em] text-slate-900">Restoring your workspace</h1>
          <p className="mt-2 text-sm text-slate-500">Checking your session and route access.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default function AppBootstrap({ children }: { children: React.ReactNode }) {
  const [authReady, setAuthReady] = useState(false);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);

  useEffect(() => {
    let active = true;

    getCurrentUser().then((user) => {
      if (!active || !user) {
        return;
      }

      setCurrentUser(user);
    });

    const fallbackTimer = window.setTimeout(() => {
      if (!active) {
        return;
      }

      setAuthReady(true);
    }, 500);

    let unsubscribe: () => void = () => {};

    try {
      unsubscribe = subscribeToAuthState((user) => {
        if (!active) {
          return;
        }

        window.clearTimeout(fallbackTimer);
        setCurrentUser(user);
        setAuthReady(true);
      });
    } catch {
      window.clearTimeout(fallbackTimer);
      setAuthReady(true);
    }

    return () => {
      active = false;
      window.clearTimeout(fallbackTimer);
      unsubscribe();
    };
  }, []);

  return (
    <>
      <BootstrapGate authReady={authReady} currentUser={currentUser}>
        {children}
      </BootstrapGate>
      <Toaster richColors position="top-right" />
    </>
  );
}
