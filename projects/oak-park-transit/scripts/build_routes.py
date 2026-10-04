"""Build public/data/routes.geojson from CTA, Pace and Metra GTFS zips.

Keeps only the routes that serve stops in transit-stops-oak-park.csv and cuts
their shapes 1/4 mile past the Village line (public/data/boundary.geojson,
from scripts/build_boundary.py), the same distance the app uses for live
vehicles, trails and the fade.

Usage:
  python3 scripts/build_routes.py <dir with cta.zip pace.zip metra.zip>

Downloads:
  cta.zip   https://www.transitchicago.com/downloads/sch_data/google_transit.zip
  pace.zip  https://www.pacebus.com/sites/default/files/2026-08/GTFS.zip
  metra.zip https://schedules.metrarail.com/gtfs/schedule.zip
"""
import csv
import io
import json
import math
import sys
import zipfile
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STOPS_CSV = ROOT / "public/data/transit-stops-oak-park.csv"
BOUNDARY = ROOT / "public/data/boundary.geojson"
OUT = ROOT / "public/data/routes.geojson"

CLIP_M = 402.336  # 1/4 mile; matches FADE_M in build_boundary.py and BUS_RANGE_M in src/data.js
STEP_M = 10  # route shapes are checked every STEP_M, so cuts land within 10 m of CLIP_M

# Cheap prefilter: only segments touching this box get densified and measured
BBOX = (41.85, 41.925, -87.835, -87.75)  # min_lat, max_lat, min_lon, max_lon

# Names used in the stops CSV that differ from GTFS route_short_name / route_id
ALIASES = {"Green Line": "G", "Blue Line": "Blue"}


def in_bbox(lat, lon):
    return BBOX[0] <= lat <= BBOX[1] and BBOX[2] <= lon <= BBOX[3]


def load_village():
    for f in json.loads(BOUNDARY.read_text())["features"]:
        if f["properties"].get("kind") == "village":
            return f["geometry"]["coordinates"]
    raise SystemExit(f"No village outline in {BOUNDARY}; run scripts/build_boundary.py")


VILLAGE = None  # rings of [lon, lat], loaded in main()
KX = 111320 * math.cos(math.radians(41.887))  # meters per degree of longitude here
KY = 111320


def inside_village(lat, lon):
    inside = False
    for ring in VILLAGE:
        j = len(ring) - 1
        for i in range(len(ring)):
            (xi, yi), (xj, yj) = ring[i], ring[j]
            if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / (yj - yi) + xi:
                inside = not inside
            j = i
    return inside


def meters_to_line(lat, lon):
    px, py = lon * KX, lat * KY
    best = math.inf
    for ring in VILLAGE:
        for (x1, y1), (x2, y2) in zip(ring, ring[1:]):
            ax, ay, bx, by = x1 * KX, y1 * KY, x2 * KX, y2 * KY
            dx, dy = bx - ax, by - ay
            t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy or 1)))
            best = min(best, math.hypot(px - ax - t * dx, py - ay - t * dy))
    return best


def near_village(lat, lon):
    return in_bbox(lat, lon) and (inside_village(lat, lon) or meters_to_line(lat, lon) <= CLIP_M)


def densify(a, b):
    """Points from a to b (excluding b) every STEP_M meters."""
    n = max(1, int(math.hypot((b[0] - a[0]) * KY, (b[1] - a[1]) * KX) // STEP_M))
    return [(a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n) for k in range(n)]


def read(z, name):
    with z.open(name) as f:
        yield from csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig"), skipinitialspace=True)


def wanted_routes():
    out = defaultdict(set)
    for row in csv.DictReader(open(STOPS_CSV)):
        for r in row["routes"].split(";"):
            r = r.strip()
            if r:
                out[row["agency"]].add(ALIASES.get(r, r))
    return out


def clip(points):
    """Split a polyline into the runs that stay within CLIP_M of the Village.

    Keeps the original vertices inside, plus a cut point where the line
    crosses the 1/4-mile limit (to within STEP_M).
    """
    runs, cur, last_ok = [], [], None

    def end_run():
        nonlocal cur
        if cur:
            if cur[-1] != last_ok:
                cur.append(last_ok)
            if len(cur) > 1:
                runs.append(cur)
        cur = []

    for a, b in zip(points, points[1:]):
        if not (in_bbox(*a) or in_bbox(*b)):
            end_run()
            continue
        for k, p in enumerate(densify(a, b)):
            if near_village(*p):
                if not cur or k == 0:  # entry cut point, or an original vertex
                    cur.append(p)
                last_ok = p
            else:
                end_run()
    if cur and near_village(*points[-1]):
        last_ok = points[-1]
    end_run()
    return [[(round(lat, 5), round(lon, 5)) for lat, lon in r] for r in runs]


def build(agency, zip_path, want):
    z = zipfile.ZipFile(zip_path)
    routes = {}
    for r in read(z, "routes.txt"):
        key = r.get("route_short_name") or r["route_id"]
        if key in want or r["route_id"] in want:
            routes[r["route_id"]] = r
    shape_ids = defaultdict(set)
    for t in read(z, "trips.txt"):
        if t["route_id"] in routes and t.get("shape_id"):
            shape_ids[t["shape_id"]].add(t["route_id"])
    pts = defaultdict(list)
    for s in read(z, "shapes.txt"):
        if s["shape_id"] in shape_ids:
            pts[s["shape_id"]].append(
                (int(s["shape_pt_sequence"]), float(s["shape_pt_lat"]), float(s["shape_pt_lon"]))
            )
    features, seen = [], set()
    for sid, p in pts.items():
        p.sort()
        line = [(round(lat, 5), round(lon, 5)) for _, lat, lon in p]
        for run in clip(line):
            for rid in shape_ids[sid]:
                key = (rid, tuple(run[:: max(1, len(run) // 20)]))
                if key in seen:
                    continue
                seen.add(key)
                r = routes[rid]
                features.append({
                    "type": "Feature",
                    "properties": {
                        "agency": agency,
                        "route": r.get("route_short_name") or r["route_id"],
                        "name": r.get("route_long_name", ""),
                        "color": "#" + (r.get("route_color") or "666666"),
                        "type": int(r["route_type"]),
                    },
                    "geometry": {"type": "LineString", "coordinates": [[lon, lat] for lat, lon in run]},
                })
    print(f"{agency}: {len(routes)} routes, {len(features)} line segments")
    return features


def main():
    global VILLAGE
    VILLAGE = load_village()
    src = Path(sys.argv[1])
    want = wanted_routes()
    feats = []
    for agency, fname in [("CTA", "cta.zip"), ("Pace", "pace.zip"), ("Metra", "metra.zip")]:
        feats += build(agency, src / fname, want[agency])
    OUT.write_text(json.dumps({"type": "FeatureCollection", "features": feats}, separators=(",", ":")))
    print(f"wrote {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
