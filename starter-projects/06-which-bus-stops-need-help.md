# Which bus stops need help?

**Civic question:** Which Oak Park bus stops should be prioritized for accessibility or shelter improvements?

**Minimum viable demo:**

- Identify Pace bus stops within Oak Park that do not have a shelter or recorded ADA accessibility.
- Map those stops alongside older-adult, disability, and no-vehicle demographic indicators.
- Produce a transparent prioritization score and a shortlist of candidate locations for further review.

**Stretch goals:**

- Add CTA and Metra stations and calculate approximate walking access.
- Include parks, schools, libraries, or other frequently visited destinations.
- Create an accessible, mobile-first interface for finding nearby transit options.

**Data:**

- [Modes of Transportation](https://www.arcgis.com/home/item.html?id=175b26ace9b74ae899803e3e34893570) (Pace stops layer 0, Metra layer 1, CTA stations layer 2 on the VOP MapServer)
- CTA GTFS `https://www.transitchicago.com/downloads/sch_data/google_transit.zip` (stops.txt has `wheelchair_boarding`); Pace GTFS from `https://www.pacebus.com/gtfs`
- Pace shelters `https://maps.pacebus.com/arcgis/rest/services/StrategicServices/Shelters_Posted_Stops/MapServer/0` and passenger counts `https://maps.pacebus.com/arcgis/rest/services/StrategicServices/APC/MapServer/0`
- CMAP transit rider vulnerability `https://services5.arcgis.com/LcMXE3TFhi1BSaCY/arcgis/rest/services/TRVI_Data_Data_Hub/FeatureServer` (layer 0 CTA stops, layer 1 Pace stops)
- [Social Vulnerability](https://www.arcgis.com/home/item.html?id=18fee8d54a4348e88775e74af99defd2), layer `https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/ClimateActionPlan_Service/FeatureServer/35`; low and moderate income block groups are Village layer 158
- [Municipal Boundary](https://www.arcgis.com/home/item.html?id=6c1807a7ef5d4d77a9fbb1801d9d36d1)
- Cached in this repo: `data/transit-stops-oak-park.csv` (CTA and Pace bus stops plus CTA and Metra stations with routes, weekday trip counts, `wheelchair_boarding`, `cmap_sheltered_2024`, `pace_shelter_2015`, Pace ridership `apc_total`, and `cmap_trvi`; 225 rows, `in_oak_park` = Y for the 147 inside the boundary)
- Cached in this repo: `data/social-vulnerability-oak-park.geojson` (the Village's Social Vulnerability Index for 53 block groups, scored 1 to 5 on `Senior_Index`, `Disability_Index`, `LackOfVehicle_Index`, and more, summed in `Composite_Index`)
- Cached in this repo: `data/schools-oak-park.csv` (school locations)

**Potential users:** Disability Access Commission, Aging in Communities Commission, Transportation Commission

**Difficulty:** Intermediate

**Readiness:** Ready now, data cached in this repo, but demographic data should be clearly dated

**No-code roles:** Field check the top 10 on Street View or on foot for bench, shelter, curb ramp, and lighting (the Village's fields for this are empty, so you are creating the data), and anyone who rides with a walker, a stroller, or a cane can define what "accessible" has to mean beyond the CTA flag.

**Limits:** The Village's bus stop layer is a 2019 snapshot whose shelter and ADA fields are empty on every stop, so shelter comes from CMAP and Pace, `wheelchair_boarding` is CTA only, and Pace passenger counts are present for 52 of the 87 Pace stops inside the Village. Senior buildings, clinics, and libraries have no Village layer and must be hand-typed.
