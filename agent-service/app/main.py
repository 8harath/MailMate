"""
app/main.py — MailMate agent service (FastAPI entrypoint)
=========================================================

This is the main module of the Python agent-service container. It wires
together all components — FastAPI, LangGraph graphs, auth middleware,
checkpointer, and optional observability integrations — into a deployable
ASGI application.

RESPONSIBILITIES:
    - Expose HTTP endpoints that the Next.js web tier calls via lib/agent-client.ts
    - Authenticate every request with HMAC service-token middleware (app/auth.py)
    - Delegate execution to the appropriate LangGraph StateGraph
    - Return normalised AgentResponse JSON (app/schemas.py)
    - Handle LangGraph HITL interrupts (status: "interrupted" + interrupt_data)
    - Resume interrupted runs via Command(resume=...) on /v1/resume

ENDPOINTS:
    GET  /healthz           — Liveness probe (used by Docker healthcheck + /api/health)
    POST /v1/coordinator    — Main coordinator graph (intent → route → reply)
    POST /v1/triage         — Inbox triage graph (search → classify → report)
    POST /v1/schedule       — Scheduling graph (extract → check → propose → HITL)
    POST /v1/resume         — Resume a graph paused at interrupt() with user approval

AUTH:
    Every POST endpoint depends on verify_service_token (app/auth.py).
    The dependency is injected as ServiceAuth = Annotated[None, Depends(...)].
    The /healthz endpoint is public (used by infrastructure probes).

OBSERVABILITY:
    - Sentry: initialised in lifespan if SENTRY_DSN is set
    - LangSmith: enabled in lifespan if LANGSMITH_API_KEY is set
      (traces all LangGraph runs to the LangSmith dashboard)
    - structlog: JSON structured logging to stdout on all events

ERROR HANDLING:
    - Global exception handler returns 500 JSON for unhandled exceptions
    - Each endpoint has a try/except to ensure graceful degradation:
      agent errors return a user-friendly error reply rather than crashing

SCALING:
    The service is stateless — all state is in Postgres (LangGraph checkpoints)
    and Redis (not used directly here). Multiple replicas can run concurrently.
    Run with: uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
"""
import uuid
from contextlib import asynccontextmanager
from typing import Annotated

import structlog
from fastapi import Depends, FastAPI, Request
from fastapi.responses import JSONResponse

from app.auth import verify_service_token
from app.checkpointer import get_checkpointer
from app.config import settings
from app.graphs.coordinator import run_coordinator
from app.graphs.scheduling import build_scheduling_graph, run_scheduling
from app.graphs.triage import run_triage
from app.schemas import (
    AgentResponse,
    CoordinatorRequest,
    ResumeRequest,
    SchedulingRequest,
    TriageRequest,
)

log = structlog.get_logger()

# Reusable FastAPI dependency type alias for service-token authentication
ServiceAuth = Annotated[None, Depends(verify_service_token)]


# ── Application lifespan ───────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle hook.

    Runs once when the service starts. Initialises optional integrations
    (Sentry, LangSmith) so they are active before the first request arrives.
    """
    log.info("agent_service.startup", model=settings.model)

    # Sentry: captures unhandled exceptions and performance traces
    if settings.sentry_dsn:
        import sentry_sdk
        sentry_sdk.init(dsn=settings.sentry_dsn, traces_sample_rate=0.1)
        log.info("sentry.enabled")

    # LangSmith: traces every LangChain/LangGraph call to the LangSmith dashboard
    # Set LANGCHAIN_TRACING_V2=true and LANGCHAIN_API_KEY to enable
    if settings.langsmith_api_key:
        import os
        os.environ.setdefault("LANGCHAIN_TRACING_V2", "true")
        os.environ.setdefault("LANGCHAIN_API_KEY", settings.langsmith_api_key)
        log.info("langsmith.enabled")

    yield  # Service is running — handle requests

    log.info("agent_service.shutdown")


# ── FastAPI application ────────────────────────────────────────────────────────

app = FastAPI(
    title="mailmate-agent-service",
    version="0.3.0",
    # Disable docs in production — API is internal, not public-facing
    docs_url=None,
    redoc_url=None,
    lifespan=lifespan,
)


# ── Health probe ───────────────────────────────────────────────────────────────

@app.get("/healthz")
async def healthz() -> JSONResponse:
    """Liveness probe used by Docker HEALTHCHECK and /api/health on the web tier.

    Returns 200 with service metadata. Does NOT ping Groq or Postgres on every
    call (those are expensive). For deep health checks, the web /api/health
    endpoint probes us by hitting this endpoint.
    """
    cp = get_checkpointer()
    return JSONResponse({
        "status": "ok",
        "service": "agent-service",
        # Indicate whether durable checkpointing (HITL) is available
        "checkpointer": "postgres" if cp else "memory",
        "model": settings.model,
    })


# ── Coordinator endpoint ───────────────────────────────────────────────────────

@app.post("/v1/coordinator", response_model=AgentResponse)
async def coordinator_endpoint(body: CoordinatorRequest, _auth: ServiceAuth) -> AgentResponse:
    """Run the LangGraph coordinator graph for a user message.

    Classifies intent, routes to the appropriate sub-graph (triage /
    scheduling / general / simple), and returns a synthesised reply with
    delegation info and any newly stored memories.

    On error: returns a user-friendly error reply instead of 500 to avoid
    showing raw tracebacks in the inbox chat panel.
    """
    run_id = str(uuid.uuid4())
    checkpointer = get_checkpointer()

    # Convert Pydantic models to plain dicts for the graph functions
    thread_dict = body.thread.model_dump(by_alias=True) if body.thread else None
    history_dicts = [m.model_dump() for m in body.history]

    try:
        result = run_coordinator(
            message=body.message,
            thread=thread_dict,
            access_token=body.access_token,
            user_id=body.user_id,
            history=history_dicts,
            memory_context="",  # populated in Phase 3+ memory prefetch
            run_id=run_id,
            checkpointer=checkpointer,
        )
    except Exception as exc:
        log.error("coordinator.error", run_id=run_id, error=str(exc))
        result = {
            "run_id": run_id,
            "status": "completed",
            "reply": "Sorry, something went wrong. Please try again.",
            "delegations": [],
            "memories_used": [],
            "memories_stored": [],
        }

    return AgentResponse(**result)


# ── Triage endpoint ────────────────────────────────────────────────────────────

@app.post("/v1/triage", response_model=AgentResponse)
async def triage_endpoint(body: TriageRequest, _auth: ServiceAuth) -> AgentResponse:
    """Run the LangGraph triage graph.

    Searches Gmail for unread threads, classifies each by priority, and
    returns a structured triage report with recommended actions.
    Requires a live Google OAuth access_token (no demo mode support).
    """
    run_id = str(uuid.uuid4())
    checkpointer = get_checkpointer()
    try:
        result = run_triage(
            user_id=body.user_id,
            access_token=body.access_token,
            run_id=run_id,
            checkpointer=checkpointer,
        )
    except Exception as exc:
        log.error("triage.error", run_id=run_id, error=str(exc))
        result = {
            "run_id": run_id,
            "status": "completed",
            "reply": "Triage failed. Please try again.",
        }

    return AgentResponse(**result)


# ── Scheduling endpoint ────────────────────────────────────────────────────────

@app.post("/v1/schedule", response_model=AgentResponse)
async def scheduling_endpoint(body: SchedulingRequest, _auth: ServiceAuth) -> AgentResponse:
    """Run the LangGraph scheduling graph.

    Extracts meeting requests from the provided thread, checks Google Calendar
    for conflicts, and proposes available slots.

    If the LLM proposes creating a calendar event, the graph pauses with
    status: "interrupted" and interrupt_data containing the event proposal.
    The client must call /v1/resume with {approved: true/false} to continue.
    """
    run_id = str(uuid.uuid4())
    checkpointer = get_checkpointer()

    # Format the thread's email bodies into a single string for the LLM prompt
    thread_content = "\n---\n".join(
        f"[{e.from_.name if e.from_ else 'Unknown'}]: {e.body[:500]}"
        for e in body.thread.emails[-3:]  # only last 3 emails to avoid token overflow
    )

    try:
        result = run_scheduling(
            thread_subject=body.thread.subject,
            thread_content=thread_content,
            user_id=body.user_id,
            access_token=body.access_token,
            run_id=run_id,
            checkpointer=checkpointer,
        )
    except Exception as exc:
        log.error("scheduling.error", run_id=run_id, error=str(exc))
        result = {
            "run_id": run_id,
            "status": "completed",
            "reply": "Scheduling failed. Please try again.",
        }

    return AgentResponse(**result)


# ── Resume (HITL) endpoint ─────────────────────────────────────────────────────

@app.post("/v1/resume", response_model=AgentResponse)
async def resume_endpoint(body: ResumeRequest, _auth: ServiceAuth) -> AgentResponse:
    """Resume a LangGraph run that was paused at an interrupt() node.

    Called by the web tier after the user approves or rejects an action
    (e.g. calendar event creation, risky automation action).

    The run_id must match a run previously paused with status: "interrupted".
    The LangGraph checkpointer restores the full graph state from Postgres
    and continues execution from the interrupted node.

    resume_value is passed directly as Command(resume=...) to the graph.
    Example: {"approved": true} or {"approved": false, "reason": "wrong time"}
    """
    from langgraph.types import Command

    # Postgres checkpointer is required — in-memory graphs cannot be resumed
    checkpointer = get_checkpointer()
    if not checkpointer:
        return AgentResponse(
            run_id=body.run_id,
            status="completed",
            reply="Checkpointer not configured. HITL resume requires DATABASE_URL to be set.",
        )

    # Currently only the scheduling graph supports HITL resume
    # In Phase 3+ automation graph resume will be added here
    graph = build_scheduling_graph(checkpointer)
    config = {"configurable": {"thread_id": body.run_id}}

    try:
        # Command(resume=...) passes the user's decision back to the interrupted node
        result = graph.invoke(Command(resume=body.resume_value), config=config)
        return AgentResponse(
            run_id=body.run_id,
            status="completed",
            reply=result.get("reply", ""),
        )
    except Exception as exc:
        log.error("resume.error", run_id=body.run_id, error=str(exc))
        return AgentResponse(
            run_id=body.run_id,
            status="completed",
            reply="Resume failed. Please try again.",
        )


# ── Global error handler ───────────────────────────────────────────────────────

@app.exception_handler(Exception)
async def global_error_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all handler for unhandled exceptions.

    Returns a structured 500 JSON response and logs the error with the
    request path for easy correlation in log aggregation tools.
    """
    log.error("unhandled_exception", path=request.url.path, error=str(exc))
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})
