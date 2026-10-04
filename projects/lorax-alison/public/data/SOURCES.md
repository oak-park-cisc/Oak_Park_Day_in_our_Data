# Data sources

Retrieved 2026-10-03.

## trees.csv
- Source: https://raw.githubusercontent.com/oak-park-cisc/Oak_Park_Day_in_our_Data/main/data/trees-oak-park.csv
  (cached copy of the Village of Oak Park Tree Inventory, https://www.arcgis.com/home/item.html?id=792e798104b140c3b8063e86dc09d991)
- All 18,837 rows kept; values unchanged.
- Kept columns: `object_id` (renamed `id`), `common_name`, `latin_name`, `genus`, `dbh_in`, `height_ft`, `spread_ft`,
  `latitude`/`longitude` (renamed `lat`/`lon`, rounded to 6 decimals), `block`.
- Dropped: `genus_source`, `nearest_street`, `block_distance_ft`, `global_id`.
- Added `zone` (see zones.geojson).
- Added `address`, `address_status` and `est_number` (not recorded addresses; the tree inventory has none).
  Each tree is matched to the nearest non-alley centerline segment of its `block` street in streets-oak-park.geojson, and a
  house number (`est_number`) is interpolated along that segment's address range for the side of the street the tree is on.
  That number is then checked against property addresses from
  https://raw.githubusercontent.com/oak-park-cisc/Oak_Park_Day_in_our_Data/main/data/assessed-values-oak-park.csv
  (Cook County Assessor, 2025-26; unit suffixes removed, PKY read as PKWY):
  - `match` (6,904): the estimate is a real property address, shown as is.
  - `between` (4,839): shown as "Between 1232 and 1238 N Austin Blvd" (nearest real numbers on the same side and block).
  - `corner` (3,586): no house brackets it and it is within 160 ft of a cross street, shown as "Corner of X and Y".
  - `near` (3,503): shown as "Near" the closest real number on that side, or the estimate if none.
  - `none` (5): expressway or far from any street.
  Only `match` is shown as matching a property record; all others are labeled "Not confirmed" in the app.
- Rebuild with `python3 scripts/prepare_data.py`.
- Known gaps: 3 rows have no genus, 358 no Latin name, 8 no DBH, 1 is a stump. No age, condition or planting-year field exists.

## streets.geojson
- Source: https://raw.githubusercontent.com/oak-park-cisc/Oak_Park_Day_in_our_Data/main/data/streets-oak-park.geojson
  (cached copy of Oak Park Streets Centerlines, https://www.arcgis.com/home/item.html?id=095a733fbde4479980ee9a026728bc0b)
- All 3,343 segments kept. Kept `street_name` and the four `address_left/right_from/to` fields; coordinates rounded to 5 decimals.

## zones.geojson
- Derived, not an official Village geography. A 5 x 3 grid of equal rectangles over the extent of the tree points
  (padded 0.0005 degrees). Rows A (north) to E (south), columns 1 (west) to 3 (east). Each cell is about 0.62 mi tall by 0.55 mi wide.
- Each tree's `zone` comes from its own location, so a block that crosses a grid line can have trees in two zones (117 of 814 blocks).

## blocks.geojson
- Derived from streets-oak-park.geojson: for each `block` in trees.csv, the centerline segments of that street whose address range
  starts in that hundred (all segments of the street for blocks without a number). Used to draw blocks on the map.

## Diversity measures computed in the app (src/lib/stats.ts)
- Species are counted by Latin name (`latin_name`), normalized: cultivar names in quotes are dropped
  (Acer x freemanii 'Jeffersred' -> Acer × freemanii), genus-only names become "Genus spp."
  (Ulmus 'Homestead', Ulmus spp -> Ulmus spp.), and "x spp" becomes "Genus × spp.". The 358 rows with no Latin name
  are counted as "Genus (no Latin name)". Common names are shown only as a friendly label (the most frequent
  `common_name` for that Latin name); some rows' common and Latin names disagree, and the Latin name wins.
- Stumps, unknown and blank genera are excluded from diversity. Blocks with fewer than 10 trees are not rated.

## Estimates computed in the app (src/lib/estimates.ts)
- CO2 stored: Jenkins et al. (2003) national biomass equations by species group, x1.26 for roots and x0.8 for open-grown trees
  (i-Tree Eco conventions), 50% carbon, x44/12 for CO2.
- Rough age: DBH x commonly published ISA growth factors, shown as a range of +/-30%; only for species with a published factor.
- Shade: crown area as a circle from recorded spread, summed without removing overlap.
- Trunks recorded over 80" (one 30 ft honeylocust at 111") get no carbon or age estimate.

## i-Tree Eco export (exports/itree-eco/)
- Built from trees.csv by scripts/export_itree.py on 2026-10-03, following the Eco Guide to Importing an Existing Inventory
  (https://www.itreetools.org/resources/manuals/Ecov6_ManualsGuides/Ecov6Guide_InventoryImporter.pdf).
- Species: Latin name with cultivar removed; genus-only, "spp" and blank Latin names given as the genus; Syringia and
  Circidiphyllum corrected to Syringa and Cercidiphyllum. 16 records left out (listed in the workbook with reasons).

## stormwater.csv (i-Tree Stormwater Calculator)
- Calculated 2026-10-03 with the i-Tree Stormwater Calculator (https://stormwater.itreetools.org/app/), courtesy of the
  i-Tree Cooperative, for 200 trees only: the 100 largest trunks (43-70") and 100 of the 177 trees tied at the smallest
  trunk (1", lowest Tree IDs). Each tree was its own group, run in 8 projects of 25 (exports/itree-stormwater/).
- Settings: Oak Park, Cook County, IL; 2019 weather (44.28 in precipitation); land use Urban/developed; 50% impervious
  cover; clay loam soil; every tree Good condition, full sun. The inventory has no condition, sunlight, soil or cover data,
  so these are assumptions.
- Columns are the report's "Present" (current-size, per year) values: avoided runoff (gallons and the tool's dollar value),
  avoided total phosphorus, total nitrogen and total suspended solids (pounds). The report's canopy/DBH columns show size
  after the 40-year project period, so they are not kept.
- Species: Latin names matched to i-Tree's list (Cladrastis kentukea, Gymnocladus dioica, Platanus x hybrida used for the
  inventory's spellings); 22 trees were run at genus level (species_match = "genus only").
- Rebuild: python3 scripts/build_stormwater_projects.py <species list>, scripts/itree-stormwater/run-all.sh,
  copy /tmp/sw-*-tables.json to exports/itree-stormwater/results/, then python3 scripts/parse_stormwater.py.
