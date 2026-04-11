"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Activity, ArrowUpRight } from "lucide-react";
import ClaimHeartLogo from "@/components/ui/ClaimHeartLogo";
import { AUTH_IMAGE_SET, AUTH_ROLE_META } from "@/components/pages/authMeta";
import type { UserRole } from "@/types";

type AuthShowcaseProps = {
  mode: "login" | "signup";
  role: UserRole;
  className?: string;
};

const SCREEN_COPY = {
  login: {
    badge: "Secure access",
    title: "Sign in to the right claims workspace.",
    description: "Patients, hospitals, and insurers enter the same platform with the context that matches their role.",
    ribbon: "ClaimHeart auth",
  },
  signup: {
    badge: "Fast onboarding",
    title: "Create an account and start using the system quickly.",
    description: "Keep signup short, collect the essentials, and move the rest into profile completion later.",
    ribbon: "ClaimHeart signup",
  },
} as const;

const marqueeImages = [...AUTH_IMAGE_SET, ...AUTH_IMAGE_SET];

export default function AuthShowcase({ mode, role, className = "" }: AuthShowcaseProps) {
  const roleMeta = AUTH_ROLE_META[role];
  const RoleIcon = roleMeta.icon;
  const screen = SCREEN_COPY[mode];
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % AUTH_IMAGE_SET.length);
    }, 3200);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <section
      className={[
        "relative flex flex-col overflow-hidden bg-[linear-gradient(160deg,#0a1727_0%,#133a63_46%,#1f5a8f_100%)] p-5 text-white sm:p-6 lg:p-7",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.14),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(125,211,252,0.14),transparent_30%)]" />
      <div className="pointer-events-none absolute -left-16 top-12 h-44 w-44 rounded-full bg-white/[0.08] blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-56 w-56 rounded-full bg-sky-200/10 blur-3xl" />

      <div className="relative z-10 flex h-full min-h-0 flex-col gap-4">
        <div className="shrink-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/10 p-1 backdrop-blur">
                <ClaimHeartLogo className="h-full w-full" imageClassName="scale-110" priority={mode === "login"} />
              </div>
              <div>
                <p className="text-[17px] font-bold tracking-[-0.04em] text-white">ClaimHeart</p>
                <p className="text-[12px] text-white/65">Claims platform</p>
              </div>
            </div>

            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/85 backdrop-blur">
              <Activity className="h-3 w-3" />
              {screen.badge}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-sky-200/20 bg-white/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-100">
              <RoleIcon className="h-3 w-3" />
              {roleMeta.label}
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/80">
              <ArrowUpRight className="h-3 w-3 text-sky-200" />
              {screen.ribbon}
            </div>
          </div>

          <h1 className="max-w-2xl text-[1.65rem] font-bold leading-[1.18] tracking-[-0.05em] text-white sm:text-[1.85rem] xl:text-[2rem]">
            {screen.title}
          </h1>

          <p className="max-w-2xl text-[13px] leading-[1.65] text-white/72 sm:text-sm">
            {screen.description}
          </p>

          <div className="flex flex-wrap gap-2">
            {roleMeta.bullets.slice(0, 3).map((item) => (
              <div key={item} className="inline-flex items-center rounded-full border border-white/12 bg-white/10 px-3 py-1.5 text-[12px] font-medium text-white/80 backdrop-blur">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col rounded-[1.4rem] border border-white/12 bg-white/[0.07] p-3 shadow-[0_18px_44px_rgba(8,15,30,0.28)] backdrop-blur-md sm:p-3.5">
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-[1.25rem] border border-white/10 bg-slate-950/20">
            <motion.div
              animate={{ x: `-${activeIndex * 100}%` }}
              transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
              className="flex h-full"
            >
              {AUTH_IMAGE_SET.map((image, index) => (
                <div key={image.src} className="relative h-full w-full shrink-0">
                  <Image
                    src={image.src}
                    alt={image.alt}
                    fill
                    loading={index === 0 ? "eager" : "lazy"}
                    sizes="(max-width: 1279px) 100vw, 46vw"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,15,30,0.08),rgba(8,15,30,0.14)_35%,rgba(8,15,30,0.72)_100%)]" />
                  <motion.div
                    key={`${image.src}-${activeIndex}`}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: index === activeIndex ? 1 : 0.6, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="absolute inset-x-3 bottom-3 sm:inset-x-4 sm:bottom-4"
                  >
                    <div className="max-w-lg rounded-[1.1rem] border border-white/12 bg-slate-950/45 p-3 backdrop-blur-md sm:p-3.5">
                      <p className="inline-flex rounded-full border border-white/12 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white">
                        {image.label}
                      </p>
                    </div>
                  </motion.div>
                </div>
              ))}
            </motion.div>
          </div>

          <div className="mt-2.5 flex shrink-0 items-center justify-between gap-4">
            <div className="flex gap-1.5">
              {AUTH_IMAGE_SET.map((image, index) => (
                <button
                  key={image.src}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={`h-2 rounded-full transition-all ${index === activeIndex ? "w-7 bg-white" : "w-2 bg-white/35 hover:bg-white/55"}`}
                  aria-label={`Show ${image.label}`}
                />
              ))}
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">Image slider</p>
          </div>

          <div className="mt-2.5 shrink-0 overflow-hidden rounded-[1.1rem] border border-white/10 bg-slate-950/20 p-2">
            <motion.div
              animate={{ x: ["0%", "-50%"] }}
              transition={{ duration: 18, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
              className="flex min-w-max gap-2"
            >
              {marqueeImages.map((image, index) => (
                <div
                  key={`${image.src}-${index}`}
                  className="group relative h-[4.5rem] w-24 shrink-0 overflow-hidden rounded-[0.85rem] border border-white/10 sm:h-20 sm:w-32"
                >
                  <Image
                    src={image.src}
                    alt={image.alt}
                    fill
                    sizes="128px"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/15 to-transparent" />
                  <div className="absolute bottom-1.5 left-1.5 rounded-full border border-white/10 bg-slate-950/45 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
                    {image.label}
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
