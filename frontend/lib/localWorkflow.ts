"use client";

import {
  createInsurerDemoWorkflowClaims,
  getDemoCaseById,
  type DemoCaseId,
} from "@/lib/demoWorkflow";
import type {
  AppUser,
  Claim,
  ClaimEmail,
  ClaimStatus,
  Comment,
  Notification,
  UploadedDocument,
  UserRole,
  WorkflowAuditEntry,
} from "@/types";

type LocalUserRecord = AppUser & {
  password: string;
};

const USERS_KEY = "claimheart.local.users";
const CLAIMS_KEY = "claims";
const NOTIFICATIONS_KEY = "notifications";
const SYNC_MODE_KEY = "claimheart.sync.mode";

const nowIso = () => new Date().toISOString();
const readJson = <T>(key: string, fallback: T): T => {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = <T>(key: string, value: T) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
};

const buildUserId = (role: UserRole) =>
  `${role[0].toUpperCase()}-${Math.random().toString(16).slice(2, 10).toUpperCase()}`;

const buildClaimId = () => `CLM-${Math.random().toString(16).slice(2, 10).toUpperCase()}`;
const buildClaimProcessId = () => `Id-claim${Date.now().toString().slice(-6)}`;
const buildCommentId = () => `COM-${Math.random().toString(16).slice(2, 10).toUpperCase()}`;
const buildNotificationId = () => `N-${Math.random().toString(16).slice(2, 12).toUpperCase()}`;
const buildEmailId = () => `MAIL-${Math.random().toString(16).slice(2, 12).toUpperCase()}`;

export const setSyncMode = (mode: "live" | "fallback") => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(SYNC_MODE_KEY, mode);
};

export const getSyncMode = (): "live" | "fallback" => {
  if (typeof window === "undefined") {
    return "fallback";
  }
  return (window.localStorage.getItem(SYNC_MODE_KEY) as "live" | "fallback" | null) ?? "fallback";
};

const pendingAgent = (reason: string) => ({ status: "pending" as const, reason });

const buildSeedNotifications = (claims: Claim[]): Notification[] => {
  const notifications: Notification[] = [];

  for (const claim of claims) {
    notifications.push({
      id: buildNotificationId(),
      targetRole: "insurer",
      claimId: claim.id,
      title: "Workflow claim available",
      message: `${claim.patientName} • ${claim.serviceType ?? "cashless"} • ${claim.status}`,
      type: claim.status === "under_review" ? "warning" : "info",
      read: false,
      time: claim.submittedAt,
    });

    notifications.push({
      id: buildNotificationId(),
      targetRole: "patient",
      targetUserId: claim.patientId,
      claimId: claim.id,
      title: "Claim status update",
      message: `Claim ${claim.id} is currently ${claim.status.replace("_", " ")}.`,
      type: claim.status === "approved" ? "success" : claim.status === "denied" ? "warning" : "info",
      read: false,
      time: claim.pipelineCompletedAt ?? claim.submittedAt,
    });
  }

  return notifications.sort((left, right) => new Date(right.time).getTime() - new Date(left.time).getTime());
};

export const ensureLocalWorkflowSeed = () => {
  const existingClaims = readJson<Claim[]>(CLAIMS_KEY, []);
  if (existingClaims.length > 0) {
    return;
  }

  const seededClaims = createInsurerDemoWorkflowClaims();
  writeJson(CLAIMS_KEY, seededClaims);
  writeJson(NOTIFICATIONS_KEY, buildSeedNotifications(seededClaims));
};

export const getLocalUsers = () => readJson<LocalUserRecord[]>(USERS_KEY, []);
export const getLocalClaims = () => {
  ensureLocalWorkflowSeed();
  return readJson<Claim[]>(CLAIMS_KEY, []);
};
export const getLocalNotifications = () => {
  ensureLocalWorkflowSeed();
  return readJson<Notification[]>(NOTIFICATIONS_KEY, []);
};

const saveLocalUsers = (users: LocalUserRecord[]) => writeJson(USERS_KEY, users);
const saveLocalClaims = (claims: Claim[]) => writeJson(CLAIMS_KEY, claims);
const saveLocalNotifications = (notifications: Notification[]) => writeJson(NOTIFICATIONS_KEY, notifications);

const addNotification = (notification: Notification) => {
  const notifications = [notification, ...getLocalNotifications()];
  saveLocalNotifications(notifications);
};

const notificationTimestamp = () => nowIso();

const addWorkflowNotification = (
  notification: Omit<Notification, "id" | "read" | "time"> & { time?: string },
) => {
  addNotification({
    id: buildNotificationId(),
    read: false,
    time: notification.time ?? notificationTimestamp(),
    ...notification,
  });
};

const appendWorkflowAudit = (claim: Claim, label: string, level: WorkflowAuditEntry["level"]) => {
  const auditTrail = [...(claim.auditTrail ?? []), { time: nowIso(), label, level }];
  return { ...claim, auditTrail };
};

const appendTimeline = (claim: Claim, label: string, actor: Claim["timeline"][number]["actor"]) => ({
  ...claim,
  timeline: [...claim.timeline, { label, time: nowIso(), actor }],
});

const updateClaim = (updatedClaim: Claim) => {
  const claims = getLocalClaims().map((claim) => (claim.id === updatedClaim.id ? updatedClaim : claim));
  saveLocalClaims(claims);
  return updatedClaim;
};

export const signupLocalUser = (payload: {
  name: string;
  email: string;
  phone?: string;
  password: string;
  role: UserRole;
}) => {
  const users = getLocalUsers();
  const normalizedEmail = payload.email.trim().toLowerCase();
  if (users.some((user) => user.email === normalizedEmail)) {
    throw new Error("An account with this email already exists.");
  }

  const user: LocalUserRecord = {
    id: buildUserId(payload.role),
    uid: buildUserId(payload.role).toLowerCase(),
    role: payload.role,
    name: payload.name.trim(),
    email: normalizedEmail,
    phone: payload.phone?.trim() || undefined,
    patientId: payload.role === "patient" ? buildUserId("patient") : undefined,
    authProvider: "password",
    password: payload.password,
  };

  saveLocalUsers([...users, user]);
  const { password, ...appUser } = user;
  return appUser satisfies AppUser;
};

export const loginLocalUser = (email: string, password: string, role: UserRole) => {
  const user = getLocalUsers().find(
    (entry) => entry.email === email.trim().toLowerCase() && entry.password === password && entry.role === role,
  );

  if (!user) {
    throw new Error("Incorrect email or password.");
  }

  const { password: _password, ...appUser } = user;
  return appUser satisfies AppUser;
};

export const updateLocalUser = (userId: string, updates: Partial<AppUser>) => {
  const users = getLocalUsers();
  const index = users.findIndex((user) => user.id === userId);
  if (index === -1) {
    throw new Error("User not found.");
  }

  users[index] = { ...users[index], ...updates };
  saveLocalUsers(users);
  const { password, ...appUser } = users[index];
  return appUser satisfies AppUser;
};

export const getLocalBootstrap = (user: AppUser) => {
  const claims = getLocalClaims();
  const notifications = getLocalNotifications();

  const filteredClaims =
    user.role === "patient"
      ? claims.filter((claim) => claim.patientId === (user.patientId ?? user.id))
      : user.role === "hospital"
        ? claims.filter((claim) => claim.hospital === user.name)
        : claims;

  const filteredNotifications = notifications.filter((notification) => {
    const matchesRole = notification.targetRole === user.role || notification.targetRole === "all";
    const matchesUser =
      !notification.targetUserId ||
      notification.targetUserId === user.id ||
      notification.targetUserId === user.patientId;
    return matchesRole && matchesUser;
  });

  return {
    claims: filteredClaims.sort((left, right) => new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime()),
    notifications: filteredNotifications.sort((left, right) => new Date(right.time).getTime() - new Date(left.time).getTime()),
  };
};

export const submitLocalClaim = (claimInput: Partial<Claim>) => {
  const submittedAt = nowIso();
  const claim: Claim = {
    id: buildClaimId(),
    claimProcessId: buildClaimProcessId(),
    submittedAt,
    status: "pending",
    riskScore: claimInput.riskScore ?? 0,
    timeline: claimInput.timeline ?? [
      { label: "Claim submitted by hospital", time: submittedAt, actor: "hospital" },
      { label: "AI review queued", time: new Date(Date.now() + 1_000).toISOString(), actor: "system" },
    ],
    aiResults: claimInput.aiResults ?? {
      policy: pendingAgent("Policy agent is queued."),
      medical: pendingAgent("Medical agent is queued."),
      cross: pendingAgent("Fraud agent is queued."),
    },
    documents: claimInput.documents ?? [],
    comments: claimInput.comments ?? [],
    emails: claimInput.emails ?? [],
    caseType: claimInput.caseType ?? "planned",
    serviceType: claimInput.serviceType ?? "cashless",
    diagnosis: claimInput.diagnosis ?? "",
    icdCode: claimInput.icdCode ?? "",
    amount: claimInput.amount ?? 0,
    patientId: claimInput.patientId ?? "",
    patientName: claimInput.patientName ?? "",
    patientEmail: claimInput.patientEmail,
    hospital: claimInput.hospital ?? "",
    workflowCaseId: claimInput.workflowCaseId,
    caseLabel: claimInput.caseLabel,
    policyNumber: claimInput.policyNumber,
    policyStartDate: claimInput.policyStartDate,
    insurerName: claimInput.insurerName,
    hospitalRegNo: claimInput.hospitalRegNo,
    attendingDoctor: claimInput.attendingDoctor,
    amountApproved: 0,
    workflowState: claimInput.workflowState ?? "submitted",
    auditTrail: claimInput.auditTrail ?? [
      { time: submittedAt, label: "Claim submitted into the local demo workflow.", level: "info" },
    ],
  };

  const claims = [claim, ...getLocalClaims()];
  saveLocalClaims(claims);

  addNotification({
    id: buildNotificationId(),
    targetRole: "insurer",
    claimId: claim.id,
    title: "New claim received",
    message: `${claim.patientName} - Rs ${Number(claim.amount).toLocaleString("en-IN")} from ${claim.hospital}`,
    type: "info",
    read: false,
    time: submittedAt,
  });
  addNotification({
    id: buildNotificationId(),
    targetRole: "patient",
    targetUserId: claim.patientId,
    claimId: claim.id,
    title: "Claim submitted",
    message: `Your claim ${claim.id} has been submitted and is being processed.`,
    type: "info",
    read: false,
    time: submittedAt,
  });

  return claim;
};

export const addLocalClaimDocument = (claimId: string, document: UploadedDocument, uploaderRole: UserRole) => {
  const claim = getLocalClaims().find((entry) => entry.id === claimId);
  if (!claim) {
    return null;
  }

  const updated = appendWorkflowAudit(
    appendTimeline(
      { ...claim, documents: [...claim.documents, document] },
      `Document uploaded by ${uploaderRole}: ${document.name}`,
      uploaderRole,
    ),
    `${uploaderRole} added ${document.name}.`,
    "info",
  );

  updateClaim(updated);
  addNotification({
    id: buildNotificationId(),
    targetRole: "insurer",
    claimId,
    title: "New document uploaded",
    message: `${document.name} added to claim ${claimId} by ${uploaderRole}.`,
    type: "info",
    read: false,
    time: nowIso(),
  });
  return updated;
};

export const addLocalClaimComment = (
  claimId: string,
  payload: { text: string; author: string; role: UserRole; visibleTo: Comment["visibleTo"] },
) => {
  const claim = getLocalClaims().find((entry) => entry.id === claimId);
  if (!claim) {
    return null;
  }

  const comment: Comment = {
    id: buildCommentId(),
    text: payload.text,
    author: payload.author,
    role: payload.role,
    time: nowIso(),
    visibleTo: payload.visibleTo,
  };

  const updated = appendWorkflowAudit(
    appendTimeline({ ...claim, comments: [comment, ...claim.comments] }, `Comment added by ${payload.role}`, payload.role),
    `${payload.role} added a collaboration note.`,
    "info",
  );

  updateClaim(updated);
  const visibleRoles = new Set<Comment["visibleTo"][number]>(payload.visibleTo.length > 0 ? payload.visibleTo : ["all"]);
  if (visibleRoles.has("all")) {
    visibleRoles.clear();
    visibleRoles.add("patient");
    visibleRoles.add("hospital");
    visibleRoles.add("insurer");
  }
  visibleRoles.delete(payload.role);

  for (const role of visibleRoles) {
    if (role === "all") {
      continue;
    }
    addWorkflowNotification({
      targetRole: role,
      targetUserId: role === "patient" ? claim.patientId : undefined,
      claimId,
      title: "New workflow comment",
      message: `${payload.author} added a note on claim ${claimId}.`,
      type: "info",
    });
  }
  return updated;
};

export const requestLocalDocuments = (claimId: string, requestNote: string) => {
  const claim = getLocalClaims().find((entry) => entry.id === claimId);
  if (!claim) {
    return null;
  }

  const updated = appendWorkflowAudit(
    appendTimeline(
      { ...claim, status: "under_review", decisionNote: requestNote, workflowState: "completed" },
      `Documents requested by insurer: ${requestNote}`,
      "insurer",
    ),
    "Insurer requested more supporting documents.",
    "warning",
  );

  updateClaim(updated);
  addNotification({
    id: buildNotificationId(),
    targetRole: claim.serviceType === "reimbursement" ? "patient" : "hospital",
    targetUserId: claim.serviceType === "reimbursement" ? claim.patientId : undefined,
    claimId,
    title: "Action required - documents needed",
    message: `Additional documents were requested for ${claimId}: ${requestNote}`,
    type: "action",
    read: false,
    time: nowIso(),
  });
  return updated;
};

export const recordLocalDecision = (claimId: string, status: ClaimStatus, note?: string) => {
  const claim = getLocalClaims().find((entry) => entry.id === claimId);
  if (!claim) {
    return null;
  }

  const updatedClaim: Claim = {
    ...claim,
    status,
    decisionNote: note ?? claim.decisionNote,
    amountApproved: status === "approved" ? claim.amount : claim.amountApproved ?? 0,
    workflowState: "completed",
  };
  const withTimeline = appendTimeline(
    updatedClaim,
    status === "approved"
      ? "Approved by insurer"
      : status === "denied"
        ? "Denied by insurer"
        : "Placed under manual review by insurer",
    "insurer",
  );
  const finalClaim = appendWorkflowAudit(
    {
      ...withTimeline,
      decisionLetter:
        claim.decisionLetter ??
        `Dear ${claim.patientName},\n\nClaim ${claim.id} is now ${status.replace("_", " ")}.\n\nNotes:\n${note ?? "Please check your insurer dashboard for details."}`,
      emails: [
        {
          id: buildEmailId(),
          to: claim.patientEmail ?? "patient@claimheart.ai",
          subject: `Claim update for ${claim.id}`,
          body: note ?? `Claim ${claim.id} is now ${status.replace("_", " ")}.`,
          sentAt: nowIso(),
          sentBy: "ClaimHeart Decision Desk",
          status: "sent",
        } satisfies ClaimEmail,
        ...(claim.emails ?? []),
      ],
    },
    `Insurer marked the claim as ${status.replace("_", " ")}.`,
    status === "approved" ? "success" : "warning",
  );

  updateClaim(finalClaim);
  addNotification({
    id: buildNotificationId(),
    targetRole: "patient",
    targetUserId: claim.patientId,
    claimId,
    title: "Claim update",
    message: `Your claim ${claim.id} is now ${status.replace("_", " ")}.`,
    type: status === "approved" ? "success" : "warning",
    read: false,
    time: nowIso(),
  });
  return finalClaim;
};

export const runLocalClaimPipeline = (claimId: string) => {
  const claim = getLocalClaims().find((entry) => entry.id === claimId);
  if (!claim) {
    throw new Error("Claim not found.");
  }

  const now = Date.now();
  const workflowCaseId = claim.workflowCaseId as DemoCaseId | undefined;
  const seededCase = workflowCaseId ? getDemoCaseById(workflowCaseId) : null;

  const policyAgent =
    seededCase?.agentResults.policy ??
    (claim.policyNumber
      ? { status: "pass" as const, reason: "Policy number matched and coverage rules were checked.", confidence: 91 }
      : { status: "flag" as const, reason: "Policy number is missing, so manual verification is required.", confidence: 74 });

  const medicalAgent =
    seededCase?.agentResults.medical ??
    (claim.serviceType === "reimbursement" && !claim.documents.some((document) => /discharge/i.test(`${document.name} ${document.category ?? ""}`))
      ? { status: "flag" as const, reason: "Discharge summary is missing from the reimbursement packet.", confidence: 70 }
      : { status: "pass" as const, reason: "Medical packet includes the required core documents.", confidence: 88 });

  const fraudAgent =
    seededCase?.agentResults.cross ??
    (claim.amount > 200000
      ? { status: "flag" as const, reason: "High claim value triggered a manual fraud review.", confidence: 82 }
      : { status: "pass" as const, reason: "No suspicious cross-document mismatch was detected.", confidence: 90 });

  const nextStatus: ClaimStatus =
    seededCase?.finalStatus ??
    (policyAgent.status === "flag" || medicalAgent.status === "flag" || fraudAgent.status === "flag" ? "under_review" : "approved");
  const verdict = nextStatus === "approved" ? "CLEAN_APPROVED" : seededCase?.finalStatus === "denied" ? "ESCALATE_HUMAN" : "ESCALATE_HUMAN";

  let updatedClaim: Claim = {
    ...claim,
    workflowState: "completed",
    pipelineCompletedAt: new Date(now).toISOString(),
    aiResults: {
      policy: policyAgent,
      medical: medicalAgent,
      cross: fraudAgent,
    },
    riskScore: seededCase?.riskScore ?? (fraudAgent.status === "flag" ? 82 : 24),
    status: nextStatus,
    amountApproved: nextStatus === "approved" ? seededCase?.amountApproved ?? claim.amount : 0,
    decisionNote:
      seededCase?.decisionNote ??
      (nextStatus === "approved"
        ? "The fallback workflow cleared policy, medical, and fraud checks."
        : "The fallback workflow routed this case to manual review for transparency."),
    decisionLetter: seededCase?.decisionLetter ?? claim.decisionLetter,
    auditTrail: [
      ...(claim.auditTrail ?? []),
      { time: new Date(now - 4_000).toISOString(), label: "Document intake synchronized into the review queue.", level: "info" },
      { time: new Date(now - 3_000).toISOString(), label: "Policy agent completed its rule review.", level: policyAgent.status === "flag" ? "warning" : "success" },
      { time: new Date(now - 2_000).toISOString(), label: "Medical agent completed document validation.", level: medicalAgent.status === "flag" ? "warning" : "success" },
      { time: new Date(now - 1_000).toISOString(), label: "Fraud / cross-check agent finalized routing.", level: fraudAgent.status === "flag" ? "warning" : "success" },
      {
        time: new Date(now - 750).toISOString(),
        label: `Policy agent marked the claim as ${policyAgent.status}. ${policyAgent.reason}`,
        level: policyAgent.status === "flag" ? "warning" : policyAgent.status === "pass" ? "success" : "info",
      },
      {
        time: new Date(now - 500).toISOString(),
        label: `Medical agent marked the claim as ${medicalAgent.status}. ${medicalAgent.reason}`,
        level: medicalAgent.status === "flag" ? "warning" : medicalAgent.status === "pass" ? "success" : "info",
      },
      {
        time: new Date(now - 250).toISOString(),
        label: `Cross-check agent marked the claim as ${fraudAgent.status}. ${fraudAgent.reason}`,
        level: fraudAgent.status === "flag" ? "warning" : fraudAgent.status === "pass" ? "success" : "info",
      },
      {
        time: new Date(now - 100).toISOString(),
        label: `Workflow routing verdict: ${verdict} with risk score ${seededCase?.riskScore ?? (fraudAgent.status === "flag" ? 82 : 24)}.`,
        level: "info",
      },
      { time: new Date(now).toISOString(), label: nextStatus === "approved" ? "Workflow completed with approval." : "Workflow completed with manual review routing.", level: nextStatus === "approved" ? "success" : "warning" },
    ],
    timeline: [
      ...claim.timeline,
      { label: "Document intake complete", time: new Date(now - 4_000).toISOString(), actor: "system" },
      { label: "Policy agent decision published", time: new Date(now - 3_000).toISOString(), actor: "system" },
      { label: "Medical agent decision published", time: new Date(now - 2_000).toISOString(), actor: "system" },
      { label: "Fraud agent decision published", time: new Date(now - 1_000).toISOString(), actor: "system" },
      {
        label:
          nextStatus === "approved"
            ? "Approved by insurer workflow"
            : "Escalated to manual review by insurer workflow",
        time: new Date(now).toISOString(),
        actor: "insurer",
      },
    ],
  };

  updatedClaim = updateClaim(updatedClaim);
  if (nextStatus === "approved") {
    addWorkflowNotification({
      targetRole: "patient",
      targetUserId: updatedClaim.patientId,
      claimId,
      title: "Claim approved",
      message: `Claim ${claimId} was approved after the fallback workflow.`,
      type: "success",
    });
    addWorkflowNotification({
      targetRole: "hospital",
      claimId,
      title: "Claim approved",
      message: `Claim ${claimId} cleared the fallback workflow and is approved.`,
      type: "success",
    });
  } else {
    addWorkflowNotification({
      targetRole: "insurer",
      claimId,
      title: "Human verification needed",
      message: `Claim ${claimId} needs manual review after the fallback workflow.`,
      type: "warning",
    });
    addWorkflowNotification({
      targetRole: "patient",
      targetUserId: updatedClaim.patientId,
      claimId,
      title: "Claim moved to manual review",
      message: `Claim ${claimId} needs human verification before a final decision is made.`,
      type: "warning",
    });
    addWorkflowNotification({
      targetRole: "hospital",
      claimId,
      title: "Claim moved to manual review",
      message: `Claim ${claimId} needs additional insurer review after the fallback workflow.`,
      type: "warning",
    });
  }

  return {
    claim: updatedClaim,
    pipeline_result: {
      mode: "fallback",
      final_verdict: verdict,
      pipeline_stages: {
        policy: policyAgent,
        medical: medicalAgent,
        fraud: fraudAgent,
      },
    },
  };
};

export const markLocalNotificationRead = (notificationId: string) => {
  const notifications = getLocalNotifications().map((notification) =>
    notification.id === notificationId ? { ...notification, read: true } : notification,
  );
  saveLocalNotifications(notifications);
};

export const markAllLocalNotificationsRead = (role: UserRole, userId?: string) => {
  const notifications = getLocalNotifications().map((notification) => {
    const matchesRole = notification.targetRole === role || notification.targetRole === "all";
    const matchesUser = !notification.targetUserId || notification.targetUserId === userId;
    return matchesRole && matchesUser ? { ...notification, read: true } : notification;
  });

  saveLocalNotifications(notifications);
};
