"""
HackArena — FastAPI application entry point.
"""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse

from db.crud import init_db
from routers.consumer import router as consumer_router
from routers.enterprise import router as enterprise_router
from routers.sse import router as sse_router
from token_pool import pool

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


# -----------------------------------------------------------------------
# Lifespan — startup & shutdown
# -----------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("═══ HackArena API starting ═══")
    await init_db()
    logger.info("✓ Database initialised")

    token_count = len(pool.tokens)
    if token_count == 0:
        logger.warning("⚠ No Groq API keys loaded — add GROQ_KEY_1 to .env")
    else:
        logger.info(f"✓ Groq token pool: {token_count} key(s) ready")

    yield
    logger.info("HackArena API shutting down")


# -----------------------------------------------------------------------
# App
# -----------------------------------------------------------------------
app = FastAPI(
    title="HackArena — AI Contract & Legal Intelligence",
    description=(
        "Enterprise 7-agent compliance pipeline + "
        "Consumer LexGuard-style adversarial analysis"
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS — permit frontend dev server and Chrome extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten to specific origins in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------------------------------------------------
# Routers
# -----------------------------------------------------------------------
app.include_router(consumer_router)
app.include_router(enterprise_router)
app.include_router(sse_router)


# -----------------------------------------------------------------------
# Health endpoint
# -----------------------------------------------------------------------
@app.get("/health", tags=["meta"])
async def health():
    token_status = pool.status()
    available = sum(1 for t in token_status if t["available"])
    return JSONResponse({
        "status": "ok",
        "groq": {
            "total_keys":      len(token_status),
            "available_keys":  available,
            "keys":            token_status,
        },
    })


# -----------------------------------------------------------------------
# Static frontend (must be mounted last — API routes take precedence)
# -----------------------------------------------------------------------
_frontend_dir = Path(__file__).parent.parent / "frontend"
if _frontend_dir.is_dir():
    app.mount("/", StaticFiles(directory=str(_frontend_dir), html=True), name="frontend")
    logger.info(f"Serving frontend from: {_frontend_dir}")
