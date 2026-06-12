<div align="center">

# ⚖️ LexGuard

### AI-Powered Contract & Legal Intelligence Platform

[![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![LangGraph](https://img.shields.io/badge/LangGraph-0.2-FF6B35?style=flat-square)](https://langchain-ai.github.io/langgraph/)
[![Groq](https://img.shields.io/badge/Groq-LLaMA%204%20·%2070B%20·%208B-F55036?style=flat-square)](https://groq.com)
[![License](https://img.shields.io/badge/License-MIT-22C55E?style=flat-square)](LICENSE)

**Upload any contract. Get a clause-by-clause adversarial risk analysis in under 30 seconds.**  
Dark patterns · Regulatory violations · Power imbalance · 10+ Indian languages · GitHub PR output

[Consumer Dashboard](#-consumer-pipeline) · [Enterprise Pipeline](#-enterprise-pipeline) · [Browser Extension](#-browser-extension) · [API Docs](#-api-reference)

</div>

---

## 🎯 What is LexGuard?

LexGuard is a dual-surface AI legal intelligence system built for the hackathon. It makes contract review accessible to everyone — from individuals signing an employment agreement, to enterprise legal teams reviewing vendor contracts at scale.

| Surface | Who It's For | Core Capability |
|---|---|---|
| **Consumer** | Individuals | 3-stage adversarial pipeline — upload PDF/photo/paste text, get plain-English risk breakdown in your language |
| **Enterprise** | Legal & compliance teams | 7-agent LangGraph pipeline — regulatory mapping, contradiction detection, GitHub PR output, Slack alerts |
| **Extension** | Everyone | Auto-scans any ToS/contract page in your browser. Red badge = danger. Click to analyse. |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        LexGuard                             │
│                                                             │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │   Consumer   │  │    Enterprise    │  │  Extension   │  │
│  │  3-Stage AI  │  │  7-Agent Graph   │  │  Badge + UI  │  │
│  └──────┬───────┘  └────────┬─────────┘  └──────┬───────┘  │
│         │                   │                    │          │
│         └───────────────────┴────────────────────┘          │
│                             │                               │
│                    ┌────────▼────────┐                      │
│                    │   FastAPI API   │                      │
│                    │  + SSE Stream   │                      │
│                    └────────┬────────┘                      │
│                             │                               │
│         ┌───────────────────┼───────────────────┐           │
│         │                   │                   │           │
│  ┌──────▼──────┐   ┌────────▼───────┐  ┌───────▼──────┐   │
│  │  Groq API   │   │  ChromaDB      │  │   SQLite     │   │
│  │  Token Pool │   │  (Vector DB)   │  │  (Audit DB)  │   │
│  │  4 keys,    │   │  Org + Project │  │  Contracts   │   │
│  │  auto-      │   │  Collections   │  │  Audit Trail │   │
│  │  rotation   │   └────────────────┘  └──────────────┘   │
│  └─────────────┘                                           │
└─────────────────────────────────────────────────────────────┘
```

---

## ⚡ Consumer Pipeline

The consumer pipeline runs **3 sequential adversarial AI calls**, LexGuard-style:

```
Document / Photo / Raw Text
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ CALL 1 — PARSER + CLASSIFIER                                │
│ Model: llama-4-scout-17b (128K context)                     │
│ • Splits document into individual clauses                   │
│ • Types each clause: arbitration | ip | privacy | financial │
│   termination | employment | other                          │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ CALL 2 — ADVERSARY + BENCHMARK                              │
│ Model: llama-3.3-70b-versatile (best reasoning)             │
│ • Assumes worst-case corporate intent                       │
│ • Compares every clause to fair industry standard           │
│ • Flags: dark patterns, power imbalance, hidden risks       │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ CALL 3 — CONSEQUENCE SIMULATOR + SCORER + TRANSLATOR        │
│ Model: llama-3.1-8b-instant (speed)                         │
│ • Simulates real-world consequences per clause              │
│ • Calculates overall risk score (0–100)                     │
│ • Safe-to-sign verdict · Power imbalance %                  │
│ • Translates output to user's preferred language            │
│ • Generates negotiation tips per clause                     │
└─────────────────────────────────────────────────────────────┘
```

### Consumer Output Schema

```json
{
  "document_type": "employment_contract | tos | rental | loan | nda | other",
  "overall_risk_score": 83,
  "safe_to_sign": false,
  "power_imbalance": "Company: 85% / You: 15%",
  "summary": "Plain-English 2-sentence document summary",
  "translated_summary": "Same summary in user's language",
  "red_flags_count": 4,
  "dark_patterns_count": 3,
  "negotiation_summary": "Overall negotiation strategy",
  "flagged_clauses": [
    {
      "clause_type": "arbitration",
      "risk_level": "HIGH",
      "confidence": 0.9,
      "why_flagged": "Mandatory arbitration removes your right to jury trial",
      "what_it_means": "You cannot sue in court if something goes wrong",
      "consequence": "Forced into costly private arbitration",
      "financial_impact": "Up to ₹50,000 in arbitration fees",
      "dark_pattern": true,
      "dark_pattern_type": "mandatory_arbitration",
      "fair_version": "Balanced replacement clause text",
      "negotiation_tip": "Ask them to add a carve-out for claims under ₹5 lakh in civil court",
      "plain_english": "8th-grade rewrite",
      "translated_explanation": "Explanation in user's language"
    }
  ]
}
```

---

## 🏢 Enterprise Pipeline

7-agent **LangGraph** pipeline with real-time SSE progress streaming:

```
Upload (PDF / DOCX)
        │
        ▼
Agent 1 — INGESTOR
  • SHA-256 hash · file validation · DB record creation
        │
        ▼
Agent 2A — EXTRACTOR
  • PDF/DOCX → plain text · LLM clause segmentation (llama-4-scout)
        │
        ▼
Agent 2B — REGULATION LOADER
  • Loads DPDP Act 2023 + GDPR + RBI corpus from local JSON
  • Enriches with live web search (compound model)
        │
        ▼
Agent 2C — MEMORY SCANNER      [requires Ollama]
  • Embeds clauses → ChromaDB (per-project + org-wide)
  • Cross-document contradiction detection
  • Historical risk pattern flagging
        │
        ▼
Agent 3 — CLASSIFIER
  • Classifies every clause: violation | high | medium | low | compliant
  • Cites regulation section + penalty amount
  • Reflection loop for low-confidence results (up to 2 retries)
        │
        ▼
Agent 5 — REDLINER
  • Drafts compliant replacement for every medium/high/violation clause
        │
        ▼
Agent 6 — REPORTER
  • GitHub PR (full markdown risk report, redlines in collapsible sections)
  • Slack Block Kit alert
  • SQLite audit trail with immutable file hash
  • SSE pipeline_complete event → frontend
```

### Regulations Covered

| Regulation | Key Provisions | Max Penalty |
|---|---|---|
| **DPDP Act 2023** (India) | Consent, data localisation, breach notification, SDF obligations | INR 250 crore |
| **GDPR** (EU) | Lawful basis, erasure rights, international transfers, DPA | €20M / 4% turnover |
| **RBI Guidelines** (India) | Payment localisation, card data storage, recurring payments, outsourcing | INR 1 crore / licence revocation |

---

## 🔌 Browser Extension

Manifest V3 Chrome extension with 3-colour auto-scan:

```
Page loads
    │
    ▼
content.js detects legal keywords
(ToS · arbitration · indemnification · EULA · NDA · governing law)
    │
    ▼
background.js → POST /api/consumer/prescan
    │
    ├─ 🔴 ! (red)    → HIGH risk patterns detected
    ├─ 🟠 ~ (orange) → MEDIUM risk, caution advised
    └─ 🟢 ✓ (green)  → Relatively safe
    │
    ▼
User clicks extension icon → popup opens
    │
    ├─ Shows prescan result + risk indicators
    ├─ Language selector (10 Indian languages)
    └─ "Deep Analysis" → full 3-stage pipeline
           → Risk score circle
           → Clause-by-clause breakdown
           → Dark pattern badges
           → Fair versions
           → Negotiation tips
```

---

## 🚀 Quick Start

### Prerequisites

```bash
# System dependencies
sudo apt-get install -y tesseract-ocr \
  tesseract-ocr-hin tesseract-ocr-kan tesseract-ocr-tam \
  tesseract-ocr-tel tesseract-ocr-mal tesseract-ocr-ben

# (Optional — Enterprise memory layer only)
curl -fsSL https://ollama.com/install.sh | sh
ollama pull nomic-embed-text
```

### Backend Setup

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env — add your Groq API keys (minimum 1, up to 4)

# Start the server
uvicorn main:app --reload --port 8000
```

### Environment Variables

```bash
# backend/.env

# Groq API Keys — get free keys at https://console.groq.com
# Multiple keys = higher rate limits through automatic rotation
GROQ_KEY_1=gsk_...
GROQ_KEY_2=gsk_...   # optional
GROQ_KEY_3=gsk_...   # optional
GROQ_KEY_4=gsk_...   # optional

# GitHub — for Enterprise PR output (classic PAT, repo scope)
GITHUB_TOKEN=ghp_...
GITHUB_REPO=your-org/your-repo

# Slack — for Enterprise alerts
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...

# Google Translate — free tier (500K chars/month)
GOOGLE_TRANSLATE_API_KEY=AIza...

# Ollama — local embeddings (Enterprise memory layer only)
OLLAMA_BASE_URL=http://localhost:11434
EMBED_MODEL=nomic-embed-text

# Auto-configured (no changes needed)
CHROMA_PERSIST_DIR=./chroma_db
DATABASE_URL=sqlite+aiosqlite:///./contracts.db
```

### Frontend

The frontend is served automatically by FastAPI as static files. Visit:

```
http://localhost:8000/          → Landing page
http://localhost:8000/consumer.html   → Consumer analysis
http://localhost:8000/enterprise.html → Enterprise pipeline
http://localhost:8000/chat.html       → RAG Q&A
http://localhost:8000/docs            → Interactive API docs (Swagger)
```

### Browser Extension

```
1. Open chrome://extensions/
2. Enable Developer Mode (top-right toggle)
3. Click "Load unpacked"
4. Select the extension/ folder
5. Pin the extension to toolbar
6. Visit any ToS or contract page
```

---

## 📁 Project Structure

```
HackArena/
│
├── backend/                        # FastAPI application
│   ├── main.py                     # App entry point, lifespan, middleware
│   ├── config.py                   # Centralized settings (Pydantic)
│   ├── token_pool.py               # Async Groq key rotation pool
│   ├── requirements.txt
│   ├── .env.example
│   │
│   ├── agents/                     # AI pipeline agents
│   │   ├── consumer_pipeline.py    # LexGuard 3-stage consumer pipeline
│   │   ├── pipeline.py             # LangGraph enterprise graph definition
│   │   ├── agent_ingestor.py       # Agent 1  — file validation & hashing
│   │   ├── agent_extractor.py      # Agent 2A — clause extraction
│   │   ├── agent_reg_loader.py     # Agent 2B — regulation corpus loader
│   │   ├── agent_memory.py         # Agent 2C — ChromaDB + contradiction scan
│   │   ├── agent_classifier.py     # Agent 3  — risk classification
│   │   ├── agent_redliner.py       # Agent 5  — compliant redlines
│   │   └── agent_reporter.py       # Agent 6  — GitHub PR + Slack + audit
│   │
│   ├── routers/                    # FastAPI route handlers
│   │   ├── consumer.py             # /api/consumer/* (upload, photo, analyse, prescan)
│   │   ├── enterprise.py           # /api/enterprise/* (upload, job, chat, projects)
│   │   └── sse.py                  # /api/stream/{job_id} (SSE progress events)
│   │
│   ├── db/                         # Database layer
│   │   ├── models.py               # SQLAlchemy ORM models
│   │   └── crud.py                 # Async CRUD operations
│   │
│   ├── memory/                     # Enterprise vector memory
│   │   ├── chroma_client.py        # ChromaDB client (project + org collections)
│   │   ├── embedder.py             # Ollama nomic-embed-text wrapper
│   │   └── rag.py                  # RAG Q&A over project documents
│   │
│   ├── ocr/
│   │   └── tesseract_ocr.py        # Tesseract OCR + Indian script detection
│   │
│   ├── translation/
│   │   └── google_translate.py     # Google Translate REST API client
│   │
│   ├── outputs/                    # Enterprise output integrations
│   │   ├── github_pr.py            # GitHub PR creation with full markdown report
│   │   └── slack_webhook.py        # Slack Block Kit alert
│   │
│   └── regulations/                # Regulation corpus (JSON)
│       ├── dpdp_2023.json          # DPDP Act 2023 — 12 key provisions
│       ├── gdpr.json               # GDPR — 12 key provisions
│       └── rbi_guidelines.json     # RBI payment & data guidelines
│
├── frontend/                       # Static HTML/JS/CSS
│   ├── index.html                  # Landing page
│   ├── consumer.html               # Consumer analysis dashboard
│   ├── enterprise.html             # Enterprise pipeline + SSE stepper
│   ├── chat.html                   # RAG Q&A interface
│   └── style.css                   # Shared design system (dark theme)
│
└── extension/                      # Chrome extension (Manifest V3)
    ├── manifest.json
    ├── content.js                  # Page scanner — legal keyword detection
    ├── background.js               # Service worker — API calls + badge
    ├── sidebar/
    │   └── sidebar.html            # Extension popup UI
    └── icons/
        ├── icon16.png
        ├── icon48.png
        └── icon128.png
```

---

## 📡 API Reference

### Consumer Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/consumer/upload` | Analyse PDF or DOCX (multipart) |
| `POST` | `/api/consumer/photo` | Analyse photo of physical document (OCR) |
| `POST` | `/api/consumer/analyse` | Analyse raw text (JSON body) |
| `POST` | `/api/consumer/prescan` | Quick scan — returns risk level for extension badge |

### Enterprise Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/enterprise/upload` | Start 7-agent pipeline (returns `job_id`, 202) |
| `GET` | `/api/enterprise/job/{job_id}` | Get completed job results |
| `POST` | `/api/enterprise/chat` | RAG Q&A over project documents |
| `GET` | `/api/enterprise/projects/{org_id}` | List all projects for an org |

### Stream

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/stream/{job_id}` | SSE event stream — real-time pipeline progress |

### SSE Events (Enterprise)

```
ingest_complete          → Agent 1 done
extraction_complete      → Agent 2A done — clause_count
memory_scan_complete     → Agent 2C done — contradictions, historical_flags
classification_progress  → Agent 3 progress — done/total
classification_complete  → Agent 3 done — violation_count
redline_complete         → Agent 5 done — redlined_count
pipeline_complete        → All done — pr_url, slack_sent, duration_seconds
pipeline_error           → Fatal error — error message
```

### Health

```bash
GET /health
# → { "status": "ok", "groq": { "total_keys": 4, "available_keys": 4, ... } }
```

---

## 🤖 AI Models Used

| Role | Model | Why |
|---|---|---|
| Clause extraction (Consumer) | `meta-llama/llama-4-scout-17b-16e-instruct` | 128K context — handles long contracts |
| Adversarial scan (Consumer) | `llama-3.3-70b-versatile` | Best reasoning for finding hidden risks |
| Scorer + translator (Consumer) | `llama-3.1-8b-instant` | Fast — handles high RPD |
| Clause extraction (Enterprise) | `meta-llama/llama-4-scout-17b-16e-instruct` | Same as above |
| Contradiction check (Enterprise) | `llama-3.1-8b-instant` | Speed — per-clause comparison |
| Reg loader live search | `compound-beta` | Web search capability |
| Classifier (Enterprise) | `llama-3.3-70b-versatile` | Best reasoning for regulation mapping |
| Redliner (Enterprise) | `llama-3.3-70b-versatile` | Legal drafting quality |
| RAG Q&A | `qwen-qwq-32b` | Long context + reasoning |
| Embeddings | `nomic-embed-text` (Ollama) | Local, fast, Indian language support |

---

## 🧰 Tech Stack

```
Backend     FastAPI 0.115 · Uvicorn · Python 3.12
AI          Groq (LLaMA 4 Scout, LLaMA 3.3 70B, LLaMA 3.1 8B) · LangGraph 0.2
Vector DB   ChromaDB (persistent, in-process)
Embeddings  Ollama · nomic-embed-text (optional — Enterprise memory only)
Database    SQLite + SQLAlchemy (async, aiosqlite)
OCR         Tesseract 5 + pytesseract (OSD script detection)
Translation Google Cloud Translation REST API
Outputs     PyGithub · httpx (Slack webhook)
Frontend    Vanilla HTML/CSS/JS · Google Fonts (Inter)
Extension   Chrome Manifest V3 · Service Worker
```

---

## 🌐 Language Support

The consumer pipeline and browser extension support output in:

| Language | Code | OCR Support |
|---|---|---|
| English | `en` | ✅ |
| Hindi | `hi` | ✅ (`tesseract-ocr-hin`) |
| Kannada | `kn` | ✅ (`tesseract-ocr-kan`) |
| Tamil | `ta` | ✅ (`tesseract-ocr-tam`) |
| Telugu | `te` | ✅ (`tesseract-ocr-tel`) |
| Malayalam | `ml` | ✅ (`tesseract-ocr-mal`) |
| Bengali | `bn` | ✅ (`tesseract-ocr-ben`) |
| Marathi | `mr` | via Hindi OCR |
| Gujarati | `gu` | install `tesseract-ocr-guj` |
| Punjabi | `pa` | install `tesseract-ocr-pan` |

---

## 🔐 Security & Privacy

- **No data persistence** — Consumer pipeline is fully stateless. Documents are never stored.
- **Enterprise audit trail** — SHA-256 hash + timestamp logged to SQLite for compliance.
- **Keys never exposed** — All API keys are server-side only. Extension sends text to localhost.
- **Rate limit protection** — Groq token pool with automatic 429 backoff and key rotation.

---

## 👥 Team

Built for **HackArena** by Team LexGuard.

- Consumer Pipeline + Extension — adversarial 3-stage AI
- Enterprise Pipeline — 7-agent LangGraph + DPDP/GDPR/RBI compliance

---

## 📄 License

MIT License — see [LICENSE](LICENSE)

---

<div align="center">
Made with ⚖️ and lots of Groq tokens
</div>
