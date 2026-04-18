"""
app/checkpointer.py — LangGraph Postgres checkpointer
======================================================

PURPOSE:
    LangGraph checkpoints are snapshots of a graph's state saved between nodes.
    They enable two critical enterprise features:

    1. Human-in-the-loop (HITL): when interrupt() is called inside a node,
       LangGraph saves the state to the checkpointer and returns control to
       the caller. The run can be resumed later — even from a different process
       or server replica — by calling graph.invoke(Command(resume=...), config).

    2. Fault tolerance: if the agent-service crashes mid-run, the run can be
       resumed from the last checkpoint rather than starting from scratch.

CHECKPOINTER CHOICE: PostgresSaver
    - LangGraph stores checkpoints in the "langgraph" schema of the same
      Postgres instance used by the web app (DATABASE_URL).
    - PostgresSaver.setup() creates the required tables on first run.
    - This avoids introducing a separate persistence system.
    - Alternative: AsyncPostgresSaver for async FastAPI (requires asyncpg).
      PostgresSaver is used here for simplicity; migrate to async version
      if sync checkpointing becomes a bottleneck.

IN-MEMORY FALLBACK:
    When DATABASE_URL is not set, get_checkpointer() returns None.
    LangGraph graphs compiled without a checkpointer still run correctly —
    they just don't persist state between requests, so HITL and fault
    tolerance are unavailable. This is acceptable for development.

SINGLETON:
    @lru_cache ensures setup() is called only once per process lifecycle,
    not on every request. The PostgresSaver creates its connection pool
    on first use.

USAGE:
    from app.checkpointer import get_checkpointer
    cp = get_checkpointer()           # None in dev without DATABASE_URL
    graph = build_graph(cp)           # pass to graph.compile(checkpointer=cp)
    config = {"configurable": {"thread_id": run_id}}
    result = graph.invoke(state, config=config)
"""
from functools import lru_cache

from app.config import settings


@lru_cache(maxsize=1)
def get_checkpointer():
    """Return a PostgresSaver instance or None when DATABASE_URL is not set.

    Cached with lru_cache so the Postgres connection pool is shared across
    all requests in the same worker process.
    """
    if not settings.database_url:
        # No DATABASE_URL — return None so graphs run without checkpointing
        return None

    # Import lazily to avoid a hard dependency when DATABASE_URL is not set
    # (allows the service to start in minimal environments without langgraph-checkpoint-postgres)
    from langgraph.checkpoint.postgres import PostgresSaver

    cp = PostgresSaver.from_conn_string(settings.database_url)
    # setup() is idempotent — creates langgraph.* tables if they don't exist
    cp.setup()
    return cp
