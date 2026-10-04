"""Build public/data/travel.json: a compact timetable and grid for the Travel
time view, small enough to route in the browser in milliseconds.

  stops     [[lat, lon], ...] every GTFS stop/platform near Oak Park
  days      {weekday|saturday|sunday: [pattern, ...]}
            pattern = {"r": "CTA:90", "s": [stop index, ...],
                       "t": [[minutes at each stop], ...] one row per trip, sorted}
  cells     [[lat, lon], ...] 100 m grid cell centers inside the Village
  walk      walking along real streets (OpenStreetMap), as minutes:
            cellStops  per cell [[stop, min], ...] stops within ACCESS_M
            cellNbrs   per cell [[cell, min], ...] its 8 neighbors; the browser
                       walks this small graph from a pin, so the Eisenhower is
                       crossed only where a street or path actually crosses it
            transfers  per stop [[stop, min], ...] within TRANSFER_M

Uses the same stops, routes and sample days as scripts/build_service.py.

Usage:
  python3 scripts/build_travel.py <dir with cta.zip pace.zip metra.zip osm-walk.json>

osm-walk.json: Overpass API result (out skel) for walkable ways around Oak Park:
  [out:json];way["highway"]["highway"!~"motorway|motorway_link|trunk|trunk_link|
  construction|proposed|raceway|bus_guideway|platform"]["footway"!~"sidewalk|
  crossing|traffic_island"]["foot"!~"no|private"]["access"!~"private|no"]
  ["service"!~"parking_aisle|driveway|drive-through|alley"]
  (41.848,-87.830,41.926,-87.752);(._;>;);out skel qt;
Separately mapped sidewalks are left out: the street stands in for them.
Alleys are left out too: people walk the sidewalks, and drawn routes stay on streets.

osm-barriers.json: expressways and rail lines, which walking can only cross
where a street does (everywhere else it may cut across open ground):
  [out:json];(way["highway"~"^(motorway|motorway_link|trunk|trunk_link)$"](bbox);
  way["railway"~"^(rail|subway|light_rail)$"]["service"!~"yard|siding|spur"](bbox););
  out geom qt;
"""
import heapq
import json
import math
import sys
import zipfile
from collections import defaultdict
from pathlib import Path

from shapely.geometry import LineString, Point, shape
from shapely.ops import transform, unary_union
from shapely.prepared import prep

from build_service import ALIASES, APP_ROUTE, BOUNDARY, DAYS, ROOT, active_services, minutes, read, to_m, village_stops, M_LAT, M_LON

OUT = ROOT / "public/data/travel.json"
CELL_M = 100
WALK_M_PER_MIN = 78  # 1.3 m/s, about 3 mph
ACCESS_M = 1200  # longest walk to or from a stop (~15 min)
TRANSFER_M = 400  # longest walk between stops when transferring
SNAP_MAX_M = 300  # a point farther than this from any street is left unlinked (park interiors are ~150-250 m)


class Streets:
    """Walkable OSM ways as a graph in local meters, for shortest walks."""

    def __init__(self, path):
        els = json.loads(Path(path).read_text())["elements"]
        pos = {e["id"]: (e["lon"] * M_LON, e["lat"] * M_LAT) for e in els if e["type"] == "node"}
        self.adj = defaultdict(list)
        for w in (e for e in els if e["type"] == "way"):
            for a, b in zip(w["nodes"], w["nodes"][1:]):
                if a in pos and b in pos:
                    d = math.dist(pos[a], pos[b])
                    self.adj[a].append((b, d))
                    self.adj[b].append((a, d))
        # Keep only the main connected network. Station platforms on the
        # embankment otherwise snap to stray path stubs that lead nowhere.
        main = self._largest_component()
        self.adj = {n: [(m, d) for m, d in self.adj[n] if m in main] for n in main}
        self.pos = {n: pos[n] for n in self.adj}
        # 50 m buckets for nearest-node lookups
        self.buckets = defaultdict(list)
        for n, (x, y) in self.pos.items():
            self.buckets[(int(x // 50), int(y // 50))].append(n)

    def _largest_component(self):
        seen, best = set(), set()
        for start in self.adj:
            if start in seen:
                continue
            comp, stack = {start}, [start]
            while stack:
                for m, _ in self.adj[stack.pop()]:
                    if m not in comp:
                        comp.add(m)
                        stack.append(m)
            seen |= comp
            if len(comp) > len(best):
                best = comp
        return best

    def snap(self, x, y):
        """Nearest street node and the straight-line meters to it."""
        bx, by = int(x // 50), int(y // 50)
        best = (None, SNAP_MAX_M)
        r = math.ceil(SNAP_MAX_M / 50)
        for i in range(bx - r, bx + r + 1):
            for j in range(by - r, by + r + 1):
                for n in self.buckets.get((i, j), ()):
                    d = math.dist((x, y), self.pos[n])
                    if d < best[1]:
                        best = (n, d)
        return best

    def within(self, src, limit):
        """Meters along streets from node src to every node within limit."""
        dist = {src: 0.0}
        heap = [(0.0, src)]
        while heap:
            d, n = heapq.heappop(heap)
            if d > dist.get(n, math.inf):
                continue
            for m, w in self.adj[n]:
                nd = d + w
                if nd <= limit and nd < dist.get(m, math.inf):
                    dist[m] = nd
                    heapq.heappush(heap, (nd, m))
        return dist


KEEP_PER_PATTERN = 2  # nearest stops kept per route pattern for each cell


def load_barriers(path):
    """Expressway lanes and rail lines (OSM, `out geom`) as one shape in meters."""
    lines = [
        LineString([(p["lon"] * M_LON, p["lat"] * M_LAT) for p in w["geometry"]])
        for w in json.loads(Path(path).read_text())["elements"]
        if w["type"] == "way" and len(w.get("geometry", [])) > 1
    ]
    return prep(unary_union(lines))


def walking(streets, cells, stops, stop_patterns, barriers):
    """Street-network walking minutes: cell->stops, cell->8 neighbors, stop->stops.

    stop_patterns: per stop, the ids of the route patterns that serve it. A
    cell keeps only its nearest few stops on each pattern: walking farther to
    board the same vehicle never helps, and it keeps the file small."""
    to_xy = lambda ll: (ll[1] * M_LON, ll[0] * M_LAT)
    cell_snap = [streets.snap(*to_xy(c)) for c in cells]
    stop_snap = [streets.snap(*to_xy(s)) for s in stops]
    stops_at = defaultdict(list)
    for i, (n, d) in enumerate(stop_snap):
        if n is not None:
            stops_at[n].append((i, d))
    cell_at = defaultdict(list)
    for i, (n, d) in enumerate(cell_snap):
        if n is not None:
            cell_at[n].append((i, d))
    index = {(round(c[0] * M_LAT / CELL_M), round(c[1] * M_LON / CELL_M)): i for i, c in enumerate(cells)}
    mins = lambda m: round(m / WALK_M_PER_MIN, 1)

    found_all, nbr_m = [], []
    for i, (n, snap_d) in enumerate(cell_snap):
        dist = streets.within(n, ACCESS_M) if n is not None else {}
        found = {}
        for node, d in dist.items():
            for s, sd in stops_at.get(node, ()):
                total = snap_d + d + sd
                if total <= ACCESS_M and total < found.get(s, math.inf):
                    found[s] = total
        found_all.append(found)
        # Neighbors. Oak Park is a street grid, so a hop costs grid distance
        # (100 m across, 200 m diagonally) - which also lets a walk cut across
        # a park, school yard or parking lot with no street through it. Where
        # the Eisenhower or a rail line lies between the cells, the hop is the
        # street distance between their snap nodes instead: the detour to a
        # bridge or underpass (never less than grid; none if out of reach).
        r, c = round(cells[i][0] * M_LAT / CELL_M), round(cells[i][1] * M_LON / CELL_M)
        nbrs = []
        for dr in (-1, 0, 1):
            for dc in (-1, 0, 1):
                j = index.get((r + dr, c + dc))
                if j is None or j == i:
                    continue
                gridd = CELL_M * (abs(dr) + abs(dc))
                if barriers.intersects(LineString([to_xy(cells[i]), to_xy(cells[j])])):
                    d = dist.get(cell_snap[j][0], math.inf) if cell_snap[j][0] is not None else math.inf
                    d = max(d, gridd)
                else:
                    d = gridd
                if d < math.inf:
                    nbrs.append((j, d))
        nbr_m.append(nbrs)

    # A cell can also reach the stops its neighbors reach, plus the hop. Fixes
    # cells whose own snap lands on a street that's a long way around (parks,
    # dead ends) from stops just a block away.
    for _ in range(2):
        shared = []
        for i in range(len(cells)):
            best = dict(found_all[i])
            for j, hop in nbr_m[i]:
                for s, d in found_all[j].items():
                    if d + hop <= ACCESS_M and d + hop < best.get(s, math.inf):
                        best[s] = d + hop
            shared.append(best)
        found_all = shared

    cell_stops = []
    for found in found_all:
        by_pattern = defaultdict(list)
        for s, m in found.items():
            for p in stop_patterns[s]:
                by_pattern[p].append((m, s))
        keep = {s for near in by_pattern.values() for _, s in sorted(near)[:KEEP_PER_PATTERN]}
        cell_stops.append(sorted([s, mins(found[s])] for s in keep))
    cell_nbrs = [[[j, mins(d)] for j, d in nbrs] for nbrs in nbr_m]

    transfers = []
    for i, (n, snap_d) in enumerate(stop_snap):
        out = {}
        if n is not None:
            for node, d in streets.within(n, TRANSFER_M).items():
                for s, sd in stops_at.get(node, ()):
                    total = snap_d + d + sd
                    if s != i and total <= TRANSFER_M and total < out.get(s, math.inf):
                        out[s] = total
        transfers.append(sorted([s, mins(m)] for s, m in out.items()))
    unlinked = sum(n is None for n, _ in cell_snap)
    print(f"walking: {unlinked} cells and {sum(n is None for n, _ in stop_snap)} stops more than {SNAP_MAX_M} m from a street")
    return {
        "speed": WALK_M_PER_MIN,
        "accessM": ACCESS_M,
        "cellStops": cell_stops,
        "cellNbrs": cell_nbrs,
        "transfers": transfers,
    }


def grid():
    feats = json.loads(BOUNDARY.read_text())["features"]
    village = transform(to_m, shape(next(f for f in feats if f["properties"]["kind"] == "village")["geometry"]))
    x0, y0, x1, y1 = village.bounds
    cells = []
    y = y0 + CELL_M / 2
    while y < y1:
        x = x0 + CELL_M / 2
        while x < x1:
            if village.contains(Point(x, y)):
                cells.append([round(y / M_LAT, 5), round(x / M_LON, 5)])
            x += CELL_M
        y += CELL_M
    return cells


def main():
    src = Path(sys.argv[1])
    # Every stop in the stops file, not just the ones by the Village line: a
    # trip may ride through River Forest or Forest Park stops on its way
    want = {a: set().union(*r.values()) for a, r in village_stops().items()}
    stop_index, stops = {}, []
    days = {d: [] for d in DAYS}

    for agency, fname in [("CTA", "cta.zip"), ("Pace", "pace.zip"), ("Metra", "metra.zip")]:
        z = zipfile.ZipFile(src / fname)
        names = {r for r in village_stops()[agency]}
        routes = {}
        for r in read(z, "routes.txt"):
            key = r.get("route_short_name") or r["route_id"]
            key = key if key in names else r["route_id"] if r["route_id"] in names else None
            if key:
                routes[r["route_id"]] = f"{agency}:{APP_ROUTE.get(key, key)}"
        info = {s["stop_id"]: s for s in read(z, "stops.txt")}
        svc = {d: active_services(z, day) for d, day in DAYS.items()}
        trips = {}
        for t in read(z, "trips.txt"):
            if t["route_id"] in routes:
                ds = [d for d in DAYS if t["service_id"] in svc[d]]
                if ds:
                    trips[t["trip_id"]] = (routes[t["route_id"]], ds)

        events = defaultdict(list)
        for st in read(z, "stop_times.txt"):
            tid, sid = st["trip_id"], st["stop_id"]
            if tid in trips and (sid in want[agency] or info.get(sid, {}).get("parent_station") in want[agency]):
                events[tid].append((int(st["stop_sequence"]), sid, minutes(st["departure_time"] or st["arrival_time"])))

        patterns = defaultdict(list)  # (route, stop tuple) -> [(times, days)]
        for tid, ev in events.items():
            if len(ev) < 2:
                continue  # one stop in the area: can't ride between two of them
            ev.sort()
            for _, sid, _ in ev:
                if sid not in stop_index:
                    s = info[sid]
                    stop_index[sid] = len(stops)
                    stops.append([round(float(s["stop_lat"]), 5), round(float(s["stop_lon"]), 5)])
            key = (trips[tid][0], tuple(stop_index[sid] for _, sid, _ in ev))
            patterns[key].append(([m for _, _, m in ev], trips[tid][1]))

        for (route, seq), rows in patterns.items():
            for d in DAYS:
                t = sorted(times for times, ds in rows if d in ds)
                if t:
                    days[d].append({"r": route, "s": list(seq), "t": t})

    cells = grid()
    stop_patterns = [set() for _ in stops]
    pattern_ids = {}
    for pats in days.values():
        for p in pats:
            pid = pattern_ids.setdefault((p["r"], tuple(p["s"])), len(pattern_ids))
            for s in p["s"]:
                stop_patterns[s].add(pid)
    walk = walking(Streets(src / "osm-walk.json"), cells, stops, stop_patterns, load_barriers(src / "osm-barriers.json"))
    OUT.write_text(json.dumps({"stops": stops, "days": days, "cells": cells, "cellM": CELL_M, "walk": walk}, separators=(",", ":")))
    n = {d: sum(len(p["t"]) for p in ps) for d, ps in days.items()}
    print(f"{len(stops)} stops, {len(cells)} cells, patterns {[len(p) for p in days.values()]}, trips {n}")
    print(f"wrote {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
