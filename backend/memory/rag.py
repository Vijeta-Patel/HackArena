"""
RAG Q&A — retrieval-augmented generation over a project's document set.

Flow:
  1. Embed the user's query via Ollama
  2. Query project ChromaDB collection for top-5 similar clauses
  3. Build context string from retrieved chunks
  4. Call qwen-qwq-32b with context + query
  5. Return answer + source attribution
"""

import logging
from token_pool import pool
from config import MODELS
from memory.chroma_client import get_project_collection, query_similar
from memory.embedder import embed

logger = logging.getLogger(__name__)

RAG_SYSTEM_PROMPT = """You are a legal contract analyst with deep expertise in Indian and international law.
Answer the user's question based ONLY on the contract excerpts provided in the context below.
Do not make up information not present in the context.
For every claim, cite which document (job_id and clause excerpt) it comes from.
If the context does not contain enough information to answer, say so clearly."""


async def rag_query(
    org_id: str,
    project_id: str,
    query: str,
    conversation_history: list[dict] | None = None,
    n_results: int = 5,
) -> dict:
    """
    Perform RAG Q&A over all documents in a project.

    Args:
        org_id: Organisation identifier
        project_id: Project identifier
        query: Natural language question from the user
        conversation_history: Prior turns [{role, content}] for multi-turn chat
        n_results: Number of similar clauses to retrieve

    Returns:
        {
          "answer": str,
          "sources": [{"job_id", "clause_id", "clause_text", "relevance_score"}]
        }
    """
    if not query.strip():
        return {"answer": "Please ask a question.", "sources": []}

    # 1. Embed the query
    try:
        query_embedding = await embed(query)
    except RuntimeError as e:
        logger.error(f"RAG: embedding failed — {e}")
        return {
            "answer": f"Embedding service unavailable: {e}",
            "sources": [],
        }

    # 2. Retrieve similar clauses from ChromaDB
    collection = get_project_collection(org_id, project_id)
    results = query_similar(collection, query_embedding, n_results=n_results)

    retrieved_docs: list[str] = results.get("documents", [[]])[0]
    retrieved_meta: list[dict] = results.get("metadatas", [[]])[0]
    retrieved_dist: list[float] = results.get("distances", [[]])[0]

    if not retrieved_docs:
        return {
            "answer": "No documents found in this project. Upload contracts first.",
            "sources": [],
        }

    # 3. Build context string
    context_parts: list[str] = []
    sources: list[dict] = []
    for i, (doc, meta, dist) in enumerate(
        zip(retrieved_docs, retrieved_meta, retrieved_dist)
    ):
        job_id = meta.get("job_id", "unknown")
        clause_id = meta.get("clause_id", f"chunk_{i}")
        relevance = round(1 - dist, 3)  # cosine distance → similarity
        context_parts.append(
            f"[Source {i+1}] Job: {job_id} | Clause: {clause_id}\n{doc}"
        )
        sources.append({
            "job_id": job_id,
            "clause_id": clause_id,
            "clause_text": doc[:300],
            "relevance_score": relevance,
        })

    context = "\n\n---\n\n".join(context_parts)

    # 4. Build messages for LLM
    messages: list[dict] = [{"role": "system", "content": RAG_SYSTEM_PROMPT}]
    if conversation_history:
        # Include prior turns (cap to last 6 to manage context)
        messages.extend(conversation_history[-6:])
    messages.append({
        "role": "user",
        "content": f"Context:\n{context}\n\nQuestion: {query}",
    })

    # 5. Call LLM
    try:
        answer = await pool.call(
            model=MODELS["rag_chat"],
            messages=messages,
            temperature=0.1,  # slight warmth for natural language answers
        )
    except Exception as e:
        logger.error(f"RAG: LLM call failed — {e}")
        return {
            "answer": f"Analysis failed: {e}",
            "sources": sources,
        }

    logger.info(f"RAG Q&A complete | org={org_id} proj={project_id} sources={len(sources)}")
    return {"answer": answer, "sources": sources}
