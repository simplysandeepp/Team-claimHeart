"use client";

import { useState } from "react";
import { uploadDocument, checkBackendHealth } from "@/lib/api/backend";
import { Upload, CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function DemoPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState<string>("unknown");

  const checkBackend = async () => {
    try {
      const health = await checkBackendHealth();
      setBackendStatus("connected");
      console.log("Backend health:", health);
    } catch (err) {
      setBackendStatus("disconnected");
      console.error("Backend check failed:", err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file first");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      console.log("Uploading file:", file.name);
      const response = await uploadDocument(file);
      console.log("Pipeline result:", response);
      setResult(response);
    } catch (err: any) {
      console.error("Upload error:", err);
      setError(err.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            ClaimHeart Multi-Agent Demo
          </h1>
          <p className="text-gray-600">
            Upload a medical document to see the complete AI agent workflow
          </p>
          
          {/* Backend Status */}
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={checkBackend}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Check Backend
            </button>
            <div className="flex items-center gap-2">
              {backendStatus === "connected" && (
                <>
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-green-600 font-medium">Backend Connected</span>
                </>
              )}
              {backendStatus === "disconnected" && (
                <>
                  <XCircle className="w-5 h-5 text-red-600" />
                  <span className="text-red-600 font-medium">Backend Disconnected</span>
                </>
              )}
              {backendStatus === "unknown" && (
                <span className="text-gray-500">Status unknown - click to check</span>
              )}
            </div>
          </div>
        </div>

        {/* Upload Section */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Upload Document
          </h2>
          
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer text-blue-600 hover:text-blue-700 font-medium"
              >
                Choose a file
              </label>
              <p className="text-sm text-gray-500 mt-2">
                PNG, JPG, or PDF (max 10MB)
              </p>
              {file && (
                <p className="mt-4 text-sm text-gray-700 font-medium">
                  Selected: {file.name}
                </p>
              )}
            </div>

            <button
              onClick={handleUpload}
              disabled={!file || loading}
              className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition font-medium flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing through pipeline...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  Process Document
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 font-medium">Error: {error}</p>
            </div>
          )}
        </div>

        {/* Results Section */}
        {result && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Pipeline Results
            </h2>

            {/* Agent Flow */}
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-800 mb-3">
                Multi-Agent Workflow
              </h3>
              <div className="space-y-2">
                <AgentStep
                  name="Agent 01: Extractor"
                  status="complete"
                  description="OCR + Entity Extraction"
                />
                <AgentStep
                  name="Agent A2: Policy"
                  status="complete"
                  description="Policy Compliance Check"
                  data={result.pipeline?.pipeline_stages?.policy_evaluation}
                />
                <AgentStep
                  name="Agent A3: Fraud"
                  status="complete"
                  description="Fraud Detection & Risk Analysis"
                  data={result.pipeline?.pipeline_stages?.fraud_investigation}
                />
                <AgentStep
                  name="Router (R5/R3/R4)"
                  status="complete"
                  description="Decision Routing"
                  data={result.pipeline?.pipeline_stages?.routing}
                />
                <AgentStep
                  name="Agent 04: Mediator"
                  status={result.pipeline?.pipeline_stages?.mediator?.triggered ? "complete" : "skipped"}
                  description="Communication & Action"
                  data={result.pipeline?.pipeline_stages?.mediator}
                />
              </div>
            </div>

            {/* Final Verdict */}
            <div className="mb-6 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-200">
              <h3 className="text-lg font-medium text-gray-800 mb-2">
                Final Verdict
              </h3>
              <p className="text-2xl font-bold text-indigo-600">
                {result.pipeline?.final_verdict || "N/A"}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Action: {result.pipeline?.final_action || "N/A"}
              </p>
            </div>

            {/* Raw JSON */}
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-3">
                Complete Response (JSON)
              </h3>
              <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-auto max-h-96 text-xs">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AgentStep({
  name,
  status,
  description,
  data,
}: {
  name: string;
  status: "complete" | "skipped";
  description: string;
  data?: any;
}) {
  return (
    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
      <div className="mt-1">
        {status === "complete" ? (
          <CheckCircle className="w-5 h-5 text-green-600" />
        ) : (
          <XCircle className="w-5 h-5 text-gray-400" />
        )}
      </div>
      <div className="flex-1">
        <h4 className="font-medium text-gray-900">{name}</h4>
        <p className="text-sm text-gray-600">{description}</p>
        {data && (
          <details className="mt-2">
            <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-700">
              View details
            </summary>
            <pre className="mt-2 text-xs bg-white p-2 rounded border border-gray-200 overflow-auto max-h-40">
              {JSON.stringify(data, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
