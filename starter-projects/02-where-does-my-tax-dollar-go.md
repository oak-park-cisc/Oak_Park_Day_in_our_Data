# Where does my tax dollar go?

**Civic question:** How have property-tax extensions attributable to Oak Park changed across eight selected local agencies and funds over 20 years? These agencies represent part of the property-tax bill.

**Minimum viable demo:**

- A pie chart of 2025 `oak_park_extension` by agency, labeled "Selected local agencies and funds—not the full tax bill."
- A stacked-area or line chart of `oak_park_extension` by agency from tax years 2006 through 2025.
- A CPI-adjusted version, with one sentence of the form "since 2006, agency X grew N percent after inflation."

**Stretch goals:**

- Add ACS median household income as a "can residents keep up?" line.
- Estimate a bill for a $400k home only after preparing the applicable tax-code rates, equalization factors, exemptions, and assessment assumptions; this extract alone is insufficient.

**Data:**

- Cook County Clerk Tax Extension API, levy and extension history by taxing agency, 2006 to present: [source page](https://www.cookcountyclerkil.gov/property-taxes/tax-extension-and-rates); the extraction script uses POST-only metadata/PDF endpoints, which cannot be opened as ordinary download links
- [CPI for inflation adjustment, FRED series CPIAUCSL](https://fred.stlouisfed.org/series/CPIAUCSL)
- Cached in this repo: [oak-park-levies.csv](../data/oak-park-levies.csv) (160 rows: D97, the Oak Park share of D200, Village, Library, Park District, Township, Township General Assistance, and Township Mental Health Board; eight agencies/funds × 2006–2025)
- Cached in this repo: [cpi-annual.csv](../data/cpi-annual.csv) (annual CPI with a to-latest-year-dollars factor, 26 rows)

**Potential users:** Residents, Village Finance, D97 and D200 boards

**Difficulty:** Beginner

**Readiness:** Ready now for the selected local-agency comparison, data cached in this repo

**No-code roles:** Spreadsheet pivot tables get the entire MVP done; turn the chart into three sentences a neighbor would repeat, and identify the included and omitted agencies on your own tax bill.

**Limits:** Use `oak_park_extension` consistently: extension is the amount billed, whereas `total_levy` is the requested levy. Cook County, Forest Preserve, Water Reclamation, Triton and mosquito abatement are excluded. The Clerk publishes PDFs, not tables, so start from the cached CSV. D200 also serves River Forest, so its `oak_park_extension` is prorated by EAV share (72 to 76 percent); sum that column for the selected local-agency subtotal, and note tax year 2026 is not yet published.
