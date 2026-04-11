/**
 * Backend API Integration
 * Connects frontend to ClaimHeart backend services
 */

import { uploadFile, post, get, APIError } from "@/lib/apiClient";

export interface OCRUploadResponse {
  mode: string;
  filename: string;
  claim_id: string;
  status: string;
  extraction: {
    structured_data: any;
    unified_claim: any;
  };
  pipeline: {
    claim_id: string;
    pipeline_stages: {
      extraction: string;
      policy_evaluation: any;
      fraud_investigation: any;
      routing: any;
      mediator: any;
    };
    final_verdict: string;
    final_action: string;
    tat_report: any;
  };
}

export interface FraudDecisionRequest {
  claim_data: {
    claim_id: string;
    patient_id: string;
    claim_amount: number;
    diagnosis: string;
    hospital_stay_days?: number;
    incident_date?: string;
    previous_claims?: any[];
  };
  policy_rules?: any[];
  fraud_patterns?: any[];
  ocr_text?: string;
  ocr_confidence?: number;
}

export interface FraudDecisionResponse {
  decision: "APPROVE" | "FLAG" | "REJECT";
  confidence: number;
  risk_score: number;
  reasons: string[];
  signals: Array<{
    code: string;
    weight: number;
    reason: string;
    rule_id?: string;
    detected_value?: any;
    threshold_value?: any;
    metadata?: any;
  }>;
  metadata: any;
}

export interface RAGQueryRequest {
  question: string;
  claim_id?: string;
}

export interface RAGQueryResponse {
  answer: string;
  sources?: any[];
  policy_id?: string;
}

/**
 * Upload document for OCR and fraud detection
 */
export async function uploadDocument(
  file: File,
  onProgress?: (progress: number) => void
): Promise<OCRUploadResponse> {
  try {
    const response = await uploadFile<OCRUploadResponse>("/api/ocr/upload", file);
    return response;
  } catch (error) {
    if (error instanceof APIError) {
      throw new Error(`Upload failed: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Evaluate claim for fraud
 */
export async function evaluateFraud(
  request: FraudDecisionRequest
): Promise<FraudDecisionResponse> {
  try {
    const response = await post<FraudDecisionResponse>(
      "/api/fraud/decision",
      request
    );
    return response;
  } catch (error) {
    if (error instanceof APIError) {
      throw new Error(`Fraud evaluation failed: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Query patient context using RAG
 */
export async function queryPatientContext(
  claimId: string,
  question: string
): Promise<RAGQueryResponse> {
  try {
    const response = await post<RAGQueryResponse>("/api/rag/patient-chat", {
      claim_id: claimId,
      question,
    });
    return response;
  } catch (error) {
    if (error instanceof APIError) {
      throw new Error(`Patient query failed: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Query policy using RAG
 */
export async function queryPolicy(question: string): Promise<RAGQueryResponse> {
  try {
    const response = await post<RAGQueryResponse>("/api/rag/policy-chat", {
      question,
    });
    return response;
  } catch (error) {
    if (error instanceof APIError) {
      throw new Error(`Policy query failed: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Health check
 */
export async function checkBackendHealth(): Promise<{
  status: string;
  service: string;
  version: string;
}> {
  try {
    const response = await get("/api/health");
    return response;
  } catch (error) {
    throw new Error("Backend is not reachable");
  }
}

/**
 * Generate JWT token for authenticated user
 */
export async function generateJWTToken(
  uid: string,
  email: string,
  role: string
): Promise<{ access_token: string; token_type: string; expires_in: number }> {
  try {
    const response = await post("/api/auth/token", {
      uid,
      email,
      role,
    });
    return response;
  } catch (error) {
    if (error instanceof APIError) {
      throw new Error(`Token generation failed: ${error.message}`);
    }
    throw error;
  }
}

export default {
  uploadDocument,
  evaluateFraud,
  queryPatientContext,
  queryPolicy,
  checkBackendHealth,
  generateJWTToken,
};
