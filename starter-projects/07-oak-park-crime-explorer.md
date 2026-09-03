# Oak Park crime data explorer

**The question:** What does Oak Park's incident data actually show — what happens where, when, and is it trending up or down?

**Why it matters:** Crime perception drives more local decisions than almost any dataset, and it usually runs on Nextdoor anecdotes. The Village publishes the real numbers; almost nobody explores them.

## The data

- Cached extract in this repo: `data/crime-incidents-oak-park.csv` — incidents January 2022 to present, with incident type, date/time, police post/beat, and lat/lon
- Source: the Village of Oak Park's public crime dashboard (Power BI). It has no export button — the CSV here was extracted from its public data feed and is refreshed before the event (source updates ~15 days after month end)

## First win (15 minutes)

Load the CSV, pivot by incident type. What are Oak Park's actual top-5 incident categories? (They're rarely what people guess.)

## The build (by 2:15)

An explorer with any two of: a map of incidents (lat/lon is in the data), a time view (by month, day of week, or hour), and a type breakdown with trend lines — 2022 vs. now, up or down?

## Stretch

Small multiples by beat/post; or pair with the Census brief's tract data to ask where incidents concentrate relative to population; or a "burglary seasons" hour-by-month heatmap.

## No-code roles

- Categorize: the raw incident types are messy — designing a sane grouping (property / vehicle / person / other) is core work and needs judgment, not code
- Reality-check the map: does the hot block match what neighbors actually experience?
- Storyteller: the demo is "three things the data says that Nextdoor doesn't"

## Claude tips

Paste a sample and ask Claude to propose the category groupings, then to write the pivot/chart code. For the map, "make me a Leaflet page plotting these points colored by category" is one prompt.
