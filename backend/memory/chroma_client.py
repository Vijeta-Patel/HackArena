"""
ChromaDB client — persistent vector store for Enterprise memory layer.
Collections are scoped at project level and org level.

Requires: pip install chromadb
Note: ChromaDB runs in-process (no server needed). Data persists to disk.
"""

import logging
from typing import Optional
import chromadb
from chromadb.config import Settings as ChromaSettings
from config import settings

logger = logging.getLogger(__name__)

# Single persistent client — initialised once at module import
_client: Optional[chromadb.PersistentClient] = None


def get_chroma_client() -> chromadb.PersistentClient:
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(
            path=settings.CHROMA_PERSIST_DIR,
            settings=ChromaSettings(anonymized_telemetry=False),
        )
        logger.info(f"ChromaDB initialised at: {settings.CHROMA_PERSIST_DIR}")
    return _client


def get_project_collection(org_id: str, project_id: str) -> chromadb.Collection:
    """
    Per-project collection: holds all clause embeddings for a specific project.
    Used for intra-project contradiction detection.
    """
    client = get_chroma_client()
    name = f"org_{org_id}_project_{project_id}"
    # Sanitise name — ChromaDB requires [a-zA-Z0-9_-] only, 3–63 chars
    name = name[:63].replace(" ", "_").replace("/", "_")
    return client.get_or_create_collection(
        name=name,
        metadata={"hnsw:space": "cosine"},
    )


def get_org_collection(org_id: str) -> chromadb.Collection:
    """
    Org-wide collection: holds high/violation clauses across ALL projects.
    Used for historical flagging.
    """
    client = get_chroma_client()
    name = f"org_{org_id}_global"
    name = name[:63].replace(" ", "_").replace("/", "_")
    return client.get_or_create_collection(
        name=name,
        metadata={"hnsw:space": "cosine"},
    )


def upsert_clauses(
    collection: chromadb.Collection,
    clause_ids: list[str],
    embeddings: list[list[float]],
    documents: list[str],
    metadatas: list[dict],
) -> None:
    """
    Upsert clause embeddings into a ChromaDB collection.
    All IDs must be strings (ChromaDB requirement).
    """
    collection.upsert(
        ids=[str(cid) for cid in clause_ids],
        embeddings=embeddings,
        documents=documents,
        metadatas=metadatas,
    )
    logger.debug(f"Upserted {len(clause_ids)} clauses into '{collection.name}'")


def query_similar(
    collection: chromadb.Collection,
    query_embedding: list[float],
    n_results: int = 3,
    where: dict | None = None,
) -> dict:
    """
    Query a collection for the top-N most similar clauses.
    Returns ChromaDB query result dict with ids, documents, distances, metadatas.
    """
    count = collection.count()
    if count == 0:
        return {"ids": [[]], "documents": [[]], "distances": [[]], "metadatas": [[]]}

    # Can't request more results than documents in collection
    n = min(n_results, count)
    kwargs: dict = {"query_embeddings": [query_embedding], "n_results": n}
    if where:
        kwargs["where"] = where
    return collection.query(**kwargs)
