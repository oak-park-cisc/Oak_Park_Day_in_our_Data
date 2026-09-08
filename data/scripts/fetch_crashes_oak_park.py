#!/usr/bin/env python3
"""Build data/crashes-oak-park.csv: every IDOT-reported crash in Oak Park, 2019-2025.

Source: Illinois Department of Transportation (IDOT) annual statewide crash point
layers, published on the IDOT open data portal (https://gis-idot.opendata.arcgis.com/)
and served from
https://services2.arcgis.com/aIrBD8yn1TDTEXoz/arcgis/rest/services/<service>/FeatureServer/0

One row per crash. Filter: CityName = 'OAK PARK'. Field names are normalized to
snake_case and a handful of fields whose names drift between years are mapped to a
single column (see RENAME). Derived columns are documented in DERIVED below.

Python 3 standard library only. Usage:
    python3 data/scripts/fetch_crashes_oak_park.py
"""
import csv
import datetime as dt
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

BASE = "https://services2.arcgis.com/aIrBD8yn1TDTEXoz/arcgis/rest/services"
# Service names are inconsistent across years; each was verified with a ?f=json call.
SERVICES = {
    2019: "Crashes2019",
    2020: "Crashes_2020",
    2021: "CRASHES2021",
    2022: "CRASHES_2022",
    2023: "CRASHES_2023",
    2024: "CRASHES__2024",
    2025: "CRASHES___2025",
}
WHERE = "CityName='OAK PARK'"
PAGE = 2000
OUT = Path(__file__).resolve().parents[1] / "crashes-oak-park.csv"
UA = "oak-park-day-in-our-data/1.0 (data extraction script)"

# Source fields whose names differ between years, mapped to one canonical column.
RENAME = {
    "CrashYr": "crash_yr_source",            # 2019-2024, two-digit year
    "CrashYear": "crash_yr_source",          # 2025, two-digit year
    "DayOfWeekCode": "day_of_week_code",
    "DayofWeekCode": "day_of_week_code",
    "Milestation": "mile_station",
    "MileStation": "mile_station",
    "City_Township_Flag": "city_township_flag",
    "City_Township_flag": "city_township_flag",
    "UrbanRural": "urban_rural",
    "Urban": "urban_rural",
    "HighwayorStreetName": "highway_or_street_name",
}
# Crash_Hour exists only in 2023 and is identical to CrashHour in every Oak Park row.
DROP = {"Crash_Hour", "CrashDate"}

DERIVED = [
    "crash_year",             # four-digit year of the source layer
    "crash_date",             # YYYY-MM-DD built from crash_year, CrashMonth, CrashDay
    "pedestrian_involved",    # Y if TypeOfFirstCrash == 'Pedestrian' else N
    "pedalcyclist_involved",  # Y if TypeOfFirstCrash == 'Pedalcyclist' else N
    "latitude",               # WGS84 point geometry returned by the service (outSR=4326)
    "longitude",
    "location_status",        # ok | missing (IDOT placeholder point, lat/lon blanked) |
                              # outside_oak_park (real point but not within the Oak Park bbox)
]
# Rows with no located point carry an IDOT placeholder near (36.41, -97.96) and blank
# TSCrashLatitude/TSCrashLongitude. Those coordinates are blanked rather than published.
OAK_PARK_BBOX = (41.855, 41.925, -87.815, -87.755)  # lat_min, lat_max, lon_min, lon_max

# Columns most useful for the "can a kid bike to school safely" brief go first.
FRONT = [
    "crash_year", "crash_date", "day_of_week", "crash_hour", "time_of_crash",
    "crash_severity", "crash_injury_severity", "total_injured", "total_fatals",
    "a_injuries", "b_injuries", "c_injuries", "no_injuries",
    "type_of_first_crash", "collision_type_code",
    "pedestrian_involved", "pedalcyclist_involved",
    "cause1", "cause2", "lighting_cond", "weather_cond", "road_surface_cond",
    "intersection_related", "is_intersection", "highway_or_street_name",
    "at_intersection_with", "address_no", "traffic_control_device",
    "traffic_control_device_cond", "hit_and_run", "number_of_vehicles",
    "latitude", "longitude", "location_status",
]


def snake(name):
    s = re.sub(r"(.)([A-Z][a-z]+)", r"\1_\2", name)
    s = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", s)
    return re.sub(r"_+", "_", s).lower()


def get_json(url, tries=4):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                data = json.loads(r.read())
            if "error" in data:
                raise RuntimeError(data["error"])
            return data
        except Exception as e:  # noqa: BLE001
            if attempt == tries - 1:
                raise
            print(f"  retry {attempt + 1} after error: {e}", file=sys.stderr)
            time.sleep(3 * (attempt + 1))


def fetch_year(year, service):
    layer = f"{BASE}/{service}/FeatureServer/0"
    count = get_json(layer + "/query?" + urllib.parse.urlencode(
        {"where": WHERE, "returnCountOnly": "true", "f": "json"}))["count"]
    feats = []
    offset = 0
    while True:
        params = {
            "where": WHERE, "outFields": "*", "outSR": 4326,
            "orderByFields": "OBJECTID", "resultOffset": offset,
            "resultRecordCount": PAGE, "f": "json",
        }
        page = get_json(layer + "/query?" + urllib.parse.urlencode(params))
        got = page.get("features", [])
        feats.extend(got)
        if len(got) < PAGE and not page.get("exceededTransferLimit"):
            break
        offset += len(got)
    if len(feats) != count:
        raise RuntimeError(f"{year}: fetched {len(feats)} but service reports {count}")
    print(f"{year} {service}: {len(feats)} crashes (service count {count})")
    return feats


def clean(v):
    if isinstance(v, str):
        return v.strip()
    return v


def build_row(year, feat):
    a = feat["attributes"]
    row = {}
    for k, v in a.items():
        if k in DROP:
            continue
        row[RENAME.get(k, snake(k))] = clean(v)
    g = feat.get("geometry") or {}
    row["crash_year"] = year
    row["crash_date"] = f"{year}-{int(a['CrashMonth']):02d}-{int(a['CrashDay']):02d}"
    tfc = (a.get("TypeOfFirstCrash") or "").strip()
    row["pedestrian_involved"] = "Y" if tfc == "Pedestrian" else "N"
    row["pedalcyclist_involved"] = "Y" if tfc == "Pedalcyclist" else "N"
    lat = round(g["y"], 7) if "y" in g else None
    lon = round(g["x"], 7) if "x" in g else None
    ts_lat = str(a.get("TSCrashLatitude") or "").strip()
    ts_lon = str(a.get("TSCrashLongitude") or "").strip()
    la0, la1, lo0, lo1 = OAK_PARK_BBOX
    if lat is None or lon is None or ts_lat in ("", "0") or ts_lon in ("", "0") \
            or lat < 40 or lon < -90:
        row["latitude"], row["longitude"], row["location_status"] = "", "", "missing"
    elif la0 <= lat <= la1 and lo0 <= lon <= lo1:
        row["latitude"], row["longitude"], row["location_status"] = lat, lon, "ok"
    else:
        row["latitude"], row["longitude"], row["location_status"] = lat, lon, "outside_oak_park"
    # Sanity check the derived date against the source epoch-ms CrashDate (UTC).
    # CrashDate is an M/D/YYYY string in 2019-2020 and epoch milliseconds in 2021+.
    src_date = a.get("CrashDate")
    if isinstance(src_date, (int, float)):
        src = dt.datetime.fromtimestamp(src_date / 1000, dt.timezone.utc).date().isoformat()
        row["_date_mismatch"] = src != row["crash_date"]
    elif isinstance(src_date, str) and src_date.strip():
        m, d, y = src_date.strip().split("/")
        row["_date_mismatch"] = f"{int(y):04d}-{int(m):02d}-{int(d):02d}" != row["crash_date"]
    return row


def main():
    rows = []
    for year, service in SERVICES.items():
        for feat in fetch_year(year, service):
            rows.append(build_row(year, feat))
    mismatches = sum(1 for r in rows if r.pop("_date_mismatch", False))
    if mismatches:
        print(f"WARNING: {mismatches} rows where CrashDate epoch differs from month/day fields",
              file=sys.stderr)
    all_cols = set()
    for r in rows:
        all_cols.update(r)
    missing_front = [c for c in FRONT if c not in all_cols]
    if missing_front:
        raise RuntimeError(f"expected columns not found: {missing_front}")
    cols = FRONT + sorted(all_cols - set(FRONT))
    with OUT.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="raise")
        w.writeheader()
        for r in rows:
            w.writerow({c: ("" if r.get(c) is None else r.get(c)) for c in cols})
    from collections import Counter
    print("location_status:", dict(Counter(r["location_status"] for r in rows)))
    print(f"wrote {OUT} rows={len(rows)} cols={len(cols)} bytes={OUT.stat().st_size}")


if __name__ == "__main__":
    main()
