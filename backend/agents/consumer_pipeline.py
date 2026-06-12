"""
Consumer Pipeline — LexGuard-style 3-stage adversarial analysis.

Call 1 — PARSER + CLASSIFIER      [llama-4-scout, long context]
Call 2 — ADVERSARY + BENCHMARK    [llama-3.3-70b, best reasoning]
Call 3 — CONSEQUENCE + SCORER     [llama-3.1-8b-instant, fast + high RPD]
"""

import json
import logging
from token_pool import pool
from config import MODELS

logger = logging.getLogger(__name__)


# -----------------------------------------------------------------------
# CALL 1 — Parser + Classifier
# -----------------------------------------------------------------------
CALL1_SYSTEM = """You are a legal AI assistant specialised in Indian and international law.
Your task is to extract and segment ALL clauses from the provided legal document text.
Classify each clause into exactly one of these types:
  arbitration | ip | privacy | financial | termination | employment | other

Return ONLY a valid JSON array — no markdown, no explanation, no wrapping object:
[
  {"clause_text": "...", "clause_type": "..."},
  ...
]"""

# -----------------------------------------------------------------------
# CALL 2 — Adversary + Benchmark
# -----------------------------------------------------------------------
CALL2_SYSTEM = """You are an adversarial legal expert and consumer rights advocate.
You will receive a JSON array of legal clauses.
For EVERY clause (including low-risk ones), assume worst-case corporate intent and identify hidden risks.
Compare each clause against fair industry standards.

Return ONLY a valid JSON array with the SAME clauses in the SAME order, adding these fields to each:
{
  "risk_level": "HIGH" | "MEDIUM" | "LOW",
  "why_flagged": "plain English reason for the risk level",
  "what_it_means": "practical real-world implication for the person signing",
  "fair_version": "a balanced, consumer-friendly alternative clause",
  "dark_pattern": true | false,
  "dark_pattern_type": "forced_consent | hidden_renewal | one_sided_termination | broad_ip_grab | mandatory_arbitration | null"
}"""

# -----------------------------------------------------------------------
# CALL 3 — Consequence Simulator + Explainer + Risk Scorer
# -----------------------------------------------------------------------
CALL3_SYSTEM_TEMPLATE = """You are a consumer rights advocate, consequence simulator, and legal explainer.
You will receive a JSON array of analysed legal clauses.
Your job:
1. For each HIGH or MEDIUM risk clause: simulate real-world consequences and financial impact.
2. Rewrite every clause explanation at an 8th-grade reading level (plain_english).
3. Translate the key fields into the user's preferred language: {language}
4. Calculate a single overall_risk_score from 0-100 (100 = maximally exploitative).
5. Determine safe_to_sign (true if overall_risk_score < 40).
6. Estimate the power imbalance (e.g. "Company: 85% / You: 15%").
7. Write actionable negotiation tips per flagged clause.

Return ONLY valid JSON matching this EXACT structure (no markdown, no wrapping text):
{{
  "document_type": "employment_contract | tos | rental | loan | nda | other",
  "overall_risk_score": 0-100,
  "safe_to_sign": true | false,
  "power_imbalance": "Company: X% / You: Y%",
  "summary": "2-sentence plain English summary of the document",
  "translated_summary": "same summary in {language}",
  "flagged_clauses": [
    {{
      "clause_text": "...",
      "clause_type": "...",
      "risk_level": "HIGH | MEDIUM | LOW",
      "confidence": 0.0-1.0,
      "why_flagged": "...",
      "what_it_means": "...",
      "fair_version": "...",
      "consequence": "What actually happens to the user if they sign this",
      "financial_impact": "Estimated financial risk (e.g. 'Up to ₹50,000 in unexpected fees')",
      "dark_pattern": true | false,
      "dark_pattern_type": "...",
      "plain_english": "8th-grade rewrite of this clause",
      "translated_explanation": "why_flagged translated into {language}",
      "translated_consequence": "consequence translated into {language}",
      "translated_fair_version": "fair_version translated into {language}",
      "negotiation_tip": "Exact actionable advice: what to ask for, how to phrase it"
    }}
  ],
  "red_flags_count": 0,
  "dark_patterns_count": 0,
  "negotiation_summary": "3-sentence overall negotiation strategy for this document"
}}"""


async def analyse_document(text: str, language: str = "en") -> dict:
    """
    Run the full LexGuard-style 3-stage consumer pipeline.

    Args:
        text: Extracted plain text of the document (in English or original language)
        language: ISO 639-1 language code for output translation (default: "en")

    Returns:
        Structured analysis dict matching the consumer output schema.
    """

    # ------------------------------------------------------------------
    # CALL 1 — Parse + Classify
    # ------------------------------------------------------------------
    logger.info("Consumer pipeline: Call 1 — Parser + Classifier")
    try:
        raw1 = await pool.call(
            model=MODELS["consumer_parser"],
            messages=[
                {"role": "system", "content": CALL1_SYSTEM},
                {"role": "user", "content": text[:40000]},  # cap for token safety
            ],
            temperature=0.0,
            response_format={"type": "json_object"},
        )
        # Model may return {"clauses": [...]} or a bare array — normalise
        parsed1 = json.loads(raw1)
        if isinstance(parsed1, list):
            clauses = parsed1
        else:
            # Try common wrapper keys
            for key in ("clauses", "data", "result", "items"):
                if key in parsed1 and isinstance(parsed1[key], list):
                    clauses = parsed1[key]
                    break
            else:
                clauses = list(parsed1.values())[0] if parsed1 else []
    except Exception as e:
        logger.error(f"Consumer Call 1 failed: {e}")
        return _fallback_error(f"Clause extraction failed: {str(e)}")

    if not clauses:
        return _fallback_error("No clauses could be extracted from the document.")

    logger.info(f"Consumer pipeline: {len(clauses)} clauses extracted")

    # ------------------------------------------------------------------
    # CALL 2 — Adversary + Benchmark
    # ------------------------------------------------------------------
    logger.info("Consumer pipeline: Call 2 — Adversary + Benchmark")
    try:
        raw2 = await pool.call(
            model=MODELS["consumer_adversary"],
            messages=[
                {"role": "system", "content": CALL2_SYSTEM},
                {"role": "user", "content": json.dumps(clauses)},
            ],
            temperature=0.0,
            response_format={"type": "json_object"},
        )
        parsed2 = json.loads(raw2)
        if isinstance(parsed2, list):
            analysed_clauses = parsed2
        else:
            for key in ("clauses", "data", "result", "items"):
                if key in parsed2 and isinstance(parsed2[key], list):
                    analysed_clauses = parsed2[key]
                    break
            else:
                analysed_clauses = clauses  # fallback: carry forward Call 1 output
    except Exception as e:
        logger.warning(f"Consumer Call 2 failed, using Call 1 output: {e}")
        analysed_clauses = clauses

    # ------------------------------------------------------------------
    # CALL 3 — Consequence + Explainer + Risk Scorer + Translator
    # ------------------------------------------------------------------
    logger.info(f"Consumer pipeline: Call 3 — Scorer + Translator (lang={language})")
    try:
        system3 = CALL3_SYSTEM_TEMPLATE.format(language=language)
        raw3 = await pool.call(
            model=MODELS["consumer_scorer"],
            messages=[
                {"role": "system", "content": system3},
                {"role": "user", "content": json.dumps(analysed_clauses)},
            ],
            temperature=0.0,
            response_format={"type": "json_object"},
        )
        final = json.loads(raw3)
        logger.info(
            f"Consumer pipeline complete — risk_score={final.get('overall_risk_score')}, "
            f"safe_to_sign={final.get('safe_to_sign')}"
        )
        return final
    except Exception as e:
        logger.error(f"Consumer Call 3 failed: {e}")
        return _fallback_error(f"Final scoring failed: {str(e)}")


# -----------------------------------------------------------------------
# Prescan — lightweight, fast, for extension icon colour
# -----------------------------------------------------------------------
PRESCAN_SYSTEM = """You are a quick legal risk screener.
Read the following legal text and classify its overall risk level.

HIGH risk: mandatory arbitration, unlimited data sharing, auto-renewal traps,
broad IP ownership grabs, one-sided termination, class action waivers,
unilateral contract modification.

MEDIUM risk: vague liability language, one-sided termination notice periods,
limited data deletion rights, bundled consent, broad indemnification.

SAFE: standard boilerplate, clearly defined terms, balanced rights.

Return ONLY valid JSON:
{
  "risk_level": "high" | "medium" | "safe",
  "high_risk": true | false,
  "risk_indicators": ["list of up to 5 specific patterns detected, or empty array"]
}"""


async def prescan_text(text: str) -> dict:
    """
    Fast pre-scan used by browser extension to set icon colour.
    Uses the fastest model (llama-3.1-8b-instant) — must return in < 2 seconds.
    Returns: { risk_level, high_risk, risk_indicators }
    """
    try:
        raw = await pool.call(
            model=MODELS["consumer_scorer"],  # fastest model
            messages=[
                {"role": "system", "content": PRESCAN_SYSTEM},
                {"role": "user", "content": text[:8000]},
            ],
            temperature=0.0,
            response_format={"type": "json_object"},
            max_tokens=250,
        )
        result = json.loads(raw)
        # Normalise — ensure risk_level is always present
        if "risk_level" not in result:
            result["risk_level"] = "high" if result.get("high_risk") else "safe"
        result["high_risk"] = result["risk_level"] == "high"
        return result
    except Exception as e:
        logger.error(f"Prescan failed: {e}")
        return {"risk_level": "safe", "high_risk": False, "risk_indicators": []}


# -----------------------------------------------------------------------
# Fallback error shape — matches full schema so frontend never breaks
# -----------------------------------------------------------------------
def _fallback_error(message: str) -> dict:
    return {
        "document_type": "unknown",
        "overall_risk_score": 0,
        "safe_to_sign": False,
        "power_imbalance": "Unknown",
        "summary": message,
        "translated_summary": message,
        "flagged_clauses": [],
        "red_flags_count": 0,
        "dark_patterns_count": 0,
        "negotiation_summary": "",
        "error": message,
    }
