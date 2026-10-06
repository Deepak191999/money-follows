FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
WORKDIR /app
COPY backend-fastapi/pyproject.toml backend-fastapi/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY backend-fastapi/app ./app
COPY seed ../seed
RUN uv sync --frozen --no-dev && uv run seed
EXPOSE 8000
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
