# Person A: data pipeline, rule logic, Village view

**Read first:** [`00-shared-contracts.md`](00-shared-contracts.md) (data shapes, `Logic` API,
file ownership) and `HANDOFF.md` §3, §4, §6, §9.

**You own:** `scripts/prep_blocks.py`, `web/data/blocks.json`, `web/js/logic.js`,
`web/js/village.js`, `web/css/village.css`. Don't edit anything else.

**Others wait on you for:** `logic.js` date functions (B, by 12:20) and a first `blocks.json`
(B, by 12:45). Push those early, even if rough.

## Step 1 (12:00–12:20): `logic.js` date functions, push

Create `web/js/logic.js` attaching `window.Logic`. Write these first because B needs them:
`petitionDue`, `seasonCheck`, `weekendKey`, `eventDate`, `flagWords`. Stub the rest so they
return safe defaults (`trafficScore` → `{score:0, level:"low", reasons:["not computed yet"]}`).

- Parse `"YYYY-MM-DD"` as a local date (`new Date(y, m-1, d)`), never `new Date("2026-10-17")`
  (UTC, off by one day in Chicago).
- `petitionDue(start)` = start minus `rules.petition_lead_days` (14). `"2026-10-17"` → `"2026-10-03"`.
- `seasonCheck`: every date from start to end must fall in Apr 4–Oct 31 of its own year.
- `weekendKey(date)`: the Saturday of that Mon–Sun week.

## Step 2 (12:20–12:45): `scripts/prep_blocks.py` → `web/data/blocks.json`, push

Python stdlib only. Start by copying the street-parsing part of `scripts/probe_reference.py` (the
first ~40 lines): it already yields exactly 887 blocks, 342 east/west and 441 eligible. Keep its
`ARTERIAL` regex and its north/south test. Don't change the counting logic or the numbers drift.

First pass, core fields only: `id`, `name`, `base`, `hundred`, `addr_lo`, `addr_hi`, `centroid`,
`lines`, `ns`, `arterial`, `eligible`, `reason`, `nearest_eligible`.
- Collapse segments by `(name, hundred)`; collect every segment's line into `lines`.
- Convert GeoJSON `[lon, lat]` to `[lat, lon]` and round to 5 decimals.
- `nearest_eligible`: for each ineligible block, the eligible block with the closest centroid
  (meters, using `KX`/`KY` from the probe). Median should come out about 54 m.
- Print `887 segments / 342 east-west / 441 eligible` at the end.

Check that the JSON is under ~3 MB (`ls -lh web/data/blocks.json`). If it's bigger, drop
interior points from long lines.

## Step 3 (12:45–1:30): enrich `blocks.json`, finish `Logic`

Add to `prep_blocks.py` (see the gotchas in `HANDOFF.md` §6):
- `tree_count`, `big_tree_count` (24 ≤ dbh < 80): same key as the probe. 1100 S Cuyler must
  give 55 / 18.
- `bus_stops`: stops within ~30 m of any point on the block's lines; sum `weekday_trips`.
- `school_nearby`: closest school within 150 m of the centroid, or `null`.
- `capital_projects`: projects whose geometry comes within ~30 m, with `build_year`.
- `parking`: up to 3 distinct short strings from parking restrictions within ~20 m.
- `overnight_ban`: any overnight-ban feature within ~20 m.

Then implement in `logic.js`:
- `findBlock(address, blocks)`: parse the house number and street; uppercase; map
  AVENUE→AVE, STREET→ST, BOULEVARD→BLVD, COURT→CT, PLACE→PL; strip a leading N/S/E/W; match
  `base` and `addr_lo ≤ number ≤ addr_hi`. If several match, prefer the one whose `name`
  starts with the typed direction. If none match, return `{error: "..."}`.
- `trafficScore(block, request, ctx)` per `HANDOFF.md` §4. Suggested points: arterial or
  east/west → 100 + blocked; +15 per bus stop, +10 more if weekday trips > 100; +20 school
  nearby on a weekday date; +15 capital project in the event year; +10 per other non-rejected
  request on the same weekend within 200 m or on the same street; +10 if the weekend is ≥ 25/30.
  Level: < 25 low, < 50 medium, else high. **Every point added must push a reason string.**
  Never say "delay" or minutes.
- `weekendCount`, `canApprove` (blocks approval when signatures < 10, the weekend is already at
  30, the block is ineligible, or the date is out of season; list each reason), `vendorVisible`.

Quick test in the browser console: `Logic.findBlock("1100 S Cuyler Ave", ctx.blocks)`.

## Step 4 (1:30–2:10): Village view (`web/js/village.js`)

`window.Views.village = function (el, ctx) { ... }`. Read everything through `ctx.store`.

1. **Queue**: one card per request, newest first: block, date range, kind, guests, status.
2. On each card:
   - Traffic impact: level badge (low/medium/high), score, and the full reasons list.
   - Weekend count: "12 / 30 this weekend (includes sample count)". Flag red if over 30.
   - Signatures: "10 / 10 signatures". Red if under 10.
   - Bids: vendor name, price, capacity, menu; mark any `Logic.flagWords` hits with ⚠️ "mentions alcohol".
   - Comment thread: list plus an input; new comments saved with `role: "village"`.
3. **Actions**: pick a date within the range (`<input type=date min max>`), Approve (disabled
   with reasons when `Logic.canApprove` says no), Reject. Save via `Store.update`.
4. **Vendor accounts**: list vendors with an Approve toggle (`approved: true/false`).

Styles go in `web/css/village.css`; prefix your classes with `vl-`.

## Step 5 (2:10–2:30): acceptance checks

Run every item in `HANDOFF.md` §9 on the **live** site with C and tick them in `tasks/qa-log.md`.
Fix only what fails; tell the team before pushing after 2:15.

## Done means

- [ ] `python3 scripts/prep_blocks.py` prints 887 / 342 / 441 and writes `web/data/blocks.json`.
- [ ] `findBlock("1100 S Cuyler Ave")` → eligible, 55 trees. `findBlock("600 Superior St")` → not eligible + a nearest eligible block.
- [ ] `petitionDue("2026-10-17")` → `"2026-10-03"`; a date after Oct 31 fails `seasonCheck`.
- [ ] A block with bus stops scores higher than one without, with reasons listed.
- [ ] Village view: weekend count shown, 31st request flagged, < 10 signatures can't be approved.
