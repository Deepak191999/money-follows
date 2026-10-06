# Money Follows backend (FastAPI)

Python 3.12, FastAPI, SQLAlchemy 2, SQLite (`data.db` in this folder). Implements `../openapi.yaml` on port 8000.

## Run

    uv sync            # install deps
    uv run seed        # drop, recreate and load ../seed/seed.json
    uv run dev         # uvicorn on 0.0.0.0:8000 with reload
    uv run pytest      # tests against a fresh temporary DB

## Environment

- `DATABASE_URL` - SQLAlchemy URL, default `sqlite:///./data.db`.
- `SEED_FILE` - path to the seed JSON, default `../seed/seed.json`.

Docker: build from the repository root, `docker build -f backend-fastapi/Dockerfile .`
