from __future__ import annotations

import re
from typing import Dict, List


COMMON_REPLACEMENTS = {
    "ﬁ": "fi",
    "ﬂ": "fl",
    "|": "I",
}


def _fix_token_level_ocr_errors(token: str) -> str:
    if not token:
        return token

    repaired = token
    if re.search(r"[A-Za-z]", repaired) and re.search(r"\d", repaired):
        repaired = re.sub(r"(?<=[A-Za-z])0(?=[A-Za-z])", "O", repaired)
        repaired = re.sub(r"(?<=\d)O(?=\d)", "0", repaired)
        repaired = re.sub(r"(?<=[A-Za-z])1(?=[A-Za-z])", "I", repaired)
        repaired = re.sub(r"(?<=\d)I(?=\d)", "1", repaired)
    return repaired


def normalize_line(line: str) -> str:
    line = line or ""
    for source, target in COMMON_REPLACEMENTS.items():
        line = line.replace(source, target)

    line = re.sub(r"[^\w\s:/().,%+-]", " ", line)
    line = re.sub(r"\s+", " ", line).strip()

    tokens = [_fix_token_level_ocr_errors(token) for token in line.split()]
    return " ".join(tokens)


def segment_lines(text: str) -> List[str]:
    raw_lines = re.split(r"[\r\n]+", text or "")
    normalized_lines = [normalize_line(line) for line in raw_lines]
    return [line for line in normalized_lines if line]


def normalize_text(text: str) -> Dict[str, object]:
    lines = segment_lines(text)
    normalized_text = "\n".join(lines)
    return {
        "text": normalized_text,
        "lines": lines,
    }

