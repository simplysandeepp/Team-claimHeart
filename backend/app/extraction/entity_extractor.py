from __future__ import annotations

import re
from collections import Counter
from typing import Any, Dict, List, Optional

from app.preprocessing.text_normalization import normalize_line
from app.utils.medical_dictionary import (
    DISEASE_TERMS,
    MEDICATION_TERMS,
    TREATMENT_TERMS,
)
from app.utils.patterns import (
    DATE_PATTERNS,
    DOSAGE_PATTERN,
    DURATION_PATTERN,
    FREQUENCY_PATTERN,
    QUANTITY_PATTERN,
)


HEADER_STOPWORDS = {
    "name",
    "patient",
    "hospital",
    "doctor",
    "date",
    "bill",
    "diagnosis",
    "rx",
    "advice",
    "charge",
    "outpatient",
    "prescription",
    "city",
    "item",
    "qty",
    "price",
    "total",
    "one",
    "high",
    "fluid",
    "food",
    "empty",
    "stomach",
}

MONTH_NAMES = {
    "jan": "January",
    "feb": "February",
    "mar": "March",
    "apr": "April",
    "may": "May",
    "jun": "June",
    "jul": "July",
    "aug": "August",
    "sep": "September",
    "sept": "September",
    "oct": "October",
    "nov": "November",
    "dec": "December",
}

NAME_BOUNDARY_PATTERN = re.compile(
    r"\b(?:age|sex|gender|opd|ipd|uhid|patient\s*id|id|no|bill|icd|diagnosis|doctor|follow[- ]?up|phone|address)\b",
    re.IGNORECASE,
)

DATE_LABEL_PATTERN = re.compile(
    r"\b(?:date|dated|prescription\s+date|document\s+date|bill\s+date)\b\s*[:\-]?\s*(?P<tail>.+)",
    re.IGNORECASE,
)


def _first_match(patterns: List[re.Pattern[str]], text: str) -> Optional[str]:
    for pattern in patterns:
        match = pattern.search(text)
        if match:
            return match.group(1).strip() if match.groups() else match.group(0).strip()
    return None


def _extract_disease_from_line(line: str) -> Optional[str]:
    lowered = line.lower()
    if any(keyword in lowered for keyword in ("diagnosis", "diagnosed with", "condition")):
        parts = re.split(r"[:\-]", line, maxsplit=1)
        if len(parts) == 2:
            candidate = parts[1].strip(" .")
            candidate = re.split(
                r"\b(?:take|tab|tablet|capsule|cap|inj|injection|syrup|syp|for|x\s+\d+\s+days?)\b",
                candidate,
                maxsplit=1,
                flags=re.IGNORECASE,
            )[0].strip(" .,-")
            if candidate and candidate.lower() not in HEADER_STOPWORDS:
                return candidate

    for disease in DISEASE_TERMS:
        if disease in lowered:
            return disease.title()
    return None


def _normalize_month_token(token: str) -> Optional[str]:
    cleaned = re.sub(r"[^A-Za-z]", "", token or "").lower()
    if len(cleaned) < 3:
        return None

    for prefix, month in MONTH_NAMES.items():
        if cleaned.startswith(prefix):
            return month
    return None


def _extract_name_from_fragment(fragment: str) -> Optional[str]:
    fragment = NAME_BOUNDARY_PATTERN.split(fragment, maxsplit=1)[0]
    tokens = [
        token.strip(" ,.:;()[]{}")
        for token in re.split(r"\s+", fragment)
        if token.strip(" ,.:;()[]{}")
    ]

    name_tokens: List[str] = []
    for token in tokens:
        lowered = token.lower()
        if lowered in HEADER_STOPWORDS or _normalize_month_token(token):
            continue
        if token.isdigit() or re.fullmatch(r"\d{1,2}[/-]\d{1,2}[/-]\d{2,4}", token):
            continue
        if re.fullmatch(r"[A-Z][a-z]+", token) or re.fullmatch(r"[A-Z]{2,}", token):
            name_tokens.append(token.title())
            if len(name_tokens) == 4:
                break
        elif name_tokens:
            break

    if len(name_tokens) >= 2:
        return " ".join(name_tokens[:4])
    return None


def extract_patient_name(text: str) -> Optional[str]:
    patterns = [
        re.compile(r"patient\s*name\s*[:\-]?\s*([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){1,3})"),
        re.compile(r"name\s*[:\-]?\s*([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){1,3})"),
    ]
    matched_name = _first_match(patterns, text)
    if matched_name:
        return matched_name

    for line in text.splitlines():
        match = re.search(r"\b(?:patient\s*name|name)\b\s*[:\-]?\s*(.+)", line, re.IGNORECASE)
        if not match:
            continue
        candidate = _extract_name_from_fragment(match.group(1))
        if candidate:
            return candidate

    return None


def _extract_date_from_fragment(fragment: str) -> Optional[str]:
    direct_match = _first_match(DATE_PATTERNS, fragment)
    if direct_match:
        return direct_match

    tokens = [token.strip(" ,.:;()[]{}") for token in fragment.split()]
    day: Optional[str] = None
    month: Optional[str] = None
    year: Optional[str] = None

    for token in tokens:
        if day is None and re.fullmatch(r"\d{1,2}", token):
            numeric_value = int(token)
            if 1 <= numeric_value <= 31:
                day = f"{numeric_value:02d}"
                continue

        if month is None:
            month = _normalize_month_token(token)
            if month:
                continue

        if year is None and re.fullmatch(r"(?:19|20)\d{2}", token):
            year = token

        if day and month and year:
            return f"{day} {month} {year}"

    return None


def extract_dates(text: str, lines: Optional[List[str]] = None) -> Dict[str, Optional[str]]:
    document_date = _first_match(DATE_PATTERNS, text)
    if not document_date:
        candidate_lines = lines or text.splitlines()
        for index, line in enumerate(candidate_lines):
            fragments = [line]
            if index + 1 < len(candidate_lines):
                fragments.append(f"{line} {candidate_lines[index + 1]}")

            if DATE_LABEL_PATTERN.search(line) or "date" in line.lower():
                for fragment in fragments:
                    document_date = _extract_date_from_fragment(fragment)
                    if document_date:
                        break

            if document_date:
                break

    return {
        "document_date": document_date,
    }


def extract_hospital_stay(lines: List[str], text: str) -> Optional[int]:
    for source in [text, *lines]:
        match = DURATION_PATTERN.search(source)
        if match:
            duration = int(match.group("value"))
            if duration <= 90:
                return duration
    return None


def extract_disease(lines: List[str], text: str) -> Optional[str]:
    keyword_lines = [
        line for line in lines if any(keyword in line.lower() for keyword in ("diagnosis", "diagnosed with", "condition"))
    ]
    for line in keyword_lines:
        disease = _extract_disease_from_line(line)
        if disease:
            return disease

    for line in lines:
        disease = _extract_disease_from_line(line)
        if disease:
            return disease
    return _extract_disease_from_line(text)


def _extract_frequency(line: str) -> Optional[str]:
    match = FREQUENCY_PATTERN.search(line)
    if match:
        return match.group(0).strip()

    compact = re.search(r"\b\d-\d-\d\b", line)
    if compact:
        return compact.group(0)
    return None


def _extract_name_candidates(line: str) -> List[str]:
    candidates = []
    lowered = line.lower()

    for medication in MEDICATION_TERMS:
        if medication in lowered:
            candidates.append(medication.title())

    phrase_match = re.search(
        r"(?:tab(?:let)?|cap(?:sule)?|inj(?:ection)?|syrup|syp)\s+([A-Za-z][A-Za-z0-9-]{2,}(?:\s+[A-Za-z0-9-]{2,})?)",
        line,
        re.IGNORECASE,
    )
    if phrase_match:
        phrase = normalize_line(phrase_match.group(1))
        phrase = re.split(r"\b\d+(?:\.\d+)?\s*(?:mg|g|mcg|ml|iu|units?)\b", phrase, maxsplit=1, flags=re.IGNORECASE)[0].strip()
        if phrase:
            phrase_lower = phrase.lower()
            known_match = next((medication for medication in MEDICATION_TERMS if medication in phrase_lower), None)
            if known_match:
                candidates.append(known_match.title())
            elif not any(token in phrase_lower.split() for token in HEADER_STOPWORDS):
                candidates.append(phrase.title())

    return list(dict.fromkeys(candidate for candidate in candidates if candidate))


def extract_medications(lines: List[str]) -> List[Dict[str, Optional[str]]]:
    medications: List[Dict[str, Optional[str]]] = []
    seen = set()

    for line in lines:
        lowered = line.lower()
        if any(token in lowered for token in ("charge", "price", "total", "qty")):
            continue

        has_medication_keyword = any(
            keyword in lowered
            for keyword in ("tablet", "tab", "capsule", "cap", "injection", "inj", "syrup", "syp")
        )
        candidates = _extract_name_candidates(line)
        dosage_match = DOSAGE_PATTERN.search(line)
        frequency = _extract_frequency(line)

        if not candidates and not (has_medication_keyword and dosage_match):
            continue

        if not candidates and has_medication_keyword:
            tokens = [token for token in re.split(r"\s+", line) if token.isalpha()]
            candidates = [token.title() for token in tokens if token.lower() not in HEADER_STOPWORDS][:1]

        for name in candidates:
            key = (name.lower(), dosage_match.group(0).lower() if dosage_match else "", frequency or "")
            if key in seen:
                continue
            seen.add(key)
            medications.append(
                {
                    "name": name,
                    "dosage": dosage_match.group(0) if dosage_match else None,
                    "frequency": frequency,
                }
            )

    return medications


def extract_treatments(lines: List[str]) -> List[str]:
    treatments: Counter[str] = Counter()
    for line in lines:
        lowered = line.lower()
        for term in TREATMENT_TERMS:
            if term in lowered:
                treatments[term] += 1
    return [term for term, _ in treatments.most_common()]


def extract_text_billing_candidates(lines: List[str]) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []

    for line in lines:
        lowered = line.lower()
        looks_like_billing_row = bool(
            re.search(r"[A-Za-z].*\d+\s+\d+(?:\.\d+)?\s+\d+(?:\.\d+)?$", line)
        )
        if not looks_like_billing_row and not any(
            token in lowered for token in ("bill", "amount", "price", "qty", "rs", "total")
        ):
            continue

        quantity_match = QUANTITY_PATTERN.search(line)
        quantity = None
        if quantity_match:
            quantity = quantity_match.group("quantity") or quantity_match.group("quantity_only")

        prices = re.findall(r"(?:rs\.?|inr)?\s*(\d+(?:\.\d{1,2})?)", lowered)
        if len(prices) < 2:
            continue

        label = re.split(r"\d", line, maxsplit=1)[0].strip(" :-")
        if not label or label.lower() in HEADER_STOPWORDS:
            continue

        if any(token in label.lower() for token in ("date", "age", "prescription", "outpatient", "city")):
            continue

        if quantity is None and len(prices) >= 3:
            quantity = prices[-3]

        if not any(token in lowered for token in ("bill", "amount", "price", "qty", "rs", "total")) and len(prices) < 3:
            continue

        items.append(
            {
                "item": label,
                "quantity": int(quantity) if quantity else 1,
                "price": float(prices[-2]),
                "total": float(prices[-1]),
                "source": "text",
            }
        )

    return items
