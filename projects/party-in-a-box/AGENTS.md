# AGENTS.md

Instructions for AI coding agents (Claude Code, Codex, Cursor, etc.) working in this repo.
Humans: start with [README.md](README.md).

## What this is

**Party in a Box**: a web app for planning and approving Oak Park, IL block parties, built at the
Day in Our Data hackathon (2026-10-03). Three roles in one site: **Resident** (check a block, pick
dates, petition neighbors, track the request), **Vendor** (standing offer, auto-matched jobs,
accept/decline) and **Village reviewer** (AI traffic planner, request queue and approvals, today's
parties). All people, vendors and requests are **fictional sample data**.

- **Frontend:** React + Vite + TypeScript at the repo root (`src/`), built into `web/`, which GitHub
  Pages serves.
- **Backend:** FastAPI + SQLAlchemy in `api/`, Postgres 16 in Docker for dev, SQLite for tests.
- **AI:** `POST /v1/ai/explain` calls Claude (`ANTHROPIC_MODEL`, default `claude-sonnet-5-5`) to
  explain computed traffic scores. It never decides anything.

## Read before changing anything

1. [`docs/backend-spec.md`](docs/backend-spec.md): data model, lifecycles, rules engine, privacy.
2. [`docs/api/`](docs/api/): the OpenAPI contracts (`resident`, `vendor`, `village`). **Routes and
   the UI must match them; change a contract only on purpose and update it in the same commit.**
3. [`docs/issues.md`](docs/issues.md): the stack-ranked open issues, with the model suited to each.
4. [`HANDOFF.md`](HANDOFF.md): the original product brief, Village rules (§3), traffic score (§4)
   and privacy/honesty rules (§7). Parts of its build plan are superseded by the stack above.

## Layout

```
src/                         React UI: App.tsx (routes + screens), api.ts (client, mocked tokens),
                             PetitionSign.tsx (public petition page), DemoBanner.tsx, *.css
web/                         Vite build output served by GitHub Pages (commit it after `npm run build`)
api/app/                     FastAPI app
  rules.py                   pure rule functions (petition due, season, caps, canApprove,
                             traffic score, suggestions, vendor matching); no I/O
  services.py                DB-backed helpers shared by the routers (counts, locks, matching)
  blocks.py                  block index from source-data/ (or web/data/blocks.json if present)
  routers/                   public, resident, vendor, village (+ /ai/explain), threads
  ai.py                      Claude proxy: computed data in, validated text out, template fallback
  auth.py                    DEV-ONLY bearer tokens (dev-resident-a, dev-vendor-icecream, dev-reviewer…)
  seed.py                    fictional sample data; `python -m app.seed` loads the rich set
api/migrations/              Alembic migrations (the Postgres schema)
api/tests/                   pytest suite (SQLite; never calls the live Claude API)
docs/                        backend spec, OpenAPI contracts, issue list
source-data/                 event data, copied unchanged; never edit
scripts/probe_reference.py   verified reference numbers (887 / 342 / 441); don't change its logic
tasks/                       original per-person task files (historical)
brief.md, PROJECT.md         pitch write-ups
```

## Commands

```sh
# API (from api/)
docker compose up -d                       # Postgres 16 on localhost:5433
uv sync && uv run alembic upgrade head     # schema
uv run python -m app.seed                  # reset sample data (safe to re-run)
uv run uvicorn app.main:app --port 8000    # API; docs at /docs
uv run pytest -q                           # tests (SQLite)
uv run alembic revision --autogenerate -m "..."   # after model changes; add CHECK constraints by hand

# UI (from the repo root)
npm install
npm run dev                                # http://localhost:5173, uses .env.development
npm run build                              # writes web/; commit web/index.html + the new web/assets bundle

# Checks
npx --yes @redocly/cli@latest lint docs/api/village.openapi.yaml   # contracts stay valid
git grep -n "sk-ant"                       # must print nothing
```

## Hard rules

- **Never push a broken page or failing tests.** Every push to `main` deploys `web/`. Run the tests
  and `npm run build` first, then `git pull --rebase` before `git push` (teammates push to `main` too).
- **Secrets:** the Claude key lives only in `api/.env` (git-ignored) or a GitHub secret. Never
  commit, print or log it, and never put it in the frontend.
- **Rules live in `api/app/rules.py`** as pure functions; routers gather inputs via `services.py`.
  Every count, distance, date check and score is computed in code, never by AI.
- **AI only explains.** `/ai/explain` gets computed scores (no personal data), its output is
  validated (no delay/minutes, no approve/reject advice, no numbers that weren't in the input) and
  falls back to a labelled template. Show "AI-written" only on real model output.
- **Dates** are local `YYYY-MM-DD` strings (America/Chicago); never round-trip them through UTC.
  In TypeScript parse with `new Date(\`${d}T12:00:00\`)` or split the parts, never `new Date(d)`.
- **Coordinates:** GeoJSON is `[lon, lat]`; everything the API returns is `[lat, lon]` for Leaflet.
  Distances use `KX = 111320·cos(41.885°)`, `KY = 110540` meters per degree. Python geometry is stdlib only.
- **Concurrency:** approvals lock the weekend slot and the block's rows; vendor accepts lock the
  request. Keep those locks when you touch approve, reschedule or accept.
- **Build output:** after `npm run build`, remove `web/assets` bundles that `web/index.html` no
  longer references, so stale code (and assets) aren't published.
- **Tests:** add or update tests with every backend change. Tests reseed per module and must not
  depend on each other or on the live Claude API.

## Privacy and honesty (non-negotiable)

- Never collect real personal information. Forms show the **Demo only** banner.
- Sample people and vendors are fictional ("Sample …"). **No real business names.**
- No Village of Oak Park logo or branding; the site must not look official. Footer on every view:
  "Not an official Village of Oak Park product. Rules shown are 2026; confirm 2027 with Public Works."
- Public petition pages never show signer names; vendors never see organizer contact details or
  house numbers.
- Traffic impact is a rule-based score with listed reasons. Never call it delay or minutes.
- Say "segments", never "39% of Oak Park". The main-street list is our assumption; label it as one.

## Commits

Small, focused commits on `main`, pushed as soon as each change is verified. Imperative subject
line. Stage only the files you changed (never `api/.env`, `*.db`, `.venv`, `node_modules`).
