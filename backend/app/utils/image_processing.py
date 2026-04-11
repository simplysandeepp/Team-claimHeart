from app.preprocessing.image_cleaning import preprocess_image, to_pil_image


def preprocess_for_ocr(image_path):
    """
    Backward-compatible wrapper used by older OCR entry points.

    The new implementation includes grayscale conversion, denoising,
    thresholding, and deskewing before returning a PIL image.
    """
    result = preprocess_image(image_path)
    return to_pil_image(result.image)
