# Oak Park Civic Data Catalog

This catalog combines the Oak Park Open Data Portal inventory with additional county, federal, and regional sources previously used in civic-data projects. It is intended as a human-friendly starting point for Day in Our Data participants.

The list was merged on **August 25, 2026**. Links and source systems can change, so teams should verify critical fields and endpoints before relying on them in a finished project.

## At a glance

- **45 distinct resources** across **12 categories**
- Village portal maps, feature services, and downloads are consolidated into one row when they represent the same underlying resource
- One cross-list duplicate was merged: Josh's “Village of Oak Park GIS – layer 13” is the same ArcGIS layer as **Historic Districts**
- Josh's previously unnamed “layer 159” was identified from the ArcGIS metadata as **Census Tracts**

| Category | Resources |
| --- | ---: |
| Community Services | 4 |
| Demographics | 4 |
| Economic Indicators | 4 |
| Environment & Sustainability | 3 |
| Historic & Cultural | 4 |
| Infrastructure & Utilities | 4 |
| Maps & Imagery | 5 |
| Property & Assessment | 5 |
| Taxes & Levies | 3 |
| Transportation & Parking | 2 |
| Waste & Recycling | 3 |
| Zoning & Land Use | 4 |

## Data sources

| Category | Dataset | Provider | What it contains | Access |
| --- | --- | --- | --- | --- |
| Community Services | **Community Portal** | GIS Consortium | GIS Consortium community portal for property and local map information. | [Portal](https://apps.gisconsortium.org/CommunityPortal/Default.aspx?PL=VOP) |
| Community Services | **Library Districts** | GIS Consortium | Interactive map of library-district boundaries. | [Map](https://gisc.maps.arcgis.com/apps/webappviewer/index.html?id=e66eebc51edd434d9efeac0411df98c0) |
| Community Services | **Recreation Areas** | Village of Oak Park | Recreational-area polygons maintained by the Village GIS team. | [Portal](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/datasets/4e770e3fa181404eb6f919d22d9e484a) |
| Community Services | **School Districts** | GIS Consortium | Interactive map of school-district boundaries. | [Map](https://gisc.maps.arcgis.com/apps/webappviewer/index.html?id=f03057ff518949a792ab6cb2b82e4e60) |
| Demographics | **Census ACS – Median Household Income** | U.S. Census Bureau | B19013 for Oak Park (place 54885, state 17); swap year/dataset as needed | [API](https://api.census.gov/data/2023/acs/acs5?get=B19013_001E&for=place:54885&in=state:17) |
| Demographics | **Census Reporter API** | Census Reporter | Keyless ACS for Oak Park (GEOID 16000US1754885), e.g. year-built tables | [API](https://api.censusreporter.org/1.0/data/show/latest?geo_ids=16000US1754885&table_ids=B25034,B25035,B25036) |
| Demographics | **Census Tracts (Oak Park GIS layer 159)** | Village of Oak Park / GIS Consortium | Census-tract polygons exposed through the Village/GIS Consortium ArcGIS service. | [API](https://utility.arcgis.com/usrsvcs/servers/4cff1aaefa364b57b8c70d5c606f2088/rest/services/VOP/AGOL_VOP_Project/MapServer/159/query) |
| Demographics | **Social Vulnerability** | Village of Oak Park | Census-based social-vulnerability information presented as an interactive map. | [Interactive map](https://oakparkil.maps.arcgis.com/apps/instant/sidebar/index.html?appid=cbbe22efa92148649505d0aa2aa455ce) · [Portal item](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/maps/18fee8d54a4348e88775e74af99defd2) |
| Economic Indicators | **BLS CPI-U (CUUR0000SA0)** | U.S. Bureau of Labor Statistics | CPI-U all urban consumers, interactive table/download | [Data explorer](https://data.bls.gov/timeseries/CUUR0000SA0) |
| Economic Indicators | **BLS CPI-U historical table** | U.S. Bureau of Labor Statistics | Long-run annual CPI-U table (PDF) | [PDF](https://www.bls.gov/regions/midwest/data/consumerpriceindexhistorical_us_table.pdf) |
| Economic Indicators | **FRED – CPIAUCSL** | Federal Reserve Bank of St. Louis | Same CPI series, clean CSV/API access | [Data explorer](https://fred.stlouisfed.org/series/CPIAUCSL) |
| Economic Indicators | **SSA Average Wage Index** | Social Security Administration | AWI, used alongside CPI for wage-growth context | [Source](https://www.ssa.gov/oact/cola/AWI.html) |
| Environment & Sustainability | **Climate Ready Oak Park** | Village of Oak Park | Oak Park climate-action information and implementation resources. | [Website](https://www.sustainoakpark.com/oak-parks-climate-action) |
| Environment & Sustainability | **Existing Conditions and Vulnerability Assessment** | Village of Oak Park | StoryMap covering emissions, facilities, transportation, and climate vulnerabilities. | [StoryMap](https://storymaps.arcgis.com/stories/0e9409d4dc20452bbbee6fc35df0ff81) |
| Environment & Sustainability | **Oak Park Tree Inventory** | Village of Oak Park | Public tree inventory with species, age, height, health, location, and downloadable records. | [Interactive map](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/apps/2146b91d9d1e4c85b7afad06580e9d24) · [Feature service](https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/VOP_TreeInventory_PUBLICVIEW/FeatureServer/0) · [CSV](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/api/download/v1/items/792e798104b140c3b8063e86dc09d991/csv?layers=0) · [GeoJSON](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/api/download/v1/items/792e798104b140c3b8063e86dc09d991/geojson?layers=0) |
| Historic & Cultural | **Historic Building Dataset** | Village of Oak Park | Locations and attributes for designated historic homes and structures. | [Portal](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/datasets/5a02234ddbed497a809810430a61853a_0) · [Feature service](https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/OPHR_FGDB_V3_PUBLIC/FeatureServer/0) · [CSV](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/api/download/v1/items/5a02234ddbed497a809810430a61853a/csv?layers=0) · [GeoJSON](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/api/download/v1/items/5a02234ddbed497a809810430a61853a/geojson?layers=0) |
| Historic & Cultural | **Historic Districts** | Village of Oak Park | Historic-district polygons, designation details, and related descriptive attributes. | [Portal](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/datasets/d3ff666dfb764e8183879667acce810e_13) · [Feature service](https://utility.arcgis.com/usrsvcs/servers/4cff1aaefa364b57b8c70d5c606f2088/rest/services/VOP/AGOL_VOP_Project/MapServer/13) · [CSV](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/api/download/v1/items/d3ff666dfb764e8183879667acce810e/csv?layers=13) · [GeoJSON](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/api/download/v1/items/d3ff666dfb764e8183879667acce810e/geojson?layers=13) |
| Historic & Cultural | **Historic Landmarks** | Village of Oak Park | Historic landmark locations and related map data. | [Portal](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/apps/fcc8883f3d8241ebab8e210f26fb31ba) · [Map data](https://oakparkil.maps.arcgis.com/sharing/rest/content/items/8f80223efe0d477388fbf4204ddf1000/data) |
| Historic & Cultural | **Historic Survey Areas** | Village of Oak Park | Geographic areas covered by historic-resource surveys. | [Portal](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/datasets/315557a64ac84d45b71e55d94fd583ac_155) · [Feature service](https://utility.arcgis.com/usrsvcs/servers/4cff1aaefa364b57b8c70d5c606f2088/rest/services/VOP/AGOL_VOP_Project/MapServer/155) · [CSV](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/api/download/v1/items/315557a64ac84d45b71e55d94fd583ac/csv?layers=155) · [GeoJSON](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/api/download/v1/items/315557a64ac84d45b71e55d94fd583ac/geojson?layers=155) |
| Infrastructure & Utilities | **Capital Improvement Projects** | Village of Oak Park | Current and past public-works construction projects in the Village's capital program. | [Explorer](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/apps/56c706bcad1141e6875c38ec5e690a94) |
| Infrastructure & Utilities | **Street Centerlines and Polygons** | Village of Oak Park | Street centerlines and street polygons with live feature services and direct downloads. | [Portal](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/datasets/fb9d0b457b1d445e9a8b2a6cda3f4800) · [Feature service](https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/Streets_Centerlines/FeatureServer) · [Centerlines CSV](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/api/download/v1/items/095a733fbde4479980ee9a026728bc0b/csv?layers=0) · [Centerlines GeoJSON](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/api/download/v1/items/095a733fbde4479980ee9a026728bc0b/geojson?layers=0) · [Polygons CSV](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/api/download/v1/items/095a733fbde4479980ee9a026728bc0b/csv?layers=1) · [Polygons GeoJSON](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/api/download/v1/items/095a733fbde4479980ee9a026728bc0b/geojson?layers=1) |
| Infrastructure & Utilities | **Water and Sewer System Data** | Village of Oak Park | Downloadable water and sewer utility data provided in shapefile format. | [Portal](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/datasets/73850c036f97498782a59d330e834561) |
| Infrastructure & Utilities | **Water Service Inventory Dashboard** | Village of Oak Park | Dashboard for exploring the Village water-service inventory and service-line information. | [Dashboard](https://www.arcgis.com/apps/dashboards/97cfcb6247a24abc9baf9f227fb21f55) |
| Maps & Imagery | **Assessor – Neighborhood Boundaries** | Cook County Assessor | Assessor valuation-neighborhood polygons | [API](https://datacatalog.cookcountyil.gov/resource/pcdw-pxtg.json) |
| Maps & Imagery | **Cook County Address Points** | Cook County | Geocoded address points, query by PIN (e.g. ?pin=16184080040000) | [API](https://datacatalog.cookcountyil.gov/resource/78yw-iddh.json) |
| Maps & Imagery | **Cook County Parcel Polygons (2022)** | Cook County | Parcel shape geometries (ArcGIS query endpoint) | [API](https://gis.cookcountyil.gov/hosting/rest/services/Hosted/Parcel_2022/FeatureServer/0/query) |
| Maps & Imagery | **GIS Consortium 2024 Imagery** | GIS Consortium | Regional 2024 imagery exposed through an ArcGIS map service. | [Portal](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/maps/0a28e95784e9456ab6189bf13ef9d207) · [Map service](https://tiles.arcgis.com/tiles/uRp89l90TnovtJpf/arcgis/rest/services/GISC_IMAGERY_2024_Project/MapServer) |
| Maps & Imagery | **Oak Park 2024 Aerial Imagery** | Village of Oak Park / GIS Consortium | 2024 aerial imagery with a map service, component layers, and a downloadable tile package. | [Portal](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/maps/d88331b2bea849d6b2f1b9fd0a22576c) · [Map service](https://tiles.arcgis.com/tiles/aymthbPDQOcCnuwg/arcgis/rest/services/VOP_Imagery_2024SID/MapServer) · [Municipal polygon layer](https://tiles.arcgis.com/tiles/aymthbPDQOcCnuwg/arcgis/rest/services/VOP_Imagery_2024SID/MapServer/0) · [SID layer](https://tiles.arcgis.com/tiles/aymthbPDQOcCnuwg/arcgis/rest/services/VOP_Imagery_2024SID/MapServer/1) · [TPKX download](https://apps.gisconsortium.org/giscsharedstorage/VOP/VOP_Imagery_2024SID_TPKX.zip) |
| Property & Assessment | **Assessor – Assessed Values** | Cook County Assessor | Mailed/certified/BOR values per PIN & year. Oak Park filter: $where=township_name='Oak Park' AND year='2025' | [API](https://datacatalog.cookcountyil.gov/resource/uzyt-m557.json) |
| Property & Assessment | **Assessor – Improvement Characteristics** | Cook County Assessor | Building characteristics per PIN (class, sqft, age) | [API](https://datacatalog.cookcountyil.gov/resource/x54s-btds.json) |
| Property & Assessment | **Assessor – Parcel Addresses** | Cook County Assessor | PIN-to-address crosswalk. Oak Park filter: $where=prop_address_city_name='OAK PARK' | [API](https://datacatalog.cookcountyil.gov/resource/3723-97qp.json) |
| Property & Assessment | **Assessor – Parcel Sales** | Cook County Assessor | Recorded sales transactions by PIN | [API](https://datacatalog.cookcountyil.gov/resource/wvhk-k5uv.json) |
| Property & Assessment | **Assessor – Residential Characteristics (archive)** | Cook County Assessor | Older vintage; Oak Park = Town Code 27, one-line CSV pull | [CSV](https://datacatalog.cookcountyil.gov/resource/bcnq-qi2z.csv?Town%20Code=27&$limit=20000) |
| Taxes & Levies | **Cook County Clerk – report PDFs** | Cook County Clerk | Downloads the agency levy/extension PDFs | [Report PDFs](https://www.cookcountyclerkil.gov/api-tax/public/viewreport) |
| Taxes & Levies | **Cook County Clerk – Tax Extension API** | Cook County Clerk | Levy report metadata (JSON); Oak Park agency IDs incl. 020180000, 020180002, 020180004, 030920000 | [API](https://www.cookcountyclerkil.gov/api-tax/public/getreportdata) |
| Taxes & Levies | **PTAXSIM DB (CCAO)** | Cook County Assessor | SQLite database for simulating complete Cook County property-tax bills. | [Database files](https://ccao-data-public-us-east-1.s3.amazonaws.com/ptaxsim/) · [GitHub](https://github.com/ccao-data/ptaxsim) |
| Transportation & Parking | **Modes of Transportation** | Village of Oak Park | Bus stops, CTA and Metra stations, and electric-vehicle charging locations. | [Interactive map](https://oakparkil.maps.arcgis.com/apps/instant/basic/index.html?appid=2af5b9a26234457d920a2e9d44a72bf2) |
| Transportation & Parking | **Overnight Parking Map** | Village of Oak Park | Village overnight-parking restrictions and map resources. | [Download map](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/apps/7bc8c913ecb5419ba0b6dca5a0f0a7dd) · [Map document](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/documents/f9735ab3100c45de87045b2f95a4ea11) |
| Waste & Recycling | **Garbage Collection Areas** | GIS Consortium | Interactive map of garbage collection areas. | [Map](https://gisc.maps.arcgis.com/apps/webappviewer/index.html?id=b493ae623dbb42d585f5543d6b11df52) |
| Waste & Recycling | **Recycling Collection Areas** | GIS Consortium | Interactive map of recycling collection areas. | [Map](https://gisc.maps.arcgis.com/apps/webappviewer/index.html?id=183d0526e72143639e85d44687fd5951) |
| Waste & Recycling | **Yard Waste Collection Areas** | GIS Consortium | Interactive map of yard-waste collection areas. | [Map](https://gisc.maps.arcgis.com/apps/webappviewer/index.html?id=6a71a6df9b3141f9826bbb115c76c179) |
| Zoning & Land Use | **Building Footprints** | Village of Oak Park | Building-footprint polygons for Oak Park. | [Portal](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/datasets/ec018598714f497581ed750267d4797b) |
| Zoning & Land Use | **Jurisdictional Boundaries** | GIS Consortium | Interactive map of local jurisdictional boundaries. | [Map](https://gisc.maps.arcgis.com/apps/webappviewer/index.html?id=26ac0a2e515746048d38077de039ae12) |
| Zoning & Land Use | **Municipal Boundary** | Village of Oak Park | The legal municipal boundary polygon for Oak Park. | [Portal](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/datasets/6c1807a7ef5d4d77a9fbb1801d9d36d1_0) · [Feature service](https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/Municipal_Boundary/FeatureServer/0) · [CSV](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/api/download/v1/items/6c1807a7ef5d4d77a9fbb1801d9d36d1/csv?layers=0) · [GeoJSON](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/api/download/v1/items/6c1807a7ef5d4d77a9fbb1801d9d36d1/geojson?layers=0) |
| Zoning & Land Use | **Zoning Districts and Maps** | Village of Oak Park | Interactive zoning districts plus downloadable and printable zoning-map resources. | [Interactive map](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/apps/7669c037b54b41b4938ce0da4e582495) · [Map data](https://oakparkil.maps.arcgis.com/sharing/rest/content/items/048ab19b32b94fbfabe90ce04f54adde/data) · [Print map](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/documents/048ab19b32b94fbfabe90ce04f54adde) |

## Working with the data

- **Portal, map, dashboard, and explorer links** are best for browsing and understanding a resource.
- **CSV links** are usually the easiest starting point for Python/Pandas, R, spreadsheets, and visualization tools.
- **GeoJSON links** work well with Leaflet, Mapbox, QGIS, and Python geospatial libraries.
- **Feature-service and API links** support programmatic filters, attribute queries, spatial searches, and pagination.
- **PDFs and archived datasets** may require manual extraction or extra validation before use.

Common ArcGIS REST patterns:

```text
?f=json
/query?where=1=1&outFields=*&f=geojson
/query?where=FIELD_NAME=VALUE&f=json
&resultRecordCount=10
```

## Scope and provenance

- Village entries originated in the Oak Park Open Data Portal catalog compiled for the hackathon.
- Additional sources were contributed from prior civic-data and property-data projects.
- Technical sublayers and alternate download formats are represented as multiple links within a single resource row instead of duplicate rows.
- Source descriptions were shortened for readability; the linked systems remain authoritative.
- See [project-ideas.md](../project-ideas.md) for challenge prompts that can use these resources.
