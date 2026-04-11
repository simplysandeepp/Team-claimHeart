import pytesseract
from pdf2image import convert_from_path
from app.utils import image_processing as img_proc

class ClaimHeartOCR:
    def __init__(self):
        pass

    def extract_from_image(self, image_path):
        processed_img = img_proc.preprocess_for_ocr(image_path)
        text = pytesseract.image_to_string(processed_img, config='--oem 1 --psm 3')
        return text
    
    def extract_from_pdf(self, pdf_path):
        pages = convert_from_path(pdf_path)
        full_text=""
        for page in pages:
            full_text += pytesseract.image_to_string(page)
        return full_text