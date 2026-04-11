from __future__ import annotations

from statistics import median
from typing import Any, Dict, List


def _token_to_cell(token: Dict[str, Any]) -> Dict[str, Any]:
    bbox = token.get("bbox", [])
    xs = [point[0] for point in bbox] if bbox else [0, 0]
    ys = [point[1] for point in bbox] if bbox else [0, 0]
    return {
        "text": token.get("text", "").strip(),
        "confidence": token.get("confidence"),
        "left": float(min(xs)),
        "right": float(max(xs)),
        "top": float(min(ys)),
        "bottom": float(max(ys)),
        "center_x": float((min(xs) + max(xs)) / 2),
        "center_y": float((min(ys) + max(ys)) / 2),
    }


def _build_line(cells: List[Dict[str, Any]]) -> Dict[str, Any]:
    return {
        "text": " ".join(cell["text"] for cell in cells if cell["text"]),
        "cells": cells,
        "top": min(cell["top"] for cell in cells),
        "bottom": max(cell["bottom"] for cell in cells),
        "left": min(cell["left"] for cell in cells),
        "right": max(cell["right"] for cell in cells),
    }


def group_tokens_into_lines(tokens: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    if not tokens:
        return []

    cells = [_token_to_cell(token) for token in tokens if token.get("text", "").strip()]
    if not cells:
        return []

    cells.sort(key=lambda item: (item["center_y"], item["left"]))
    median_height = median(max(cell["bottom"] - cell["top"], 1.0) for cell in cells)
    tolerance = max(median_height * 0.7, 10.0)

    lines: List[Dict[str, Any]] = []
    current_line: List[Dict[str, Any]] = []
    current_center = None

    for cell in cells:
        if current_center is None or abs(cell["center_y"] - current_center) <= tolerance:
            current_line.append(cell)
            current_center = (
                cell["center_y"]
                if current_center is None
                else (current_center * (len(current_line) - 1) + cell["center_y"]) / len(current_line)
            )
        else:
            current_line.sort(key=lambda item: item["left"])
            lines.append(_build_line(current_line))
            current_line = [cell]
            current_center = cell["center_y"]

    if current_line:
        current_line.sort(key=lambda item: item["left"])
        lines.append(_build_line(current_line))

    return lines


def detect_tables(lines: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Detect simple tables using repeated multi-cell rows with aligned columns."""
    if not lines:
        return []

    table_groups: List[List[Dict[str, Any]]] = []
    current_group: List[Dict[str, Any]] = []

    for line in lines:
        if len(line.get("cells", [])) >= 3:
            current_group.append(line)
        else:
            if len(current_group) >= 2:
                table_groups.append(current_group)
            current_group = []

    if len(current_group) >= 2:
        table_groups.append(current_group)

    tables: List[Dict[str, Any]] = []
    for index, group in enumerate(table_groups, start=1):
        max_columns = max(len(row["cells"]) for row in group)
        rows: List[List[str]] = []
        for row in group:
            ordered = [cell["text"] for cell in row["cells"]]
            if len(ordered) < max_columns:
                ordered.extend([""] * (max_columns - len(ordered)))
            rows.append(ordered)

        tables.append(
            {
                "table_id": index,
                "rows": rows,
                "source_lines": [row["text"] for row in group],
            }
        )

    return tables
