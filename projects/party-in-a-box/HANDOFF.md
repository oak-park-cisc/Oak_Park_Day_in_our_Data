# Handoff card: Party in a Box — Oak Park Block Party Registration Assistant

Day in Our Data hackathon, Oak Park IL, Sat 2026-10-03. Demos at 2:30. **About 2.5 hours of build
time are left as of noon: build in the tier order below and stop where time runs out.**
Repo: `dsvs12/block-party-in-a-box` (public). Site: https://dsvs12.github.io/block-party-in-a-box/
(GitHub Pages, auto-deploys `web/` on every push to `main`).
Source data is copied unchanged from the event repo `oak-park-cisc/Oak_Park_Day_in_our_Data` into
`source-data/`. Read this whole card before starting. Every number below was verified against the data.

## 1. The pitch

**Civic question:** How can Oak Park make block parties easier to plan and approve, while keeping
busy streets open?

**What it adds over today's process:** the Village publishes rules, PDF petitions and a web form,
but nothing connects the resident, the vendors they hire and the Village reviewer. Party in a Box
puts all three in one flow: the resident checks their block and requests dates, neighbors sign,
vendors send quotes, and a Village reviewer approves with traffic impact and the 30-per-weekend
cap in front of them.

**Users (three views):** Resident organizer · Vendor · Village official/reviewer (Public Works).

**Verified findings (`scripts/probe_reference.py` reproduces the 887 / 342 / 441 counts and the shade list):**
- 887 residential street+hundred segments with address ranges.
- 342 segments are on east/west streets, which the Village doesn't close for block parties; 222 of
  those are residential. **Say "segments," never "39% of Oak Park."**
- For those 222, the nearest eligible segment is a median **54 m** away (90th percentile 126 m).
- 441 segments are north/south and not main streets, so likely eligible.
- Shadiest eligible blocks: 1100 S Cuyler (55 trees, 18 large), 1100 S Scoville (56/16), 600 S East (33/15).
- Equity finding (SVI): not computed yet; optional, see Tier 3.

**Next step for the Village (demo close):** a pilot of this flow with Public Works; publish approved
block events and weekend counts against the 30 cap as open data; tell us if VillageView has an API.

## 2. Today vs. later: what is real in the demo

The site is static (GitHub Pages): no server, no database, no logins. So the demo is **one site with
a role switcher** (Resident / Vendor / Village) running on **sample data**, with anything new saved
in the browser's localStorage. Say this clearly in the demo.

| Request from the brief | Today (demo) | After the event (needs Village / backend) |
|---|---|---|
| Book a block party, select a date range | ✅ Real: address → block check, date range, rules checks | Real submissions to the Village |
| Help with city permits | ✅ Checklist + deadline + links to the official form and PDFs | — |
| Select services (barricades, Green kit, vendor) | ✅ Checkboxes saved on the request | — |
| Petition link for neighbors (name, email, address) | ⚠️ Mock only: shareable link format, signers are **fictional sample people**, stored only in the browser | Real signatures need a backend, privacy policy and Village acceptance of e-petitions |
| Vendor: review upcoming parties, submit/confirm a bid, max capacity | ⚠️ Demo with **fictional vendors**; a "bid" is the vendor's price quote to the organizer for its service | Vendor accounts, real notifications |
| Village: approve, pick a date within range, see all bids | ✅ Demo on sample requests | Real reviewer accounts |
| Village: messaging back and forth | ⚠️ Simple comment thread per request, local only | Real messaging |
| Traffic-aware approval, traffic impact stats | ✅ Rule-based impact score from cached data (§4), **not** measured traffic volume | Add Village traffic counts if they exist |
| Vendor account approval | ⚠️ Toggle on sample vendors | Real accounts |
| Auto-generate petition / permit PDFs | ✅ Stretch: client-side PDF (jsPDF) labeled "Draft, not the official Village form" | Fill the Village's official PDF if it has form fields |
| Rep digitally signs the PDF | ⚠️ Mock: typed name + timestamp stamped on the draft PDF | Real e-signature service |
| Integrate with VillageView permitting | ❌ No public API known | Ask the Village; "next step" in demo |
| SSO into Village systems for signing | ❌ Not possible today | Ask the Village; "next step" in demo |

## 3. Rules the app enforces (all in code, from the Village's 2026 page)

Source: https://www.oak-park.us/Community/Events-and-Activities/Block-Parties-and-Sales (copied by
hand into `web/data/block-party-rules.json`; show "Rules shown are 2026; confirm 2027 with Public Works").
- Season Apr 4–Oct 31; hours 9 a.m.–11 p.m.
- East/west streets may not be closed.
- Petition signed by ≥10 separate addresses (or a majority on small blocks); block sale needs 75% of
  residences on both sides.
- Petition due ≥2 weeks before the event (check against the earliest date in the range).
- Max 2 events per block per year; **max 30 block events per weekend village-wide**, first come first served.
- No alcohol sales. Items stay in the curb parking lane; nothing strung across the street.
- Village delivers barricades the day before (Friday for weekend events); Green Block Party kit available.
- Official online form: webforms.oak-park.us/Forms/blockevent. Public Works: publicworks@oak-park.us,
  708.358.5700. Vendors at special events: VillageView permit + Temporary Food Vendor Application.

The 30-per-weekend count in the demo counts only requests in our sample data; the real count isn't public.

## 4. Traffic impact score (code, transparent, shown with its reasons)

No traffic-volume or speed data exists in the repo. Score each segment 0–100 from what we have,
and show every reason on screen:
- Main street (arterial list below) → blocked outright. East/west → blocked (Village rule).
- Bus stops on the segment (`transit-stops-oak-park.csv`, match by location within ~30 m): +points
  per stop, more for high `weekday_trips`.
- School within ~150 m (`schools-oak-park.csv`) on a weekday date: +points.
- Capital project on or next to the segment that year: +points / warning.
- **Clustering:** other requests on the same weekend within ~200 m or on the same street: +points.
- Weekend count vs. the 30 cap.
Village view shows the score, the reasons, and "low / medium / high impact." Never call it "delay"
in minutes: we have no data for that.

Main-street list (our assumption, say so): Harlem, Austin Blvd, Oak Park Ave, Ridgeland, Madison,
Roosevelt, North Ave, Chicago Ave, Lake St, Washington Blvd, Garfield, Jackson Blvd, Division,
Harrison, I-290 and ramps.

## 5. Build tiers (in order; each tier must work and be deployed before starting the next)

**Tier 1 — Resident core (must ship).**
1. `scripts/prep_blocks.py` (stdlib only) → `web/data/blocks.json`: per segment name, hundred,
   centroid, geometry (rounded to 5 decimals), `ns`, `arterial`, `eligible`, `reason`,
   `nearest_eligible` (name + meters), `tree_count`, `big_tree_count`, `bus_stops`
   (count + weekday trips), `school_nearby`, `capital_projects`, `parking` summary, `overnight_ban`.
   Start from `scripts/probe_reference.py`.
2. `web/index.html`: Leaflet map (cdnjs) + address lookup → block packet: eligible or not + reason,
   nearest eligible block, rules checklist, petition deadline from the date range, curb summary,
   shade, link to the official form.
3. "Book a block party" form: date range, services (barricades, Green kit, vendor wanted), max
   expected guests. Saves a request to localStorage with status "Submitted".

**Tier 2 — Three-view demo.**
4. Role switcher in the header: Resident / Vendor / Village. Load `web/data/sample.json` with
   ~8 requests (on real eligible segments, two on the same weekend nearby), ~5 **fictional** vendors
   ("Sample Ice Cream Co."), a few bids, and fictional petition signers.
5. Vendor view: list of approved/pending parties (only eligible, in-season, approved-or-pending);
   submit a quote (price, menu, max capacity served); organizer can confirm one.
6. Village view: queue of requests with traffic impact score + reasons, weekend count vs. 30,
   petition signature count vs. 10, all bids; approve / reject / pick a date within the range;
   comment thread; approve vendor accounts.
7. Petition mock: "Copy petition link" creates `#/petition/<requestId>`; the page shows the request
   and a sign form, with a banner "Demo only — do not enter real personal information." Signatures
   are saved in localStorage; the count updates in the Village view.

**Tier 3 — Stretch.**
8. Draft PDFs with jsPDF (cdnjs): petition and permit summary filled from the request; watermark
   "Draft, not the official Village form"; Village view can add a typed-name "signature" + timestamp.
9. Equity lens: join segment centroids to `social-vulnerability-oak-park.geojson`; eligible share by
   `Composite_Index` quintile.
10. Optional Claude-written flyer, labeled "AI-written." No API key in the static page (skip if no server).

## 6. Data files and gotchas (all in `source-data/`)

| File | Use | Gotchas |
|---|---|---|
| `streets-oak-park.geojson` (3,343) | Segments + address lookup | Skip `ALLEY` and address `-1`. Names uppercase, sometimes with a direction prefix (`S CUYLER AVE`), sometimes not (`HOME AVE`). North/south if \|Δlat·110540\| > \|Δlon·111320·cos(41.885°)\|; curved streets can misclassify. |
| `trees-oak-park.csv` (18,837) | Shade | `block` is `"1200 N AUSTIN BLVD"`: key = (`nearest_street`, first token //100*100). Drop `dbh_in` ≥ 80 (data errors). |
| `transit-stops-oak-park.csv` (217 bus stops, 8 rail stations) | Traffic score | `latitude, longitude, routes, weekday_trips, stop_type`. |
| `schools-oak-park.csv` (21) | Traffic score | `latitude, longitude, type`. |
| `capital-projects-oak-park.geojson` (244) | Traffic score / warning | `build_year` 2025–2029 or None. |
| `parking-restrictions-oak-park.geojson` (1,532) | Curb summary | `classification, days_of_enforcement, enforcement_times, duration_restriction, permit_zone, is_tow_away`. |
| `parking-overnight-ban-oak-park.geojson` (431) | Curb summary | Overnight ban 2:30–6 a.m. |
| `business-licenses-oak-park.csv` | Optional "food nearby" list | Real names: read-only list only, never in sample bids. |
| `historic-buildings-oak-park.csv` | Optional flyer facts | `address` like `532 FAIR OAKS AVE`. |
| `social-vulnerability-oak-park.geojson` (53) | Tier 3 equity | `Composite_Index`, `Language_Index`. |

Distances: kx = 111320·cos(41.885°), ky = 110540 meters per degree. No shapely; stdlib is fine.

## 7. Privacy, honesty and ground rules (non-negotiable)

- Event rule: no sensitive personal information. The public site never collects real names, emails
  or addresses. Petition and vendor data are **fictional samples**; banner on every form.
- **No real business names in sample vendors or bids.**
- A "bid" is a vendor's price quote to the organizer for its own service. Nobody pays for access
  to a public street.
- Draft PDFs and "signatures" are clearly marked as drafts, never presented as official Village documents.
- Footer on every view: "Prototype, not an official Village of Oak Park product. Rules shown are 2026."
- Every count, distance, date check and score is computed in code; no AI makes decisions.

## 8. GitHub Pages

Already set up (`.github/workflows/pages.yml`). Everything the page loads lives in `web/`; use
relative paths (`data/blocks.json`). Commit the prebuilt JSON. Test with
`python3 -m http.server -d web 8000`. Push a rough Tier 1 by ~12:45, then push after each tier.

## 9. Acceptance checks

- [ ] `python3 scripts/prep_blocks.py` prints 887 segments / 342 east-west / 441 eligible and writes `web/data/blocks.json`.
- [ ] `1100 S Cuyler Ave` → eligible, 55 trees; an east/west address → "Not eligible" + nearest eligible block.
- [ ] Date range starting 2026-10-17 → petition due 2026-10-03; a date after Oct 31 → "outside season".
- [ ] A segment with bus stops scores higher traffic impact than one without, and the reasons are listed.
- [ ] Village view shows the weekend count; a 31st request on one weekend is flagged.
- [ ] A request with fewer than 10 signatures can't be approved.
- [ ] Vendor view never shows ineligible, out-of-season or rejected parties; a quote mentioning alcohol is flagged.
- [ ] All sample people and vendors are fictional; demo banners on petition and vendor forms.
- [ ] Live on GitHub Pages; link in README; `git grep -n "sk-"` returns nothing.

## 10. Roles and timeline (from 12:00)

| Time | Coder A | Coder B | No-code |
|---|---|---|---|
| 12:00–12:45 | prep_blocks.py + blocks.json | Map + address lookup + packet | Rules JSON; sample.json (fictional people/vendors) |
| 12:45–1:30 | Traffic score fields; booking form | Role switcher; Village view | Check 10 segments' direction on a real map |
| 1:30–2:10 | Vendor view + quotes | Petition mock + signature count | Demo script |
| 2:10–2:30 | Acceptance checks, final push | PDFs only if everything else works | README via `hackathon-readme` |

**Demo (2 min):** Resident types 1100 S Cuyler → eligible, picks a June 2027 range, books →
copies petition link, signs as a sample neighbor → Vendor view: sample ice-cream vendor quotes
(capacity 150) → Village view: impact "low" with reasons, 12/30 that weekend, 10/10 signatures →
approve a date. Show an east/west address being blocked with the nearest alternative. Close on
next steps: pilot with Public Works, VillageView API, open data on approved events.

## 11. Decisions already made

- Jev is cut (untested alpha; decisions are rule checks in code).
- Static GitHub Pages site; multi-user features are demo-only with sample data.
- Frame examples for the 2027 season (2026 filing is effectively over).
