"""Build public/data/boundary.geojson: the Village of Oak Park outline plus
fade masks that cover everything farther than a set distance outside it.

The map stacks the masks (nearest first) so the basemap fades out over the
first quarter mile past the Village line.

Usage:
  python3 scripts/build_boundary.py

Source: Census TIGERweb incorporated places, Oak Park village (GEOID 1754885).
Needs shapely (pip install shapely).
"""
import json
import math
import urllib.request
from pathlib import Path

from shapely.geometry import mapping, shape
from shapely.ops import transform

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public/data/boundary.geojson"

URL = (
    "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/"
    "Places_CouSub_ConCity_SubMCD/MapServer/4/query"
    "?where=GEOID%3D%271754885%27&outFields=NAME,GEOID&outSR=4326&f=geojson"
)

FADE_M = 402.336  # 1/4 mile
STEPS = 16
WORLD = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]

# Local equirectangular projection in meters, accurate enough at Village scale
LAT0 = 41.887
M_PER_DEG_LAT = 111_320
M_PER_DEG_LON = 111_320 * math.cos(math.radians(LAT0))


def to_m(lon, lat, z=None):
    return lon * M_PER_DEG_LON, lat * M_PER_DEG_LAT


def to_deg(x, y, z=None):
    return x / M_PER_DEG_LON, y / M_PER_DEG_LAT


def ring(coords):
    return [[round(x, 6), round(y, 6)] for x, y in coords]


def main():
    with urllib.request.urlopen(URL, timeout=30) as r:
        village = shape(json.load(r)["features"][0]["geometry"])
    village_m = transform(to_m, village)

    features = [{
        "type": "Feature",
        "properties": {"kind": "village", "name": "Village of Oak Park"},
        "geometry": mapping(village),
    }]
    for i in range(STEPS + 1):
        d = FADE_M * i / STEPS
        hole = transform(to_deg, village_m.buffer(d).simplify(2))
        features.append({
            "type": "Feature",
            "properties": {"kind": "fade", "step": i, "distance_m": round(d, 1)},
            "geometry": {"type": "Polygon", "coordinates": [WORLD, ring(hole.exterior.coords)]},
        })

    OUT.write_text(json.dumps({"type": "FeatureCollection", "features": features}, separators=(",", ":")))
    print(f"wrote {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
