"""
app/tools/memory.py — User preference memory tools
===================================================

PURPOSE:
    Provide the LLM with tools to read and write per-user preference memories.
    Memories are stored in Postgres (agent_memory table) via the web BFF
    (the agent-service calls /api/agent/memory on the Next.js app).

WHY VIA THE WEB BFF?
    Same reason as gmail.py: the web tier owns the Prisma client and the
    Postgres connection pool. Rather than duplicating the Prisma logic in
    Python, we call back to the existing memory API routes.

MEMORY CATEGORIES (matches MemoryCategory enum in prisma/schema.prisma):
    sender_preference      — treat emails from X as priority
    priority_rule          — "flag anything with 'urgent' in subject"
    scheduling_preference  — "prefer afternoon meetings"
    writing_style          — "always use formal tone with clients"
    automation_rule        — "auto-archive newsletters"
    general                — catch-all for uncategorised preferences

WHEN TO STORE:
    Only when the user EXPLICITLY states a preference ("always", "I prefer",
    "from now on", "never", "don't"). The LLM is instructed not to infer
    preferences silently — only explicit statements are stored.
    This prevents the memory system from accumulating noise.

WHEN TO QUERY:
    At the start of each coordinator run (via formatMemoryContext in the web
    tier). The memory context string is passed as part of the system prompt
    so every node is aware of preferences without explicitly calling
    query_memory. The tool is still available for the LLM to query specific
    categories mid-run.

USAGE:
    tools = create_memory_tools(user_id)
    llm_with_tools = llm.bind_tools(tools)
"""
import httpx
from langchain_core.tools import tool

from app.config import settings


def create_memory_tools(user_id: str) -> list:
    """Return memory tools bound to the given user_id.

    All calls hit the web BFF which owns the Prisma connection.
    """
    base_url = settings.web_callback_url

    @tool
    async def query_memory(category: str | None = None) -> str:
        """Retrieve stored user preferences from the memory database.

        Args:
            category: Optional filter. One of: sender_preference, priority_rule,
                      scheduling_preference, writing_style, automation_rule, general.
                      Omit to retrieve all memories.
        Returns: Formatted list of stored preferences, or "No preferences found."
        """
        params = {"userId": user_id}
        if category:
            params["category"] = category
        async with httpx.AsyncClient(base_url=base_url, timeout=10) as client:
            r = await client.get("/api/agent/memory", params=params)
            r.raise_for_status()
            memories = r.json().get("memories", [])
            if not memories:
                return "No stored preferences found."
            return "\n".join(
                f"- [{m['category']}] {m['key']}: {m['value']}" for m in memories
            )

    @tool
    async def store_memory(category: str, key: str, value: str) -> str:
        """Store a user preference in the memory database.

        IMPORTANT: Only call this when the user EXPLICITLY states a preference.
        Do not infer or silently store preferences based on behaviour patterns.

        Args:
            category: One of the MemoryCategory enum values (see module docs).
            key:      Short name for the preference, e.g. "tone_with_clients".
            value:    The preference value, e.g. "always formal".
        Returns: Confirmation string.
        """
        async with httpx.AsyncClient(base_url=base_url, timeout=10) as client:
            r = await client.post(
                "/api/agent/memory",
                json={"userId": user_id, "category": category, "key": key, "value": value},
            )
            r.raise_for_status()
            return f"Stored preference: [{category}] {key} = {value}"

    return [query_memory, store_memory]
