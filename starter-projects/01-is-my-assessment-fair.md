# Is my assessment fair?

**The question:** Do similar Oak Park homes get similar assessments? Who's over- or under-assessed relative to comparable properties?

**Why it matters:** Every homeowner in the room pays property taxes based on these numbers. 2026 is a reassessment year for Oak Park, and appeal decisions ride on exactly this comparison.

## The data

- Assessed values, every Oak Park parcel, by year (Cook County Assessor, Socrata):
  `https://datacatalog.cookcountyil.gov/resource/uzyt-m557.json?$where=township_name='Oak Park' AND year='2025'`
- Building characteristics (sqft, age, class): `https://datacatalog.cookcountyil.gov/resource/x54s-btds.json`
- Cached CSV in this repo: `data/assessed-values-oak-park.csv` (no API needed on event day)

## First win (15 minutes)

Load the CSV in a spreadsheet, compute assessed value per square foot of building, sort. The spread between the top and bottom is the whole project.

## The build (by 2:15)

A chart, table, or map answering: how much does $/sqft vary across otherwise-similar homes? Group by property class, neighborhood code, or building age. A histogram plus a "most over/under vs. peers" top-10 table is a complete demo.

## Stretch

Map it (parcel lat/lons are in the address-points dataset), or compare 2025 vs 2026 reassessment values to find the biggest movers.

## No-code roles

- Look up specific homes on cookcountyassessor.com and sanity-check the outliers the data folks find
- Know the neighborhoods? Explain *why* a block looks weird
- Own the demo: what should a homeowner do with this?

## Claude tips

Paste a few hundred rows and ask: "compute value per square foot, group by class, and flag outliers more than 2 standard deviations from their group." Ask it to write the chart code, or to explain what a class code means.
