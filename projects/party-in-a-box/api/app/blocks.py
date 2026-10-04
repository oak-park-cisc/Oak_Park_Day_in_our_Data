"""In-memory block index. Loaded once; stdlib-only geometry.

Coordinates in the block dicts are [lat, lon] rounded to 5 decimals. Distances use the local
meter projection point = (lon*KX, lat*KY).
"""
from __future__ import annotations

import csv
import json
import math
import re
from pathlib import Path

from .config import REPO_ROOT

LAT0 = 41.885
KX = 111320 * math.cos(math.radians(LAT0))
KY = 110540

ARTERIAL = re.compile(
    r'HARLEM|AUSTIN BLVD|OAK PARK AVE|RIDGELAND|MADISON|ROOSEVELT|NORTH AVE|CHICAGO AVE|LAKE ST|'
    r'WASHINGTON BLVD|I290|RAMP|EISENHOWER|GARFIELD|JACKSON BLVD|DIVISION|HARRISON')

REASON_EW = "East/west street: the Village doesn't close these."
REASON_ARTERIAL = "Main street: not closed for block parties (our assumption)."

SUFFIXES = {"AVENUE": "AVE", "STREET": "ST", "BOULEVARD": "BLVD", "COURT": "CT",
            "PLACE": "PL", "ROAD": "RD", "DRIVE": "DR"}
DIRECTIONS = {"N": "N", "S": "S", "E": "E", "W": "W", "NORTH": "N", "SOUTH": "S", "EAST": "E", "WEST": "W"}


def _xy(lat: float, lon: float) -> tuple[float, float]:
    return (float(lon) * KX, float(lat) * KY)


def _dist(a, b) -> float:
    return math.hypot(a[0] - b[0], a[1] - b[1])


def _base(name: str) -> str:
    return re.sub(r'^[NSEW] ', '', name)


def _r5(x: float) -> float:
    return round(x, 5)


def _label(name: str, hundred: int) -> str:
    return f"{hundred} " + " ".join(w if len(w) == 1 else w.capitalize() for w in name.split())


def _build_from_source() -> list[dict]:
    src = REPO_ROOT / "source-data"
    feats = json.load(open(src / "streets-oak-park.geojson", encoding="utf-8"))["features"]
    groups: dict[tuple[str, int], dict] = {}
    for f in feats:
        p = f["properties"]
        g = f["geometry"]
        name = p["street_name"] or ""
        if name == "ALLEY" or p["address_left_from"] in (-1, None) or g["type"] != "LineString":
            continue
        c = g["coordinates"]
        a, b = _xy(c[0][1], c[0][0]), _xy(c[-1][1], c[-1][0])
        ns = abs(b[1] - a[1]) > abs(b[0] - a[0])
        froms = [x for x in (p["address_left_from"], p["address_right_from"]) if x and x > 0]
        lo = min(froms)
        key = (name, lo // 100 * 100)
        grp = groups.get(key)
        if grp is None:
            grp = groups[key] = {"ns": ns, "lines": [], "los": [], "his": []}
        grp["lines"].append([(pt[1], pt[0]) for pt in c])  # (lat, lon)
        grp["los"].extend(froms)
        grp["his"].extend(x for x in (p["address_left_to"], p["address_right_to"]) if x and x > 0)

    blocks: list[dict] = []
    for (name, hundred), grp in groups.items():
        verts = [v for line in grp["lines"] for v in line]
        clat = sum(v[0] for v in verts) / len(verts)
        clon = sum(v[1] for v in verts) / len(verts)
        arterial = bool(ARTERIAL.search(name))
        ns = grp["ns"]
        eligible = ns and not arterial
        reason = "" if eligible else (REASON_EW if not ns else REASON_ARTERIAL)
        blocks.append({
            "id": f"{name}|{hundred}", "name": name, "base": _base(name), "hundred": hundred,
            "addr_lo": min(grp["los"]), "addr_hi": max(grp["his"]) if grp["his"] else hundred + 99,
            "centroid": [_r5(clat), _r5(clon)],
            "lines": [[[_r5(la), _r5(lo)] for la, lo in line] for line in grp["lines"]],
            "ns": ns, "arterial": arterial, "eligible": eligible, "reason": reason,
            "nearest_eligible": None, "tree_count": 0, "big_tree_count": 0,
            "bus_stops": {"count": 0, "weekday_trips": 0}, "bus_stop_list": [],
            "school_nearby": None, "capital_projects": [], "parking": [], "overnight_ban": False,
            "zip": None,
        })

    # 2b nearest eligible
    elig = [b for b in blocks if b["eligible"]]
    exy = [(b, _xy(*b["centroid"])) for b in elig]
    for b in blocks:
        if b["eligible"] or not exy:
            continue
        c = _xy(*b["centroid"])
        best, bd = min(((e, _dist(c, p)) for e, p in exy), key=lambda t: t[1])
        b["nearest_eligible"] = {"id": best["id"], "label": _label(best["name"], best["hundred"]),
                                 "meters": int(round(bd))}

    # 2c bus stops
    stops = []
    for r in csv.DictReader(open(src / "transit-stops-oak-park.csv", encoding="utf-8")):
        if r["stop_type"] == "rail_station" or not r["latitude"]:
            continue
        stops.append((r, _xy(r["latitude"], r["longitude"])))
    for b in blocks:
        vxy = [_xy(la, lo) for line in b["lines"] for la, lo in line]
        for r, p in stops:
            if any(_dist(p, v) <= 30 for v in vxy):
                trips = int(float(r["weekday_trips"])) if r["weekday_trips"] else 0
                b["bus_stop_list"].append({"stop_id": r["stop_id"], "lat": float(r["latitude"]),
                                           "lon": float(r["longitude"]), "weekday_trips": trips})
        b["bus_stops"] = {"count": len(b["bus_stop_list"]),
                          "weekday_trips": sum(s["weekday_trips"] for s in b["bus_stop_list"])}

    # 2d schools
    schools = [(r, _xy(r["latitude"], r["longitude"]))
               for r in csv.DictReader(open(src / "schools-oak-park.csv", encoding="utf-8")) if r["latitude"]]
    for b in blocks:
        c = _xy(*b["centroid"])
        if not schools:
            break
        r, p = min(schools, key=lambda t: _dist(c, t[1]))
        d = _dist(c, p)
        if d <= 150:
            b["school_nearby"] = {"name": r["name"], "lat": float(r["latitude"]),
                                  "lon": float(r["longitude"]), "meters": int(round(d))}

    # 2e trees
    tk: dict = {}
    big: dict = {}
    for r in csv.DictReader(open(src / "trees-oak-park.csv", encoding="utf-8")):
        if not r["block"][:1].isdigit():
            continue
        k = (r["nearest_street"], int(r["block"].split()[0]) // 100 * 100)
        tk[k] = tk.get(k, 0) + 1
        if r["dbh_in"] and 24 <= float(r["dbh_in"]) < 80:
            big[k] = big.get(k, 0) + 1
    for b in blocks:
        k = (b["name"], b["hundred"])
        b["tree_count"] = tk.get(k, 0)
        b["big_tree_count"] = big.get(k, 0)
    return blocks


def _normalize(b: dict) -> dict:
    b.setdefault("zip", None)
    b.setdefault("school_nearby", None)
    b.setdefault("parking", [])
    b.setdefault("overnight_ban", False)
    b.setdefault("capital_projects", [])
    b.setdefault("nearest_eligible", None)
    if "bus_stop_list" not in b:
        b["bus_stop_list"] = []
    return b


class BlockIndex:
    def __init__(self, blocks: list[dict]):
        self._blocks = [_normalize(b) for b in blocks]
        self.by_id: dict[str, dict] = {b["id"]: b for b in self._blocks}
        self._cxy = {b["id"]: _xy(*b["centroid"]) for b in self._blocks}

    def __len__(self) -> int:
        return len(self._blocks)

    def all(self) -> list[dict]:
        return list(self._blocks)

    @staticmethod
    def label(block: dict) -> str:
        return _label(block["name"], block["hundred"])

    def find_block(self, address: str):
        if not address:
            return None
        s = address.upper()
        s = re.sub(r'#.*$', '', s)
        s = re.sub(r'\b(APT|UNIT)\b.*$', '', s)
        s = re.sub(r'[.,]', ' ', s)
        toks = s.split()
        if not toks or not toks[0].isdigit():
            return None
        number = int(toks[0])
        rest = toks[1:]
        if not rest:
            return None
        if rest[-1] in SUFFIXES:
            rest[-1] = SUFFIXES[rest[-1]]
        typed_dir = None
        candidates = [" ".join(rest)]
        if len(rest) > 1 and rest[0] in DIRECTIONS:
            typed_dir = DIRECTIONS[rest[0]]
            candidates.insert(0, " ".join(rest[1:]))
        for street in candidates:
            same = [b for b in self._blocks if b["base"] == street]
            hits = [b for b in same if b["addr_lo"] <= number <= b["addr_hi"]]
            if not hits:
                hits = [b for b in same if b["hundred"] == number // 100 * 100]
            if hits:
                if typed_dir:
                    pref = [b for b in hits if b["name"].startswith(typed_dir + " ")]
                    if pref:
                        hits = pref
                return hits[0], number
        return None

    def summary(self, block: dict) -> dict:
        return {"id": block["id"], "label": self.label(block), "eligible": block["eligible"],
                "reason": block["reason"], "nearest_eligible": block["nearest_eligible"],
                "zip": block["zip"], "tree_count": block["tree_count"],
                "big_tree_count": block["big_tree_count"], "parking": block["parking"],
                "overnight_ban": block["overnight_ban"]}

    def distance_m(self, a_id: str, b_id: str) -> int:
        return int(round(_dist(self._cxy[a_id], self._cxy[b_id])))

    def neighbors(self, block_id: str, within_m: int = 200) -> list[dict]:
        me = self.by_id[block_id]
        out = []
        for b in self._blocks:
            if b["id"] == block_id:
                continue
            d = _dist(self._cxy[block_id], self._cxy[b["id"]])
            same = b["base"] == me["base"]
            if d <= within_m or (same and abs(b["hundred"] - me["hundred"]) == 100):
                out.append({"id": b["id"], "label": self.label(b), "distance_m": int(round(d)),
                            "same_street": same})
        return out


_index: BlockIndex | None = None


def get_index() -> BlockIndex:
    global _index
    if _index is None:
        path = REPO_ROOT / "web" / "data" / "blocks.json"
        if path.exists():
            blocks = json.load(open(path, encoding="utf-8"))
        else:
            blocks = _build_from_source()
        _index = BlockIndex(blocks)
    return _index
