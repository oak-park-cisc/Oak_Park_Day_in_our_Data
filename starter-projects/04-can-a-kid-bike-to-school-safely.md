# Can a kid bike to school safely?

**Civic question:** How well do Oak Park's bike facilities connect kids' homes to their schools, and what do crash records say about the gaps?

**Minimum viable demo:**

- Map bike facilities, schools, and the gaps between them.
- Overlay crashes by severity and type with traffic-calming work, bicycle improvements, schools, and capital projects, and show whether the gaps and the crashes coincide.

**Stretch goals:**

- Score each school 1 to 10 on network connection.
- Rank the intersections nearest schools by crash count.
- Propose the single highest-value missing link.

**Data:**

- Oak Park Bikeways (July 2025), 85 segments with short-, mid-, and long-term phasing flags: `https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/Oak_Park_Bikeways_July_2025/FeatureServer/0/query?where=1%3D1&outFields=*&outSR=4326&f=geojson`; planned work is also in Village GIS layers 38 (Bike Boulevard Projects) and 161 (Bike Improvements)
- [Village Traffic Crash dashboard](https://opendata.oak-park.us/TrafficCrash/) (Power BI, no export button; the cached file was pulled with `data/scripts/fetch_crashes_village.py`)
- [IDOT crash data](https://gis-idot.opendata.arcgis.com/) (query URLs in the catalog)
- D97 attendance zones: `https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/Elementary_Attendance_Zones/FeatureServer/0`
- Safe Routes to School and traffic calming: `SafeRoutesWebMapLayer_gdb`, `SafeRoutesToSchoolCrowdSourcing` (resident-reported hazards), `Oak_Park_Traffic_Calming_Features`, and `Proposed_Neighborhood_Greenways`, all under `https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/`; append `/0/query?where=1%3D1&outFields=*&f=geojson`
- Cached in this repo: `data/crashes-village-oak-park.csv` (every crash reported to Oak Park Police, with lat/lon, severity, injuries, a pedestrian/bicyclist mode field, causes, and hit-and-run; 4,640 rows, Jan 2024 to Aug 2026)
- Cached in this repo: `data/crashes-oak-park.csv` (IDOT crash points for Oak Park 2019 to 2025, about 1,100 to 1,550 a year)
- Cached in this repo: `data/crashes-bike-ped-oak-park.csv` (IDOT bike and pedestrian subset, 243 records, 2020 to 2024)
- Cached in this repo: `data/schools-oak-park.csv` (the Village's D97 school footprints, with OPRF and private schools added by hand)

**Potential users:** Transportation Commission, Public Works, Vision Zero team

**Difficulty:** Advanced

**Readiness:** Ready now, data cached in this repo

**No-code roles:** Parents and students know which crossings are actually scary, Google MyMaps needs no code and produces a shareable demo, and a storyteller who can say where the route to a school breaks down beats any heat map.

**Limits:** The bikeways layer has no built/planned field, so confirm with the Village which segments are built. IDOT records only crashes above the state reporting threshold but include I-290; use the Village file for recent years and the IDOT file for the longer trend.
