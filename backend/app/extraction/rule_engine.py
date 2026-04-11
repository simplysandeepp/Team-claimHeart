from __future__ import annotations

from typing import Any, Dict, List

from app.extraction.entity_extractor import (
    extract_dates,
    extract_disease,
    extract_hospital_stay,
    extract_medications,
    extract_patient_name,
    extract_text_billing_candidates,
    extract_treatments,
)
from app.extraction.table_parser import parse_tables


def _merge_unique_dicts(items: List[Dict[str, Any]], key_fields: List[str]) -> List[Dict[str, Any]]:
    seen = set()
    merged = []
    for item in items:
        key = tuple((field, str(item.get(field) or "").lower()) for field in key_fields)
        if key in seen:
            continue
        seen.add(key)
        merged.append(item)
    return merged


def _calculate_confidence_scores(structured_data: Dict[str, Any], pages: List[Dict[str, Any]]) -> Dict[str, float]:
    """
    Calculate confidence scores for extracted fields.
    If the text matches tokens from EasyOCR, use their confidence. Otherwise, baseline to 0.85.
    """
    all_tokens = []
    for page in pages:
        all_tokens.extend(page.get("ocr_tokens", []))
    
    overall_conf = 0.85
    if all_tokens:
        overall_conf = sum(t["confidence"] for t in all_tokens) / len(all_tokens)

    scores = {
        "patient_name": overall_conf,
        "diagnosis": overall_conf,
        "medications": overall_conf,
        "billing_items": overall_conf,
        "hospital_stay_days": overall_conf
    }
    
    # Simple heuristic to boost/lower based on find-ability
    raw_text = " ".join(t["text"].lower() for t in all_tokens)
    
    name = structured_data.get("patient_name")
    if name and isinstance(name, str):
        matching_tokens = [t["confidence"] for t in all_tokens if name.lower() in t["text"].lower() or t["text"].lower() in name.lower()]
        if matching_tokens:
            scores["patient_name"] = sum(matching_tokens) / len(matching_tokens)

    disease = structured_data.get("disease")
    if disease and isinstance(disease, str):
        matching_tokens = [t["confidence"] for t in all_tokens if disease.lower() in t["text"].lower() or t["text"].lower() in disease.lower()]
        if matching_tokens:
            scores["diagnosis"] = sum(matching_tokens) / len(matching_tokens)

    if structured_data.get("medications"):
        scores["medications"] = min(0.95, overall_conf + 0.05)
        
    return {k: round(v, 2) for k, v in scores.items()}


def _coerce_price(value: Any) -> Any:
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return value


def build_structured_claim(document_payload: Dict[str, Any]) -> Dict[str, Any]:
    raw_text = document_payload.get("raw_text", "")
    normalized_text = document_payload.get("normalized_text", raw_text)
    lines = document_payload.get("lines", [])
    tables = document_payload.get("tables", [])

    table_entities = parse_tables(tables)
    medication_candidates = extract_medications(lines) + table_entities["medications"]
    medications = _merge_unique_dicts(medication_candidates, ["name", "dosage", "frequency"])

    billing_candidates = extract_text_billing_candidates(lines) + table_entities["billing_items"]
    billing_items = _merge_unique_dicts(billing_candidates, ["item", "quantity", "price", "total"])

    treatments = list(
        dict.fromkeys(extract_treatments(lines) + table_entities["treatments"])
    )

    hospital_stay_days = extract_hospital_stay(lines, normalized_text)
    disease = extract_disease(lines, normalized_text)
    total_amount = sum(item.get("total") or item.get("price") or 0 for item in billing_items)

    patient_name = extract_patient_name(normalized_text)

    structured_data = {
        "patient_name": patient_name,
        "dates": extract_dates(normalized_text, lines),
        "diagnosis": [disease] if disease else [],
        "disease": disease,
        "hospital_stay_days": hospital_stay_days,
        "medications": medications,
        "treatments": treatments,
        "billing_items": [
            {
                **item,
                "price": _coerce_price(item.get("price")),
                "total": _coerce_price(item.get("total")),
            }
            for item in billing_items
        ],
        "total_amount": {
            "total_billed": _coerce_price(total_amount),
            "currency": "INR",
        } if total_amount else None,
        "tables": tables,
        "document_structure": {
            "line_count": len(lines),
            "table_count": len(tables),
        },
        "confidence_scores": _calculate_confidence_scores(
            {"patient_name": patient_name, "disease": disease, "medications": medications},
            document_payload.get("pages", [])
        ),
        "raw_text": raw_text,
        "normalized_text": normalized_text,
    }

    final_json = {
        "disease": disease,
        "hospital_stay_days": hospital_stay_days,
        "medications": medications,
        "treatments": treatments,
        "billing_items": [
            {
                "item": item.get("item"),
                "quantity": item.get("quantity"),
                "price": _coerce_price(item.get("price")),
            }
            for item in billing_items
        ],
    }
    structured_data["claim_summary"] = final_json
    return structured_data
