# The September 2025 spike

ECHO logged 178 services in September 2025, about double the months around it. This note sets out what the data shows and what was happening at the time, so the ECHO team can confirm the cause. Researched on October 3, 2026, from the cached dashboard snapshot, Village Board records and local news.

**In short:** No public record explains the spike. Nearly all of the increase came from Police and Fire referrals, and the count fell straight back in October. That pattern points to a one-time event, such as a batch of follow-ups or catch-up data entry, more than a lasting rise in need. This is an inference that only the ECHO team can confirm.

## What the data shows

Counts are logged services, not people or referrals. Monthly figures come from the dashboard's `service_by_month` and `referral_by_month` tables.

| | Aug 2025 | **Sep 2025** | Oct 2025 |
| --- | ---: | ---: | ---: |
| All services | 99 | **178** | 93 |
| Police Department referrals | 42 | **76** | 32 |
| Fire Department referrals | 10 | **37** | 23 |
| Resident Contact referrals | 30 | **27** | 21 |
| Emergency Housing referrals | 5 | **10** | 1 |

- **The rise came from Police and Fire.** Their referrals went up by 61 between August and September, out of a total rise of 79. Residents calling or walking in stayed flat.
- **Every kind of need rose at once.** Behavioral Health reached 39, Unhoused Resident 38, Senior Services 33, Housing 30 and Domestic Violence 10. One type of event would not usually raise all of them together.
- **It didn't last.** October dropped back to 93.
- **The Village's own count shows the same jump.** In the February 2026 Year 1 presentation, the Board's running total of referrals goes from 304 to 466 in September (+162), but the deck doesn't explain why.

## What was happening at the time

| Date | Event | Could it explain the spike? |
| --- | --- | --- |
| Jul 1, 2025 | ECHO hired a new program manager. | Unlikely on its own: it was a lasting change, not a one-month event. |
| Jul 22, 2025 | Police launched the "Police to Citizen" online portal. Reports filed through it that need social-service follow-up are routed to ECHO. | Could add to Police referrals over time, but not as a single-month jump. |
| Jul–Oct 2025 | The "Emergency Housing" referral source appears only in these months, peaking in September. | Part of the Unhoused and Housing rise. |
| Sep 16, 2025 | The Village Board heard the Unhoused Task Force recommendations. They gave ECHO the first contact at encampments and the coordination of street outreach. | Part of the Unhoused and Housing rise. |
| Sep 19, 2025 | Housing Forward dedicated its 40-bed Anderson shelter at 112 S. Humphrey Ave. It opened in October. | Same as above. Doesn't explain Senior Services or Domestic Violence. |
| Undated | The Year 1 deck lists a "joint call review and department check-in" with Police and Fire among its takeaways. | If this happened in September, a review of past calls could explain a broad, one-month batch of Police and Fire referrals. |

## Possible explanations

1. **A batch of Police and Fire follow-ups.** For example, a joint review of earlier calls that produced many referrals at once. This fits the pattern best: the rise came from Police and Fire, covered every kind of need, and lasted one month.
2. **Catch-up data entry.** Services from earlier months logged in September would look the same in the data.
3. **Real demand from the fall homelessness work.** This explains part of the Unhoused and Housing increase, but not the rest.

There may be more than one cause. The data can't separate them: it has no record of when the original contact happened, and the meaning of the dashboard's timestamps hasn't been confirmed.

## Further research (Eric, October 3, 2026)

A second pass through the fall 2025 Board packets (the documents attached to each agenda item, read through the Village's Legistar API), local news, and the repo's crime data. **No public source states the cause.** Four findings narrow it down.

**1. Police weren't unusually busy that month.** Reported crime was flat in September 2025: 254 incidents, against 295 in July, 272 in August and 227 in October, and no offense type jumped (from [../data/crime-incidents-oak-park.csv](../data/crime-incidents-oak-park.csv), counting distinct incidents). Reported crime is a rough stand-in for police activity, and most ECHO referrals aren't crimes. Still, it gives no sign of a surge in police contacts that would double ECHO's police referrals. That fits a batch or recording explanation better than a real rise in incidents.

**2. Police and Fire are the sources the dashboard counts differently.** The July 2025 ECHO update to the Board ([ID 25-416](https://oak-park.legistar1.com/oak-park/attachments/b81639d5-5567-4d09-98cb-06b13d58035a.pdf), slide 3) charts referrals by source for February to June 2025. The dashboard's counts for the same months agree for residents but not for Police and Fire:

| February to June 2025 | Board deck (referrals) | Dashboard (services) |
| --- | ---: | ---: |
| Police Department | 40 | 72 |
| Fire Department | 48 | 83 |
| Residents (walk-ins plus resident referrals) | 64 | 61 |
| Village staff / departments | 24 | 20 |

Police and Fire run about 1.8 times higher on the dashboard, and residents don't. Either each Police or Fire referral can produce several service rows, or Police and Fire contacts were added to the record later. Police and Fire are also the two sources behind the September jump. So **how Police and Fire referrals are recorded** may be part of the September story, not only how many there were (inference). This agrees with the earlier finding that the 172 services the dashboard counts beyond the "702 referrals" reported for 2025 all come from Police, Fire or Resident referrals.

**3. ECHO was only starting to track its metrics as of the September 2025 fire study.** The Fire Department Organizational Assessment by Baker Tilly is dated September 2025 and was received by the Board on October 14 ([MOT 25-253](https://oak-park.legistar1.com/oak-park/attachments/2e86d9c2-5b68-4826-8c09-4b837d56d07d.pdf)). Its operations section (report page 23) says: "ECHO is starting to track its performance metrics, which will be important to quantify its benefits," and "ECHO even reports back to the Department on outcomes." The Fire Department's own FY2026 budget deck lists "Build relationships with ECHO" as a 2025 accomplishment ([ID 25-628](https://oak-park.legistar1.com/oak-park/attachments/2886e359-58b7-4f14-bf08-88588ee82ff9.pptx), slide 3). The interviews behind the report happened before its September date, so this shows tracking was new around mid-2025, not that it began in September. It is consistent with the catch-up data entry explanation but doesn't prove it.

**4. Fire referrals offer a path for the Senior Services rise.** Baker Tilly describes ECHO following up on Fire calls for "an unhoused person or a senior who fell multiple times," and notes that each new senior facility is estimated to add 250 Fire calls a year, "many non-emergency lift assists." A batch of Fire follow-ups would plausibly land in Senior Services, which rose to 33 in September and which the homelessness work doesn't explain (inference).

**Updated read (inference):** a one-time batch of Police and Fire follow-ups, or catch-up entry of them, remains the best fit. The new evidence makes "a real rise in need" less likely as the main cause: crime was flat, residents' own contacts were flat, and the excess sits in the two sources whose dashboard counts already run high. The homelessness work explains part of the Unhoused and Housing rise. Only the ECHO team can confirm.

## Question for the ECHO team

Was September 2025 a real rise in calls, a batch of follow-ups from a Police and Fire call review, or a catch-up in data entry? If it was a batch, which months did those contacts originally happen in? And can one Police or Fire referral produce more than one service row? For February to June 2025, the dashboard shows about 1.8 times as many Police and Fire services as the referral counts presented to the Board in July 2025.

Send the question to `echo@oak-park.us`. It is also listed as open question 2 in [../docs/echo-data-key.md](../docs/echo-data-key.md).

## Sources

- ECHO Activity dashboard ([opendata.oak-park.us/EchoActivity](https://opendata.oak-park.us/EchoActivity)), cached in [../data/echo-activity-oak-park.csv](../data/echo-activity-oak-park.csv)
- [E.C.H.O. Year 1 Implementation Overview, February 2026](https://oak-park.legistar1.com/oak-park/attachments/6231d073-37ec-4351-9ee5-4436c538741a.pptx) (ID 26-131)
- [Unhoused Task Force Recommendations, September 16, 2025](https://oak-park.legistar1.com/oak-park/attachments/7b2b033b-8433-45cd-ad0c-53d3b8d0703f.pptx) (ID 25-539)
- [ECHO Phase 1 Update, July 2025](https://oak-park.legistar1.com/oak-park/attachments/b81639d5-5567-4d09-98cb-06b13d58035a.pdf) (ID 25-416)
- Wednesday Journal: [ECHO hires new head](https://www.oakpark.com/2025/07/01/echo-oak-parks-alternative-police-response-hires-new-head/) (Jul 1, 2025), [Oak Park debuts online help portals](https://www.oakpark.com/2025/07/22/oak-park-debuts-online-help-portals-for-police-and-staff/) (Jul 22, 2025), [Housing Forward cuts ribbon on 40-bed shelter](https://www.oakpark.com/2025/09/23/housing-forward-cuts-ribbon-on-40-bed-emergency-shelter/) (Sep 23, 2025)

- [Fire Department Organizational Assessment, Baker Tilly, September 2025](https://oak-park.legistar1.com/oak-park/attachments/2e86d9c2-5b68-4826-8c09-4b837d56d07d.pdf) (MOT 25-253, received October 14, 2025)
- [Fire Department FY2026 budget presentation, October 2025](https://oak-park.legistar1.com/oak-park/attachments/2886e359-58b7-4f14-bf08-88588ee82ff9.pptx) (ID 25-628)

Searched without finding an explanation: Village Board agendas from August to November 2025, the February 2026 Year 1 deck, the Wednesday Journal's August 2025 and February 2026 ECHO articles, and the Village's "Celebrating one year of E.C.H.O." post.

Also searched on October 3, 2026, without finding an explanation:
- FY2026 budget packets (ID 25-628, 25-629, 25-706, 25-721, 25-744), including the [Neighborhood Services deck](https://oak-park.legistar1.com/oak-park/attachments/3a0649ce-934f-4ac4-a41f-b6528ef2d4fc.pptx), the Police deck, the 206-page budget book and the budget transmittal letter. They mention ECHO only as a budget line ($631,587 for FY2026) and a goal to evaluate the pilot.
- The Q3 2025 budget amendment (ORD 25-203), the Housing Forward shelter agreement (RES 25-319), the Thrive Counseling contract extension (RES 25-256, Sep 30, 2025) and the October 2025 staffing memo.
- Board minutes for September to November 2025 are not posted in Legistar; only meeting videos are (not reviewed).
- Wednesday Journal, [Aug 26, 2025](https://www.oakpark.com/2025/08/26/oak-park-staffers-spotlight-echo-at-national-conference/): the national conference panel was in Chicago earlier in August, so it doesn't explain a staff absence before September. The July 15, 2025 and September 29, 2026 ECHO articles have no monthly figures.
