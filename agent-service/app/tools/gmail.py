"""
app/tools/gmail.py — Gmail and Calendar LangChain tools
========================================================

ARCHITECTURE:
    The agent-service does NOT hold Google OAuth tokens. Only the Next.js
    web tier holds them (stored in the encrypted JWT session cookie).

    Therefore, all Gmail and Calendar operations are performed by calling
    back to the web BFF (WEB_CALLBACK_URL) with the access_token as a
    Bearer header. The web tier's existing Gmail/Calendar proxy routes
    (/api/gmail/*, /api/calendar/*) execute the actual Google API calls
    and return the results.

    This design has three advantages:
      1. Token security: OAuth tokens never leave the web tier
      2. DRY: Gmail/Calendar logic is not duplicated in Python
      3. Consistency: both in-process and agent-service paths use the
         same Gmail/Calendar proxy routes

HOW TOOLS ARE CREATED:
    create_gmail_tools(access_token) returns a list of LangChain @tool
    functions. Each tool is bound to the provided access_token via closure.
    The LLM receives these tools via llm.bind_tools(tools) in each graph node.

AVAILABLE TOOLS:
    search_inbox(query)       — Gmail search (returns thread snippet list)
    list_calendar_events(n)   — Upcoming events for next n days
    draft_reply(thread_id, body) — Prepare a draft (no send)
    send_email(to, subj, body, thread_id?) — Send (call only after confirmation)

HTTP TIMEOUT: 30 seconds per tool call.
    Gmail/Calendar API calls typically complete in <2s but can be slow.
    30s prevents stuck tool calls from blocking a graph run.

ERROR HANDLING:
    httpx raises on non-2xx (raise_for_status). The LangGraph tool runner
    catches this and passes the error message back to the LLM as a tool
    result so the LLM can inform the user gracefully.
"""
import httpx
from langchain_core.tools import tool

from app.config import settings


def _make_client(access_token: str) -> httpx.AsyncClient:
    """Create an httpx client pre-configured with the BFF base URL and auth header."""
    return httpx.AsyncClient(
        base_url=settings.web_callback_url,
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=30,
    )


def create_gmail_tools(access_token: str) -> list:
    """Return Gmail and Calendar LangChain tools bound to the given OAuth token.

    Each tool is an async @tool decorated function. The access_token is
    captured in the closure — do not store it anywhere else.
    """

    @tool
    async def search_inbox(query: str) -> str:
        """Search Gmail inbox using a Gmail search query string.

        Examples: 'is:unread', 'from:boss@company.com', 'subject:invoice'
        Returns: A formatted list of up to 10 matching thread snippets.
        """
        async with _make_client(access_token) as client:
            r = await client.get("/api/gmail/threads", params={"q": query, "maxResults": 10})
            r.raise_for_status()
            threads = r.json().get("threads", [])
            if not threads:
                return "No threads found for that query."
            # Format as a readable list with thread ID for follow-up tool calls
            return "\n".join(
                f"- [{t.get('id')}] {t.get('snippet', '')[:120]}" for t in threads
            )

    @tool
    async def list_calendar_events(days_ahead: int = 7) -> str:
        """List upcoming Google Calendar events for the next `days_ahead` days.

        Returns: Formatted list of event title + start time.
        Use this before proposing meeting times to check for conflicts.
        """
        async with _make_client(access_token) as client:
            r = await client.get("/api/calendar/events", params={"daysAhead": days_ahead})
            r.raise_for_status()
            events = r.json().get("events", [])
            if not events:
                return "No upcoming events found."
            return "\n".join(
                f"- {e.get('summary', 'No title')} @ {e.get('start', {}).get('dateTime', 'TBD')}"
                for e in events
            )

    @tool
    async def draft_reply(thread_id: str, body: str) -> str:
        """Prepare a reply draft for a Gmail thread WITHOUT sending it.

        Always draft first; never call send_email without explicit user confirmation.
        Returns: A preview of the draft for the user to review.
        """
        return (
            f"Draft ready for thread {thread_id}:\n\n{body}\n\n"
            "(Call send_email to send after user confirms.)"
        )

    @tool
    async def send_email(
        to: str,
        subject: str,
        body: str,
        thread_id: str | None = None,
    ) -> str:
        """Send an email via Gmail. ONLY call after explicit user confirmation.

        Args:
            to:        Recipient email address
            subject:   Email subject line
            body:      Email body (plain text)
            thread_id: Optional — include to send as a reply in an existing thread
        Returns: Success confirmation with message ID.
        """
        async with _make_client(access_token) as client:
            r = await client.post(
                "/api/gmail/send",
                json={"to": to, "subject": subject, "body": body, "threadId": thread_id},
            )
            r.raise_for_status()
            return f"Email sent successfully. Message ID: {r.json().get('messageId')}"

    return [search_inbox, list_calendar_events, draft_reply, send_email]
