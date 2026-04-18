"""
app/graphs/scheduling.py — LangGraph scheduling StateGraph with HITL
=====================================================================

PURPOSE:
    Handles scheduling-related requests extracted from email threads:
      1. Extract meeting requests / proposed times from the thread
      2. Check the user's Google Calendar for conflicts
      3. Propose available time slots
      4. If the user wants to CREATE an event, pause for human-in-the-loop
         approval before creating it (interrupt() pattern)

GRAPH STRUCTURE:
    analyze_thread
         │
         ▼
    check_event_approval ← interrupt() pauses here if a creation was proposed
         │
         ▼
      finalize
         │
        END

HUMAN-IN-THE-LOOP (HITL) PATTERN:
    When the LLM produces output containing '"create_event": true' (a JSON
    proposal), the check_event_approval node calls interrupt() with the
    proposal details. LangGraph:
      1. Saves the full graph state to Postgres (via the checkpointer)
      2. Returns {"__interrupt__": [{value: interrupt_data}]} to the caller
      3. The API route detects this and returns status: "interrupted"
      4. The web client shows the proposal to the user
      5. User approves → POST /api/agent/resume → resume_endpoint calls
         graph.invoke(Command(resume={approved: true}), config=config)
      6. LangGraph restores state from checkpoint and continues from
         check_event_approval with the approval value

    If the LLM did NOT propose event creation, interrupt() is never called and
    the graph runs to completion normally (no pause required).

INTERRUPT_BEFORE:
    The graph is compiled with interrupt_before=["check_event_approval"].
    This means LangGraph automatically pauses before that node runs, giving
    check_event_approval access to the graph's current state plus the
    approval value passed via Command(resume=...).

    Note: interrupt_before is the correct way to implement HITL in LangGraph
    v0.3+. The older interrupt() function call is used inside the node for
    granular control over what data is passed to the user.

FALLBACK:
    If no event creation is proposed, finalize() simply echoes state["reply"]
    unchanged. The node is a no-op in the non-HITL path.

USAGE (from app/main.py):
    result = run_scheduling(thread_subject, thread_content, user_id,
                            access_token, run_id, checkpointer)
    if result["status"] == "interrupted":
        # Show result["interrupt_data"] to user, collect approval
        # POST to /v1/resume with {run_id, resume_value: {approved: bool}}
"""
from typing import Annotated, Any, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages
from langgraph.types import interrupt

from app.llm import get_llm
from app.tools.gmail import create_gmail_tools
from app.tools.memory import create_memory_tools


# ── State definition ───────────────────────────────────────────────────────────

class SchedulingState(TypedDict):
    """State carried through the scheduling graph.

    proposed_event: populated by check_event_approval when the LLM outputs
                    a calendar event proposal JSON. None otherwise.
    reply: final text response accumulated across nodes.
    """
    messages: Annotated[list, add_messages]
    user_id: str
    access_token: str
    thread_subject: str
    thread_content: str
    proposed_event: dict[str, Any] | None
    reply: str


# ── Graph builder ──────────────────────────────────────────────────────────────

def build_scheduling_graph(checkpointer: BaseCheckpointSaver | None = None):
    """Build and compile the scheduling graph.

    interrupt_before=["check_event_approval"] tells LangGraph to pause
    execution before that node and wait for Command(resume=...) when a
    calendar event creation has been proposed.
    """
    llm = get_llm()

    def analyze_thread(state: SchedulingState):
        """Main LLM call: extract meeting requests, check calendar, propose slots.

        The system prompt instructs the LLM to output a JSON proposal block
        if the user explicitly wants to book a meeting. This is detected in
        check_event_approval.
        """
        import datetime
        tools = create_gmail_tools(state["access_token"]) + create_memory_tools(state["user_id"])
        llm_with_tools = llm.bind_tools(tools)

        system = SystemMessage(content=f"""You are MailMate Scheduler.

Your job:
1. Extract meeting requests, proposed times, or scheduling needs from the thread.
2. Check the user's calendar for conflicts using list_calendar_events.
3. Suggest available time slots that work.
4. If the user explicitly wants to CREATE an event, output a JSON proposal:
   {{"create_event": true, "summary": "...", "start": "ISO datetime",
     "end": "ISO datetime", "attendees": [...]}}
   Otherwise just propose times in your reply.

IMPORTANT: Only output the JSON proposal if creation is explicitly requested.
Today's date: {datetime.date.today().isoformat()}""")

        prompt = (
            f"Process this email thread for scheduling:\n\n"
            f"Subject: {state['thread_subject']}\n\n{state['thread_content']}"
        )
        response = llm_with_tools.invoke([system, HumanMessage(content=prompt)])
        return {"messages": [response], "reply": response.content}

    def check_event_approval(state: SchedulingState):
        """Detect event creation proposal and pause for user approval via interrupt().

        Parses the last LLM response for a JSON block containing "create_event": true.
        If found, calls interrupt() which saves state to Postgres and returns
        control to the API caller with the proposal details.

        If no proposal is found, this node is a pass-through.
        """
        import json
        import re

        last_msg = state["messages"][-1]
        content = last_msg.content if hasattr(last_msg, "content") else ""

        if '"create_event": true' in content:
            match = re.search(r'\{[^}]*"create_event"[^}]*\}', content, re.DOTALL)
            if match:
                try:
                    proposal = json.loads(match.group())
                    # interrupt() saves state + returns control to caller with this payload
                    # The API route detects "__interrupt__" in the result dict
                    approval = interrupt({
                        "type": "calendar_event_approval",
                        "proposal": proposal,
                        "message": "Please confirm: should I create this calendar event?",
                    })
                    # When resumed, approval contains the user's response (e.g. {approved: true})
                    return {"proposed_event": proposal if approval.get("approved") else None}
                except json.JSONDecodeError:
                    pass  # Malformed JSON from LLM — skip event creation

        # No event proposal detected — continue normally without pausing
        return {"proposed_event": None}

    def finalize(state: SchedulingState):
        """Append approval status to the reply when an event was proposed."""
        if state.get("proposed_event"):
            return {"reply": state["reply"] + "\n\n✅ Calendar event approved and ready to create."}
        return {"reply": state["reply"]}

    graph = StateGraph(SchedulingState)
    graph.add_node("analyze_thread", analyze_thread)
    graph.add_node("check_event_approval", check_event_approval)
    graph.add_node("finalize", finalize)

    graph.set_entry_point("analyze_thread")
    graph.add_edge("analyze_thread", "check_event_approval")
    graph.add_edge("check_event_approval", "finalize")
    graph.add_edge("finalize", END)

    # interrupt_before pauses execution before check_event_approval
    # allowing HITL approval before state-changing operations
    return graph.compile(checkpointer=checkpointer, interrupt_before=["check_event_approval"])


# ── Public entry point ────────────────────────────────────────────────────────

def run_scheduling(
    thread_subject: str,
    thread_content: str,
    user_id: str,
    access_token: str,
    run_id: str,
    checkpointer: BaseCheckpointSaver | None = None,
) -> dict:
    """Run the scheduling graph and return a normalised result.

    Returns:
        { run_id, status: "completed"|"interrupted", reply, interrupt_data? }
    """
    graph = build_scheduling_graph(checkpointer)
    config = {"configurable": {"thread_id": run_id}}
    initial_state = {
        "messages": [],
        "user_id": user_id,
        "access_token": access_token,
        "thread_subject": thread_subject,
        "thread_content": thread_content,
        "proposed_event": None,
        "reply": "",
    }
    result = graph.invoke(initial_state, config=config)

    # LangGraph signals an interrupt via the "__interrupt__" key in the result dict
    if "__interrupt__" in result:
        interrupt_info = result["__interrupt__"][0].value
        return {
            "run_id": run_id,
            "status": "interrupted",
            "reply": result.get("reply", ""),
            "interrupt_data": interrupt_info,
        }

    return {"run_id": run_id, "status": "completed", "reply": result["reply"]}
