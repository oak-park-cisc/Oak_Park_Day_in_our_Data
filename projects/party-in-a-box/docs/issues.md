# Party in a Box: stack-ranked issues (code review, 2026-10-03)

From a full review of the repo at `4e49292`. Verified while reviewing: `cd api && uv run pytest -q` →
1 failed / 59 passed (row 3); `npm run build` reproduces the committed `web/` bundle; no API key in git
history; 887 blocks load, 0 have a zip.

**Priority:** P0 = blocks or embarrasses the demo today · P1 = must fix before a real pilot · P2 = should
fix · P3 = nice to have. **Model:** Haiku = mechanical · Sonnet = small/medium with local judgment ·
Opus = large, cross-cutting or security-sensitive.

| # | Pri | Issue | Evidence | Fix | Size | Model | Needs planning? |
|---|---|---|---|---|---|---|---|
| 1 | P0 | Header shows the official Village logo with alt "Village of Oak Park"; violates HANDOFF §7 (must not look official) | `src/App.tsx:4,75`, `src/assets/oak-park-logo.png` | Replace with the "Party in a Box" text wordmark, delete the asset, rebuild | S | Haiku | no |
| 2 | P0 | Copied petition link is dead: API builds `/#/petition/<token>` but the UI has no such route (falls back to Info); no public sign page | `api/app/services.py:293`, `src/App.tsx:115` | Add a public `#/petition/:token` page: GET `/petitions/{token}` + sign form, with the demo banner | M | Sonnet | no |
| 3 | P0 | Tests call the live Anthropic API (key from `api/.env` loads; conftest never blanks it): `test_ai_rate_limit` makes 21 real calls (~200 s), costs money and fails | `api/app/config.py:15`, `api/tests/conftest.py:1-5`, `api/tests/test_village.py:144-149` | Set `os.environ["ANTHROPIC_API_KEY"] = ""` in conftest before importing the app | S | Haiku | no |
| 4 | P0 | Honesty copy: "Share the **official** petition link"; FAQ "Is this the official Village application?" doesn't start with "No"; no demo banner on petition/new event/offer forms (§7, §9) | `src/App.tsx:227,120,294` | Copy edits + "Demo only: sample data…" banner on Petition, New event, Offer form | S | Haiku | no |
| 5 | P1 | Approve gate computed only for the first candidate date; UI disables Approve for every date, so a free later Saturday can't be approved when the first is full | `api/app/routers/village.py:162-165`, `src/App.tsx:362,377` | Return `can_approve` per candidate (extend OpenAPI `Candidate`), gate on the chosen date | M | Sonnet | no |
| 6 | P1 | Auth is fixed dev tokens in the public bundle; role comes from the URL path; invites create predictable `dev-vendor-{id}`; non-dev mode returns 501 | `src/api.ts:29-38`, `api/app/auth.py:12`, `village.py:511` | Real identity (magic link or Village SSO); role from the user record | L | Opus | **yes**: identity provider and who owns accounts (team + Village) |
| 7 | P1 | Public petition signing: captcha accepts any string, `ip_hash` never set, rate limit per petition only; stores email | `api/app/routers/public.py:101-110`, `api/app/db.py:151` | Real captcha verify, per-IP limit, drop email until a consent model exists | M | Sonnet | **yes**: captcha vendor; which PII a pilot may hold (Village/legal) |
| 8 | P1 | GitHub Pages shows an error card on every view (no hosted API); README links to it | `src/api.ts:48`, `README.md`, `.github/workflows/pages.yml` | Host the API (Fly/Render + Postgres) and inject `VITE_API_BASE` in the Pages build, or ship a read-only demo mode | L | Opus | **yes**: hosting target/cost, or drop the live link today (team) |
| 9 | P1 | Weekend lock is get-or-insert without ON CONFLICT: two first approvals on a fresh weekend race to a 500; block-year row lock (spec §4.3) missing | `api/app/services.py:88-95`, `docs/backend-spec.md` §4.3 | `INSERT … ON CONFLICT DO NOTHING` then `SELECT … FOR UPDATE`; lock the block's requests in approve | M | Sonnet | no (needs a Postgres test; SQLite can't cover it) |
| 10 | P1 | Vendor accept is check-then-write; two vendors of one service can both end up accepted | `api/app/routers/vendor.py:189-198` | `SELECT … FOR UPDATE` on the request row inside accept | S | Sonnet | no |
| 11 | P1 | Match cards show "(—)" for the zip on every job | `src/App.tsx:305`, `api/app/blocks.py:93` | Hide the zip when null | S | Haiku | no |
| 12 | P2 | `/ai/explain` input is client-supplied and unbounded (cost / prompt stuffing) | `api/app/schemas_village.py:29-57` | `max_length` ≤ 200 on strings, ≤ 50 items; later recompute via what-if server-side | S | Sonnet | no |
| 13 | P2 | Reviewer queue is O(N²): per-row scoring and recounts each scan all requests; `_offer_inputs` is N+1 | `village.py:123-134`, `services.py:82,131,144,161-166` | Load approved/submitted requests once per call and pass them through | M | Sonnet | no |
| 14 | P2 | Planner fires the queue plus one detail GET per request just to collect block ids (~15 GETs) | `src/App.tsx:414-421`, `village.py:129-134` | Add `block_id` to queue items (and OpenAPI), drop the fan-out | S | Sonnet | no |
| 15 | P2 | Planner and Today maps never draw closures; the API returns no geometry | `src/App.tsx:400,463`, `village.py:399,441` | Return `lines`/`centroid` in what-if `per_block` and day `parties`; draw polylines | M | Sonnet | no |
| 16 | P2 | `Idempotency-Key` promised on every mutation, ignored everywhere | `vendor.py:116,173,208,223,261`, `docs/api/*.openapi.yaml` | Drop it from the contracts (state machines already make retries 409-safe) or add an idempotency table | S | Haiku (drop) | **yes**: spec owner decides implement vs. drop |
| 17 | P2 | `reject` and `resolve_change` have no `If-Match` version check, unlike approve | `village.py:273-286,291-352` | Accept `If-Match`, return 409 `stale_version` | S | Sonnet | no |
| 18 | P2 | Stale build files: 4 JS + 3 CSS tracked, one pair used; `emptyOutDir: false` | `git ls-files web/assets`, `vite.config.ts:8` | `emptyOutDir: true`, delete old bundles | S | Haiku | no |
| 19 | P2 | No concurrency tests, no public-petition tests, no frontend tests; rate-limit test depends on the wall clock | `api/tests/*`, `package.json` | Postgres-marked concurrency tests; monkeypatch `time.monotonic`; Playwright smoke test per role | M | Sonnet | no |
| 20 | P3 | Rescheduling within the same weekend counts the request itself, so it's blocked at 30/30 | `services.py:82-85`, `village.py:324-332` | Exclude the request's own id from the weekend count | S | Sonnet | no |
| 21 | P3 | "123 1/2" is folded into 123 (half-addresses may be separate units); email stored but unused | `api/app/rules.py:68-90`, `public.py:110` | Key on the full house string; drop the email column until needed | S | Sonnet | **yes**: Village: is ½ a separate address? |
| 22 | P3 | Generated data not committed: `web/data/blocks.json` and `block-party-rules.json` absent → runtime fallback + default rules; HANDOFF §9 check 1 unmet | `web/data/.gitkeep`, `api/app/config.py:70-72`, `api/app/blocks.py` | Commit `scripts/prep_blocks.py` output (with zips per block) or update the acceptance check | S | Haiku | no |
| 23 | P3 | `App.tsx` is one 466-line file of one-line components | `src/App.tsx` | Mechanical split into `routes/{resident,vendor,village}` + `components/` | L | Sonnet | no |
| 24 | P3 | GET endpoints write to the database (signature recount, lazy thread creation) | `village.py:228`, `resident.py:119,127` | Recount on write paths; create threads on submit only | S | Sonnet | no |

## Status (updated 2026-10-03)

**Fixed and pushed:** 1, 4, 11, 18 (`1050380`) · 3 (`649c0f2`) · 2 (`b2610de`) · 10, 12 (`817b440`) ·
5, 9, 13, 14, 15, 17, 20 (`652af48` API, `7cb825c` UI).

**Open:** 6, 7, 8 (need decisions, then Opus/Sonnet), 16, 19, 21, 22, 23, 24.

## Fix today before the demo

1. **In parallel (no shared files):**
   - **Task A — Haiku, `src/App.tsx`:** rows 1, 4 and 11 (wordmark, honesty copy and banners, hide null zip).
   - **Task B — Haiku, `api/tests/conftest.py`:** row 3. Check: `cd api && uv run pytest -q` → 60 passed in < 40 s.
2. **Then Task C — Sonnet, `src/App.tsx` routes + new `src/PetitionSign.tsx` + `src/api.ts`:** row 2. Check: open
   `#/petition/<token from seed>` → block, "n of 10", signing increments the count; a closed petition shows its message.
3. **Final:** `npm run build`, commit and push.

Row 5 only matters today if the demo approves a non-first candidate date.

## Needs a decision

- **Pages link (row 8):** host the API today, or point README/Pages at "run locally" so judges don't hit error cards. Team, today.
- **Identity (row 6):** magic-link email vs. Village SSO; who provisions reviewer accounts. Team + Village; blocks any pilot.
- **Public PII (row 7):** which signature fields a pilot may store, retention, captcha vendor. Village/legal.
- **Idempotency (row 16):** implement or strike from the OpenAPI. Spec owner.
- **Half-addresses (row 21):** does Public Works count "123½" as a separate address? Village.
- **Real zips (row 22):** the ZCTA join in `scripts/prep_blocks.py` (spec gap §11.7) is M/Sonnet and fixes vendor area matching.
