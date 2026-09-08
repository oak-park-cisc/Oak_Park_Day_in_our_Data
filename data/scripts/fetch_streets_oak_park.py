#!/usr/bin/env python3
"""Save data/streets-oak-park.geojson: Village of Oak Park street centerlines.

Source: Village of Oak Park GIS, "Streets_Centerlines" feature layer
https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/Streets_Centerlines/FeatureServer/0
(ArcGIS Online item 095a733fbde4479980ee9a026728bc0b).

One LineString per centerline segment, WGS84 / EPSG:4326, no filtering (the layer only
covers Oak Park). Segments are typically one block long and carry the address range on
each side, which is what the tree and alley briefs use to name a block. Property names
are rewritten to snake_case; the service's Web Mercator `Shape__Length` is dropped in
favor of `length_ft` (the source `SHAPE_Leng`, Illinois State Plane feet).

Python 3 standard library only. Usage:
    python3 data/scripts/fetch_streets_oak_park.py
"""
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

LAYER = ("https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/"
         "Streets_Centerlines/FeatureServer/0")
OUT = Path(__file__).resolve().parents[1] / "streets-oak-park.geojson"
UA = "oak-park-day-in-our-data/1.0 (data extraction script)"
PAGE = 2000

RENAME = {
    "FID": "fid",
    "FEATUREID": "feature_id",          # GIS Consortium id, joins to other Village layers
    "ADDRESSLEF": "address_left_from",  # -1 when the segment has no addresses (ramps, etc.)
    "ADDRESSL_1": "address_left_to",
    "ADDRESSRIG": "address_right_from",
    "ADDRESSR_1": "address_right_to",
    "STREETNAME": "street_name",
    "SHAPE_Leng": "length_ft",
}
DROP = {"Shape__Length"}


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


def fetch_streets():
    """Return the cleaned GeoJSON FeatureCollection (also used by fetch_trees_oak_park.py)."""
    count = get_json(LAYER + "/query?" + urllib.parse.urlencode(
        {"where": "1=1", "returnCountOnly": "true", "f": "json"}))["count"]
    feats = []
    offset = 0
    while True:
        params = {
            "where": "1=1", "outFields": "*", "outSR": 4326, "orderByFields": "FID",
            "resultOffset": offset, "resultRecordCount": PAGE, "f": "geojson",
        }
        page = get_json(LAYER + "/query?" + urllib.parse.urlencode(params))
        got = page.get("features", [])
        feats.extend(got)
        if len(got) < PAGE and not page.get("properties", {}).get("exceededTransferLimit"):
            break
        offset += len(got)
    if len(feats) != count:
        raise RuntimeError(f"fetched {len(feats)} but service reports {count}")
    for f in feats:
        props = {}
        for k, v in f["properties"].items():
            if k in DROP:
                continue
            if isinstance(v, str):
                v = v.strip()
            props[RENAME.get(k, k.lower())] = v
        props["length_ft"] = round(props["length_ft"], 1)
        f["properties"] = props
        f.pop("id", None)
    return {"type": "FeatureCollection", "features": feats}


def main():
    data = fetch_streets()
    OUT.write_text(json.dumps(data, separators=(",", ":")))
    feats = data["features"]
    names = {f["properties"]["street_name"] for f in feats}
    no_addr = sum(1 for f in feats if f["properties"]["address_left_from"] <= 0)
    print(f"wrote {OUT} features={len(feats)} street_names={len(names)} "
          f"no_address_range={no_addr} bytes={OUT.stat().st_size}")


if __name__ == "__main__":
    main()
