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

    structured_data = {
        "patient_name": extract_patient_name(normalized_text),
        "dates": extract_dates(normalized_text),
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
        }
        if total_amount
        else None,
        "tables": tables,
        "document_structure": {
            "line_count": len(lines),
            "table_count": len(tables),
        },
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

