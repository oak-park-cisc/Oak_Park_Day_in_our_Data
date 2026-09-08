# Are the worst alleys getting fixed?

**Civic question:** Are the alleys in the worst condition being prioritized for reconstruction?

**Minimum viable demo:**

- Compare the recorded 2024 Pavement Condition Index with proposed alley reconstruction projects.
- Map the lowest-rated alleys that are not currently included in the reconstruction plan.
- Create a simple chart showing the condition of scheduled and unscheduled alleys.

**Stretch goals:**

- Compare the 2022-2023 and 2024 ratings to identify improving or deteriorating segments.
- Examine whether reconstruction priority is related to condition, alley age, surface, or geography.
- Create an address lookup showing nearby alley conditions and planned work.

**Data:**

- [Alley Condition Ratings and Reconstruction Priorities](https://www.arcgis.com/home/item.html?id=8b9855b623b64b65bd71a5269a287b77): conditions layer (641 segments, PCI for 2022-2023 and 2024, surface, width, construction date) `https://utility.arcgis.com/usrsvcs/servers/4cff1aaefa364b57b8c70d5c606f2088/rest/services/VOP/AGOL_VOP_Project/MapServer/157/query?where=1%3D1&outFields=*&outSR=4326&f=geojson`; reconstruction plan (62 segments, alley id and build year 2025 to 2029) `https://utility.arcgis.com/usrsvcs/servers/4cff1aaefa364b57b8c70d5c606f2088/rest/services/VOP/AGOL_VOP_Project/MapServer/164/query?where=1%3D1&outFields=*&outSR=4326&f=geojson`
- [2026 Capital Improvements](https://www.arcgis.com/home/item.html?id=525f3c4a968c4e1f8f3eeeda2f8d6eac); every layer is under `https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/` (for example `2026_CIP_/FeatureServer/5` for alleys; append `/query?where=1%3D1&outFields=*&outSR=4326&f=geojson`)
- [Streets Centerlines](https://www.arcgis.com/home/item.html?id=095a733fbde4479980ee9a026728bc0b)
- Cached in this repo: [alleys-oak-park.csv](../data/alleys-oak-park.csv) (both layers already joined, one row per segment with `pci_2022_2023`, `pci_2024`, `pci_change`, `scheduled_build_year`, `in_2026_cip`, and a centroid; 640 rows)
- Cached in this repo: [alleys-oak-park.geojson](../data/alleys-oak-park.geojson) (the same rows with the line geometry)
- Cached in this repo: [capital-projects-oak-park.geojson](../data/capital-projects-oak-park.geojson) (all 12 2026 CIP layers in one file with a `project_type` column, including the alley reconstruction plan)
- Cached in this repo: [streets-oak-park.geojson](../data/streets-oak-park.geojson) (Village centerlines with address ranges)

**Potential users:** Transportation Commission, Public Works, residents

**Difficulty:** Intermediate

**Readiness:** Ready now, data cached in this repo

**No-code roles:** Photograph five of the worst unscheduled alleys near the venue, sanity check the outliers with someone who lives nearby, and read the Village's alley program page and the 2026 capital budget for how alleys get picked.

**Limits:** The PCI is the Village's number, not ours; use its four bands (0-39, 40-59, 60-79, 80-100). 164 segments scored 39 or below in 2024 and only 51 of those have a `scheduled_build_year` or `in_2026_cip` = Y; `construction_year` of 1900 means unknown, and 14 segments jumped from under 40 to 100 between ratings without their construction date being updated.
