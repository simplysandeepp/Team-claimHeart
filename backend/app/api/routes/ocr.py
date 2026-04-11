from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
import os
import uuid
from app.tasks.extraction import process_document

router = APIRouter()

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
    """Upload and process an image or PDF file"""
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
            result = process_document(file_path)
        finally:
            if os.path.exists(file_path):
                os.remove(file_path)

        return {
            "mode": "file_upload",
            "filename": file.filename,
            "status": "success",
            "extracted_data": result
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")


@router.post("/process-local")
async def process_local_file(request: LocalPathRequest):
    """Process a file from local path"""
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
        
        # Process the file
        result = process_document(local_path)

        return {
            "mode": "local_path",
            "path_used": local_path,
            "filename": os.path.basename(local_path),
            "status": "success",
            "extracted_data": result
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")