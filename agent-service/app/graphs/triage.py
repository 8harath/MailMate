"""
app/graphs/triage.py — LangGraph triage StateGraph
===================================================

PURPOSE:
    Scans the user's unread Gmail inbox, classifies each thread by priority,
    and produces a concise triage report with recommended actions.
    This mirrors the logic in lib/agents.ts runTriageAgent() but as a
    proper LangGraph StateGraph with checkpointing support.

GRAPH STRUCTURE (simple — no branching):
    triage_agent
         │
        END

WHY A SINGLE NODE?
    Triage is a single LLM call with tool use (search_inbox to fetch unread
    threads, optionally readThread for context). LangGraph still provides
    value here via:
      - Postgres checkpointing (run is recoverable if the service crashes)
      - Consistent observable pattern with other graphs
      - Easy to extend: add a "filter_by_preferences" node before triage_agent
        to apply stored priority_rule memories before the LLM classifies

TOOLS AVAILABLE TO triage_agent:
    search_inbox(query)     — Used with "is:unread" to fetch unread threads
    list_calendar_events()  — Used optionally to correlate threads with meetings
    query_memory(category)  — Check priority_rule memories to personalise ranking
    store_memory(...)       — Save new rules if the user expresses them

LLM PROMPT STRATEGY:
    The system prompt instructs the LLM to output a structured report with
    three sections: "Needs Attention Now", "Can Wait", "Skip".
    The report format is consistent across runs so the UI can parse it
    predictably (no JSON output — natural language is fine for display).

CHECKPOINTING:
    Each triage run gets a UUID as its thread_id config. The checkpointer
    saves state so a failed mid-run can be re-tried without re-scanning the
    entire inbox from scratch (in practice triage is fast enough that retry
    from scratch is acceptable, but the pattern is consistent).

USAGE (from app/main.py):
    result = run_triage(user_id, access_token, run_id, checkpointer)
    # Returns: { run_id, status: "completed", reply: "<triage report>" }
"""
from typing import Annotated, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages

from app.llm import get_llm
from app.tools.gmail import create_gmail_tools
from app.tools.memory import create_memory_tools


# ── State definition ───────────────────────────────────────────────────────────

class TriageState(TypedDict):
    """State for the triage graph.

    messages: LangChain message list (add_messages merges on update).
    summary:  Final triage report text extracted from the LLM's last response.
    """
    messages: Annotated[list, add_messages]
    user_id: str
    access_token: str
    summary: str


# ── Graph builder ──────────────────────────────────────────────────────────────

def build_triage_graph(checkpointer=None):
    """Build and compile the triage graph.

    Args:
        checkpointer: PostgresSaver or None. Pass None for stateless runs.
    """
    llm = get_llm()

    def triage_agent(state: TriageState):
        """Main triage node: search inbox → classify threads → produce report.

        Binds Gmail + memory tools to the LLM so it can:
          1. Call search_inbox('is:unread') to get the user's unread threads
          2. Optionally call query_memory('priority_rule') to apply stored rules
          3. Classify each thread and produce a structured triage report

        The system prompt specifies the output format (three sections) so the
        UI can render it consistently.
        """
        tools = create_gmail_tools(state["access_token"]) + create_memory_tools(state["user_id"])
        llm_with_tools = llm.bind_tools(tools)

        system = SystemMessage(content="""You are MailMate Triage, an AI inbox organiser.

Your job:
1. Search for unread emails using search_inbox('is:unread').
2. Check stored priority rules with query_memory('priority_rule').
3. Classify each thread: urgent / important / normal / low.
4. Suggest a specific action per thread: reply now / schedule follow-up / archive / read later.
5. Present a concise executive summary.

Output format — three sections:
  ## Needs Attention Now
  ## Can Wait
  ## Skip / Archive

Be concise and actionable. Each item: bullet with thread subject + recommended action.""")

        response = llm_with_tools.invoke([system] + state["messages"])
        return {"messages": [response], "summary": response.content}

    graph = StateGraph(TriageState)
    graph.add_node("triage_agent", triage_agent)
    graph.set_entry_point("triage_agent")
    graph.add_edge("triage_agent", END)

    return graph.compile(checkpointer=checkpointer)


# ── Public entry point ────────────────────────────────────────────────────────

def run_triage(
    user_id: str,
    access_token: str,
    run_id: str,
    checkpointer=None,
) -> dict:
    """Run the triage graph and return a normalised result dict.

    Args:
        user_id:      User identifier (email address).
        access_token: Google OAuth token — required for Gmail tool calls.
        run_id:       UUID for this run (used as LangGraph thread_id).
        checkpointer: PostgresSaver or None.

    Returns:
        { run_id, status: "completed", reply: "<triage report text>" }
    """
    graph = build_triage_graph(checkpointer)
    config = {"configurable": {"thread_id": run_id}}
    initial_state = {
        "messages": [HumanMessage(content="Review my unread inbox and give me a triage summary.")],
        "user_id": user_id,
        "access_token": access_token,
        "summary": "",
    }
    result = graph.invoke(initial_state, config=config)
    return {"run_id": run_id, "status": "completed", "reply": result["summary"]}
