# What does ECHO see?

**Civic question:** What types of community needs are being encountered by the ECHO program, and where might service partnerships or resources be strengthened?

**Minimum viable demo:**

- Visualize deidentified, aggregated ECHO service categories and trends: a stacked monthly chart by category, plus the referral-source, weekday, and time-block cuts the CSV already holds.
- Compare them with a public directory of community resources: one row per top category with the public or nonprofit services in Oak Park that match it, what they offer, hours, and how to reach them.

**Stretch goals:**

- Put ECHO next to monthly crime counts by NIBRS category from `data/crime-incidents-oak-park.csv`.
- Ask what the September 2025 spike was by reading the Village Board packets from that fall.
- Turn the resource table into a plain-language "who to call" card for each category, checked against the ECHO team's own referral list.

**Data:**

- [ECHO Activity Dashboard](https://opendata.oak-park.us/EchoActivity), a Power BI report (as of September 2026, `https://app.powerbigov.us/view?r=eyJrIjoiODRlMzY0MjUtMTA0Yi00YzRkLTk0YjAtNjg4YmFlM2E1YTE3IiwidCI6IjZjOGIyOTRlLTVmZjUtNDJiMi1hM2Q3LWMzYmQ3MGE3OWYyNSJ9`); the CSV was built by `data/scripts/fetch_echo_activity.py`, which asks the report to group and count on the server and never downloads individual records
- Program description: the Village's [E.C.H.O. page](https://www.oak-park.us/Community/Community-Services/E.C.H.O-Engaging-Community-for-Healthy-Outcomes) and the March 2025 [launch announcement](https://www.oak-park.us/News-articles/Engaging-Community-for-Healthy-Outcomes-E.C.H.O)
- Community resources (this is what the team builds): Village [Community Services](https://www.oak-park.us/Community/Community-Services) and [Housing](https://www.oak-park.us/Community/Housing) programs under [Neighborhood Services](https://www.oak-park.us/Government/Departments/Neighborhood-Services); Oak Park Township [Senior and Disability Services](https://oakparktownship.org/senior-services/), [Youth and Family Services](https://oakparktownship.org/youth-and-family-services/), and the [Community Mental Health Board](https://oakparktownship.org/community-mental-health/) with its May 2026 [Behavioral Health Resource Guide](https://oakparktownship.org/wp-content/uploads/2026/05/Resource-Guide_May_2026.pdf) and [FY27 funding summary](https://oakparktownship.org/wp-content/uploads/2026/05/CMHB-FY27-Funding-Summary.pdf); the Oak Park Public Library's [Social Services](https://www.oppl.org/use-your-library/social-services/) team; the [Oak Park-River Forest Community Foundation](https://oprfcf.org/); [Housing Forward](https://www.housingforward.org/) (emergency shelter, rental assistance and housing), [Thrive Counseling Center](https://thrivecc.org/) (24/7 crisis line), [Sarah's Inn](https://sarahsinn.org/) (domestic violence), and [Beyond Hunger](https://www.gobeyondhunger.org/) (food); pull addresses and phone numbers from the Township guide and the library page rather than from memory
- Cached in this repo: `data/echo-activity-oak-park.csv` (aggregate counts of logged services, five small tables in long format keyed by `breakdown`: month by service category, month by referral source, weekday, four-hour time block, and referral source by service, February 2025 to September 2026; 494 rows)
- Cached in this repo: `data/crime-incidents-oak-park.csv` (for the stretch, used only as monthly counts by NIBRS category)

**Potential users:** Board of Health, Aging in Communities Commission, Community Relations Commission, ECHO team

**Difficulty:** Intermediate

**Readiness:** Ready now, aggregate data cached in this repo; anything the team publishes goes to the Board of Health and the ECHO team for review before it is posted anywhere public

**No-code roles:** Resource directory researchers who read the Village, Township, library, and agency pages and fill in the right-hand table (this is most of the project), a plain-language writer for the category labels and the findings, and someone who has used or worked in these services to say which handoffs actually work and which have waitlists.

**Limits:** Aggregates only: the CSV holds counts, cells under 5 are written `<5` with a second cell suppressed where one could be recovered from a total, and the source has no address, block, beat, zone, age, or notes fields, so nothing can be mapped, nothing should be estimated about an individual, and the dashboard's row-level download should not be pulled for this project. A service is one logged contact, not one person, and 97 percent of referrals land on weekdays, which is the team's schedule, not the community's need; results go to the Board of Health and the ECHO team (echo@oak-park.us) for review before public posting.
