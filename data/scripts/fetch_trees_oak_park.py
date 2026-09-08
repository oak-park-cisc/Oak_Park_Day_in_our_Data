#!/usr/bin/env python3
"""Build data/trees-oak-park.csv: every tree in the Village of Oak Park public tree inventory.

Source: Village of Oak Park GIS, "VOP_TreeInventory_PUBLICVIEW" feature layer
https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/VOP_TreeInventory_PUBLICVIEW/FeatureServer/0
(ArcGIS Online item 792e798104b140c3b8063e86dc09d991, also downloadable from the Village
open data portal). The service has six attribute fields: common name, Latin name, DBH
(trunk diameter in inches), height and spread (feet, coded in 5 or 10 foot steps), and a
GlobalID. There is no condition, planting year, or address field.

One row per tree point, WGS84 coordinates (outSR=4326). No filtering. Derived columns:
    genus            first word of the Latin name; when the Latin name is blank (358 rows)
                     it is filled from the most common genus recorded for that common name
                     elsewhere in the inventory (see genus_source)
    genus_source     latin | common_name_lookup | (blank when neither is available)
    nearest_street   street_name of the nearest Village street centerline segment
    block            hundred block plus street, e.g. "900 N AUSTIN BLVD", from that
                     segment's address range (street name only when it has no addresses)
    block_distance_ft  distance from the tree to that centerline, feet

The nearest-centerline snap uses data/streets-oak-park.geojson (see
fetch_streets_oak_park.py); the file is fetched if it is missing. Centerline segments
named ALLEY are excluded from the snap so every tree lands on a street block. Parkway
trees near a corner can snap to the cross street, so treat block as an approximation.

Python 3 standard library only. Usage:
    python3 data/scripts/fetch_trees_oak_park.py
"""
import csv
import json
import math
import sys
import time
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fetch_streets_oak_park import OUT as STREETS_PATH, fetch_streets  # noqa: E402

LAYER = ("https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/"
         "VOP_TreeInventory_PUBLICVIEW/FeatureServer/0")
OUT = Path(__file__).resolve().parents[1] / "trees-oak-park.csv"
UA = "oak-park-day-in-our-data/1.0 (data extraction script)"
PAGE = 2000

COLUMNS = [
    "object_id", "common_name", "latin_name", "genus", "genus_source",
    "dbh_in", "height_ft", "spread_ft", "latitude", "longitude",
    "nearest_street", "block", "block_distance_ft", "global_id",
]
FT_PER_M = 3.280839895
M_PER_DEG_LAT = 111_132.0


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


def fetch_trees():
    count = get_json(LAYER + "/query?" + urllib.parse.urlencode(
        {"where": "1=1", "returnCountOnly": "true", "f": "json"}))["count"]
    feats = []
    offset = 0
    while True:
        params = {
            "where": "1=1", "outFields": "*", "outSR": 4326, "orderByFields": "OBJECTID",
            "resultOffset": offset, "resultRecordCount": PAGE, "f": "geojson",
        }
        page = get_json(LAYER + "/query?" + urllib.parse.urlencode(params))
        got = page.get("features", [])
        feats.extend(got)
        print(f"  {len(feats)} / {count}")
        if len(got) < PAGE and not page.get("properties", {}).get("exceededTransferLimit"):
            break
        offset += len(got)
    if len(feats) != count:
        raise RuntimeError(f"fetched {len(feats)} but service reports {count}")
    return feats


class StreetIndex:
    """Grid-bucketed nearest-segment lookup in a local planar (metre) frame."""

    def __init__(self, streets, cell_m=150.0):
        lat0 = sum(c[1] for f in streets for c in f["geometry"]["coordinates"]) / \
            sum(len(f["geometry"]["coordinates"]) for f in streets)
        self.lat0 = lat0
        self.m_per_deg_lon = M_PER_DEG_LAT * math.cos(math.radians(lat0))
        self.cell = cell_m
        self.segs = []      # (x1, y1, x2, y2, props)
        self.grid = defaultdict(list)
        for f in streets:
            pts = [self.xy(lon, lat) for lon, lat in f["geometry"]["coordinates"]]
            for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
                idx = len(self.segs)
                self.segs.append((x1, y1, x2, y2, f["properties"]))
                for cx in range(int(min(x1, x2) // cell_m), int(max(x1, x2) // cell_m) + 1):
                    for cy in range(int(min(y1, y2) // cell_m), int(max(y1, y2) // cell_m) + 1):
                        self.grid[(cx, cy)].append(idx)

    def xy(self, lon, lat):
        return lon * self.m_per_deg_lon, lat * M_PER_DEG_LAT

    @staticmethod
    def dist2(px, py, x1, y1, x2, y2):
        dx, dy = x2 - x1, y2 - y1
        if dx == 0 and dy == 0:
            return (px - x1) ** 2 + (py - y1) ** 2
        t = max(0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)))
        return (px - x1 - t * dx) ** 2 + (py - y1 - t * dy) ** 2

    def nearest(self, lon, lat):
        px, py = self.xy(lon, lat)
        cx, cy = int(px // self.cell), int(py // self.cell)
        best, best_d2 = None, float("inf")
        for ring in range(0, 6):
            seen = set()
            for i in range(cx - ring, cx + ring + 1):
                for j in range(cy - ring, cy + ring + 1):
                    if max(abs(i - cx), abs(j - cy)) != ring:
                        continue
                    for idx in self.grid.get((i, j), ()):
                        if idx in seen:
                            continue
                        seen.add(idx)
                        d2 = self.dist2(px, py, *self.segs[idx][:4])
                        if d2 < best_d2:
                            best, best_d2 = self.segs[idx][4], d2
            # Anything in a farther ring is at least (ring * cell) away.
            if best is not None and best_d2 <= (ring * self.cell) ** 2:
                break
        return best, math.sqrt(best_d2) * FT_PER_M


def block_label(props):
    nums = [props[k] for k in ("address_left_from", "address_left_to",
                               "address_right_from", "address_right_to") if props[k] > 0]
    name = props["street_name"]
    if not nums:
        return name
    return f"{int(min(nums)) // 100 * 100} {name}"


def main():
    if STREETS_PATH.exists():
        streets = json.loads(STREETS_PATH.read_text())["features"]
    else:
        print("streets cache missing; fetching centerlines", file=sys.stderr)
        streets = fetch_streets()["features"]
    streets = [f for f in streets if f.get("geometry") and f["geometry"]["type"] == "LineString"
               and f["properties"]["street_name"] != "ALLEY"]
    index = StreetIndex(streets)

    print("fetching tree inventory")
    feats = fetch_trees()

    # Genus lookup for rows with no Latin name: most frequent genus per common name.
    by_common = defaultdict(Counter)
    for f in feats:
        p = f["properties"]
        if p.get("SPP_LATIN") and p.get("SPP_COMMON"):
            by_common[p["SPP_COMMON"].strip()][p["SPP_LATIN"].strip().split()[0]] += 1
    lookup = {k: c.most_common(1)[0][0] for k, c in by_common.items()}

    rows = []
    for f in feats:
        p = f["properties"]
        lon, lat = f["geometry"]["coordinates"]
        common = (p.get("SPP_COMMON") or "").strip()
        latin = (p.get("SPP_LATIN") or "").strip()
        if latin:
            genus, gsrc = latin.split()[0], "latin"
        elif common in lookup:
            genus, gsrc = lookup[common], "common_name_lookup"
        else:
            genus, gsrc = "", ""
        street, dist_ft = index.nearest(lon, lat)
        rows.append({
            "object_id": p["OBJECTID"],
            "common_name": common,
            "latin_name": latin,
            "genus": genus,
            "genus_source": gsrc,
            "dbh_in": p.get("DBH"),
            "height_ft": p.get("HEIGHT"),
            "spread_ft": p.get("SPREAD"),
            "latitude": round(lat, 7),
            "longitude": round(lon, 7),
            "nearest_street": street["street_name"],
            "block": block_label(street),
            "block_distance_ft": round(dist_ft, 1),
            "global_id": p.get("GlobalID"),
        })

    with OUT.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=COLUMNS)
        w.writeheader()
        for r in rows:
            w.writerow({c: ("" if r[c] is None else r[c]) for c in COLUMNS})

    n = len(rows)
    genus_counts = Counter(r["genus"] for r in rows if r["genus"])
    species_counts = Counter(r["common_name"] for r in rows if r["common_name"])
    print(f"wrote {OUT} rows={n} bytes={OUT.stat().st_size}")
    print(f"  blank latin_name={sum(1 for r in rows if not r['latin_name'])} "
          f"blank common_name={sum(1 for r in rows if not r['common_name'])} "
          f"blank dbh={sum(1 for r in rows if r['dbh_in'] in (None, ''))} "
          f"blocks={len({r['block'] for r in rows})} "
          f"snap>200ft={sum(1 for r in rows if r['block_distance_ft'] > 200)}")
    print("  top genera:", [(g, c, f"{100 * c / n:.1f}%") for g, c in genus_counts.most_common(5)])
    print("  top species:", [(s, c, f"{100 * c / n:.1f}%") for s, c in species_counts.most_common(5)])


if __name__ == "__main__":
    main()
