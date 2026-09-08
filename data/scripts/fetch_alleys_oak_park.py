#!/usr/bin/env python3
"""Build data/alleys-oak-park.geojson and data/alleys-oak-park.csv: every rated alley
segment in Oak Park with its 2022-2023 and 2024 Pavement Condition Index (PCI) and
whether it is in the Village's reconstruction plan.

Source: the Village of Oak Park's public web map "Alley Condition Ratings and
Reconstruction Priorities V2" (ArcGIS Online item 8b9855b623b64b65bd71a5269a287b77,
https://www.arcgis.com/home/item.html?id=8b9855b623b64b65bd71a5269a287b77). The web map's
operational layers are served through an ArcGIS Online proxy to the Village's map service:
    Current Alley Conditions 2024   .../VOP/AGOL_VOP_Project/MapServer/157  (641 records)
    Proposed Alley Reconstruction   .../VOP/AGOL_VOP_Project/MapServer/164  (62 records)
under https://utility.arcgis.com/usrsvcs/servers/4cff1aaefa364b57b8c70d5c606f2088/rest/services/.
Also joined: the "Alley Improvements" layer of the "2026 Capital Improvements" web map
(item 525f3c4a968c4e1f8f3eeeda2f8d6eac),
https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/2026_CIP_/FeatureServer/5.

One feature per alley segment (WGS84). The one source record with no geometry and no
attributes is dropped. Property names are snake_case; constant or duplicate source
fields are dropped (NETWORK_ID, NETWORK_NA, USE, RANK, PCI string, Shape_Leng,
OBJECTID_1). Derived: pci_change, pci_2024_band (the class breaks the Village map uses),
scheduled_build_year (from the reconstruction layer, joined on alley id), in_2026_cip.
The CSV has the same properties plus the centroid of each segment.

Python 3 standard library only. Usage:
    python3 data/scripts/fetch_alleys_oak_park.py
"""
import csv
import datetime as dt
import json
import sys
import time
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path

PROXY = ("https://utility.arcgis.com/usrsvcs/servers/4cff1aaefa364b57b8c70d5c606f2088/"
         "rest/services/VOP/AGOL_VOP_Project/MapServer")
CONDITIONS = PROXY + "/157"
RECONSTRUCTION = PROXY + "/164"
CIP_ALLEYS = ("https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/"
              "2026_CIP_/FeatureServer/5")
DATA = Path(__file__).resolve().parents[1]
OUT_GEOJSON = DATA / "alleys-oak-park.geojson"
OUT_CSV = DATA / "alleys-oak-park.csv"
UA = "oak-park-day-in-our-data/1.0 (data extraction script)"

COLUMNS = [
    "alley_id", "alley_name", "section_id", "pid", "from_street", "to_street",
    "surface", "width_ft", "slab_length_ft", "slab_width_ft",
    "construction_date", "construction_year", "general_condition",
    "pci_2022_2023", "pci_2024", "pci_change", "pci_2024_band",
    "scheduled_build_year", "in_2026_cip", "length_ft", "object_id",
]
# Class breaks from the web map's renderer for PCI2024 (labels: 4-39, >39-59, >59-79, >79-100).
BANDS = [(39, "0-39"), (59, "40-59"), (79, "60-79"), (100, "80-100")]


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


def band(pci):
    for top, label in BANDS:
        if pci <= top:
            return label
    return "80-100"


def s(v):
    return v.strip() if isinstance(v, str) else v


def centroid(geom):
    coords = geom["coordinates"]
    if geom["type"] == "MultiLineString":
        coords = [c for part in coords for c in part]
    return (round(sum(c[1] for c in coords) / len(coords), 7),
            round(sum(c[0] for c in coords) / len(coords), 7))


def main():
    print("fetching alley conditions")
    cond = fetch_layer(CONDITIONS)
    print("fetching reconstruction plan")
    recon = fetch_layer(RECONSTRUCTION)
    print("fetching 2026 CIP alley improvements")
    cip = fetch_layer(CIP_ALLEYS)

    build_year = {}
    for f in recon:
        p = f["properties"]
        aid, yr = s(p["AlleyID"]), p["BuildYear"]
        if aid in build_year and build_year[aid] != yr:
            raise RuntimeError(f"alley {aid} has two build years")
        build_year[aid] = yr
    cip_ids = {s(f["properties"]["LOCATION"]) for f in cip}

    feats, rows = [], []
    dropped = 0
    for f in cond:
        p = f["properties"]
        if not f.get("geometry") or not p.get("BRANCH_ID"):
            dropped += 1
            continue
        pci_old, pci_new = p.get("PCI_N"), p.get("PCI2024")
        cdate = p.get("CONSTR_DAT")
        cdate_iso = (dt.datetime.fromtimestamp(cdate / 1000, dt.timezone.utc).date().isoformat()
                     if cdate is not None else "")
        aid = s(p["BRANCH_ID"])
        props = {
            "alley_id": aid,
            "alley_name": s(p.get("BRANCH_NAM")),
            "section_id": s(p.get("SECTION_ID")),
            "pid": s(p.get("PID")),
            "from_street": s(p.get("FROM_")),
            "to_street": s(p.get("TO_")),
            "surface": s(p.get("SURFACE")),
            "width_ft": p.get("WIDTH"),
            "slab_length_ft": p.get("SLAB_LENGT"),
            "slab_width_ft": p.get("SLAB_WIDTH"),
            "construction_date": cdate_iso,
            "construction_year": int(cdate_iso[:4]) if cdate_iso else None,
            "general_condition": s(p.get("General_Co")) or "",
            "pci_2022_2023": pci_old,
            "pci_2024": pci_new,
            "pci_change": (pci_new - pci_old) if pci_old is not None and pci_new is not None else None,
            "pci_2024_band": band(pci_new) if pci_new is not None else "",
            "scheduled_build_year": build_year.get(aid),
            "in_2026_cip": "Y" if aid in cip_ids else "N",
            "length_ft": round(p.get("Shape_Length") or 0, 1),
            "object_id": p.get("OBJECTID"),
        }
        feats.append({"type": "Feature", "geometry": f["geometry"], "properties": props})
        lat, lon = centroid(f["geometry"])
        rows.append({**props, "centroid_latitude": lat, "centroid_longitude": lon})

    unmatched = sorted(set(build_year) - {r["alley_id"] for r in rows})
    if unmatched:
        print(f"WARNING: reconstruction alley ids not in conditions layer: {unmatched}",
              file=sys.stderr)
    unmatched_cip = sorted(cip_ids - {r["alley_id"] for r in rows})
    if unmatched_cip:
        print(f"WARNING: CIP alley ids not in conditions layer: {unmatched_cip}", file=sys.stderr)

    OUT_GEOJSON.write_text(json.dumps({"type": "FeatureCollection", "features": feats},
                                      separators=(",", ":")))
    cols = COLUMNS + ["centroid_latitude", "centroid_longitude"]
    with OUT_CSV.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=cols)
        w.writeheader()
        for r in rows:
            w.writerow({c: ("" if r[c] is None else r[c]) for c in cols})

    n = len(rows)
    poor = [r for r in rows if r["pci_2024"] is not None and r["pci_2024"] <= 39]
    sched = [r for r in poor if r["scheduled_build_year"] or r["in_2026_cip"] == "Y"]
    print(f"wrote {OUT_GEOJSON} features={len(feats)} bytes={OUT_GEOJSON.stat().st_size}")
    print(f"wrote {OUT_CSV} rows={n} dropped_blank_source_rows={dropped}")
    print(f"  pci_2024 bands: {dict(sorted(Counter(r['pci_2024_band'] for r in rows).items()))}")
    print(f"  blank pci_2022_2023={sum(1 for r in rows if r['pci_2022_2023'] is None)} "
          f"blank pci_2024={sum(1 for r in rows if r['pci_2024'] is None)}")
    print(f"  scheduled segments={sum(1 for r in rows if r['scheduled_build_year'])} "
          f"(alley ids in plan={len(build_year)}), in 2026 CIP={sum(1 for r in rows if r['in_2026_cip'] == 'Y')}")
    print(f"  pci_2024 <= 39: {len(poor)} segments, {len(sched)} scheduled or in the 2026 CIP")


if __name__ == "__main__":
    main()
