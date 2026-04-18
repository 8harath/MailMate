"""Basic smoke tests for the agent service."""
import os

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    os.environ.setdefault("GROQ_API_KEY", "test-key")
    os.environ.setdefault("AGENT_SERVICE_TOKEN", "")  # disable auth in tests
    from app.main import app
    return TestClient(app)


def test_healthz(client):
    r = client.get("/healthz")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert data["service"] == "agent-service"
