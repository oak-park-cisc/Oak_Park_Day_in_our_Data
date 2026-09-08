#!/usr/bin/env python3
"""Build data/parking-facilities-oak-park.csv: one row per public parking lot, garage,
EV charging station, and car share site in the Village of Oak Park's GIS.

Sources, all Village of Oak Park GIS layers on the VOP MapServer
https://utility.arcgis.com/usrsvcs/servers/4cff1aaefa364b57b8c70d5c606f2088/rest/services/VOP/AGOL_VOP_Project/MapServer
  layer 42  Parking Restriction Areas, filtered to PARKINGAREATYPE IN ('LOT','GARAGE'):
            the permit lots, enclaves, and garages (this is what the Modes of
            Transportation map, item 175b26ace9b74ae899803e3e34893570, draws as
            "Public Parking Lot or Garage")
  layer 4   Electric Vehicle Charging Station (public)
  layer 36  Electric Vehicle Charging Station - Village Vehicles ONLY
  layer 3   Car Share Site
  layer 9   Overnight Parking Ban Lot, used only to flag lots that appear on the
            Village's overnight map (matched on lot number)

Polygon facilities are reduced to a centroid. `address` is the street address parsed
from the Village's LOCATIONDESCRIPTION (for example "1125 Ontario St" from
"1125 Ontario St - Ontario St east of Harlem Ave"); the full text is kept in
`location_description`. Capacity (MAXPARKINGSPACES) and accessible-space fields
(ISHANDICAP, NUMBEROFHANDICAPSPOTS) are carried through but are empty for nearly every
facility in the source. Editor usernames are not carried through.

Python 3 standard library only. Usage:
    python3 data/scripts/fetch_parking_facilities_oak_park.py
"""
import csv
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path

VOP = ("https://utility.arcgis.com/usrsvcs/servers/4cff1aaefa364b57b8c70d5c606f2088"
       "/rest/services/VOP/AGOL_VOP_Project/MapServer")
OUT = Path(__file__).resolve().parents[1] / "parking-facilities-oak-park.csv"
UA = "oak-park-day-in-our-data/1.0 (data extraction script)"
PAGE = 1000

COLS = [
    "facility_type", "facility_id", "name", "address", "location_description",
    "latitude", "longitude",
    "ownership", "ownership_description", "maintained",
    "permit_types", "is_permit_parking", "payment_device", "payment_type",
    "classification", "days_of_enforcement", "enforcement_times", "duration_restriction",
    "classification2", "days_of_enforcement2", "enforcement_times2",
    "max_parking_spaces", "has_accessible_spaces", "accessible_space_count",
    "is_commuter_parking", "is_ev_charging", "seasonal_restriction",
    "on_overnight_ban_map", "overnight_ban_area_type",
    "guideline_url", "weblink", "description",
    "source_layer", "source_object_id",
]
ADDRESS_RE = re.compile(
    r"\b(\d{1,5}\s+(?:[NSEW]\.?\s+)?[A-Z][A-Za-z.]*(?:\s+[A-Z][A-Za-z.]*)*?"
    r"\s+(?:St|Ave|Blvd|Rd|Ct|Ln|Pl|Dr|Street|Avenue|Boulevard|Court)\b\.?)")


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


def fetch_layer(lid, where="1=1"):
    layer = f"{VOP}/{lid}"
    count = get_json(layer + "/query?" + urllib.parse.urlencode(
        {"where": where, "returnCountOnly": "true", "f": "json"}))["count"]
    feats, offset = [], 0
    while True:
        params = {
            "where": where, "outFields": "*", "outSR": 4326, "orderByFields": "OBJECTID",
            "resultOffset": offset, "resultRecordCount": PAGE, "f": "geojson",
        }
        page = get_json(layer + "/query?" + urllib.parse.urlencode(params))
        got = page.get("features", [])
        feats.extend(got)
        if not got or (len(got) < PAGE and not page.get("properties", {}).get("exceededTransferLimit")):
            break
        offset += len(got)
    if len(feats) != count:
        raise RuntimeError(f"layer {lid}: fetched {len(feats)} but service reports {count}")
    return feats


def ring_centroid(ring):
    """Area-weighted centroid of a closed ring (lon, lat); falls back to the vertex mean."""
    a = cx = cy = 0.0
    for i in range(len(ring) - 1):
        x1, y1 = ring[i][0], ring[i][1]
        x2, y2 = ring[i + 1][0], ring[i + 1][1]
        cross = x1 * y2 - x2 * y1
        a += cross
        cx += (x1 + x2) * cross
        cy += (y1 + y2) * cross
    if abs(a) < 1e-14:
        return sum(p[0] for p in ring) / len(ring), sum(p[1] for p in ring) / len(ring)
    a *= 0.5
    return cx / (6 * a), cy / (6 * a)


def centroid(geom):
    if geom["type"] == "Point":
        return geom["coordinates"][0], geom["coordinates"][1]
    polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
    # Largest outer ring wins for multipolygons.
    best, best_n = None, -1
    for rings in polys:
        if len(rings[0]) > best_n:
            best, best_n = rings[0], len(rings[0])
    return ring_centroid(best)


def clean(v):
    if isinstance(v, str):
        return v.strip()
    return "" if v is None else v


def parse_address(text):
    """Street address from the Village's location text, blank when it is only a corner."""
    text = text or ""
    m = ADDRESS_RE.search(text)
    if m:
        return re.sub(r"\s+", " ", m.group(1))
    # '438 S Taylor - Taylor north of Madison,' has no street suffix: take the number
    # and name before the first ' - ' or ','.
    m = re.match(r"\s*(\d{1,5}\s+[A-Za-z][A-Za-z. ]*?)\s*(?:-|,|$)", text)
    return re.sub(r"\s+", " ", m.group(1)).strip() if m else ""


def main():
    rows = []

    ban_names = {}
    for f in fetch_layer(9):
        name = clean(f["properties"].get("PARKINGAREANAME"))
        if name and name != "None":
            ban_names.setdefault(name, clean(f["properties"].get("PARKINGAREATYPE")))

    for f in fetch_layer(42, "PARKINGAREATYPE IN ('LOT','GARAGE')"):
        a = f["properties"]
        lon, lat = centroid(f["geometry"])
        lot = clean(a.get("PARKINGAREANAME"))
        kind = "garage" if a.get("PARKINGAREATYPE") == "GARAGE" else "lot"
        owner_desc = clean(a.get("OWNERSHIPDESCRIPTION"))
        if owner_desc:
            name = owner_desc
        elif lot and not lot.lower().startswith(("fenwick",)):
            name = f"Lot {lot}"
        else:
            name = lot or ""
        rows.append({
            "facility_type": kind, "facility_id": lot, "name": name,
            "address": parse_address(a.get("LOCATIONDESCRIPTION")),
            "location_description": clean(a.get("LOCATIONDESCRIPTION")),
            "latitude": round(lat, 7), "longitude": round(lon, 7),
            "ownership": clean(a.get("OWNERSHIP")), "ownership_description": owner_desc,
            "maintained": clean(a.get("MAINTAINED")),
            "permit_types": clean(a.get("PERMITNAME")), "is_permit_parking": clean(a.get("ISPERMITPARKING")),
            "payment_device": clean(a.get("PAYMENTDEVICE")), "payment_type": clean(a.get("PAYMENTTYPE")),
            "classification": clean(a.get("CLASSIFICATION")),
            "days_of_enforcement": clean(a.get("DAYSOFENFORCEMENT")),
            "enforcement_times": clean(a.get("ENFORCEMENTTIMES")),
            "duration_restriction": clean(a.get("DURATIONRESTRICTION")),
            "classification2": clean(a.get("CLASSIFICATION2")),
            "days_of_enforcement2": clean(a.get("DAYSOFENFORCEMENT2")),
            "enforcement_times2": clean(a.get("ENFORCEMENTTIMES2")),
            "max_parking_spaces": clean(a.get("MAXPARKINGSPACES")),
            "has_accessible_spaces": clean(a.get("ISHANDICAP")),
            "accessible_space_count": clean(a.get("NUMBEROFHANDICAPSPOTS")),
            "is_commuter_parking": clean(a.get("ISCOMMUTERPARKING")),
            "is_ev_charging": clean(a.get("ISEVCHARGING")),
            "seasonal_restriction": clean(a.get("SEASONALRESTRICTION")),
            "on_overnight_ban_map": "Y" if lot in ban_names else "N",
            "overnight_ban_area_type": ban_names.get(lot, ""),
            "guideline_url": clean(a.get("DOCUMENTATIONWEBLINK")), "weblink": "", "description": "",
            "source_layer": 42, "source_object_id": a["OBJECTID"],
        })

    for lid, kind in ((4, "ev_charger"), (36, "ev_charger_village_vehicles_only"), (3, "car_share")):
        for f in fetch_layer(lid):
            a = f["properties"]
            lon, lat = centroid(f["geometry"])
            loc = clean(a.get("LOCATION"))
            rows.append({
                **{c: "" for c in COLS},
                "facility_type": kind, "facility_id": "", "name": clean(a.get("FACILITYNAME")),
                "address": parse_address(loc), "location_description": loc,
                "latitude": round(lat, 7), "longitude": round(lon, 7),
                "weblink": clean(a.get("WEBLINK")), "description": clean(a.get("DESCRIPTION")),
                "on_overnight_ban_map": "", "source_layer": lid, "source_object_id": a["OBJECTID"],
            })

    order = {"garage": 0, "lot": 1, "ev_charger": 2, "ev_charger_village_vehicles_only": 3, "car_share": 4}
    rows.sort(key=lambda r: (order[r["facility_type"]], str(r["facility_id"]).zfill(4), r["name"]))
    with OUT.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=COLS, extrasaction="raise")
        w.writeheader()
        w.writerows(rows)

    lots = [r for r in rows if r["facility_type"] in ("lot", "garage")]
    print("facility_type:", dict(Counter(r["facility_type"] for r in rows)))
    print("lots/garages with address:", sum(1 for r in lots if r["address"]), "of", len(lots))
    print("lots/garages on overnight ban map:", sum(1 for r in lots if r["on_overnight_ban_map"] == "Y"))
    print("capacity present:", sum(1 for r in lots if r["max_parking_spaces"] != ""),
          "accessible count present:", sum(1 for r in lots if r["accessible_space_count"] != ""))
    print("payment_device:", dict(Counter(r["payment_device"] for r in lots)))
    print(f"wrote {OUT} rows={len(rows)} cols={len(COLS)} bytes={OUT.stat().st_size}")


if __name__ == "__main__":
    main()
