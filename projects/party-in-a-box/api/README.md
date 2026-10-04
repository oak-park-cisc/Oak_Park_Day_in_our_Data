# Party in a Box API

FastAPI backend for the block party permit helper. Phase 1 holds the foundation: config, errors,
database models, dev auth, the block index, the pure rules engine, sample-data seeding and
`GET /v1/health`.

**Dev auth only — not for production.**

## Run

```
cd api
docker compose up -d
uv sync
cp .env.example .env
uv run alembic upgrade head
uv run python -m app.seed
uv run uvicorn app.main:app --reload
```

The dev database is Postgres 16 in Docker on host port 5433 (user/password `party`, dev only).

- Reset the DB: `docker compose down -v`
- New migration after changing models: `uv run alembic revision --autogenerate -m '...'`
  (add CHECK constraints by hand if autogenerate misses them; review the file before applying)

Interactive docs are at `/docs`.

## Demo: AI summary

```
cp .env.example .env
```

Paste your key into `ANTHROPIC_API_KEY` in `api/.env` (git-ignored). Leave it blank to use the labelled
templated summary instead.

## Dev tokens

Send `Authorization: Bearer <token>`.

| Token | Role | Who |
|---|---|---|
| `dev-resident-a` | resident | Sample Organizer A |
| `dev-resident-b` | resident | Sample Organizer B |
| `dev-vendor-icecream` | vendor | Sample Ice Cream Co. (`va_icecream`) |
| `dev-vendor-taco` | vendor | Sample Taco Cart (`va_taco`) |
| `dev-vendor-bounce` | vendor | Sample Bounce House Rentals (`va_bounce`) |
| `dev-reviewer` | reviewer | Sample Reviewer |

## Test

```
uv run pytest -q
```

Tests use SQLite by default and do not need Docker. To run them on Postgres instead (after
`alembic upgrade head`), set `TEST_DATABASE_URL`:

```
TEST_DATABASE_URL=postgresql+psycopg://party:party@localhost:5433/partyinabox uv run pytest -q
```

Note: the seed step wipes all rows in the target database.
