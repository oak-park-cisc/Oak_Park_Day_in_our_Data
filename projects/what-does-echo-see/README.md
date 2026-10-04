# What does ECHO see?

Starter project 15 from [Day in Our Data](https://github.com/oak-park-cisc/Oak_Park_Day_in_our_Data), Oak Park's October 3, 2026 civic hackathon. Repo: https://github.com/nikolai-laba/what-does-echo-see

## The question

What community needs does the Village's E.C.H.O. (Engaging Community for Healthy Outcomes) care-coordination program run into, and where could service partnerships or resources be stronger? Goals and limits are in the [project card](docs/project-card.md). Category definitions and open questions are in the [data key](docs/echo-data-key.md).

## The data

| File | What it is | On the page? |
| --- | --- | --- |
| `data/echo-activity-oak-park.csv` | ECHO dashboard counts, Feb 2025–Sep 2026 (Sep partial): 1,598 services in five tables | Yes |
| `data/crime-incidents-oak-park.csv` | Reported offenses, Jan 2022–Sep 1, 2026 | Via the next file |
| `data/crime-monthly-oak-park.csv` | Monthly incident counts built from it | Yes |
| `data/calls-for-service-totals.csv` | Yearly police and fire calls, 2022–2025 | Yes |
| `resources/resource-directory.csv` | 60 hand-built entries matching local services to ECHO categories | Yes |
| `data/police-calls-echo-relevant-2025.csv` | 2025 police calls by type | No (tests only) |

Sources and caveats: [data/README.md](data/README.md). The `foia/templates/` CSVs are synthetic examples, never loaded by the page.

## How we got the numbers

1. **ECHO:** `scripts/fetch_echo_activity.py` pulls grouped counts only. Small counts in the weekday, time-block, and referral-by-service tables, and cells that would reveal them, become `suppressed`.
2. **Crime:** `scripts/fetch_crime_incidents.py` pulls offenses; `scripts/crime_monthly.py` counts distinct incidents per month, overall and by crime against person, property, or society (these overlap), and drops the partial last month.
3. **Calls and the directory** were typed in by hand from cited sources.
4. **The page** (`site/index.html`) uses one ECHO table per view and never adds them together. Hidden cells stay hidden, never estimated. "(blank)" shows as "Not categorized," and a missing month counts as 0. The partial September 2026 is in totals but not averages or year-over-year comparisons. Weekday percentages use shown cells only. Crime is compared in March–February 12-month windows.

Tests (`python3 -m unittest discover -s tests`) pin the quoted figures and check that no synthetic data reaches the page.

## How to use it

- **Open it directly:** download [`echo-trends.html`](https://github.com/nikolai-laba/what-does-echo-see/releases/download/hackathon-2026-10-03/echo-trends.html) from the [October 3, 2026 release](https://github.com/nikolai-laba/what-does-echo-see/releases/tag/hackathon-2026-10-03) and double-click it. It's one file with all the data built in, so it needs no setup and can be emailed. To rebuild it after a data change, run `python3 scripts/build_standalone.py`, which writes `dist/echo-trends.html` (`dist/` isn't committed).
- **View the live version:** from the repo folder, run `python3 -m http.server` and open http://localhost:8000/site/. It reads the CSVs directly, so edits show up on refresh.
- **Read the research:** [research/september-2025-spike.md](research/september-2025-spike.md) and [research/crime-and-echo.md](research/crime-and-echo.md).

Counts are logged services, not people or referrals.

## Status and next steps

**Status:** a draft prototype, not an official Village product. It goes to the Oak Park Board of Health and the ECHO team (echo@oak-park.us) for review before it's posted anywhere public.

Against the [project card](https://github.com/oak-park-cisc/Oak_Park_Day_in_our_Data/blob/main/starter-projects/15-what-does-echo-see.md):

| Card item | What we did |
| --- | --- |
| **Demo:** monthly chart by category, partial September 2026 kept separate, `service_by_month` only | **Done.** The "By kind of need" tab has a monthly chart and a panel for each category. September 2026 is hatched as partial. No other table is added in. |
| **Demo:** directory of matching public and nonprofit services for each top category | **Done.** 60 directory entries across all 9 named categories, each with what it offers, who it's for, cost, hours, and how to reach it. The searchable "Find help" tab shows them in full, and each category lists them briefly. "Other" and "Not categorized" have no matches. |
| **Stretch:** referral-source and weekday breakdowns, `suppressed` as unavailable; defer time blocks | **Done.** "By referral source" and "By weekday" tabs show hidden cells as hidden, never as zero. The time-block table isn't used. |
| **Stretch:** ECHO next to monthly crime counts by NIBRS category | **Partly.** The "Community context" tab shows monthly crime totals and crimes against person, property, and society, not NIBRS categories, plus yearly police and fire calls. It's a separate tab, with no claim that ECHO changed anything. Reasoning is in [research/crime-and-echo.md](research/crime-and-echo.md). |
| **Stretch:** what caused the September 2025 spike, from the fall Board packets | **Done; cause unconfirmed.** We read the fall 2025 Board packets and news coverage. Our best guess is a one-time batch or catch-up of police and fire follow-ups ([research note](research/september-2025-spike.md)). Waiting on the ECHO team to confirm. |
| **Stretch:** plain-language "who to call" card per category, checked against ECHO's referral list | **Partly.** The "Find help" tab has a plain-language card for every service, with when to use it, and search and category filters. Each card can be linked to directly. They haven't been checked against ECHO's own referral list yet; that's item 7 in the [backlog](resources/directory-backlog.md). |

**Next steps:**
- Ask the ECHO team the open questions in the [data key](docs/echo-data-key.md) and the [September 2025 note](research/september-2025-spike.md). For example: what caused September 2025, where our best guess is a one-time batch of police and fire follow-ups; and why the dashboard shows about 1.8 times the police and fire referrals reported to the Board for February–June 2025.
- Finish the open items in [resources/directory-backlog.md](resources/directory-backlog.md).
- Decide whether to send the draft records requests in [foia/](foia/README.md). None has been sent.

MIT license. The project card, the ECHO and crime data, and the extractors come from the CISC repo, © 2026 oak-park-cisc; see [LICENSE](LICENSE).
