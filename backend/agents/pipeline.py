"""
LangGraph pipeline — Enterprise 7-agent contract analysis graph.

Execution order:
  ingestor → extractor → reg_loader → memory → classifier → redliner → reporter

2A (extractor) and 2B (reg_loader) are sequential in the graph but use
asyncio.gather internally for the parts that can be parallelised (e.g.,
reg_loader web search while extractor finishes). Memory scanner (2C)
strictly needs extractor output.
"""

from __future__ import annotations

from typing import TypedDict, Optional
from langgraph.graph import StateGraph, END

from agents.agent_ingestor import agent_ingestor
from agents.agent_extractor import agent_extractor
from agents.agent_reg_loader import agent_reg_loader
from agents.agent_memory import agent_memory
from agents.agent_classifier import agent_classifier
from agents.agent_redliner import agent_redliner
from agents.agent_reporter import agent_reporter


# -----------------------------------------------------------------------
# Pipeline state — the single shared dict passed between every agent node
# -----------------------------------------------------------------------
class PipelineState(TypedDict):
    # Inputs (set by the caller before starting the pipeline)
    job_id: str
    org_id: str
    project_id: str
    file_path: str
    original_filename: str

    # Agent outputs (populated by each agent in turn)
    raw_text: str                           # set by agent_extractor
    clause_manifest: list[dict]             # set by agent_extractor
    regulation_corpus: dict                 # set by agent_reg_loader
    contradiction_hits: list[dict]          # set by agent_memory
    historical_flags: list[dict]            # set by agent_memory
    risk_report: list[dict]                 # set by agent_classifier
    redlines: list[dict]                    # set by agent_redliner
    github_pr_url: Optional[str]            # set by agent_reporter
    slack_sent: bool                        # set by agent_reporter
    duration_seconds: float                 # set by agent_reporter

    # Error state — set by any agent on fatal failure
    error: Optional[str]


def _should_continue(state: PipelineState) -> str:
    """Route to END if any agent set an error."""
    return END if state.get("error") else "continue"


def build_pipeline():
    """
    Compile and return the LangGraph pipeline.
    Call once at startup and reuse the compiled graph.
    """
    graph = StateGraph(PipelineState)

    graph.add_node("ingestor",   agent_ingestor)
    graph.add_node("extractor",  agent_extractor)
    graph.add_node("reg_loader", agent_reg_loader)
    graph.add_node("memory",     agent_memory)
    graph.add_node("classifier", agent_classifier)
    graph.add_node("redliner",   agent_redliner)
    graph.add_node("reporter",   agent_reporter)

    graph.set_entry_point("ingestor")
    graph.add_edge("ingestor",   "extractor")
    graph.add_edge("extractor",  "reg_loader")
    graph.add_edge("reg_loader", "memory")
    graph.add_edge("memory",     "classifier")
    graph.add_edge("classifier", "redliner")
    graph.add_edge("redliner",   "reporter")
    graph.add_edge("reporter",   END)

    return graph.compile()


# Compiled pipeline singleton — import `pipeline` in the enterprise router
pipeline = build_pipeline()
