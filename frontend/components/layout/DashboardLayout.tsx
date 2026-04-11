"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  Bell,
  BookOpen,
  ChevronsLeft,
  ChevronsRight,
  ChevronRight,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings,
  User,
  X,
} from "lucide-react";
import { useSyncStore } from "@/hooks/useSyncStore";
import { getCurrentUser, logout } from "@/lib/api/auth";
import { getActiveDemoCaseId, getDefaultDemoCaseId, resolveViewerForRole, type DemoCaseId } from "@/lib/demoWorkflow";
import LiveBadge from "@/components/ui/LiveBadge";
import NotifBell from "@/components/ui/NotifBell";
import PageTransition from "@/components/ui/PageTransition";
import ClaimHeartLogo from "@/components/ui/ClaimHeartLogo";
import type { AppUser, UserRole } from "@/types";

type HeaderSearchTarget = {
  label: string;
  href: string;
  hint: string;
};

const NAV_ITEMS: Record<UserRole, { label: string; href: string; icon: typeof LayoutDashboard }[]> = {
  insurer: [
    { label: "Command Center", href: "/dashboard/insurer", icon: LayoutDashboard },
    { label: "Claims Queue", href: "/claims", icon: FileText },
    { label: "Notifications", href: "/dashboard/insurer/notifications", icon: Bell },
    { label: "Policy Library", href: "/policies", icon: BookOpen },
    { label: "Reports", href: "/reports", icon: BarChart3 },
    { label: "Settings", href: "/settings", icon: Settings },
  ],
  hospital: [
    { label: "Dashboard", href: "/dashboard/hospital", icon: LayoutDashboard },
    { label: "Notifications", href: "/dashboard/hospital/notifications", icon: Bell },
    { label: "Settings", href: "/settings", icon: Settings },
  ],
  patient: [
    { label: "Dashboard", href: "/dashboard/patient", icon: LayoutDashboard },
    { label: "Notifications", href: "/dashboard/patient/notifications", icon: Bell },
    { label: "Settings", href: "/settings", icon: Settings },
  ],
};

const ROLE_META: Record<UserRole, { workspace: string; summary: string; accent: string }> = {
  insurer: {
    workspace: "Claims Command Workspace",
    summary: "Adjudication, evidence review, and final decisioning",
    accent: "from-[#e8f1ff] via-[#f8fbff] to-white",
  },
  hospital: {
    workspace: "Provider Operations Workspace",
    summary: "Submission readiness, document quality, and insurer handoff",
    accent: "from-[#eefbf4] via-[#f7fcf8] to-white",
  },
  patient: {
    workspace: "Member Claims Workspace",
    summary: "Decision clarity, coverage visibility, and next steps",
    accent: "from-[#f4f8ff] via-[#fcfdff] to-white",
  },
};

function SidebarContent({
  navItems,
  role,
  user,
  collapsed,
  activeNavHref,
}: {
  navItems: { label: string; href: string; icon: typeof LayoutDashboard }[];
  role: UserRole;
  user: AppUser | null;
  collapsed: boolean;
  activeNavHref: string | null;
}) {
  return (
    <>
      <div className={`flex h-[64px] items-center border-b border-white/10 ${collapsed ? "justify-center px-3" : "gap-3 px-4"}`}>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f7fbff] p-0.5">
          <ClaimHeartLogo className="h-full w-full" imageClassName="scale-105" />
        </div>
        <div className={`overflow-hidden transition-all duration-200 ${collapsed ? "w-0 opacity-0" : "w-auto opacity-100"}`}>
          <p className="whitespace-nowrap text-[1.05rem] font-bold tracking-[-0.03em] text-white">ClaimHeart</p>
          <p className="whitespace-nowrap text-[11px] text-white/65 capitalize">{role} workspace</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
        {navItems.map((item) => {
          const active = item.href === activeNavHref;
          return (
            <motion.div key={item.href} whileHover={{ x: 2 }} whileTap={{ scale: 0.98 }}>
              <Link
                href={item.href}
                className={`flex items-center rounded-2xl py-2.5 text-[15px] font-semibold transition-all ${collapsed ? "justify-center px-3" : "gap-3 px-4"} ${active ? "bg-white/18 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]" : "text-white/72 hover:bg-white/10 hover:text-white"}`}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="h-[18px] w-[18px] shrink-0" />
                <span className={`overflow-hidden whitespace-nowrap transition-all duration-200 ${collapsed ? "w-0 opacity-0" : "w-auto opacity-100"}`}>
                  {item.label}
                </span>
              </Link>
            </motion.div>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className={`flex items-center rounded-2xl bg-white/10 py-2.5 ${collapsed ? "justify-center px-2" : "gap-3 px-3.5"}`}>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--ch-blue)] text-white">
            <User className="h-4 w-4" />
          </div>
          <div className={`min-w-0 overflow-hidden transition-all duration-200 ${collapsed ? "w-0 opacity-0" : "w-auto opacity-100"}`}>
            <p className="truncate whitespace-nowrap text-[14px] font-semibold text-white">{user?.name ?? "Loading user"}</p>
            <p className="whitespace-nowrap text-[11px] capitalize text-white/60">{role}</p>
          </div>
          {!collapsed ? (
            <motion.button
              type="button"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => logout()}
              className="ml-auto inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/8 text-white transition-all hover:bg-white/14"
              title="Logout"
              aria-label="Logout"
            >
              <LogOut className="h-4 w-4" />
            </motion.button>
          ) : null}
        </div>
      </div>
    </>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  useSyncStore();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<AppUser | null>(null);
  const [activeCaseId, setActiveCaseId] = useState<DemoCaseId>(getDefaultDemoCaseId());
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  const routeRole: UserRole | null = pathname.startsWith("/dashboard/patient")
    ? "patient"
    : pathname.startsWith("/dashboard/hospital")
      ? "hospital"
      : pathname.startsWith("/dashboard/insurer")
        ? "insurer"
        : null;
  const role = routeRole ?? user?.role ?? "insurer";

  useEffect(() => {
    getCurrentUser().then(setUser);
    setActiveCaseId(getActiveDemoCaseId());
  }, [pathname]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const navItems = useMemo(() => NAV_ITEMS[role], [role]);
  const viewer = useMemo(() => resolveViewerForRole(role, user, activeCaseId), [activeCaseId, role, user]);
  const activeNavHref = useMemo(() => {
    const matches = navItems.filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
    if (matches.length === 0) {
      return null;
    }

    return matches.sort((left, right) => right.href.length - left.href.length)[0]?.href ?? null;
  }, [navItems, pathname]);
  const pageTitle = navItems.find((item) => item.href === activeNavHref)?.label ?? "ClaimHeart";
  const roleMeta = ROLE_META[role];
  const desktopSidebarWidth = collapsed ? "lg:pl-[4.5rem]" : "lg:pl-[15rem]";
  const sidebarWidth = collapsed ? "w-[4.5rem]" : "w-[15rem]";
  const togglePosition = collapsed ? "left-[4.5rem]" : "left-[15rem]";
  const primaryActionHref = role === "insurer" ? "/claims" : `/dashboard/${role}`;
  const searchPlaceholder =
    role === "insurer" ? "Search claims, policies..." : role === "hospital" ? "Search claims, documents..." : "Search claims, letters...";
  const headerSearchItems = useMemo<HeaderSearchTarget[]>(() => {
    const navTargets = navItems.map((item) => ({
      label: item.label,
      href: item.href,
      hint: `${role === "insurer" ? "Insurer" : role === "hospital" ? "Hospital" : "Patient"} workspace page`,
    }));

    const schemaTargets: Record<UserRole, HeaderSearchTarget[]> = {
      insurer: [
        { label: "Claims queue", href: "/claims", hint: "Review active claim decisions" },
        { label: "Policy rules", href: "/policies", hint: "Disease caps, waiting periods, and clause review" },
        { label: "Fraud review", href: "/reports", hint: "Fraud flags, anomalies, and investigator outputs" },
      ],
      hospital: [
        { label: "Submit claim", href: "/dashboard/hospital", hint: "Upload documents and prepare handoff" },
        { label: "Document readiness", href: "/dashboard/hospital", hint: "Check OCR package and missing files" },
        { label: "Notifications", href: "/dashboard/hospital/notifications", hint: "Insurer responses and follow-ups" },
      ],
      patient: [
        { label: "My claims", href: "/dashboard/patient", hint: "Track status, letters, and coverage" },
        { label: "Decision updates", href: "/dashboard/patient/notifications", hint: "See status changes and new actions" },
        { label: "Coverage details", href: "/dashboard/patient", hint: "Policy, approvals, and next steps" },
      ],
    };

    return [...navTargets, ...schemaTargets[role]].filter(
      (item, index, array) => array.findIndex((candidate) => candidate.href === item.href && candidate.label === item.label) === index,
    );
  }, [navItems, role]);
  const filteredSearchItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return headerSearchItems.slice(0, 5);
    }

    return headerSearchItems
      .filter((item) => item.label.toLowerCase().includes(query) || item.hint.toLowerCase().includes(query))
      .slice(0, 6);
  }, [headerSearchItems, searchQuery]);

  const handleSearchSelect = (href?: string) => {
    router.push(href ?? filteredSearchItems[0]?.href ?? primaryActionHref);
    setSearchFocused(false);
    setSearchQuery("");
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[var(--ch-surface)]">
      <AnimatePresence>
        {mobileMenuOpen ? (
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close sidebar"
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {mobileMenuOpen ? (
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ duration: 0.26, ease: "easeOut" }}
            className="fixed inset-y-0 left-0 z-50 flex w-[15rem] flex-col bg-[linear-gradient(180deg,var(--ch-blue-dark)_0%,var(--ch-blue)_100%)] shadow-[2px_0_18px_rgba(63,121,180,0.18)] lg:hidden"
          >
            <div className="flex h-[64px] items-center justify-between border-b border-white/10 px-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f7fbff] p-0.5">
                  <ClaimHeartLogo className="h-full w-full" imageClassName="scale-105" />
                </div>
                <div>
                  <p className="whitespace-nowrap text-[1.05rem] font-bold tracking-[-0.03em] text-white">ClaimHeart</p>
                  <p className="whitespace-nowrap text-[11px] text-white/65">Transparency Platform</p>
                </div>
              </div>
              <button type="button" onClick={() => setMobileMenuOpen(false)} className="rounded-xl p-2 text-white/80 transition hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
              {navItems.map((item) => {
                const active = item.href === activeNavHref;
                return (
                  <motion.div key={`mobile-${item.href}`} whileHover={{ x: 2 }} whileTap={{ scale: 0.98 }}>
                    <Link href={item.href} className={`flex items-center gap-3 rounded-2xl px-4 py-2.5 text-[15px] font-semibold transition-all ${active ? "bg-white/18 text-white" : "text-white/72 hover:bg-white/10 hover:text-white"}`}>
                      <item.icon className="h-[18px] w-[18px] shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  </motion.div>
                );
              })}
            </nav>

            <div className="border-t border-white/10 p-4">
              <div className="flex items-center gap-3 rounded-2xl bg-white/10 px-3.5 py-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--ch-blue)] text-white">
                  <User className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-white">{viewer?.name ?? "Loading user"}</p>
                  <p className="text-[11px] capitalize text-white/60">{role}</p>
                </div>
                <motion.button type="button" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => logout()} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/8 text-white transition-all hover:bg-white/14" title="Logout" aria-label="Logout">
                  <LogOut className="h-4 w-4" />
                </motion.button>
              </div>
            </div>
          </motion.aside>
        ) : null}
      </AnimatePresence>

      <aside className={`fixed inset-y-0 left-0 z-50 hidden flex-col bg-[linear-gradient(180deg,var(--ch-blue-dark)_0%,var(--ch-blue)_100%)] shadow-[2px_0_18px_rgba(63,121,180,0.18)] transition-[width] duration-200 lg:flex ${sidebarWidth}`}>
        <SidebarContent navItems={navItems} role={role} user={viewer} collapsed={collapsed} activeNavHref={activeNavHref} />
      </aside>

      <motion.button
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        className={`fixed top-[48px] z-[60] hidden h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-[0_8px_24px_rgba(15,23,42,0.14)] transition-all duration-200 hover:bg-slate-50 lg:flex ${togglePosition}`}
        onClick={() => setCollapsed((value) => !value)}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
      </motion.button>

      <div className={`flex min-h-screen min-w-0 flex-col transition-[padding] duration-200 ${desktopSidebarWidth}`}>
        <header className={`sticky top-0 z-40 border-b border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(255,255,255,0.94))] px-4 py-2.5 backdrop-blur sm:px-5 lg:px-6`}>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-start gap-2 sm:gap-3">
              <motion.button whileTap={{ scale: 0.95 }} type="button" className="mt-0.5 rounded-xl p-2 text-slate-500 lg:hidden" onClick={() => setMobileMenuOpen(true)}>
                <Menu className="h-5 w-5" />
              </motion.button>
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2 text-[11px] text-slate-400">
                  <span className="capitalize">{role}</span>
                  <ChevronRight className="h-4 w-4 text-slate-300" />
                  <span className="truncate text-slate-500">{roleMeta.workspace}</span>
                </div>
                <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-2">
                  <span className="truncate text-[1.75rem] font-bold tracking-[-0.04em] text-slate-800 sm:text-[1.95rem]">{pageTitle}</span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-600">
                    {viewer?.name ?? "Loading user"}
                  </span>
                </div>
                <p className="mt-1 max-w-2xl text-[12px] text-slate-500">{roleMeta.summary}</p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className={`relative flex items-center gap-2 rounded-[20px] border border-slate-200 bg-gradient-to-r ${roleMeta.accent} px-3 py-2 shadow-[0_10px_24px_rgba(15,23,42,0.05)]`}>
                <div className="relative hidden md:block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => window.setTimeout(() => setSearchFocused(false), 120)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleSearchSelect();
                      }
                      if (event.key === "Escape") {
                        setSearchFocused(false);
                        setSearchQuery("");
                      }
                    }}
                    placeholder={searchPlaceholder}
                    className="h-11 w-[260px] rounded-2xl border border-white/70 bg-white/88 pl-10 pr-4 text-sm text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-[var(--ch-blue-border)] focus:shadow-[0_0_0_4px_rgba(74,142,219,0.12)]"
                  />
                  {searchFocused ? (
                    <div className="absolute left-0 top-[calc(100%+0.5rem)] z-50 w-full overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-[0_18px_44px_rgba(15,23,42,0.12)]">
                      {filteredSearchItems.length ? (
                        filteredSearchItems.map((item) => (
                          <button
                            key={`${item.href}-${item.label}`}
                            type="button"
                            onMouseDown={() => handleSearchSelect(item.href)}
                            className="flex w-full items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50 last:border-b-0"
                          >
                            <div>
                              <p className="text-sm font-medium text-slate-800">{item.label}</p>
                              <p className="mt-1 text-[11px] text-slate-500">{item.hint}</p>
                            </div>
                            <span className="text-[11px] font-medium text-[var(--ch-blue-dark)]">Open</span>
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-3 text-sm text-slate-500">No matching dashboard shortcuts found.</div>
                      )}
                    </div>
                  ) : null}
                </div>
                <div className="hidden sm:block"><LiveBadge /></div>
                <NotifBell role={role} user={viewer} />
                <Link href={primaryActionHref} className="inline-flex h-11 items-center rounded-2xl bg-[var(--ch-blue)] px-4 text-[14px] font-semibold text-white shadow-[0_10px_24px_rgba(74,142,219,0.18)] transition-all hover:opacity-95">
                  {role === "insurer" ? "Open Queue" : role === "hospital" ? "Submit Claim" : "My Claims"}
                </Link>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-5 sm:px-5 sm:py-6 lg:px-6">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}
