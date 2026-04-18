"""
app/config.py — Agent service configuration
============================================

Uses pydantic-settings to load configuration from environment variables
(and optionally a .env file when running outside Docker).

All settings have safe defaults so the service starts without crashing
even when optional vars are absent. Required vars (groq_api_key) will
raise a validation error at import time if missing, which is the correct
fail-fast behaviour for a production service.

Environment variables (all uppercase in .env / Docker env_file):
    GROQ_API_KEY            Required. Groq API key for langchain-groq.
    DATABASE_URL            Postgres connection string for LangGraph checkpointer.
                            When absent, an in-memory checkpointer is used (runs
                            are not durable across restarts).
    REDIS_URL               Redis URL. Used by BullMQ workers (not directly here).
    AGENT_SERVICE_TOKEN     Shared HMAC secret with the web tier. Set to empty
                            string to disable authentication (dev only).
    WEB_CALLBACK_URL        Base URL of the Next.js web app. Used by the Gmail
                            and memory tools to proxy OAuth-authenticated calls
                            back to the web BFF. Default: http://localhost:3000
    LANGSMITH_API_KEY       Optional. Enables LangSmith tracing for all graphs.
    SENTRY_DSN              Optional. Enables Sentry error reporting.
    MODEL                   Groq model ID. Default: llama-3.3-70b-versatile

IMPORTANT: Never log settings.groq_api_key or settings.agent_service_token.
pydantic-settings redacts SecretStr fields but these are plain str here for
simplicity. Treat them as secrets regardless.
"""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── Required ────────────────────────────────────────────────────────────
    groq_api_key: str

    # ── Database / cache ────────────────────────────────────────────────────
    # Empty string means "not configured" — service falls back to in-memory checkpointer
    database_url: str = ""
    redis_url: str = "redis://localhost:6379"

    # ── Inter-service auth ───────────────────────────────────────────────────
    # Empty string disables HMAC auth (development only — always set in production)
    agent_service_token: str = ""

    # ── Web BFF callback ─────────────────────────────────────────────────────
    # The web app holds Google OAuth tokens; tools call back here to use them
    web_callback_url: str = "http://localhost:3000"

    # ── Observability ────────────────────────────────────────────────────────
    langsmith_api_key: str = ""
    sentry_dsn: str = ""

    # ── LLM ─────────────────────────────────────────────────────────────────
    model: str = "llama-3.3-70b-versatile"

    class Config:
        # Load from .env file when present (useful for local dev outside Docker)
        env_file = ".env"
        # Ignore extra fields so adding new vars to .env doesn't break old code
        extra = "ignore"


# Module-level singleton — imported by all other modules
settings = Settings()
