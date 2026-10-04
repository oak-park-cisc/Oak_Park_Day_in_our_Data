"""Build public/data/oaks.json: public oaks whose estimated age range reaches 200 years.

Inputs (downloaded into .cache/ on first run):
  - Village tree inventory CSV (oak-park-cisc/Oak_Park_Day_in_our_Data @ fe53bd7)
  - Village street centerlines, historic buildings, historic districts (same repo)
  - Park District of Oak Park public tree layer (ArcGIS FeatureServer)
  - Illinois landcover in the early 1800s (INHS / ISGS Clearinghouse shapefile)

Requires: pip install pyshp pyproj shapely
Run: python3 scripts/build_data.py
"""

import csv
import json
import math
import urllib.request
import zipfile
from pathlib import Path

import pyproj
import shapefile
from shapely.geometry import LineString, Point, shape
from shapely.ops import transform
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / ".cache"
OUT = ROOT / "public" / "data"

REPO = "https://raw.githubusercontent.com/oak-park-cisc/Oak_Park_Day_in_our_Data/fe53bd7/data/"
PARK_LAYER = (
    "https://services.arcgis.com/QPJQ2OoF7CFF9UvK/arcgis/rest/services/"
    "PDOP_Trees_8_30_22_Public/FeatureServer/0"
)
LANDCOVER_ZIP = (
    "https://clearinghouse.isgs.illinois.edu/sites/clearinghouse.isgs/files/"
    "Clearinghouse/data/INHS/Land/zips/Landcover_Early_1800.zip"
)

# Native oaks only. Pin oak, English oak and other planted species are excluded.
SPECIES = {
    "OAK-BURR": ("Bur oak", "Quercus macrocarpa", "white"),
    "OAK-WHITE": ("White oak", "Quercus alba", "white"),
    "OAK-SWAMP WHITE": ("Swamp white oak", "Quercus bicolor", "white"),
    "OAK-CHINKQUAPIN": ("Chinkapin oak", "Quercus muehlenbergii", "white"),
    "OAK-RED": ("Red oak", "Quercus rubra", "red"),
    "OAK-BLACK": ("Black oak", "Quercus velutina", "red"),
    "OAK-SHINGLE": ("Shingle oak", "Quercus imbricaria", "red"),
    "OAK-NORTHERN PIN": ("Hill's oak", "Quercus ellipsoidalis", "red"),
}

# Low end: Morton Arboretum "Estimated Age of Urban Trees by Species and Diameter (DBH)",
# Chicago-area street trees (Dwyer 2009, 2010). Points are (DBH in, age yr).
DWYER = {
    "bur": [(20, 134), (25, 140), (30, 144), (35, 148), (40, 152)],
    "white": [(5, 11), (10, 24), (15, 36)],
    "swamp_white": [(5, 9), (10, 20), (15, 31)],
    "red": [(10, 55), (15, 75), (20, 94), (25, 112), (30, 130), (35, 146), (40, 162)],
}
DWYER_ROW = {
    "OAK-BURR": "bur",
    "OAK-WHITE": "white",
    "OAK-CHINKQUAPIN": "white",
    "OAK-SWAMP WHITE": "swamp_white",
    "OAK-RED": "red",
    "OAK-BLACK": "red",
    "OAK-SHINGLE": "red",
    "OAK-NORTHERN PIN": "red",
}
DWYER_LABEL = {
    "bur": "bur oak",
    "white": "white oak",
    "swamp_white": "swamp white oak",
    "red": "red oak",
}

# High end: growth factors from the Morton Arboretum study of Chicago-area old-growth forest.
FOREST_FACTOR = {
    "OAK-BURR": 6.5,
    "OAK-SWAMP WHITE": 6.5,
    "OAK-WHITE": 7.6,
    "OAK-CHINKQUAPIN": 7.6,
    "OAK-RED": 6.7,
    "OAK-BLACK": 6.7,
    "OAK-SHINGLE": 6.7,
    "OAK-NORTHERN PIN": 6.7,
}

DISTRICT_NAME = {
    "Frank Lloyd Wright": "Frank Lloyd Wright–Prairie School of Architecture",
    "Ridgeland - Oak Park": "Ridgeland–Oak Park",
}

LANDCOVER_LABEL = {"forest": "timber (forest)", "prairie": "prairie", "barrens": "barrens (open oak woods)"}

to_utm = pyproj.Transformer.from_crs("EPSG:4326", "EPSG:26916", always_xy=True).transform
to_lonlat = pyproj.Transformer.from_crs("EPSG:26916", "EPSG:4326", always_xy=True).transform


def fetch(url: str, name: str) -> Path:
    CACHE.mkdir(exist_ok=True)
    path = CACHE / name
    if not path.exists():
        print("downloading", url)
        req = urllib.request.Request(url, headers={"User-Agent": "oak-park-oldest-oaks"})
        with urllib.request.urlopen(req, timeout=180) as r:
            path.write_bytes(r.read())
    return path


def dwyer_low(row: str, dbh: float) -> tuple[int, bool]:
    """Interpolate the street-tree table; extrapolate linearly past either end."""
    pts = DWYER[row]
    if dbh <= pts[0][0]:
        (x0, y0), (x1, y1) = pts[0], pts[1]
    elif dbh >= pts[-1][0]:
        (x0, y0), (x1, y1) = pts[-2], pts[-1]
    else:
        i = next(i for i in range(len(pts) - 1) if pts[i][0] <= dbh <= pts[i + 1][0])
        (x0, y0), (x1, y1) = pts[i], pts[i + 1]
    age = y0 + (y1 - y0) * (dbh - x0) / (x1 - x0)
    return round(age), not (pts[0][0] <= dbh <= pts[-1][0])


def load_village():
    path = fetch(REPO + "trees-oak-park.csv", "trees-oak-park.csv")
    rows = list(csv.DictReader(path.open()))
    out = []
    for r in rows:
        if r["common_name"] not in SPECIES or not r["dbh_in"]:
            continue
        out.append(
            {
                "source": "village",
                "id": r["object_id"],
                "global_id": r["global_id"],
                "code": r["common_name"],
                "latin_raw": r["latin_name"],
                "dbh": float(r["dbh_in"]),
                "height": float(r["height_ft"]) if r["height_ft"] else None,
                "spread": float(r["spread_ft"]) if r["spread_ft"] else None,
                "lat": float(r["latitude"]),
                "lon": float(r["longitude"]),
                "block": r["block"],
                "street": r["nearest_street"],
                "park": None,
            }
        )
    return out, rows


def load_parks():
    path = CACHE / "pdop_trees.json"
    if not path.exists():
        feats, offset = [], 0
        while True:
            url = (
                f"{PARK_LAYER}/query?where=1%3D1&outFields=OBJECTID_1,PARK,SPP_COMMON,SPP_LATIN,"
                f"DBH,HEIGHT,SPREAD,GlobalID&outSR=4326&f=json&resultOffset={offset}"
                "&resultRecordCount=1000&orderByFields=OBJECTID_1"
            )
            batch = json.loads(fetch(url, f"pdop_{offset}.json").read_text())["features"]
            feats += batch
            if len(batch) < 1000:
                break
            offset += 1000
        path.write_text(json.dumps(feats))
    feats = json.loads(path.read_text())
    out = []
    for f in feats:
        a, g = f["attributes"], f.get("geometry")
        if a["SPP_COMMON"] not in SPECIES or not a["DBH"] or not g:
            continue
        out.append(
            {
                "source": "park",
                "id": str(a["OBJECTID_1"]),
                "global_id": a["GlobalID"],
                "code": a["SPP_COMMON"],
                "latin_raw": a["SPP_LATIN"] or "",
                "dbh": float(a["DBH"]),
                "height": float(a["HEIGHT"]) if a["HEIGHT"] else None,
                "spread": float(a["SPREAD"]) if a["SPREAD"] else None,
                "lat": g["y"],
                "lon": g["x"],
                "block": None,
                "street": None,
                "park": a["PARK"].title(),
            }
        )
    return out, feats


def load_streets():
    gj = json.loads(fetch(REPO + "streets-oak-park.geojson", "streets.geojson").read_text())
    segs = []
    for f in gj["features"]:
        p = f["properties"]
        if p["address_left_from"] < 0 and p["address_right_from"] < 0:
            continue
        segs.append((transform(to_utm, LineString(f["geometry"]["coordinates"])), p))
    return segs


def approx_address(pt: Point, street: str, segs):
    """Interpolate a house number along the nearest segment of the tree's assigned street."""
    same = [s for s in segs if s[1]["street_name"] == street]
    if not same:
        return None
    line, p = min(same, key=lambda s: s[0].distance(pt))
    t = line.project(pt, normalized=True)
    # Side of the street: sign of the cross product along the local segment direction.
    a = line.interpolate(max(0.0, t - 0.01), normalized=True)
    b = line.interpolate(min(1.0, t + 0.01), normalized=True)
    cross = (b.x - a.x) * (pt.y - a.y) - (b.y - a.y) * (pt.x - a.x)
    side = "left" if cross > 0 else "right"
    lo, hi = p[f"address_{side}_from"], p[f"address_{side}_to"]
    if lo < 0:
        other = "right" if side == "left" else "left"
        lo, hi = p[f"address_{other}_from"], p[f"address_{other}_to"]
    num = round(lo + (hi - lo) * t)
    if num % 2 != lo % 2:
        num += 1 if hi >= lo else -1
    return f"{num} {p['street_name'].title()}"


def street_view(pt: Point, street: str | None, segs):
    """Camera on the nearest point of the tree's street, facing the tree (heading in degrees)."""
    same = [s for s in segs if s[1]["street_name"] == street] if street else []
    if not same:
        return None
    line = min(same, key=lambda s: s[0].distance(pt))[0]
    cam = line.interpolate(line.project(pt))
    heading = math.degrees(math.atan2(pt.x - cam.x, pt.y - cam.y)) % 360
    lon, lat = to_lonlat(cam.x, cam.y)
    return {"lat": round(lat, 7), "lon": round(lon, 7), "heading": round(heading)}


def load_buildings():
    path = fetch(REPO + "historic-buildings-oak-park.csv", "historic-buildings.csv")
    out = []
    for r in csv.DictReader(path.open()):
        if not r["latitude"] or not r["construction_year"]:
            continue
        year = int(r["construction_year"])
        if year < 1000:  # documented typo, 917 for 1917
            year += 1000
        out.append(
            (
                Point(to_utm(float(r["longitude"]), float(r["latitude"]))),
                {
                    "address": r["address"].title(),
                    "year": year,
                    "certainty": r["construction_year_certainty"],
                },
            )
        )
    return out


def load_districts():
    gj = json.loads(fetch(REPO + "historic-districts-oak-park.geojson", "districts.geojson").read_text())
    return [
        (
            transform(to_utm, shape(f["geometry"])),
            DISTRICT_NAME.get(f["properties"]["name"].strip(), f["properties"]["name"].strip()),
        )
        for f in gj["features"]
        if f["properties"].get("layer") == "district"
    ]


def load_landcover(points):
    z = fetch(LANDCOVER_ZIP, "landcover.zip")
    d = CACHE / "landcover"
    if not d.exists():
        zipfile.ZipFile(z).extractall(d)
    shp = next(d.glob("*.shp"))
    r = shapefile.Reader(str(shp.with_suffix("")))
    # Only keep polygons around the trees; skip the rest of the state.
    xs, ys = [p.x for p in points], [p.y for p in points]
    box = (min(xs) - 1000, min(ys) - 1000, max(xs) + 1000, max(ys) + 1000)
    polys = []
    for sr in r.iterShapeRecords():
        b = sr.shape.bbox
        if b[0] > box[2] or b[2] < box[0] or b[1] > box[3] or b[3] < box[1]:
            continue
        polys.append((shape(sr.shape.__geo_interface__), sr.record.as_dict()["MAP"]))
    return polys


def fmt_circ(dbh: float) -> dict:
    inches = round(dbh * math.pi)
    return {"in": inches, "ft": inches // 12, "rem_in": inches % 12}


def main():
    village, village_all = load_village()
    parks, parks_all = load_parks()
    candidates = village + parks

    # Rank by DBH within species across both inventories (all sizes, not just candidates).
    sizes: dict[str, list[float]] = {}
    for r in village_all:
        if r["common_name"] in SPECIES and r["dbh_in"]:
            sizes.setdefault(r["common_name"], []).append(float(r["dbh_in"]))
    for f in parks_all:
        a = f["attributes"]
        if a["SPP_COMMON"] in SPECIES and a["DBH"]:
            sizes.setdefault(a["SPP_COMMON"], []).append(float(a["DBH"]))

    segs = load_streets()
    buildings = load_buildings()
    bld_tree = STRtree([b[0] for b in buildings])
    districts = load_districts()
    landcover = load_landcover([Point(to_utm(c["lon"], c["lat"])) for c in candidates])

    trees = []
    for c in candidates:
        common, latin, group = SPECIES[c["code"]]
        high = round(c["dbh"] * FOREST_FACTOR[c["code"]])
        if high < 200:
            continue
        row = DWYER_ROW[c["code"]]
        low, extrapolated = dwyer_low(row, c["dbh"])

        pt = Point(to_utm(c["lon"], c["lat"]))
        cover = next((m for g, m in landcover if g.contains(pt)), None)
        district = next((n for g, n in districts if g.contains(pt)), None)
        # Nearest surveyed building on the same street, within ~200 ft.
        street_word = (c["street"] or "").split(" ")[-2:] if c["street"] else None
        near = [
            buildings[i]
            for i in bld_tree.query(pt.buffer(60))
            if street_word and buildings[i][1]["address"].upper().split(" ")[-2:] == street_word
        ]
        near.sort(key=lambda b: b[0].distance(pt))
        house = near[0][1] | {"distance_ft": round(near[0][0].distance(pt) * 3.281)} if near else None

        name_flag = None
        if c["latin_raw"] != latin:
            name_flag = (
                f"Inventory lists the common name as {common} but the Latin name as "
                f"{c['latin_raw'] or '(blank)'}."
            )

        # Confidence: species group, how far the range reaches past 200, 1830s land cover.
        score, reasons = 0, []
        if group == "white":
            score += 2
            reasons.append("White-oak group: long-lived savanna species")
        else:
            reasons.append("Red-oak group: shorter-lived, grows faster")
        if high >= 250:
            score += 1
            reasons.append("Upper estimate well past 200 years")
        else:
            reasons.append("Upper estimate only just reaches 200 years")
        if cover in ("forest", "barrens"):
            score += 1
            reasons.append(f"1830s survey mapped this spot as {LANDCOVER_LABEL[cover]}")
        elif cover:
            reasons.append(f"1830s survey mapped this spot as {LANDCOVER_LABEL.get(cover, cover)}")
        if name_flag:
            score -= 1
            reasons.append("Species name conflict in inventory")
        confidence = "likely" if score >= 3 else "possible" if score == 2 else "long_shot"

        species_sizes = sorted(sizes[c["code"]], reverse=True)
        rank = 1 + sum(1 for s in species_sizes if s > c["dbh"])

        trees.append(
            {
                "key": f"{c['source']}-{c['id']}",
                "source": c["source"],
                "tree_id": c["id"],
                "global_id": c["global_id"],
                "common": common,
                "latin": latin,
                "latin_raw": c["latin_raw"],
                "name_flag": name_flag,
                "native": True,
                "group": group,
                "dbh_in": c["dbh"],
                "height_ft": c["height"],
                "spread_ft": c["spread"],
                "circumference": fmt_circ(c["dbh"]),
                "age_low": low,
                "age_high": high,
                "age_low_basis": f"Morton Arboretum street-tree table, {DWYER_LABEL[row]} row"
                + (" (extrapolated beyond the table)" if extrapolated else ""),
                "age_high_basis": f"Morton Arboretum old-growth forest factor {FOREST_FACTOR[c['code']]}",
                "extrapolated": extrapolated,
                "confidence": confidence,
                "confidence_reasons": reasons,
                "rank": rank,
                "rank_of": len(species_sizes),
                "address": approx_address(pt, c["street"], segs) if c["street"] else None,
                "street_view": street_view(pt, c["street"], segs),
                "block": c["block"].title() if c["block"] else None,
                "park": c["park"],
                "landcover_1830s": LANDCOVER_LABEL.get(cover, cover) if cover else None,
                "historic_district": district,
                "nearest_house": house,
                "lat": round(c["lat"], 7),
                "lon": round(c["lon"], 7),
            }
        )

    order = {"likely": 0, "possible": 1, "long_shot": 2}
    trees.sort(key=lambda t: (order[t["confidence"]], -t["age_high"], -t["dbh_in"]))
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "oaks.json").write_text(json.dumps({"generated": "2026-10-03", "trees": trees}, indent=1))

    print(len(trees), "trees;", {k: sum(t["confidence"] == k for t in trees) for k in order})
    print("by source", {s: sum(t["source"] == s for t in trees) for s in ("village", "park")})


if __name__ == "__main__":
    main()
