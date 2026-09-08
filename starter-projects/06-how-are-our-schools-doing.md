# How are our schools doing?

**The question:** What does state data say about Oak Park's schools, demographics, spending per pupil, test performance, and how do D97 and OPRF (D200) compare to peer districts and their own past?

**Why it matters:** Schools drive Oak Park's home prices, tax levies, and family decisions, and the debates usually run on reputation rather than the published numbers.

## The data

- Illinois Report Card: browseable per school/district: `https://www.illinoisreportcard.com` (search "Oak Park ESD 97" and "Oak Park & River Forest HS D200")
- ISBE Report Card Data Library: the full downloadable datasets behind the site (Excel/CSV, statewide, many years): `https://www.isbe.net/Pages/Illinois-State-Report-Card-Data.aspx`
- Cached starter extract in repo: `data/report-card-d97-d200.csv` (key indicators for D97, D200, and a handful of comparison districts)

## First win (15 minutes)

From the cached extract: one chart of spending per pupil, D97 vs. two neighboring districts. Or enrollment over the last decade, is it growing or shrinking?

## The build (by 2:15)

A comparison dashboard-lite: 3–4 indicators (enrollment, demographics, per-pupil spend, a proficiency measure) for D97/D200 against 3–5 comparison districts (River Forest 90, Berwyn, Evanston 65/202...), as trends over time. Charts in a slide deck are a complete demo.

## Stretch

Scatter spend-per-pupil against proficiency for all Cook County districts and locate Oak Park on it. That single chart tends to start the best conversations.

## No-code roles

- The statewide files are big but they're spreadsheets: filtering to a district list is the core task and needs no code
- Parents and students: pick which indicators actually matter and call out where the state's measure misleads
- Storyteller: "compared to five years ago..." is the demo

## Claude tips

Paste the column dictionary and ask "which columns do I need for per-pupil spending and proficiency?", the ISBE files have hundreds of columns and this saves an hour. Then paste filtered rows and ask for the comparison charts.
