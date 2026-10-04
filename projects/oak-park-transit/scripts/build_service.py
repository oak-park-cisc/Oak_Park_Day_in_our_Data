"""Build public/data/route-service.json: when each Oak Park route runs and how
often, at stops in (or just across the street from) the Village.

For every route in transit-stops-oak-park.csv, on one weekday, Saturday and
Sunday, and in each direction:
  first / last  - when the first and last trip reach a Village stop
  trips         - how many trips serve a Village stop that day
  hourly        - trips reaching the Village in each hour, 4 a.m. to 3 a.m.

"Village stops" match the map's Village-only mode: inside the Village, or
within 100 m of its line (across Austin and Harlem).

Usage:
  python3 scripts/build_service.py <dir with cta.zip pace.zip metra.zip>

Downloads: same as scripts/build_routes.py. Needs shapely (pip install shapely).
"""
import csv
import io
import json
import math
import sys
import zipfile
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

from shapely.geometry import Point, shape
from shapely.ops import transform

ROOT = Path(__file__).resolve().parent.parent
STOPS_CSV = ROOT / "public/data/transit-stops-oak-park.csv"
BOUNDARY = ROOT / "public/data/boundary.geojson"
OUT = ROOT / "public/data/route-service.json"

# One representative day each, inside every feed's calendar and clear of
# holidays and special-event service
DAYS = {"weekday": date(2026, 10, 21), "saturday": date(2026, 10, 24), "sunday": date(2026, 10, 25)}

ACROSS_STREET_M = 100  # matches ACROSS_STREET_M in src/data.js
FIRST_HOUR, LAST_HOUR = 4, 27  # chart runs 4 a.m. through 3:59 a.m. next day

# Stops CSV names -> GTFS route_short_name / route_id
ALIASES = {"Green Line": "G", "Blue Line": "Blue"}
# Stops CSV stop_id -> GTFS stop_id where they differ
STOP_ALIASES = {"VOP-847": "OAKPARK"}
# Route key used by the app (matches live vehicle route names and palette.lines)
APP_ROUTE = {"G": "Green", "Blue": "Blue"}

LAT0 = 41.887
M_LAT = 111_320
M_LON = 111_320 * math.cos(math.radians(LAT0))


def to_m(lon, lat, z=None):
    return lon * M_LON, lat * M_LAT


def read(z, name):
    with z.open(name) as f:
        yield from csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig"), skipinitialspace=True)


def village_stops():
    """{agency: {gtfs_route: set(stop_id)}} for stops in or just across the Village."""
    feats = json.loads(BOUNDARY.read_text())["features"]
    village = transform(to_m, shape(next(f for f in feats if f["properties"]["kind"] == "village")["geometry"]))
    out = defaultdict(lambda: defaultdict(set))
    for row in csv.DictReader(open(STOPS_CSV, encoding="utf-8")):
        if row["in_oak_park"] != "Y":
            p = Point(to_m(float(row["longitude"]), float(row["latitude"])))
            if village.exterior.distance(p) > ACROSS_STREET_M:
                continue
        for r in row["routes"].split(";"):
            r = r.strip()
            if r:
                out[row["agency"]][ALIASES.get(r, r)].add(STOP_ALIASES.get(row["stop_id"], row["stop_id"]))
    return out


def active_services(z, day):
    ymd = day.strftime("%Y%m%d")
    dow = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"][day.weekday()]
    on = set()
    names = z.namelist()
    if "calendar.txt" in names:
        for c in read(z, "calendar.txt"):
            if c["start_date"] <= ymd <= c["end_date"] and c[dow] == "1":
                on.add(c["service_id"])
    if "calendar_dates.txt" in names:
        for c in read(z, "calendar_dates.txt"):
            if c["date"] == ymd:
                (on.add if c["exception_type"] == "1" else on.discard)(c["service_id"])
    return on


def minutes(t):
    h, m, s = (int(x) for x in t.split(":"))
    return h * 60 + m


def clock(mins):
    h, m = divmod(mins % (24 * 60), 60)
    return f"{(h % 12) or 12}:{m:02d} {'a.m.' if h < 12 else 'p.m.'}"


def span(times):
    """First and last trip, with the service day starting after the longest
    overnight gap. Feeds write after-midnight trips as 24:xx or 0:xx, and some
    lines start before 4 a.m., so no fixed cutoff works for every route.
    Returns (first, last, all_day); all_day means no gap of an hour or more."""
    t = sorted(m % (24 * 60) for m in times)
    gaps = [((t[(i + 1) % len(t)] - t[i]) % (24 * 60), i) for i in range(len(t))]
    gap, i = max(gaps) if len(t) > 1 else (24 * 60, 0)
    return t[(i + 1) % len(t)], t[i], gap < 60


def direction_label(agency, trip, terminal):
    """Rider-facing direction: compass for buses, end of the line for rail."""
    compass = trip.get("direction") if agency == "CTA" and trip["route_id"] not in ("G", "Blue") else trip.get("direction_text")
    if compass and compass.strip().lower() in ("north", "south", "east", "west"):
        return compass.strip().capitalize() + "bound"
    return f"toward {terminal}"


def build(agency, zip_path, want):
    z = zipfile.ZipFile(zip_path)
    routes = {}
    for r in read(z, "routes.txt"):
        key = r.get("route_short_name") or r["route_id"]
        key = key if key in want else r["route_id"] if r["route_id"] in want else None
        if key:
            routes[r["route_id"]] = (key, r.get("route_long_name", ""))

    stop_names, parent = {}, {}
    for s in read(z, "stops.txt"):
        stop_names[s["stop_id"]] = s["stop_name"]
        if s.get("parent_station"):
            parent[s["stop_id"]] = s["parent_station"]

    services = {d: active_services(z, day) for d, day in DAYS.items()}
    trips = {}
    for t in read(z, "trips.txt"):
        if t["route_id"] in routes:
            days = [d for d in DAYS if t["service_id"] in services[d]]
            if days:
                trips[t["trip_id"]] = (t, days)

    # One pass over stop_times: when each trip is at a Village stop, and where it ends
    in_village = defaultdict(list)
    last_stop = {}
    for st in read(z, "stop_times.txt"):
        tid = st["trip_id"]
        if tid not in trips:
            continue
        seq = int(st["stop_sequence"])
        if tid not in last_stop or seq > last_stop[tid][0]:
            last_stop[tid] = (seq, st["stop_id"])
        key = routes[trips[tid][0]["route_id"]][0]
        sid = st["stop_id"]
        if sid in want[key] or parent.get(sid) in want[key]:
            in_village[tid].append(minutes(st["arrival_time"] or st["departure_time"]))

    # Name each direction once per route (most common label), so every day agrees
    labels = defaultdict(Counter)
    for tid, (t, _) in trips.items():
        if tid in in_village:
            end = last_stop[tid][1]
            terminal = stop_names.get(parent.get(end, end), "").replace(" Station", "")
            labels[(t["route_id"], t["direction_id"])][direction_label(agency, t, terminal)] += 1

    out = {}
    for rid, (key, long_name) in routes.items():
        app_key = APP_ROUTE.get(key, key)
        entry = out.setdefault(app_key, {"agency": agency, "route": app_key, "name": long_name, "days": {}, "spans": {}})
        for d in DAYS:
            dirs = []
            all_times = []
            for did in sorted({t["direction_id"] for t, ds in trips.values() if t["route_id"] == rid}):
                times = sorted(
                    min(in_village[tid])
                    for tid, (t, ds) in trips.items()
                    if t["route_id"] == rid and t["direction_id"] == did and d in ds and tid in in_village
                )
                if not times:
                    continue
                all_times += times
                # Chart bins run 4 a.m. to 3 a.m. whatever the route's own service day
                hourly = [0] * (LAST_HOUR - FIRST_HOUR + 1)
                for m in times:
                    hourly[(m // 60 - FIRST_HOUR) % 24] += 1
                first, last, all_day = span(times)
                dirs.append({
                    "label": labels[(rid, did)].most_common(1)[0][0],
                    "first": clock(first),
                    "last": clock(last),
                    "allDay": all_day,
                    "trips": len(times),
                    "hourly": hourly,
                })
            entry["days"][d] = dirs
            # Whole route, both directions: for the route list
            if all_times:
                first, last, all_day = span(all_times)
                entry["spans"][d] = {"first": clock(first), "last": clock(last), "allDay": all_day}
            else:
                entry["spans"][d] = None
        n = {d: sum(x["trips"] for x in entry["days"][d]) for d in DAYS}
        print(f"{agency} {app_key:6} {long_name[:28]:28} weekday {n['weekday']:4}  sat {n['saturday']:4}  sun {n['sunday']:4}")
    missing = set(want) - {k for k, _ in routes.values()}
    if missing:
        print(f"  {agency}: no GTFS route for {sorted(missing)}")
    return out


def main():
    src = Path(sys.argv[1])
    want = village_stops()
    routes = {}
    for agency, fname in [("CTA", "cta.zip"), ("Pace", "pace.zip"), ("Metra", "metra.zip")]:
        for key, r in build(agency, src / fname, want[agency]).items():
            routes[f"{agency}:{key}"] = r
    OUT.write_text(json.dumps({
        "days": {d: day.isoformat() for d, day in DAYS.items()},
        "firstHour": FIRST_HOUR,
        "routes": routes,
    }, separators=(",", ":")))
    print(f"wrote {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
