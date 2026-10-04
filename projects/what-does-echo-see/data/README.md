# Data

Everything the team needs for "What does ECHO see?", cached so nothing depends on live APIs. The ECHO and crime files are the Day in Our Data event snapshots from the [CISC repo](https://github.com/oak-park-cisc/Oak_Park_Day_in_our_Data); the two call-volume files are new, transcribed from a public Village Board presentation. Use these snapshots rather than refreshing (see the main README).

| File | Rows | What it is |
| --- | ---: | --- |
| [echo-activity-oak-park.csv](echo-activity-oak-park.csv) | 494 | Aggregate ECHO services, Feb 2025 to Sep 2026 (September partial), five tables in long format |
| [police-calls-echo-relevant-2025.csv](police-calls-echo-relevant-2025.csv) | 28 | 2025 police calls for service for the call types the Village considers for alternative response, with a suggested ECHO category |
| [calls-for-service-totals.csv](calls-for-service-totals.csv) | 4 | Total police and fire calls for service, 2022 to 2025 |
| [crime-incidents-oak-park.csv](crime-incidents-oak-park.csv) | 13,913 | Reported offenses, Jan 2022 to Sep 1, 2026 (input to the monthly summary) |
| [crime-monthly-oak-park.csv](crime-monthly-oak-park.csv) | 224 | Reported crime incidents per month, All and by person, property and society, Jan 2022 to Aug 2026 (derived) |

Definitions for the ECHO categories and referral sources are in [../docs/echo-data-key.md](../docs/echo-data-key.md).

## Refreshing

The extractors in [../scripts/](../scripts/) are Python 3 standard library only. Write to a scratch path and compare before replacing a committed file; sources revise history.

```text
python3 scripts/fetch_echo_activity.py -o /tmp/echo-live.csv     # grouped counts only, never rows
python3 scripts/fetch_crime_incidents.py -o /tmp/crime-live.csv
```

A refreshed ECHO file will fail `tests/test_echo.py`, which pins the snapshot's totals (1,598 services, 73 suppressed cells). Update the test, this README, and the card together.

## File details

### police-calls-echo-relevant-2025.csv

2025 Oak Park police calls for service for the call types the Village grouped as candidates for alternative response, one row per call type.

Source: "Alternative Response to Service Phase 2 Recommendations & Discussion," presented to the Village Board in June 2026 (Legistar MOT 26-176), slides 21, 22, and 30: [presentation](https://oak-park.legistar1.com/oak-park/attachments/21db010a-41cb-410a-9828-9ce4a0ef9fc7.pptx). Values were read from the slide tables, not retyped from images.

Columns: `call_group` (the deck's grouping: Call Type 1 mental health calls the Village plans to route to Thrive Counseling Center; Call Type 2 domestic and abuse calls; Community Response calls proposed for an expanded ECHO), `call_type` (dispatch call-for-service code), `calls_2025`, `suggested_echo_category`, `match_confidence` (high, medium, low), `note`.

Caveats: **`suggested_echo_category` and `match_confidence` are ours, not the Village's.** No public crosswalk exists between dispatch codes and ECHO's service categories; low-confidence rows (Remove Unwanted, Welfare Check) are also the two largest, so present category totals as a range or show the high-confidence rows separately. The deck's own summary figures do not match its tables: slide 23 gives "Appx. 2025 calls: 233" for Call Type 1 (the table sums to 341; 229 without Psychiatric Abnormal Suicide), and slide 28 gives about 3,300 Community Response calls a year (the table sums to 5,214, which matches slide 15's 11.1 percent share of all calls). Calls for service are dispatch events, not people, and are not the same unit as an ECHO service. Yearly totals only; there is no public monthly or record-level calls-for-service data (record-level data would need a FOIA request and organizer approval).

### calls-for-service-totals.csv

Total calls for service per year, 2022 to 2025: police falling from 46,869 to 37,369, fire rising from 8,594 to 9,474. Source: the same June 2026 presentation, slide 3 (series labeled Police and Fire in the chart data). For context, an August 2024 presentation (Legistar ID 24-507) counted 49,177 calls between June 2023 and May 2024 and estimated over 20 percent "would have been considered a good fit for an alternative response."

### echo-activity-oak-park.csv

Aggregate counts of services logged by E.C.H.O. (Engaging Community for Healthy Outcomes), the Village's care-coordination and unarmed-response program in Neighborhood Services, February 2025 through September 2026 (September partial): 1,598 services, published as five small tables stacked in long format, 494 rows.

Source: Village of Oak Park "ECHO Activity - Public" Power BI dashboard, linked from [opendata.oak-park.us/EchoActivity](https://opendata.oak-park.us/EchoActivity); program page on [oak-park.us](https://www.oak-park.us/Community/Community-Services/E.C.H.O-Engaging-Community-for-Healthy-Outcomes). The script issues only grouped COUNT queries, the same ones the dashboard's charts issue, so no individual record is ever downloaded.

Columns: `breakdown` (service_by_month, referral_by_month, service_by_weekday, service_by_time_block, referral_by_service), `month`, `weekday`, `time_block` (four-hour block), `referral_source` (Police Department, Resident Contact, Fire Department, Community Engagement, Village departments, Community Partner, Business, Emergency Housing), `service` (Unhoused Resident, Behavioral Health, Senior Services, Housing, Youth/Family Services, Financial Support, Domestic Violence, Medical Support, Food Services, Other, blank), `count` (integer or `suppressed`). Only the columns that apply to a breakdown are filled.

Privacy: the source has no location, age, name, or note fields, so nothing below Village level exists. The two month-level tables are unsuppressed (the dashboard's own grain). The weekday, hour-block, and referral-by-service tables suppress positive cells under 5 and apply complementary suppression (73 cells marked `suppressed`). Complementary cells can be 5 or greater, so the marker is not a numeric bound. Monthly tables contain public counts of 1–4. Treat hidden cells as unavailable, not zero; never add the five breakdowns together. This rule is not a formal guarantee against reconstruction across all tables. On September 17, the previous misleading `<5` markers were replaced; numerical counts were unchanged. The dashboard's Dataset button offers a row-level file (timestamp, service, referral source); this repo deliberately does not cache it.

Caveats: a service is one logged contact, not one person, so counts are workload, not caseload. The timestamp is when staff logged the referral: 97 percent fall on weekdays and about a quarter carry a 2 a.m. to 6 a.m. stamp, which does not match a business-hours team, so ask the ECHO team what the field means before reading hour of day. A blank service category appears from July 2026. September 2025 is double its neighbors for an unknown reason. The current month is partial; the report refreshes daily.


### crime-monthly-oak-park.csv

Derived from crime-incidents-oak-park.csv by `python3 scripts/crime_monthly.py`. Columns: `month`, `crime_against` (`All`, `Person`, `Property`, `Society`), `incidents` (distinct `incident_id`). `All` counts each incident once; the three categories count an incident in every category it involves (about 200 incidents involve more than one), so they add up to more than `All`. The partial last month (September 2026) is dropped. This is the only crime file the trends page loads. After refreshing the crime file, rerun the script and update the pinned figures in `tests/test_echo.py` (`ContextNumbers`) together.

### crime-incidents-oak-park.csv

One row per reported offense in Oak Park, January 1, 2022 through September 1, 2026 (August 2026 is the last complete month), with date, time, NIBRS classification, block-level location, police post and zone, and coordinates. 13,913 offense rows across 13,500 distinct incidents.

Source: Village of Oak Park Police Department "Crime Incident - Public" Power BI dashboard, linked from the Village's [Crime Maps](https://www.oak-park.us/Public-Safety/Police-Department/Reports-Maps/Crime-Maps) page. The dashboard has no export button; the script replays the same public query the dashboard page issues and reads the current report IDs at runtime.

Columns: `incident_id`, `incident_id_label` (YY-NNNNN), `charge_id` (unique key), `record_id`, `date`, `time`, `occurred_at`, `hour`, `occurred_at_label`, `incident_type` (NIBRS category), `offense_description`, `offense_code`, `offense_description_code`, `offense_group` (A or B), `crime_against` (Person, Property, Society), `ucr_code`, `location` (block or intersection), `block_begin_number`, `block_odd_number`, `post`, `post_label`, `zone` (1 to 8), `zone_label`, `latitude`, `longitude`.

Caveats: one row per offense, not per incident; count distinct `incident_id` for incident counts. Locations are generalized to the block or intersection, and coordinates are geocoded from that, so many rows share a point. Classifications are preliminary and the Village revises history (between February and September 2026, 42 rows were added to earlier months, 7 removed, and 3 re-geocoded), so a regenerated file will not match this one exactly. The dashboard lags the calendar, so treat the current and prior month as partial. Only NIBRS-classified offenses reported to Oak Park police, not all calls for service. A time of 00:00:00 usually means the time is unknown. The dashboard's embed key changed once in 2026; if the script returns 401, update `DASHBOARD_URL` from the Crime Maps page.

