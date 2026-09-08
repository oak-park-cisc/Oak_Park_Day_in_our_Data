# Oak Park Civic Data Catalog

This catalog is the starting point for Day in Our Data participants: Village of Oak Park, Cook County, State of Illinois, federal, and regional data sources, grouped by topic, with links and notes on format. Cached extracts of the datasets the starter projects use are in this folder; see the [data README](README.md).

Links checked September 2026. Sources change, so verify endpoints before building on them.

## At a glance

- **83 distinct resources** across **17 categories**
- Village portal maps, feature services, and downloads are consolidated into one row when they represent the same underlying resource
- Oak Park filters for county, state, and federal sources are collected once in [Filtering to Oak Park](#filtering-to-oak-park) rather than repeated row by row
- Hosts that block scripted clients but open normally in a browser (oak-park.us, bls.gov, ssa.gov, Hub `apps/` pages) are noted in the row

| Category | Resources |
| --- | ---: |
| Budget & Finance | 2 |
| Community Services | 4 |
| Demographics | 8 |
| Economic Indicators | 3 |
| Environment & Sustainability | 3 |
| Government & Meetings | 3 |
| Historic & Cultural | 4 |
| Infrastructure & Utilities | 5 |
| Maps & Imagery | 2 |
| Portals | 3 |
| Property & Assessment | 11 |
| Public Safety | 5 |
| Schools & Education | 4 |
| Taxes & Levies | 2 |
| Transportation & Parking | 12 |
| Waste & Recycling | 3 |
| Zoning & Land Use | 9 |

## Budget & Finance

Village-published budget and audit documents; both are PDFs that need transcription or OCR before analysis.

| Dataset | Provider | What it contains | Access |
| --- | --- | --- | --- |
| **Adopted Budget Books (FY2002-FY2026)** | Village of Oak Park | Adopted budget PDFs for each fiscal year with revenue and expenditure by fund and department; the Village's own books contain occasional arithmetic errors, so cross-check totals. oak-park.us returns 403 to scripts but opens in a browser. | [Budget summaries index](https://www.oak-park.us/Government/Finance-and-Budget/Budget-Summaries) · [FY2025 budget book (PDF)](https://www.oak-park.us/files/assets/oakpark/v/2/finance/budgets/oak-park-village-fy2025-adopted-budget-book-with-page-numbers_final.pdf) |
| **Annual Comprehensive Financial Reports (FY2002-FY2024)** | Village of Oak Park | Audited ACFRs with actual revenues, expenditures, fund balances, and debt, one PDF per year linked from the index page. Browser only (403 to scripts). | [Financial reports index](https://www.oak-park.us/Government/Finance-and-Budget/Financial-Reports) |

## Community Services

Browse-oriented maps of service areas and community facilities; most have no download or API.

| Dataset | Provider | What it contains | Access |
| --- | --- | --- | --- |
| **Community Portal** | GIS Consortium | GIS Consortium community portal for property and local map information. Browse-only; no download or API. | [Portal](https://apps.gisconsortium.org/CommunityPortal/Default.aspx?PL=VOP) |
| **Library Districts** | GIS Consortium | Interactive map of library-district boundaries (Oak Park has a single library district). Browse-only. | [Map](https://gisc.maps.arcgis.com/apps/webappviewer/index.html?id=e66eebc51edd434d9efeac0411df98c0) |
| **Recreation Areas** | Village of Oak Park | Recreational-area polygons maintained by the Village GIS team. Download via the portal page's Download menu; no direct feature service is published. | [Portal](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/datasets/4e770e3fa181404eb6f919d22d9e484a) |
| **ECHO Activity Dashboard (Power BI)** | Village of Oak Park, Neighborhood Services | Services logged by the E.C.H.O. (Engaging Community for Healthy Outcomes) non-police response program since February 2025: count by month, service category (unhoused, behavioral health, senior, housing, youth/family, domestic violence, and others), referral source (police, fire, resident, and others), referral weekday and hour block. No location or personal fields. Aggregates only are cached as `echo-activity-oak-park.csv`; the dashboard's "Dataset" button also offers a row-level xlsx (timestamp, service, referral source) that this repo deliberately does not cache. | [Village page](https://opendata.oak-park.us/EchoActivity) · [Power BI report](https://app.powerbigov.us/view?r=eyJrIjoiODRlMzY0MjUtMTA0Yi00YzRkLTk0YjAtNjg4YmFlM2E1YTE3IiwidCI6IjZjOGIyOTRlLTVmZjUtNDJiMi1hM2Q3LWMzYmQ3MGE3OWYyNSJ9) · [Program page](https://www.oak-park.us/Community/Community-Services/E.C.H.O-Engaging-Community-for-Healthy-Outcomes) (`data/scripts/fetch_echo_activity.py` replays the report's grouped queries) |

## Demographics

Census Bureau, Census Reporter, and Village-hosted population and housing statistics for Oak Park, its tracts, and its block groups.

| Dataset | Provider | What it contains | Access |
| --- | --- | --- | --- |
| **Census ACS 5-year estimates (API)** | U.S. Census Bureau | Every American Community Survey table for Oak Park as a whole (place 54885) or its tracts and block groups: population, age, race, income (B19013 median household income), poverty, housing value and rent (B25077, B25064), year built, tenure, commute, and more, with margins of error. One endpoint per release year from 2009 onward, so it supports time series. Requires a free API key; keyless alternative in the next row. Oak Park: see Filtering (Census). | [API](https://api.census.gov/data/2023/acs/acs5?get=B19013_001E&for=place:54885&in=state:17) · [Key signup](https://api.census.gov/data/key_signup.html) |
| **Census Reporter API** | Census Reporter | The same ACS tables as the Census API (income, housing, year built B25034-B25036, and the rest) for Oak Park, its tracts, and its block groups, without an API key, but only the latest 5-year release (`acs2024_5yr` as of September 2026), so no time series. Oak Park geographies and access notes: see Filtering (Census). | [Oak Park profile](https://censusreporter.org/profiles/16000US1754885-oak-park-il/) · [API](https://api.censusreporter.org/1.0/data/show/latest?geo_ids=16000US1754885&table_ids=B25034,B25035,B25036) |
| **Census Tracts (Oak Park GIS layer 159)** | Village of Oak Park / GIS Consortium | The Village's copy of TIGER census-tract polygons; fields `GEOID`, `TRACTCE`, `NAME`, `ALAND`. The bare `/query` URL returns 403; parameters are required. | [Live map](https://www.arcgis.com/apps/mapviewer/index.html?url=https://utility.arcgis.com/usrsvcs/servers/4cff1aaefa364b57b8c70d5c606f2088/rest/services/VOP/AGOL_VOP_Project/MapServer/159) · [GeoJSON query](https://utility.arcgis.com/usrsvcs/servers/4cff1aaefa364b57b8c70d5c606f2088/rest/services/VOP/AGOL_VOP_Project/MapServer/159/query?where=1=1&outFields=*&f=geojson&returnGeometry=true) |
| **Social Vulnerability** | Village of Oak Park | Census-based social-vulnerability index presented as an interactive map. The data lives in the `ClimateActionPlan_Service` feature service (53 layers including SVI, poverty, rent burden, tree canopy, and aggregated traffic collisions 2017-2019); layer 35 is the Social Vulnerability Index. | [Interactive map](https://oakparkil.maps.arcgis.com/apps/instant/sidebar/index.html?appid=cbbe22efa92148649505d0aa2aa455ce) · [Portal item](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/maps/18fee8d54a4348e88775e74af99defd2) · [Feature service](https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/ClimateActionPlan_Service/FeatureServer) · [SVI block-group feature service (layer 35)](https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/ClimateActionPlan_Service/FeatureServer/35) |
| **Village-hosted Census summaries** | Village of Oak Park | Ready-made time series: tract-level ACS 2014-2019 (70+ indicator layers), 2020 ACS 5-year summary, median household income and median age 2010-2024, racial demographics 1980-2000, and commute totals. Field names not yet inspected. | [Tract ACS 2014-2019](https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/Tract_Data_2014_2019_ACS_5_Year_Estimates/FeatureServer) · [2020 ACS summary](https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/2020_ACS_5_Year_Sum/FeatureServer) · [Median HHI and age 2010-2024](https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/CensusMedianHHI_MedianAge_2010_2024_gdb/FeatureServer/0) · [Demographic change 1980-2000](https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/CensusDemographicChange_1980_2000_gdb/FeatureServer/0) · [Historical Census viewer](https://experience.arcgis.com/experience/b3b935446dde4c0c95c8927c2171de08) |
| **2020 Census TIGER/Line shapefiles (Illinois)** | U.S. Census Bureau | Statewide block, block-group, and place boundary shapefiles for 2020; clip to Oak Park with the place GEOID (see Filtering (Census)). The blocks zip is about 306 MB. | [Blocks](https://www2.census.gov/geo/tiger/TIGER2020/TABBLOCK20/tl_2020_17_tabblock20.zip) · [Block groups](https://www2.census.gov/geo/tiger/TIGER2020/BG/tl_2020_17_bg.zip) · [Places](https://www2.census.gov/geo/tiger/TIGER2020/PLACE/tl_2020_17_place.zip) |
| **2020 Census P.L. 94-171 Redistricting File (Illinois)** | U.S. Census Bureau | Block-level population by race and ethnicity (P1-P4) and housing units (H1) for all of Illinois, as pipe-delimited segment files with a fixed column layout. Block-level race counts carry differential-privacy noise. | [Zip download](https://www2.census.gov/programs-surveys/decennial/2020/data/01-Redistricting_File--PL_94-171/Illinois/il2020.pl.zip) |
| **IHDA Affordable Housing Planning and Appeal Act (AHPAA) lists** | Illinois Housing Development Authority | Per-municipality affordable-unit counts and shares by determination year (Oak Park: 3,991 units in 2013, 5,341 in 2023), published as PDF and Excel lists. | [AHPAA page](https://www.ihda.org/about-ihda/ahpaa/) |

## Economic Indicators

National inflation and wage indexes for adjusting local dollar figures over time.

| Dataset | Provider | What it contains | Access |
| --- | --- | --- | --- |
| **CPI-U (FRED CPIAUCSL / BLS CUUR0000SA0)** | Federal Reserve Bank of St. Louis; U.S. Bureau of Labor Statistics | Monthly CPI-U for all urban consumers (1982-84 = 100) from January 1947 to the current month, the standard index for restating dollar figures in today's dollars; FRED also serves annual averages, and the BLS series is the same index. A cached annual table with multipliers to 2025 dollars is in this folder (`cpi-annual.csv`). Access notes: see Working with the data. | [CSV](https://fred.stlouisfed.org/graph/fredgraph.csv?id=CPIAUCSL) · [Annual average CSV](https://fred.stlouisfed.org/graph/fredgraph.csv?id=CPIAUCSL&fq=Annual&fam=avg) · [FRED series page](https://fred.stlouisfed.org/series/CPIAUCSL) · [BLS series](https://data.bls.gov/timeseries/CUUR0000SA0) · [BLS API](https://api.bls.gov/publicAPI/v2/timeseries/data/CUUR0000SA0) |
| **SSA Average Wage Index** | Social Security Administration | AWI, used alongside CPI for wage-growth context. HTML table; copy/paste or fetch with a browser User-Agent (ssa.gov returns 403 to scripts). | [Source](https://www.ssa.gov/oact/cola/AWI.html) |
| **Oak Park Business License Dashboard (Power BI)** | Village of Oak Park | Every business license in CityView, 2,519 records (1,426 active), with start and end dates, category and subcategory, license classes, home-based/liquor/mobile flags, business district, address, zoning, and lat/lon for storefronts; closings recorded from 2015. Refreshed nightly. No export button; cached as `business-licenses-oak-park.csv`, built by `data/scripts/fetch_business_licenses.py`. | [Village page](https://opendata.oak-park.us/BusinessLicense/) · [Power BI report](https://app.powerbigov.us/view?r=eyJrIjoiZmNjOWJlNGEtYjE2NS00YjYzLWEwNzQtMWFlYzFjNTA5MjI1IiwidCI6IjZjOGIyOTRlLTVmZjUtNDJiMi1hM2Q3LWMzYmQ3MGE3OWYyNSJ9) |

## Environment & Sustainability

Climate-action plans, vulnerability layers, and the public tree inventory.

| Dataset | Provider | What it contains | Access |
| --- | --- | --- | --- |
| **Climate Ready Oak Park** | Village of Oak Park | Oak Park climate-action information and implementation resources. | [Website](https://www.sustainoakpark.com/oak-parks-climate-action) |
| **Existing Conditions and Vulnerability Assessment** | Village of Oak Park | StoryMap covering emissions, facilities, transportation, and climate vulnerabilities. The underlying layers are the same `ClimateActionPlan_Service` feature service listed under Social Vulnerability. | [StoryMap](https://storymaps.arcgis.com/stories/0e9409d4dc20452bbbee6fc35df0ff81) · [Feature service](https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/ClimateActionPlan_Service/FeatureServer) |
| **Oak Park Tree Inventory** | Village of Oak Park | Public tree inventory with species, age, height, health, location, and downloadable records. The Hub app page returns 403 to scripts; the CSV and GeoJSON links redirect to cached files. | [Interactive map](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/apps/2146b91d9d1e4c85b7afad06580e9d24) · [Feature service](https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/VOP_TreeInventory_PUBLICVIEW/FeatureServer/0) · [CSV](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/api/download/v1/items/792e798104b140c3b8063e86dc09d991/csv?layers=0) · [GeoJSON](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/api/download/v1/items/792e798104b140c3b8063e86dc09d991/geojson?layers=0) |

## Government & Meetings

Where Village Board and commission agendas, minutes, packets, and recordings live.

| Dataset | Provider | What it contains | Access |
| --- | --- | --- | --- |
| **Village Board and commission meetings (Legistar)** | Village of Oak Park | Meeting calendar, agendas, minutes, and packets for the Board and its commissions; meeting detail pages follow `MeetingDetail.aspx?ID=...&GUID=...`. The calendar is Telerik RadGrid HTML, so plan on a browser or LLM-assisted extraction; IDs and GUIDs change. | [Calendar](https://oak-park.legistar.com/Calendar.aspx) |
| **Granicus meeting video archive** | Village of Oak Park / Granicus | Video recordings of Village Board and other public-body meetings, each with agenda-item chapter markers, a per-clip JSON agenda index, and an MP4 download. URL patterns: see Working with the data. | [Archive](https://oak-park.granicus.com/ViewPublisher.php?view_id=2) · [RSS](https://oak-park.granicus.com/ViewPublisherRSS.php?view_id=2&mode=vpodcast) · [Agenda JSON (example)](https://oak-park.granicus.com/JSON.php?clip_id=CLIP_ID) |
| **Village citizen boards and commissions pages** | Village of Oak Park | Descriptions, meeting schedules, and membership for the Village's 18 citizen commissions, one page per body at `Citizen-Boards-and-Commissions/NAME`. oak-park.us returns 403 to scripts but opens in a browser. | [Plan Commission](https://www.oak-park.us/Government/Citizen-Boards-and-Commissions/Plan-Commission) · [Transportation Commission](https://www.oak-park.us/Government/Citizen-Boards-and-Commissions/Transportation-Commission) · [Civic Information Systems](https://www.oak-park.us/Government/Citizen-Boards-and-Commissions/Civic-Information-Systems) |

## Historic & Cultural

Designated historic buildings, districts, landmarks, and survey areas.

| Dataset | Provider | What it contains | Access |
| --- | --- | --- | --- |
| **Historic Building Dataset** | Village of Oak Park | Locations and attributes for designated historic homes and structures, including the landmark points. | [Portal](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/datasets/5a02234ddbed497a809810430a61853a_0) · [Feature service](https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/OPHR_FGDB_V3_PUBLIC/FeatureServer/0) · [CSV](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/api/download/v1/items/5a02234ddbed497a809810430a61853a/csv?layers=0) · [GeoJSON](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/api/download/v1/items/5a02234ddbed497a809810430a61853a/geojson?layers=0) |
| **Historic Districts** | Village of Oak Park | Historic-district polygons (`NAME` values Frank Lloyd Wright, Ridgeland - Oak Park, Gunderson) with `TYPE` and designation details. The Hub CSV/GeoJSON links may return 202 while an export job runs; retry after a few seconds, or use the MapServer query. | [Portal](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/datasets/d3ff666dfb764e8183879667acce810e_13) · [GeoJSON query](https://utility.arcgis.com/usrsvcs/servers/4cff1aaefa364b57b8c70d5c606f2088/rest/services/VOP/AGOL_VOP_Project/MapServer/13/query?where=1=1&outFields=NAME,TYPE&f=geojson&returnGeometry=true) · [CSV](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/api/download/v1/items/d3ff666dfb764e8183879667acce810e/csv?layers=13) · [GeoJSON](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/api/download/v1/items/d3ff666dfb764e8183879667acce810e/geojson?layers=13) |
| **Historic Landmarks** | Village of Oak Park | Historic landmark locations as an app and a 2023 printable PDF map; machine-readable landmark points are in the Historic Building Dataset feature service above. | [Portal app](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/apps/fcc8883f3d8241ebab8e210f26fb31ba) · [PDF map (2023)](https://oakparkil.maps.arcgis.com/sharing/rest/content/items/8f80223efe0d477388fbf4204ddf1000/data) |
| **Historic Survey Areas** | Village of Oak Park | Geographic areas covered by historic-resource surveys. | [Portal](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/datasets/315557a64ac84d45b71e55d94fd583ac_155) · [Feature service](https://utility.arcgis.com/usrsvcs/servers/4cff1aaefa364b57b8c70d5c606f2088/rest/services/VOP/AGOL_VOP_Project/MapServer/155) · [CSV](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/api/download/v1/items/315557a64ac84d45b71e55d94fd583ac/csv?layers=155) · [GeoJSON](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/api/download/v1/items/315557a64ac84d45b71e55d94fd583ac/geojson?layers=155) |

## Infrastructure & Utilities

Streets, capital projects, and water and sewer assets.

| Dataset | Provider | What it contains | Access |
| --- | --- | --- | --- |
| **Alley Condition Ratings and Reconstruction Priorities** | Village of Oak Park | Every alley segment with its 2022-2023 and 2024 Pavement Condition Index, surface, dimensions, and construction date, plus the 2025 to 2029 alley reconstruction plan as a second layer. Cached, joined to the 2026 capital program, as `alleys-oak-park.csv` and `.geojson`. | [Web map](https://www.arcgis.com/home/item.html?id=8b9855b623b64b65bd71a5269a287b77) · [Conditions layer 157](https://utility.arcgis.com/usrsvcs/servers/4cff1aaefa364b57b8c70d5c606f2088/rest/services/VOP/AGOL_VOP_Project/MapServer/157) · [Reconstruction plan layer 164](https://utility.arcgis.com/usrsvcs/servers/4cff1aaefa364b57b8c70d5c606f2088/rest/services/VOP/AGOL_VOP_Project/MapServer/164) |
| **Capital Improvement Projects** | Village of Oak Park | Current and past public-works construction projects in the Village's capital program. The Experience app is browser-only; the `2026_CIP_` feature service has layers for resurfacing, RRFBs, water and sewer, EV charging, streetscape, alley improvements, and sewer lining. | [Explorer](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/apps/56c706bcad1141e6875c38ec5e690a94) · [Feature service](https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/2026_CIP_/FeatureServer) |
| **Street Centerlines and Polygons** | Village of Oak Park | Street centerlines (field `STREETNAME`) and street polygons with live feature services and direct downloads. Some blocks are digitized twice (duplicate features up to about 20 m apart); dedupe by endpoints. | [Portal](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/datasets/fb9d0b457b1d445e9a8b2a6cda3f4800) · [Feature service](https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/Streets_Centerlines/FeatureServer) · [Centerlines CSV](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/api/download/v1/items/095a733fbde4479980ee9a026728bc0b/csv?layers=0) · [Centerlines GeoJSON](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/api/download/v1/items/095a733fbde4479980ee9a026728bc0b/geojson?layers=0) · [Polygons CSV](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/api/download/v1/items/095a733fbde4479980ee9a026728bc0b/csv?layers=1) · [Polygons GeoJSON](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/api/download/v1/items/095a733fbde4479980ee9a026728bc0b/geojson?layers=1) |
| **Water and Sewer System Data** | Village of Oak Park | Downloadable water and sewer utility data provided in shapefile format. | [Portal](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/datasets/73850c036f97498782a59d330e834561) |
| **Water Service Inventory Dashboard** | Village of Oak Park | Dashboard for exploring the Village water-service inventory and service-line information. | [Dashboard](https://www.arcgis.com/apps/dashboards/97cfcb6247a24abc9baf9f227fb21f55) |

## Maps & Imagery

Aerial imagery services for basemaps.

| Dataset | Provider | What it contains | Access |
| --- | --- | --- | --- |
| **GIS Consortium 2024 Imagery** | GIS Consortium | Regional 2024 imagery exposed through an ArcGIS map service. | [Portal](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/maps/0a28e95784e9456ab6189bf13ef9d207) · [Map service](https://tiles.arcgis.com/tiles/uRp89l90TnovtJpf/arcgis/rest/services/GISC_IMAGERY_2024_Project/MapServer) |
| **Oak Park 2024 Aerial Imagery** | Village of Oak Park / GIS Consortium | 2024 aerial imagery with a map service, component layers, and a downloadable tile package. | [Portal](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/maps/d88331b2bea849d6b2f1b9fd0a22576c) · [Map service](https://tiles.arcgis.com/tiles/aymthbPDQOcCnuwg/arcgis/rest/services/VOP_Imagery_2024SID/MapServer) · [Municipal polygon layer](https://tiles.arcgis.com/tiles/aymthbPDQOcCnuwg/arcgis/rest/services/VOP_Imagery_2024SID/MapServer/0) · [SID layer](https://tiles.arcgis.com/tiles/aymthbPDQOcCnuwg/arcgis/rest/services/VOP_Imagery_2024SID/MapServer/1) · [TPKX download](https://apps.gisconsortium.org/giscsharedstorage/VOP/VOP_Imagery_2024SID_TPKX.zip) |

## Portals

Discovery roots for finding datasets that are not listed here.

| Dataset | Provider | What it contains | Access |
| --- | --- | --- | --- |
| **Oak Park Open Data Portal (ArcGIS Hub)** | Village of Oak Park | The Village's open data portal; the DCAT feed lists all 38 published items as JSON with their download distributions. | [Portal](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/) · [DCAT feed](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/api/feed/dcat-us/1.1.json) |
| **Village hosted ArcGIS services directory** | Village of Oak Park | Directory of about 80 Village-hosted feature services (schools, bikeways, Census summaries, waste tonnage, CIP, and more), many of which are not surfaced on the Hub portal. Append `?f=json` to any service for its layer list. | [Services directory](https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services?f=json) |
| **Cook County Open Data Portal** | Cook County | Socrata portal covering property, courts, health, elections, and more; every Assessor dataset below is a `resource/<id>.json` endpoint on this host. | [Portal](https://datacatalog.cookcountyil.gov/) |

## Property & Assessment

Cook County Assessor and GIS datasets for every parcel, plus Village permit and parcel layers; all county rows need an Oak Park filter (see Filtering).

| Dataset | Provider | What it contains | Access |
| --- | --- | --- | --- |
| **Assessor – Assessed Values** | Cook County Assessor | Mailed, certified, and Board of Review values per PIN and year (`mailed_tot`, `certified_tot`, `board_tot`; use board > certified > mailed). 2026 reassessment values are already published. Oak Park: see Filtering (Socrata). | [Portal page](https://datacatalog.cookcountyil.gov/d/uzyt-m557) · [API](https://datacatalog.cookcountyil.gov/resource/uzyt-m557.json) |
| **Assessor – Improvement Characteristics** | Cook County Assessor | Building characteristics per PIN and year (`char_yrblt`, `char_bldg_sf`, `char_beds`, `char_apts` spelled out as Two..Six). Multi-card PINs return several rows; numerics come back as strings like `"3.0"`. Oak Park: see Filtering (Socrata). | [Portal page](https://datacatalog.cookcountyil.gov/d/x54s-btds) · [API](https://datacatalog.cookcountyil.gov/resource/x54s-btds.json) |
| **Assessor – Parcel Addresses** | Cook County Assessor | PIN-to-address crosswalk (situs and mailing), one row per PIN per year, about 1.86M rows per year countywide; city strings are dirty (`OAK PK`). Oak Park: see Filtering (Socrata). | [Portal page](https://datacatalog.cookcountyil.gov/d/3723-97qp) · [API](https://datacatalog.cookcountyil.gov/resource/3723-97qp.json) |
| **Assessor – Parcel Sales** | Cook County Assessor | Recorded sales by PIN (`sale_date`, `sale_price`, `deed_type`, `is_multisale`, `sale_filter_*` flags); exclude `sale_filter_less_than_10k` and multi-parcel sales for price analysis. About 29,000 Oak Park rows. Oak Park: see Filtering (Socrata). | [Portal page](https://datacatalog.cookcountyil.gov/d/wvhk-k5uv) · [API](https://datacatalog.cookcountyil.gov/resource/wvhk-k5uv.json) |
| **Assessor – Residential Characteristics (archive)** | Cook County Assessor | Retired dataset covering tax year 2019 only (17,328 Oak Park rows); superseded by Improvement Characteristics. Keep for the 2019 vintage. Oak Park filter is built into the link. | [Portal page](https://datacatalog.cookcountyil.gov/d/bcnq-qi2z) · [CSV](https://datacatalog.cookcountyil.gov/resource/bcnq-qi2z.csv?Town%20Code=27&$limit=20000) |
| **Assessor – Commercial Valuation Data** | Cook County Assessor | Income-approach data for commercial and 7+ unit apartment buildings (`keypin`, `tot_units`, income, expenses); the only source of unit counts for class-3 apartment buildings. Oak Park rows exist only for the 2023 reassessment. Oak Park: see Filtering (Socrata). | [Portal page](https://datacatalog.cookcountyil.gov/d/csik-bsws) · [API](https://datacatalog.cookcountyil.gov/resource/csik-bsws.json) |
| **Assessor – Neighborhood Boundaries** | Cook County Assessor | Assessor valuation-neighborhood polygons; Oak Park has 11 neighborhoods (`town_nbhd` = `27xxx`). Oak Park: see Filtering (Socrata). | [Portal page](https://datacatalog.cookcountyil.gov/d/pcdw-pxtg) · [API](https://datacatalog.cookcountyil.gov/resource/pcdw-pxtg.json) |
| **Cook County Address Points** | Cook County | Geocoded address points with `lat`, `long` (not `lon`), `cmpaddabrv`, and `twp_name`, joinable by PIN. Covers about 11.9k of about 18.7k Oak Park PINs; condo units are usually missing, so fall back to the parent PIN. Oak Park: see Filtering (Socrata). | [Portal page](https://datacatalog.cookcountyil.gov/d/78yw-iddh) · [API](https://datacatalog.cookcountyil.gov/resource/78yw-iddh.json) |
| **Cook County Parcel Polygons (2022)** | Cook County GIS | Parcel polygons for all of Cook County (2022 vintage) with `pin10`, `name` (14-digit PIN), `municipality`, `assessorbldgclass`, `latitude`, `longitude`; condo units share the parent polygon. Oak Park: see Filtering (ArcGIS parcels). | [Cook Viewer map](https://maps.cookcountyil.gov/cookviewer/) · [Query endpoint](https://gis.cookcountyil.gov/hosting/rest/services/Hosted/Parcel_2022/FeatureServer/0/query) |
| **Assessor PIN detail pages, building photos, and class codes** | Cook County Assessor | Per-PIN web pages with appeal history, exemptions, and characteristics, a building photo for most PINs, and the Assessor's property class code definitions. HTML pages, not an API. URL patterns: see Working with the data. | [PIN page (example)](https://www.cookcountyassessoril.gov/pin/PIN) · [Class codes](https://www.cookcountyassessoril.gov/classifications-real-property) |
| **Village permits, planning cases, and code enforcement (CityView portal)** | Village of Oak Park | Building permits, planning applications, business licenses, and code-enforcement cases searchable by parcel or address. Code enforcement is visible anonymously; permits need a free CityView account. | [Portal](https://villageview.oak-park.us/CityViewPortal) |

## Public Safety

Police incident data, police zones, and state crash records for Oak Park.

| Dataset | Provider | What it contains | Access |
| --- | --- | --- | --- |
| **Oak Park PD Crime Incidents (Power BI dashboard)** | Village of Oak Park | Incident-level police data from January 2022 to present: date and time, NIBRS offense code and group, UCR code, block address, post and zone, lat/lon; updated about 15 days after month end. The dashboard has no export button; a cached extract is in this folder (`crime-incidents-oak-park.csv`) and the query-replay recipe is under Working with the data. | [Dashboard](https://app.powerbigov.us/view?r=eyJrIjoiMTg0ZGI4YTYtZTgxNC00MzVmLThlNDYtMTE4MTQwNDlkYzdlIiwidCI6IjZjOGIyOTRlLTVmZjUtNDJiMi1hM2Q3LWMzYmQ3MGE3OWYyNSJ9&pageName=2180cdf0aa49c0286272) · [Village Crime Maps page](https://www.oak-park.us/Public-Safety/Police-Department/Reports-Maps/Crime-Maps) |
| **Police neighborhood zones (VOP layer 171)** | Village of Oak Park | Eight police zone polygons (`Police_NeighborhoodZone_POLY`) that join to the `Post` and `Zone` fields in the crime dashboard. | [Live map](https://www.arcgis.com/apps/mapviewer/index.html?url=https://utility.arcgis.com/usrsvcs/servers/4cff1aaefa364b57b8c70d5c606f2088/rest/services/VOP/AGOL_VOP_Project/MapServer/171) · [GeoJSON query](https://utility.arcgis.com/usrsvcs/servers/4cff1aaefa364b57b8c70d5c606f2088/rest/services/VOP/AGOL_VOP_Project/MapServer/171/query?where=1%3D1&outFields=*&f=geojson) |
| **Oak Park PD Traffic Crash Dashboard (Power BI)** | Village of Oak Park, Police Department | Every public-roadway crash reported to Oak Park Police since January 2024, one row per report (about 1,700 a year), with date and time, street or intersection, lat/lon, severity and KABCO injury counts, crash type including pedestrian and bicyclist, contributing causes, hit and run, damage band, weather, lighting, road surface, and traffic control. Includes minor crashes below IDOT's reporting threshold but not state-police crashes on I-290. Posted about 7 days after the crash. Cached as `crashes-village-oak-park.csv`; see the data README. | [Village page](https://opendata.oak-park.us/TrafficCrash/) · [Power BI report](https://app.powerbigov.us/view?r=eyJrIjoiMGVkYjlkYzktMDU4ZS00MDFiLThjYjgtZmFjN2JlZjIzYzAyIiwidCI6IjZjOGIyOTRlLTVmZjUtNDJiMi1hM2Q3LWMzYmQ3MGE3OWYyNSJ9) (no export button; `data/scripts/fetch_crashes_village.py` replays the report's public query API) |
| **IDOT Crashes by year (2014-2025)** | Illinois Department of Transportation | Statewide crash points, one feature service per year, with about 85 fields (date, hour, severity, injuries, collision type, cause, lighting, weather, lat/lon). Oak Park sees roughly 1,100-1,550 crashes per year 2019-2025. Oak Park and the per-year service names: see Filtering (IDOT). | [2023 Oak Park GeoJSON](https://services2.arcgis.com/aIrBD8yn1TDTEXoz/arcgis/rest/services/CRASHES_2023/FeatureServer/0/query?where=CityName%3D%27OAK%20PARK%27&outFields=*&outSR=4326&f=geojson) · [IDOT open data portal](https://gis-idot.opendata.arcgis.com/) |
| **IDOT Bicycle and Pedestrian Crashes** | Illinois Department of Transportation | Multi-year bike and pedestrian crash points with `StatisticalYearofCrash`, `CrashReportCity`, severity, and intersection streets; 243 Oak Park records. Oak Park: see Filtering (IDOT). | [Live map](https://www.arcgis.com/apps/mapviewer/index.html?layers=ab2fdd4083794c05ba68469723ef4d62) · [Item page](https://www.arcgis.com/home/item.html?id=ab2fdd4083794c05ba68469723ef4d62) · [Oak Park GeoJSON](https://services2.arcgis.com/aIrBD8yn1TDTEXoz/arcgis/rest/services/BikePedCrash/FeatureServer/0/query?where=CrashReportCity%3D%27OAK%20PARK%27&outFields=*&outSR=4326&f=geojson) |

## Schools & Education

State report-card data plus Village layers for school locations, attendance zones, and safe routes.

| Dataset | Provider | What it contains | Access |
| --- | --- | --- | --- |
| **Illinois Report Card and ISBE Report Card Data Library** | Illinois State Board of Education | Per-school and per-district report cards for Oak Park ESD 97 and OPRF D200 (enrollment, demographics, attendance and chronic absenteeism, IAR and SAT proficiency, student growth, teacher and finance measures) on the website, plus statewide Excel data sets by year (2023 through 2025, a multi-year trend file, and student-growth files) with hundreds of columns; the 2025 set is 40 MB. A cached D97 and D200 extract is in this folder (`report-card-d97-d200.csv`). Download pattern: see Working with the data. | [Illinois Report Card](https://www.illinoisreportcard.com) · [ISBE data library](https://www.isbe.net/Pages/Illinois-State-Report-Card-Data.aspx) · [2025 data set (xlsx)](https://www.isbe.net/Documents/2025-Report-Card-Public-Data-Set.xlsx) |
| **Elementary and Middle Schools (D97) footprints** | Village of Oak Park | Ten D97 school building polygons with `NAME` and `TYPE` (Lincoln, Brooks, Longfellow, and others). No OPRF or private schools; add OPRF (201 N Scoville) by hand. | [Live map](https://www.arcgis.com/apps/mapviewer/index.html?layers=628497261bfa40e785582e7cf1e4e283) · [Item page](https://www.arcgis.com/home/item.html?id=628497261bfa40e785582e7cf1e4e283) · [GeoJSON query](https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/Elementary_and_Middle_Schools/FeatureServer/0/query?where=1%3D1&outFields=NAME,TYPE&outSR=4326&f=geojson) |
| **D97 Elementary Attendance Zones and Safe Routes to School layers** | Village of Oak Park | Attendance-zone polygons, the Safe Routes web-map layer, and crowdsourced Safe Routes hazard points. | [Attendance zones](https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/Elementary_Attendance_Zones/FeatureServer/0) · [Safe Routes layer](https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/SafeRoutesWebMapLayer_gdb/FeatureServer/0) · [Safe Routes crowdsourcing](https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/SafeRoutesToSchoolCrowdSourcing/FeatureServer) |
| **School Districts** | GIS Consortium | Interactive map of school-district boundaries. Browse-only; for school locations and attendance zones use the feature services above. | [Map](https://gisc.maps.arcgis.com/apps/webappviewer/index.html?id=f03057ff518949a792ab6cb2b82e4e60) |

## Taxes & Levies

Cook County Clerk levy and extension reports and the CCAO tax-bill simulator database.

| Dataset | Provider | What it contains | Access |
| --- | --- | --- | --- |
| **Cook County Clerk – Tax Extension API (report data and report PDFs)** | Cook County Clerk | Agency Tax Rate Reports for every Cook County taxing district: EAV, levy by fund, PTELL limiting rate, final rate, and tax extension per agency and tax year, 2006 to the latest published year (2025 as of September 2026), as one PDF per agency and year plus JSON report metadata; data lags the tax year by months. A cached extract for the eight Oak Park agencies is in this folder (`oak-park-levies.csv`). Request bodies and agency IDs: see Filtering (Clerk). | [Report data API (POST)](https://www.cookcountyclerkil.gov/api-tax/public/getreportdata) · [Report PDF API (POST)](https://www.cookcountyclerkil.gov/api-tax/public/viewreport) · [Tax extension and rates page](https://www.cookcountyclerkil.gov/property-taxes/tax-extension-and-rates) |
| **PTAXSIM DB (CCAO)** | Cook County Assessor | SQLite database for simulating complete Cook County property-tax bills: per-PIN bills, exemptions, levies, and equalization factors 2006-2023. Several GB after `bunzip2`; the 2023.0.0 file is also available. Oak Park: see Filtering (PTAXSIM). | [Database file (2024.0.0)](https://ccao-data-public-us-east-1.s3.amazonaws.com/ptaxsim/ptaxsim-2024.0.0.db.bz2) · [GitHub](https://github.com/ccao-data/ptaxsim) |

## Transportation & Parking

Transit stops, bikeways (existing and planned), traffic calming, and parking layers.

| Dataset | Provider | What it contains | Access |
| --- | --- | --- | --- |
| **Modes of Transportation** | Village of Oak Park | Bus stops, CTA and Metra stations, EV charging locations, and public parking lots. The app is browse-only; the underlying VOP MapServer layers are queryable (layer 0 Pace bus stops is regionwide, 19,323 features). | [Interactive map](https://oakparkil.maps.arcgis.com/apps/instant/basic/index.html?appid=2af5b9a26234457d920a2e9d44a72bf2) · [Pace bus stops (0)](https://utility.arcgis.com/usrsvcs/servers/4cff1aaefa364b57b8c70d5c606f2088/rest/services/VOP/AGOL_VOP_Project/MapServer/0/query?where=1=1&outFields=*&f=geojson) · [Metra stations (1)](https://utility.arcgis.com/usrsvcs/servers/4cff1aaefa364b57b8c70d5c606f2088/rest/services/VOP/AGOL_VOP_Project/MapServer/1/query?where=1=1&outFields=*&f=geojson) · [CTA stations (2)](https://utility.arcgis.com/usrsvcs/servers/4cff1aaefa364b57b8c70d5c606f2088/rest/services/VOP/AGOL_VOP_Project/MapServer/2/query?where=1=1&outFields=*&f=geojson) · [EV charging (4)](https://utility.arcgis.com/usrsvcs/servers/4cff1aaefa364b57b8c70d5c606f2088/rest/services/VOP/AGOL_VOP_Project/MapServer/4/query?where=1=1&outFields=*&f=geojson) · [Public parking (42)](https://utility.arcgis.com/usrsvcs/servers/4cff1aaefa364b57b8c70d5c606f2088/rest/services/VOP/AGOL_VOP_Project/MapServer/42/query?where=1=1&outFields=*&f=geojson) |
| **Overnight Parking Map** | Village of Oak Park | Village overnight-parking restrictions as a PDF map, plus the VOP MapServer layers behind it (9 Overnight Parking Ban Lot, 10 Overnight Parking Ban On Street). The Hub app is browser-only. | [Download map](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/apps/7bc8c913ecb5419ba0b6dca5a0f0a7dd) · [Map document](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/documents/f9735ab3100c45de87045b2f95a4ea11) · [Ban lots (9)](https://utility.arcgis.com/usrsvcs/servers/4cff1aaefa364b57b8c70d5c606f2088/rest/services/VOP/AGOL_VOP_Project/MapServer/9/query?where=1=1&outFields=*&f=geojson) · [Ban on street (10)](https://utility.arcgis.com/usrsvcs/servers/4cff1aaefa364b57b8c70d5c606f2088/rest/services/VOP/AGOL_VOP_Project/MapServer/10/query?where=1=1&outFields=*&f=geojson) |
| **Daytime and Overnight Parking Restriction Maps** | Village of Oak Park | Curb-by-curb daytime restrictions (time limits, no parking, permit-only, sign text) and overnight permit streets and zones, all from VOP MapServer layer 42 Parking Restriction Areas; the No Overnight Passes map draws layers 9 and 10. Daytime hours live only in the sign-text field. Cached as `parking-restrictions-oak-park.geojson`, `parking-overnight-ban-oak-park.geojson`, and `parking-facilities-oak-park.csv`. | [Daytime map](https://www.arcgis.com/home/item.html?id=612c713946094edebcdbefb9efc298c6) · [Overnight map](https://www.arcgis.com/home/item.html?id=8fae1fbfc3434fb5b30a6e2272e0f64c) · [No Overnight Passes map](https://www.arcgis.com/home/item.html?id=5347005a5f2a4f21a8029a65be91e81d) · [Layer 42 GeoJSON](https://utility.arcgis.com/usrsvcs/servers/4cff1aaefa364b57b8c70d5c606f2088/rest/services/VOP/AGOL_VOP_Project/MapServer/42/query?where=1=1&outFields=*&f=geojson) · [Daytime PDF](https://www.oak-park.us/files/assets/oakpark/v/4/parking/parking-maps/daytime-parking-restrictions-map.pdf) |
| **Parking rules and permit pages** | Village of Oak Park | The overnight ban (2:30 to 6 a.m.), pass limits and prices, permit types and hours, a PDF per zone and lot, and snow emergency rules. Web pages only; the site blocks scripts but opens in a browser. | [Guidelines and Restrictions](https://www.oak-park.us/Services-Parking/Parking-Mobility-Services/Parking-Guidelines-Restrictions) · [Passes](https://www.oak-park.us/Services-Parking/Parking-Mobility-Services/Parking-Passes) · [Permits](https://www.oak-park.us/Services-Parking/Parking-Mobility-Services/Parking-Permits) · [Zone and lot maps](https://www.oak-park.us/Services-Parking/Parking-Mobility-Services/Parking-Permit-Maps-Zone-Guidelines) · [Snow parking](https://www.oak-park.us/Services-Parking/Parking-Mobility-Services/Seasonal-Parking/Snow-Emergency-Parking) |
| **Oak Park Bikeways, July 2025** | Village of Oak Park | 85 polyline segments with `Segment_Na` and `ShortTerm`, `MidTerm`, `LongTerm` flags; appears to be the Village's bike plan phasing layer (last edited July 31, 2025). There is no facility-type field, so confirm with the Village which segments are existing versus planned. | [Live map](https://www.arcgis.com/apps/mapviewer/index.html?layers=553f63b0a58147cba602bd36219b46e3) · [Item page](https://www.arcgis.com/home/item.html?id=553f63b0a58147cba602bd36219b46e3) · [GeoJSON query](https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/Oak_Park_Bikeways_July_2025/FeatureServer/0/query?where=1%3D1&outFields=*&outSR=4326&f=geojson) |
| **Village bike project layers (VOP layers 38 and 161)** | Village of Oak Park | Bike Boulevard Projects (layer 38, 19 features) and Bike Improvements (layer 161, 1 feature) from the Village MapServer. | [Bike Boulevard Projects (38)](https://utility.arcgis.com/usrsvcs/servers/4cff1aaefa364b57b8c70d5c606f2088/rest/services/VOP/AGOL_VOP_Project/MapServer/38/query?where=1=1&outFields=*&f=geojson) · [Bike Improvements (161)](https://utility.arcgis.com/usrsvcs/servers/4cff1aaefa364b57b8c70d5c606f2088/rest/services/VOP/AGOL_VOP_Project/MapServer/161/query?where=1=1&outFields=*&f=geojson) |
| **CTA and Pace GTFS schedules** | Chicago Transit Authority; Pace Suburban Bus | Static schedule feeds: every stop with coordinates, routes, trips, and stop times; CTA includes `wheelchair_boarding` (set to accessible on every bus stop, so only meaningful for rail). Filter stops to the Oak Park bounding box; see Filtering (Cook County ArcGIS) for the envelope. Cached, joined and filtered, as `transit-stops-oak-park.csv`. | [CTA GTFS zip](https://www.transitchicago.com/downloads/sch_data/google_transit.zip) · [CTA developer page](https://www.transitchicago.com/developers/gtfs/) · [Pace GTFS page](https://www.pacebus.com/gtfs) |
| **Pace bus shelters and passenger counts** | Pace Suburban Bus | Pace's public GIS server: the shelter and posted-stop inventory (assessed December 2015) and Spring 2026 automatic passenger counts (boardings and alightings by stop and route; no stated averaging period, read as a ranking). Query by Pace stop id or by envelope. | [Shelters and posted stops](https://maps.pacebus.com/arcgis/rest/services/StrategicServices/Shelters_Posted_Stops/MapServer/0) · [Passenger counts](https://maps.pacebus.com/arcgis/rest/services/StrategicServices/APC/MapServer/0) · [Server directory](https://maps.pacebus.com/arcgis/rest/services) |
| **CMAP transit rider vulnerability (TRVI, 2024)** | Chicago Metropolitan Agency for Planning | Every CTA and Pace bus stop in northeastern Illinois scored 1 to 3 for rider vulnerability to extreme heat, with shelter status and normalized social-vulnerability and no-vehicle inputs. Query by envelope. | [CTA stops layer](https://services5.arcgis.com/LcMXE3TFhi1BSaCY/arcgis/rest/services/TRVI_Data_Data_Hub/FeatureServer/0) · [Pace stops layer](https://services5.arcgis.com/LcMXE3TFhi1BSaCY/arcgis/rest/services/TRVI_Data_Data_Hub/FeatureServer/1) |
| **CMAP Bikeway Inventory System (BIS)** | Chicago Metropolitan Agency for Planning | Regional bikeway inventory with one layer per municipal or agency plan (existing and planned facilities), including `Muni_OakPark_2015_NeighborhoodGreenwaysSystemStudy`; fields `STATUS`, `STNAME`, `FACNAME`, `FROMREF`, `TOREF`, `FACTYPE`, `SURFACE`, `TOTWIDTH`. 2016-era plan data; enumerate layers with `?f=pjson` and clip to Oak Park with an envelope (see Filtering (ArcGIS parcels)). | [Feature service](https://services5.arcgis.com/LcMXE3TFhi1BSaCY/arcgis/rest/services/Bikeway_Inventory_System/FeatureServer) · [CMAP Data Hub](https://datahub.cmap.illinois.gov/maps/4c75874452ab408092eab69ffca4948a) |
| **Oak Park Traffic Calming Features** | Village of Oak Park | Point and line features for speed humps, bump-outs, and other traffic-calming installations. | [Feature layer](https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/Oak_Park_Traffic_Calming_Features/FeatureServer/0) |
| **Proposed Neighborhood Greenways** | Village of Oak Park | Proposed neighborhood greenway corridors from the Village's greenways planning. | [Feature layer](https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/Proposed_Neighborhood_Greenways/FeatureServer/0) |

## Waste & Recycling

Collection-area maps; tonnage tables also exist as `LRS_Waste_data_refuse_Collected`, `LRS_Waste_data_RecycledMaterials_Collected`, and `LRS_Waste_data_YardWaste_Collected` in the Village hosted-services directory (not yet inspected).

| Dataset | Provider | What it contains | Access |
| --- | --- | --- | --- |
| **Garbage Collection Areas** | GIS Consortium | Interactive map of garbage collection areas. Browse-only. | [Map](https://gisc.maps.arcgis.com/apps/webappviewer/index.html?id=b493ae623dbb42d585f5543d6b11df52) |
| **Recycling Collection Areas** | GIS Consortium | Interactive map of recycling collection areas. Browse-only. | [Map](https://gisc.maps.arcgis.com/apps/webappviewer/index.html?id=183d0526e72143639e85d44687fd5951) |
| **Yard Waste Collection Areas** | GIS Consortium | Interactive map of yard-waste collection areas. Browse-only. | [Map](https://gisc.maps.arcgis.com/apps/webappviewer/index.html?id=6a71a6df9b3141f9826bbb115c76c179) |

## Zoning & Land Use

Boundaries, zoning districts, building and parcel layers, and current housing and zoning planning documents.

| Dataset | Provider | What it contains | Access |
| --- | --- | --- | --- |
| **Building Footprints** | Village of Oak Park | Building-footprint polygons for Oak Park. Download from the portal page; no direct feature service found. | [Portal](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/datasets/ec018598714f497581ed750267d4797b) |
| **Jurisdictional Boundaries** | GIS Consortium | Interactive map of local jurisdictional boundaries. Browse-only; Municipal Boundary below is the data. | [Map](https://gisc.maps.arcgis.com/apps/webappviewer/index.html?id=26ac0a2e515746048d38077de039ae12) |
| **Municipal Boundary** | Village of Oak Park | The legal municipal boundary polygon for Oak Park (field `COMMUNITYN`). The Hub GeoJSON download occasionally returns a transient 500; the query form is reliable. | [Portal](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/datasets/6c1807a7ef5d4d77a9fbb1801d9d36d1_0) · [Feature service](https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/Municipal_Boundary/FeatureServer/0) · [GeoJSON query](https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/Municipal_Boundary/FeatureServer/0/query?where=1%3D1&outFields=COMMUNITYN&outSR=4326&f=geojson) · [CSV](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/api/download/v1/items/6c1807a7ef5d4d77a9fbb1801d9d36d1/csv?layers=0) · [GeoJSON](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/api/download/v1/items/6c1807a7ef5d4d77a9fbb1801d9d36d1/geojson?layers=0) |
| **Cook County Municipal Boundaries** | Cook County GIS | One polygon per Cook County municipality; the simplest way to get an Oak Park boundary from a county source. A second copy is at `traditional/rest/services/politicalBoundary/MapServer/2`. Oak Park: see Filtering (ArcGIS parcels). | [Cook Viewer map](https://maps.cookcountyil.gov/cookviewer/) · [Oak Park GeoJSON](https://gis.cookcountyil.gov/hosting/rest/services/cookviewer_political_boundaries/MapServer/64/query?where=MUNICIPALITY='Oak Park'&outFields=MUNICIPALITY&outSR=4326&returnGeometry=true&f=geojson) |
| **Zoning Districts and Maps** | Village of Oak Park / GIS Consortium | Interactive zoning districts, a printable zoning map, and machine-readable zoning polygons with `ZONED`, `ZONINGCATEGORY`, and `ZONINGDESCRIPTION` on two feature services (the GIS Consortium service name suggests an April 2022 vintage; VOP layer 8 has 23 polygons). Polygons overlap or gap in places. | [Interactive map](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/apps/7669c037b54b41b4938ce0da4e582495) · [Print map (PDF)](https://oakparkil.maps.arcgis.com/sharing/rest/content/items/048ab19b32b94fbfabe90ce04f54adde/data) · [Print map item](https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/documents/048ab19b32b94fbfabe90ce04f54adde) · [GISC zoning GeoJSON](https://services2.arcgis.com/uRp89l90TnovtJpf/arcgis/rest/services/VOP_GISC_PUBLISH_CMV_FGDB_202204_View/FeatureServer/34/query?where=1%3D1&outFields=ZONED,ZONINGCATEGORY&outSR=4326&returnGeometry=true&f=geojson) · [VOP zoning GeoJSON (8)](https://utility.arcgis.com/usrsvcs/servers/4cff1aaefa364b57b8c70d5c606f2088/rest/services/VOP/AGOL_VOP_Project/MapServer/8/query?where=1=1&outFields=*&f=geojson) |
| **Parcels with property use and unit count (VOP layer 172)** | Village of Oak Park / GIS Consortium | 13,848 parcel polygons with `PIN14`, `Property_Class`, `Property_Description`, `Category`, and `USER_Unit__` (unit count); a Village-curated shortcut for unit counts by parcel. Vintage unknown, so compare against assessor data. | [Live map](https://www.arcgis.com/apps/mapviewer/index.html?url=https://utility.arcgis.com/usrsvcs/servers/4cff1aaefa364b57b8c70d5c606f2088/rest/services/VOP/AGOL_VOP_Project/MapServer/172) · [GeoJSON query](https://utility.arcgis.com/usrsvcs/servers/4cff1aaefa364b57b8c70d5c606f2088/rest/services/VOP/AGOL_VOP_Project/MapServer/172/query?where=1%3D1&outFields=*&f=geojson) |
| **Low and Moderate Income Areas by block group (VOP layer 158)** | Village of Oak Park | 53 block-group polygons flagged as low and moderate income for CDBG purposes. | [Live map](https://www.arcgis.com/apps/mapviewer/index.html?url=https://utility.arcgis.com/usrsvcs/servers/4cff1aaefa364b57b8c70d5c606f2088/rest/services/VOP/AGOL_VOP_Project/MapServer/158) · [GeoJSON query](https://utility.arcgis.com/usrsvcs/servers/4cff1aaefa364b57b8c70d5c606f2088/rest/services/VOP/AGOL_VOP_Project/MapServer/158/query?where=1%3D1&outFields=*&f=geojson) |
| **Shape Oak Park zoning update documents (Opticos)** | Village of Oak Park / Opticos Design | Proposed place-type map and recommendations (July 2026) for the zoning ordinance update, as PDF and PNG documents on the Village's engagement site. Not an adopted map. | [Documents](https://engageoakpark.com/shape/documents) |
| **Strategic Vision for Housing (March 2024)** | Village of Oak Park | The Village's housing strategy PDF, including multifamily and deed-restricted unit counts. oak-park.us returns 403 to scripts but opens in a browser. | [PDF](https://www.oak-park.us/files/assets/public/v/1/development-customer-services/planning-division/documents/strategic-vision-for-housing_final_3.26.24_reduced.pdf) |

## Filtering to Oak Park

Most county, state, and federal sources cover far more than Oak Park. These are the filters that worked as of September 8, 2026. Village-hosted services (`services5.arcgis.com/aymthbPDQOcCnuwg` and the VOP MapServer) already cover only Oak Park, so `where=1=1` is enough there.

### Cook County Socrata datasets (datacatalog.cookcountyil.gov)

- Assessor datasets carry both `township_name` and `township_code`: use `?township_name=Oak%20Park` or `?township_code=27`. Older vintages use `Town Code=27`. Exceptions: Commercial Valuation uses `township=Oak Park`; Parcel Addresses uses `prop_address_city_name=OAK PARK` (city strings are dirty, so also look for `OAK PK`); Address Points uses `inc_muni=Oak Park` or `placename`.
- Every Oak Park PIN starts with `16` (prefixes 16-05 through 16-08, 16-17, and 16-18), which works as a fallback filter on any PIN-keyed dataset.
- Simple parameter filters (`?township_name=Oak%20Park&year=2025`) return in about a second; `$where=` queries on the large Assessor datasets have been timing out (over 150 s). Prefer the simple form.
- Add a year: `&year=2025`. 2026 reassessment rows are published, but `year` comes back as the string `"2026.0"` (and values like `"51000.0"`) while 2025 rows return `"2025"`; cast before comparing. All numerics are returned as strings.
- Paging: `$limit` defaults to 1000 and maxes at 50000; combine with `$offset` and `$order=:id` to walk a full result set. Unauthenticated access works but is throttled; an app token (`$$app_token`) is optional.
- Example: `https://datacatalog.cookcountyil.gov/resource/uzyt-m557.json?township_name=Oak%20Park&year=2025&$limit=50000`

### Cook County ArcGIS parcel and boundary layers (gis.cookcountyil.gov)

- Parcel polygons: `where=municipality='Oak Park'` (or `where=pin10 LIKE '16%'`), `outFields=pin10,name,assessorbldgclass,latitude,longitude`, `outSR=4326`, `f=geojson`. The server returns at most 2000 records per page; loop with `resultOffset=0,2000,4000,...`. `name` holds the 14-digit PIN; condo units have no polygon of their own, so fall back to the parent PIN (first 10 digits plus `0000`), which leaves about 7% of Oak Park PINs unresolved.
- Municipal boundaries: `where=MUNICIPALITY='Oak Park'`.
- Regional layers without a municipality field (for example CMAP BIS): pass an envelope, `geometry=-87.8135,41.8698,-87.7755,41.9045&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects`, then clip to the Municipal Boundary polygon.

### Census (api.census.gov, Census Reporter, TIGER)

- Oak Park is place FIPS `54885` in state `17`: `for=place:54885&in=state:17`. Summary-level GEOIDs: Oak Park `16000US1754885`, Cook County `05000US17031`, Illinois `04000US17`. TIGER PLACE GEOID `1754885`; county FIPS `031`.
- api.census.gov requires a free key on every request: sign up at `https://api.census.gov/data/key_signup.html` and append `&key=YOUR_KEY`.
- Census Reporter serves only the latest 5-year release (`acs2024_5yr` as of September 2026). Child geographies inside Oak Park: block groups `geo_ids=150|16000US1754885`, tracts `geo_ids=140|16000US1754885`. Send a real `User-Agent` header; the default python-requests agent gets a 403.

### IDOT crash layers (services2.arcgis.com/aIrBD8yn1TDTEXoz)

- Annual crash layers: `where=CityName='OAK PARK'` (the `Township` field is blank for Oak Park). The bike/ped layer uses `where=CrashReportCity='OAK PARK'`.
- Service names are inconsistent by year: `CRASHES___2025`, `CRASHES__2024`, `CRASHES_2023`, `CRASHES_2022`, `CRASHES2021`, `Crashes_2020`, `Crashes2019`, and `Crashes_2018_SDMExtract` through `Crashes_2014_SDMExtract`. Check the IDOT open data portal if a name has changed.
- 2000 records per page; page with `resultOffset`. Add `outSR=4326&f=geojson` for GeoJSON.

### Cook County Clerk tax extension API

- Both endpoints are POST-only with a JSON body (GET returns 405).
- `totalCount` is 0 for tax years the Clerk has not published yet.
- In the PDF, TAX EXTENSION GRAND TOTAL is the amount actually billed (post-PTELL); AGENCY GRAND TOTAL is the requested levy. From tax year 2024 the Library fund is a section of the Village PDF and General Assistance and Mental Health are sections of the Township PDF.
- `getreportdata` body: `{"page":1,"itemsPerPage":10,"request":{"Year":"2023","ReportTypeId":1,"AgencyTypeId":"0","Agencies":["030920000"],"AgencyName":""}}`
- `viewreport` body: `{"All":false,"AgencyType":"0","ReportTypeId":1,"Year":"2023","Agencies":["030920000"],"AgencyName":"","Ignore":false,"TaxReports":[{"agencyId":"030920000","year":"2023","reportTypeId":1}]}` (returns a PDF).
- The eight Oak Park taxing agencies: `020180000` Town of Oak Park, `020180002` Oak Park General Assistance, `020180004` Oak Park Mental Health, `030920000` Village of Oak Park, `030920001` Oak Park Library Fund, `040580000` School District 97, `042020000` Oak Park and River Forest High School District 200, `050760000` Park District of Oak Park. D200 also covers River Forest; prorate to Oak Park's share of the district EAV (roughly 72-76%). Data begins with tax year 2006.

### PTAXSIM

- Oak Park tax codes begin with 27: `WHERE substr(tax_code_num,1,2)='27'` on the `tax_code` and `pin` tables.

## Working with the data

- **Portal, map, dashboard, and explorer links** are best for browsing and understanding a resource.
- **CSV links** are usually the easiest starting point for Python/Pandas, R, spreadsheets, and visualization tools.
- **GeoJSON links** work well with Leaflet, Mapbox, QGIS, and Python geospatial libraries.
- **Feature-service and API links** support programmatic filters, attribute queries, spatial searches, and pagination.
- **PDFs and archived datasets** may require manual extraction or extra validation before use.
- **Script-blocked hosts**: oak-park.us, bls.gov, ssa.gov, and the Hub `apps/` pages return 403 to curl and python-requests but open in a browser; Granicus and Census Reporter accept scripts if you send a browser-like `User-Agent`.

Source-specific access notes:

- **FRED CPI**: `fredgraph.csv?id=CPIAUCSL` returns the monthly series; add `&fq=Annual&fam=avg` for annual averages. fred.stlouisfed.org fails from curl over HTTP/2 (use `--http1.1`); the FRED JSON API needs a free key. The BLS API is keyless for recent years with a daily query cap.
- **Granicus video**: the Village Board is `view_id=2`; probe `view_id` 1-30 for other bodies. Agenda index per clip at `JSON.php?clip_id=CLIP_ID`; MP4 at `DownloadFile.php?view_id=2&clip_id=CLIP_ID` (same host as the archive link). CloudFront rejects generic CLI user agents, so send a browser User-Agent.
- **Assessor PIN pages**: `cookcountyassessoril.gov/pin/PIN`; building photo at `prodassets.cookcountyassessoril.gov/s3fs-public/pin_detail/AAA-BB/CCC/PIN_AA.jpg` (PIN digits 1-3, 4-5, 6-8).
- **Crime dashboard (Power BI)**: replay the dashboard's own POST to `https://wabi-us-gov-virginia-api.analysis.usgovcloudapi.net/public/reports/querydata?synchronous=true` with header `X-PowerBI-ResourceKey: 8da6b964-ac9c-48d4-b556-416a0a9fb621`, entity `FactLwMain_Combined`, 30,000-row cap. Report and dataset IDs change if the Village republishes; the script in `scripts/` that builds the cached extract does this.
- **ISBE Report Card data sets**: download as `isbe.net/_layouts/Download.aspx?SourceUrl=/Documents/FILENAME` or the direct `isbe.net/Documents/FILENAME`; current files are `2025-Report-Card-Public-Data-Set.xlsx`, `24-RC-Pub-Data-Set.xlsx`, `23-RC-Pub-Data-Set.xlsx`, and `rc-trend-data.xlsx`.

Common ArcGIS REST patterns:

```text
?f=json
/query?where=1=1&outFields=*&f=geojson
/query?where=FIELD_NAME=VALUE&f=json
&resultRecordCount=10
&resultOffset=2000
```

## Scope and provenance

- Village entries originated in the Oak Park Open Data Portal catalog.
- Technical sublayers and alternate download formats are listed as multiple links within one row instead of duplicate rows.
- Source descriptions were shortened for readability; the linked systems remain authoritative.
- See [project-ideas.md](../project-ideas.md) and the [starter projects](../starter-projects/README.md) for prompts that use these resources.
