FROM python:3.14-slim

# Install uv for fast dependency management
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Create non-root user (NFR36)
RUN groupadd -r selfapp && useradd -r -g selfapp -u 1000 selfapp

# Install dependencies first (layer caching)
COPY pyproject.toml uv.lock ./

# Scaffold the generated/ package so the path dependency resolves
# (module-schema is generated at build time in CI; here we provide a stub)
RUN mkdir -p /tmp/generated && \
    echo '[project]\nname = "module-schema"\nversion = "0.1.0"' > /tmp/generated/pyproject.toml

# Install production dependencies only
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

# Copy application code
COPY app/ app/
COPY migrations/ migrations/

# Create data directory for SQLite volume
RUN mkdir -p /app/data && chown -R selfapp:selfapp /app/data

# Switch to non-root user
USER selfapp

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
