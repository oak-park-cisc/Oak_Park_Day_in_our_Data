#!/usr/bin/env python3
"""Save data/parking-restrictions-oak-park.geojson: every feature in the Village of
Oak Park's Parking Restriction Areas layer, the layer behind the Village's Daytime
Parking Restrictions Map, Overnight Parking Restrictions Map, and the public-lot layer
of the Modes of Transportation map.

Source: Village of Oak Park GIS, VOP MapServer layer 42 "Parking Restriction Areas"
https://utility.arcgis.com/usrsvcs/servers/4cff1aaefa364b57b8c70d5c606f2088/rest/services/VOP/AGOL_VOP_Project/MapServer/42
Web maps that draw it (ArcGIS Online items): Daytime Parking Restrictions Map
612c713946094edebcdbefb9efc298c6 (filter PRODUCTIONNOTES = 'Daytime Parking
Restrictions', colored by PARKINGAREANAME), Overnight Parking Restrictions Map
8fae1fbfc3434fb5b30a6e2272e0f64c (PRODUCTIONNOTES = 'Overnight Parking' on-street
segments, PARKINGAREATYPE = 'ZONE' permit zones, permit lots and garages), and Modes
of Transportation 175b26ace9b74ae899803e3e34893570 (PARKINGAREATYPE LOT or GARAGE).

One Polygon or MultiPolygon per feature, WGS84 / EPSG:4326, no spatial filter (the
layer only covers Oak Park). Polygons are curb-lane strips for on-street segments and
footprints for zones, lots, and garages. Property names are rewritten to snake_case;
epoch-millisecond dates become YYYY-MM-DD. Dropped: GlobalID, REPLICAFILTER, the
CREATEDBY and MODIFIEDBY editor usernames, and the SHAPE.STArea()/SHAPE.STLength()
statistics. Two columns are added:

  restriction_group  daytime_on_street (PRODUCTIONNOTES 'Daytime Parking Restrictions'),
                     overnight_permit_street ('Overnight Parking', plus one unlabelled
                     segment with ENFORCEMENTTIMES 'Overnight' and a zone permit name),
                     permit_zone (ZONE), lot, garage
  permit_zone        the Y or Z zone code parsed from PERMITNAME or PARKINGAREANAME
                     (e.g. Y4), blank when the feature is not tied to a zone

The sign wording for daytime on-street segments is in `location_description`
(for example '3HR 8A-8P', 'N/P 8-10 M-F', 'RPP 6A-4P M-F'); the structured
classification, days_of_enforcement, duration_restriction fields are only partly
filled and enforcement_times is empty on almost every daytime segment.

Python 3 standard library only. Usage:
    python3 data/scripts/fetch_parking_restrictions_oak_park.py
"""
import datetime as dt
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
LAYER = VOP + "/42"
OUT = Path(__file__).resolve().parents[1] / "parking-restrictions-oak-park.geojson"
UA = "oak-park-day-in-our-data/1.0 (data extraction script)"
PAGE = 1000

RENAME = {
    "OBJECTID": "object_id",
    "GEODBID": "geodb_id",
    "FEATUREID": "feature_id",
    "DATECREATED": "date_created",
    "DATEMODIFIED": "date_modified",
    "SOURCE": "source",
    "SOURCETYPE": "source_type",
    "PRODUCTIONNOTES": "production_notes",
    "OWNERSHIP": "ownership",
    "PARKINGAREATYPE": "parking_area_type",
    "SCHEMATICWEBLINK": "schematic_url",
    "DOCUMENTATIONWEBLINK": "guideline_url",
    "PARKINGLEVEL": "parking_level",
    "MAINTENANCERESTRICTION": "maintenance_restriction",
    "PARKINGAREANAME": "parking_area_name",
    "ISCOMMUTERPARKING": "is_commuter_parking",
    "OWNERSHIPDESCRIPTION": "ownership_description",
    "MAXPARKINGSPACES": "max_parking_spaces",
    "MAINTAINED": "maintained",
    "CLASSIFICATION": "classification",
    "DAYSOFENFORCEMENT": "days_of_enforcement",
    "ENFORCEMENTTIMES": "enforcement_times",
    "DURATIONRESTRICTION": "duration_restriction",
    "CLASSIFICATION2": "classification2",
    "DAYSOFENFORCEMENT2": "days_of_enforcement2",
    "ENFORCEMENTTIMES2": "enforcement_times2",
    "DURATIONRESTRICTION2": "duration_restriction2",
    "CLASSIFICATION3": "classification3",
    "DAYSOFENFORCEMENT3": "days_of_enforcement3",
    "ENFORCEMENTTIMES3": "enforcement_times3",
    "DURATIONRESTRICTION3": "duration_restriction3",
    "ISPERMITPARKING": "is_permit_parking",
    "PERMITNAME": "permit_name",
    "ISSCHOOLZONE": "is_school_zone",
    "ISTOWAWAY": "is_tow_away",
    "ISEVCHARGING": "is_ev_charging",
    "PAYMENTDEVICE": "payment_device",
    "PAYMENTTYPE": "payment_type",
    "PARKINGRATE": "parking_rate",
    "EVENTRESTRICTION": "event_restriction",
    "ISHANDICAP": "has_accessible_spaces",
    "NUMBEROFHANDICAPSPOTS": "accessible_space_count",
    "SEASONALRESTRICTION": "seasonal_restriction",
    "LOCATIONDESCRIPTION": "location_description",
    "ORDINANCENUMBER": "ordinance_number",
    "ORDINANCEWEBLINK": "ordinance_url",
    "ORDINANCENUMBER2": "ordinance_number2",
    "ORDINANCEWEBLINK2": "ordinance_url2",
    "COMMUNITYID": "community_id",
}
DROP = {"GlobalID", "REPLICAFILTER", "CREATEDBY", "MODIFIEDBY", "SHAPE.STArea()", "SHAPE.STLength()"}
DATE_COLS = {"date_created", "date_modified"}
ZONE_RE = re.compile(r"\b([YZ]\d)\b")


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


def fetch_layer(layer, where="1=1"):
    """All features of a VOP MapServer layer as GeoJSON features in WGS84."""
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
        raise RuntimeError(f"fetched {len(feats)} but service reports {count}")
    return feats


def round_coords(coords, nd=7):
    if isinstance(coords[0], (int, float)):
        return [round(coords[0], nd), round(coords[1], nd)]
    return [round_coords(c, nd) for c in coords]


def epoch_to_date(v):
    if v in (None, ""):
        return None
    return dt.datetime.fromtimestamp(v / 1000, dt.timezone.utc).strftime("%Y-%m-%d")


def clean_props(raw):
    props = {}
    for k, v in raw.items():
        if k in DROP:
            continue
        key = RENAME.get(k, k.lower())
        if isinstance(v, str):
            v = v.strip() or None
        if key in DATE_COLS:
            v = epoch_to_date(v)
        props[key] = v
    return props


def restriction_group(p):
    t = p.get("parking_area_type")
    if t == "GARAGE":
        return "garage"
    if t == "LOT":
        return "lot"
    if t == "ZONE":
        return "permit_zone"
    note = p.get("production_notes")
    if note == "Daytime Parking Restrictions":
        return "daytime_on_street"
    if note == "Overnight Parking":
        return "overnight_permit_street"
    if p.get("enforcement_times") == "Overnight" and p.get("permit_name"):
        return "overnight_permit_street"   # one segment carries no production note
    return "other"


def permit_zone(p):
    for field in ("permit_name", "parking_area_name"):
        m = ZONE_RE.search(p.get(field) or "")
        if m:
            return m.group(1)
    return None


def main():
    feats = fetch_layer(LAYER)
    out = []
    for f in feats:
        props = clean_props(f["properties"])
        props["restriction_group"] = restriction_group(props)
        props["permit_zone"] = permit_zone(props)
        geom = f.get("geometry")
        if geom:
            geom = {"type": geom["type"], "coordinates": round_coords(geom["coordinates"])}
        out.append({"type": "Feature", "geometry": geom, "properties": props})
    out.sort(key=lambda f: f["properties"]["object_id"])
    OUT.write_text(json.dumps({"type": "FeatureCollection", "features": out}, separators=(",", ":")))

    groups = Counter(f["properties"]["restriction_group"] for f in out)
    day = [f["properties"] for f in out if f["properties"]["restriction_group"] == "daytime_on_street"]
    print("restriction_group:", dict(groups))
    print("daytime categories (parking_area_name):",
          dict(Counter(p["parking_area_name"] for p in day)))
    print("daytime sign text present:", sum(1 for p in day if p["location_description"]), "of", len(day))
    print("top sign texts:", Counter(p["location_description"] for p in day).most_common(10))
    print("permit zones:", sorted({f["properties"]["permit_zone"] for f in out if f["properties"]["permit_zone"]}))
    print(f"wrote {OUT} features={len(out)} bytes={OUT.stat().st_size}")


if __name__ == "__main__":
    main()
