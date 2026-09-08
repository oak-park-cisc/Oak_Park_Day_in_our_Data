# How resilient is our urban forest?

**The question:** Oak Park's parkways hold about 18,800 Village-maintained trees. Where is that forest diverse enough to shrug off the next pest or disease, and which blocks are leaning on one genus?

**Why it matters:** Dutch elm disease took the elms; emerald ash borer took the ash (128 are left, under 1% of the inventory). The standard test foresters use is the 10-20-30 rule: no more than 10% one species, 20% one genus, 30% one family. Oak Park's public trees sit at 8.8% for the top species (Norway maple) and 20.5% for the top genus (maple), right at the line villagewide, and the picture block by block is much more uneven. Where the Village plants next, and what, is exactly what the Forestry division and the Environment and Energy Commission decide.

## The data

- Village of Oak Park Tree Inventory: every public tree with common and Latin name, DBH (trunk diameter, inches), height and spread (feet, in 10 foot steps), and a point location. Feature service:
  `https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/VOP_TreeInventory_PUBLICVIEW/FeatureServer/0/query?where=1%3D1&outFields=*&outSR=4326&f=geojson` (2,000 per page; add `resultOffset`). CSV download from the [open data portal](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/api/download/v1/items/792e798104b140c3b8063e86dc09d991/csv?layers=0).
  Cached: `data/trees-oak-park.csv`, 18,837 rows with `latitude`, `longitude`, a `genus` column, and a `block` column (hundred block plus street, snapped from the nearest centerline) so you can group without any GIS.
  The layer has no condition, age, or planting-year field. Do not claim tree health from it; DBH is the only size proxy.
- Streets centerlines with address ranges, for blocks and base maps: `data/streets-oak-park.geojson` (live: `https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/Streets_Centerlines/FeatureServer/0`).
- Optional overlays from the same Village GIS: D97 attendance zones (`data/d97-attendance-zones.geojson`), parks, and the ACS block-group indicators in `data/acs-oak-park-timeseries.csv`.

## First win (15 minutes)

Pivot the CSV on `common_name`: a top-10 list and a pie. Then pivot on `genus` and check the 10-20-30 rule. You will find 137 species and 69 genera villagewide, one species near 9%, one genus just over 20%, and hackberry, hybrid elm, honeylocust, and Kentucky coffeetree filling out the top five. That table is a complete first slide.

## The build (by 2:15)

A block-by-block diversity map. Group by `block` (814 blocks, 646 with 15 or more trees), compute for each the share of its most common genus and a diversity score (count of genera, or Shannon or Simpson if someone knows them), and color the blocks or the tree points. Villagewide the rule holds; on 164 blocks a single genus is 30% or more of the trees, and on 9 blocks it is over half. Show the map next to the top-10 table and name the five least diverse blocks.

## Stretch

- Age structure by genus: DBH under 6 inches is roughly the last decade of planting, 24 inches and up is the mature canopy. Oaks lead the young trees; maples, elms, and lindens dominate the big ones. Is the Village's planting fixing the maple dependence?
- Canopy estimate: `spread_ft` gives a crown diameter; sum crown area per block (pi times spread squared over four) and map it.
- "Trees near me": type an address, list the trees on that block with species and size.
- Compare canopy or diversity with park proximity or with income and age by block group, and pick blocks to recommend for a field assessment or planting.

## No-code roles

- Ground truth: walk one of the least diverse blocks near the venue and photograph the parkway. If it is a row of one species, the map is right.
- Anyone who gardens: help translate genera into what residents recognize (Acer is maple, Celtis is hackberry, Gymnocladus is Kentucky coffeetree) and write the two-sentence "why one genus is a risk" explainer.
- Read the Village forestry and parkway tree pages and find the current planting list; check the young-tree data against it.
- Own the demo for the Environment and Energy Commission: "these ten blocks should be first in line."

## Claude tips

Paste the header plus a few hundred rows and ask: "compute species share, genus share, and check the 10-20-30 rule; then group by block and give me the ten blocks with the highest single-genus share among blocks with at least 15 trees." Ask for a Leaflet page that colors each tree point by genus with a block-level popup, or a Python snippet that computes Shannon diversity per block from the CSV.
