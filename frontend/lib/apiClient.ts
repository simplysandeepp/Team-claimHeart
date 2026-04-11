/**
 * API Client for ClaimHeart Backend
 * Provides centralized HTTP client with error handling and auth
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const API_TIMEOUT = Number(process.env.NEXT_PUBLIC_API_TIMEOUT) || 30000;

export class APIError extends Error {
  constructor(
    message: string,
    public status?: number,
    public data?: any
  ) {
    super(message);
    this.name = "APIError";
  }
}

export interface APIClientConfig {
  headers?: Record<string, string>;
  timeout?: number;
  token?: string;
}

/**
 * Make HTTP request to backend API
 */
async function request<T = any>(
  endpoint: string,
  options: RequestInit & { timeout?: number } = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const timeout = options.timeout || API_TIMEOUT;

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    clearTimeout(timeoutId);

    // Handle non-OK responses
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new APIError(
        errorData.detail || `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        errorData
      );
    }

    // Parse JSON response
    const data = await response.json();
    return data as T;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof APIError) {
      throw error;
    }

    if (error instanceof Error) {
      if (error.name === "AbortError") {
        throw new APIError("Request timeout", 408);
      }
      throw new APIError(error.message);
    }

    throw new APIError("Unknown error occurred");
  }
}

/**
 * GET request
 */
export async function get<T = any>(
  endpoint: string,
  config?: APIClientConfig
): Promise<T> {
  return request<T>(endpoint, {
    method: "GET",
    headers: config?.headers,
    timeout: config?.timeout,
  });
}

/**
 * POST request
 */
export async function post<T = any>(
  endpoint: string,
  data?: any,
  config?: APIClientConfig
): Promise<T> {
  return request<T>(endpoint, {
    method: "POST",
    headers: config?.headers,
    body: JSON.stringify(data),
    timeout: config?.timeout,
  });
}

/**
 * PUT request
 */
export async function put<T = any>(
  endpoint: string,
  data?: any,
  config?: APIClientConfig
): Promise<T> {
  return request<T>(endpoint, {
    method: "PUT",
    headers: config?.headers,
    body: JSON.stringify(data),
    timeout: config?.timeout,
  });
}

/**
 * DELETE request
 */
export async function del<T = any>(
  endpoint: string,
  config?: APIClientConfig
): Promise<T> {
  return request<T>(endpoint, {
    method: "DELETE",
    headers: config?.headers,
    timeout: config?.timeout,
  });
}

/**
 * Upload file with multipart/form-data
 */
export async function uploadFile<T = any>(
  endpoint: string,
  file: File,
  additionalData?: Record<string, string>,
  config?: APIClientConfig
): Promise<T> {
  const formData = new FormData();
  formData.append("file", file);

  if (additionalData) {
    Object.entries(additionalData).forEach(([key, value]) => {
      formData.append(key, value);
    });
  }

  const url = `${API_BASE_URL}${endpoint}`;
  const timeout = config?.timeout || API_TIMEOUT;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: config?.headers,
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new APIError(
        errorData.detail || `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        errorData
      );
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof APIError) {
      throw error;
    }

    if (error instanceof Error) {
      if (error.name === "AbortError") {
        throw new APIError("Upload timeout", 408);
      }
      throw new APIError(error.message);
    }

    throw new APIError("Upload failed");
  }
}

/**
 * Get auth headers with JWT token
 */
export function getAuthHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Health check endpoint
 */
export async function healthCheck(): Promise<{ status: string; service: string }> {
  return get("/api/health");
}

export default {
  get,
  post,
  put,
  delete: del,
  uploadFile,
  healthCheck,
  getAuthHeaders,
};
