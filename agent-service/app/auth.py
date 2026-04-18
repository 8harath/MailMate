"""
app/auth.py — HMAC service-to-service authentication
=====================================================

WHY HMAC INSTEAD OF A STATIC TOKEN?
    A static bearer token is vulnerable to replay attacks: if an attacker
    captures one request (e.g. via a log), they can replay it indefinitely.
    By signing the current Unix timestamp with HMAC-SHA256, each token is
    only valid for _TOKEN_TTL_SECONDS (60s). A captured token expires quickly.

TOKEN FORMAT:
    "<unix_seconds>:<hmac_hex>"
    Example: "1744934400:a3f9b2c1..."

HOW THE WEB TIER CREATES THE TOKEN (lib/agent-client.ts):
    ts  = floor(Date.now() / 1000)
    sig = HMAC-SHA256(AGENT_SERVICE_TOKEN, ts_as_string).hexdigest()
    header = f"{ts}:{sig}"

VALIDATION STEPS (this module):
    1. Parse header into (timestamp, hmac_hex)
    2. Reject if |now - timestamp| > _TOKEN_TTL_SECONDS  ← replay protection
    3. Recompute expected = HMAC-SHA256(secret, timestamp)
    4. Compare with hmac.compare_digest()               ← timing-safe comparison

DISABLING AUTH IN DEVELOPMENT:
    Set AGENT_SERVICE_TOKEN="" (empty string). When the secret is empty, all
    requests are allowed through. Never do this in production.

USAGE:
    Used as a FastAPI dependency:
        ServiceAuth = Annotated[None, Depends(verify_service_token)]

        @app.post("/v1/coordinator")
        async def coordinator(body: ..., _auth: ServiceAuth): ...
"""
import hashlib
import hmac
import time

from fastapi import HTTPException, Request

from app.config import settings

# Tokens older than this many seconds are rejected (replay window)
_TOKEN_TTL_SECONDS = 60


def verify_service_token(request: Request) -> None:
    """FastAPI dependency: raises HTTP 403 if the service token is invalid.

    This function is a no-op when AGENT_SERVICE_TOKEN is empty (dev mode).
    In production it must reject any request that doesn't carry a valid token,
    because the agent-service has access to Groq credits and Postgres data.
    """
    # Auth disabled when secret is not configured (dev / test environments)
    if not settings.agent_service_token:
        return

    raw = request.headers.get("X-Service-Token", "")
    parts = raw.split(":", 1)
    if len(parts) != 2:
        raise HTTPException(status_code=403, detail="Missing or malformed service token")

    ts_str, provided_hmac = parts

    # Validate timestamp is a valid integer
    try:
        ts = int(ts_str)
    except ValueError:
        raise HTTPException(status_code=403, detail="Invalid token timestamp")

    # Replay protection: reject tokens older than _TOKEN_TTL_SECONDS
    if abs(time.time() - ts) > _TOKEN_TTL_SECONDS:
        raise HTTPException(status_code=403, detail="Token expired")

    # Recompute expected HMAC and compare using constant-time comparison
    # (hmac.compare_digest prevents timing side-channel attacks)
    expected = hmac.new(
        settings.agent_service_token.encode(),
        ts_str.encode(),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected, provided_hmac):
        raise HTTPException(status_code=403, detail="Invalid service token")
