#!/usr/bin/env python3
"""Build data/historic-buildings-oak-park.csv: every surveyed historic resource in the
Village of Oak Park's Historic Building Dataset, one row per building point with
coordinates, architect, style, construction date, designation flags, survey rating,
image and survey-form links, and which historic district the point falls in.

Source: Village of Oak Park, Historic Building Dataset (portal item
5a02234ddbed497a809810430a61853a), feature service
https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/OPHR_FGDB_V3_PUBLIC/FeatureServer/0
The Hub CSV export of the same item is
https://oak-park-open-data-portal-v2-oakparkil.hub.arcgis.com/api/download/v1/items/5a02234ddbed497a809810430a61853a/csv?layers=0
District polygons for the point-in-polygon column come from VOP MapServer layer 13
(Historic Districts), the same layer cached in historic-districts-oak-park.geojson.

No filter: the layer only covers Oak Park. Field names are lower snake_case; the
only value normalization is `resource_rating`, which the source stores in mixed case
("Contributing" and "CONTRIBUTING"), title-cased here. Derived columns: `latitude`,
`longitude` (WGS84 point), `construction_year` (the source's provided_construction_date
as an integer), `historic_district` (name of the local or national district polygon
containing the point, blank if none).

Python 3 standard library only. Usage:
    python3 data/scripts/fetch_historic_buildings_oak_park.py
"""
import csv
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

LAYER = ("https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services"
         "/OPHR_FGDB_V3_PUBLIC/FeatureServer/0")
DISTRICTS = ("https://utility.arcgis.com/usrsvcs/servers/4cff1aaefa364b57b8c70d5c606f2088"
             "/rest/services/VOP/AGOL_VOP_Project/MapServer/13")
OUT = Path(__file__).resolve().parents[1] / "historic-buildings-oak-park.csv"
UA = "oak-park-day-in-our-data/1.0 (data extraction script)"
PAGE = 2000

# Source field -> output column. Order here is the column order.
FIELDS = [
    ("OBJECTID", "objectid"),
    ("ADDRESSFULL", "address"),
    ("building_historical_name", "building_historical_name"),
    ("building_current_name", "building_current_name"),
    ("architect", "architect"),
    ("builder", "builder"),
    ("developer", "developer"),
    ("significant_owner", "significant_owner"),
    ("style_primary", "style_primary"),
    ("style_secondary", "style_secondary"),
    ("form", "form"),
    ("estimated_construction_date", "construction_decade"),
    ("provided_construction_date", "construction_year"),
    ("provided_construction_date_cert", "construction_year_certainty"),
    ("provided_construction_date_sour", "construction_year_source"),
    ("resource_rating", "resource_rating"),
    ("is_individually_eligible", "is_individually_eligible"),
    ("local_landmark", "local_landmark"),
    ("local_listed_district", "local_listed_district"),
    ("local_listed_date", "local_listing"),
    ("nr_landmark", "nr_landmark"),
    ("nr_listed_individually", "nr_listed_individually"),
    ("nr_listed_district", "nr_listed_district"),
    ("nr_listed_date", "nr_listing"),
    ("eligibility_remarks", "eligibility_remarks"),
    ("previous_survey_name", "previous_survey_name"),
    ("historical_summary", "historical_summary"),
    ("notes", "notes"),
    ("references_", "references"),
    ("ImageLink", "image_url"),
    ("FormLink", "form_url"),
]
DERIVED = ["latitude", "longitude", "historic_district"]
COLS = [out for _, out in FIELDS] + DERIVED


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


def fetch_all():
    count = get_json(LAYER + "/query?" + urllib.parse.urlencode(
        {"where": "1=1", "returnCountOnly": "true", "f": "json"}))["count"]
    feats, offset = [], 0
    while True:
        params = {"where": "1=1", "outFields": "*", "outSR": 4326, "orderByFields": "OBJECTID",
                  "resultOffset": offset, "resultRecordCount": PAGE, "f": "json"}
        page = get_json(LAYER + "/query?" + urllib.parse.urlencode(params))
        got = page.get("features", [])
        feats.extend(got)
        if len(got) < PAGE and not page.get("exceededTransferLimit"):
            break
        offset += len(got)
    if len(feats) != count:
        raise RuntimeError(f"fetched {len(feats)} but service reports {count}")
    print(f"historic buildings: {len(feats)} features (service count {count})")
    return feats


def ring_contains(ring, lon, lat):
    inside = False
    n = len(ring)
    for i in range(n):
        x1, y1 = ring[i][0], ring[i][1]
        x2, y2 = ring[(i + 1) % n][0], ring[(i + 1) % n][1]
        if (y1 > lat) != (y2 > lat):
            if lon < x1 + (lat - y1) * (x2 - x1) / (y2 - y1):
                inside = not inside
    return inside


def polygon_contains(geometry, lon, lat):
    polys = geometry["coordinates"] if geometry["type"] == "MultiPolygon" else [geometry["coordinates"]]
    for rings in polys:
        if ring_contains(rings[0], lon, lat) and not any(ring_contains(h, lon, lat) for h in rings[1:]):
            return True
    return False


def clean(v):
    if v is None:
        return ""
    if isinstance(v, str):
        return " ".join(v.split())   # collapse internal newlines and runs of spaces
    return v


def main():
    districts = get_json(DISTRICTS + "/query?" + urllib.parse.urlencode(
        {"where": "1=1", "outFields": "NAME,TYPE", "outSR": 4326, "f": "geojson"}))["features"]
    print("districts:", [d["properties"]["NAME"].strip() for d in districts])

    rows = []
    for feat in fetch_all():
        a, g = feat["attributes"], feat.get("geometry") or {}
        row = {out: clean(a.get(src)) for src, out in FIELDS}
        rating = row["resource_rating"]
        row["resource_rating"] = rating.title() if isinstance(rating, str) else rating
        year = row["construction_year"]
        row["construction_year"] = int(year) if isinstance(year, (int, float)) else ""
        lon, lat = g.get("x"), g.get("y")
        row["latitude"] = round(lat, 7) if lat is not None else ""
        row["longitude"] = round(lon, 7) if lon is not None else ""
        row["historic_district"] = ""
        if lat is not None:
            for d in districts:
                if polygon_contains(d["geometry"], lon, lat):
                    row["historic_district"] = d["properties"]["NAME"].strip()
                    break
        rows.append(row)

    with OUT.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=COLS, extrasaction="raise")
        w.writeheader()
        w.writerows(rows)
    from collections import Counter
    print("resource_rating:", dict(Counter(r["resource_rating"] for r in rows)))
    print("historic_district:", dict(Counter(r["historic_district"] for r in rows)))
    print("top architects:", Counter(r["architect"] for r in rows if r["architect"]).most_common(5))
    print(f"wrote {OUT} rows={len(rows)} cols={len(COLS)} bytes={OUT.stat().st_size}")


if __name__ == "__main__":
    main()
