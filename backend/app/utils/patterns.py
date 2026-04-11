from __future__ import annotations

import re


DATE_PATTERNS = [
    re.compile(r"\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b"),
    re.compile(
        r"\b(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4})\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4})\b",
        re.IGNORECASE,
    ),
]

DURATION_PATTERN = re.compile(
    r"(?:for|x|bed\s+rest\s+for|admission\s+for|stay\s+for)?\s*(?P<value>\d{1,2})\s*(?:days?|d)\b",
    re.IGNORECASE,
)

DOSAGE_PATTERN = re.compile(
    r"\b\d+(?:\.\d+)?\s*(?:mg|g|mcg|ml|iu|units?)\b",
    re.IGNORECASE,
)

FREQUENCY_PATTERN = re.compile(
    r"\b(?:\d-\d-\d|od|bd|tds|qid|hs|stat|once\s+daily|twice\s+daily|thrice\s+daily|daily|weekly)\b",
    re.IGNORECASE,
)

QUANTITY_PATTERN = re.compile(
    r"\bqty\s*[:\-]?\s*(?P<quantity>\d+)\b|\b(?P<quantity_only>\d+)\s*(?:x|pcs?|units?)\b",
    re.IGNORECASE,
)

