from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import claims, fraud, health, ocr

app = FastAPI(
    title="ClaimHeart API",
    description="Medical Claims Processing System",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, prefix="/api", tags=["Health"])
app.include_router(ocr.router, prefix="/api/ocr", tags=["OCR"])
app.include_router(claims.router, prefix="/api/claims", tags=["Claims"])
app.include_router(fraud.router, prefix="/api/fraud", tags=["Fraud"])

@app.get("/")
async def root():
    return {"message": "ClaimHeart API is running", "version": "1.0.0"}
