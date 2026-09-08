# Where is business activity changing?

**Civic question:** Where is business activity growing, changing, or declining across Oak Park's commercial areas?

**Minimum viable demo:**

- Analyze new and canceled licenses by year, business category, and corridor or district.
- Chart starts and ends per year from 2017 on, one panel per corridor, with the category mix per corridor.
- Map the geocoded storefront licenses colored by status or start year.

**Stretch goals:**

- Compare business-license activity with building permits, zoning, transit, or capital projects.
- Compute lifespan (`date_end` minus `date_start`) for closed businesses and compare the median by category or corridor.
- Map the 102 active liquor licenses by corridor and year using the class in `license_classes`.

**Data:**

- [Business License Dashboard](https://opendata.oak-park.us/BusinessLicense/), a Power BI report with no export button (as of September 2026, `https://app.powerbigov.us/view?r=eyJrIjoiZmNjOWJlNGEtYjE2NS00YjYzLWEwNzQtMWFlYzFjNTA5MjI1IiwidCI6IjZjOGIyOTRlLTVmZjUtNDJiMi1hM2Q3LWMzYmQ3MGE3OWYyNSJ9`); the CSV was pulled with [fetch_business_licenses.py](../data/scripts/fetch_business_licenses.py) and the report refreshes nightly
- Zoning polygons are in the [data catalog](../data/open-data-catalog.md#zoning--land-use) under Zoning Districts and Maps; building permits are searchable by address on the Village's CityView portal (same catalog, Property section) but are not cached
- Cached in this repo: [business-licenses-oak-park.csv](../data/business-licenses-oak-park.csv) (every license record as of September 8, 2026, with start and end dates, three category levels, `business_district`, `zoning`, and `latitude`/`longitude` for 2,072 storefront addresses; 2,519 rows, 1,426 active and 1,093 inactive)
- Cached in this repo: [streets-oak-park.geojson](../data/streets-oak-park.geojson) (centerlines with address ranges)
- Cached in this repo: [capital-projects-oak-park.geojson](../data/capital-projects-oak-park.geojson) (2026 street and alley projects)
- Cached in this repo: [transit-stops-oak-park.csv](../data/transit-stops-oak-park.csv) (every stop and station)

**Potential users:** Village economic vitality staff, Plan Commission, business districts

**Difficulty:** Intermediate

**Readiness:** Ready now, data cached in this repo

**No-code roles:** Walk a corridor with the active list and note vacant storefronts and businesses missing from the list, design an eight to ten group category scheme a resident would recognize, or tell one corridor's ten years in three charts.

**Limits:** A license is not a storefront: 262 rows are home-based businesses whose coordinates are left blank on purpose (filter `home_based` = 0 for corridor work and do not map them), 180 rows have no Oak Park address, and 361 active licenses have an expired last issue. Use `date_start` for openings and `date_end` for closings, not `last_issued_date` (the April renewal); closings only exist from 2015, so start year charts at 2017, and the 2019 spike looks like an administrative cleanup rather than a boom.
