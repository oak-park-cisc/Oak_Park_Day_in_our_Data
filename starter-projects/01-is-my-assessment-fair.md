# Is my assessment fair?

**Civic question:** Do similar Oak Park homes get similar assessments, and who is over- or under-assessed relative to comparable properties?

**Minimum viable demo:**

- Compute assessed value per square foot of building from the cached CSV and sort; the spread between top and bottom is the project.
- Group by property class, Assessor neighborhood code (`nbhd`), or building age and chart how much value per square foot varies across otherwise-similar homes.
- Show a histogram plus a top-10 table of the homes most over- and under-assessed versus their peers.

**Stretch goals:**

- Map the outliers using parcel lat/lons from the address-points dataset.
- Compare 2025 and 2026 reassessment values to find the biggest movers.

**Data:**

- [Assessed values, every Oak Park parcel by year](https://datacatalog.cookcountyil.gov/resource/uzyt-m557.json?$where=township_name='Oak%20Park'%20AND%20year='2025') (Cook County Assessor, Socrata)
- [Building characteristics: sqft, age, class](https://datacatalog.cookcountyil.gov/resource/x54s-btds.json)
- Cached in this repo: `data/assessed-values-oak-park.csv` (every Oak Park parcel with assessed values and building characteristics by year, 37,468 rows; no API needed on event day)

**Potential users:** Residents deciding whether to appeal, Village Finance

**Difficulty:** Beginner

**Readiness:** Ready now, data cached in this repo

**No-code roles:** Look up the outliers on cookcountyassessor.com and sanity-check them, explain why a block you know looks odd, and own the demo of what a homeowner should do with the result.

**Limits:** These are Cook County assessed values (10 percent of market value for residential), not market values, and 2026 is a reassessment year with Board of Review values not yet published. Condo square footage is mostly estimated (`condo_est_unit_sqft`, within roughly 10 to 20 percent of actual), so label any per-square-foot result for class 299 as an estimate.
