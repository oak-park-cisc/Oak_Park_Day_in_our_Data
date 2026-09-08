#!/usr/bin/env python3
"""Build data/historic-districts-oak-park.geojson: Oak Park's three historic district
polygons (Frank Lloyd Wright-Prairie School of Architecture, Ridgeland-Oak Park,
Gunderson) plus the nine historic resource survey areas, EPSG:4326.

Sources, both Village of Oak Park GIS (VOP MapServer):
  layer 13 Historic Districts
  https://utility.arcgis.com/usrsvcs/servers/4cff1aaefa364b57b8c70d5c606f2088/rest/services/VOP/AGOL_VOP_Project/MapServer/13
  layer 155 Historic Survey Areas
  https://utility.arcgis.com/usrsvcs/servers/4cff1aaefa364b57b8c70d5c606f2088/rest/services/VOP/AGOL_VOP_Project/MapServer/155
Portal pages: items d3ff666dfb764e8183879667acce810e (districts) and
315557a64ac84d45b71e55d94fd583ac (survey areas).

Every feature keeps the properties the service returns, plus `layer` ("district" or
"survey_area") and `name` (the NAME value with stray whitespace removed). The
districts' TYPE field says whether the designation is Local or Local; National.

Python 3 standard library only. Usage:
    python3 data/scripts/fetch_historic_districts_oak_park.py
"""
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

VOP = ("https://utility.arcgis.com/usrsvcs/servers/4cff1aaefa364b57b8c70d5c606f2088"
       "/rest/services/VOP/AGOL_VOP_Project/MapServer")
LAYERS = [("district", 13), ("survey_area", 155)]
OUT = Path(__file__).resolve().parents[1] / "historic-districts-oak-park.geojson"
UA = "oak-park-day-in-our-data/1.0 (data extraction script)"


def get(url, tries=4):
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


def main():
    features = []
    for kind, layer_id in LAYERS:
        params = {"where": "1=1", "outFields": "*", "outSR": 4326, "f": "geojson"}
        gj = get(f"{VOP}/{layer_id}/query?" + urllib.parse.urlencode(params))
        if gj.get("exceededTransferLimit"):
            raise RuntimeError(f"layer {layer_id} returned a partial page")
        for feat in gj["features"]:
            p = feat["properties"]
            p["layer"] = kind
            p["name"] = " ".join((p.get("NAME") or "").split())
            features.append(feat)
        print(f"layer {layer_id} ({kind}): {len(gj['features'])} features: "
              f"{[f['properties']['name'] for f in gj['features']]}")
    out = {"type": "FeatureCollection", "name": "historic-districts-oak-park", "features": features}
    with OUT.open("w", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"wrote {OUT} features={len(features)} bytes={OUT.stat().st_size}")


if __name__ == "__main__":
    main()
