# Where does my tax dollar go?

**The question:** Of a dollar of Oak Park property taxes, how much goes to the schools, the Village, the library, the parks, the township — and how has that split changed over 20 years?

**Why it matters:** "My taxes are too high" is Oak Park's most durable argument. Almost nobody can say where the money actually goes, or whether the growth outpaces inflation.

## The data

- Levy/extension history by taxing agency, 2006–present (Cook County Clerk Tax Extension API):
  metadata `https://www.cookcountyclerkil.gov/api-tax/public/getreportdata`, PDFs `https://www.cookcountyclerkil.gov/api-tax/public/viewreport`
- Cached, already-extracted CSV in this repo: `data/oak-park-levies.csv` (six agencies: D97, D200 share, Village, Library, Parks, Township)
- CPI for inflation adjustment: `https://fred.stlouisfed.org/series/CPIAUCSL` (cached: `data/cpi-annual.csv`)

## First win (15 minutes)

One pie chart of the most recent year's levy split. Most people have never seen it.

## The build (by 2:15)

A stacked-area or line chart of levies by agency over ~20 years, with a real-dollars (CPI-adjusted) toggle or second chart. The demo sentence writes itself: "since 2006, agency X grew N% after inflation."

## Stretch

Add ACS median household income as a "can residents keep up?" line, or compute the levy on a typical $400k home over time.

## No-code roles

- This project is mostly storytelling: turn the chart into three sentences a neighbor would repeat
- Spreadsheet pivot tables get the entire MVP done — no programming required
- Fact-check: do the numbers match your actual tax bill's breakdown?

## Claude tips

Paste the levy CSV and ask for the chart. Ask: "adjust these annual dollar series to 2025 dollars using this CPI table" — it's one prompt.
