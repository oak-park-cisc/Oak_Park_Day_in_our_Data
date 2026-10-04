"""Download the cached Oak Park tree and street data and build public/data.

Run from the project root: python3 scripts/prepare_data.py
Outputs trees.csv, streets.geojson and zones.geojson. See public/data/SOURCES.md.
"""

import csv
import io
import json
import math
import urllib.request
from collections import Counter, defaultdict

BASE = "https://raw.githubusercontent.com/oak-park-cisc/Oak_Park_Day_in_our_Data/main/data"
OUT = "public/data"
ROWS, COLS = 5, 3  # 15 zones: rows A (north) to E (south), columns 1 (west) to 3 (east)
PAD = 0.0005  # degrees added around the tree extent so edge trees sit inside the grid
MAX_SNAP_FT = 250  # trees farther than this from their street get no address


def fetch(name):
    with urllib.request.urlopen(f"{BASE}/{name}") as r:
        return r.read().decode("utf-8")


trees = list(csv.DictReader(io.StringIO(fetch("trees-oak-park.csv"))))
streets = json.loads(fetch("streets-oak-park.geojson"))
parcels = list(csv.DictReader(io.StringIO(fetch("assessed-values-oak-park.csv"))))

# Local flat projection in feet, accurate enough across a 2 x 3 mile village.
LAT0 = 41.887
FT_LAT = 364_000
FT_LON = FT_LAT * math.cos(math.radians(LAT0))


def to_ft(lon, lat):
    return lon * FT_LON, lat * FT_LAT


# --- Address estimate from street centerline address ranges ---
segments = defaultdict(list)  # street name -> list of (points in ft, properties)
for f in streets["features"]:
    p = f["properties"]
    if p["street_name"] == "ALLEY":
        continue
    if p["address_left_from"] <= 0 and p["address_right_from"] <= 0:
        continue
    pts = [to_ft(x, y) for x, y in f["geometry"]["coordinates"]]
    segments[p["street_name"]].append((pts, p))


def locate(pts, px, py):
    """Distance to the line, fraction along it (0-1) and side (left/right of digitized direction)."""
    lengths = [math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1)]
    total = sum(lengths) or 1
    best = (math.inf, 0, "left")
    walked = 0
    for i, seg_len in enumerate(lengths):
        (ax, ay), (bx, by) = pts[i], pts[i + 1]
        dx, dy = bx - ax, by - ay
        t = 0 if seg_len == 0 else max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / seg_len**2))
        d = math.dist((px, py), (ax + t * dx, ay + t * dy))
        if d < best[0]:
            side = "left" if dx * (py - ay) - dy * (px - ax) > 0 else "right"
            best = (d, (walked + t * seg_len) / total, side)
        walked += seg_len
    return best


def interpolate(lo, hi, frac):
    if lo <= 0 or hi <= 0:
        return None
    n = round(lo + frac * (hi - lo))
    if n % 2 != lo % 2:  # keep the side's odd/even numbering
        n += 1 if hi >= lo else -1
    return n


def estimate(tree):
    """Estimated house number and the matched segment, or None."""
    street = tree["nearest_street"]
    px, py = to_ft(float(tree["longitude"]), float(tree["latitude"]))
    best = None
    for pts, p in segments.get(street, []):
        d, frac, side = locate(pts, px, py)
        if best is None or d < best[0]:
            best = (d, frac, side, pts, p)
    if best is None or best[0] > MAX_SNAP_FT:
        return None
    _, frac, side, pts, p = best
    n = interpolate(p[f"address_{side}_from"], p[f"address_{side}_to"], frac)
    if n is None:  # this side has no range; fall back to the other side
        other = "right" if side == "left" else "left"
        n = interpolate(p[f"address_{other}_from"], p[f"address_{other}_to"], frac)
    if not n:
        return None
    # distance to each end of the segment, to name the nearer corner
    length = sum(math.dist(pts[k], pts[k + 1]) for k in range(len(pts) - 1))
    end = pts[0] if frac < 0.5 else pts[-1]
    return n, street, min(frac, 1 - frac) * length, end


# --- Real property addresses (Cook County Assessor) to check estimates against ---
street_names = {f["properties"]["street_name"] for f in streets["features"]}


def match_street(rest):
    """Map an assessor street like 'LE MOYNE PKY 2N' or 'S LYMAN AVE' to a centerline name."""
    words = rest.replace(" PKY", " PKWY").split()
    for k in range(len(words), 0, -1):  # drop unit suffixes from the end
        name = " ".join(words[:k])
        if name in street_names:
            return name
        if words[0] in ("N", "S", "E", "W") and " ".join(words[1:k]) in street_names:
            return " ".join(words[1:k])
    return None


real = defaultdict(set)  # street -> house numbers on record
for row in parcels:
    num, _, rest = row["prop_address"].partition(" ")
    street = match_street(rest) if num.isdigit() else None
    if street:
        real[street].add(int(num))

# Street ends: which other streets meet each centerline end point (for corner names).
ends = defaultdict(set)
for f in streets["features"]:
    name = f["properties"]["street_name"]
    if name == "ALLEY":
        continue
    for x, y in (f["geometry"]["coordinates"][0], f["geometry"]["coordinates"][-1]):
        ex, ey = to_ft(x, y)
        ends[(round(ex / 40), round(ey / 40))].add(name)


def cross_streets(point, street):
    gx, gy = round(point[0] / 40), round(point[1] / 40)
    names = set()
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            names |= ends.get((gx + dx, gy + dy), set())
    return sorted(names - {street})


def title(street):
    return " ".join(w if w in ("N", "S", "E", "W") else w.capitalize() for w in street.split())


CORNER_FT = 160  # a corner lot's side yard runs about this far from the cross street


def describe(tree):
    """(status, label, estimated number). status is match, between, corner, near or none."""
    est = estimate(tree)
    if est is None:
        return "none", "", ""
    n, street, to_end, end = est
    nums = sorted(x for x in real.get(street, ()) if x % 2 == n % 2 and x // 100 == n // 100)
    st = title(street)
    if n in nums:
        return "match", f"{n} {st}", n
    lower = max((x for x in nums if x < n), default=None)
    upper = min((x for x in nums if x > n), default=None)
    if lower and upper:
        return "between", f"Between {lower} and {upper} {st}", n
    cross = cross_streets(end, street)
    if cross and to_end <= CORNER_FT:
        return "corner", f"Corner of {st} and {title(cross[0])}", n
    nearest = lower or upper
    if nearest:
        return "near", f"Near {nearest} {st}", n
    return "near", f"Near {n} {st}", n


# --- 15-zone grid ---
lats = [float(t["latitude"]) for t in trees]
lons = [float(t["longitude"]) for t in trees]
north, south = max(lats) + PAD, min(lats) - PAD
west, east = min(lons) - PAD, max(lons) + PAD
dlat, dlon = (north - south) / ROWS, (east - west) / COLS


def zone(lat, lon):
    row = min(int((north - lat) / dlat), ROWS - 1)
    col = min(int((lon - west) / dlon), COLS - 1)
    return f"{'ABCDE'[row]}{col + 1}"


# --- trees.csv ---
zone_counts = Counter()
statuses = Counter()
with open(f"{OUT}/trees.csv", "w", newline="") as out:
    w = csv.writer(out)
    w.writerow(["id", "common_name", "latin_name", "genus", "dbh_in", "height_ft", "spread_ft",
                "lat", "lon", "address", "address_status", "est_number", "block", "zone"])
    for t in trees:
        lat, lon = float(t["latitude"]), float(t["longitude"])
        z = zone(lat, lon)
        zone_counts[z] += 1
        status, label, est = describe(t)
        statuses[status] += 1
        w.writerow([t["object_id"], t["common_name"], t["latin_name"], t["genus"], t["dbh_in"],
                    t["height_ft"], t["spread_ft"], f"{lat:.6f}", f"{lon:.6f}", label, status, est, t["block"], z])

# --- zones.geojson ---
features = []
for i in range(ROWS):
    for j in range(COLS):
        n, w_ = north - i * dlat, west + j * dlon
        s, e = n - dlat, w_ + dlon
        ring = [[round(x, 6), round(y, 6)] for x, y in [(w_, s), (e, s), (e, n), (w_, n), (w_, s)]]
        name = f"{'ABCDE'[i]}{j + 1}"
        features.append({"type": "Feature", "properties": {"zone": name, "trees": zone_counts[name]},
                         "geometry": {"type": "Polygon", "coordinates": [ring]}})
with open(f"{OUT}/zones.geojson", "w") as out:
    json.dump({"type": "FeatureCollection", "features": features}, out, separators=(",", ":"))

# --- blocks.geojson: centerline pieces for each tree block ---
by_name = defaultdict(list)
for f in streets["features"]:
    by_name[f["properties"]["street_name"]].append(f)
block_features = []
for block in sorted({t["block"] for t in trees}):
    num, _, name = block.partition(" ")
    if not num.isdigit():
        num, name = None, block
    lines = []
    for f in by_name.get(name, []):
        p = f["properties"]
        starts = [v for v in (p["address_left_from"], p["address_right_from"]) if v > 0]
        if num is None or (starts and min(starts) // 100 * 100 == int(num)):
            lines.append([[round(x, 5), round(y, 5)] for x, y in f["geometry"]["coordinates"]])
    if lines:
        block_features.append({"type": "Feature", "properties": {"block": block},
                               "geometry": {"type": "MultiLineString", "coordinates": lines}})
with open(f"{OUT}/blocks.geojson", "w") as out:
    json.dump({"type": "FeatureCollection", "features": block_features}, out, separators=(",", ":"))
print(f"{len(block_features)} of {len({t['block'] for t in trees})} blocks have a centerline")

# --- streets.geojson ---
keep = ["street_name", "address_left_from", "address_left_to", "address_right_from", "address_right_to"]
street_features = [
    {"type": "Feature", "properties": {k: f["properties"][k] for k in keep},
     "geometry": {"type": "LineString",
                  "coordinates": [[round(x, 5), round(y, 5)] for x, y in f["geometry"]["coordinates"]]}}
    for f in streets["features"]
]
with open(f"{OUT}/streets.geojson", "w") as out:
    json.dump({"type": "FeatureCollection", "features": street_features}, out, separators=(",", ":"))

print(f"{len(trees)} trees; address status {dict(statuses)}")
print({z: zone_counts[z] for z in sorted(zone_counts)})
