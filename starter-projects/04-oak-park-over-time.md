# Oak Park over time

**The question:** How has Oak Park changed — population, age, race, income, housing, tenure — over the decades, and how does that compare to Cook County and Illinois?

**Why it matters:** Every local argument (schools, taxes, zoning, affordability) rests on a claim about who Oak Park is becoming. The Census actually measures it.

## The data

- Census ACS tables for Oak Park via the keyless Census Reporter API (GEOID `16000US1754885`):
  `https://api.censusreporter.org/1.0/data/show/latest?geo_ids=16000US1754885&table_ids=B25034,B25035,B25036`
  (swap `table_ids` — B01003 population, B19013 income, B25003 tenure, B03002 race/ethnicity)
- Official Census API for historical years: `https://api.census.gov/data/2023/acs/acs5?get=B19013_001E&for=place:54885&in=state:17`
- Cached starter extract in repo: `data/acs-oak-park-timeseries.csv` (key indicators, multiple ACS vintages)

## First win (15 minutes)

One fact from the data most residents don't know. Example already verified: the median Oak Park home was built in **1938**, and 59% of the housing stock predates 1940 — more than double the Illinois share.

## The build (by 2:15)

"Oak Park in 5 charts": pick 3–5 indicators and show their trajectory over time, each against Cook County or Illinois as the comparison line. Slides count as a demo.

## Stretch

Census-tract maps (does east Oak Park differ from west?), or push back to the 2000/2010 decennial censuses for longer arcs.

## No-code roles

- This brief is deliberately story-first: choosing which five facts matter IS the project
- Census Reporter's website (censusreporter.org) renders charts with zero code — screenshot, arrange, narrate
- Fact-checker: does the ACS number match lived experience? Where might the survey mislead (small-sample margins of error)?

## Claude tips

Paste a Census Reporter JSON response and ask for a tidy CSV or a chart. Ask "what are the 5 most surprising changes in this table?" to get candidate storylines fast.
