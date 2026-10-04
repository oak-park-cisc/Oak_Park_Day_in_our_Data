# Shared contracts: read this first (everyone)

Three people build in parallel on `main`. This file holds the file ownership, git rules and data
shapes that let us work without blocking or overwriting each other. The product, rules and
ground rules are in [`../HANDOFF.md`](../HANDOFF.md); read §1–§3, §7 and §9 of it too.

| Person | Task file | One line |
|---|---|---|
| **A** (coder) | [`A-data-logic-village.md`](A-data-logic-village.md) | Data pipeline, rule/score logic, Village view |
| **B** (coder) | [`B-shell-resident-vendor.md`](B-shell-resident-vendor.md) | App shell, Resident view + booking, petition mock, Vendor view |
| **C** (no-code) | [`C-content-sample-demo.md`](C-content-sample-demo.md) | Rules JSON, fictional sample data, data checks, QA, demo script, README |

## 1. File ownership: edit only your own files

| File | Owner |
|---|---|
| `scripts/prep_blocks.py`, `web/data/blocks.json` | A |
| `web/js/logic.js` (pure rule + score functions) | A |
| `web/js/village.js`, `web/css/village.css` | A |
| `web/index.html`, `web/css/app.css` | B |
| `web/js/app.js` (data loading, role switcher, router), `web/js/store.js` | B |
| `web/js/resident.js`, `web/js/petition.js`, `web/js/vendor.js` | B |
| `web/data/block-party-rules.json`, `web/data/sample.json` | C |
| `README.md`, `tasks/demo-script.md`, `tasks/qa-log.md` | C |
| `HANDOFF.md`, `tasks/00-shared-contracts.md` | nobody without telling the team |

If you need a change in someone else's file, message them; don't edit it.

## 2. Git rules

- Everyone works on `main`. Commit small and often.
- Always `git pull --rebase` before `git push`. Because nobody shares a file, rebases stay clean.
- Every push to `main` deploys to https://dsvs12.github.io/block-party-in-a-box/ in about a minute.
  **Never push a broken page.** Test first with `python3 -m http.server -d web 8000` and open
  http://localhost:8000.
- Never commit an API key. `git grep -n "sk-"` must return nothing.

## 3. Page architecture (no build step, no frameworks)

- One page, `web/index.html`. Plain `<script src="js/...">` tags, no ES modules, no npm.
- Libraries only from cdnjs: Leaflet (map); jsPDF (Tier 3 only).
- Every module attaches one global: `window.Logic`, `window.Store`, `window.Views.resident`, etc.
- Script load order in `index.html`: `logic.js`, `store.js`, `resident.js`, `petition.js`,
  `vendor.js`, `village.js`, then `app.js` last.
- All paths relative (`data/blocks.json`, never `/data/...`): the site lives under a sub-path on Pages.

**Routes** (hash-based; `app.js` owns the router):

| Hash | View | Owner |
|---|---|---|
| `#/resident` (default) | address lookup, block packet, booking form | B |
| `#/petition/<requestId>` | mock petition sign page | B |
| `#/vendor` | parties list + quote form | B |
| `#/village` | review queue | A |

**View interface.** Each view is a function that draws into a container:

```js
window.Views = window.Views || {};
window.Views.village = function (el, ctx, params) { /* draw into el */ };
// ctx = { blocks, blocksById, rules, store: window.Store, logic: window.Logic }
// params = route params, e.g. { id: "r3" } for #/petition/r3
```

`app.js` loads `data/blocks.json`, `data/block-party-rules.json` and `data/sample.json`, builds
`ctx`, and re-calls the current view on every hash change. A view that changes data calls
`Store.update/add` and then redraws itself.

**Every view's footer** (rendered by `app.js`): "Prototype, not an official Village of Oak Park
product. Rules shown are 2026; confirm 2027 with Public Works. Demo runs on sample data saved in
your browser."

## 4. Data shapes

### `web/data/blocks.json` (A writes; B and A read)

An array with one object per street + hundred block (887 total). Coordinates are `[lat, lon]`
(Leaflet order, **not** GeoJSON order), rounded to 5 decimals.

```json
{
  "id": "S CUYLER AVE|1100",
  "name": "S CUYLER AVE",
  "base": "CUYLER AVE",
  "hundred": 1100,
  "addr_lo": 1100, "addr_hi": 1199,
  "centroid": [41.86812, -87.79001],
  "lines": [[[41.869, -87.790], [41.867, -87.790]]],
  "ns": true,
  "arterial": false,
  "eligible": true,
  "reason": "",
  "nearest_eligible": null,
  "tree_count": 55,
  "big_tree_count": 18,
  "bus_stops": { "count": 0, "weekday_trips": 0 },
  "school_nearby": null,
  "capital_projects": [],
  "parking": ["2 hr parking 8am-6pm Mon-Fri"],
  "overnight_ban": true
}
```

- `id` is `"<name>|<hundred>"`. Use it everywhere a block is referenced.
- `base` is `name` with any leading `N `/`S `/`E `/`W ` removed, for address matching.
- `reason` (when not eligible) is `"East/west street: the Village doesn't close these."` or
  `"Main street: not closed for block parties (our assumption)."`
- `nearest_eligible` (when not eligible): `{ "id": "...", "name": "...", "hundred": 1100, "meters": 54 }`.
- `school_nearby`: `{ "name": "...", "meters": 120 }` or `null` (within 150 m).
- `capital_projects`: `[{ "name": "...", "build_year": 2027 }]`.

### `web/data/block-party-rules.json` (C writes; everyone reads)

```json
{
  "rules_year": 2026,
  "source_url": "https://www.oak-park.us/Community/Events-and-Activities/Block-Parties-and-Sales",
  "season": { "start_mmdd": "04-04", "end_mmdd": "10-31" },
  "hours": { "start": "09:00", "end": "23:00" },
  "petition_min_addresses": 10,
  "block_sale_pct": 75,
  "petition_lead_days": 14,
  "max_events_per_block_per_year": 2,
  "max_events_per_weekend": 30,
  "official_form_url": "https://webforms.oak-park.us/Forms/blockevent",
  "contact": { "email": "publicworks@oak-park.us", "phone": "708.358.5700" },
  "flag_words": ["alcohol", "beer", "wine", "liquor", "cocktail", "spirits"],
  "checklist": [
    "Street runs north/south (east/west streets aren't closed)",
    "..."
  ]
}
```

### `web/data/sample.json` (C writes; read through `Store` only)

All people and vendors are **fictional**. No real business names.

```json
{
  "requests": [{
    "id": "r1",
    "block_id": "S CUYLER AVE|1100",
    "kind": "party",
    "organizer": "Sample Organizer (fictional)",
    "date_start": "2027-06-12", "date_end": "2027-06-26",
    "approved_date": null,
    "services": { "barricades": true, "green_kit": true, "vendor_wanted": true },
    "guests": 120,
    "status": "Submitted",
    "confirmed_bid_id": null,
    "created_at": "2026-10-01T10:00:00"
  }],
  "vendors": [{ "id": "v1", "name": "Sample Ice Cream Co.", "service": "Ice cream truck", "max_capacity": 150, "approved": true }],
  "bids": [{ "id": "b1", "request_id": "r1", "vendor_id": "v1", "price_usd": 300, "menu": "Soft serve, popsicles", "max_capacity": 150, "status": "Submitted", "created_at": "2026-10-02T09:00:00" }],
  "signatures": [{ "id": "s1", "request_id": "r1", "name": "Sample Neighbor 1", "house_number": "1105", "created_at": "2026-10-02T12:00:00" }],
  "comments": [{ "id": "c1", "request_id": "r1", "role": "village", "text": "Please confirm the barricade drop-off spot.", "created_at": "2026-10-02T13:00:00" }],
  "background_weekend_counts": { "2027-06-12": 11 }
}
```

- `kind`: `"party"` or `"sale"`. `status`: `"Submitted"`, `"Approved"`, `"Rejected"`.
- Bid `status`: `"Submitted"` or `"Confirmed"`. Comment `role`: `"resident"`, `"vendor"`, `"village"`.
- `background_weekend_counts`: other (sample) requests already counted against the 30 cap,
  keyed by the **Saturday** of the weekend. The UI must label it "sample count".

### `Store` API (B writes `web/js/store.js`; A and B use it)

Sample data plus anything the browser adds, merged. Saved in localStorage key `bpib:v1`.

```js
Store.init(sampleJson)            // called once by app.js
Store.all(kind)                   // kind: "requests" | "vendors" | "bids" | "signatures" | "comments"
Store.get(kind, id)
Store.add(kind, obj)              // assigns id + created_at, returns the saved object
Store.update(kind, id, patch)     // shallow merge, returns the updated object
Store.background()                // background_weekend_counts
Store.reset()                     // clears localStorage, back to sample data (a "Reset demo" button)
```

Wrap every localStorage read/write in try/catch; the page must still work if storage is blocked.

### `Logic` API (A writes `web/js/logic.js`; A and B use it)

Pure functions, no DOM. Dates are `"YYYY-MM-DD"` strings; parse them as local dates, not UTC.

```js
Logic.findBlock(address, blocks)            // "1100 S Cuyler Ave" -> { block, number } or { error }
Logic.petitionDue(dateStart, rules)         // "2026-10-17" -> "2026-10-03"
Logic.seasonCheck(dateStart, dateEnd, rules)// -> { ok, problems: ["2026-11-02 is outside the Apr 4–Oct 31 season"] }
Logic.weekendKey(date)                      // -> Saturday of that Mon–Sun week, "YYYY-MM-DD"
Logic.eventDate(request)                    // approved_date || date_start
Logic.weekendCount(key, requests, background) // non-rejected requests that weekend + background
Logic.trafficScore(block, request, ctx)     // -> { score: 0-100, level: "low"|"medium"|"high", reasons: [..] }
Logic.flagWords(text, rules)                // -> ["alcohol"] etc.
Logic.canApprove(request, ctx)              // -> { ok, reasons: [..] }  (<10 signatures, over cap, ineligible, out of season)
Logic.vendorVisible(request, ctx)           // eligible block, in season, status Submitted or Approved
```

## 5. Shared timeline

| Time | A | B | C |
|---|---|---|---|
| 12:00–12:20 | Push `logic.js` date functions | Push scaffold: `index.html`, `app.js`, `store.js`, empty views | Push `block-party-rules.json` |
| 12:20–12:45 | Push first `blocks.json` (core fields) | Map + address lookup + packet | Draft `sample.json` |
| 12:45–1:30 | Enrich `blocks.json`; `trafficScore`, `canApprove` | Booking form; petition mock | Push `sample.json`; check 10 segments on a real map |
| 1:30–2:10 | Village view | Vendor view | QA pass on live site; demo script |
| 2:10–2:30 | Acceptance checks, final push | PDFs only if all else works | README; rehearse demo |

**Freeze at 2:15**: after that, only bug fixes, and only after telling the team.
