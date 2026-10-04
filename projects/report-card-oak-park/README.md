# How are our schools doing?

**Civic question:** What does state data say about Oak Park's schools, and how do D97 and OPRF (D200)
compare to peer districts and their own past on demographics, spending per pupil, and test performance?

A one-page dashboard built on Illinois Report Card data for **every Illinois district, 2018–2025**,
plus Cook County Clerk tax data. It leads with a plain-language bottom line, and every claim opens to
show its evidence, a counterpoint, and a chart already set up to make the point.

![Dashboard: the bottom line](docs/img/00-overview.png)

## The bottom line

**Where we stand**
1. **OPRF delivers top results for a middle-of-the-road tax rate.** 2nd of 27 Cook County high school
   districts in reading (2024) with a school tax rate near the county median; every district with a
   higher rate scores lower.
2. **OPRF ranks in the top 3 of Cook County in every core subject.** Reading 2nd, math 3rd, science 3rd
   and graduation rate 3rd of 27; low-income students' reading 2nd of 27.
3. **Oak Park's school spending has grown slower than the state's; the high tax rate comes from a small
   tax base.** Spending per student FY2018–FY2024: OPRF +7%, D97 +40%, Illinois +46%. D97 spends near the
   Cook County median, yet the combined school tax rate ($8.37 per $100) is 3rd highest of 11 nearby towns
   because D97 has about half Evanston 65's taxable property per student. School taxes billed still rose
   74% (D97) and 34% (D200) since 2015.

**Where to improve**

4. **D97 is improving faster than the state, but still trails towns like it.** 42% → 55% proficient
   in reading (2019–2024) vs. +2 points statewide, yet 22nd of 25 Cook County districts with similar incomes.
5. **D97 math has barely moved while reading took off.** 43% → 45% proficient (2019–2024), 16th of 25
   similar Cook County districts; River Forest 90 is at 66%.
6. **Chronic absenteeism has nearly doubled in D97:** 8% → 14% (2019–2025), still below Illinois (25%).

These are patterns, not causes. Test comparisons stop at 2024 because the 2025 test used a new scale.
Slides: [docs/presentation.md](docs/presentation.md).

## How the project meets the brief

| Brief asks for | Where it is |
| --- | --- |
| One chart from the cached extract (spending per pupil vs. neighbors, or enrollment) | Learn more → Trends → Key measures |
| Dashboard-lite: enrollment, demographics, per-pupil spend, a proficiency measure over time | Trends → Key measures and Students |
| D97 and D200 vs. River Forest 90, Berwyn, Evanston 65 and 202 | Default comparison; any of 870 Illinois districts can be added |
| **Stretch:** spend vs. proficiency for all Cook County districts, locating Oak Park | Learn more → Cook County (either axis, any year, Cook County / Chicago area / Illinois) |
| Limit: 2025 proficiency not comparable | Charts set 2025 apart; "then vs. now" stops at 2024; tested |
| Limit: no 2020 assessments | Left blank, never interpolated; tested |
| Limit: finance columns lag one year | Labeled by fiscal year (2025 report card = FY2024) |
| No-code: filter statewide files to a district list | District search by name, town or county |
| No-code: pick indicators that matter | 46 indicators in topics (Students, Attendance, Money, Taxes, Staff, Test results, Gaps, High school) |
| No-code: "compared to five years ago" | Then-vs-now table with selectable years |
| No-code: where the state's measure misleads | Counterpoint on every claim; About the data caveats |

**Beyond the brief:** statewide data instead of a 200-row extract; race and ethnicity; achievement gaps
by student group; school tax rates, tax base and a 20-year levy history; D97 school-by-school results.

## Methods

- **Sources:** ISBE Illinois Report Card public data sets 2018–2025 (General, Finance and
  ELA/Math/Science sheets, including school tax rates and EAV per student); Cook County Clerk Agency
  Tax Rate Reports for D97 and D200, tax years 2006–2025; Village of Oak Park GIS and OpenStreetMap
  for the map. Column names change by year; `data/column-mapping.json` records which column fed
  each measure.
- **Rankings** compare districts of the same type (elementary or high school) in Cook County that report
  the measure that year.
- **"Similar districts"** are Cook County districts of the same type with 25% or fewer low-income students.
- **Trend line / "expected"** is a least-squares fit of proficiency on % low-income students across Cook
  County districts of the same type; "above the line" is a district's actual minus predicted value.
- **Achievement gap** is White minus Black proficiency, in percentage points.
- **Combined school tax rate** adds the elementary and high school district rates. The report card shows
  the rate from three tax years earlier, verified against the Cook County Clerk (D97: 5.135 in tax year 2022).
- **Local tax per student** is local property tax revenue (prior fiscal year) divided by enrollment.
- **Levy growth** is the Clerk's tax extension, tax year 2015 → 2025, not adjusted for inflation.

All sources, retrieval dates and filters: [public/data/SOURCES.md](public/data/SOURCES.md).

## Quality checks

| Check | Command | Result |
| --- | --- | --- |
| Data matches the parent repo's cached extract; every bottom-line number; comparison rules | `npm test` | 21 tests pass (3,000 values match) |
| Lint and format | `npm run check` | Clean (Biome) |
| Types and production build | `npm run build` | Passes |
| Accessibility, every view, light and dark, phone and desktop | `node scripts/a11y.mjs` | 0 WCAG 2.1 A/AA violations (axe-core) |
| Layout at 360px, 390px and desktop, both color schemes | `node scripts/screenshots.mjs` | No console errors or horizontal overflow |

Accessibility: keyboard-reachable controls and tables, 44px touch targets, text contrast ≥ 4.5:1,
every chart has a legend and a table view, and color is never the only way to tell series apart.

## Run

```sh
npm install
npm run dev
```

## Rebuild the data

```sh
pip install pandas python-calamine
npm run data   # downloads ~200 MB of ISBE workbooks into data/raw/ (git-ignored)
```

Images in `docs/img` are regenerated with `node scripts/capture-docs.mjs` while the dev server runs.
Other Oak Park datasets: [data/open-data-catalog.md](data/open-data-catalog.md).
