# How are our schools doing?

**Civic question:** What does state data say about Oak Park's schools, and how do D97 and OPRF (D200) compare to peer districts and their own past on demographics, spending per pupil, and test performance?

**Minimum viable demo:**

- One chart from the cached extract: spending per pupil, D97 versus two neighboring districts, or enrollment over the last decade.
- A comparison dashboard-lite: three or four indicators (enrollment, demographics, per-pupil spend, a proficiency measure) as trends over time.
- D97 and D200 against three to five comparison districts (River Forest 90, Berwyn, Evanston 65 and 202); charts in a slide deck are a complete demo.

**Stretch goals:**

- Scatter spend-per-pupil against proficiency for all Cook County districts and locate Oak Park on it.

**Data:**

- [Illinois Report Card](https://www.illinoisreportcard.com), browseable per school and district (search "Oak Park ESD 97" and "Oak Park & River Forest HS D200")
- [ISBE Report Card Data Library](https://www.isbe.net/Pages/Illinois-State-Report-Card-Data.aspx), the full downloadable statewide datasets behind the site (Excel and CSV, many years)
- Cached in this repo: `data/report-card-d97-d200.csv` (key indicators for D97, D200, and a handful of comparison districts, 200 rows)

**Potential users:** D97 and D200 boards, parents and students, residents

**Difficulty:** Beginner

**Readiness:** Ready now, data cached in this repo

**No-code roles:** The statewide files are big spreadsheets, so filtering to a district list is the core task; parents and students pick which indicators matter and call out where the state's measure misleads, and a storyteller owns "compared to five years ago."

**Limits:** 2025 proficiency is not comparable with earlier years (new performance levels, high school test moved from SAT to ACT), 2020 has no assessments, and finance columns lag one year.
