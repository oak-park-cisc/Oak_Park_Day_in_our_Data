#!/usr/bin/env python3
"""Build data/capital-projects-oak-park.geojson: every planned capital project feature the
Village of Oak Park publishes in its two public project web maps, in one file.

Sources (ArcGIS Online web map items; each operational layer is queried directly):
  "2026 Capital Improvements", item 525f3c4a968c4e1f8f3eeeda2f8d6eac
  https://www.arcgis.com/home/item.html?id=525f3c4a968c4e1f8f3eeeda2f8d6eac
    Resurfacing, RRFBs, Water & Sewer Improvements, Oak Park Ave Streetscape,
    Alley Improvements, Sewer Lining, Proposed Neighborhood Greenways, and the pavement
    preservation program layers (Crackfill, Microsurface, Rejuvenator, Patch Locations),
    all under https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/
  "Alley Condition Ratings and Reconstruction Priorities V2", item 8b9855b623b64b65bd71a5269a287b77
  https://www.arcgis.com/home/item.html?id=8b9855b623b64b65bd71a5269a287b77
    Proposed Alley Reconstruction (build years 2025 to 2029), served through
    https://utility.arcgis.com/usrsvcs/servers/4cff1aaefa364b57b8c70d5c606f2088/rest/services/VOP/AGOL_VOP_Project/MapServer/164

One feature per source feature, WGS84. Common properties on every feature:
    project_type   the layer title as shown in the web map
    program        which web map it came from
    source_layer   the layer URL
    source_object_id
    name           a label built from whatever the layer offers (intersection name, alley id,
                   street and limits, or address); blank when the layer has no label field
    alley_id       alley id for the two alley layers (joins to alleys-oak-park.*)
    build_year     only where the source has a year field (alley reconstruction, greenways)
    length_ft      for line features, from the source length field where present
Pavement preservation and alley layers keep their extra useful fields (see EXTRA). The GIS
Consortium centerline boilerplate on the alley layers (TYPE, CLASS, STATEDOTCLASS,
DESIGNATION, SYSTEM, TRACKTYPE, OWNERSHIP, MAINTENANCE, LIFECYCLESTATUS, GEODBID, SOURCE,
SOURCETYPE, REPLICAFILTER, CLASSIFICATIONCODE, SUBCLASS, HIERARCHY, direction and routing
flags, SPEEDLIMIT, SURFACETYPE, LANES, LENGTH, WIDTH, TRUCKALLOWANCE, COMFORTLEVEL,
ISPEDESTRIAN, ISEQUESTRIAN, DATECREATED, DATEMODIFIED, CREATEDBY, MODIFIEDBY, WEBLINK,
PRODUCTIONNOTES, GlobalID) is dropped: it is constant or empty on every row.

Python 3 standard library only. Usage:
    python3 data/scripts/fetch_capital_projects_oak_park.py
"""
import json
import sys
import time
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path

VOP = "https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services"
PROXY = ("https://utility.arcgis.com/usrsvcs/servers/4cff1aaefa364b57b8c70d5c606f2088/"
         "rest/services/VOP/AGOL_VOP_Project/MapServer")
CIP = "2026 Capital Improvements (web map 525f3c4a968c4e1f8f3eeeda2f8d6eac)"
ALLEY_PLAN = ("Alley Condition Ratings and Reconstruction Priorities V2 "
              "(web map 8b9855b623b64b65bd71a5269a287b77, plan layer dated 2025-01-27)")
OUT = Path(__file__).resolve().parents[1] / "capital-projects-oak-park.geojson"
UA = "oak-park-day-in-our-data/1.0 (data extraction script)"

# (program, project_type, layer url, name builder)
LAYERS = [
    (CIP, "Resurfacing", f"{VOP}/2026_CIP_/FeatureServer/0", lambda p: ""),
    (CIP, "RRFBs", f"{VOP}/2026_CIP_/FeatureServer/1", lambda p: p.get("Name")),
    (CIP, "Water & Sewer Improvements", f"{VOP}/2026_CIP_/FeatureServer/2", lambda p: p.get("Name")),
    (CIP, "Oak Park Ave Streetscape", f"{VOP}/2026_CIP_/FeatureServer/4", lambda p: p.get("Name")),
    (CIP, "Alley Improvements", f"{VOP}/2026_CIP_/FeatureServer/5", lambda p: p.get("LOCATION")),
    (CIP, "Sewer Lining", f"{VOP}/SewerLining/FeatureServer/0", lambda p: p.get("Name")),
    (CIP, "Proposed Neighborhood Greenways", f"{VOP}/Proposed_Neighborhood_Greenways/FeatureServer/0",
     lambda p: f"{p.get('Road')}: {p.get('Limits')}"),
    (CIP, "Patch Locations", f"{VOP}/PavementPreservationAGOL_gdb/FeatureServer/0", lambda p: p.get("Location")),
    (CIP, "Crackfill Locations", f"{VOP}/PavementPreservationAGOL_gdb/FeatureServer/1",
     lambda p: f"{p.get('STRDIRNAME')}: {p.get('FROM_')} to {p.get('TO_')}"),
    (CIP, "Microsurface Locations", f"{VOP}/PavementPreservationAGOL_gdb/FeatureServer/2",
     lambda p: f"{p.get('STRDIRNAME')}: {p.get('FROM_')} to {p.get('TO_')}"),
    (CIP, "Rejuvenator Locations", f"{VOP}/PavementPreservationAGOL_gdb/FeatureServer/3",
     lambda p: f"{p.get('STRDIRNAME')}: {p.get('FROM_')} to {p.get('TO_')}"),
    (ALLEY_PLAN, "Proposed Alley Reconstruction", f"{PROXY}/164", lambda p: p.get("AlleyID")),
]

# Extra source fields kept, by source name -> output name.
EXTRA = {
    "Contact": "contact",
    "Depth_in": "patch_depth_in",
    "STRDIRNAME": "street_name",
    "FROM_": "from_street",
    "TO_": "to_street",
    "ROADCLASS": "road_class",
    "AADT": "aadt",
    "PCI": "street_pci_2021",          # DATEPCI is 6/2/2021 on every row
    "IRI": "street_iri_2021",
    "SURFACE": "surface",
    "CRACK_SEAL": "crack_seal_year",
    "MICROSURFA": "microsurface_year",
    "PATCHING": "patching_year",
    "REJUVENATO": "rejuvenator_year",
    "MAJOR_WORK": "major_work_year",
    "MAJOR_WO_1": "major_work_type",
    "Speed20": "speed_20",
    "ParkZone": "park_zone",
    "FEATUREID": "feature_id",
}
YEAR_FIELDS = ("BuildYear", "BldYear")
LENGTH_FIELDS = ("Shape_Length", "SHAPE_LENG", "Shape_Leng")   # state plane feet
ALLEY_ID_FIELDS = ("AlleyID", "LOCATION")


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
    data = get_json(layer + "/query?" + urllib.parse.urlencode(
        {"where": "1=1", "outFields": "*", "outSR": 4326, "f": "geojson"}))
    feats = data["features"]
    if data.get("properties", {}).get("exceededTransferLimit") or len(feats) != count:
        raise RuntimeError(f"{layer}: got {len(feats)} of {count}; add paging")
    return feats


def clean(v):
    if isinstance(v, str):
        v = v.strip()
        return v if v else None
    return v


def main():
    out = []
    for program, ptype, url, namer in LAYERS:
        feats = fetch_layer(url)
        print(f"{ptype}: {len(feats)} features")
        for f in feats:
            p = f["properties"]
            props = {
                "project_type": ptype,
                "program": program,
                "source_layer": url,
                "source_object_id": p.get("OBJECTID", p.get("FID")),
                "name": clean(namer(p)) or "",
                "alley_id": next((clean(p[k]) for k in ALLEY_ID_FIELDS if p.get(k)), None),
                "build_year": next((p[k] for k in YEAR_FIELDS if p.get(k)), None),
                "length_ft": next((round(p[k], 1) for k in LENGTH_FIELDS if p.get(k)), None),
            }
            for src, dst in EXTRA.items():
                if src in p:
                    props[dst] = clean(p[src])
            if props.get("street_pci_2021") is not None:
                props["street_pci_2021"] = int(props["street_pci_2021"])
            out.append({"type": "Feature", "geometry": f["geometry"], "properties": props})

    OUT.write_text(json.dumps({"type": "FeatureCollection", "features": out},
                              separators=(",", ":")))
    print(f"wrote {OUT} features={len(out)} bytes={OUT.stat().st_size}")
    print("  by project_type:", dict(Counter(f["properties"]["project_type"] for f in out)))
    print("  alley reconstruction by build_year:",
          dict(sorted(Counter(f["properties"]["build_year"] for f in out
                              if f["properties"]["project_type"] == "Proposed Alley Reconstruction").items())))


if __name__ == "__main__":
    main()
