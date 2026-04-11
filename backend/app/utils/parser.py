from __future__ import annotations

from typing import Any, Dict, Optional

from app.extraction.rule_engine import build_structured_claim
from app.preprocessing.text_normalization import normalize_text


def parse_medical_text(raw_text: str, document_payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Backward-compatible parser entry point.

    Existing callers may still pass only raw text. New callers can pass the richer
    OCR layout payload so the rule engine can use table and line structure.
    """
    payload = dict(document_payload or {})
    if "raw_text" not in payload:
        payload["raw_text"] = raw_text
    if "normalized_text" not in payload or "lines" not in payload:
        normalized = normalize_text(raw_text)
        payload["normalized_text"] = normalized["text"]
        payload["lines"] = normalized["lines"]
    payload.setdefault("tables", [])
    return build_structured_claim(payload)
