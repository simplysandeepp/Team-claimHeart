
import easyocr

reader = easyocr.Reader(['en'])

def extract_text_from_image(image_path):
    results = reader.readtext(image_path, detail=0)
    
    text = "\n".join(results)
    
    return text