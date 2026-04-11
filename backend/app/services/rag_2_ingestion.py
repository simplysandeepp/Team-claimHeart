from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Tuple

from dotenv import load_dotenv

try:
    from groq import Groq
except ImportError:  # pragma: no cover - optional dependency in dev.
    Groq = None  # type: ignore[assignment]

from app.services.rag_1_ingestion import (
    RAG_GROQ_UNAVAILABLE_MESSAGE,
    create_groq_chat_completion,
    embed_texts,
    get_chroma_collection,
)


load_dotenv(Path(__file__).resolve().parents[2] / ".env")

logger = logging.getLogger(__name__)

POLICY_COLLECTION_NAME = "rag2_policy_chunks"
DEFAULT_POLICY_ID = "CARE-COMPREHENSIVE-MASTER-2026"


def _resolve_groq_api_key() -> str | None:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key or api_key.strip() in {"", "your_key_here"}:
        return None
    return api_key


def _humanize_key(key: str) -> str:
    return key.replace("_", " ").title()


def _stringify_value(value: Any) -> str:
    if isinstance(value, list):
        return ", ".join(str(item) for item in value)
    return str(value)


class Rag2Ingestor:
    """
    RAG 2 handles policy documents and powers the patient dashboard chatbot.
    """

    def __init__(self, collection_name: str = POLICY_COLLECTION_NAME):
        self.collection_name = collection_name
        self.default_policy_id = DEFAULT_POLICY_ID

    def ingest_policy_document(self, policy_json: Dict[str, Any]) -> dict:
        collection = get_chroma_collection(self.collection_name)
        if collection is None:
            return {
                "status": "skipped",
                "message": "Vector storage unavailable; chromadb is not installed.",
                "indexed_policies": [],
            }

        indexed_policies: List[str] = []
        skipped_policies: List[str] = []
        failed_policies: List[str] = []

        for policy_id, policy_body in (policy_json or {}).items():
            existing_docs = collection.get(where={"policy_id": policy_id})
            if existing_docs.get("ids"):
                skipped_policies.append(policy_id)
                continue

            chunks, metadatas, ids = self._build_policy_chunks(policy_id, policy_body)
            embeddings = embed_texts(chunks)
            if not chunks or len(embeddings) != len(chunks):
                logger.warning("RAG 2 could not embed policy %s.", policy_id)
                failed_policies.append(policy_id)
                continue

            collection.upsert(
                ids=ids,
                documents=chunks,
                embeddings=embeddings,
                metadatas=metadatas,
            )
            indexed_policies.append(policy_id)
            logger.info("RAG 2 indexed %s chunk(s) for policy %s.", len(chunks), policy_id)

        status = "success" if indexed_policies or skipped_policies else "skipped"
        message = "Policy Document highly structured JSON successfully ingested into RAG 2."
        if skipped_policies and not indexed_policies:
            message = "Policy already present in RAG 2. Skipped re-ingestion."
        elif failed_policies and not indexed_policies and not skipped_policies:
            message = "Embedding model unavailable; policy document was not indexed into RAG 2."

        return {
            "status": status,
            "message": message,
            "indexed_policies": indexed_policies,
            "skipped_policies": skipped_policies,
            "failed_policies": failed_policies,
        }

    def _build_policy_chunks(
        self,
        policy_id: str,
        policy_body: Dict[str, Any],
    ) -> Tuple[List[str], List[Dict[str, Any]], List[str]]:
        chunks: List[str] = []
        metadatas: List[Dict[str, Any]] = []
        ids: List[str] = []

        disease_sub_limits = policy_body.get("disease_sub_limits", {})
        for disease_name, disease_details in disease_sub_limits.items():
            chunk = (
                f"Disease: {disease_name}. "
                f"Max Payable: {disease_details.get('max_payable_inr', 'N/A')} INR. "
                f"Max Hospital Days: {disease_details.get('max_hospitalization_days_allowed', 'N/A')}. "
                f"Waiting Period: {disease_details.get('specific_waiting_period_days', 'N/A')} days. "
                f"Max Pharmacy Dosages/Day: {disease_details.get('max_pharmacy_dosages_per_day', 'N/A')}. "
                f"Category: {disease_details.get('category', 'General')}. "
                f"Max Diagnostic Tests/Day: {disease_details.get('max_diagnostic_tests_per_day', 'N/A')}. "
                f"Field Verification Threshold: {disease_details.get('requires_field_verification_above_inr', 'N/A')} INR."
            )
            chunks.append(chunk)
            metadatas.append(
                {
                    "policy_id": policy_id,
                    "section": "disease_sub_limits",
                    "disease": disease_name,
                }
            )
            ids.append(f"{policy_id}-disease-{disease_name.lower().replace(' ', '-').replace('/', '-')}")

        policy_metadata = policy_body.get("policy_metadata", {})
        if policy_metadata:
            metadata_chunk = "Policy Metadata. " + " ".join(
                f"{_humanize_key(key)}: {_stringify_value(value)}."
                for key, value in policy_metadata.items()
            )
            chunks.append(metadata_chunk)
            metadatas.append(
                {
                    "policy_id": policy_id,
                    "section": "policy_metadata",
                    "disease": "N/A",
                }
            )
            ids.append(f"{policy_id}-policy-metadata")

        global_conditions = policy_body.get("global_conditions", {})
        if global_conditions:
            global_chunk = "Global Conditions. " + " ".join(
                f"{_humanize_key(key)}: {_stringify_value(value)}."
                for key, value in global_conditions.items()
            )
            chunks.append(global_chunk)
            metadatas.append(
                {
                    "policy_id": policy_id,
                    "section": "global_conditions",
                    "disease": "N/A",
                }
            )
            ids.append(f"{policy_id}-global-conditions")

        return chunks, metadatas, ids

    def retrieve_policy_context(self, question: str, top_k: int = 3) -> List[str]:
        cleaned_question = (question or "").strip()
        if not cleaned_question:
            return []

        collection = get_chroma_collection(self.collection_name)
        question_embeddings = embed_texts([cleaned_question])

        if collection is None or not question_embeddings:
            return []

        results = collection.query(
            query_embeddings=question_embeddings,
            n_results=top_k,
        )
        documents = results.get("documents", [[]])
        return [doc for doc in documents[0] if doc] if documents else []

    def query_policy(self, question: str) -> str:
        chunks = self.retrieve_policy_context(question, top_k=3)
        if not chunks:
            return "Policy context is not available yet."

        groq_api_key = _resolve_groq_api_key()
        if not groq_api_key:
            logger.warning("RAG 2 query skipped because GROQ_API_KEY is not configured.")
            return RAG_GROQ_UNAVAILABLE_MESSAGE

        if Groq is None:
            logger.warning("RAG 2 query skipped because groq package is not installed.")
            return "RAG service unavailable \u2014 groq SDK not installed."

        context = "\n\n".join(f"[Policy Chunk {index}] {chunk}" for index, chunk in enumerate(chunks, start=1))
        prompt = (
            "You are a friendly insurance policy assistant explaining to a patient in simple language. "
            "Use only the policy context below.\n"
            f"Context:\n{context}\n\n"
            f"Patient Question: {question}"
        )

        try:
            client = Groq(api_key=groq_api_key)
            response = create_groq_chat_completion(
                client=client,
                system_prompt="Answer only from the supplied policy context. If the policy context does not contain the answer, say that clearly.",
                user_prompt=prompt,
                service_name="RAG 2",
            )
            answer = response.choices[0].message.content or ""
        except Exception:
            logger.exception("RAG 2 failed while querying Groq.")
            return "RAG service unavailable \u2014 unable to query Groq LLM."

        return answer.strip()


rag_2_ingestion_service = Rag2Ingestor()
