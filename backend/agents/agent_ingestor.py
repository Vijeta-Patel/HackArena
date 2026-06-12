"""
Agent 1 — Ingestor
Validates the uploaded file, computes SHA-256 hash, writes Document record,
and emits the first SSE event.
"""

import hashlib
import logging
import datetime
from pathlib import Path

from db.crud import AsyncSessionLocal, create_document
from routers.sse import push_event

logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {".pdf", ".docx"}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


async def agent_ingestor(state: dict) -> dict:
    job_id    = state["job_id"]
    org_id    = state["org_id"]
    project_id = state["project_id"]
    file_path  = state["file_path"]
    original_filename = state.get("original_filename", Path(file_path).name)

    logger.info(f"[Agent 1 — Ingestor] job={job_id} file={file_path}")

    try:
        path = Path(file_path)

        # 1. Validate existence
        if not path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        # 2. Validate size
        size = path.stat().st_size
        if size > MAX_FILE_SIZE:
            raise ValueError(f"File too large: {size} bytes (max {MAX_FILE_SIZE})")

        # 3. Validate extension
        ext = path.suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise ValueError(
                f"Unsupported file type '{ext}'. Only PDF and DOCX are accepted."
            )

        # 4. Compute SHA-256 hash
        sha256 = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                sha256.update(chunk)
        file_hash = f"sha256:{sha256.hexdigest()}"

        # 5. Write Document record to DB
        async with AsyncSessionLocal() as session:
            await create_document(
                session=session,
                job_id=job_id,
                org_id=org_id,
                project_id=project_id,
                filename=original_filename,
                file_hash=file_hash,
                tier="enterprise",
            )

        # 6. Emit SSE event
        await push_event(job_id, {
            "event": "ingest_complete",
            "job_id": job_id,
            "filename": original_filename,
            "file_hash": file_hash,
            "timestamp": datetime.datetime.utcnow().isoformat(),
        })

        logger.info(f"[Agent 1] Ingest complete | hash={file_hash}")
        return {**state, "error": None}

    except Exception as e:
        logger.error(f"[Agent 1 — Ingestor] FATAL: {e}")
        await push_event(job_id, {"event": "pipeline_error", "job_id": job_id, "error": str(e)})
        return {**state, "error": str(e)}
