# Crime, calls for service, and ECHO

Can Oak Park's public crime data show whether ECHO is improving community safety? This note sets out what the data shows, why it can't answer that question, and what data could. Researched on October 3, 2026, from the cached crime and call files and Village Board records.

**In short:** Reported crime in ECHO's first full year was 8.8% lower than the year before. But the decline started in 2022, almost all of it is property crime, which ECHO doesn't work on, and crimes against persons barely moved. ECHO's monthly workload and monthly crime do move together (r = 0.36), but only because both follow the seasons. Compared with the same month a year earlier, the link disappears (r = −0.08). **The public data gives no evidence either way about ECHO's effect on safety.** Answering that would need monthly call data by type (draft FOIA requests are in [../foia/](../foia/)) and ECHO's own outcome measures.

## What the data shows

Reported crime incidents, the same 12 months each year, from [../data/crime-monthly-oak-park.csv](../data/crime-monthly-oak-park.csv). That file is generated from the Police Department's public crime dashboard by [../scripts/crime_monthly.py](../scripts/crime_monthly.py). An incident counts in every category it involves, so the categories add up to more than all incidents.

| 12 months | All incidents | Against person | Against property | Against society |
| --- | ---: | ---: | ---: | ---: |
| Mar 2022 – Feb 2023 | 3,115 | 560 | 2,544 | 51 |
| Mar 2023 – Feb 2024 | 3,051 (−2.1%) | 504 (−10.0%) | 2,534 (−0.4%) | 53 |
| Mar 2024 – Feb 2025 | 2,968 (−2.7%) | 546 (+8.3%) | 2,426 (−4.3%) | 61 |
| **Mar 2025 – Feb 2026** (ECHO's first full year) | **2,708 (−8.8%)** | **533 (−2.4%)** | **2,159 (−11.0%)** | 55 |

Calls for service per year, from the Village Board's June 2026 Phase 2 presentation, slide 3 ([../data/calls-for-service-totals.csv](../data/calls-for-service-totals.csv)):

| Year | Police calls | Change | Fire calls | Change |
| --- | ---: | ---: | ---: | ---: |
| 2022 | 46,869 | | 8,594 | |
| 2023 | 43,931 | −6.3% | 8,629 | +0.4% |
| 2024 | 41,605 | −5.3% | 8,925 | +3.4% |
| 2025 (ECHO from February) | 37,369 | −10.2% | 9,474 | +6.2% |

- **Both declines began before ECHO.** In the same 12-month windows, crime fell every year from 2022, and police calls fell every year. (By calendar year, crime rose slightly in 2023, from 2,999 to 3,081 incidents.)
- **The bigger drop in ECHO's first year is mostly property crime:** theft, burglary, vandalism and car theft. ECHO doesn't respond to these. Crimes against persons, the closest crime measure to ECHO's domestic violence and behavioral health work, fell 2.4%, within their normal year-to-year swing.
- **Fire calls rose while police calls fell.** The Fire Department's September 2025 organizational assessment (Baker Tilly, [MOT 25-253](https://oak-park.legistar1.com/oak-park/attachments/2e86d9c2-5b68-4826-8c09-4b837d56d07d.pdf)) attributes part of fire call growth to senior housing and non-emergency lift assists. That is work ECHO's Senior Services follow-up may touch, but there's no data yet to connect them.

These figures are on the trends page's "Community context" tab, with no correlation figure and no claims about cause.

## Why crime is a weak yardstick for ECHO

- **ECHO's work is mostly not crime.** Its biggest categories are Unhoused Resident, Behavioral Health, Senior Services and Housing. Crime data records offenses, not unmet needs.
- **The scales are very different.** ECHO logs about 80 services a month. Oak Park reports about 220 crime incidents a month and about 3,100 police calls.
- **There's no shared geography.** ECHO's public data has no locations, so nothing can be compared by block, beat or zone. That's deliberate, to protect the people ECHO serves.
- **ECHO counts services, not people or incidents.** One resident can generate many services.

## The correlation, for the record

Over the 19 complete months of ECHO data (February 2025 to August 2026), ECHO's monthly services and monthly reported crime incidents have a Pearson correlation of **r = 0.36**. That isn't evidence of anything:
- **It isn't statistically significant.** With 17 degrees of freedom, r would need to reach about 0.46.
- **It comes from shared patterns.** Both series are higher in summer and early fall, and the September 2025 ECHO spike lands in a busy crime season. See [september-2025-spike.md](september-2025-spike.md).
- **It disappears without seasonality.** Correlating ECHO's monthly services with the change in crime from the same month a year earlier gives **r = −0.08**, effectively zero.

A positive correlation also wouldn't mean ECHO causes crime, and a negative one wouldn't mean ECHO prevents it. Both series respond to the same seasons, staffing and reporting changes.

## Other explanations for the decline

- **A trend already under way.** Crime (in 12-month windows) and police calls were falling from 2022.
- **Reporting channels changed.** Police launched the online "Police to Citizen" portal in July 2025, which may move some reports out of dispatched calls ([Wednesday Journal, Jul 22, 2025](https://www.oakpark.com/2025/07/22/oak-park-debuts-online-help-portals-for-police-and-staff/)).
- **911-to-988 transfers began in January 2026** under the state's CESSA law, moving some mental health calls away from police.
- **Data revisions.** The crime dashboard revises past months: between February and September 2026, 42 rows were added to earlier months and 7 removed. Recent months may still change.
- **Regional trends.** Without a comparison town, Oak Park's decline can't be separated from whatever was happening to crime in the region.

## A stronger design for later

If the FOIA requests return monthly call data, the team could test ECHO's effect more seriously:
1. **Interrupted time series.** Model monthly calls of the types ECHO handles, January 2022 to date, with month-of-year terms for seasonality. Then test for a change in level or slope after February 2025.
2. **A comparison series.** Use call types ECHO doesn't touch, such as traffic, as a control within Oak Park. Nearby towns' NIBRS counts from the FBI's Crime Data Explorer can serve as a control outside it.
3. **Check timing against ECHO milestones:** launch, the September 2025 spike, the new shelter opening in October 2025, and 988 transfers from January 2026.

Even then, the result would be an association. It should be presented as one.

## Value we can't easily document

ECHO's likely benefits mostly don't show up as fewer crimes. They show up as fewer repeat calls, crises handled outside the ER, and people connected to housing or care. Each measure below would show part of that. None of them is a causal estimate on its own.

| Measure | What it would show | Data needed | Who holds it, and how to get it |
| --- | --- | --- | --- |
| Repeat calls after ECHO contact | Fewer police or fire returns to the same household | Of households ECHO followed up after a call, how many had another call within 90 days, before vs after ECHO. The Village would run the match internally and return counts only. | Police and ECHO. Ask directly; a FOIA request can't require new analysis. |
| Officer hours freed | Patrol time returned for other calls | Total minutes on scene by call type per month ([01](../foia/01-police-cad-monthly.md)) × Police referrals to ECHO. Present as a range estimate. | Police CAD (FOIA) |
| Calls by type, monthly | Whether the call types ECHO handles are changing faster than others | Monthly counts by call type and disposition ([01](../foia/01-police-cad-monthly.md)) | Police CAD (FOIA) |
| Lift assists and non-transports | Fire/EMS load from seniors who fall repeatedly | Monthly counts by nature code, transports vs non-transports ([02](../foia/02-fire-ems-monthly.md)), next to ECHO Senior Services | Fire Department (FOIA) |
| 911-to-988 transfers | Mental health calls handled without police | Monthly transfers since January 2026 ([03](../foia/03-911-988-transfers.md)). Also bears on whether Behavioral Health referrals to ECHO fell. | The 911 dispatch center (agency to confirm) |
| Living Room ER diversion | Mental health crises handled without an ER visit | Guests per month, and how many say they'd otherwise have gone to the ER | NAMI Metro Suburban (ask). The Township Community Mental Health Board funds it, so its grant reports may be FOIA-able. |
| Shelter placements | Housing outcomes from Unhoused work | ECHO-referred shelter or housing placements per month | Housing Forward and ECHO (ask) |
| Time to first contact, linkage rate | Service quality | Median days from referral to first contact; share of cases connected to a service ([04](../foia/04-echo-outcomes.md)) | ECHO team (ask directly first) |

Qualitative methods fill the gaps the numbers can't:
- **Case stories already on the public record.** The Board decks describe cases, such as the resident with dementia connected to power of attorney help and Township caregiver support (February 2026 Year 1 deck). Quote them with their source.
- **Structured partner interviews** with Township Senior Services, Housing Forward, Thrive, Police and Fire shift supervisors, and the library's social workers. Ask each the same five questions: what changed since ECHO, which handoffs work, which fail, what's missing, and one example. Get consent.
- **"Most Significant Change" stories.** The ECHO team collects short accounts of what changed for a resident. Any story must be de-identified and approved by the ECHO team before it leaves the team.

## Open questions for the ECHO team

1. Can the Village run the repeat-call match internally (ECHO follow-ups × later calls to the same household) and share counts only?
2. Is there a "referred to ECHO" disposition code in police CAD? If so, what is it called?
3. Which dispatch center handles Oak Park's 911-to-988 transfers, and does it publish counts?
4. Does ECHO track time to first contact and whether a resident was connected to a service?

## Sources

- Crime: Oak Park Police Department "Crime Incident - Public" dashboard ([Crime Maps](https://www.oak-park.us/Public-Safety/Police-Department/Reports-Maps/Crime-Maps)), cached January 2022 to September 1, 2026 in [../data/crime-incidents-oak-park.csv](../data/crime-incidents-oak-park.csv)
- Calls for service: [Alternative Response Phase 2 presentation](https://oak-park.legistar1.com/oak-park/attachments/21db010a-41cb-410a-9828-9ce4a0ef9fc7.pptx), June 2026 (MOT 26-176), slide 3
- ECHO services: [../data/echo-activity-oak-park.csv](../data/echo-activity-oak-park.csv), `service_by_month`
- [Fire Department Organizational Assessment, Baker Tilly, September 2025](https://oak-park.legistar1.com/oak-park/attachments/2e86d9c2-5b68-4826-8c09-4b837d56d07d.pdf) (MOT 25-253)
- [E.C.H.O. Year 1 Implementation Overview, February 2026](https://oak-park.legistar1.com/oak-park/attachments/6231d073-37ec-4351-9ee5-4436c538741a.pptx) (ID 26-131)
