HUMAN REVIEWERS: https://github.com/dsvs12/block-party-in-a-box
# Party in a Box: Oak Park block party planning

A Day in Our Data hackathon project (Oak Park, IL, October 3, 2026). Not an official Village of
Oak Park product.

## Civic question

How can Oak Park make block parties easier to plan and approve, while keeping busy streets open?

Today the Village publishes rules, PDF petitions and a web form, but nothing connects the resident
who organizes the party, the vendors they hire and the Public Works reviewer who approves it.
Party in a Box puts all three in one flow, with every rule check and count done in code from
public data.

## Minimum viable demo

One site with three views (switch at the top of the page):

- **Resident:** type an address to see whether the block can be closed, or the nearest block that
  can; pick a date range and see the petition due date and season checks; share a petition link and
  neighbors open the link to sign (each address counts once) and watch the count toward the
  10-address minimum; submit; track the request, ask to
  reschedule or cancel, and see which vendors are coming.
- **Vendor:** set up a standing offer once (service, price, guests, days, area); approved parties
  that fit are matched automatically; accept or decline each job; message the organizer.
- **Village reviewer:**
  - **Traffic planner (AI):** pick blocks to test as closures and get a rule-based traffic impact score
    with its reasons, suggestions such as "approve on the next Saturday instead", and a plain-language
    summary written by Claude from the computed scores.
  - **Requests:** the queue in first-come order, each request's petition count, weekend count
    against the 30-event cap, impact score and reasons, then approve on any candidate date that
    passes the rules, or reject. Blocked dates show why.
  - **Today:** the day's parties on the map, their impact and the vendors serving them.

The design spec for every screen is on the
[Party in a Box Screens canvas](https://claude.ai/artifact/2hjuBS6ERgEmRog2DZoVsi).

### Run it locally

Needs Docker, [uv](https://docs.astral.sh/uv/) and Node 20.19+ (or 22.12+). The UI talks to
the FastAPI backend in [`api/`](api/README.md), which runs on Postgres with fictional sample data.

```sh
# 1. API + database (first terminal)
cd api
docker compose up -d                      # Postgres 16 on localhost:5433
cp -n .env.example .env                   # optional: paste ANTHROPIC_API_KEY for live AI summaries
uv sync && uv run alembic upgrade head
uv run python -m app.seed                 # sample requests, vendors, petitions (re-run to reset)
uv run uvicorn app.main:app --port 8000   # API docs at http://localhost:8000/docs

# 2. UI (second terminal, repo root)
npm install
npm run dev                               # open http://localhost:5173
```

Sign-in is mocked: the UI sends a dev token per role (`dev-resident-a`, `dev-vendor-icecream`,
`dev-reviewer`); change them in `.env.development` to view as another sample user. Without an
Anthropic key the planner shows a labelled templated summary instead of an AI-written one.
Tests: `cd api && uv run pytest -q`.

## Data

All in [`source-data/`](source-data/), copied unchanged from the event repo
[oak-park-cisc/Oak_Park_Day_in_our_Data](https://github.com/oak-park-cisc/Oak_Park_Day_in_our_Data)
(MIT License, see `source-data/LICENSE-event-repo`). Block party rules come from the Village's 2026
[Block Parties and Sales page](https://www.oak-park.us/Community/Events-and-Activities/Block-Parties-and-Sales).

- **Used:** streets, trees, transit stops, schools, capital projects, parking restrictions,
  overnight parking ban.
- **Included for later features:** business licenses, historic buildings, social vulnerability.

**What we found** (887 / 342 / 441 and the shade list are reproduced by
[`scripts/probe_reference.py`](scripts/probe_reference.py)):

- Oak Park has **887** street + hundred-block segments with address ranges.
- **342** segments are on east/west streets, which the Village doesn't close for block parties;
  222 of those are residential.
- For those 222, the nearest eligible segment is a median **54 m** away (90th percentile 126 m).
- **441** segments are north/south and not main streets, so likely eligible.
- Shadiest eligible blocks, by large trees: 1100 S Cuyler (55 trees, 18 large), 1100 S Scoville
  (56 trees, 16 large), 600 S East (33 trees, 15 large).

**What's real and what's sample:**

- **Real, computed in code from public data:** block eligibility and the nearest eligible block,
  petition due dates, season and cap checks, trees, bus stops and schools near each block.
- **Sample:** every person, vendor, request, signature and message is **fictional**, stored in a
  local database. Sign-in is mocked.
- **Traffic impact** is a rule-based score from bus stops, schools and nearby closures. It is not
  measured traffic, and it never estimates delay.
- **AI** only explains computed scores and points to rule-based suggestions; it never approves,
  rejects or changes a score, and its answers are checked before they're shown.
- **Assumptions:** the main streets that can't be closed are our own list, and the 30-per-weekend
  count only includes our sample requests (the real count isn't public).

## Potential users

- **Residents** who organize block parties.
- **Public Works staff** who review requests, deliver barricades and watch weekend traffic.
- **Local vendors** (ice cream, food trucks, entertainment) who serve block parties.

## Next steps

For the Village:

- Pilot this flow with Public Works.
- Publish approved block events and weekend counts against the 30 cap as open data.
- Tell us whether VillageView (the Village's online permit system) has an API, and whether
  e-signatures are acceptable for petitions.

For the project (see [`docs/backend-spec.md`](docs/backend-spec.md)):

- Build `web/data/blocks.json` with a zip code and bus-stop list per block, so vendor matching can
  check service areas.
- Host the API and connect the GitHub Pages site to it (the hosted page shows no data without one).
- Real sign-in, email notifications and the 2027 rules once Public Works confirms them.
- Remaining fixes are ranked in [`docs/issues.md`](docs/issues.md).

## Repo guide

| Path | What |
|---|---|
| `src/`, `web/` | React + Vite UI (`web/` is the GitHub Pages build) |
| `api/` | FastAPI backend, Postgres schema migrations, rules engine, tests |
| `docs/backend-spec.md`, `docs/api/` | Backend spec and OpenAPI contracts |
| `docs/issues.md` | Stack-ranked open issues, with the model suited to fix each |
| `brief.md`, `PROJECT.md` | Pitch write-ups |
| `source-data/`, `scripts/` | Event data and the reference probe |
| `HANDOFF.md`, `tasks/`, `AGENTS.md` | Build plan, team task files, rules for AI coding agents |

---

Not an official Village of Oak Park product. Rules shown are 2026; confirm 2027 with Public Works.
