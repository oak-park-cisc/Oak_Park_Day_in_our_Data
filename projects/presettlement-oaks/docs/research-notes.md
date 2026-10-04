# Research notes: Oak Park trees older than 200 years

Last updated 2026-10-03.

## Question

Which trees in Oak Park, Illinois, are more than 200 years old? Trunk diameter (DBH) is the working proxy for age.

A possible goal is an Oak Park program modeled on Asheville GreenWorks' Treasured Trees (see below).

## Dataset examined

- **File:** `data/trees-oak-park.csv` in [oak-park-cisc/Oak_Park_Day_in_our_Data](https://github.com/oak-park-cisc/Oak_Park_Day_in_our_Data), commit `fe53bd7` (2026-10-02).
- **Origin:** Village of Oak Park [VOP_TreeInventory_PUBLICVIEW](https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/VOP_TreeInventory_PUBLICVIEW/FeatureServer/0).
- **Contents:** 18,837 public trees (parkways, rights of way, Village property), 137 species. DBH is in whole inches; height and spread are in 5–10 ft steps.
- **Not included:** age, planting year, condition, or private-property trees.
- **DBH reliability:** reasonably good, based on the earlier review. Values are measured 2023–2026, not rounded, and consistent on re-measurement. Known problems are a few outliers, 521 multi-stem trees, and some values that look carried forward.

## Method

Estimated age = DBH (in) × species growth factor.

- The factors are commonly published arborist values. They haven't yet been checked against a cited source:
  - 5.0: bur, white, swamp white and chinkapin oak
  - 4.0: red, black, shingle and northern pin oak; American elm
  - 4.5: Norway maple
  - 3.0: honeylocust and silver maple
- The formula is a rough rule of thumb. For a single tree it can be off by 30–50% or more.
  - It overstates the age of fast-growing street trees that grew up with open space and water.
  - Local re-measurements suggest oaks now grow about 0.4–0.5 in/yr. That would imply *older* ages, but it was measured mostly on younger trees.
- No trees have been checked in the field.

## Results

### Trees estimated at 200 years or older (27)

| Est. age (yr) | DBH (in) | Factor | Species | Block | Height / spread (ft) | object_id |
|---|---|---|---|---|---|---|
| ~333 | 111 | 3.0 | Honeylocust | 1000 Ontario St | 30 / 30 | 6707 |
| ~280 | 70 | 4.0 | Elm-American | 400 Home Ave | 70 / 60 | 7267 |
| ~270 | 60 | 4.5 | Maple-Norway | 100 N Lombard Ave | 60 / 50 | 4402 |
| ~252 | 63 | 4.0 | Elm-American | 600 Iowa St | 70 / 50 | 809 |
| ~252 | 63 | 4.0 | Elm-American | 800 Fair Oaks Ave | 70 / 80 | 1859 |
| ~250 | 50 | 5.0 | Oak-Burr | 400 N Kenilworth Ave | 70 / 80 | 6516 |
| ~236 | 59 | 4.0 | Elm-American | 200 Linden Ave | 80 / 80 | 6185 |
| ~228 | 57 | 4.0 | Elm-American | 100 N Scoville Ave | 80 / 70 | 6074 |
| ~228 | 57 | 4.0 | Elm-American | 800 Home Ave | 80 / 60 | 9104 |
| ~225 | 45 | 5.0 | Oak-Burr | Elizabeth Ct | 70 / 60 | 6387 |
| ~224 | 56 | 4.0 | Elm-American | 1100 S Lombard Ave | 70 / 60 | 14069 |
| ~224 | 56 | 4.0 | Elm-American | 800 N Taylor Ave | 80 / 50 | 3729 |
| ~220 | 55 | 4.0 | Elm-American | 1100 Home Ave | 80 / 70 | 13773 |
| ~220 | 44 | 5.0 | Oak-Burr | 500 Fair Oaks Ave | 80 / 70 | 2015 |
| ~216 | 54 | 4.0 | Elm-American | 500 N Oak Park Ave | 70 / 70 | 926 |
| ~216 | 54 | 4.0 | Elm-American | 600 S Lombard Ave | 60 / 90 | 11909 |
| ~212 | 53 | 4.0 | Elm-American | 300 Forest Ave | 70 / 90 | 7215 |
| ~212 | 53 | 4.0 | Elm-American | 500 Fair Oaks Ave | 70 / 40 | 1994 |
| ~208 | 52 | 4.0 | Elm-American | 100 Forest Ave | 70 / 70 | 7231 |
| ~208 | 52 | 4.0 | Elm-American | 600 N Harvey Ave | 70 / 80 | 2910 |
| ~205 | 41 | 5.0 | Oak-Burr | 200 Marion Ct | 60 / 70 | 24417 |
| ~204 | 51 | 4.0 | Elm-American | 1000 S Elmwood Ave | 70 / 60 | 12234 |
| ~204 | 51 | 4.0 | Elm-American | 700 Woodbine Ave | 70 / 70 | 9727 |
| ~200 | 40 | 5.0 | Oak-Burr | 1100 Ontario St | 60 / 60 | 6827 |
| ~200 | 50 | 4.0 | Elm-American | 400 N East Ave | 70 / 80 | 5781 |
| ~200 | 50 | 4.0 | Elm-American | 400 Superior St | 60 / 60 | 6158 |
| ~200 | 50 | 4.0 | Elm-American | 800 Forest Ave | 70 / 80 | 10367 |

How to read this list:
- **Bur oaks (5): best candidates.** Bur oak is a native savanna species, and these trees fit the story of oaks remaining from before settlement.
- **American elms (20): doubtful.** Elms were the standard parkway tree planted in the late 1800s and early 1900s, so they are probably younger than the formula says.
- **Norway maple (1): unlikely.** It's a European species that was planted, not native here.
- **Honeylocust, 111 in (1): probable data error.** It's only 30 ft tall.

### Borderline native oaks, estimated at 160–199 years (18)

| Est. age (yr) | DBH (in) | Factor | Species | Block | Height / spread (ft) | object_id |
|---|---|---|---|---|---|---|
| ~192 | 48 | 4.0 | Oak-Red | 700 Belleforte Ave | 60 / 70 | 10289 |
| ~185 | 37 | 5.0 | Oak-Burr | 300 N Ridgeland Ave | 70 / 60 | 5210 |
| ~185 | 37 | 5.0 | Oak-Burr | 400 N Kenilworth Ave | 70 / 80 | 6520 |
| ~185 | 37 | 5.0 | Oak-Swamp White | 900 Lexington St | 70 / 50 | 14117 |
| ~180 | 36 | 5.0 | Oak-Burr | 1200 N Ridgeland Ave | 60 / 50 | 2718 |
| ~180 | 36 | 5.0 | Oak-White | 300 N Grove Ave | 70 / 50 | 6609 |
| ~180 | 36 | 5.0 | Oak-Burr | Elizabeth Ct | 70 / 50 | 6386 |
| ~176 | 44 | 4.0 | Oak-Red | 600 Fair Oaks Ave | 70 / 80 | 1944 |
| ~175 | 35 | 5.0 | Oak-Swamp White | 100 N Kenilworth Ave | 60 / 70 | 6871 |
| ~168 | 42 | 4.0 | Oak-Red | 300 Forest Ave | 70 / 80 | 7247 |
| ~165 | 33 | 5.0 | Oak-Swamp White | 200 Thomas St | 60 / 50 | 2793 |
| ~165 | 33 | 5.0 | Oak-Burr | 900 S Humphrey Ave | 70 / 60 | 12700 |
| ~164 | 41 | 4.0 | Oak-Red | 100 S Harvey Ave | 60 / 70 | 17184 |
| ~164 | 41 | 4.0 | Oak-Red | 1100 Highland Ave | 60 / 50 | 14531 |
| ~164 | 41 | 4.0 | Oak-Red | 200 Pleasant St | 70 / 60 | 17498 |
| ~164 | 41 | 4.0 | Oak-Red | 600 Home Ave | 80 / 60 | 8827 |
| ~164 | 41 | 4.0 | Oak-Red | 800 N Elmwood Ave | 70 / 50 | 2419 |
| ~160 | 32 | 5.0 | Oak-White | 1000 Ontario St | 60 / 60 | 6705 |

A small change in growth factor moves these trees in or out of the 200-year group.

## Other public resources (identified, not yet analyzed)

### Local remnant oaks
- **Heritage Oak Project:** maps about 115 of an estimated 170 oaks remaining from before settlement, on public *and private* land in Oak Park, River Forest and Forest Park. It reports ages of 150–280 years and linked trees to the original land survey. The map data hasn't been located yet.
  - [Wednesday Journal, 2014](https://www.oakpark.com/2014/08/12/the-old-growth-oaks-we-hold-so-dear/)
  - [Wednesday Journal, Sept 2026](https://www.oakpark.com/2026/09/15/where-oaks-find-safe-arbor/)
- **Historic Oak Propagation Project:** acorns from local bur oaks 200–300 years old, including the Kenilworth "Witness Oak," grown out with the Morton Arboretum and Openlands West Suburban TreeKeepers.
  - [2011](https://www.oakpark.com/2011/05/25/propagating-oak-parks-historic-oaks/)
  - [2011 (Sept)](https://www.oakpark.com/2011/09/06/tree-activists-look-for-help-regenerating-historic-oak-trees-throughout-oak-park/)
  - [2013](https://www.oakpark.com/2013/11/05/historic-oaks-are-being-planted/)

### Village and Park District
- [Village Urban Forest Management Plan (2024)](https://www.oak-park.us/files/assets/oakpark/v/1/public-works/forestry/oak_park_urban_forest_management_plan_-_1.30.2024.pdf)
- [Village Tree Care and Maintenance](https://www.oak-park.us/Services-Parking/Tree-Care-and-Maintenance)
- [Park District urban forestry](https://pdop.org/news/urban-forestry-at-the-park-district-of-oak-park/). Park trees may not be in the parkway inventory.
- Village ArcGIS layer `VOP_Trees_6_2_21_Viewing` (item `402e05e1ced64931b8908178c095bd0f`). It has repeated DBH measurements in its work history, but it isn't officially released and has no license. Ask the Village before publishing anything from it. Avoid the `Large_Trees` layer, which exposes residents' personal information.

### Historical records from the 1830s
- [Morton Arboretum – Witness Trees of Illinois](https://mortonarb.org/plant-and-protect/chicago-region-trees-initiative/witness-trees-of-illinois/)
- [Illinois GLO survey plats](https://ilglos.com/), downloadable by township
- [Illinois State Geological Survey – Illinois landcover in the early 1800s](https://clearinghouse.isgs.illinois.edu/data/landcover/illinois-landcover-early-1800s)
- [Outdoor Illinois – legacy of the first public land surveys](https://outdoor.wildlifeillinois.org/articles/more-than-a-map-the-legacy-of-illinois-first-public-land-surveys)

### Regional studies and registries
- [Oak Ecosystems Recovery Plan (Morton Arboretum)](https://mortonarb.org/app/uploads/2024/09/Oak-Ecosystem-Recovery-Plan.pdf)
- [Chronological Change in Old-Growth Forests of the Chicago Region (IDNR)](https://dnr.illinois.gov/content/dam/soi/en/web/dnr/grants/documents/wpfgrantreports/2007l21w.pdf). It may include tree-ring data to calibrate DBH against age.
- [Illinois Big Tree Register](https://extension.illinois.edu/forestry/big-tree-register) and its [web map](https://experience.arcgis.com/experience/df5e7296d76a4c8ba133c9e8adf1f85a)
- [Ancient Trees app – Chicago](https://ancienttrees.app/chicago), crowd-sourced and needs verification

## Model program: Asheville GreenWorks Treasured Trees

- **Who runs it:** Asheville GreenWorks and the City of Asheville Urban Forestry Commission, for more than 40 years. About 265 trees have been honored in Buncombe County.
- **Criteria:** historic, environmental or other significant value; a long-lived species suited to the region; public *or* private property.
- **Process:**
  - Anyone can nominate a tree through an online form. The form needs a login, so its fields haven't been seen.
  - A five-person volunteer committee reviews nominations.
  - Each honored tree gets a plaque on a spring-loaded screw that moves out as the tree grows.
  - Neighborhood ceremonies are common, for example a 210-year-old white oak honored in 2022.
- **Goals:** awareness, encouraging owners to care for their trees, and protection during development.
- **Gap:** no public map or list of honored trees was found.
- **Similar programs:** [Columbia, SC](https://www.wltx.com/article/news/local/2026-nominations-columbia-treasured-trees-program/101-22f6b262-3555-41c7-aece-659aa6e560e5) and [Greenwich Tree Conservancy](https://greenwichtreeconservancy.org/treasured-trees-nominations/).
- **Sources:**
  - [GreenWorks – Urban Forestry](https://www.ashevillegreenworks.org/learn/urban-forestry)
  - [GreenWorks Treasured Trees blog](https://www.ashevillegreenworks.org/blog/tag/Treasured+Trees)
  - [A-B Tech – Treasured Tree at Magnolia](https://abtech.edu/news/treasured-tree-magnolia)
  - [City of Asheville – Trees](https://www.ashevillenc.gov/department/public-works/street-services/trees/)

### How it could map to Oak Park

| Treasured Trees part | Oak Park starting point |
|---|---|
| Candidate trees | Bur oaks and borderline native oaks from the DBH analysis above |
| Known old trees on private land | Heritage Oak Project |
| Historic value | 1830s survey witness trees, the Kenilworth Witness Oak, and the propagation project |
| Nomination and review | A form, plus a local volunteer committee (TreeKeepers, Forestry Commission, Heritage Oak group) |
| Public map | A Leaflet map with a card for each tree, an estimated age range, and a "nominate a tree" flow |

## Open questions

- Focus only on trees over 200 years, or also honor historic, rare and notable trees as Asheville does?
- Private trees: get owner consent before showing exact locations.
- Find a cited source for the growth factors, and look for local tree-ring calibration.
- Get the Heritage Oak Project map data and compare it with the inventory.
- Check the top candidates in the field.

## App: Oak Park's Oldest Oaks (started 2026-10-03)

Full decision history and options considered: [decision-log.md](decision-log.md).

Decisions so far:
- **Scope:** public trees (Village inventory plus Park District parks), native oaks only, pin oak excluded.
- **Inclusion rule:** a tree is shown if its age range reaches 200 years.
  - The low end comes from the Morton Arboretum street-tree table (Dwyer).
  - The high end comes from Morton old-growth forest factors.
  - Result: 61 trees (17 likely, 10 possible, 34 long shot; 7 in parks).
- **Map:** markers colored by confidence. Each popup card shows estimated age, species, circumference, canopy and narrative, with a "More" button for full details.
- **Narratives** are generated from the data and not yet reviewed; the "Draft" label was removed at the user's request. See `docs/narratives-review.md`.
- **Likely present at settlement (1833):** gold marker ring. Rule: Likely confidence and age-range midpoint of at least 193 years. That gives 7 bur oaks. It replaced the "maturity at settlement" stage label.
- **New finding:** only about 6% of inventoried trees stand on land the 1830s survey mapped as timber. Every "likely" tree is in that wooded patch, around Kenilworth, Elizabeth Ct, Marion Ct, Ontario St and Austin Gardens.
- **Park District data** includes memorial dedication names. These are deliberately not shown.

Ideas parked for later:
- **Search:** jump to an address or street.
- **Shade area** from crown spread, e.g. π × (spread/2)².
- **Street View link:** a "See this spot" link to Google Street View at the tree's coordinates.
  - Pros: free, no key needed, shows the actual tree.
  - Cons: imagery can be years old, may show the wrong tree when several stand close together, and sends visitors to Google.
- **Nomination flow,** modeled on Asheville's Treasured Trees.
- **Overlay** of the 1830s timber/prairie boundary on the map.
