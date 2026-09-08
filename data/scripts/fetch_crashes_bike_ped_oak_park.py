#!/usr/bin/env python3
"""Build data/crashes-bike-ped-oak-park.csv: IDOT bicycle and pedestrian crashes in Oak Park.

Source: Illinois Department of Transportation (IDOT) "BikePedCrash" layer on the IDOT
open data portal (https://gis-idot.opendata.arcgis.com/), served from
https://services2.arcgis.com/aIrBD8yn1TDTEXoz/arcgis/rest/services/BikePedCrash/FeatureServer/0

One row per crash. Filter: CrashReportCity = 'OAK PARK'. All source fields are kept with
names normalized to snake_case; latitude and longitude are added from the point geometry.

Python 3 standard library only. Usage:
    python3 data/scripts/fetch_crashes_bike_ped_oak_park.py
"""
import csv
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

LAYER = ("https://services2.arcgis.com/aIrBD8yn1TDTEXoz/arcgis/rest/services/"
         "BikePedCrash/FeatureServer/0")
WHERE = "CrashReportCity='OAK PARK'"
PAGE = 2000
OUT = Path(__file__).resolve().parents[1] / "crashes-bike-ped-oak-park.csv"
UA = "oak-park-day-in-our-data/1.0 (data extraction script)"


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


def fetch_all():
    count = get_json(LAYER + "/query?" + urllib.parse.urlencode(
        {"where": WHERE, "returnCountOnly": "true", "f": "json"}))["count"]
    feats, offset = [], 0
    while True:
        params = {"where": WHERE, "outFields": "*", "outSR": 4326,
                  "orderByFields": "OBJECTID", "resultOffset": offset,
                  "resultRecordCount": PAGE, "f": "json"}
        page = get_json(LAYER + "/query?" + urllib.parse.urlencode(params))
        got = page.get("features", [])
        feats.extend(got)
        if len(got) < PAGE and not page.get("exceededTransferLimit"):
            break
        offset += len(got)
    if len(feats) != count:
        raise RuntimeError(f"fetched {len(feats)} but service reports {count}")
    print(f"BikePedCrash Oak Park: {len(feats)} crashes (service count {count})")
    return feats


def main():
    feats = fetch_all()
    rows = []
    for f in feats:
        row = {snake(k): (v.strip() if isinstance(v, str) else v)
               for k, v in f["attributes"].items()}
        g = f.get("geometry") or {}
        row["latitude"] = round(g["y"], 7) if "y" in g else ""
        row["longitude"] = round(g["x"], 7) if "x" in g else ""
        rows.append(row)
    cols = list(rows[0].keys())
    with OUT.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=cols)
        w.writeheader()
        for r in rows:
            w.writerow({c: ("" if r.get(c) is None else r.get(c)) for c in cols})
    print(f"wrote {OUT} rows={len(rows)} cols={len(cols)} bytes={OUT.stat().st_size}")


if __name__ == "__main__":
    main()
