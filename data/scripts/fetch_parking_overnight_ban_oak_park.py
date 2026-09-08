#!/usr/bin/env python3
"""Save data/parking-overnight-ban-oak-park.geojson: the two Village of Oak Park layers
behind the printed Overnight Parking Map and the "No Overnight Passes Map" web map, the
places where an overnight parking pass is not valid.

Source: Village of Oak Park GIS, VOP MapServer
https://utility.arcgis.com/usrsvcs/servers/4cff1aaefa364b57b8c70d5c606f2088/rest/services/VOP/AGOL_VOP_Project/MapServer
  layer 9   Overnight Parking Ban Lot        polygons: permit lots, enclaves, garages, and
                                             lot-adjacent on-street areas, named by lot number
  layer 10  Overnight Parking Ban On Street  polylines: street segments where passes are
                                             not valid (major routes, metered blocks, paid
                                             permit zones per the Village's Parking Passes page)
Web maps that draw them: Overnight Parking Map 11x17 (PDF item
f9735ab3100c45de87045b2f95a4ea11) and No Overnight Passes Map (web map item
5347005a5f2a4f21a8029a65be91e81d, layer titles "NO Overnight Pass - Lot" and
"NO Overnight Pass - On Street").

Both layers merged into one FeatureCollection, WGS84 / EPSG:4326, no spatial filter.
Every feature gets `ban_type` = lot (layer 9) or on_street (layer 10) and
`source_layer` = 9 or 10; the source's own fields are kept and renamed to snake_case,
except the CREATEDBY and MODIFIEDBY editor-name fields (empty in the source) which are
dropped. Dates become YYYY-MM-DD. `shape_length` and `shape_area` are the source's
planar measures in Illinois State Plane feet.

Python 3 standard library only. Usage:
    python3 data/scripts/fetch_parking_overnight_ban_oak_park.py
"""
import datetime as dt
import json
import sys
import time
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path

VOP = ("https://utility.arcgis.com/usrsvcs/servers/4cff1aaefa364b57b8c70d5c606f2088"
       "/rest/services/VOP/AGOL_VOP_Project/MapServer")
LAYERS = {9: "lot", 10: "on_street"}
OUT = Path(__file__).resolve().parents[1] / "parking-overnight-ban-oak-park.geojson"
UA = "oak-park-day-in-our-data/1.0 (data extraction script)"
PAGE = 1000

RENAME = {
    "OBJECTID": "object_id",
    "PARKINGAREATYPE": "parking_area_type",
    "PARKINGAREANAME": "parking_area_name",
    "PARKING_ENFORCEMENT": "parking_enforcement",
    "DATECREATED": "date_created",
    "DATEMODIFIED": "date_modified",
    "SHAPE_Length": "shape_length",
    "SHAPE_Area": "shape_area",
    "STATUS": "status",
    "CLASSIFICATION": "classification",
    "DAYSOFENFORCEMENT": "days_of_enforcement",
    "ENFORCEMENTTIMES": "enforcement_times",
}
DROP = {"CREATEDBY", "MODIFIEDBY"}


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


def fetch_layer(layer):
    count = get_json(layer + "/query?" + urllib.parse.urlencode(
        {"where": "1=1", "returnCountOnly": "true", "f": "json"}))["count"]
    feats, offset = [], 0
    while True:
        params = {
            "where": "1=1", "outFields": "*", "outSR": 4326, "orderByFields": "OBJECTID",
            "resultOffset": offset, "resultRecordCount": PAGE, "f": "geojson",
        }
        page = get_json(layer + "/query?" + urllib.parse.urlencode(params))
        got = page.get("features", [])
        feats.extend(got)
        if not got or (len(got) < PAGE and not page.get("properties", {}).get("exceededTransferLimit")):
            break
        offset += len(got)
    if len(feats) != count:
        raise RuntimeError(f"fetched {len(feats)} but service reports {count}")
    return feats


def round_coords(coords, nd=7):
    if isinstance(coords[0], (int, float)):
        return [round(coords[0], nd), round(coords[1], nd)]
    return [round_coords(c, nd) for c in coords]


def epoch_to_date(v):
    if not isinstance(v, (int, float)) or v < 10 ** 11:   # layer 10 stores a small int here
        return None
    return dt.datetime.fromtimestamp(v / 1000, dt.timezone.utc).strftime("%Y-%m-%d")


def main():
    out = []
    for lid, ban_type in LAYERS.items():
        for f in fetch_layer(f"{VOP}/{lid}"):
            props = {"ban_type": ban_type, "source_layer": lid}
            for k, v in f["properties"].items():
                if k in DROP:
                    continue
                if isinstance(v, str):
                    v = v.strip() or None
                key = RENAME.get(k, k.lower())
                if key in ("date_created", "date_modified"):
                    v = epoch_to_date(v)
                elif key in ("shape_length", "shape_area") and v is not None:
                    v = round(v, 1)
                props[key] = v
            geom = f.get("geometry")
            if geom:
                geom = {"type": geom["type"], "coordinates": round_coords(geom["coordinates"])}
            out.append({"type": "Feature", "geometry": geom, "properties": props})
    OUT.write_text(json.dumps({"type": "FeatureCollection", "features": out}, separators=(",", ":")))

    print("ban_type:", dict(Counter(f["properties"]["ban_type"] for f in out)))
    print("lot area types:", dict(Counter(f["properties"].get("parking_area_type")
                                          for f in out if f["properties"]["ban_type"] == "lot")))
    print("on-street classified:", sum(1 for f in out if f["properties"]["ban_type"] == "on_street"
                                       and f["properties"].get("classification")),
          "migrated:", sum(1 for f in out if f["properties"].get("status") == "Migrated"))
    print(f"wrote {OUT} features={len(out)} bytes={OUT.stat().st_size}")


if __name__ == "__main__":
    main()
