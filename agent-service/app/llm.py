"""
app/llm.py — Shared LLM instance (langchain-groq)
==================================================

Provides a single cached ChatGroq instance used by all graphs.

WHY A SHARED SINGLETON?
    Creating a new ChatGroq per request would re-read env vars and potentially
    re-initialise the HTTP client on every call. A module-level @lru_cache(1)
    creates the instance once and reuses it for the lifetime of the process.

MODEL CHOICE: llama-3.3-70b-versatile (configurable via MODEL env var)
    - Fast inference on Groq hardware (~200 tokens/s)
    - 128k context window — handles long email threads comfortably
    - Tool calling support required by LangChain tool-use agents
    - Free tier available for development

PARAMETERS:
    temperature=0: Deterministic outputs suitable for classification nodes
                   (e.g. intent classification). For creative nodes (draft reply,
                   propose time slots) consider temperature=0.3–0.7.
    max_tokens=4096: Balanced limit. LangGraph nodes that call this LLM will
                     not produce replies longer than 4096 tokens, which keeps
                     per-call latency predictable.
    timeout=60: Groq is fast but network jitter can spike latency. 60s matches
                the web-tier timeout in lib/agent-client.ts.

SWAPPING MODELS:
    Set MODEL=llama-3.1-8b-instant in .env for faster/cheaper responses in
    development. Set MODEL=llama-3.3-70b-versatile for production quality.
    Any Groq-supported model that supports tool calling can be used.
"""
from functools import lru_cache

from langchain_groq import ChatGroq

from app.config import settings


@lru_cache(maxsize=1)
def get_llm() -> ChatGroq:
    """Return the shared ChatGroq instance, creating it on first call."""
    return ChatGroq(
        api_key=settings.groq_api_key,
        model=settings.model,
        temperature=0,       # deterministic — classification nodes need consistency
        max_tokens=4096,     # cap per-call cost; increase for very long draft replies
        timeout=60,          # seconds — matches web-tier request timeout
    )
