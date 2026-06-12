"""
Ollama embedding wrapper — generates dense vector embeddings via nomic-embed-text.

Requires Ollama running locally:
  curl -fsSL https://ollama.com/install.sh | sh
  ollama pull nomic-embed-text

Only used in the Enterprise memory layer (Agent 2C). Consumer pipeline has no
dependency on this module.
"""

import logging
import httpx
from config import settings

logger = logging.getLogger(__name__)

EMBED_TIMEOUT = 30  # seconds per embedding request
OLLAMA_EMBED_URL = f"{settings.OLLAMA_BASE_URL}/api/embeddings"


async def embed(text: str) -> list[float]:
    """
    Generate a dense embedding vector for `text` using Ollama nomic-embed-text.

    Returns:
        List of floats (typically 768-dimensional for nomic-embed-text).

    Raises:
        RuntimeError — if Ollama is not running or the model is not pulled.
        httpx.HTTPError — on network errors.
    """
    if not text or not text.strip():
        raise ValueError("Cannot embed empty text.")

    async with httpx.AsyncClient(timeout=EMBED_TIMEOUT) as client:
        try:
            response = await client.post(
                OLLAMA_EMBED_URL,
                json={"model": settings.EMBED_MODEL, "prompt": text},
            )
            response.raise_for_status()
            data = response.json()
            embedding = data.get("embedding")
            if not embedding:
                raise RuntimeError(
                    f"Ollama returned no embedding. Response: {data}"
                )
            logger.debug(
                f"Embedded {len(text)} chars → {len(embedding)}-dim vector"
            )
            return embedding
        except httpx.ConnectError:
            raise RuntimeError(
                "Cannot connect to Ollama at "
                f"{settings.OLLAMA_BASE_URL}. "
                "Is Ollama running? Run: ollama serve"
            )


async def embed_batch(texts: list[str]) -> list[list[float]]:
    """
    Embed multiple texts sequentially (Ollama doesn't support batch natively).
    Returns embeddings in the same order as inputs.
    """
    results: list[list[float]] = []
    for i, text in enumerate(texts):
        vec = await embed(text)
        results.append(vec)
        if (i + 1) % 10 == 0:
            logger.info(f"Embedded {i + 1}/{len(texts)} clauses")
    return results
