import pytesseract
from PIL import Image
from app.utils import image_processing as img_proc


def _convert_pdf_pages(pdf_path):
    try:
        import fitz
    except ModuleNotFoundError as exc:
        raise RuntimeError(
            "PDF OCR requires the optional dependency 'PyMuPDF'. "
            "Install backend requirements before processing PDF files."
        ) from exc

    pages = []
    with fitz.open(pdf_path) as document:
        for page in document:
            pixmap = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
            pages.append(
                Image.frombytes(
                    "RGB",
                    (pixmap.width, pixmap.height),
                    pixmap.samples,
                )
            )

    if not pages:
        raise RuntimeError(f"No pages could be rendered from PDF: {pdf_path}")

    return pages

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
