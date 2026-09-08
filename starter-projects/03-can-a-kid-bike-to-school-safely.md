# Can a kid bike to school safely?

**The question:** How well do Oak Park's bike facilities connect kids' homes to their schools, and what do crash records say about the gaps?

**Builds on:** project idea 12, [Vision Zero Coverage Gap Finder](../project-ideas.md#12-vision-zero-coverage-gap-finder), narrowed to school routes.

**Why it matters:** Hundreds of Oak Park kids bike or walk to school daily. Whether the network actually serves those trips is checkable with public data.

## The data

- Bike facilities: the Village's Oak Park Bikeways (July 2025) layer, 85 segments with short-, mid-, and long-term phasing flags. GeoJSON:
  `https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/Oak_Park_Bikeways_July_2025/FeatureServer/0/query?where=1%3D1&outFields=*&outSR=4326&f=geojson`
  Confirm with the Village which segments are built versus planned; the layer has no built/planned field. Planned work is also in Village GIS layers 38 (Bike Boulevard Projects) and 161 (Bike Improvements).
- Crashes, Village: every crash reported to Oak Park Police since January 2024, about 1,700 a year, with street or intersection, lat/lon, severity, injuries, a pedestrian/bicyclist mode field, causes, and hit-and-run. Fresh through last month. Cached: `data/crashes-village-oak-park.csv` (4,640 rows, Jan 2024 to Aug 2026). Live: the Village Traffic Crash dashboard `https://opendata.oak-park.us/TrafficCrash/` (Power BI, no export button; the cached file was pulled with `data/scripts/fetch_crashes_village.py`).
- Crashes, IDOT: the state's crash points for Oak Park 2019 to 2025 (about 1,100 to 1,550 a year, only crashes above the state reporting threshold, but it includes I-290) plus a bike and pedestrian subset (243 records, 2020 to 2024). Cached: `data/crashes-oak-park.csv` and `data/crashes-bike-ped-oak-park.csv`. Live: `https://gis-idot.opendata.arcgis.com/` (query URLs in the catalog). Use the Village file for recent years and the IDOT file for the longer trend.
- Schools: `data/schools-oak-park.csv`, built from the Village's D97 school footprints, with OPRF and private schools added by hand. D97 attendance zones: `https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/Elementary_Attendance_Zones/FeatureServer/0`
- Safe Routes to School and traffic calming, also Village layers: `SafeRoutesWebMapLayer_gdb`, `SafeRoutesToSchoolCrowdSourcing` (resident-reported hazards), `Oak_Park_Traffic_Calming_Features`, and `Proposed_Neighborhood_Greenways`, all under `https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/`. Append `/0/query?where=1%3D1&outFields=*&f=geojson`.

## First win (15 minutes)

Print-map exercise: mark the schools, trace the existing bike routes, circle where a reasonable school route leaves the network.

## The build (by 2:15)

A map (Leaflet, Google MyMaps, or even annotated images) showing bike facilities, schools, and the gaps between them. Overlay bike/pedestrian-involved crashes to show whether the gaps and the crashes coincide.

## Stretch

Score each school 1–10 on network connection; rank the intersections nearest schools by crash count; propose the single highest-value missing link.

## No-code roles

- Local knowledge is the core skill here: parents and students know which crossings are actually scary
- Google MyMaps needs no code at all and produces a shareable demo
- Storyteller: "the route from X to Julian breaks down at Y" beats any heat map

## Claude tips

Ask Claude to convert a GeoJSON layer into a simple Leaflet page, or paste crash rows and ask "which intersections within 2 blocks of a school appear most often?"
