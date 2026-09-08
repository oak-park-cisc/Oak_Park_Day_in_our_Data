# Oak Park over time

**Civic question:** How has Oak Park changed in population, age, race, income, housing, and tenure over the decades, and how does that compare to Cook County and Illinois?

**Minimum viable demo:**

- One fact from the data most residents do not know (already verified: the median Oak Park home was built in 1938, and 59 percent of the housing stock predates 1940, more than double the Illinois share).
- "Oak Park in 5 charts": three to five indicators over time, each against Cook County or Illinois as the comparison line.
- Slides count as a demo.

**Stretch goals:**

- Census-tract maps: does east Oak Park differ from west?
- Push back to the 2000 and 2010 decennial censuses for longer arcs.

**Data:**

- [Census Reporter API, latest ACS release, keyless](https://api.censusreporter.org/1.0/data/show/latest?geo_ids=16000US1754885&table_ids=B25034,B25035,B25036) (Oak Park GEOID `16000US1754885`; swap `table_ids`: B01003 population, B19013 income, B25003 tenure, B03002 race and ethnicity)
- [Official Census API, any year 2009 on, free key required](https://api.census.gov/data/2023/acs/acs5?get=B19013_001E&for=place:54885&in=state:17&key=YOUR_KEY) (see the catalog's Filtering section)
- Cached in this repo: [acs-oak-park-timeseries.csv](../data/acs-oak-park-timeseries.csv) (about 35 indicators for Oak Park, Cook County, and Illinois for every ACS 5-year vintage 2009 through 2024, with margins of error, 1,554 rows)

**Potential users:** Residents, Plan Commission, CISC, D97 and D200 boards

**Difficulty:** Beginner

**Readiness:** Ready now, data cached in this repo; the official Census API needs a free key

**No-code roles:** Choosing which five facts matter is the project; censusreporter.org renders charts with zero code to screenshot and narrate, and a fact-checker asks where small-sample margins of error might mislead.

**Limits:** Dollar figures are in each vintage's own dollars (use [cpi-annual.csv](../data/cpi-annual.csv) to adjust), overlapping 5-year windows are not independent samples, and median year built is bottom-coded at 1939 by the Census.
