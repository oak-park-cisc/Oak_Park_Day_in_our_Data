# Data

Two things live here: the [Oak Park Civic Data Catalog](open-data-catalog.md), a categorized list of Village, Cook County, state, regional, and federal data sources with links and Oak Park filters, and the cached datasets below, which are the ones the [starter projects](../starter-projects/README.md) use. The cached files exist so teams can work on event day without depending on live APIs. Every file was pulled from a primary public source on September 8, 2026 by a script in [`scripts/`](scripts/), and can be regenerated with that script.

## Cached datasets

| File | Used by | Rows | Coverage | Source |
| --- | --- | ---: | --- | --- |
| [assessed-values-oak-park.csv](assessed-values-oak-park.csv) | 01 Is my assessment fair? | 37,468 | Every Oak Park parcel, 2025 and 2026 | Cook County Assessor (Socrata) |
| [oak-park-levies.csv](oak-park-levies.csv) | 02 Where does my tax dollar go? | 160 | 8 Oak Park taxing agencies, tax years 2006 to 2025 | Cook County Clerk tax extension reports |
| [cpi-annual.csv](cpi-annual.csv) | 02, 08 | 26 | CPI-U annual averages 2000 to 2025 with 2025-dollar multipliers | FRED CPIAUCSL |
| [crashes-oak-park.csv](crashes-oak-park.csv) | 04 Can a kid bike to school safely? | 9,331 | All Oak Park crashes 2019 to 2025 | IDOT annual crash layers |
| [crashes-bike-ped-oak-park.csv](crashes-bike-ped-oak-park.csv) | 04 | 243 | Bike and pedestrian crashes 2020 to 2024 | IDOT bike/ped crash layer |
| [crashes-village-oak-park.csv](crashes-village-oak-park.csv) | 04 | 4,640 | Every crash reported to Oak Park Police, Jan 2024 to Aug 2026 | Village traffic crash dashboard |
| [schools-oak-park.csv](schools-oak-park.csv) | 04, 09 | 21 | Every K-12 school in Oak Park, public and private, with coordinates | ISBE directory, Village GIS, county address points |
| [d97-attendance-zones.geojson](d97-attendance-zones.geojson) | 04 | 8 | D97 elementary attendance zone polygons | Village GIS |
| [acs-oak-park-timeseries.csv](acs-oak-park-timeseries.csv) | 08 Oak Park over time | 1,554 | 35 ACS indicators for Oak Park, Cook County, Illinois, every 5-year vintage 2009 to 2024 | U.S. Census Bureau ACS |
| [report-card-d97-d200.csv](report-card-d97-d200.csv) | 09 How are our schools doing? | 200 | D97, D200, their schools, 11 comparison districts, and the state, 2018 to 2025 | ISBE Illinois Report Card |
| [crime-incidents-oak-park.csv](crime-incidents-oak-park.csv) | 13 Oak Park crime data explorer | 13,913 | Every reported offense, January 2022 to August 2026 | Oak Park PD crime dashboard |
| [trees-oak-park.csv](trees-oak-park.csv) | 10 How resilient is our urban forest? | 18,837 | Every public tree with species, genus, size, and block | Village tree inventory |
| [streets-oak-park.geojson](streets-oak-park.geojson) | 07, 10 | 3,343 | Street centerlines with address ranges | Village GIS |
| [alleys-oak-park.csv](alleys-oak-park.csv), [.geojson](alleys-oak-park.geojson) | 07 Are the worst alleys getting fixed? | 640 | Every rated alley segment with 2022-23 and 2024 PCI, reconstruction plan, 2026 CIP | Village alley condition map |
| [capital-projects-oak-park.geojson](capital-projects-oak-park.geojson) | 07 | 244 | 2026 capital improvement and pavement preservation projects, 12 layers | Village capital improvements maps |
| [transit-stops-oak-park.csv](transit-stops-oak-park.csv) | 06 Which bus stops need help? | 225 | Every bus stop and rail station in and at the edge of Oak Park, with routes, trips, shelter, ridership, vulnerability | CTA and Pace GTFS, Pace GIS, CMAP, Village GIS |
| [social-vulnerability-oak-park.geojson](social-vulnerability-oak-park.geojson) | 06 | 53 | Village Social Vulnerability Index by block group | Village GIS |
| [historic-buildings-oak-park.csv](historic-buildings-oak-park.csv) | 11 Build an architecture walking tour | 4,958 | Every surveyed historic building with architect, style, year, designation, photo link | Village Historic Building Dataset |
| [historic-districts-oak-park.geojson](historic-districts-oak-park.geojson) | 11 | 12 | Three historic districts and nine survey areas | Village GIS |
| [parking-restrictions-oak-park.geojson](parking-restrictions-oak-park.geojson) | 05 Can I park here right now? | 1,532 | Every curb segment, permit zone, lot, and garage in the Village's Parking Restriction Areas layer | Village GIS |
| [parking-overnight-ban-oak-park.geojson](parking-overnight-ban-oak-park.geojson) | 05 | 431 | Lots and streets where an overnight pass is not valid | Village GIS |
| [parking-facilities-oak-park.csv](parking-facilities-oak-park.csv) | 05 | 124 | Public lots, garages, EV chargers, car share sites | Village GIS |
| [business-licenses-oak-park.csv](business-licenses-oak-park.csv) | 03 Where is business activity changing? | 2,519 | Every Village business license with dates, category, district, address, coordinates | Village business license dashboard |
| [echo-activity-oak-park.csv](echo-activity-oak-park.csv) | 14 What does ECHO see? | 494 | Aggregate counts of ECHO services by month, category, referral source, weekday, hour block, Feb 2025 on | Village ECHO activity dashboard |

Brief 12 (commissions) uses [`../commissions-diod.csv`](../commissions-diod.csv) at the repo root.

## Regenerating a file

Each script downloads from the source and rewrites its CSV in place. They run with Python 3 and, where noted, `requests` and `openpyxl` (`pip install requests openpyxl`). None needs credentials except as noted.

```text
python3 data/scripts/fetch_assessed_values.py         # stdlib only, a few minutes
python3 data/scripts/fetch_oak_park_levies.py         # stdlib only, downloads ~160 PDFs, about 10 minutes
python3 data/scripts/fetch_cpi_annual.py              # stdlib only
python3 data/scripts/fetch_crashes_oak_park.py        # stdlib only
python3 data/scripts/fetch_crashes_bike_ped_oak_park.py
python3 data/scripts/fetch_crashes_village.py         # stdlib only
python3 data/scripts/fetch_schools_oak_park.py
python3 data/scripts/fetch_d97_attendance_zones.py
python3 data/scripts/fetch_acs_timeseries.py          # needs requests; CENSUS_API_KEY optional; about 8 minutes
python3 data/scripts/fetch_report_card_d97_d200.py    # needs requests and openpyxl; downloads ~200 MB of workbooks
python3 data/scripts/fetch_crime_incidents.py         # stdlib only; update DASHBOARD_URL if the Village republishes
python3 data/scripts/fetch_streets_oak_park.py        # stdlib only
python3 data/scripts/fetch_trees_oak_park.py          # stdlib only; uses streets-oak-park.geojson
python3 data/scripts/fetch_alleys_oak_park.py         # stdlib only
python3 data/scripts/fetch_capital_projects_oak_park.py
python3 data/scripts/fetch_transit_stops_oak_park.py  # stdlib only; downloads ~110 MB of GTFS, two to three minutes
python3 data/scripts/fetch_social_vulnerability_oak_park.py
python3 data/scripts/fetch_historic_buildings_oak_park.py
python3 data/scripts/fetch_historic_districts_oak_park.py
python3 data/scripts/fetch_parking_restrictions_oak_park.py
python3 data/scripts/fetch_parking_overnight_ban_oak_park.py
python3 data/scripts/fetch_parking_facilities_oak_park.py
python3 data/scripts/fetch_business_licenses.py       # stdlib only; reads the current dashboard URL from the Village page
python3 data/scripts/fetch_echo_activity.py           # stdlib only; issues grouped counts only, never rows
```

Sources revise history, so a regenerated file will not always match the committed one row for row. The notes below say where that matters.

## File details

### assessed-values-oak-park.csv

Every parcel in Oak Park Township (coterminous with the Village) for assessment years 2025 and 2026: Assessor values joined to building characteristics and the property address. One row per PIN per year, 18,735 parcels in 2025 and 18,733 in 2026.

Source: Cook County Assessor on the Cook County Open Data Portal. Assessed Values [uzyt-m557](https://datacatalog.cookcountyil.gov/resource/uzyt-m557.json), Residential Improvement Characteristics [x54s-btds](https://datacatalog.cookcountyil.gov/resource/x54s-btds.json), Residential Condominium Unit Characteristics [3r7i-mrz4](https://datacatalog.cookcountyil.gov/resource/3r7i-mrz4.json), Parcel Addresses [3723-97qp](https://datacatalog.cookcountyil.gov/resource/3723-97qp.json). Filter: `township_name=Oak Park` (township code 27), simple equality filters paged 5,000 at a time.

Columns: `pin`, `year`, `class` (2xx residential, 299 condo, 3xx multifamily, 5xx commercial, EX exempt, 1xx vacant), `township_code`, `township_name`, `nbhd` (Assessor neighborhood), `mailed_bldg`/`mailed_land`/`mailed_tot`, `certified_bldg`/`certified_land`/`certified_tot` (after Assessor appeals), `board_bldg`/`board_land`/`board_tot` (after Board of Review; blank for 2026), `building_sqft`, `land_sqft`, `year_built`, `units`, `beds`, `full_baths`, `half_baths`, `cards` (building cards aggregated), `residential_type`, `sqft_source`, `condo_building_sqft`, `condo_pct_ownership`, `condo_est_unit_sqft` (building sqft times ownership share, rough), `is_parking_or_common`, `prop_address`, `prop_city`, `prop_zip`, `address_year`.

Caveats: these are Cook County assessed values (10 percent of market value for residential), not market values. 2026 is the new triennial reassessment; certified values are published, Board of Review values are not, and total certified value rose about 20 percent from 2025. The Assessor's condo dataset has unit square feet for only about 29 percent of Oak Park condo units, so `building_sqft` is blank for most class 299 rows; `condo_est_unit_sqft` covers about 90 percent but is only within roughly 10 to 20 percent of actual, so label it as an estimate in any per-square-foot analysis. Vacant land and non-residential classes have no characteristics. About 90 PINs have more than one building card; their square feet, beds, and baths are summed. Owner and mailing names are deliberately excluded.

### oak-park-levies.csv

Tax extension, levy, rate, and EAV for each of the eight taxing agencies specific to Oak Park, tax years 2006 through 2025, from the Cook County Clerk's Agency Tax Rate Reports. 20 years times 8 agencies.

Source: Cook County Clerk, [Tax Extension and Rates](https://www.cookcountyclerkil.gov/property-taxes/tax-extension-and-rates). The script calls the POST-only report API (`getreportdata`, `viewreport`) and parses the PDFs with its own text extractor. Agencies: 020180000 Township, 020180002 Township General Assistance, 020180004 Township Mental Health Board, 030920000 Village, 030920001 Library, 040580000 District 97, 042020000 District 200, 050760000 Park District.

Columns: `tax_year` (billed the following calendar year), `agency_id`, `agency_code`, `agency_name`, `agency_label`, `agency_type`, `eav`, `total_levy` (the report's AGENCY GRAND TOTAL), `final_rate` (per 100 dollars of EAV), `extension` (amount billed), `oak_park_eav_share` (1.0 except District 200, where it is Oak Park EAV over district EAV), `oak_park_extension` (extension times share; sum this column for the Oak Park total), `report_format` (legacy 2006 to 2023, modern 2024 on), `source_pdf`, `note`.

Caveats: District 200 also serves River Forest, so its `eav`, `total_levy`, and `extension` are the full district and `oak_park_extension` is prorated by EAV share (72 to 76 percent); the rate is not prorated. All 152 rows that overlap an independent 2006 to 2024 check match to the cent. Tax year 2026 is not yet published. From 2024 the Clerk folds the Library into the Village report and the two Township funds into the Township report; those rows come from fund-section totals (see `note`). Extension is what was billed, not collected. Countywide agencies (Cook County, Forest Preserve, Water Reclamation, Triton College, mosquito abatement) are not included.

### cpi-annual.csv

Annual average CPI-U (all items, U.S. city average, 1982-84 = 100) for 2000 through 2025, with a multiplier to restate each year in 2025 dollars.

Source: FRED series [CPIAUCSL](https://fred.stlouisfed.org/series/CPIAUCSL), annual-average CSV. Columns: `year`, `cpi_u_annual_avg`, `to_latest_year_dollars` (2025 CPI divided by that year's CPI), `latest_year`. National series, not Chicago-area (CUURS23ASA0 is the Chicago series).

### crashes-oak-park.csv

Every IDOT-reported motor vehicle crash in Oak Park, 2019 through 2025, one row per crash with coordinates. Yearly counts: 2019 1,552; 2020 1,127; 2021 1,228; 2022 1,216; 2023 1,416; 2024 1,423; 2025 1,369.

Source: Illinois Department of Transportation annual statewide crash layers on the [IDOT open data portal](https://gis-idot.opendata.arcgis.com/) (feature services `Crashes2019` through `CRASHES___2025` under `services2.arcgis.com/aIrBD8yn1TDTEXoz`). Filter: `CityName = 'OAK PARK'`.

Key columns: `crash_year`, `crash_date`, `day_of_week`, `crash_hour`, `time_of_crash`, `crash_severity` (Property Damage, Injury, Fatal), `crash_injury_severity` (KABCO), `total_injured`, `total_fatals`, `a_injuries`, `b_injuries`, `c_injuries`, `no_injuries`, `type_of_first_crash` (Angle, Turning, Pedestrian, Pedalcyclist, Fixed Object, and so on), `pedestrian_involved` and `pedalcyclist_involved` (Y/N derived from the type of first crash), `cause1`, `cause2`, `lighting_cond`, `weather_cond`, `road_surface_cond`, `intersection_related`, `traffic_control_device`, `hit_and_run`, `number_of_vehicles`, `latitude`, `longitude`, `location_status` (ok, missing, outside_oak_park), `icn` (IDOT crash number, joins to the bike/ped file). All remaining IDOT fields are kept in snake_case; `highway_or_street_name`, `at_intersection_with`, and `address_no` exist only in the 2025 layer.

Caveats: 2019 to 2024 carry no street names. There is no pedestrian or bicyclist count field; the involved flags reflect only the type of first crash, so use the bike/ped file below as the authoritative list. 39 rows have no located point (coordinates blank); 31 rows have coordinates outside Oak Park despite the city field, mostly in 2020. Field names drift between years and were merged. IDOT may still revise 2025.

### crashes-bike-ped-oak-park.csv

IDOT bicycle and pedestrian crashes in Oak Park, 2020 through 2024 (33, 57, 45, 54, 54 per year; 142 pedestrian, 101 bicyclist), one row per crash with coordinates.

Source: IDOT [Bicycle and Pedestrian Crashes](https://services2.arcgis.com/aIrBD8yn1TDTEXoz/arcgis/rest/services/BikePedCrash/FeatureServer/0) layer. Filter: `CrashReportCity = 'OAK PARK'`.

Key columns: `icn`, `statistical_yearof_crash`, `type_of_first_crash` (Pedestrian or Pedalcyclist), `crash_injury_severity`, `is_injury`, `is_fatal_injury`, `crash_time_hour`, `crash_time_mins`, `crash_day_of_week`, `is_intersection`, `intersection_streets`, `is_hit_and_run`, `contrib_cause_prim`, `contrib_cause_sec`, `lighting_cond`, `weather_cond`, `is_pedestrain` (source spelling kept), `is_pedalcyclist`, `dooring_with_pedalcyclist`, `total_fatals`, `total_injured`, `latitude`, `longitude`.

Caveats: no 2019 or 2025. The source has no crash date, only year, day of week, and time.

### crashes-village-oak-park.csv

Every public-roadway crash reported to the Oak Park Police Department, January 1, 2024 through August 31, 2026, one row per crash report with coordinates, severity, KABCO injury counts, crash type, contributing causes, road and weather conditions, and hit-and-run flag. Yearly counts: 2024 1,724; 2025 1,716; 2026 (Jan to Aug) 1,200.

Source: Village of Oak Park Police Department "Traffic Crash - Public" Power BI dashboard, linked from [opendata.oak-park.us/TrafficCrash](https://opendata.oak-park.us/TrafficCrash/). The dashboard has no export button; the script replays the report's public query API and joins the crash, crash-type, cause, and geocode tables locally.

Key columns: `record_id`, `report_number` (police report, e.g. "24 00002"), `crash_id` (joins to IDOT `agency_report_number` for city-investigated crashes), `idot_crash_number`, `date`, `time`, `occurred_at`, `location`, `street_number`, `street_name`, `cross_street`, `at_intersection`, `intersection_related`, `hit_and_run`, `crash_severity` (Property Damage, Injury, Fatal), `crash_injury_severity` (KABCO), `crash_mode` (Car, Pedestrian, Pedalcyclist), `crash_type`, `total_units`, `num_motor_vehicles`, `dooring_pedalcyclist`, `damage` (band), `fatalities`, `a_injuries`, `b_injuries`, `c_injuries`, `total_injured`, `cause1`, `cause2`, code and label pairs for `traffic_control`, `device_condition`, `weather`, `lighting`, `trafficway`, `road_surface`, `flow_condition`, `road_defects`, `beat_zone`, `post_district`, `latitude`/`longitude` (what the dashboard map plots), `latitude_geocoded`/`longitude_geocoded` (address geocode), `state_plane_x`/`state_plane_y`.

Caveats: 2024 onward only. Includes crashes below IDOT's reporting threshold, so totals run 20 to 25 percent above the IDOT file, but it lacks the roughly 280 state-police crashes a year on I-290 that IDOT carries. About 55 percent of rows match an IDOT row by report number for 2024 and 2025; dates agree except for 25 rows. A few rare condition codes have no label. One amended report appears twice. Recent weeks are incomplete: crashes post about 7 days after they happen and the monthly export lags about 15 days. Damage band labels are inferred from the state's reporting threshold.

### schools-oak-park.csv

Every K-12 school located in Oak Park, public and ISBE-registered nonpublic: 8 D97 elementary, 2 D97 middle, 1 D200 high, 10 private, all geocoded.

Source: ISBE [Directory of Educational Entities 2025-26](https://www.isbe.net/Documents/2025-26-Directory-Ed-Entities.xlsx) (from the [Data Analysis and Directories](https://www.isbe.net/Pages/Data-Analysis-Directories.aspx) page), filtered to city Oak Park. Coordinates from the Village's [school footprints](https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/Elementary_and_Middle_Schools/FeatureServer/0) (D97, polygon centroids) and [Cook County Address Points](https://datacatalog.cookcountyil.gov/resource/78yw-iddh.json) (everything else).

Columns: `name`, `type` (public elementary, public middle, public high, private), `district` (D97, D200, or ISBE affiliation), `affiliation`, `grades_served`, `address`, `city`, `zip`, `latitude`, `longitude`, `geocode_method`, `isbe_rcdts`, `nces_id`, `website`, `source`, `notes`.

Caveats: two Montessori schools are preschool and kindergarten only, and Tru-Source ALF is an alternative learning facility in an office suite; all three are flagged in `notes`. Schools outside Oak Park that serve Oak Park students are not included.

### d97-attendance-zones.geojson

District 97 elementary attendance zone polygons (Mann, Hatch, Whittier, Holmes, Beye, Lincoln, Irving, Longfellow), EPSG:4326, as returned by the Village's [Elementary_Attendance_Zones](https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/Elementary_Attendance_Zones/FeatureServer/0) service. Fields: `OBJECTID`, `Name`, `PopupInfo` (short school name), `Shape__Area`, `Shape__Length`. Elementary only; there is no middle-school zone layer. Name strings are inconsistent, so match on `PopupInfo`.

### acs-oak-park-timeseries.csv

Key American Community Survey 5-year indicators for Oak Park village, Cook County, and Illinois for every ACS 5-year vintage from 2009 (2005-2009) through 2024 (2020-2024), long format with margins of error.

Source: U.S. Census Bureau ACS 5-year detailed tables B01003, B01002, B19013, B25077, B25064, B25003, B03002, B25034, B25035, B15003 (B15002 before 2012). The script uses the official [Census API](https://api.census.gov/data/2024/acs/acs5) when `CENSUS_API_KEY` is set (free key at [api.census.gov/data/key_signup.html](https://api.census.gov/data/key_signup.html)); without a key it reads the same tables from the data.census.gov table endpoint (2010 to 2024) and the [2005-2009 Summary File](https://www2.census.gov/programs-surveys/acs/summary_file/2009/). Geographies: place 54885 in state 17, county 17031, state 17.

Columns: `geography`, `geoid` (16000US1754885, 05000US17031, 04000US17), `vintage` (last year of the 5-year period), `period`, `table`, `variable`, `label`, `estimate`, `margin_of_error` (90 percent), `source`. Variables: total population, median age, median household income, median home value, median gross rent, occupied units by tenure, race and ethnicity (total, white non-Hispanic, Black non-Hispanic, Asian non-Hispanic, Hispanic), median year built, all year-built categories, population 25 and over by degree, plus two derived rows: `DERIVED_BACHELORS_OR_HIGHER_25PLUS` and `DERIVED_UNITS_BUILT_1939_OR_EARLIER`.

Caveats: dollar figures are in each vintage's own dollars; use cpi-annual.csv to adjust. Overlapping 5-year windows are not independent samples. Use the derived rows for pre-1940 housing and bachelor's-or-higher, because the underlying line numbers change between vintages. Median year built is bottom-coded at 1939 by the Census; Oak Park sits at that bottom code through 2021 and reads 1938 from 2022 on. Spot checks match Census Reporter and data.census.gov.

### report-card-d97-d200.csv

Illinois Report Card indicators 2018 through 2025 for Oak Park ESD 97 and Oak Park-River Forest SD 200 (district rows and each school), eleven nearby comparison districts, and the statewide row. One row per entity per year.

Source: ISBE [Illinois Report Card Data Library](https://www.isbe.net/Pages/Illinois-State-Report-Card-Data.aspx), yearly "Report Card Public Data Set" workbooks. Districts: D97 (RCDTS 060160970020000), D200 (060162000130000), River Forest 90, Forest Park 91, Berwyn North 98, Berwyn South 100, Elmhurst 205, Evanston 65, Evanston Twp HS 202, Riverside 96, Riverside-Brookfield HS 208, Proviso Twp HS 209, Lyons Twp HS 204.

Columns: `year`, `rcdts`, `level` (state, district, school), `district_name`, `school_name`, `type` (elementary, high, unit), `district_type`, `school_type`, `enrollment`, `pct_low_income`, `pct_el`, `pct_iep`, `chronic_absenteeism_pct`, `pupil_teacher_ratio_elementary`, `pupil_teacher_ratio_high_school`, `avg_class_size_all_grades`, `instructional_expenditure_per_pupil`, `operating_expenditure_per_pupil`, `site_based_total_per_pupil_expenditure` (2019 on), `ela_proficiency_pct`, `math_proficiency_pct`, `science_proficiency_pct`, `grad_rate_4yr_pct` (high schools), `ninth_grade_on_track_pct`, `teacher_avg_salary`, `teacher_retention_rate_pct`, `summative_designation` (schools only), `source_file`.

Caveats: 2020 has no assessments (COVID), so proficiency is blank. 2025 proficiency is not comparable with earlier years: Illinois adopted new performance levels and moved the high school test from SAT to ACT, and statewide ELA proficiency jumped from 39.4 to 52.4. Finance columns lag one year (2025 reports FY2024). 2018 lacks site-based spending and science percentage; 2019 lacks the 9th-grade-on-track percentage. Spot checks against ISBE's 2025 report card PDFs match.

### crime-incidents-oak-park.csv

One row per reported offense in Oak Park, January 1, 2022 through September 1, 2026 (August 2026 is the last complete month), with date, time, NIBRS classification, block-level location, police post and zone, and coordinates. 13,913 offense rows across 13,500 distinct incidents.

Source: Village of Oak Park Police Department "Crime Incident - Public" Power BI dashboard, linked from the Village's [Crime Maps](https://www.oak-park.us/Public-Safety/Police-Department/Reports-Maps/Crime-Maps) page. The dashboard has no export button; the script replays the same public query the dashboard page issues and reads the current report IDs at runtime.

Columns: `incident_id`, `incident_id_label` (YY-NNNNN), `charge_id` (unique key), `record_id`, `date`, `time`, `occurred_at`, `hour`, `occurred_at_label`, `incident_type` (NIBRS category), `offense_description`, `offense_code`, `offense_description_code`, `offense_group` (A or B), `crime_against` (Person, Property, Society), `ucr_code`, `location` (block or intersection), `block_begin_number`, `block_odd_number`, `post`, `post_label`, `zone` (1 to 8), `zone_label`, `latitude`, `longitude`.

Caveats: one row per offense, not per incident; count distinct `incident_id` for incident counts. Locations are generalized to the block or intersection, and coordinates are geocoded from that, so many rows share a point. Classifications are preliminary and the Village revises history (between February and September 2026, 42 rows were added to earlier months, 7 removed, and 3 re-geocoded), so a regenerated file will not match this one exactly. The dashboard lags the calendar, so treat the current and prior month as partial. Only NIBRS-classified offenses reported to Oak Park police, not all calls for service. A time of 00:00:00 usually means the time is unknown. The dashboard's embed key changed once in 2026; if the script returns 401, update `DASHBOARD_URL` from the Crime Maps page.

### trees-oak-park.csv

Every tree in the Village's public tree inventory, one row per point, with a derived genus and block: 18,837 trees, 137 species, 69 genera, 814 blocks.

Source: Village of Oak Park GIS, [VOP_TreeInventory_PUBLICVIEW](https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/VOP_TreeInventory_PUBLICVIEW/FeatureServer/0) (portal item 792e798104b140c3b8063e86dc09d991). Block comes from the nearest non-alley street centerline in streets-oak-park.geojson.

Columns: `object_id`, `common_name`, `latin_name`, `genus`, `genus_source` (latin, or common_name_lookup for the 358 rows with no Latin name), `dbh_in`, `height_ft` and `spread_ft` (coded in 5 or 10 foot steps), `latitude`, `longitude`, `nearest_street`, `block` (hundred block plus street, e.g. 900 N AUSTIN BLVD), `block_distance_ft`, `global_id`.

Caveats: the source has no condition, age, planting year, or address. Block is a snap to the nearest centerline (mean 23 ft; 44 trees over 100 ft), so corner trees may land on the cross street. Latin names are inconsistent for some species. Villagewide the top species (Norway maple) is 8.8 percent and the top genus (Acer) is 20.5 percent.

### streets-oak-park.geojson

Village street centerlines with address ranges, 3,343 segments and 117 street names, used for block assignment and address lookup in briefs 08 and 09.

Source: Village of Oak Park GIS, [Streets_Centerlines](https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/Streets_Centerlines/FeatureServer/0). Properties: `fid`, `feature_id`, `address_left_from`, `address_left_to`, `address_right_from`, `address_right_to` (-1 when no addresses), `street_name`, `length_ft`. 755 segments are alleys and 856 have no address range.

### alleys-oak-park.csv and alleys-oak-park.geojson

Every rated alley segment with its 2022-2023 and 2024 Pavement Condition Index, joined to the 2025 to 2029 reconstruction plan and the 2026 capital program: 640 segments, 621 distinct alley ids. The GeoJSON has line geometry; the CSV has the same fields plus centroid coordinates.

Source: Village of Oak Park web map "Alley Condition Ratings and Reconstruction Priorities" (portal item 8b9855b623b64b65bd71a5269a287b77), served as VOP MapServer layers [157](https://utility.arcgis.com/usrsvcs/servers/4cff1aaefa364b57b8c70d5c606f2088/rest/services/VOP/AGOL_VOP_Project/MapServer/157) (conditions) and 164 (reconstruction plan), plus the Alley Improvements layer of the [2026 Capital Improvements](https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/2026_CIP_/FeatureServer/5) map.

Columns: `alley_id` (e.g. 178-N), `alley_name`, `section_id`, `pid`, `from_street`, `to_street`, `surface` (PCC concrete, AC asphalt, PP and BR undefined), `width_ft`, `slab_length_ft`, `slab_width_ft`, `construction_date`, `construction_year`, `general_condition`, `pci_2022_2023`, `pci_2024`, `pci_change`, `pci_2024_band` (0-39, 40-59, 60-79, 80-100, the Village map's classes), `scheduled_build_year` (2025 to 2029, blank if not on the plan), `in_2026_cip`, `length_ft`, `object_id`.

Caveats: `construction_year` 1900 (92 rows) means unknown, and construction dates are not maintained. The source layer's description says 2022-2023 while its name says 2024; both PCI fields are kept. 164 segments are rated 39 or below; 51 of those are scheduled or in the 2026 program and 113 are not.

### capital-projects-oak-park.geojson

All twelve operational layers from the Village's two project web maps in one file, tagged by `project_type`: 244 features covering resurfacing, RRFBs, water and sewer, streetscape, alley improvements, sewer lining, proposed greenways, patching, crack fill, microsurfacing, rejuvenator, and proposed alley reconstruction.

Source: [2026 Capital Improvements](https://www.arcgis.com/home/item.html?id=525f3c4a968c4e1f8f3eeeda2f8d6eac) web map layers under `services5.arcgis.com/aymthbPDQOcCnuwg` (2026_CIP_, SewerLining, Proposed_Neighborhood_Greenways, PavementPreservationAGOL_gdb) plus the alley reconstruction plan layer above. Properties on every feature: `project_type`, `program`, `source_layer`, `source_object_id`, `name`, `alley_id`, `build_year`, `length_ft`; other fields kept where the layer has them (street, limits, road class, AADT, 2021 PCI and IRI, treatment years). The resurfacing and sewer lining layers carry no names, and the 2026 layers have no year field beyond the program name.

### transit-stops-oak-park.csv

Every CTA and Pace bus stop and every CTA and Metra rail station in and just across the Oak Park boundary, one row per stop: 225 rows (87 CTA bus, 130 Pace bus, 7 CTA rail, 1 Metra), 147 inside the Village.

Sources: [CTA GTFS](https://www.transitchicago.com/downloads/sch_data/google_transit.zip) and [Pace GTFS](https://www.pacebus.com/gtfs) (August 2026 feed) for stops, routes, and weekday trips; the Village's Modes of Transportation layers (2019 Pace stop snapshot, Metra station) and [Municipal Boundary](https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/Municipal_Boundary/FeatureServer/0); Pace's GIS server for the [2015 shelter inventory](https://maps.pacebus.com/arcgis/rest/services/StrategicServices/Shelters_Posted_Stops/MapServer/0) and [Spring 2026 passenger counts](https://maps.pacebus.com/arcgis/rest/services/StrategicServices/APC/MapServer/0); CMAP's [transit rider vulnerability](https://services5.arcgis.com/LcMXE3TFhi1BSaCY/arcgis/rest/services/TRVI_Data_Data_Hub/FeatureServer) layers (2024). Joins are by Pace stop id where one exists, otherwise nearest point within 10 to 40 m.

Columns: `stop_type`, `agency`, `stop_id`, `stop_code`, `stop_name`, `stop_desc`, `latitude`, `longitude`, `in_oak_park`, `routes`, `route_names`, `weekday_trips`, `wheelchair_boarding` (CTA only), `pace_shelter_2015`, `pace_shelter_type`, `pace_shelter_corner`, `cmap_sheltered_2024`, `cmap_trvi` (1 to 3, higher is more vulnerable to extreme heat), `cmap_trvi_category`, `cmap_mean_svi_norm`, `cmap_mean_no_vehicle_norm`, `cmap_match_m`, `apc_ons`, `apc_offs`, `apc_total`, `apc_routes`, `apc_match_m`, `village_2019_stop`, `village_2019_routes`, `source`.

Caveats: CTA marks every bus stop as wheelchair accessible, so that field only informs the rail rows (Harlem/Lake is the only accessible CTA station in Oak Park). Pace's GTFS has no shelter or accessibility fields and the Village's 2019 layer has them but empty, so shelter comes from Pace's 2015 inventory (6 stops) and CMAP's 2024 layer (14 sheltered of 141); they disagree on two stops. Pace passenger counts cover 52 of 87 in-Village Pace stops and should be read as a ranking. CTA publishes no stop-level ridership. Stops across Harlem, North, and Austin are kept but flagged `in_oak_park` = N. Regenerating picks up the current schedule, so counts will drift.

### social-vulnerability-oak-park.geojson

The Village of Oak Park's Social Vulnerability Index by Census block group, 53 polygons.

Source: Village of Oak Park, [ClimateActionPlan_Service layer 35](https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/ClimateActionPlan_Service/FeatureServer/35), the composite behind the Village's Social Vulnerability map. Properties: `NAME`, `GEOID`, fifteen 1-to-5 indices (poverty, seniors, children under 5, disability, rented building age, race, frontline workers, no vehicle, single parent, rent burden, home cost burden, food stamps, unemployment, language), `Composite_Index` (their sum, 23 to 56), plus added `geoid12` and `tract_block_group`. The Village does not publish the method or vintage; the indices are ranks within Oak Park, not percentages, and the underlying ACS is probably 2014-2019.

### historic-buildings-oak-park.csv

Every surveyed historic resource in the Village's Historic Building Dataset, one row per building: 4,958 rows with coordinates, architect, style, construction date, designation flags, survey rating, photo and survey-form links, and the historic district containing the point.

Source: Village of Oak Park, [Historic Building Dataset](https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/OPHR_FGDB_V3_PUBLIC/FeatureServer/0) (portal item 5a02234ddbed497a809810430a61853a); district assignment by point-in-polygon against VOP MapServer layer 13.

Columns: `objectid`, `address`, `building_historical_name`, `building_current_name`, `architect` (blank for 3,302), `builder`, `developer`, `significant_owner`, `style_primary`, `style_secondary`, `form`, `construction_decade`, `construction_year` (blank for 98), `construction_year_certainty`, `construction_year_source`, `resource_rating` (Contributing 4,473, Non-Contributing 430), `is_individually_eligible`, `local_landmark` (65), `local_listed_district`, `local_listing`, `nr_landmark`, `nr_listed_individually` (8), `nr_listed_district`, `nr_listing`, `eligibility_remarks`, `previous_survey_name`, `historical_summary`, `notes`, `references`, `image_url`, `form_url`, `latitude`, `longitude`, `historic_district` (Frank Lloyd Wright 1,898, Ridgeland-Oak Park 1,607, Gunderson 291, blank 1,162).

Caveats: one construction year is 917, a source typo for 1917. Listing text is free text with inconsistent district spellings. Eight addresses appear twice. 4,380 addresses match `prop_address` in assessed-values-oak-park.csv exactly; the Assessor's `year_built` differs by more than ten years on 419 of them, and the historic file is the researched value. Image and form links depend on the Village's apps.oak-park.us hosting.

### historic-districts-oak-park.geojson

Oak Park's three historic district polygons (Frank Lloyd Wright, Ridgeland-Oak Park, Gunderson) plus its nine historic resource survey areas, 12 features.

Source: VOP MapServer [layer 13](https://utility.arcgis.com/usrsvcs/servers/4cff1aaefa364b57b8c70d5c606f2088/rest/services/VOP/AGOL_VOP_Project/MapServer/13) Historic Districts and layer 155 Historic Survey Areas. Properties as returned by the services plus `layer` (district or survey_area) and `name` (whitespace trimmed). The districts' ESTABLISHED, DESCRIPTION, and STYLE fields are empty in the source, and the survey areas' web links are truncated at 80 characters.

### parking-restrictions-oak-park.geojson

Every feature in the Village's Parking Restriction Areas layer: 1,016 daytime curb segments, 390 overnight permit streets, 25 permit zones, 97 lots, and 4 garages, 1,532 polygons.

Source: Village of Oak Park GIS, VOP MapServer [layer 42](https://utility.arcgis.com/usrsvcs/servers/4cff1aaefa364b57b8c70d5c606f2088/rest/services/VOP/AGOL_VOP_Project/MapServer/42), the single layer behind the Village's Daytime Parking Restrictions, Overnight Parking Restrictions, and Modes of Transportation web maps.

Properties: source fields in snake_case: `production_notes` (which map the feature belongs to), `parking_area_type` (ONSTREET, LOT, ZONE, GARAGE), `parking_area_name`, `classification` (PARKING or NOPARKING), `days_of_enforcement`, `enforcement_times`, `duration_restriction`, the secondary-rule fields, `is_permit_parking`, `permit_name`, `is_school_zone`, `is_tow_away`, `is_ev_charging`, `payment_device`, `payment_type`, `has_accessible_spaces`, `accessible_space_count`, `seasonal_restriction`, `location_description` (the sign text on daytime rows, e.g. "3HR 8A-8P M-F"), `guideline_url`, `max_parking_spaces`, plus derived `restriction_group` (daytime_on_street, overnight_permit_street, permit_zone, lot, garage) and `permit_zone` (Y1 to Y9, Z1 to Z9).

Caveats: the daytime hours live only in `location_description`; `enforcement_times` is blank on almost every daytime row, so the rule has to be parsed from sign text (128 distinct strings). Accessible-space fields, rates, and ordinance references are empty everywhere; capacity appears on 5 rows. About 1,036 of 2,486 addressed blocks have no restriction polygon near their midpoint, which means unrestricted, unmapped, or both. The layer's own note says to follow posted signs. Editor usernames were dropped.

### parking-overnight-ban-oak-park.geojson

The two layers behind the printed Overnight Parking Map and the "No Overnight Passes" map: 104 lot polygons and 327 street lines where an overnight pass is not valid. The overnight ban itself is villagewide, 2:30 to 6 a.m., per the Village's parking guidelines page.

Source: VOP MapServer layers 9 (Overnight Parking Ban Lot) and 10 (Overnight Parking Ban On Street). Properties: `ban_type` (lot or on_street), `source_layer`, `parking_area_type`, `parking_area_name`, `parking_enforcement`, and on street rows `status`, `classification`, `days_of_enforcement`, `enforcement_times`. 188 of the 327 street segments are marked Migrated with rule fields blank; the street layer has no street names.

### parking-facilities-oak-park.csv

One row per public lot, garage, EV charger, and car share site: 124 rows (97 lots, 4 garages, 11 public chargers, 3 Village-vehicle chargers, 9 car share).

Source: VOP MapServer layer 42 filtered to lots and garages, layer 4 (EV charging stations), layer 36 (Village-vehicle chargers), layer 3 (car share sites), and layer 9 for the overnight-map flag. Columns: `facility_type`, `facility_id` (lot number), `name`, `address` (parsed from the location text, 93 of 101 lots and garages), `latitude`, `longitude` (centroid), `ownership`, `maintained`, `permit_types` (Day, Night, 24-hour, Monthly), `is_permit_parking`, `payment_device`, `payment_type`, enforcement fields, `max_parking_spaces`, `has_accessible_spaces`, `accessible_space_count`, `is_commuter_parking`, `is_ev_charging`, `seasonal_restriction`, `on_overnight_ban_map`, `overnight_ban_area_type`, `guideline_url`, `weblink`, `description`, `source_layer`, `source_object_id`.

Caveats: no capacity except 5 District 97 lots; no accessible-space counts; hours and rates only where the enforcement fields carry them (a handful of lots and one garage). A few lots appear twice as separate polygons. The per-lot guideline links point at old Village URLs that no longer resolve.

### business-licenses-oak-park.csv

Every business license record in the Village's CityView system as of September 8, 2026: 2,519 rows (1,426 active, 1,093 inactive) with start and end dates, three levels of category, license classes, home-based, liquor, and mobile flags, Village business district, address, zoning, and coordinates for 2,072 storefront addresses.

Source: Village of Oak Park "Business License - Public" Power BI dashboard, linked from [opendata.oak-park.us/BusinessLicense](https://opendata.oak-park.us/BusinessLicense/). No export button; the script reads the current dashboard URL from the Village page, replays the report's public query API, and joins the license, address, GIS, category, and class tables locally.

Columns: `record_id`, `license_number`, `name`, `doing_business_as`, `license_status`, `issued_status` (Renewed or Not Renewed for the latest license year), `date_start`, `start_year`, `date_end`, `end_year`, `first_issued_date`, `last_issued_date`, `last_issued_expired_date`, `license_entered_date`, `last_issued_entered_date`, `major_category` (Retail, Service, Retail and Service, Other) with code, `general_category` (11 groups) with code, `sub_category` (140 types) with code, `sub_category_group`, `license_classes` (liquor class, food risk category, square-footage class), `home_based`, `liquor`, `mobile`, `business_district` (12), `street_address`, `unit`, `address`, `street` (for corridor grouping), `address_status`, `zoning`, `land_use_code`, `latitude`, `longitude`, `cityview_link`.

Caveats: a license is not a storefront. 262 rows are home-based businesses; their coordinates are deliberately blank, matching the Village's own map (a script flag restores them). 180 rows have no Oak Park address (contractors and outside vendors). The license year runs April 1 to March 31, so `last_issued_date` is a renewal, not an opening, and 361 active licenses have an expired last issue (lapsed, not closed). Closings are recorded only from 2015; use 2017 onward, and treat 2019 (194 starts, 159 ends) as an administrative cleanup. A start date of 1900-01-01 means unknown. Nine Village test records were dropped.

### echo-activity-oak-park.csv

Aggregate counts of services logged by E.C.H.O. (Engaging Community for Healthy Outcomes), the Village's care-coordination and unarmed-response program in Neighborhood Services, February 2025 through September 2026 (September partial): 1,598 services, published as five small tables stacked in long format, 494 rows.

Source: Village of Oak Park "ECHO Activity - Public" Power BI dashboard, linked from [opendata.oak-park.us/EchoActivity](https://opendata.oak-park.us/EchoActivity); program page on [oak-park.us](https://www.oak-park.us/Community/Community-Services/E.C.H.O-Engaging-Community-for-Healthy-Outcomes). The script issues only grouped COUNT queries, the same ones the dashboard's charts issue, so no individual record is ever downloaded.

Columns: `breakdown` (service_by_month, referral_by_month, service_by_weekday, service_by_time_block, referral_by_service), `month`, `weekday`, `time_block` (four-hour block), `referral_source` (Police Department, Resident Contact, Fire Department, Community Engagement, Village departments, Community Partner, Business, Emergency Housing), `service` (Unhoused Resident, Behavioral Health, Senior Services, Housing, Youth/Family Services, Financial Support, Domestic Violence, Medical Support, Food Services, Other, blank), `count` (integer or `<5`). Only the columns that apply to a breakdown are filled.

Privacy: the source has no location, age, name, or note fields, so nothing below Village level exists. The two month-level tables are unsuppressed (the dashboard's own grain). The weekday, hour-block, and referral-by-service tables suppress cells under 5 and apply complementary suppression (73 cells hidden). The dashboard's Dataset button offers a row-level file (timestamp, service, referral source); this repo deliberately does not cache it.

Caveats: a service is one logged contact, not one person, so counts are workload, not caseload. The timestamp is when staff logged the referral: 97 percent fall on weekdays and about a quarter carry a 2 a.m. to 6 a.m. stamp, which does not match a business-hours team, so ask the ECHO team what the field means before reading hour of day. A blank service category appears from July 2026. September 2025 is double its neighbors for an unknown reason. The current month is partial; the report refreshes daily.
