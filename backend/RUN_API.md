# ClaimHeart Backend API

## Quick Start

### 1. Start the API Server

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at: `http://localhost:8000`

### 2. View API Documentation

Once the server is running, visit:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## OCR Endpoints

### Upload File for OCR Processing

```bash
curl -X POST "http://localhost:8000/api/ocr/upload" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@path/to/your/image.jpg"
```

### Process Local File

```bash
curl -X POST "http://localhost:8000/api/ocr/process-local" \
  -H "Content-Type: application/json" \
  -d '{"local_path": "app/docs/image.png"}'
```

## Standalone OCR Extraction

To extract text from the sample image without starting the API:

```bash
cd backend
python extract_image.py
```

This will:
1. Process `app/docs/image.png`
2. Extract text using EasyOCR
3. Save results to `ocr_output.json`

## Testing

Run the API tests:

```bash
cd backend
python test_api.py
```

## Troubleshooting

### PDF Processing on Windows

PDF OCR now uses `PyMuPDF`, so you do not need Poppler for PDF support.

If PDF processing fails:
1. Reinstall backend requirements: `pip install -r requirements.txt`
2. Confirm `PyMuPDF` is installed: `pip show PyMuPDF`
3. Retry with the same PDF file

### Tesseract Not Found

If you get a Tesseract error, install it:

**Windows:**
1. Download from: https://github.com/UB-Mannheim/tesseract/wiki
2. Install to default location: `C:\Program Files\Tesseract-OCR`
3. Add to PATH or uncomment the line in `app/utils/ocr.py`

**Linux:**
```bash
sudo apt-get install tesseract-ocr
```

**macOS:**
```bash
brew install tesseract
```

### EasyOCR Model Download

On first run, EasyOCR will download language models (~100MB). This is normal and only happens once.
