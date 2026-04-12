"use client";

import { useEffect, useState } from "react";
import { getApiBaseUrl } from "@/lib/apiClient";
import { formatRelativeTime } from "@/lib/claimUi";
import { getSyncMode } from "@/lib/localWorkflow";
import { useAppStore } from "@/store/useAppStore";

export default function LiveBadge() {
  const lastSyncAt = useAppStore((state) => state.lastSyncAt);
  const [flash, setFlash] = useState(false);
  const [syncMode, setSyncMode] = useState<"live" | "fallback">("fallback");
  const [relativeLabel, setRelativeLabel] = useState("Waiting for sync");
  const [apiLabel, setApiLabel] = useState("");

  useEffect(() => {
    if (!lastSyncAt) {
      return;
    }

    setFlash(true);
    const timer = window.setTimeout(() => setFlash(false), 900);
    return () => window.clearTimeout(timer);
  }, [lastSyncAt]);

  useEffect(() => {
    const refresh = () => {
      setSyncMode(getSyncMode());
      setRelativeLabel(lastSyncAt ? `Updated ${formatRelativeTime(new Date(lastSyncAt).toISOString())}` : "Waiting for sync");
      setApiLabel(getApiBaseUrl());
    };

    refresh();
    const interval = window.setInterval(refresh, 15_000);
    window.addEventListener("storage", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("storage", refresh);
    };
  }, [lastSyncAt]);

  return (
    <div
      className={`inline-flex items-center gap-3 rounded-full border px-3 py-1.5 text-xs font-semibold ${
        flash
          ? syncMode === "live"
            ? "border-green-300 bg-green-50 text-green-700"
            : "border-amber-300 bg-amber-50 text-amber-700"
          : "border-slate-200 bg-white text-slate-600"
      }`}
    >
      <span
        className={`h-2.5 w-2.5 rounded-full ${
          flash ? "animate-pulse-dot" : ""
        } ${syncMode === "live" ? "bg-green-500" : "bg-amber-500"}`}
      />
      <span>{syncMode === "live" ? "Backend live" : "Fallback mode"}</span>
      <span className="hidden text-slate-400 lg:inline">
        {syncMode === "live" ? apiLabel : "Local browser storage"}
      </span>
      <span className="hidden text-slate-400 xl:inline">{relativeLabel}</span>
    </div>
  );
}
