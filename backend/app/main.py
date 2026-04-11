import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import claims, fraud, health, ocr  # auth commented out for demo
from app.services.rag_3_fraud_context import rag_3_fraud_context

# Configure logging
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

logger = logging.getLogger(__name__)

app = FastAPI(
    title="ClaimHeart API",
    description="Medical Claims Processing System with AI-Powered Fraud Detection",
    version="1.0.0",
)

# CORS Configuration
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(health.router, prefix="/api", tags=["Health"])
# app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])  # Commented out for demo
app.include_router(ocr.router, prefix="/api/ocr", tags=["OCR"])
app.include_router(claims.router, prefix="/api/rag", tags=["RAG"])
app.include_router(fraud.router, prefix="/api/fraud", tags=["Fraud"])


@app.on_event("startup")
def seed_rag3_patterns() -> None:
    """Seed RAG 3 fraud patterns on startup"""
    try:
        logger.info("Seeding RAG 3 fraud patterns...")
        rag_3_fraud_context.seed_fraud_patterns()
        logger.info("RAG 3 fraud patterns seeded successfully")
    except Exception as e:
        logger.exception(f"Failed to seed RAG 3 fraud patterns: {e}")


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "ClaimHeart API is running",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/api/health",
    }
