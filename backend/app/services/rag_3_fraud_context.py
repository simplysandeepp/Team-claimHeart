from __future__ import annotations

import logging
from typing import Dict, List

from app.services.rag_1_ingestion import embed_texts, get_chroma_collection


logger = logging.getLogger(__name__)

FRAUD_COLLECTION_NAME = "rag3_fraud_patterns"

_SYNTHETIC_FRAUD_CASES = [
    "Claim for Dengue Fever INR 280000, 12 hospital days. Flagged: Amount exceeded sub-limit by 40%. Found: Billing inflated post-admission.",
    "Duplicate claim submitted by P-044 for Kidney Stones within 20 days. Same hospital, same billed amount. Confirmed duplicate fraud.",
    "Malaria hospitalization billed for 9 days though discharge notes showed 4 days. Found: Inflated stay duration to increase room rent and pharmacy charges.",
    "Typhoid Fever claim showed 7 CT scans in 2 days. Flagged: Diagnostic test ordering abuse beyond protocol. Found: Unnecessary repeat imaging.",
    "Ghost patient claim for Appendicitis used a real policy number with no matching hospital admission logs. Confirmed identity fabrication.",
    "Provider kickback pattern found in recurring Dengue claims from Hospital Zenith. Same lab panels and inflated consumables billed across unrelated patients.",
    "COVID-19 claim for INR 510000 included ICU charges without ICU admission records. Found: Amount inflation with fabricated bed-class upgrade.",
    "Kidney Stone surgery claim duplicated across two TPAs using altered invoice numbers. Confirmed cross-channel duplicate billing.",
    "Meningitis case billed 14 pharmacy dosages per day against policy limit of 8. Found: Pharmacy dosage inflation after discharge approval.",
    "Gallbladder surgery claim had three high-cost MRI scans on the day of discharge. Flagged: Test ordering abuse to maximize reimbursement.",
    "Provider network audit found cardiology claims tied to referral commissions. Pattern linked to inflated Angioplasty bills and kickback sharing.",
    "Neurology claim used a deceased patient identity for Brain Tumor Craniotomy pre-auth. Confirmed ghost patient and forged KYC records.",
    "Pulmonary Embolism hospitalization resubmitted after rejection with only invoice dates changed. Confirmed duplicate resubmission fraud.",
    "Tuberculosis claim showed serial pathology tests every six hours with no clinical indication. Found: Lab ordering abuse coordinated with partner diagnostic center.",
    "Appendectomy claim billed premium implants never used in surgery. Found: Amount inflation through phantom OT consumables and provider collusion.",
]


class Rag3FraudContextService:
    """
    RAG 3 stores synthetic historical fraud case summaries for Agent A3 augmentation.
    """

    def __init__(self, collection_name: str = FRAUD_COLLECTION_NAME):
        self.collection_name = collection_name

    def seed_fraud_patterns(self) -> Dict[str, object]:
        collection = get_chroma_collection(self.collection_name)
        if collection is None:
            return {
                "status": "skipped",
                "message": "Vector storage unavailable; chromadb is not installed.",
                "seeded_cases": 0,
            }

        if collection.count() > 0:
            logger.info("RAG 3 fraud pattern collection already seeded.")
            return {
                "status": "skipped",
                "message": "Fraud patterns already present. Skipping reseed.",
                "seeded_cases": collection.count(),
            }

        embeddings = embed_texts(_SYNTHETIC_FRAUD_CASES)
        if len(embeddings) != len(_SYNTHETIC_FRAUD_CASES):
            logger.warning("RAG 3 could not seed fraud patterns because embeddings were unavailable.")
            return {
                "status": "skipped",
                "message": "Embedding model unavailable; fraud patterns not seeded.",
                "seeded_cases": 0,
            }

        ids = [f"fraud-pattern-{index + 1:02d}" for index in range(len(_SYNTHETIC_FRAUD_CASES))]
        metadatas = [
            {
                "pattern_index": index,
                "source": "synthetic_historical_case",
            }
            for index in range(len(_SYNTHETIC_FRAUD_CASES))
        ]

        collection.upsert(
            ids=ids,
            documents=_SYNTHETIC_FRAUD_CASES,
            embeddings=embeddings,
            metadatas=metadatas,
        )
        logger.info("RAG 3 seeded %s synthetic fraud pattern(s).", len(_SYNTHETIC_FRAUD_CASES))

        return {
            "status": "success",
            "message": "Synthetic fraud patterns seeded successfully.",
            "seeded_cases": len(_SYNTHETIC_FRAUD_CASES),
        }

    def get_fraud_context(self, claim_summary: str) -> str:
        cleaned_summary = (claim_summary or "").strip()
        if not cleaned_summary:
            return ""

        collection = get_chroma_collection(self.collection_name)
        summary_embeddings = embed_texts([cleaned_summary])

        if collection is None or not summary_embeddings or collection.count() == 0:
            return ""

        results = collection.query(
            query_embeddings=summary_embeddings,
            n_results=3,
        )
        documents = results.get("documents", [[]])
        matches = [doc for doc in documents[0] if doc] if documents else []

        if not matches:
            return ""

        formatted_matches = "\n".join(
            f"{index}. {match}"
            for index, match in enumerate(matches, start=1)
        )
        return f"Historical fraud case matches:\n{formatted_matches}"


rag_3_fraud_context = Rag3FraudContextService()
