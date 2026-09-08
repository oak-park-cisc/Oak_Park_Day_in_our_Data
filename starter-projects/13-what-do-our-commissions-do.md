# What do our commissions do?

**Civic question:** Which Village commission should a resident approach about an issue, and what public data could help frame the discussion?

**Minimum viable demo:**

- Let a resident describe an issue and return the most relevant commission, its purpose, meeting schedule, link, and related portal resources.
- A "find your commission" quiz: pick your interests (housing, environment, safety, tech), get your commission, its next meeting, and how to join. A static page or a well-organized spreadsheet-turned-flyer demos fine.

**Stretch goals:**

- Add an event calendar, reminders, a guided question builder, or an AI-assisted search that cites its sources.
- Summarize a few recent meeting agendas or minutes per commission into "what they've actually worked on this year".

**Data:**

- [Oak Park commissions directory](../commissions-diod.csv)
- [Oak Park Open Data Portal](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/)
- Granicus meeting video archive (agendas, minutes, recordings), linked per commission from the Village site, and the Village board and commission pages on oak-park.us
- Cached in this repo: [commissions-diod.csv](../commissions-diod.csv) at the repo root (every commission with description, meeting schedule, and links; 15 rows)

**Potential users:** Citizen Involvement Commission, CISC, residents

**Difficulty:** Beginner to intermediate

**Readiness:** Ready now, data cached in this repo

**No-code roles:** Read agendas and write the one-paragraph "what this commission really does" blurbs, design the quiz questions that map interests to commissions, and anyone who has attended a commission meeting can add the "what it's like to show up" field.

**Limits:** The CSV holds only description, meeting schedule, and links; agendas, minutes, and recordings are on Granicus and the Village site and are not cached in this repo, so any summary should cite its source.
