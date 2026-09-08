#!/usr/bin/env python3
"""Save data/d97-attendance-zones.geojson: Oak Park District 97 elementary attendance zones.

Source: Village of Oak Park GIS, "Elementary_Attendance_Zones" feature layer
https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/Elementary_Attendance_Zones/FeatureServer/0

The layer is saved as returned by the service (GeoJSON, WGS84 / EPSG:4326), one polygon per
elementary school attendance zone. No filtering (the layer only covers Oak Park).

Python 3 standard library only. Usage:
    python3 data/scripts/fetch_d97_attendance_zones.py
"""
import json
import urllib.request
from pathlib import Path

URL = ("https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/"
       "Elementary_Attendance_Zones/FeatureServer/0/query?"
       "where=1%3D1&outFields=*&outSR=4326&f=geojson")
OUT = Path(__file__).resolve().parents[1] / "d97-attendance-zones.geojson"
UA = "oak-park-day-in-our-data/1.0 (data extraction script)"


def main():
    req = urllib.request.Request(URL, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=180) as r:
        data = json.loads(r.read())
    feats = data["features"]
    if data.get("exceededTransferLimit"):
        raise RuntimeError("service truncated the result; add paging")
    OUT.write_text(json.dumps(data, separators=(",", ":")))
    print(f"wrote {OUT} features={len(feats)} bytes={OUT.stat().st_size}")
    for f in feats:
        p = f["properties"]
        print(f"  {p.get('OBJECTID')}: {p.get('Name')} ({p.get('PopupInfo')}) {f['geometry']['type']}")


if __name__ == "__main__":
    main()
