"""
Enterprise router — contract upload, job status, RAG Q&A, and project listing.
"""

import io
import os
import uuid
import asyncio
import hashlib
import logging
import tempfile
import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from db.crud import AsyncSessionLocal, get_document, get_audit_trail
from memory.rag import rag_query

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/enterprise", tags=["enterprise"])

ALLOWED_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB
UPLOAD_DIR = Path("./uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


# -----------------------------------------------------------------------
# POST /api/enterprise/upload — start the 7-agent pipeline
# -----------------------------------------------------------------------
@router.post("/upload")
async def upload_contract(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    org_id: str = Form(...),
    project_id: str = Form(...),
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Upload PDF or DOCX.",
        )

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum 50MB.")

    job_id = f"job_{uuid.uuid4().hex[:12]}"

    # Save to disk (agents need a file path)
    suffix = Path(file.filename or "contract.pdf").suffix or ".pdf"
    upload_path = UPLOAD_DIR / f"{job_id}{suffix}"
    upload_path.write_bytes(file_bytes)

    logger.info(f"Enterprise upload | job={job_id} file={file.filename} org={org_id}")

    # Run pipeline in background so we can return 202 immediately
    background_tasks.add_task(
        _run_pipeline,
        job_id=job_id,
        org_id=org_id,
        project_id=project_id,
        file_path=str(upload_path),
    )

    return JSONResponse(
        status_code=202,
        content={
            "job_id": job_id,
            "status": "processing",
            "stream_url": f"/api/stream/{job_id}",
        },
    )


async def _run_pipeline(job_id: str, org_id: str, project_id: str, file_path: str):
    """Background task: run the full LangGraph enterprise pipeline."""
    # Import here to avoid circular imports at module level
    from agents.pipeline import pipeline

    initial_state = {
        "job_id":          job_id,
        "org_id":          org_id,
        "project_id":      project_id,
        "file_path":       file_path,
        "raw_text":        "",
        "clause_manifest": [],
        "regulation_corpus": {},
        "contradiction_hits": [],
        "historical_flags": [],
        "risk_report":     [],
        "redlines":        [],
        "github_pr_url":   None,
        "slack_sent":      False,
        "duration_seconds": 0.0,
        "error":           None,
    }

    try:
        await pipeline.ainvoke(initial_state)
    except Exception as e:
        logger.error(f"Pipeline fatal error | job={job_id} | {e}")
        from routers.sse import push_event
        await push_event(job_id, {
            "event": "pipeline_error",
            "job_id": job_id,
            "error": str(e),
        })
        async with AsyncSessionLocal() as session:
            from db.crud import update_document_status
            await update_document_status(session, job_id, "error")
    finally:
        # Clean up uploaded file
        try:
            Path(file_path).unlink(missing_ok=True)
        except Exception:
            pass


# -----------------------------------------------------------------------
# GET /api/enterprise/job/{job_id} — get completed job results
# -----------------------------------------------------------------------
@router.get("/job/{job_id}")
async def get_job(job_id: str):
    async with AsyncSessionLocal() as session:
        doc   = await get_document(session, job_id)
        trail = await get_audit_trail(session, job_id)

    if not doc:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")

    if doc.status == "processing":
        return JSONResponse({"job_id": job_id, "status": "processing"})

    if doc.status == "error":
        return JSONResponse({"job_id": job_id, "status": "error"})

    # Reconstruct summary from audit trail
    risk_scores = trail.risk_scores if trail else {}
    summary = {
        level: sum(1 for v in risk_scores.values() if v == level)
        for level in ("violation", "high", "medium", "low", "compliant")
    }
    summary["total_clauses"] = len(risk_scores)

    return JSONResponse({
        "job_id":           job_id,
        "status":           "complete",
        "filename":         doc.filename,
        "org_id":           doc.org_id,
        "project_id":       doc.project_id,
        "duration_seconds": trail.duration_seconds if trail else None,
        "summary":          summary,
        "github_pr_url":    trail.github_pr_url if trail else None,
        "audit_trail": {
            "file_hash":  doc.file_hash,
            "timestamp":  doc.created_at.isoformat() if doc.created_at else None,
        },
    })


# -----------------------------------------------------------------------
# POST /api/enterprise/chat — RAG Q&A over project documents
# -----------------------------------------------------------------------
class ChatRequest(BaseModel):
    org_id: str
    project_id: str
    query: str
    conversation_history: Optional[list[dict]] = None


@router.post("/chat")
async def rag_chat(req: ChatRequest):
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    result = await rag_query(
        org_id=req.org_id,
        project_id=req.project_id,
        query=req.query,
        conversation_history=req.conversation_history,
    )
    return JSONResponse(result)


# -----------------------------------------------------------------------
# GET /api/enterprise/projects/{org_id} — list projects for an org
# -----------------------------------------------------------------------
@router.get("/projects/{org_id}")
async def list_projects(org_id: str):
    from sqlalchemy import select, func
    from db.models import Document
    async with AsyncSessionLocal() as session:
        from sqlalchemy import text
        result = await session.execute(
            select(
                Document.project_id,
                func.count(Document.job_id).label("document_count"),
                func.max(Document.created_at).label("last_updated"),
            )
            .where(Document.org_id == org_id)
            .group_by(Document.project_id)
        )
        rows = result.all()

    projects = [
        {
            "project_id":     row.project_id,
            "document_count": row.document_count,
            "last_updated":   row.last_updated.isoformat() if row.last_updated else None,
        }
        for row in rows
    ]

    return JSONResponse({"org_id": org_id, "projects": projects})


# -----------------------------------------------------------------------
# GET /api/enterprise/projects/{org_id}/{project_id}/documents — list documents
# -----------------------------------------------------------------------
@router.get("/projects/{org_id}/{project_id}/documents")
async def list_project_documents(org_id: str, project_id: str):
    from sqlalchemy import select
    from db.models import Document
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Document)
            .where(Document.org_id == org_id)
            .where(Document.project_id == project_id)
            .order_by(Document.created_at.desc())
        )
        docs = result.scalars().all()

    docs_list = [
        {
            "job_id": doc.job_id,
            "filename": doc.filename,
            "status": doc.status,
            "created_at": doc.created_at.isoformat() if doc.created_at else None,
        }
        for doc in docs
    ]
    return JSONResponse({"org_id": org_id, "project_id": project_id, "documents": docs_list})
