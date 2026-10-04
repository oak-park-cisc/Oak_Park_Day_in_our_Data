# Decision log: Oak Park's Oldest Oaks

This file records how the project got from a question to the current map: the options considered, what was chosen and why, and what was reversed. It covers work through 2026-10-03. Background research and the full resource list are in [research-notes.md](research-notes.md). Per-file data provenance is in [public/data/SOURCES.md](../public/data/SOURCES.md).

The current version is saved as the git tag `map-only`.

## 1. The question

- **Project brief:** identify parkway trees that were present before the Kettlestrings family arrived in 1833.
- **Working question:** which trees in Oak Park, Illinois, are more than 200 years old, using trunk diameter (DBH) as a proxy for age?
- **Possible later goal:** an Oak Park program like Asheville GreenWorks' [Treasured Trees](https://www.ashevillegreenworks.org/learn/urban-forestry). See section 8.
- **Handoff from another project:** a summary from an earlier tree-diversity project in a different workspace was used only for its data pointers. Its research question was set aside.

## 2. Data sources

### Used in the app

| Source | Use | Notes |
|---|---|---|
| Village of Oak Park tree inventory, [VOP_TreeInventory_PUBLICVIEW](https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/VOP_TreeInventory_PUBLICVIEW/FeatureServer/0), via [`data/trees-oak-park.csv`](https://github.com/oak-park-cisc/Oak_Park_Day_in_our_Data) (commit `fe53bd7`) | Parkway trees: species, DBH, height, spread, location | 18,837 trees, measured 2023–2026. DBH judged reasonably reliable. |
| Park District of Oak Park, [PDOP_Trees_8_30_22_Public](https://services.arcgis.com/QPJQ2OoF7CFF9UvK/arcgis/rest/services/PDOP_Trees_8_30_22_Public/FeatureServer/0) | Park trees | 2,524 trees, 2022 snapshot. The Village inventory has almost no trees inside parks. Memorial dedication names are not shown. |
| Morton Arboretum, [Estimated Age of Urban Trees by Species and Diameter](http://content.govdelivery.com/attachments/INSTATE/2015/01/12/file_attachments/355000/TMAestimatetreeDBH_Age.pdf) (Dwyer 2009, 2010) | Low end of age range | Chicago-area street trees. The bur oak row covers 20–40″ and red oak 10–40″. White and swamp white oak stop at 15″, so larger trees are extrapolated. |
| Morton Arboretum old-growth forest growth factors, via [Friends of Eloise Butler](https://friendsofeloisebutler.org/pages/photosubpages/photoinfopages/treeagecalculator.html) | High end of age range | Red-oak group 6.7, white oak 7.6, bur and swamp white oak 6.5. This is a secondhand summary. |
| [Illinois Landcover in the Early 1800s](https://clearinghouse.isgs.illinois.edu/data/landcover/illinois-landcover-early-1800s) (INHS / ISGS) | 1830s land cover at each tree | From General Land Office surveys. Only about 6% of Oak Park's inventoried trees stand on land mapped as timber; the rest was prairie. |
| Village street centerlines, historic buildings and historic districts (same repository) | Approximate address, nearest house and year built, historic district | Addresses are interpolated along the street. |
| [Wednesday Journal, 2014](https://www.oakpark.com/2014/08/12/the-old-growth-oaks-we-hold-so-dear/) | Kenilworth Witness Oak story | Which tree it refers to is unconfirmed. |

### Found but not used yet

- **Heritage Oak Project:** about 115 mapped remnant oaks, including private land. The map data hasn't been located.
- **Village fuller tree layer** `VOP_Trees_6_2_21_Viewing`: has repeated DBH measurements, but it isn't officially released and has no license.
- **1830s survey plats and witness-tree records** ([ilglos.com](https://ilglos.com/), [Morton Arboretum witness trees](https://mortonarb.org/plant-and-protect/chicago-region-trees-initiative/witness-trees-of-illinois/)).
- **Regional studies:** [Oak Ecosystems Recovery Plan](https://mortonarb.org/app/uploads/2024/09/Oak-Ecosystem-Recovery-Plan.pdf) and [old-growth change study](https://dnr.illinois.gov/content/dam/soi/en/web/dnr/grants/documents/wpfgrantreports/2007l21w.pdf).
- **Registries:** [Illinois Big Tree Register](https://extension.illinois.edu/forestry/big-tree-register) and the [Ancient Trees app](https://ancienttrees.app/chicago).
- **Avoid:** the Village `Large_Trees` layer, which exposes residents' names and phone numbers.

## 3. Estimating age from DBH

Age = DBH × a species growth factor, or a lookup in a measured table. Three published sources were compared. For a 50″ bur oak:

| Method | Basis | 50″ bur oak |
|---|---|---|
| Dwyer street-tree table | Measured Chicago-suburb street trees | ~160 yrs (extrapolated) |
| ISA-style landscape factors | Rule of thumb: white oak 5.0, red oak 4.0. No primary ISA document found; e.g. [this table](https://arboristhalifax.ca/tree-age-calculator/) | ~250 yrs |
| Morton old-growth forest factors | Chicago-area forest trees, which grow slowly | ~325 yrs |

Sources disagree by about 2×, so any single number is misleading. A study found [no correlation between diameter and age in bur oaks](http://pvcblog.blogspot.com/2014/05/how-old-are-our-oaks.html) across sites. Remnant savanna oaks probably fall somewhere between the landscape and forest values.

### Methods tried

| # | Method | Result | Outcome |
|---|---|---|---|
| A | Single landscape factor (first analysis) | 27 trees ≥200, mostly American elms; 5 bur oaks | Elms rejected as planted around 1900. Narrowed to oaks. |
| B | Range: Dwyer (low) to old-growth forest (high); include if the high end reaches 200 | 61 native oaks | **Current method** |
| C | Dwyer only | 0 oaks reach 200. Oldest: 48″ red oak at ~188 yrs. | Rejected: empty map |
| D | Range: Dwyer (low) to ISA landscape (high) | 5 bur oaks | Tried, then reverted to B at the user's direction |
| E | Midpoint of range B ≥200 | 17 oaks | Considered, not adopted as the inclusion rule |

## 4. Which trees are included

- **Native oaks only:** bur, white, swamp white, chinkapin, red, black, shingle and Hill's oak.
- **Pin oak excluded:** it's native to the region, but in Oak Park it's almost always planted. Including it would have added 43 trees.
- **English oak and other non-natives excluded.**
- **American elm and Norway maple excluded:** the formula flags them, but they were planted along streets.
- **Public trees only:** Village parkways and Park District parks. Private yards aren't in either dataset.
- **Data quality:** a 111″ honeylocust only 30 ft tall was treated as a likely data error. It isn't an oak, so it doesn't affect the map.

## 5. Confidence and "likely present at settlement"

**Confidence score**
- +2 for the white-oak group (long-lived savanna species).
- +1 if the upper estimate is at least 250 years.
- +1 if the 1830s survey mapped the spot as timber.
- −1 for a species-name conflict in the inventory.
- **Likely** is 3 or more, **Possible** is 2, **Long shot** is 1 or less.
- Result: 17 likely, 10 possible, 34 long shot.

**Likely present at settlement (1833)**
- Rule: Likely confidence, and the age-range midpoint is at least 193 years.
- Result: **7 bur oaks**.
  - ~431 and ~413 N Kenilworth
  - ~2 Elizabeth Ct
  - ~541 Fair Oaks
  - ~220 Marion Ct
  - ~1140 Ontario St
  - one in Austin Gardens
- Shown as a gold marker ring, and as the only badge for those trees, replacing "Likely".
- **Earlier options tried:**
  - "Age in 1833": the range minus 193 years. Dropped because every low end falls after 1833.
  - "Maturity at settlement" stage label (sapling / young / mature), first from both ends of the range, then from the midpoint. Replaced by the ring.
  - Estimating height in 1833: rejected as too vague to be useful.

## 6. Map and card design

- **Stack:** React, TypeScript, Vite, Tailwind, Biome, Leaflet with OpenStreetMap tiles. Static JSON data; no backend.
- **Markers:** one-hue blue ramp by confidence (dark = Likely), checked with a color validator. Marker size also varies, so color isn't the only cue.
- **Popup card:** estimated age range, species, circumference, canopy and narrative, with a **More** button.
- **Details panel:** a bottom sheet on phones and a side panel on desktop.
  - approximate address, block and historic district
  - age range with its basis
  - confidence and reasons
  - size: DBH, circumference, height, spread and rank
  - history: narrative, 1830s land cover and nearest house
  - tree ID and data sources
- **Other panels:** a list grouped by confidence, and an About panel with method, limits and sources.
- **Settled details:**
  - addresses are shown as approximate
  - circumference is calculated from DBH, in feet and inches
  - names with conflicting common and Latin names get a "Name check" flag
- **Narratives:** generated from the data. The "Draft" label was removed at the user's request, but the narratives haven't been individually reviewed. Review copy: [narratives-review.md](narratives-review.md).
- **Phone layout:** the popup width adapts to the screen, the legend hides while a popup is open, and the map pans so the selected tree stays visible beside the details panel.

## 7. Street View: options considered (not yet built)

| Option | What users get | Estimated time | Catches |
|---|---|---|---|
| 1. Link | A button that opens Google Street View at the tree's location | 10–15 min | Opens Google. Imagery may be old or show a neighboring tree. |
| 2. Embedded Google Street View | A Street View image inside the details panel | 1–2 hrs | Needs a Google Maps API key with billing. The key is visible in the website's code. Google's terms apply. |
| 3. Mapillary | Embedded open, crowd-sourced street photos | ~1 hr plus a coverage check | Needs a free token. Oak Park coverage is unknown. |

Recommendation: try option 1 first, on a separate branch, leaving `map-only` untouched.

**Status:** option 1 is built on branch `street-view`.
- A **Street View** button sits beside **More** on the popup card. A full-width "See this spot in Street View" button sits at the top of the details panel. Both open Google Maps in a new tab.
- For parkway trees, the camera is placed on the nearest point of the tree's street, facing the tree. The heading comes from the street centerline.
- Park trees open at the tree's own location, with no heading.

## 8. Model program: Asheville Treasured Trees

- Run by Asheville GreenWorks and the City of Asheville Urban Forestry Commission for more than 40 years; about 265 trees honored.
- Trees can be on public or private land and must have historic, environmental or other significant value.
- Volunteer committee review, plaques on spring-loaded screws, neighborhood ceremonies.
- No public map of honored trees was found, which is a gap this project could fill.
- Sources:
  - [GreenWorks Urban Forestry](https://www.ashevillegreenworks.org/learn/urban-forestry)
  - [GreenWorks Treasured Trees blog](https://www.ashevillegreenworks.org/blog/tag/Treasured+Trees)
  - [A-B Tech](https://abtech.edu/news/treasured-tree-magnolia)
- The nomination flow is deferred.

## 9. Parked ideas

- address or street search
- shade area from crown spread
- Street View (section 7)
- nomination flow
- 1830s timber/prairie overlay
- comparison with the Heritage Oak Project
- field checks of the top candidates
- tree-ring calibration

## 10. Known limits

- Ages are estimates from DBH, not tree rings. The method choice changes the results a great deal (section 3).
- The ISA factors and old-growth factors come from secondhand summaries, not primary documents.
- Dwyer's white and swamp white oak rows are extrapolated far beyond their 15″ limit.
- Public trees only. Park data dates from 2022.
- Narratives haven't been reviewed. The Kenilworth Witness Oak link is unconfirmed.
- No checks on real phones, of on-screen keyboard behavior, or of keyboard-only use of the map markers.
