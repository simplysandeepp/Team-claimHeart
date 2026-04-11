# import pytesseract
# from PIL import Image
# import cv2
# import numpy as np

# # agar tesseract detect nahi ho rah h to isse uncomment kar lana (only and only if u have not changes the default installation path of tesseract)
# # pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"


# def preprocess_image(image_path):
#     img = cv2.imread(image_path)

#     if img is None:
#         raise ValueError("Image not found")

#     # Convert to grayscale
#     gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

#     # Increase contrast
#     gray = cv2.convertScaleAbs(gray, alpha=1.5, beta=0)

#     # Adaptive threshold (better for documents)
#     thresh = cv2.adaptiveThreshold(
#         gray, 255,
#         cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
#         cv2.THRESH_BINARY,
#         11, 2
#     )

#     return thresh


# def extract_text_from_image(image_path):
#     processed_img = preprocess_image(image_path)

#     custom_config = r'--oem 3 --psm 6'  
#     text = pytesseract.image_to_string(processed_img, config=custom_config)

#     return text


from __future__ import annotations

from typing import Any, Dict, List

import easyocr

from app.preprocessing.image_cleaning import preprocess_image
from app.preprocessing.table_detection import detect_tables, group_tokens_into_lines
from app.preprocessing.text_normalization import normalize_text


reader = easyocr.Reader(["en"])


def _convert_pdf_pages(file_path: str):
    try:
        from pdf2image import convert_from_path
    except ModuleNotFoundError as exc:
        raise RuntimeError(
            "PDF support requires the optional dependency 'pdf2image'. "
            "Install backend requirements before processing PDF files."
        ) from exc

    return convert_from_path(file_path)


def _ocr_page(image_source: Any, page_number: int) -> Dict[str, Any]:
    preprocessed = preprocess_image(image_source)
    results = reader.readtext(preprocessed.image, detail=1, paragraph=False)

    tokens: List[Dict[str, Any]] = []
    for bbox, text, confidence in results:
        tokens.append(
            {
                "bbox": [[float(point[0]), float(point[1])] for point in bbox],
                "text": text,
                "confidence": float(confidence),
            }
        )

    lines = group_tokens_into_lines(tokens)
    line_texts = [line["text"] for line in lines]
    tables = detect_tables(lines)
    normalized = normalize_text("\n".join(line_texts))

    return {
        "page_number": page_number,
        "raw_text": "\n".join(line_texts),
        "normalized_text": normalized["text"],
        "lines": normalized["lines"],
        "ocr_tokens": tokens,
        "tables": tables,
        "preprocessing": preprocessed.metadata,
    }


def extract_document_layout(file_path: str) -> Dict[str, Any]:
    if file_path.lower().endswith(".pdf"):
        pages = [_ocr_page(page, index) for index, page in enumerate(_convert_pdf_pages(file_path), start=1)]
    else:
        pages = [_ocr_page(file_path, 1)]

    raw_text = "\n\n".join(page["raw_text"] for page in pages if page["raw_text"])
    normalized_text = "\n\n".join(page["normalized_text"] for page in pages if page["normalized_text"])
    tables: List[Dict[str, Any]] = []
    lines: List[str] = []

    for page in pages:
        lines.extend(page["lines"])
        for table in page["tables"]:
            tables.append(
                {
                    **table,
                    "page_number": page["page_number"],
                }
            )

    return {
        "raw_text": raw_text,
        "normalized_text": normalized_text,
        "lines": lines,
        "tables": tables,
        "pages": pages,
    }


def extract_text_from_image(image_path):
    return extract_document_layout(image_path)["raw_text"]
