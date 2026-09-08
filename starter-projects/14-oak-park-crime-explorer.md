# Oak Park crime data explorer

**Civic question:** What does Oak Park's incident data actually show about what happens where and when, and is it trending up or down?

**Minimum viable demo:**

- Pivot the cached CSV by incident type to find the actual top-5 categories, then design a sane grouping (property, vehicle, person, other).
- An explorer with any two of: a map of incidents, a time view (by month, day of week, or hour), and a type breakdown.
- Trend lines, 2022 versus now: up or down?

**Stretch goals:**

- Small multiples by beat or post.
- Pair with the Census brief's tract data to ask where incidents concentrate relative to population.
- A "burglary seasons" hour-by-month heatmap.

**Data:**

- [Village of Oak Park Crime Maps page](https://www.oak-park.us/Public-Safety/Police-Department/Reports-Maps/Crime-Maps), which links the current Power BI dashboard (the embed key rotates when the Village republishes)
- [Dashboard as of September 2026](https://app.powerbigov.us/view?r=eyJrIjoiMTg0ZGI4YTYtZTgxNC00MzVmLThlNDYtMTE4MTQwNDlkYzdlIiwidCI6IjZjOGIyOTRlLTVmZjUtNDJiMi1hM2Q3LWMzYmQ3MGE3OWYyNSJ9&pageName=2180cdf0aa49c0286272); no export button, so the CSV was pulled from its public data feed with [fetch_crime_incidents.py](../data/scripts/fetch_crime_incidents.py)
- Cached in this repo: [crime-incidents-oak-park.csv](../data/crime-incidents-oak-park.csv) (incidents January 2022 to present with incident type, date and time, police post and beat, and lat/lon, 13,913 rows; refreshed before the event, source updates about 15 days after month end)

**Potential users:** Residents, Village Police, CISC

**Difficulty:** Intermediate

**Readiness:** Ready now, data cached in this repo

**No-code roles:** Grouping the messy raw incident types is core work that needs judgment, not code; reality-check the map against what neighbors experience, and the demo is "three things the data says that Nextdoor doesn't."

**Limits:** Pick one clearly defined question the Village dashboard does not already answer, avoid predictive policing and anything that stigmatizes a neighborhood, and treat points as block-level and approximate by design. One row per offense, not per incident (count distinct `incident_id`), classifications are preliminary and revised, and the current and prior month are partial.
