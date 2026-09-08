# Which bus stops need help?

**The question:** Which of Oak Park's bus stops and train stations should be first in line for a shelter, a bench, or an accessibility fix, given who rides there and who lives nearby?

**Builds on:** project idea 2, [Accessible Transit and Bus Stop Gaps](../project-ideas.md#2-accessible-transit-and-bus-stop-gaps).

**Why it matters:** 141 bus stops sit inside the Village and 14 of them have a shelter. Four of the five CTA stations in Oak Park (Oak Park and Austin on the Blue Line, Oak Park and Ridgeland on the Green Line) have no wheelchair boarding in CTA's own schedule feed; Harlem/Lake is the exception. The Village's bus stop layer is a 2019 snapshot whose shelter and ADA fields are empty on every stop, so a ranked list is something the Disability Access, Aging in Communities, and Transportation Commissions do not have today.

## The data

- Every stop, one row each: `data/transit-stops-oak-park.csv`, 225 rows, CTA and Pace bus stops plus CTA and Metra stations in and just across the Village line (`in_oak_park` = Y for the 147 inside the boundary). Columns: routes and weekday trip counts from the agencies' schedules, `wheelchair_boarding` (CTA only), shelter from two sources (`cmap_sheltered_2024` for every stop, `pace_shelter_2015` for Pace), Pace ridership `apc_ons`, `apc_offs`, `apc_total` (Spring 2026 passenger counts, present for 52 of the 87 Pace stops inside the Village), and CMAP's transit rider vulnerability score `cmap_trvi` with its category.
  Live: CTA GTFS `https://www.transitchicago.com/downloads/sch_data/google_transit.zip` (stops.txt has `wheelchair_boarding`); Pace GTFS from `https://www.pacebus.com/gtfs`; Pace shelters and passenger counts on Pace's GIS server, `https://maps.pacebus.com/arcgis/rest/services/StrategicServices/Shelters_Posted_Stops/MapServer/0` and `https://maps.pacebus.com/arcgis/rest/services/StrategicServices/APC/MapServer/0`; CMAP's transit rider vulnerability layer `https://services5.arcgis.com/LcMXE3TFhi1BSaCY/arcgis/rest/services/TRVI_Data_Data_Hub/FeatureServer` (layer 0 CTA stops, layer 1 Pace stops); the Village's Modes of Transportation map `https://www.arcgis.com/home/item.html?id=175b26ace9b74ae899803e3e34893570` (Pace stops layer 0, Metra layer 1, CTA stations layer 2 on the VOP MapServer).
- Who lives nearby: `data/social-vulnerability-oak-park.geojson`, the Village's Social Vulnerability Index for 53 block groups, each scored 1 to 5 on `Senior_Index`, `Disability_Index`, `LackOfVehicle_Index`, `HousholdsInPoverty_Index` and ten more, summed in `Composite_Index` (23 to 56). Live: `https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/ClimateActionPlan_Service/FeatureServer/35`, the layer behind the Village's [Social Vulnerability map](https://www.arcgis.com/home/item.html?id=18fee8d54a4348e88775e74af99defd2). Low and moderate income block groups are Village layer 158 if you want a second cut.
- Destinations: `data/schools-oak-park.csv` is cached. Senior buildings (the Housing Authority's The Oaks and Heritage House, Mills Park Tower), the clinics, and the libraries are a short hand-typed list with addresses; there is no Village layer for them.

## First win (15 minutes)

Open the CSV, filter `in_oak_park` = Y and `stop_type` = bus_stop, and count `cmap_sheltered_2024`: 14 sheltered, 126 not. Then filter `stop_type` = rail_station and read `wheelchair_boarding` (1 = accessible, 2 = not). Those two counts are the opening slide.

## The build (by 2:15)

A map of stops colored by a need score you define in the open: points for no shelter, for riders (`apc_total`), for the vulnerability of the surrounding area (`cmap_trvi` is already on each row, or join each stop to the block group polygon it falls in and use `Senior_Index` and `LackOfVehicle_Index`), and for being within two blocks of senior housing, a clinic, or a school. A top-10 table that shows every ingredient of the score next to the total is the demo; a Leaflet page or Google MyMaps with circles sized by ridership and colored by shelter is the visual.

## Stretch

Coverage gaps: draw a 400-meter circle (about a 5-minute walk) around every stop and find the block groups with a high senior or no-vehicle index that fall outside all of them. Or map what changed: the Village's 2019 layer has 227 Pace stops in the same box against 130 in today's schedule, including the discontinued route 320 on Madison; show which blocks lost their stop. Or build the mobile page the idea asks for: nearest accessible stop and station from where I am standing.

## No-code roles

- Field check the top 10 on Street View, or on foot: bench, shelter, curb ramp, lighting, a place to wait out of the wind. The Village's fields for this are empty; you are creating the data.
- Anyone who rides with a walker, a stroller, or a cane: define what "accessible" has to mean beyond the CTA flag.
- Demo owner: "this stop, this many riders a day, no shelter, next door to this building."

## Claude tips

Paste 30 rows and ask: "score each stop 0 to 10: 4 points if unsheltered, up to 3 for apc_total scaled to the busiest stop, up to 3 for cmap_trvi; show the formula and the top ten." Ask for a Leaflet page from the CSV with circles sized by `apc_total` and colored by `cmap_sheltered_2024`. Ask it to write the point-in-polygon join of the stops to `social-vulnerability-oak-park.geojson` in plain Python, no libraries.
