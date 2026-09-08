# Data

Two things live here: the [Oak Park Civic Data Catalog](open-data-catalog.md), a categorized list of Village, Cook County, state, regional, and federal data sources with links and Oak Park filters, and the cached datasets below, which are the ones the [starter projects](../starter-projects/README.md) use. The cached files exist so teams can work on event day without depending on live APIs. Every file was pulled from a primary public source on September 8, 2026 by a script in [`scripts/`](scripts/), and can be regenerated with that script.

## Cached datasets

| File | Used by | Rows | Coverage | Source |
| --- | --- | ---: | --- | --- |
| [assessed-values-oak-park.csv](assessed-values-oak-park.csv) | 01 Is my assessment fair? | 37,468 | Every Oak Park parcel, 2025 and 2026 | Cook County Assessor (Socrata) |
| [oak-park-levies.csv](oak-park-levies.csv) | 02 Where does my tax dollar go? | 160 | 8 Oak Park taxing agencies, tax years 2006 to 2025 | Cook County Clerk tax extension reports |
| [cpi-annual.csv](cpi-annual.csv) | 02, 04 | 26 | CPI-U annual averages 2000 to 2025 with 2025-dollar multipliers | FRED CPIAUCSL |
| [crashes-oak-park.csv](crashes-oak-park.csv) | 03 Can a kid bike to school safely? | 9,331 | All Oak Park crashes 2019 to 2025 | IDOT annual crash layers |
| [crashes-bike-ped-oak-park.csv](crashes-bike-ped-oak-park.csv) | 03 | 243 | Bike and pedestrian crashes 2020 to 2024 | IDOT bike/ped crash layer |
| [schools-oak-park.csv](schools-oak-park.csv) | 03, 06 | 21 | Every K-12 school in Oak Park, public and private, with coordinates | ISBE directory, Village GIS, county address points |
| [d97-attendance-zones.geojson](d97-attendance-zones.geojson) | 03 | 8 | D97 elementary attendance zone polygons | Village GIS |
| [acs-oak-park-timeseries.csv](acs-oak-park-timeseries.csv) | 04 Oak Park over time | 1,554 | 35 ACS indicators for Oak Park, Cook County, Illinois, every 5-year vintage 2009 to 2024 | U.S. Census Bureau ACS |
| [report-card-d97-d200.csv](report-card-d97-d200.csv) | 06 How are our schools doing? | 200 | D97, D200, their schools, 11 comparison districts, and the state, 2018 to 2025 | ISBE Illinois Report Card |
| [crime-incidents-oak-park.csv](crime-incidents-oak-park.csv) | 07 Oak Park crime data explorer | 13,913 | Every reported offense, January 2022 to August 2026 | Oak Park PD crime dashboard |

Brief 05 (commissions) uses [`../commissions-diod.csv`](../commissions-diod.csv) at the repo root.

## Regenerating a file

Each script downloads from the source and rewrites its CSV in place. They run with Python 3 and, where noted, `requests` and `openpyxl` (`pip install requests openpyxl`). None needs credentials except as noted.

```text
python3 data/scripts/fetch_assessed_values.py         # stdlib only, a few minutes
python3 data/scripts/fetch_oak_park_levies.py         # stdlib only, downloads ~160 PDFs, about 10 minutes
python3 data/scripts/fetch_cpi_annual.py              # stdlib only
python3 data/scripts/fetch_crashes_oak_park.py        # stdlib only
python3 data/scripts/fetch_crashes_bike_ped_oak_park.py
python3 data/scripts/fetch_schools_oak_park.py
python3 data/scripts/fetch_d97_attendance_zones.py
python3 data/scripts/fetch_acs_timeseries.py          # needs requests; CENSUS_API_KEY optional; about 8 minutes
python3 data/scripts/fetch_report_card_d97_d200.py    # needs requests and openpyxl; downloads ~200 MB of workbooks
python3 data/scripts/fetch_crime_incidents.py         # stdlib only; update DASHBOARD_URL if the Village republishes
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
