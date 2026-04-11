from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
import os
import uuid
import logging

from app.tasks.extraction import process_document
from app.services.pipeline import run_full_pipeline

router = APIRouter()
logger = logging.getLogger(__name__)

UPLOAD_DIR = "temp_uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Allowed MIME types
ALLOWED_EXTENSIONS = {"image/jpeg", "image/png", "image/jpg", "application/pdf"}

# Maximum file size in bytes (10MB)
MAX_FILE_SIZE = 10 * 1024 * 1024


class LocalPathRequest(BaseModel):
    local_path: str


def save_file(file_bytes: bytes, ext: str = "jpg") -> str:
    """Save bytes to a unique temporary file and return its path."""
    unique_filename = f"{uuid.uuid4()}.{ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    with open(file_path, "wb") as f:
        f.write(file_bytes)
    return file_path


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """
    Upload and process an image or PDF file through complete pipeline
    
    Flow: OCR → Extraction → Policy Check → Fraud Detection → Decision Routing → Mediator
    """
    try:
        if file.content_type not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail="Invalid file type. Please upload an image (JPEG, PNG) or PDF."
            )

        # Check file size
        contents = await file.read()
        if len(contents) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="File too large (max 10MB)")

        ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
        file_path = save_file(contents, ext)

        try:
            # Step 1: Extract data from document (OCR + Parsing)
            logger.info(f"Processing document: {file.filename}")
            extraction_result = process_document(file_path)
            
            # Generate unique claim ID
            claim_id = f"CLM-{uuid.uuid4().hex[:8].upper()}"
            
            # Step 2: Run through complete fraud detection pipeline
            logger.info(f"Running fraud pipeline for claim: {claim_id}")
            pipeline_result = run_full_pipeline(
                extractor_output=extraction_result,
                claim_id=claim_id,
                patient_info=None,  # Can be enriched from extraction
                hospital_info=None,
            )
            
            # Combine extraction and pipeline results
            response = {
                "mode": "file_upload",
                "filename": file.filename,
                "claim_id": claim_id,
                "status": "success",
                "extraction": {
                    "structured_data": extraction_result.get("structured_data", {}),
                    "unified_claim": extraction_result.get("unified_claim", {}),
                },
                "pipeline": pipeline_result,
            }
            
            logger.info(f"Pipeline complete for {claim_id}: {pipeline_result.get('final_verdict')}")
            return response
            
        finally:
            # Clean up uploaded file
            if os.path.exists(file_path):
                os.remove(file_path)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error processing file: {e}")
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")


@router.post("/process-local")
async def process_local_file(request: LocalPathRequest):
    """
    Process a file from local path through complete pipeline
    """
    try:
        local_path = request.local_path

        # Validate path exists
        if not os.path.exists(local_path):
            raise HTTPException(status_code=400, detail=f"File not found at path: {local_path}")
        
        # Check if it's a file
        if not os.path.isfile(local_path):
            raise HTTPException(status_code=400, detail="Path must point to a file, not a directory")
        
        # Validate file extension
        ext = local_path.split(".")[-1].lower()
        valid_extensions = {"jpg", "jpeg", "png", "pdf"}
        if ext not in valid_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type. Allowed: {valid_extensions}"
            )
        
        # Check file size
        file_size = os.path.getsize(local_path)
        if file_size > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="File too large (max 10MB)")
        
        # Step 1: Extract data from document
        logger.info(f"Processing local file: {local_path}")
        extraction_result = process_document(local_path)
        
        # Generate unique claim ID
        claim_id = f"CLM-{uuid.uuid4().hex[:8].upper()}"
        
        # Step 2: Run through complete fraud detection pipeline
        logger.info(f"Running fraud pipeline for claim: {claim_id}")
        pipeline_result = run_full_pipeline(
            extractor_output=extraction_result,
            claim_id=claim_id,
            patient_info=None,
            hospital_info=None,
        )
        
        response = {
            "mode": "local_path",
            "path_used": local_path,
            "filename": os.path.basename(local_path),
            "claim_id": claim_id,
            "status": "success",
            "extraction": {
                "structured_data": extraction_result.get("structured_data", {}),
                "unified_claim": extraction_result.get("unified_claim", {}),
            },
            "pipeline": pipeline_result,
        }
        
        logger.info(f"Pipeline complete for {claim_id}: {pipeline_result.get('final_verdict')}")
        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error processing file: {e}")
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")