FROM python:3.11-slim AS base

RUN addgroup --system --gid 1001 agentuser && \
    adduser  --system --uid 1001 --gid 1001 agentuser

WORKDIR /app

FROM base AS deps
COPY pyproject.toml ./
RUN pip install --no-cache-dir uv && uv pip install --system -e ".[prod]" 2>/dev/null || pip install --no-cache-dir fastapi uvicorn[standard] pydantic

FROM base AS runner
COPY --from=deps /usr/local/lib/python3.11 /usr/local/lib/python3.11
COPY --from=deps /usr/local/bin /usr/local/bin
COPY . .

USER agentuser
EXPOSE 8000
ENV PYTHONUNBUFFERED=1

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/healthz')"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
