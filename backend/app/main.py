import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import claims, fraud, health, ocr
from app.services.rag_3_fraud_context import rag_3_fraud_context


logger = logging.getLogger(__name__)

app = FastAPI(
    title="ClaimHeart API",
    description="Medical Claims Processing System",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api", tags=["Health"])
app.include_router(ocr.router, prefix="/api/ocr", tags=["OCR"])
app.include_router(claims.router, prefix="/api/rag", tags=["RAG"])
app.include_router(fraud.router, prefix="/api/fraud", tags=["Fraud"])


@app.on_event("startup")
def seed_rag3_patterns() -> None:
    try:
        rag_3_fraud_context.seed_fraud_patterns()
    except Exception:
        logger.exception("Failed to seed RAG 3 fraud patterns during startup.")


@app.get("/")
async def root():
    return {"message": "ClaimHeart API is running", "version": "1.0.0"}
