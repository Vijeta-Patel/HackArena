"""
Groq token pool — async-safe, round-robin rotation with 429 handling.

Uses AsyncGroq (native async client) — no blocking event loop calls.
Lock guards only the rotation index, not the API call itself, so requests
can be made concurrently across different tokens.
"""

import time
import asyncio
import logging
from groq import AsyncGroq, RateLimitError
from config import settings, MODEL_FALLBACK

logger = logging.getLogger(__name__)


class GroqTokenPool:
    """
    Manages multiple Groq API keys with round-robin rotation and
    automatic backoff on 429 rate-limit responses.

    Usage:
        from token_pool import pool
        text = await pool.call(model="llama-3.1-8b-instant", messages=[...])
    """

    def __init__(self):
        raw_keys = [
            settings.GROQ_KEY_1,
            settings.GROQ_KEY_2,
            settings.GROQ_KEY_3,
            settings.GROQ_KEY_4,
        ]
        self.tokens = [
            {"key": k, "retry_after": None, "fails": 0}
            for k in raw_keys
            if k and not k.startswith("gsk_xxx")
        ]
        self._index = 0
        self._index_lock = asyncio.Lock()  # guards _index + retry_after only

        if self.tokens:
            logger.info(f"GroqTokenPool initialised with {len(self.tokens)} key(s)")
        else:
            logger.warning(
                "GroqTokenPool: no keys loaded. "
                "Add GROQ_KEY_1 (to GROQ_KEY_4) to .env and restart."
            )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _get_available(self) -> dict | None:
        """Return the next available token. Must be called under _index_lock."""
        now = time.monotonic()
        for _ in range(len(self.tokens)):
            token = self.tokens[self._index % len(self.tokens)]
            self._index += 1
            if token["retry_after"] is None or now > token["retry_after"]:
                return token
        return None  # all tokens are rate-limited

    async def _mark_limited(self, token: dict, retry_after_seconds: int):
        """Record a 429 rate limit. Must be called under _index_lock."""
        token["retry_after"] = time.monotonic() + retry_after_seconds
        token["fails"] += 1
        logger.warning(
            f"Groq key ...{token['key'][-6:]} rate limited for "
            f"{retry_after_seconds}s (total fails: {token['fails']})"
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def call(
        self,
        model: str,
        messages: list[dict],
        temperature: float = 0.0,
        response_format: dict | None = None,
        max_tokens: int | None = None,
    ) -> str:
        """
        Make a Groq chat completion call with automatic key rotation on 429.
        Falls back through MODEL_FALLBACK chain if the primary model fails
        on all keys.

        Raises:
            Exception — if all keys and all fallback models are exhausted.
        """
        if not self.tokens:
            raise RuntimeError(
                "No Groq API keys configured. "
                "Add GROQ_KEY_1 to your .env file and restart the server."
            )

        models_to_try = [model]
        fallback = MODEL_FALLBACK.get(model)
        if fallback and fallback != model:
            models_to_try.append(fallback)

        last_error: Exception | None = None

        for current_model in models_to_try:
            for attempt in range(len(self.tokens)):
                # Acquire a token atomically
                async with self._index_lock:
                    token = await self._get_available()
                    if token is None:
                        raise Exception(
                            f"All {len(self.tokens)} Groq token(s) are currently "
                            "rate-limited. Wait and retry, or add more accounts."
                        )

                # API call is outside the lock — allows true concurrency
                try:
                    client = AsyncGroq(api_key=token["key"])
                    call_kwargs: dict = {
                        "model": current_model,
                        "messages": messages,
                        "temperature": temperature,
                    }
                    if response_format is not None:
                        call_kwargs["response_format"] = response_format
                    if max_tokens is not None:
                        call_kwargs["max_tokens"] = max_tokens

                    response = await client.chat.completions.create(**call_kwargs)
                    async with self._index_lock:
                        token["fails"] = 0  # reset on success
                    content = response.choices[0].message.content
                    logger.debug(
                        f"Groq call OK | model={current_model} "
                        f"key=...{token['key'][-6:]} | "
                        f"tokens_used={response.usage.total_tokens if response.usage else 'n/a'}"
                    )
                    return content

                except RateLimitError as e:
                    retry_after = int(
                        getattr(getattr(e, "response", None), "headers", {}).get(
                            "retry-after", 60
                        )
                    )
                    async with self._index_lock:
                        await self._mark_limited(token, retry_after)
                    last_error = e
                    continue

                except Exception as e:
                    logger.error(
                        f"Groq non-rate-limit error | model={current_model} | {e}"
                    )
                    last_error = e
                    raise  # non-429 errors propagate immediately

        raise Exception(
            f"All Groq tokens exhausted for model '{model}' "
            f"and its fallback chain. Last error: {last_error}"
        )

    def status(self) -> list[dict]:
        """Return pool status for the /health endpoint."""
        now = time.monotonic()
        return [
            {
                "key_suffix": f"...{t['key'][-6:]}",
                "available": t["retry_after"] is None or now > t["retry_after"],
                "total_fails": t["fails"],
                "retry_in_seconds": round(
                    max(0.0, t["retry_after"] - now)
                    if t["retry_after"] and now <= t["retry_after"]
                    else 0.0,
                    1,
                ),
            }
            for t in self.tokens
        ]


# Singleton — import `pool` everywhere, never re-instantiate
pool = GroqTokenPool()
