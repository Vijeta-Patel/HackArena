import datetime
from sqlalchemy import Column, String, Text, Float, DateTime, JSON, Integer
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class Document(Base):
    __tablename__ = "documents"

    job_id      = Column(String, primary_key=True)
    org_id      = Column(String, nullable=False)
    project_id  = Column(String, nullable=False)
    filename    = Column(String)
    file_hash   = Column(String)           # SHA-256 — immutable audit fingerprint
    tier        = Column(String)           # "enterprise" | "consumer"
    status      = Column(String, default="processing")  # processing | complete | error
    created_at  = Column(DateTime, default=datetime.datetime.utcnow)


class AuditTrail(Base):
    __tablename__ = "audit_trail"

    job_id           = Column(String, primary_key=True)
    file_hash        = Column(String)
    timestamp        = Column(DateTime, default=datetime.datetime.utcnow)
    agent_outputs    = Column(JSON)        # full per-step agent output
    risk_scores      = Column(JSON)        # {clause_id: risk_level}
    github_pr_url    = Column(String)
    violation_count  = Column(Integer, default=0)
    duration_seconds = Column(Float)


class Clause(Base):
    __tablename__ = "clauses"

    clause_id   = Column(String, primary_key=True)
    job_id      = Column(String, nullable=False)
    org_id      = Column(String)
    project_id  = Column(String)
    clause_type = Column(String)
    text        = Column(Text)
    risk_level  = Column(String)
    regulation  = Column(String)
    confidence  = Column(Float)
    created_at  = Column(DateTime, default=datetime.datetime.utcnow)
