from __future__ import annotations

import hashlib
import logging
import os
from pathlib import Path
from threading import Lock
from typing import Any, Dict, List, Optional, Sequence

from dotenv import load_dotenv

_DEFAULT_HF_CACHE_DIR = Path(__file__).resolve().parents[2] / "app" / "data" / "hf_cache_local"
_DEFAULT_HF_CACHE_DIR.mkdir(parents=True, exist_ok=True)
os.environ.setdefault("HF_HOME", str(_DEFAULT_HF_CACHE_DIR))
os.environ.setdefault("HUGGINGFACE_HUB_CACHE", str(_DEFAULT_HF_CACHE_DIR / "hub"))
os.environ.setdefault("SENTENCE_TRANSFORMERS_HOME", str(_DEFAULT_HF_CACHE_DIR / "sentence_transformers"))
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS", "1")
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")

try:
    import chromadb
except ImportError:  # pragma: no cover - optional dependency in dev.
    chromadb = None  # type: ignore[assignment]

try:
    from groq import Groq
except ImportError:  # pragma: no cover - optional dependency in dev.
    Groq = None  # type: ignore[assignment]

try:
    from sentence_transformers import SentenceTransformer
except ImportError:  # pragma: no cover - optional dependency in dev.
    SentenceTransformer = None  # type: ignore[assignment]


load_dotenv(Path(__file__).resolve().parents[2] / ".env")

logger = logging.getLogger(__name__)

EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"
PATIENT_COLLECTION_NAME = "rag1_patient_docs"
RAG_GROQ_UNAVAILABLE_MESSAGE = "RAG service unavailable \u2014 GROQ_API_KEY not configured."
REQUESTED_GROQ_MODEL = "llama3-8b-8192"
GROQ_MODEL_FALLBACK = "llama-3.1-8b-instant"

_chroma_client = None
_embedding_model = None
_embedding_init_failed = False
_chroma_lock = Lock()
_embedding_lock = Lock()


def _backend_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _resolve_chroma_persist_dir() -> Path:
    configured_dir = os.getenv("CHROMA_PERSIST_DIR", "./app/data/chroma_store")
    persist_dir = Path(configured_dir)
    if not persist_dir.is_absolute():
        persist_dir = _backend_root() / persist_dir
    persist_dir.mkdir(parents=True, exist_ok=True)
    return persist_dir


def _resolve_model_cache_dir() -> Path:
    cache_dir = _backend_root() / "app" / "data" / "hf_cache_local"
    cache_dir.mkdir(parents=True, exist_ok=True)
    return cache_dir


def get_shared_chroma_client():
    global _chroma_client

    if chromadb is None:
        logger.warning("chromadb package is not installed; vector storage is unavailable.")
        return None

    if _chroma_client is not None:
        return _chroma_client

    with _chroma_lock:
        if _chroma_client is None:
            persist_dir = _resolve_chroma_persist_dir()
            _chroma_client = chromadb.PersistentClient(path=str(persist_dir))
            logger.info("Initialized shared ChromaDB client at %s", persist_dir)

    return _chroma_client


def get_chroma_collection(collection_name: str):
    client = get_shared_chroma_client()
    if client is None:
        return None
    return client.get_or_create_collection(name=collection_name)


def get_shared_embedding_model():
    global _embedding_model
    global _embedding_init_failed

    if SentenceTransformer is None:
        logger.warning("sentence-transformers package is not installed; embeddings are unavailable.")
        return None

    if _embedding_model is not None:
        return _embedding_model

    if _embedding_init_failed:
        return None

    with _embedding_lock:
        if _embedding_model is None and not _embedding_init_failed:
            try:
                _resolve_model_cache_dir()
                _embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME)
                logger.info("Loaded embedding model %s", EMBEDDING_MODEL_NAME)
            except Exception:
                _embedding_init_failed = True
                logger.exception("Failed to load embedding model %s", EMBEDDING_MODEL_NAME)
                return None

    return _embedding_model


def embed_texts(texts: Sequence[str]) -> List[List[float]]:
    model = get_shared_embedding_model()
    cleaned_texts = [text.strip() for text in texts if isinstance(text, str) and text.strip()]

    if model is None or not cleaned_texts:
        return []

    try:
        embeddings = model.encode(
            cleaned_texts,
            normalize_embeddings=True,
            show_progress_bar=False,
        )
    except Exception:
        logger.exception("Failed to embed %s text segment(s).", len(cleaned_texts))
        return []

    if hasattr(embeddings, "tolist"):
        return embeddings.tolist()
    return [list(vector) for vector in embeddings]


def _chunk_text(raw_text: str, chunk_size: int = 300, overlap: int = 50) -> List[str]:
    tokens = raw_text.split()
    if not tokens:
        return []

    step = max(1, chunk_size - overlap)
    chunks: List[str] = []

    for start in range(0, len(tokens), step):
        chunk_tokens = tokens[start : start + chunk_size]
        if not chunk_tokens:
            continue
        chunks.append(" ".join(chunk_tokens))
        if start + chunk_size >= len(tokens):
            break

    return chunks


def _stable_id(*parts: str) -> str:
    digest = hashlib.sha1("::".join(parts).encode("utf-8")).hexdigest()
    return digest


def _resolve_groq_api_key() -> Optional[str]:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key or api_key.strip() in {"", "your_key_here"}:
        return None
    return api_key


def create_groq_chat_completion(
    client: Groq,
    system_prompt: str,
    user_prompt: str,
    service_name: str,
):
    model_candidates = [REQUESTED_GROQ_MODEL]
    if GROQ_MODEL_FALLBACK not in model_candidates:
        model_candidates.append(GROQ_MODEL_FALLBACK)

    last_error: Exception | None = None
    for model_name in model_candidates:
        try:
            return client.chat.completions.create(
                model=model_name,
                temperature=0,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
            )
        except Exception as exc:  # pragma: no cover - depends on live API state.
            last_error = exc
            if model_name == REQUESTED_GROQ_MODEL and "decommissioned" in str(exc).lower():
                logger.warning(
                    "%s requested model %s is decommissioned; retrying with %s.",
                    service_name,
                    REQUESTED_GROQ_MODEL,
                    GROQ_MODEL_FALLBACK,
                )
                continue
            raise

    if last_error is not None:
        raise last_error
    raise RuntimeError("Groq completion failed before a request could be attempted.")


class Rag1Ingestor:
    """
    RAG 1 handles patient documents and powers Doctor Chats.
    It stores OCR output in ChromaDB and retrieves patient-specific context.
    """

    def __init__(self, collection_name: str = PATIENT_COLLECTION_NAME):
        self.collection_name = collection_name

    def ingest_patient_document(
        self,
        raw_text: str,
        document_payload: dict,
        claim_id: str = None,
    ) -> dict:
        claim_identifier = claim_id or "unknown"
        cleaned_text = (raw_text or "").strip()

        if not cleaned_text:
            logger.warning("RAG 1 skipped ingestion for claim %s because the OCR text was empty.", claim_identifier)
            return {
                "status": "skipped",
                "message": "No patient text available for RAG 1 ingestion.",
                "document_length": 0,
                "pages_processed": len((document_payload or {}).get("pages", [])),
                "chunks_indexed": 0,
            }

        collection = get_chroma_collection(self.collection_name)
        if collection is None:
            return {
                "status": "skipped",
                "message": "Vector storage unavailable; chromadb is not installed.",
                "document_length": len(cleaned_text),
                "pages_processed": len((document_payload or {}).get("pages", [])),
                "chunks_indexed": 0,
            }

        chunks = _chunk_text(cleaned_text)
        embeddings = embed_texts(chunks)

        if not chunks or len(embeddings) != len(chunks):
            logger.warning("RAG 1 could not embed patient document for claim %s.", claim_identifier)
            return {
                "status": "skipped",
                "message": "Embedding model unavailable; patient document not indexed.",
                "document_length": len(cleaned_text),
                "pages_processed": len((document_payload or {}).get("pages", [])),
                "chunks_indexed": 0,
            }

        ids = [
            f"{claim_identifier}-{chunk_index}-{_stable_id(claim_identifier, str(chunk_index), chunk)}"
            for chunk_index, chunk in enumerate(chunks)
        ]
        metadatas = [
            {
                "claim_id": claim_identifier,
                "source": "hospital_document",
                "chunk_index": chunk_index,
            }
            for chunk_index in range(len(chunks))
        ]

        collection.upsert(
            ids=ids,
            documents=chunks,
            embeddings=embeddings,
            metadatas=metadatas,
        )
        logger.info("RAG 1 indexed %s chunk(s) for claim %s.", len(chunks), claim_identifier)

        return {
            "status": "success",
            "message": "Document successfully ingested into RAG 1.",
            "document_length": len(cleaned_text),
            "pages_processed": len((document_payload or {}).get("pages", [])),
            "chunks_indexed": len(chunks),
        }

    def retrieve_patient_context(self, question: str, claim_id: str, top_k: int = 3) -> List[str]:
        cleaned_question = (question or "").strip()
        cleaned_claim_id = (claim_id or "").strip()

        if not cleaned_question or not cleaned_claim_id:
            return []

        collection = get_chroma_collection(self.collection_name)
        question_embeddings = embed_texts([cleaned_question])

        if collection is None or not question_embeddings:
            return []

        results = collection.query(
            query_embeddings=question_embeddings,
            n_results=top_k,
            where={"claim_id": cleaned_claim_id},
        )

        documents = results.get("documents", [[]])
        return [doc for doc in documents[0] if doc] if documents else []

    def query_patient_context(self, question: str, claim_id: str) -> str:
        return self.query_patient_context_with_sources(question, claim_id)["answer"]

    def query_patient_context_with_sources(self, question: str, claim_id: str) -> Dict[str, Any]:
        chunks = self.retrieve_patient_context(question, claim_id, top_k=3)
        if not chunks:
            return {
                "answer": f"No patient document context found for claim {claim_id}.",
                "claim_id": claim_id,
                "sources_used": 0,
            }

        groq_api_key = _resolve_groq_api_key()
        if not groq_api_key:
            logger.warning("RAG 1 query skipped because GROQ_API_KEY is not configured.")
            return {
                "answer": RAG_GROQ_UNAVAILABLE_MESSAGE,
                "claim_id": claim_id,
                "sources_used": len(chunks),
            }

        if Groq is None:
            logger.warning("RAG 1 query skipped because groq package is not installed.")
            return {
                "answer": "RAG service unavailable \u2014 groq SDK not installed.",
                "claim_id": claim_id,
                "sources_used": len(chunks),
            }

        context = "\n\n".join(f"[Chunk {index}] {chunk}" for index, chunk in enumerate(chunks, start=1))
        prompt = (
            "You are a medical assistant. Using only the context below, answer the doctor's question.\n"
            f"Context:\n{context}\n\n"
            f"Question: {question}"
        )

        try:
            client = Groq(api_key=groq_api_key)
            response = create_groq_chat_completion(
                client=client,
                system_prompt="Answer only from the provided medical context. If the context is insufficient, say so clearly.",
                user_prompt=prompt,
                service_name="RAG 1",
            )
            answer = response.choices[0].message.content or ""
        except Exception:
            logger.exception("RAG 1 failed while querying Groq for claim %s.", claim_id)
            answer = "RAG service unavailable \u2014 unable to query Groq LLM."

        return {
            "answer": answer.strip(),
            "claim_id": claim_id,
            "sources_used": len(chunks),
        }


rag_1_ingestion_service = Rag1Ingestor()
