from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict

import cv2
import numpy as np
from PIL import Image


@dataclass
class ImagePreprocessingResult:
    image: np.ndarray
    metadata: Dict[str, Any]


def load_image(image_source: Any) -> np.ndarray:
    #Load a file path, PIL image, or numpy array into a BGR numpy array.
    if isinstance(image_source, np.ndarray):
        image = image_source.copy()
        if image.ndim == 2:
            return cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
        return image

    if isinstance(image_source, Image.Image):
        rgb = np.array(image_source.convert("RGB"))
        return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)

    image = cv2.imread(str(image_source), cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError(f"Unable to load image from {image_source}")
    return image


def _estimate_skew_angle(binary_image: np.ndarray) -> float:
    coords = np.column_stack(np.where(binary_image < 255))
    if len(coords) < 25:
        return 0.0

    angle = cv2.minAreaRect(coords)[-1]
    if angle < -45:
        angle = 90 + angle
    return float(-angle)


def _rotate_image(image: np.ndarray, angle: float) -> np.ndarray:
    if abs(angle) < 0.05:
        return image

    height, width = image.shape[:2]
    center = (width // 2, height // 2)
    matrix = cv2.getRotationMatrix2D(center, angle, 1.0)
    return cv2.warpAffine(
        image,
        matrix,
        (width, height),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_REPLICATE,
    )


def preprocess_image(image_source: Any, adaptive: bool = True) -> ImagePreprocessingResult:
    """
    Prepare a document image for OCR.

    Steps:
    1. grayscale conversion
    2. denoising
    3. adaptive or Otsu thresholding
    4. skew correction
    """
    original = load_image(image_source)
    gray = cv2.cvtColor(original, cv2.COLOR_BGR2GRAY)
    gray = cv2.resize(gray, None, fx=1.5, fy=1.5, interpolation=cv2.INTER_CUBIC)
    denoised = cv2.fastNlMeansDenoising(gray, None, 15, 7, 21)

    if adaptive:
        binary = cv2.adaptiveThreshold(
            denoised,
            255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            31,
            11,
        )
    else:
        _, binary = cv2.threshold(
            denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU
        )

    angle = _estimate_skew_angle(binary)
    deskewed = _rotate_image(binary, angle)

    metadata = {
        "original_shape": tuple(int(value) for value in original.shape[:2]),
        "processed_shape": tuple(int(value) for value in deskewed.shape[:2]),
        "skew_angle": round(angle, 3),
        "thresholding": "adaptive" if adaptive else "otsu",
    }
    return ImagePreprocessingResult(image=deskewed, metadata=metadata)


def to_pil_image(image: np.ndarray) -> Image.Image:
    return Image.fromarray(image)

