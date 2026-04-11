import os
from google import genai
from google.genai import types
from dotenv import load_dotenv
from app.schemas.bill_schema import BILL_PROMPT
from app.schemas.report_schema import REPORT_SCHEMA  
from app.schemas.discharge_schema import DISCHARGE_SCHEMA
from app.schemas.pharmacy_schema import PHARMACY_PROMPT
from app.schemas.claim_schema import CLAIM_SCHEMA
load_dotenv()

class ExtractorAgent:
    def __init__(self, api_key=None):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY not found. Please check your .env file.")
        
        # Initialize the new Google GenAI Client
        self.client = genai.Client(api_key=self.api_key)
        self.model_id = "gemini-2.0-flash"

    def _identify_document_type(self, raw_text):
        classification_prompt = f"""
        Analyze the following text from a healthcare document and classify it into one of these categories:
        'bill', 'diagnostic_report', 'discharge_summary', 'pharmacy', 'claim', or 'other'.
        Return ONLY the category name.

        Text Sample: {raw_text[:1000]} 
        """
        try:
            # New SDK syntax for generating content
            response = self.client.models.generate_content(
                model=self.model_id,
                contents=classification_prompt
            )
            return response.text.strip().lower()
        except Exception as e:
            print(f"Classification failed: {e}")
            return "other"

    def structure_text(self, raw_text):
        # Step 1: Identify document type
        doc_type = self._identify_document_type(raw_text)
        print(f"Document identified as: {doc_type}")

        # Step 2: Select prompt mapping
        prompt_map = {
            "bill": BILL_PROMPT,
            "diagnostic_report": REPORT_SCHEMA,
            "discharge_summary": DISCHARGE_SCHEMA,
            "pharmacy": PHARMACY_PROMPT,
            "claim": CLAIM_SCHEMA
        }
        
        selected_prompt = prompt_map.get(doc_type, "Extract all important medical entities into JSON.")

        # Step 3: Extract and Structure using new SDK config
        try:
            response = self.client.models.generate_content(
                model=self.model_id,
                contents=f"System: You are an expert in {doc_type} analysis. {selected_prompt}\n\nRaw OCR Text:\n{raw_text}",
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                )
            )
            return response.text
        except Exception as e:
            return f"{{\"error\": \"Extraction failed\", \"details\": \"{str(e)}\"}}"