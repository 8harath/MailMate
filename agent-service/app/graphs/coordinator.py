"""
app/graphs/coordinator.py — LangGraph coordinator StateGraph
=============================================================

PURPOSE:
    Central multi-agent orchestrator. Mirrors the logic in the web-tier
    lib/coordinator.ts but as a proper LangGraph StateGraph with:
      - Typed state (CoordinatorState TypedDict)
      - Conditional routing based on classified intent
      - Postgres checkpointing (run state persists across requests)
      - Tool-using nodes (Gmail + Calendar + memory tools)

GRAPH STRUCTURE:
    classify_intent
         │
         ▼
    route_intent (conditional edge)
    ┌────┬───────┬────────────┬──────────┐
    │    │       │            │          │
    ▼    ▼       ▼            ▼          ▼
  run_  run_   run_        run_       (END)
  gen   triage sched       simple
   │      │      │           │
   └──────┴──────┴───────────┘
              │
             END

INTENT CLASSES (classify_intent node):
    general_email_help — draft, send, search, archive, manage threads
    triage             — scan unread inbox, classify, report
    scheduling         — extract meeting times, check calendar, propose slots
    automation         — classify actions, run safe ones, queue risky ones
    memory_update      — store/delete a user preference explicitly stated
    simple_question    — answer from thread context without any tool calls

TOOL USE:
    general_email_help, triage, scheduling nodes bind Gmail + memory tools.
    simple_question answers from context only (fastest, no tool overhead).

MEMORY:
    memory_context (formatted preference list) is passed as a SystemMessage
    prefix so every node is aware of stored user preferences.

CHECKPOINTING:
    Each run is identified by a UUID (run_id). The graph is compiled with
    checkpointer=PostgresSaver so state is saved between nodes. This enables
    the HITL resume flow if a scheduling node calls interrupt().

USAGE (from app/main.py):
    result = run_coordinator(
        message, thread_dict, access_token, user_id,
        history, memory_context, run_id, checkpointer
    )
    # Returns: { run_id, status, reply, delegations, memories_stored }
"""
from __future__ import annotations

from typing import Annotated, Any, Literal, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages

from app.llm import get_llm
from app.tools.gmail import create_gmail_tools
from app.tools.memory import create_memory_tools


# ── State definition ───────────────────────────────────────────────────────────

class CoordinatorState(TypedDict):
    """Full state carried through the coordinator graph.

    messages: LangGraph annotated list — add_messages merges instead of replacing.
    user_id: email used as the user identifier throughout.
    access_token: Google OAuth token (None in demo mode — tools unavailable).
    thread_context: pre-formatted string describing the selected email thread.
    memory_context: pre-formatted string of stored user preferences.
    intent: set by classify_intent, used by the conditional edge.
    delegations: list of sub-graph calls for the response's delegation badges.
    memories_stored: preferences explicitly stored during this run.
    reply: final synthesised text response.
    """
    messages: Annotated[list, add_messages]
    user_id: str
    access_token: str | None
    thread_context: str
    memory_context: str
    intent: str
    delegations: list[dict[str, Any]]
    memories_stored: list[dict[str, Any]]
    reply: str


# ── Thread context helper ──────────────────────────────────────────────────────

def _thread_context(thread: dict | None) -> str:
    """Format a thread dict into a human-readable context string for the LLM."""
    if not thread:
        return "No email thread is currently selected."
    emails = thread.get("emails", [])
    preview = ""
    if emails:
        last = emails[-1]
        from_ = last.get("from", {})
        preview = f"\n  Latest: [{from_.get('name', '')}] {last.get('body', '')[:200]}"
    from_ = thread.get("from", {})
    return (
        f'Thread: "{thread.get("subject", "")}" '
        f"from {from_.get('name', '')} <{from_.get('email', '')}>"
        f" ({len(emails)} messages){preview}"
    )


# ── Graph builder ──────────────────────────────────────────────────────────────

def build_coordinator_graph(checkpointer=None):
    """Build and compile the coordinator StateGraph.

    Passing a checkpointer enables state persistence (required for HITL).
    Passing None is valid for stateless dev runs.
    """
    llm = get_llm()

    # ── classify_intent node ──────────────────────────────────────────────────
    def classify_intent(state: CoordinatorState) -> dict:
        """One-shot LLM call to classify the user message into an intent bucket.

        Uses only the last user message + thread context to keep latency low.
        Defaults to "general_email_help" for any unrecognised output.
        """
        last_user_msg = next(
            (m.content for m in reversed(state["messages"]) if isinstance(m, HumanMessage)),
            "",
        )
        prompt = (
            "Classify the user's intent into one of: "
            "general_email_help | triage | scheduling | automation | memory_update | simple_question\n"
            f"User message: {last_user_msg}\n"
            "Thread context: " + state["thread_context"] + "\n"
            "Reply with ONLY the intent label."
        )
        result = llm.invoke([HumanMessage(content=prompt)])
        intent = result.content.strip().lower()
        valid = {"general_email_help", "triage", "scheduling", "automation", "memory_update", "simple_question"}
        # Default to general_email_help for any unrecognised classification output
        if intent not in valid:
            intent = "general_email_help"
        return {"intent": intent}

    # ── Conditional edge: maps intent → node name ─────────────────────────────
    def route_intent(state: CoordinatorState) -> Literal[
        "run_general", "run_triage", "run_scheduling", "run_simple"
    ]:
        """Select the next node based on the classified intent."""
        mapping = {
            "general_email_help": "run_general",
            "automation": "run_general",       # automation uses the general tool node
            "memory_update": "run_general",    # memory tools are available in general
            "triage": "run_triage",
            "scheduling": "run_scheduling",
            "simple_question": "run_simple",
        }
        return mapping.get(state["intent"], "run_general")

    # ── run_general node ──────────────────────────────────────────────────────
    def run_general(state: CoordinatorState) -> dict:
        """General-purpose email assistant with full tool access.

        Handles: draft, send (after confirmation), search, archive, labels,
        memory store/query, automation classification.
        """
        tools = []
        if state["access_token"]:
            tools += create_gmail_tools(state["access_token"])
        tools += create_memory_tools(state["user_id"])
        llm_tools = llm.bind_tools(tools) if tools else llm

        system = SystemMessage(content=f"""You are MailMate, an intelligent email assistant.
{state['memory_context']}
{state['thread_context']}
Today: {__import__('datetime').date.today().isoformat()}
RULES: Never send email without explicit user confirmation. Draft first, send only when asked.
Use store_memory when the user explicitly states a preference (always/prefer/never/from now on).""")

        response = llm_tools.invoke([system] + state["messages"])
        return {
            "messages": [response],
            "reply": response.content,
            "delegations": [{"agent": "writer", "action": "general_email_help", "result": response.content}],
        }

    # ── run_triage node ───────────────────────────────────────────────────────
    def run_triage(state: CoordinatorState) -> dict:
        """Inbox triage: search unread threads and classify by priority."""
        if not state["access_token"]:
            return {"reply": "Triage requires Gmail authentication. Please sign in.", "delegations": []}

        tools = create_gmail_tools(state["access_token"]) + create_memory_tools(state["user_id"])
        llm_tools = llm.bind_tools(tools)
        system = SystemMessage(content="""You are MailMate Triage. Use search_inbox('is:unread'),
classify threads (urgent/important/normal/low) using stored preferences, and return a concise
triage report with recommended actions (reply now / schedule / archive / read later).""")

        response = llm_tools.invoke([system, HumanMessage(content="Triage my inbox.")])
        return {
            "messages": [response],
            "reply": response.content,
            "delegations": [{"agent": "triage", "action": "triage", "result": response.content}],
        }

    # ── run_scheduling node ───────────────────────────────────────────────────
    def run_scheduling(state: CoordinatorState) -> dict:
        """Scheduling: extract meeting requests, check calendar, propose slots."""
        if not state["access_token"]:
            return {"reply": "Scheduling requires Gmail authentication.", "delegations": []}

        tools = create_gmail_tools(state["access_token"]) + create_memory_tools(state["user_id"])
        llm_tools = llm.bind_tools(tools)
        system = SystemMessage(content=f"""You are MailMate Scheduler. Extract meeting requests
from the email thread, use list_calendar_events to check for conflicts, and suggest available
slots. Consider the user's scheduling_preference memories.
Thread: {state['thread_context']}""")

        last_msg = next(
            (m.content for m in reversed(state["messages"]) if isinstance(m, HumanMessage)),
            "Help me schedule a meeting from this email thread.",
        )
        response = llm_tools.invoke([system, HumanMessage(content=last_msg)])
        return {
            "messages": [response],
            "reply": response.content,
            "delegations": [{"agent": "scheduler", "action": "scheduling", "result": response.content}],
        }

    # ── run_simple node ───────────────────────────────────────────────────────
    def run_simple(state: CoordinatorState) -> dict:
        """Answers simple questions about the thread without any tool calls.

        Fastest path — no tool binding, no Gmail/Calendar API calls.
        Used for: "who sent this?", "what is this about?", etc.
        """
        system = SystemMessage(content=f"You are MailMate. Answer from context:\n{state['thread_context']}")
        last_msg = state["messages"][-1] if state["messages"] else HumanMessage(content="")
        response = llm.invoke([system, last_msg])
        return {"messages": [response], "reply": response.content, "delegations": []}

    # ── Graph assembly ────────────────────────────────────────────────────────
    graph = StateGraph(CoordinatorState)
    graph.add_node("classify_intent", classify_intent)
    graph.add_node("run_general", run_general)
    graph.add_node("run_triage", run_triage)
    graph.add_node("run_scheduling", run_scheduling)
    graph.add_node("run_simple", run_simple)

    graph.set_entry_point("classify_intent")
    graph.add_conditional_edges("classify_intent", route_intent)
    graph.add_edge("run_general", END)
    graph.add_edge("run_triage", END)
    graph.add_edge("run_scheduling", END)
    graph.add_edge("run_simple", END)

    return graph.compile(checkpointer=checkpointer)


# ── Public entry point ────────────────────────────────────────────────────────

def run_coordinator(
    message: str,
    thread: dict | None,
    access_token: str | None,
    user_id: str,
    history: list[dict],
    memory_context: str,
    run_id: str,
    checkpointer=None,
) -> dict:
    """Run the coordinator graph and return a normalised result dict.

    Args:
        message:        Latest user message.
        thread:         Selected email thread dict (or None).
        access_token:   Google OAuth token (None in demo mode).
        user_id:        User identifier (email address).
        history:        Prior conversation turns [{role, content}].
        memory_context: Pre-formatted string of stored user preferences.
        run_id:         UUID for this run (used as LangGraph thread_id).
        checkpointer:   PostgresSaver or None.

    Returns dict with keys: run_id, status, reply, delegations,
                            memories_used, memories_stored.
    """
    graph = build_coordinator_graph(checkpointer)
    config = {"configurable": {"thread_id": run_id}}

    # Reconstruct message history as LangChain message objects
    messages = [
        HumanMessage(content=m["content"]) if m["role"] == "user"
        else type("AIMessage", (), {"content": m["content"], "type": "ai"})()
        for m in history
    ] + [HumanMessage(content=message)]

    initial_state: CoordinatorState = {
        "messages": messages,
        "user_id": user_id,
        "access_token": access_token,
        "thread_context": _thread_context(thread),
        "memory_context": memory_context,
        "intent": "",
        "delegations": [],
        "memories_stored": [],
        "reply": "",
    }

    result = graph.invoke(initial_state, config=config)
    return {
        "run_id": run_id,
        "status": "completed",
        "reply": result["reply"],
        "delegations": result.get("delegations", []),
        "memories_used": [],   # populated in Phase 3+ memory tool integration
        "memories_stored": result.get("memories_stored", []),
    }
