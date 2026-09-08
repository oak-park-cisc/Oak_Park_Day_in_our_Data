# Where does my tax dollar go?

**Civic question:** Of a dollar of Oak Park property taxes, how much goes to the schools, the Village, the library, the parks, and the township, and how has that split changed over 20 years?

**Minimum viable demo:**

- A pie chart of the most recent year's levy split by agency.
- A stacked-area or line chart of levies by agency from 2006 to the present.
- A CPI-adjusted version, with one sentence of the form "since 2006, agency X grew N percent after inflation."

**Stretch goals:**

- Add ACS median household income as a "can residents keep up?" line.
- Compute the levy on a typical $400k home over time.

**Data:**

- Cook County Clerk Tax Extension API, levy and extension history by taxing agency, 2006 to present: [metadata](https://www.cookcountyclerkil.gov/api-tax/public/getreportdata) and [report PDFs](https://www.cookcountyclerkil.gov/api-tax/public/viewreport)
- [CPI for inflation adjustment, FRED series CPIAUCSL](https://fred.stlouisfed.org/series/CPIAUCSL)
- Cached in this repo: `data/oak-park-levies.csv` (already-extracted levies for six agencies, D97, D200 share, Village, Library, Parks, Township, 160 rows)
- Cached in this repo: `data/cpi-annual.csv` (annual CPI with a to-latest-year-dollars factor, 26 rows)

**Potential users:** Residents, Village Finance, D97 and D200 boards

**Difficulty:** Beginner

**Readiness:** Ready now, data cached in this repo

**No-code roles:** Spreadsheet pivot tables get the entire MVP done; turn the chart into three sentences a neighbor would repeat, and fact-check the split against your own tax bill.

**Limits:** The Clerk publishes PDFs, not tables, so start from the cached CSV. D200 also serves River Forest, so its `oak_park_extension` is prorated by EAV share (72 to 76 percent); sum that column for the Oak Park total, and note tax year 2026 is not yet published.
