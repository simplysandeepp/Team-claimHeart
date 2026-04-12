"use client";

import { apiRequest } from "@/lib/apiClient";
import { getCurrentUser } from "@/lib/api/auth";
import { markAllLocalNotificationsRead, markLocalNotificationRead, setSyncMode } from "@/lib/localWorkflow";
import { useAppStore } from "@/store/useAppStore";
import type { UserRole } from "@/types";

export const markNotificationRead = async (notificationId: string) => {
  useAppStore.getState().markNotificationRead(notificationId);
  try {
    await apiRequest(`/api/workflow/notifications/${notificationId}/read`, {
      method: "POST",
    });
    setSyncMode("live");
  } catch {
    markLocalNotificationRead(notificationId);
    setSyncMode("fallback");
  }
};

export const markAllNotificationsRead = async (role: UserRole, userId?: string) => {
  const currentUser = await getCurrentUser();
  useAppStore.getState().markAllNotificationsRead(role, userId);

  const params = new URLSearchParams();
  params.set("role", role);
  if (userId) {
    params.set("user_id", userId);
  }
  if (currentUser?.patientId) {
    params.set("patient_id", currentUser.patientId);
  }

  try {
    await apiRequest(`/api/workflow/notifications/read-all?${params.toString()}`, {
      method: "POST",
    });
    setSyncMode("live");
  } catch {
    markAllLocalNotificationsRead(role, userId);
    setSyncMode("fallback");
  }
};
