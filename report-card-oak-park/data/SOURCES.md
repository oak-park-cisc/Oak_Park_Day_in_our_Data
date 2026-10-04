# Data sources

Three public sources, all retrieved October 3, 2026. Nothing is estimated or invented; blank
values are blank in the source.

1. **School data:** Illinois State Board of Education (ISBE) Illinois Report Card public data sets,
   2018–2025, including school tax rates, taxable property (EAV) per student and local property tax
   revenue (details below).
2. **Tax levies:** Cook County Clerk Agency Tax Rate Reports for D97 and D200, tax years 2006–2025
   (`levies.json`, below).
3. **Map:** Village of Oak Park GIS feature services and OpenStreetMap (`schools-geo.json`, below).

## ISBE Illinois Report Card

- **Source page:** https://www.isbe.net/Pages/Illinois-State-Report-Card-Data.aspx
- **Retrieved:** October 3, 2026
- **Build script:** `scripts/build_report_card_data.py` (adapted from the parent repo's
  `data/scripts/fetch_report_card_d97_d200.py`, oak-park-cisc/Oak_Park_Day_in_our_Data)

| Report card year | File (https://www.isbe.net/Documents/…) |
| --- | --- |
| 2018 | `Report-Card-Public-Data-Set.xlsx` |
| 2019 | `2019-Report-Card-Public-Data-Set.xlsx` |
| 2020 | `2020-Report-Card-Public-Data-Set.xlsx` |
| 2021 | `2021-RC-Pub-Data-Set.xlsx` |
| 2022 | `2022-Report-Card-Public-Data-Set.xlsx` |
| 2023 | `23-RC-Pub-Data-Set.xlsx` |
| 2024 | `24-RC-Pub-Data-Set.xlsx` |
| 2025 | `2025-Report-Card-Public-Data-Set.xlsx` |

## Files

- `districts.json`: every Illinois district (870) plus the statewide row, one value per
  report card year 2018–2025 for 46 indicators, including two derived
  ones: the White–Black proficiency gap in reading and math (`ela_gap_wb`, `math_gap_wb`).
- `schools.json`: the 10 Oak Park ESD 97 schools and Oak Park & River Forest High School.
- `levies.json`: D97 and D200 tax extension, EAV and final rate by tax year 2006–2025, from the
  Cook County Clerk Agency Tax Rate Reports
  (https://www.cookcountyclerkil.gov/property-taxes/tax-extension-and-rates), taken from the parent
  repo's cached `data/oak-park-levies.csv` (oak-park-cisc/Oak_Park_Day_in_our_Data), retrieved
  October 3, 2026. Filter: agencies "SCHOOL DISTRICT 97" and "CONSOLIDATED HIGH SCHOOL 200".
- `schools-geo.json`: Oak Park school geography from the Village of Oak Park GIS, retrieved
  October 3, 2026, joined to `schools.json` school ids by `scripts/build_schools_geo.py`:
  - Elementary attendance-zone polygons (8 zones): Elementary_Attendance_Zones feature service,
    https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/Elementary_Attendance_Zones/FeatureServer/0
    (listed in `data/open-data-catalog.md`).
  - School building footprints (10 D97 schools): Elementary_and_Middle_Schools feature service,
    https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/Elementary_and_Middle_Schools/FeatureServer/0
  - Village boundary polygon: Municipal_Boundary feature service,
    https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/Municipal_Boundary/FeatureServer/0
  - OPRF high school marker: OpenStreetMap/Nominatim geocode of 201 N Scoville Ave
    (https://nominatim.openstreetmap.org), the school's public address. Not from the Village
    footprints layer, which covers D97 buildings only.
  - D97 middle schools and the high school serve the whole village, so no attendance-zone
    polygons exist for them; the map notes this. Coordinates rounded to six decimals.

## Tax columns

- `tax_rate` ("Total School Tax Rate per $100"): each report card shows the rate for the tax year
  three years earlier (the 2025 report card's 5.14 for D97 matches the Clerk's tax year 2022 rate, 5.135).
- `eav_per_pupil`: equalized assessed value per student (the district's tax base).
- `local_tax_per_pupil`: derived as `$ Local Property Taxes` (prior fiscal year) ÷ enrollment; the
  raw dollar column is dropped from the output after this step.
- Community combined rates add the elementary and high school district rates only; the village,
  park, library, township and county rates on a tax bill are not included.

## Filters and processing

- Kept district and statewide rows from the General, Finance/Financial and
  ELA/Math/Science sheets; school rows only for D97 (`06016097002…`) and D200 (`06016200013…`).
- Column names change by year; `data/column-mapping.json` records which source column
  fed each indicator in each year.
- Checked against the parent repo's cached `report-card-d97-d200.csv`: all 3,000 overlapping
  values match.

## Known limits

- 2025 ELA and math proficiency use new performance levels (and the ACT instead of the SAT
  in high school), so they are not comparable with earlier years.
- No state tests in 2020. Science proficiency is not reported for districts in 2018.
  The 2019 workbook has no 9th-grade on-track percentage.
- Finance columns describe the prior fiscal year (2025 report card = FY2024).
