# Are the worst alleys getting fixed?

**The question:** Oak Park rates every alley on a 0 to 100 Pavement Condition Index and publishes a five-year reconstruction plan. Are the alleys in the worst shape the ones on the list?

**Why it matters:** Alleys are where residents meet Public Works: garbage pickup, garage access, flooding. A quarter of the Village's 640 rated alley segments scored 39 or below in 2024, the lowest band on the Village's own map, and only about a third of those are in the 2025 to 2029 plan. Whether the rest are next, or stuck, is a fair question for the Transportation Commission and for anyone who lives on one.

## The data

- Alley conditions and the reconstruction plan: the Village's public web map [Alley Condition Ratings and Reconstruction Priorities V2](https://www.arcgis.com/home/item.html?id=8b9855b623b64b65bd71a5269a287b77). Two layers behind it, both queryable without a login:
  conditions (641 segments, PCI for 2022-2023 and 2024, surface, width, construction date):
  `https://utility.arcgis.com/usrsvcs/servers/4cff1aaefa364b57b8c70d5c606f2088/rest/services/VOP/AGOL_VOP_Project/MapServer/157/query?where=1%3D1&outFields=*&outSR=4326&f=geojson`
  reconstruction plan (62 segments, alley id and build year 2025 to 2029):
  `https://utility.arcgis.com/usrsvcs/servers/4cff1aaefa364b57b8c70d5c606f2088/rest/services/VOP/AGOL_VOP_Project/MapServer/164/query?where=1%3D1&outFields=*&outSR=4326&f=geojson`
  Cached, already joined: `data/alleys-oak-park.csv` (one row per segment, with `pci_2022_2023`, `pci_2024`, `pci_change`, `scheduled_build_year`, `in_2026_cip`, and a centroid) and `data/alleys-oak-park.geojson` (same rows with the line geometry).
- This year's construction program: the [2026 Capital Improvements](https://www.arcgis.com/home/item.html?id=525f3c4a968c4e1f8f3eeeda2f8d6eac) web map (alley improvements, resurfacing, sewer lining, greenways, pavement preservation, RRFBs). Every layer is under `https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/` (for example `2026_CIP_/FeatureServer/5` for alleys; append `/query?where=1%3D1&outFields=*&outSR=4326&f=geojson`).
  Cached: `data/capital-projects-oak-park.geojson`, all 12 layers in one file with a `project_type` column, including the alley reconstruction plan.
- Streets, for address lookups and a base map: `data/streets-oak-park.geojson` (Village centerlines with address ranges).

The PCI is the Village's number, not ours. Its map colors alleys in four bands: 0-39, 40-59, 60-79, 80-100. Use those.

## First win (15 minutes)

Open `alleys-oak-park.csv` in a spreadsheet. Count segments with `pci_2024` of 39 or less (164). Count how many of those have a `scheduled_build_year` or `in_2026_cip` = Y (51). That leaves 113 poor-rated segments with no published plan. Sort them by `pci_2024` and read the top ten aloud, with `from_street` and `to_street`. That is the demo, before any code.

## The build (by 2:15)

A map of the worst-rated alleys that are not on the plan. Load the GeoJSON into Leaflet, kepler.gl, QGIS, or Google MyMaps, color by `pci_2024_band`, and style scheduled versus unscheduled differently (dashed, or a second layer). Add a chart next to it: PCI distribution of scheduled segments versus unscheduled ones. If the scheduled list really is the bottom of the barrel, the chart will show it; if there are unscheduled alleys rated in the single digits while a 74 is on the list for 2026, the chart will show that too.

## Stretch

- Trend: 622 segments have both ratings. Compute `pci_change`, find the fastest-declining alleys, and the 14 that jumped from under 40 to 100 (rebuilt between ratings, even though their construction date was never updated).
- Does surface matter? Asphalt (`AC`) alleys average a PCI of 46; concrete (`PCC`) averages 74. Is the plan fixing asphalt alleys, or just the worst concrete ones?
- Address lookup: type an address, find the nearest alley segment from the centroid or the street names, show its rating and plan status. Streets centerlines give you the block.
- Is priority explained by condition alone? Try condition plus age (`construction_year`; 1900 means unknown) plus geography (north versus south of the tracks).

## No-code roles

- Walk it: pick five of the worst unscheduled alleys within a few blocks of the venue and photograph them. A photo of a PCI 5 alley next to the map is the whole presentation.
- Sanity check the outliers: alley 410-S went from 92 to 15 in one rating cycle. Data error or sinkhole? Someone who lives nearby can say.
- Read the Village's alley program page and the 2026 capital budget for how alleys get picked (special assessment? sewer coordination?) and explain the rule the data seems to follow.
- Own the story for the Transportation Commission: "these are the ten alleys residents will ask about."

## Claude tips

Paste the CSV header plus 50 rows and ask: "group by scheduled versus unscheduled and summarize pci_2024; list the 15 lowest unscheduled segments with their streets." Ask it to turn `alleys-oak-park.geojson` into a single-file Leaflet page colored by `pci_2024_band` with a toggle for scheduled segments. For the address lookup, ask for a function that finds the nearest centroid to a lat/lon and returns that row.
