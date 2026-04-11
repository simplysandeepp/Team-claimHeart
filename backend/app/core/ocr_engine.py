import pytesseract
from app.utils import image_processing as img_proc


def _convert_pdf_pages(pdf_path):
    try:
        from pdf2image import convert_from_path
    except ModuleNotFoundError as exc:
        raise RuntimeError(
            "PDF OCR requires the optional dependency 'pdf2image'. "
            "Install backend requirements before processing PDF files."
        ) from exc

    return convert_from_path(pdf_path)

class ClaimHeartOCR:
    def __init__(self):
        pass

    def extract_from_image(self, image_path):
        processed_img = img_proc.preprocess_for_ocr(image_path)
        text = pytesseract.image_to_string(processed_img, config='--oem 1 --psm 3')
        return text
    
    def extract_from_pdf(self, pdf_path):
        pages = _convert_pdf_pages(pdf_path)
        full_text=""
        for page in pages:
            full_text += pytesseract.image_to_string(page)
        return full_text
