from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

from app.utils.medical_dictionary import MEDICATION_TERMS, TREATMENT_TERMS


def _normalize_header(value: str) -> str:
    return re.sub(r"[^a-z]", "", value.lower())


def _to_number(value: str) -> Optional[float]:
    if value is None:
        return None
    cleaned = re.sub(r"[^0-9.]", "", value)
    if not cleaned:
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def _coerce_quantity(value: Optional[float], default: int = 1) -> Any:
    if value is None:
        return default
    if float(value).is_integer():
        return int(value)
    return value


def _find_index(header: List[str], candidates: tuple[str, ...]) -> Optional[int]:
    for index, column in enumerate(header):
        if any(candidate in column for candidate in candidates):
            return index
    return None


def _parse_billing_table(header: List[str], rows: List[List[str]]) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    item_index = _find_index(header, ("item", "description", "particular"))
    qty_index = _find_index(header, ("qty", "quantity", "units"))
    price_index = _find_index(header, ("price", "rate", "unitprice"))
    total_index = _find_index(header, ("total", "amount", "lineamount"))

    for row in rows:
        if item_index is None or item_index >= len(row):
            continue
        label = row[item_index].strip()
        if not label:
            continue

        qty_value = _to_number(row[qty_index]) if qty_index is not None and qty_index < len(row) else None
        items.append(
            {
                "item": label,
                "quantity": _coerce_quantity(qty_value),
                "price": _to_number(row[price_index]) if price_index is not None and price_index < len(row) else None,
                "total": _to_number(row[total_index]) if total_index is not None and total_index < len(row) else None,
                "source": "table",
            }
        )
    return items


def _parse_medicine_table(header: List[str], rows: List[List[str]]) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    name_index = _find_index(header, ("medicine", "drug", "item", "name"))
    dosage_index = _find_index(header, ("dosage", "dose", "strength"))
    frequency_index = _find_index(header, ("frequency", "schedule"))

    for row in rows:
        if name_index is None or name_index >= len(row):
            continue
        name = row[name_index].strip()
        if not name:
            continue

        items.append(
            {
                "name": name,
                "dosage": row[dosage_index].strip() if dosage_index is not None and dosage_index < len(row) and row[dosage_index].strip() else None,
                "frequency": row[frequency_index].strip() if frequency_index is not None and frequency_index < len(row) and row[frequency_index].strip() else None,
            }
        )
    return items


def _infer_semistructured_rows(rows: List[List[str]]) -> Dict[str, List[Dict[str, Any]]]:
    billing_items: List[Dict[str, Any]] = []
    medications: List[Dict[str, Any]] = []
    treatments: List[str] = []
    blocked_labels = {"city", "date", "age", "patient", "prescription", "outpatient"}

    for row in rows:
        merged = " ".join(column.strip() for column in row if column.strip())
        lowered = merged.lower()
        numeric_values = [_to_number(value) for value in row]
        numeric_values = [value for value in numeric_values if value is not None]

        if any(term in lowered for term in MEDICATION_TERMS):
            medications.append(
                {
                    "name": next(term.title() for term in MEDICATION_TERMS if term in lowered),
                    "dosage": next((column for column in row if re.search(r"\d+\s*(?:mg|ml|g|mcg)", column, re.IGNORECASE)), None),
                    "frequency": next((column for column in row if re.search(r"\b(?:\d-\d-\d|bd|tds|od|once|twice|daily)\b", column, re.IGNORECASE)), None),
                }
            )
            continue

        treatment_hits = [term for term in TREATMENT_TERMS if term in lowered]
        if treatment_hits:
            treatments.extend(treatment_hits)

        first_cell = row[0].strip() if row else ""
        first_cell_lower = first_cell.lower()

        if len(numeric_values) >= 2 and first_cell and not any(label in first_cell_lower for label in blocked_labels):
            first_number = numeric_values[0]
            billing_items.append(
                {
                    "item": first_cell,
                    "quantity": _coerce_quantity(first_number),
                    "price": numeric_values[1],
                    "total": numeric_values[-1],
                    "source": "inferred_table",
                }
            )

    return {
        "billing_items": billing_items,
        "medications": medications,
        "treatments": treatments,
    }


def parse_tables(tables: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    medications: List[Dict[str, Any]] = []
    billing_items: List[Dict[str, Any]] = []
    treatments: List[str] = []

    for table in tables:
        rows = table.get("rows", [])
        if len(rows) < 2:
            continue

        header = [_normalize_header(column) for column in rows[0]]
        body = rows[1:]

        header_text = " ".join(header)
        is_billing = any(token in header_text for token in ("item", "description", "qty", "price", "amount", "total"))
        is_medicine = any(token in header_text for token in ("medicine", "drug", "dosage", "frequency", "dose"))

        if is_billing:
            billing_items.extend(_parse_billing_table(header, body))
        elif is_medicine:
            medications.extend(_parse_medicine_table(header, body))
        else:
            inferred = _infer_semistructured_rows(body)
            billing_items.extend(inferred["billing_items"])
            medications.extend(inferred["medications"])
            treatments.extend(inferred["treatments"])

    return {
        "medications": medications,
        "billing_items": billing_items,
        "treatments": list(dict.fromkeys(treatments)),
    }
