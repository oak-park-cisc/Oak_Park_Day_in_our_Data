# How resilient is our urban forest?

An interactive map of Oak Park's 18,837 public trees, block by block. It shows where the street-tree population is diverse and where it leans too heavily on one genus, and how public tree cover lines up with the Village's Social Vulnerability Index.

**For:** Environment & Energy Commission, Public Works and residents.

## Key findings

- **Villagewide, Oak Park sits right at the 10-20-30 line.** The top species (Norway maple, *Acer platanoides*) is 8.8% of trees and the top genus (*Acer*, maples) is 20.5%.
- **Block by block, dependence on one genus is common.** Of 729 graded street blocks, **188 are at risk** (one genus ≥30% or one species ≥50%), 517 are on the cusp and only 24 meet the guideline. Maples are the most common dominant genus everywhere.
- **The biggest, shadiest trees are the least diverse.** Public trees cover roughly 11% of village land (upper bound), and trees 18" and wider give 72% of it. Yet those large trees are far less mixed than the rest: maples are 28% of them, four genera (maple, linden, hackberry, elm) make up 70%, and large maples alone give 19.5% of all public canopy. The 1,338 trees 30"+ are 38% elm. Smaller trees are much more diverse (oak leads at 17%), which hints at a more diverse canopy ahead if they reach maturity; size isn't age, so this is a hint, not a trend. Canopy cover shows no gradient by social vulnerability (10–13% in every fifth).
- **The equity gap is shade, not species.** Diversity shows no notable link to social vulnerability. But census block groups with more seniors (ρ = −0.38), more households without a car (−0.39) or more residents with a disability (−0.29) have **fewer public trees per acre**.
- **24 blocks to look at first:** high vulnerability, at risk on diversity, and in the bottom quarter for canopy per 100 ft of street. Most are on commercial corridors (Lake St, Madison, North Ave, South Blvd, Harrison), where planting space may be the constraint. Treat them as candidates for a field visit, not conclusions.

## Using the app

- **Findings tab:** six topline conclusions, each with its key number, a small chart and a button to see it on the map or dashboard, plus suggested next steps and what the data can't tell us. All figures are computed from the data.
- **Dashboard tab:** Oak Park at a glance. Total trees, species, genera, estimated canopy and median trunk; the 10-20-30 check; blocks by status; the top 10 genera and species with common names; trunk-size classes; and median public trees per acre by the seniors index, with a count of priority blocks.
  - **Canopy cards:** "Who provides the shade" (each genus's share of canopy against its share of trees) and "Genus mix by trunk size" (100% bars of genus share in each size band, colored like the map's tree dots; a chosen genus is highlighted). Both follow the filters and filter on tap.
  - **Slicers:** vulnerability fifth, block status, genus, species and trunk size. Active filters show as removable pills; "Clear all" resets.
  - **Drilldowns:** tap a genus bar to see its species, then a species, a trunk-size column or a status row to filter further. Every number and chart recalculates for the selection; a chart doesn't filter itself, so you can switch between its bars.
- **Map:** each street block is a line colored by 10-20-30 status; park outlines are drawn in lime for context. Tap a block for its stats. Zoom in to see every tree colored by genus, and tap a tree for its species and trunk diameter.
- **Key (top left):** switch between **Diversity**, **Canopy** (canopy per 100 ft of street, in fifths of blocks) and **Vulnerability** coloring, open the grading guide, and toggle the tree dots.
- **Sidebar** (a bottom sheet on phones): shows village stats until you select a block. A selected block shows its status, top genera against the 30% line, size and shade compared with the village, and its block group's vulnerability factors.
- **Public trees vs social vulnerability:** a scatter plot of the 53 block groups with a factor selector, hover details and a table view.
- **Find a street:** search blocks by street name.
- **How blocks are graded:** a guide panel (from the map key, the sidebar's status list, a block's status note or the dashboard's status card) with the 10-20-30 thresholds on a color scale, each status with its rule, count and a real example block ("See on map"), and a short explainer on why depending on one genus is a risk.
- **ⓘ (top right):** data and method notes.

## Data

All data is static in [`public/data`](public/data). Sources, retrieval dates and filters are recorded in [`public/data/SOURCES.md`](public/data/SOURCES.md).

| File | Source |
|---|---|
| `trees-oak-park.csv` | Village of Oak Park Tree Inventory (public view), cached by the Oak Park Day in our Data repo |
| `streets-oak-park.geojson` | Village Streets Centerlines, cached by the same repo |
| `social-vulnerability-oak-park.geojson` | Village Social Vulnerability Index by census block group (Climate Action Plan service), cached by the same repo |
| `oak-park-boundary.geojson` | Village of Oak Park Municipal Boundary feature service (map shading outside the village) |
| `osm-parks.json` | OpenStreetMap `leisure=park` via Overpass API, © OpenStreetMap contributors (ODbL) |
| `genus-family.csv` | Curated genus → botanical family lookup (APG IV), 68 genera |
| `trees-oak-park-with-family.csv` | Tree CSV with `family` and `family_common` columns added (derived) |
| `block-summary.json`, `tree-points.json` | Derived by `scripts/compute-blocks.mjs` |

## Method

- **Blocks** are the 814 hundred-blocks in the inventory's `block` column (e.g. "1200 N Austin Blvd"): each tree belongs to the hundred-block of its nearest street centerline. A block is drawn as the centerline segments whose address range covers that hundred; 4 streets without address ranges use same-name segments within 80 m of their trees.
- **Block status** applies Santamour's 10-20-30 guideline at block scale, with a 10-tree minimum:
  - **At risk:** one genus ≥30% or one species ≥50%.
  - **On the cusp:** one genus ≥20%, one species ≥10% or one family ≥30%.
  - **Meets:** within the guideline.
  - **Too few trees:** fewer than 10 trees; not graded.
  - Park outlines (OpenStreetMap) are map context only; park trees count toward their nearest street block.
- **Canopy (approximate)** adds up π × (spread ÷ 2)² for each tree. Overlapping crowns are not removed, so it overstates true canopy. Block measures are given per 100 ft of street (centerline length). Canopy cover is total crown area over the village's 3,003 acres of land (the census block groups tile the village); the map's canopy colors split blocks into fifths by canopy per 100 ft of street.
- **Social vulnerability:** each tree takes the block group it stands in; a block takes the group most of its trees stand in (streets often form block-group boundaries). Block groups are ranked by their composite score and split into fifths. Trees per acre and canopy share are each group's trees over its land area, compared across the 53 groups with Spearman rank correlation.
- **Look here first:** block group in the two most vulnerable fifths, block at risk, and estimated canopy below the bottom-quartile cutoff (1,696 sq ft per 100 ft of street).

## Limits

- The inventory has **no condition, age or planting-year field**, so nothing here claims tree health or age. Trunk diameter, height and spread are size and shade indicators only.
- **Public trees only:** yard trees are not counted, so a block with few parkway trees may still be shady.
- The Social Vulnerability Index **ranks areas within Oak Park**. The Village has not published its method or year, and the underlying census data is probably 2014–2019, older than the tree inventory.
- **The correlations are modest** (about −0.3 to −0.4) and based on 53 areas, and about 40 combinations were explored. Read them as patterns worth checking, not proof.
- Park outlines are community-mapped (OpenStreetMap), not an official Park District layer.

## Run it

```bash
npm install
npm run dev        # dev server on http://127.0.0.1:5173
npm run compute    # rebuild block-summary.json and tree-points.json from the source files
npm run lint       # Biome check
npm run build      # typecheck + production build
npm run shots      # headless screenshots to .shots/ (needs: npx playwright install chromium)
```

## Project structure

```
public/data/              source data, derived JSON and SOURCES.md
scripts/compute-blocks.mjs  builds blocks, status, canopy, vulnerability join and priority flags
scripts/screenshots.mjs     phone/desktop, light/dark browser checks
src/App.tsx               layout: header, sidebar / bottom sheet, map
src/components/MapView.tsx              Leaflet map, layers and key
src/components/Sidebar.tsx              village and block statistics
src/components/VulnerabilityScatter.tsx trees vs vulnerability chart
src/components/Dashboard.tsx            statistics-at-a-glance tab with slicers and drilldowns
src/components/Findings.tsx             topline conclusions tab
src/components/ClassificationGuide.tsx  "how blocks are graded" dialog
src/lib/slice.ts                        client-side cross-filtering for the dashboard
src/lib/                  types, data loading, status and vulnerability colors
```

## Stack

React, TypeScript, Vite, Tailwind CSS, Leaflet with OpenStreetMap tiles, Turf (build-time geometry), Biome.
