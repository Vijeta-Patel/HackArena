"""
Consumer router — handles photo upload, file upload, raw text analysis, and prescan.
All routes feed into the LexGuard-style 3-stage consumer pipeline.
"""

import io
import hashlib
import logging
import tempfile
import os
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from agents.consumer_pipeline import analyse_document, prescan_text
from ocr.tesseract_ocr import extract_text_from_image
from translation.google_translate import detect_language, translate_to_english

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/consumer", tags=["consumer"])

ALLOWED_DOC_TYPES = {
    "application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
}
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/tiff"}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


# -----------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------

def _extract_text_from_file(file_bytes: bytes, content_type: str) -> str:
    """Extract plain text from PDF or DOCX bytes."""
    if "pdf" in content_type:
        try:
            import pdfplumber, io as _io
            with pdfplumber.open(_io.BytesIO(file_bytes)) as pdf:
                return "\n\n".join(
                    page.extract_text() or "" for page in pdf.pages
                ).strip()
        except Exception as e:
            raise HTTPException(status_code=422, detail=f"PDF extraction failed: {e}")

    if "wordprocessingml" in content_type or "docx" in content_type:
        try:
            import docx, _io
            doc = docx.Document(io.BytesIO(file_bytes))
            return "\n\n".join(p.text for p in doc.paragraphs if p.text.strip())
        except Exception as e:
            raise HTTPException(status_code=422, detail=f"DOCX extraction failed: {e}")

    raise HTTPException(status_code=400, detail="Unsupported file type. Upload PDF or DOCX.")


async def _normalise_to_english(text: str, preferred_language: str) -> tuple[str, str]:
    """
    Detect source language, translate to English for analysis.
    Returns (english_text, detected_language_code).
    """
    detected_lang = await detect_language(text)
    if detected_lang != "en":
        english_text = await translate_to_english(text, source_lang=detected_lang)
    else:
        english_text = text
    return english_text, detected_lang


# -----------------------------------------------------------------------
# POST /api/consumer/photo — photograph of physical document
# -----------------------------------------------------------------------
@router.post("/photo")
async def analyse_photo(
    image: UploadFile = File(...),
    preferred_language: Optional[str] = Form(default="en"),
):
    if image.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported image type '{image.content_type}'. Upload JPEG, PNG, or WEBP."
        )

    image_bytes = await image.read()
    if len(image_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum 50MB.")

    # Save to temp file for Tesseract (needs a file path)
    suffix = Path(image.filename or "photo.jpg").suffix or ".jpg"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(image_bytes)
        tmp_path = tmp.name

    try:
        ocr_result = extract_text_from_image(tmp_path)
    finally:
        os.unlink(tmp_path)

    if ocr_result.get("low_confidence"):
        return JSONResponse({
            "status": "low_confidence",
            "ocr_confidence": ocr_result["confidence"],
            "detected_script": ocr_result.get("script"),
            "message": (
                "The photo quality is too low for accurate reading. "
                "Please retake in good lighting with the full document visible and flat."
            ),
            "analysis": None,
        })

    extracted_text = ocr_result["text"]
    if not extracted_text:
        raise HTTPException(status_code=422, detail="No text could be extracted from the image.")

    english_text, detected_lang = await _normalise_to_english(extracted_text, preferred_language)
    analysis = await analyse_document(english_text, language=preferred_language)

    return JSONResponse({
        "status": "success",
        "ocr_confidence": ocr_result["confidence"],
        "detected_language": detected_lang,
        "detected_script": ocr_result.get("script"),
        "analysis": analysis,
    })


# -----------------------------------------------------------------------
# POST /api/consumer/upload — PDF or DOCX upload
# -----------------------------------------------------------------------
@router.post("/upload")
async def analyse_upload(
    file: UploadFile = File(...),
    preferred_language: Optional[str] = Form(default="en"),
):
    if file.content_type not in ALLOWED_DOC_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Upload PDF or DOCX."
        )

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum 50MB.")

    extracted_text = _extract_text_from_file(file_bytes, file.content_type)
    if not extracted_text:
        raise HTTPException(status_code=422, detail="No text could be extracted from the document.")

    english_text, detected_lang = await _normalise_to_english(extracted_text, preferred_language)
    analysis = await analyse_document(english_text, language=preferred_language)

    return JSONResponse({
        "status": "success",
        "detected_language": detected_lang,
        "analysis": analysis,
    })


# -----------------------------------------------------------------------
# POST /api/consumer/analyse — raw text (used by browser extension)
# -----------------------------------------------------------------------
class AnalyseTextRequest(BaseModel):
    text: str
    preferred_language: Optional[str] = "en"
    source: Optional[str] = "web"  # "extension" | "web"


@router.post("/analyse")
async def analyse_text(req: AnalyseTextRequest):
    if not req.text or len(req.text.strip()) < 50:
        raise HTTPException(status_code=400, detail="Text too short to analyse.")

    english_text, detected_lang = await _normalise_to_english(req.text, req.preferred_language)
    analysis = await analyse_document(english_text, language=req.preferred_language)

    return JSONResponse({
        "status": "success",
        "detected_language": detected_lang,
        "source": req.source,
        "analysis": analysis,
    })


# -----------------------------------------------------------------------
# POST /api/consumer/prescan — quick scan for extension icon colour
# -----------------------------------------------------------------------
class PrescanRequest(BaseModel):
    text: str


@router.post("/prescan")
async def prescan(req: PrescanRequest):
    if not req.text:
        return JSONResponse({"high_risk": False, "risk_indicators": []})

    result = await prescan_text(req.text)
    return JSONResponse(result)
