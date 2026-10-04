# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A private team workspace for starter project 15, "What does ECHO see?", from the Day in Our Data civic hackathon (Oak Park, IL, October 3, 2026). It was split out of the CISC event repo (https://github.com/oak-park-cisc/Oak_Park_Day_in_our_Data) and holds only this project's data, docs, and extractors. There is no build step. The deliverables are a trends page of aggregate ECHO activity (`site/index.html`) and a resource directory (`resources/`), most of which is built by hand by no-code teammates. The page displays the directory, so the two are linked (see "Trends page and resource directory" below).

Read these first: `docs/project-card.md` (goals and limits), `docs/echo-data-key.md` (category and referral definitions, open questions), `data/README.md` (file-level sources and caveats).

## Commands

```text
python3 -m unittest discover -s tests -v                                   # all checks, stdlib only
python3 -m unittest discover -s tests -k test_call_volume_files_match_the_board_deck   # one check
python3 scripts/fetch_echo_activity.py -o /tmp/echo-live.csv                # refresh to a scratch path only
python3 -m http.server                                                      # from the repo root, then open http://localhost:8000/site/
python3 scripts/build_standalone.py                                         # single-file copy with data embedded: dist/echo-trends.html
```

## Trends page and resource directory

`site/index.html` is one self-contained file (inline CSS and JS, hand-drawn SVG charts, no libraries). It fetches `../data/echo-activity-oak-park.csv`, `../resources/resource-directory.csv`, `../data/crime-monthly-oak-park.csv` and `../data/calls-for-service-totals.csv` at runtime, so it must be served over HTTP, not opened as a file. To send it anywhere (judges, reviewers), run `scripts/build_standalone.py`: it embeds those CSVs (the `SOURCES` map; `BuildContract` checks it matches the page) into `dist/echo-trends.html`, which opens from disk. That copy is a snapshot, and `dist/` is not committed. The build inserts the data before the page's `<script>\n(() => {` line and fails if that line changes. Each category panel has a "Who can help" list built from the directory.

The page has five tabs (`#services`, `#referrals`, `#weekday`, `#help`, `#context`). "By kind of need" uses `service_by_month`. "By referral source" uses `referral_by_month` for the trends and `referral_by_service` (all months, no month column) for what each source sent. "By weekday" uses `service_by_weekday`. Its bars add up only the shown cells, say how many are hidden, and give percentages as shares of shown cells only (the page says so). The page shows no time-of-day data (`service_by_time_block`) until the ECHO team confirms what the timestamp records. "Community context" is not ECHO data: it shows monthly reported crime from `data/crime-monthly-oak-park.csv` and yearly calls for service, with ECHO's start marked, and must carry no correlation figure or claim that ECHO caused a change (see `research/crime-and-echo.md`). Everywhere, `suppressed` cells are shown as "hidden" and never estimated, subtracted from a total, or turned into shares. The tabs draw their SVG charts when first shown, because a hidden container has no width.

The CSV is the contract between the page and the directory. When creating or editing `resources/resource-directory.csv`:

- Keep the exact filename and the column names in `resources/README.md`; the page reads columns by name.
- `echo_category` must match a dashboard label exactly, including capitalization and the slash in `Youth/Family Services`. A misspelled row silently drops off the page (the browser console warns about unmatched rows). A service that fits several categories gets one row per category.
- Write it as standard CSV: wrap any field containing a comma, quote, or line break in double quotes, and double any quote inside one. An unquoted comma shifts every later column in that row.
- The "Find help" tab (`#help`, `setupFinder()` and `resourceCard()`) shows one searchable card per service: rows repeated across categories merge into one card with a chip per category. Cards show `program` linked to the first URL in `how_to_reach` (else `source_url`), `provider`, `what_they_offer`, `when_to_use`, then Contact (every `how_to_reach` part except standalone URLs), Hours, For and Cost, all visible without expanding, for quick team response; only `notes` sit behind a toggle, with `checked_on` under them. The category panels' "Who can help" lists keep contact and hours behind their toggle. Search matches word starts across the text fields, with a small synonym list (`SYNONYMS`). Write `when_to_use` only from the row's own sourced details, never general advice. Each card has a stable id, `svc-` plus a slug of `provider` and `program` (for example `#svc-thrive-counseling-center-24-7-crisis-team`); its # link copies the address, and opening one switches to Find help, clears filters that would hide it, and scrolls to it. Other pages link to these ids, so renaming a provider or program breaks its links.
- Display in the category panels (`resourceItem()` in `site/index.html`) is deliberately brief: `program` linked to `source_url`, `provider`, and `what_they_offer` only, with a line pointing to the Find help tab for contact, hours, eligibility and cost. Each category shows its first 3 rows in file order, so put the most useful service first; the rest sit behind a "Show all" button.
- `how_to_reach` is split on semicolons: standalone URLs are hidden (the title already links to the source), phone numbers become tap-to-call links, and emails become mailto links. Keep separating contact methods with `;` so this works. "Not published online; confirm: <phone>" displays as "Not published; confirm at <phone>".
- After changing the directory, serve the page and check that each row appears under the expected category.

`tests/test_echo.py` (`PageNumbers`) pins figures the page's wording depends on: the Sep 2025 peak of 178, the partial Sep 2026 month, and category totals. In the source, uncategorized services carry the literal service value `(blank)`, which the page shows as "Not categorized".

## Data

- `data/echo-activity-oak-park.csv`: five aggregate tables stacked in long format, chosen with the `breakdown` column; only the columns that apply to a breakdown are filled.
  - `service_by_month` and `referral_by_month`: exact counts, including counts of 1 to 4.
  - `service_by_weekday`, `service_by_time_block`, `referral_by_service`: small cells, plus complementary cells, are written as the string `suppressed`.
- `data/police-calls-echo-relevant-2025.csv`: 2025 police calls for service by dispatch call type, transcribed from the Village Board's June 2026 Phase 2 presentation. `suggested_echo_category` and `match_confidence` are the team's own crosswalk, not the Village's. The two biggest rows (Remove Unwanted, Welfare Check) are low confidence.
- `data/calls-for-service-totals.csv`: yearly police and fire calls for service, 2022 to 2025.
- `data/crime-incidents-oak-park.csv`: used only through `data/crime-monthly-oak-park.csv`, written by `scripts/crime_monthly.py` (distinct incidents per month, All and by `crime_against`; an incident counts in every category it involves). Never load the block-level file in the page. After a crime refresh, rerun the script and update `ContextNumbers` together. It has one row per offense, so count distinct `incident_id` to get incidents. It counts reported crimes, which is a weak comparison for ECHO's non-criminal work; the call-volume files compare much more directly.
- `scripts/`: Power BI "publish to web" replay extractors, standard library only. `fetch_echo_activity.py` sends grouped COUNT queries only, applies `suppress()`, and exits if any table's total doesn't match the model total. Keep both of those behaviors.

## Rules any code or output must follow

- `foia/` holds draft data requests. They are never sent from here; the user files them. Its `templates/SYNTHETIC-*.csv` rows are invented and flagged `synthetic=yes`: never move them into `data/`, load them in `site/index.html`, or add them to the build (`SyntheticIsolation` checks this). `foia/prototype-calls.html` is the only page that shows them, under a SYNTHETIC DATA banner. Real data that arrives goes in `data/` with a `data/README.md` entry.

- Work from the cached snapshots; refresh only when asked. A refreshed ECHO file changes the totals pinned in `tests/test_echo.py` (1,598 services, 73 suppressed cells), so update the test, `data/README.md` and the card together.
- Never add the five ECHO breakdowns together. Monthly trends use `service_by_month` only.
- Parse `count` as a number or missing. `suppressed` means unavailable: not 0, not "<5", and never estimated or back-solved from other tables.
- A service is one logged contact, not one person; describe counts as workload. The dashboard's 2025 total (874) is higher than the "702 referrals" reported to the Board, so don't call the counts referrals.
- Keep the partial current month visually separate from complete months.
- Don't interpret time of day; the timestamp's meaning is unconfirmed. Weekday counts reflect a Monday-to-Friday team.
- There is no geography or individual-level data, so nothing can be mapped. Never fetch the dashboard's row-level "Dataset" export.
- In the resource directory, take addresses, phone numbers and hours from the cited source pages, never from memory, and record `source_url` and `checked_on`.
- Outputs go to the Board of Health and the ECHO team (`echo@oak-park.us`) for review before anything is posted publicly.

## Source access notes

- `www.oak-park.us` returns 403 to curl but works through WebFetch.
- `www.oppl.org` sits behind a Cloudflare challenge and needs a real browser.
- Village Board documents can be found through the Legistar API: `https://webapi.legistar.com/v1/oak-park/matters?$filter=substringof('ECHO',MatterTitle)`, then `/matters/{id}/attachments`.
