from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Groq token pool — 4 separate accounts (add more keys as you get them)
    GROQ_KEY_1: str = ""
    GROQ_KEY_2: str = ""
    GROQ_KEY_3: str = ""
    GROQ_KEY_4: str = ""

    # GitHub (for Enterprise PR output)
    GITHUB_TOKEN: str = ""
    GITHUB_REPO: str = ""  # format: "org/repo-name"

    # Slack (for Enterprise alerts)
    SLACK_WEBHOOK_URL: str = ""

    # Google Translate (free tier — 500K chars/month)
    GOOGLE_TRANSLATE_API_KEY: str = ""

    # Ollama (local embeddings — needed for Enterprise memory layer)
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    EMBED_MODEL: str = "nomic-embed-text"

    # ChromaDB (local persistent — Enterprise only)
    CHROMA_PERSIST_DIR: str = "./chroma_db"

    # SQLite
    DATABASE_URL: str = "sqlite+aiosqlite:///./contracts.db"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()

# -----------------------------------------------------------------------
# Model assignments per agent/use-case
# -----------------------------------------------------------------------
MODELS = {
    # Enterprise agents
    "extractor":  "meta-llama/llama-4-scout-17b-16e-instruct",  # 30K TPM, long context
    "reg_loader": "compound-beta",                               # built-in web search
    "memory":     "meta-llama/llama-4-scout-17b-16e-instruct",
    "classifier": "llama-3.3-70b-versatile",                    # best reasoning
    "redliner":   "llama-3.3-70b-versatile",
    "reporter":   "llama-3.1-8b-instant",                       # 14.4K RPD, fast

    # Consumer pipeline (LexGuard-style 3 calls)
    "consumer_parser":   "meta-llama/llama-4-scout-17b-16e-instruct",  # Call 1: long context
    "consumer_adversary":"llama-3.3-70b-versatile",                    # Call 2: best reasoning
    "consumer_scorer":   "llama-3.1-8b-instant",                       # Call 3: fast + high RPD

    # RAG Q&A
    "rag_chat":   "qwen-qwq-32b",                               # strong multilingual
}

# Fallback chain per model if rate limited
MODEL_FALLBACK = {
    "meta-llama/llama-4-scout-17b-16e-instruct": "llama-3.1-8b-instant",
    "llama-3.3-70b-versatile":                   "qwen-qwq-32b",
    "qwen-qwq-32b":                              "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant":                      "llama-3.1-8b-instant",
    "compound-beta":                             "llama-3.3-70b-versatile",
}
