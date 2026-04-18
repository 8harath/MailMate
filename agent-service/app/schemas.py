"""
app/schemas.py — Pydantic v2 DTOs for the agent service
=========================================================

All request and response models used by the FastAPI routes are defined here.
Keeping them in one file makes it easy to keep the Python schemas in sync
with the TypeScript types in submissions/61-Avalon/lib/agent-client.ts.

TYPESCRIPT EQUIVALENTS:
    CoordinatorRequest  ↔  callCoordinator() params
    TriageRequest       ↔  callTriage() params
    SchedulingRequest   ↔  callScheduling() params
    ResumeRequest       ↔  resumeRun() params
    AgentResponse       ↔  AgentResponse interface

FIELD NAMING:
    Python uses snake_case; the API JSON also uses snake_case so no
    alias configuration is needed. The TypeScript client sends
    user_id, access_token, run_id etc. directly.

EMAIL THREAD MODELLING:
    The Thread and EmailMessage models handle the "from" field name collision
    (Python keyword) by mapping the JSON "from" key to the Python field "from_"
    using Config.fields. model_dump(by_alias=True) serialises back to "from".

OPTIONAL FIELDS:
    access_token is Optional[str] in all request models to support demo mode
    (no Google OAuth). Routes check for its presence before calling Gmail tools.
"""
from typing import Any

from pydantic import BaseModel


# ── Email thread types ────────────────────────────────────────────────────────

class ConversationMessage(BaseModel):
    """A single turn in the conversation history sent to the coordinator."""
    role: str     # "user" or "assistant"
    content: str


class ThreadFrom(BaseModel):
    """Sender info for a thread or individual email."""
    name: str
    email: str


class EmailMessage(BaseModel):
    """A single email within a thread (mirrors types/index.ts Email type)."""
    id: str
    from_: ThreadFrom | None = None
    subject: str | None = None
    body: str = ""
    timestamp: str | None = None

    class Config:
        populate_by_name = True
        # Map JSON "from" → Python field "from_" (avoids keyword collision)
        fields = {"from_": "from"}


class Thread(BaseModel):
    """An email thread containing one or more EmailMessage objects."""
    id: str
    subject: str
    from_: ThreadFrom | None = None
    emails: list[EmailMessage] = []

    class Config:
        populate_by_name = True
        fields = {"from_": "from"}


# ── Request models ────────────────────────────────────────────────────────────

class CoordinatorRequest(BaseModel):
    """Request body for POST /v1/coordinator."""
    message: str
    thread: Thread | None = None
    thread_id: str | None = None
    history: list[ConversationMessage] = []
    user_id: str
    access_token: str | None = None


class TriageRequest(BaseModel):
    """Request body for POST /v1/triage.

    access_token is required (no demo mode for triage — needs real inbox data).
    """
    user_id: str
    access_token: str


class SchedulingRequest(BaseModel):
    """Request body for POST /v1/schedule.

    thread is required — the scheduling graph analyses the email thread content
    to extract meeting requests and proposed times.
    """
    thread: Thread
    user_id: str
    access_token: str


class ResumeRequest(BaseModel):
    """Request body for POST /v1/resume (HITL continuation).

    run_id must match a run previously returned with status: "interrupted".
    resume_value is passed directly as LangGraph Command(resume=...).
    """
    run_id: str
    # Arbitrary dict — contents depend on the interrupted node.
    # For calendar approval: {"approved": true/false}
    resume_value: dict[str, Any]
    user_id: str


# ── Response model ────────────────────────────────────────────────────────────

class AgentResponse(BaseModel):
    """Standard response returned by all agent endpoints.

    status:
        "completed"   — the graph ran to completion; reply contains the answer.
        "interrupted" — the graph paused at interrupt(); interrupt_data contains
                        what to show the user for approval. Call /v1/resume to continue.

    run_id: UUID identifying this run. Store it client-side when status is
            "interrupted" so you can pass it to the /v1/resume call.
    """
    run_id: str
    status: str               # "completed" | "interrupted"
    reply: str | None = None  # final agent reply (None when interrupted)
    interrupt_data: dict[str, Any] | None = None  # proposal/approval data for HITL
    delegations: list[dict[str, Any]] = []        # sub-agent call log
    memories_used: list[dict[str, Any]] = []      # preferences retrieved from DB
    memories_stored: list[dict[str, Any]] = []    # preferences saved during run
    steps: list[dict[str, Any]] = []              # raw LangGraph step traces
