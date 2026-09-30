# Beam solver API. Build context: ./backend
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app
COPY pyproject.toml ./
COPY src ./src
# runtime dependencies only: numpy, pydantic, fastapi, uvicorn (no plotting, no dev tools)
RUN pip install ".[api]" && useradd --system --no-create-home app

USER app
EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request as u; u.urlopen('http://127.0.0.1:8000/api/v1/health', timeout=2)"

CMD ["uvicorn", "beam_solver.api.app:app", "--host", "0.0.0.0", "--port", "8000"]
