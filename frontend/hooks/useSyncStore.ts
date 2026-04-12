"use client";

import { useEffect } from "react";
import { getCurrentUser, subscribeToCurrentUser } from "@/lib/api/auth";
import { syncWorkflowSnapshot } from "@/lib/api/claims";
import { useAppStore } from "@/store/useAppStore";

export function useSyncStore() {
  useEffect(() => {
    let active = true;

    const sync = async () => {
      try {
        const user = await getCurrentUser();
        if (!active) {
          return;
        }
        await syncWorkflowSnapshot(user);
      } catch {
        if (!active) {
          return;
        }
        useAppStore.getState().setClaims([]);
        useAppStore.getState().setNotifications([]);
      }
    };

    void sync();
    const unsubscribe = subscribeToCurrentUser(() => {
      void sync();
    });

    const interval = window.setInterval(() => {
      void sync();
    }, 4000);

    const handleStorage = (event: StorageEvent) => {
      if (event.key === "claims" || event.key === "notifications" || event.key === "claimheart.sync.mode") {
        void sync();
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void sync();
      }
    };

    const handleFocus = () => {
      void sync();
    };

    window.addEventListener("storage", handleStorage);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
      unsubscribe();
    };
  }, []);
}
