/**
 * Application Constants
 */

// API Configuration
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
export const API_TIMEOUT = Number(process.env.NEXT_PUBLIC_API_TIMEOUT) || 30000;

// API Endpoints
export const API_ENDPOINTS = {
  // Health
  HEALTH: "/api/health",

  // Authentication
  AUTH_TOKEN: "/api/auth/token",
  AUTH_REFRESH: "/api/auth/refresh",

  // OCR & Processing
  OCR_UPLOAD: "/api/ocr/upload",
  OCR_PROCESS_LOCAL: "/api/ocr/process-local",

  // Fraud Detection
  FRAUD_DECISION: "/api/fraud/decision",

  // RAG Queries
  RAG_PATIENT_CHAT: "/api/rag/patient-chat",
  RAG_POLICY_CHAT: "/api/rag/policy-chat",
} as const;

// User Roles
export const USER_ROLES = {
  PATIENT: "patient",
  HOSPITAL: "hospital",
  INSURER: "insurer",
} as const;

// Claim Statuses
export const CLAIM_STATUSES = {
  PENDING: "pending",
  UNDER_REVIEW: "under_review",
  APPROVED: "approved",
  DENIED: "denied",
} as const;

// Fraud Decisions
export const FRAUD_DECISIONS = {
  APPROVE: "APPROVE",
  FLAG: "FLAG",
  REJECT: "REJECT",
} as const;

// Local Storage Keys
export const STORAGE_KEYS = {
  JWT_TOKEN: "claimheart.jwt_token",
  CURRENT_USER: "claimheart.currentUser",
  ROLE: "claimheart.role",
} as const;

// File Upload
export const FILE_UPLOAD = {
  MAX_SIZE_MB: 10,
  MAX_SIZE_BYTES: 10 * 1024 * 1024,
  ALLOWED_TYPES: ["image/jpeg", "image/png", "image/jpg", "application/pdf"],
  ALLOWED_EXTENSIONS: [".jpg", ".jpeg", ".png", ".pdf"],
} as const;

// Feature Flags
export const FEATURES = {
  ENABLE_BACKEND_INTEGRATION: true,
  ENABLE_MOCK_DATA: false,
  ENABLE_REAL_TIME_UPDATES: false,
  ENABLE_NOTIFICATIONS: true,
} as const;

export default {
  API_BASE_URL,
  API_TIMEOUT,
  API_ENDPOINTS,
  USER_ROLES,
  CLAIM_STATUSES,
  FRAUD_DECISIONS,
  STORAGE_KEYS,
  FILE_UPLOAD,
  FEATURES,
};
