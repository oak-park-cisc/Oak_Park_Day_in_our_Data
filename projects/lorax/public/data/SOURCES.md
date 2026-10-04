# Data sources

## trees-oak-park.csv

- **Source:** https://raw.githubusercontent.com/oak-park-cisc/Oak_Park_Day_in_our_Data/main/data/trees-oak-park.csv
- **Upstream:** Village of Oak Park Tree Inventory, https://www.arcgis.com/home/item.html?id=792e798104b140c3b8063e86dc09d991
- **Retrieved:** 2026-10-03
- **Filter:** None. Full file, unmodified (18,837 rows, 2.9 MB).
- **Notes:** Includes 1 `STUMP` record and 2 rows with a blank common name. The `block` column was snapped from the nearest street centerline by the cache maintainers. There is no condition, age or planting-year field.

## streets-oak-park.geojson

- **Source:** https://raw.githubusercontent.com/oak-park-cisc/Oak_Park_Day_in_our_Data/main/data/streets-oak-park.geojson
- **Upstream:** Village of Oak Park Streets Centerlines, https://www.arcgis.com/home/item.html?id=095a733fbde4479980ee9a026728bc0b
- **Retrieved:** 2026-10-03
- **Filter:** None. Full file, unmodified (3,343 segments).

## d97-attendance-zones.geojson

- **Source:** https://raw.githubusercontent.com/oak-park-cisc/Oak_Park_Day_in_our_Data/main/data/d97-attendance-zones.geojson
- **Upstream:** Oak Park Elementary School District 97 attendance boundaries (as cached by the team data repo)
- **Retrieved:** 2026-10-03
- **Filter:** None. Full file, unmodified (8 zones).

## modis-mod44b-oak-park.json

- **Requested dataset:** MODIS/Terra Vegetation Continuous Fields Yearly L3 Global 250 m SIN Grid, **version 006** — https://doi.org/10.5067/MODIS/MOD44B.006. Downloading version 006 from NASA LP DAAC / Earthdata requires a NASA Earthdata login, which this workspace doesn't have.
- **What we used instead:** the same product, **Collection 6.1 (MOD44B.061)**, the successor to version 006, from the public ORNL DAAC MODIS web service: https://modis.ornl.gov/rst/api/v1/MOD44B/subset (tiles h11v04; processing dates 2022–2026 identify Collection 6.1).
- **Retrieved:** 2026-10-03 with `npm run fetch:modis` (`scripts/fetch-modis.mjs`).
- **Filter:** band `Percent_Tree_Cover`, every yearly composite 2000–2025 (26 years), a 25 × 49 cell window (±3 km N–S, ±6 km E–W) centered on 41.8875, −87.79. The window is a rectangle on the sinusoidal grid, which leans about 5.8 km east–west over its height at this longitude; the first download (±3 km E–W) missed the village's NE and SW corners (1,089 trees), so it was widened. Every inventory tree now falls inside it. Values unmodified; no fill values (253) occurred.
- **To use version 006:** download MOD44B.006 for tile h11v04 with an Earthdata account, export the same window, and rebuild. Version 006 covers 2000–2020 only.

## Census (ACS) — not used

`acs-oak-park-timeseries.csv` (https://raw.githubusercontent.com/oak-park-cisc/Oak_Park_Day_in_our_Data/main/data/acs-oak-park-timeseries.csv, checked 2026-10-03) only has village, Cook County and Illinois totals, with no block-group rows. It can't be compared across areas within Oak Park, so the app doesn't use it.

## blocks.csv and blocks.geojson (derived)

Built by `npm run data` (`scripts/build-blocks.mjs`) from the files above. One row/feature per `block` value in the tree file (814 blocks).

- **Trees used:** 18,834. Excluded: 1 `STUMP` and 2 rows with no common or Latin name.
- **Species** = `latin_name`, falling back to `common_name` when blank. **Genus** = `genus`, or "Unknown" when blank.
- **Diversity:** Shannon index and Simpson's 1 − Σp² over species.
- **Flags** (`species_over_10pct`, `genus_over_20pct`, `genus_30pct_plus`) are set only for blocks with at least 10 trees (`low_count` = false). 189 blocks have one genus at 30% or more. The project brief says 164; we could not reproduce that figure (with no minimum tree count it's 253; keeping the stump and unnamed rows gives 188).
- **Size:** medians of `dbh_in`, `height_ft`, `spread_ft`, ignoring blanks and zeros.
- **Canopy (est.):** two estimates from recorded crown spread, each crown a circle as wide as its spread. `canopy_sqft` adds the circles up (overlaps counted twice, an upper bound). `canopy_covered_sqft` is the ground under at least one crown, found by marking a 2 ft grid (`src/canopy.ts`; the grid coarsens for very large areas, 3.4 ft village-wide). Spread is recorded in 10 ft classes and crowns aren't perfect circles, so both are approximate.
- **Village canopy:** `metadata.canopy_covered_sqft` = 13,975,131 sq ft under public-tree crowns (14,635,895 sq ft if added up), about 10.7% of `village_area_sqft` (130.6 million sq ft = 4.69 sq mi, the union of the D97 zones).
- **Geometry:** street segments whose address range covers the hundred-block (e.g. 1000–1099 → "1000 N KENILWORTH AVE"). 810 of 814 blocks match; the other 4 (14 trees) are listed but not mapped. `street_length_ft` sums the matched segment lengths.
- **zone:** the D97 zone holding most of the block's trees. Each tree is placed by point-in-polygon; the 111 trees just outside every zone polygon (border streets) are assigned to the nearest zone within 60 m.
- **Genus labels** (e.g. Acer → "Maple") come from the most common first word of that genus's common names in the tree file.

## zones.csv and zones.geojson (derived)

One row per D97 zone. `area_sqft` is the zone polygon's area; `canopy_cover_pct` = `canopy_covered_sqft` / `area_sqft`. Tree metrics (species, genus shares, diversity, sizes, canopy) are computed from every tree in the zone. Block metrics count the blocks assigned to the zone: `blocks_genus_30pct_plus` / `blocks_10plus_trees` gives `share_blocks_genus_30pct_plus`, which is what the zone map is shaded by. `canopy_sqft_per_street_ft` uses only blocks drawn on the map.

## trees.json and addresses.json (derived)

- **trees.json:** the 18,834 trees used above, trimmed to location, species, DBH, height, spread and block, for the "Near me" view. It loads only when that view is opened.
- **addresses.json:** street name, left/right address ranges and geometry for each centerline segment that has addresses. The app looks up typed addresses by interpolating along these ranges in the browser, so no address is sent to an outside service. Locations are approximate.

## modis-tree-cover.geojson (derived)

Built by `npm run data` from `modis-mod44b-oak-park.json`. Keeps the 231 cells (about 232 m) whose center falls inside a D97 zone, converting MODIS sinusoidal cell corners to latitude/longitude. Cells look slanted on the map because sinusoidal pixels are parallelograms at this longitude.

- `cover`: percent tree cover per year (2000–2025). `recent_mean`: 2021–2025 average.
- `inventory_trees` / `inventory_canopy_pct`: public inventory trees whose location falls in the cell, and their summed crown area (π × (spread/2)²) as a percent of the cell. The satellite counts all trees, public and private, so the two aren't expected to match; across cells they correlate at about 0.56.
- `metadata.village_mean`: mean of the cells for each year. It ranges from 8.8% to 20.2% from year to year without a steady trend, which is largely measurement noise; don't read single-year changes as canopy gain or loss.
