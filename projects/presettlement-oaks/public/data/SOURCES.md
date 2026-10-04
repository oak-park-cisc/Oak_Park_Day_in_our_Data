# Data sources

All files here are built by `scripts/build_data.py` (trees) and `scripts/draft_narratives.py` (narratives). Retrieved 2026-10-03.

## oaks.json

61 public oaks whose estimated age range reaches 200 years.

**Filter**
- Native oaks only: bur, white, swamp white, chinkapin, red, black, shingle and Hill's (northern pin) oak.
- Pin oak, English oak and other planted species are excluded.
- A tree is kept if DBH × its old-growth forest factor is at least 200.

| Input | Source | Notes |
|---|---|---|
| Village parkway and Village-property trees | [Village of Oak Park, VOP_TreeInventory_PUBLICVIEW](https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/VOP_TreeInventory_PUBLICVIEW/FeatureServer/0), via [`data/trees-oak-park.csv`](https://github.com/oak-park-cisc/Oak_Park_Day_in_our_Data/blob/fe53bd7/data/trees-oak-park.csv) at commit `fe53bd7` | 18,837 trees, measured 2023–2026. Block assignment comes from the repository. |
| Park trees | [Park District of Oak Park, PDOP_Trees_8_30_22_Public](https://services.arcgis.com/QPJQ2OoF7CFF9UvK/arcgis/rest/services/PDOP_Trees_8_30_22_Public/FeatureServer/0) | 2,524 trees, 2022 snapshot. Memorial dedication names (`MEM_NAME`) are not used. |
| Age range, low end | Morton Arboretum, [Estimated Age of Urban Trees by Species and Diameter (DBH)](http://content.govdelivery.com/attachments/INSTATE/2015/01/12/file_attachments/355000/TMAestimatetreeDBH_Age.pdf) (Dwyer 2009, 2010; Chicago-area street trees) | Rows used: bur oak; white oak (also used for chinkapin); swamp white oak; red oak (also used for black, shingle and Hill's oak). Linear extrapolation beyond the table is flagged. |
| Age range, high end | Morton Arboretum old-growth forest growth factors, as summarized by [Friends of Eloise Butler](https://friendsofeloisebutler.org/pages/photosubpages/photoinfopages/treeagecalculator.html) | Red-oak group 6.7, white oak 7.6, bur and swamp white oak 6.5. |
| 1830s land cover | [Illinois Landcover in the Early 1800s](https://clearinghouse.isgs.illinois.edu/data/landcover/illinois-landcover-early-1800s) (INHS, ISGS Clearinghouse), from General Land Office surveys | Point-in-polygon on the `MAP` class. |
| Approximate address | [`streets-oak-park.geojson`](https://github.com/oak-park-cisc/Oak_Park_Day_in_our_Data/blob/fe53bd7/data/streets-oak-park.geojson) (Village street centerlines) | House number interpolated along the nearest segment of the tree's assigned street. |
| Nearest house and year built | [`historic-buildings-oak-park.csv`](https://github.com/oak-park-cisc/Oak_Park_Day_in_our_Data/blob/fe53bd7/data/historic-buildings-oak-park.csv) (Village Historic Building Dataset) | Nearest surveyed building on the same street within about 200 ft. |
| Street View camera point | Village street centerlines | Nearest point on the tree's assigned street, with a heading toward the tree. Parkway trees only. |
| Historic district | [`historic-districts-oak-park.geojson`](https://github.com/oak-park-cisc/Oak_Park_Day_in_our_Data/blob/fe53bd7/data/historic-districts-oak-park.geojson) | District polygons only; survey areas are not used. |

**Confidence score**
- +2 for the white-oak group.
- +1 if the upper estimate is at least 250 years.
- +1 if the 1830s land cover is timber or barrens.
- −1 for a species-name conflict.
- Likely is 3 or more, Possible is 2, Long shot is 1 or less.

## narratives.json

- Draft text generated from the fields above.
- The Kenilworth Witness Oak note comes from [Wednesday Journal, 2014](https://www.oakpark.com/2014/08/12/the-old-growth-oaks-we-hold-so-dear/). Which tree it refers to is unconfirmed.
- Every entry is `"status": "draft"` until reviewed.
