import uuid
import datetime
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, update
from config import settings
from db.models import Base, Document, AuditTrail, Clause

# -----------------------------------------------------------------------
# Async engine + session factory
# -----------------------------------------------------------------------
engine = create_async_engine(settings.DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def init_db():
    """Create all tables on startup."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_session() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session


# -----------------------------------------------------------------------
# Document CRUD
# -----------------------------------------------------------------------

async def create_document(
    session: AsyncSession,
    job_id: str,
    org_id: str,
    project_id: str,
    filename: str,
    file_hash: str,
    tier: str,
) -> Document:
    doc = Document(
        job_id=job_id,
        org_id=org_id,
        project_id=project_id,
        filename=filename,
        file_hash=file_hash,
        tier=tier,
        status="processing",
        created_at=datetime.datetime.utcnow(),
    )
    session.add(doc)
    await session.commit()
    return doc


async def update_document_status(session: AsyncSession, job_id: str, status: str):
    await session.execute(
        update(Document).where(Document.job_id == job_id).values(status=status)
    )
    await session.commit()


async def get_document(session: AsyncSession, job_id: str) -> Document | None:
    result = await session.execute(select(Document).where(Document.job_id == job_id))
    return result.scalar_one_or_none()


# -----------------------------------------------------------------------
# Audit Trail CRUD
# -----------------------------------------------------------------------

async def write_audit_trail(
    session: AsyncSession,
    job_id: str,
    file_hash: str,
    agent_outputs: dict,
    risk_scores: dict,
    github_pr_url: str | None,
    violation_count: int,
    duration_seconds: float,
):
    trail = AuditTrail(
        job_id=job_id,
        file_hash=file_hash,
        timestamp=datetime.datetime.utcnow(),
        agent_outputs=agent_outputs,
        risk_scores=risk_scores,
        github_pr_url=github_pr_url,
        violation_count=violation_count,
        duration_seconds=duration_seconds,
    )
    session.add(trail)
    await session.commit()


async def get_audit_trail(session: AsyncSession, job_id: str) -> AuditTrail | None:
    result = await session.execute(
        select(AuditTrail).where(AuditTrail.job_id == job_id)
    )
    return result.scalar_one_or_none()


# -----------------------------------------------------------------------
# Clause CRUD
# -----------------------------------------------------------------------

async def bulk_insert_clauses(session: AsyncSession, clauses: list[dict]):
    for c in clauses:
        clause = Clause(
            clause_id=c.get("clause_id", str(uuid.uuid4())),
            job_id=c["job_id"],
            org_id=c.get("org_id"),
            project_id=c.get("project_id"),
            clause_type=c.get("clause_type"),
            text=c.get("text"),
            risk_level=c.get("risk_level"),
            regulation=c.get("regulation"),
            confidence=c.get("confidence"),
        )
        session.add(clause)
    await session.commit()
