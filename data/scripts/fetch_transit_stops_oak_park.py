#!/usr/bin/env python3
"""Build data/transit-stops-oak-park.csv: every bus stop and rail station in and
around Oak Park, with routes, scheduled weekday trips, wheelchair boarding, shelter
status, ridership, and a transit-rider vulnerability score.

One row per stop. Bus stops and CTA rail stations come from the agencies' GTFS static
feeds (the schedule in force when the script runs); the Metra station comes from the
Village GIS. Amenity and ridership attributes are joined on from Pace's own GIS server
and from CMAP. Sources, all primary:

  CTA GTFS static feed   https://www.transitchicago.com/downloads/sch_data/google_transit.zip
                         stops.txt (wheelchair_boarding), trips.txt, stop_times.txt, calendar*.txt
  Pace GTFS static feed  linked from https://www.pacebus.com/gtfs (PACE_GTFS_URL below)
  Village of Oak Park    Modes of Transportation web map, item 175b26ace9b74ae899803e3e34893570,
                         VOP MapServer layer 0 (Pace Bus Stop, 2019 snapshot) and layer 1
                         (Metra Train Station); Municipal_Boundary feature service
  Pace Suburban Bus GIS  https://maps.pacebus.com/arcgis/rest/services/StrategicServices/
                         Shelters_Posted_Stops/MapServer/0 (Pace_Shelters, assessed Dec 2015)
                         APC/MapServer/0 (Spring_2026 automatic passenger counts by stop)
  CMAP                   TRIP transit rider vulnerability data, northeastern Illinois (2024),
                         https://services5.arcgis.com/LcMXE3TFhi1BSaCY/arcgis/rest/services/
                         TRVI_Data_Data_Hub/FeatureServer layers 0 (CTA Bus Stops) and
                         1 (Pace Bus Stops), which carry a 'sheltered' field

Filter: the Oak Park bounding box BBOX below, which is the catalog's box widened east to
-87.7740 so stops on the Oak Park side of Austin Blvd are kept. The in_oak_park column
says whether the point is inside the Village boundary polygon; stops across Harlem Ave,
North Ave, Roosevelt Rd, and Austin Blvd are kept (they serve Oak Park riders) but
flagged N.

Python 3 standard library only. Usage:
    python3 data/scripts/fetch_transit_stops_oak_park.py
"""
import csv
import datetime as dt
import io
import json
import math
import sys
import time
import urllib.parse
import urllib.request
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "transit-stops-oak-park.csv"
UA = "oak-park-day-in-our-data/1.0 (data extraction script)"

CTA_GTFS_URL = "https://www.transitchicago.com/downloads/sch_data/google_transit.zip"
PACE_GTFS_PAGE = "https://www.pacebus.com/gtfs"
PACE_GTFS_URL = "https://www.pacebus.com/sites/default/files/2026-08/GTFS.zip"  # from PACE_GTFS_PAGE

VOP = ("https://utility.arcgis.com/usrsvcs/servers/4cff1aaefa364b57b8c70d5c606f2088"
       "/rest/services/VOP/AGOL_VOP_Project/MapServer")
BOUNDARY = ("https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services"
            "/Municipal_Boundary/FeatureServer/0")
PACE_GIS = "https://maps.pacebus.com/arcgis/rest/services/StrategicServices"
PACE_SHELTERS = PACE_GIS + "/Shelters_Posted_Stops/MapServer/0"
PACE_APC = PACE_GIS + "/APC/MapServer/0"          # layer 0 is the newest pick (Spring_2026)
CMAP = ("https://services5.arcgis.com/LcMXE3TFhi1BSaCY/arcgis/rest/services"
        "/TRVI_Data_Data_Hub/FeatureServer")

# lon_min, lat_min, lon_max, lat_max
BBOX = (-87.8135, 41.8698, -87.7740, 41.9045)
MATCH_M = 40.0   # nearest-point join tolerance for layers without a shared stop id
SHELTER_M = 15.0  # tighter: a shelter belongs to one corner, not the whole intersection
APC_M = 10.0      # APC points coincide with the GTFS stop; the other direction is 60 m off

COLS = [
    "stop_type", "agency", "stop_id", "stop_code", "stop_name", "stop_desc",
    "latitude", "longitude", "in_oak_park",
    "routes", "route_names", "weekday_trips", "weekday_date",
    "wheelchair_boarding",
    "pace_shelter_2015", "pace_shelter_type", "pace_shelter_corner",
    "cmap_sheltered_2024", "cmap_trvi", "cmap_trvi_category",
    "cmap_mean_svi_norm", "cmap_mean_no_vehicle_norm", "cmap_match_m",
    "apc_ons", "apc_offs", "apc_total", "apc_routes", "apc_match_m",
    "village_2019_stop", "village_2019_routes",
    "source",
]


# ----------------------------------------------------------------------------- helpers
def fetch(url, tries=4, timeout=300):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except Exception as e:  # noqa: BLE001
            if attempt == tries - 1:
                raise
            print(f"  retry {attempt + 1} for {url[:80]} after error: {e}", file=sys.stderr)
            time.sleep(3 * (attempt + 1))


def get_json(url):
    data = json.loads(fetch(url))
    if "error" in data:
        raise RuntimeError(f"{url[:100]}: {data['error']}")
    return data


def query_bbox(layer, extra=None):
    """All features of an ArcGIS layer intersecting BBOX, WGS84, Esri JSON."""
    params = {
        "where": "1=1", "outFields": "*", "outSR": 4326, "f": "json",
        "geometry": ",".join(str(v) for v in BBOX), "geometryType": "esriGeometryEnvelope",
        "inSR": 4326, "spatialRel": "esriSpatialRelIntersects",
    }
    if extra:
        params.update(extra)
    feats, offset = [], 0
    while True:
        params["resultOffset"] = offset
        page = get_json(layer + "/query?" + urllib.parse.urlencode(params))
        got = page.get("features", [])
        feats.extend(got)
        if not page.get("exceededTransferLimit") or not got:
            return feats
        offset += len(got)


def point_xy(geom):
    """Point or single-point multipoint geometry to (lon, lat)."""
    if not geom:
        return None
    if "x" in geom:
        return geom["x"], geom["y"]
    pts = geom.get("points") or []
    return (pts[0][0], pts[0][1]) if pts else None


def in_bbox(lon, lat):
    return BBOX[0] <= lon <= BBOX[2] and BBOX[1] <= lat <= BBOX[3]


def meters(lon1, lat1, lon2, lat2):
    x = (lon2 - lon1) * 111320 * math.cos(math.radians((lat1 + lat2) / 2))
    y = (lat2 - lat1) * 110574
    return math.hypot(x, y)


def nearest(lon, lat, points):
    """(index, distance_m) of the closest (lon, lat, payload) tuple."""
    best, best_d = None, float("inf")
    for i, (plon, plat, _) in enumerate(points):
        d = meters(lon, lat, plon, plat)
        if d < best_d:
            best, best_d = i, d
    return best, best_d


def ring_contains(ring, lon, lat):
    inside = False
    n = len(ring)
    for i in range(n):
        x1, y1 = ring[i][0], ring[i][1]
        x2, y2 = ring[(i + 1) % n][0], ring[(i + 1) % n][1]
        if (y1 > lat) != (y2 > lat):
            xint = x1 + (lat - y1) * (x2 - x1) / (y2 - y1)
            if lon < xint:
                inside = not inside
    return inside


def polygon_contains(geometry, lon, lat):
    polys = geometry["coordinates"] if geometry["type"] == "MultiPolygon" \
        else [geometry["coordinates"]]
    for rings in polys:
        if ring_contains(rings[0], lon, lat) and not any(ring_contains(h, lon, lat) for h in rings[1:]):
            return True
    return False


# ----------------------------------------------------------------------------- GTFS
def read_gtfs_table(zf, name):
    if name not in zf.namelist():
        return []
    return list(csv.DictReader(io.TextIOWrapper(zf.open(name), encoding="utf-8-sig")))


def weekday_services(zf, ref):
    """service_ids running on date ref (a weekday), from calendar.txt plus exceptions."""
    day = ref.strftime("%A").lower()
    ymd = ref.strftime("%Y%m%d")
    active = set()
    for r in read_gtfs_table(zf, "calendar.txt"):
        if r.get(day) == "1" and r["start_date"] <= ymd <= r["end_date"]:
            active.add(r["service_id"])
    for r in read_gtfs_table(zf, "calendar_dates.txt"):
        if r["date"] == ymd:
            if r["exception_type"] == "1":
                active.add(r["service_id"])
            elif r["exception_type"] == "2":
                active.discard(r["service_id"])
    return active


def pick_weekday(zf):
    """First Wednesday on or after today that the feed's calendar covers."""
    cal = read_gtfs_table(zf, "calendar.txt")
    dates = read_gtfs_table(zf, "calendar_dates.txt")
    starts = [r["start_date"] for r in cal] + [r["date"] for r in dates]
    ends = [r["end_date"] for r in cal] + [r["date"] for r in dates]
    lo = dt.datetime.strptime(min(starts), "%Y%m%d").date()
    hi = dt.datetime.strptime(max(ends), "%Y%m%d").date()
    d = max(dt.date.today(), lo)
    while d.weekday() != 2:
        d += dt.timedelta(days=1)
    if d > hi:
        d = lo
        while d.weekday() != 2:
            d += dt.timedelta(days=1)
    return d


def load_gtfs(agency, url):
    print(f"downloading {agency} GTFS ...")
    zf = zipfile.ZipFile(io.BytesIO(fetch(url, timeout=600)))
    stops = {}
    for r in read_gtfs_table(zf, "stops.txt"):
        try:
            lon, lat = float(r["stop_lon"]), float(r["stop_lat"])
        except (TypeError, ValueError):
            continue
        if in_bbox(lon, lat):
            r["_lon"], r["_lat"] = lon, lat
            stops[r["stop_id"]] = r
    routes = {r["route_id"]: r for r in read_gtfs_table(zf, "routes.txt")}
    trips = {r["trip_id"]: r for r in read_gtfs_table(zf, "trips.txt")}
    ref = pick_weekday(zf)
    services = weekday_services(zf, ref)
    # Rail stations: attribute child platform trips to the parent station.
    parent_of = {sid: s.get("parent_station") or sid for sid, s in stops.items()}
    stop_routes, stop_trips = defaultdict(set), defaultdict(set)
    f = io.TextIOWrapper(zf.open("stop_times.txt"), encoding="utf-8-sig")
    rd = csv.reader(f)
    hdr = next(rd)
    ti, si = hdr.index("trip_id"), hdr.index("stop_id")
    for row in rd:
        sid = row[si]
        if sid in stops:
            trip = trips.get(row[ti])
            if not trip:
                continue
            target = parent_of[sid]
            stop_routes[target].add(trip["route_id"])
            if trip["service_id"] in services:
                stop_trips[target].add(row[ti])
    print(f"  {agency}: {len(stops)} stops in bbox, weekday reference {ref}, "
          f"{len(services)} active service ids")
    return stops, routes, stop_routes, stop_trips, ref


def route_label(routes, rid):
    r = routes.get(rid, {})
    return (r.get("route_short_name") or "").strip() or (r.get("route_long_name") or "").strip() or rid


def route_name(routes, rid):
    r = routes.get(rid, {})
    return (r.get("route_long_name") or "").strip() or route_label(routes, rid)


# ----------------------------------------------------------------------------- main
def main():
    rows = []

    boundary = json.loads(fetch(BOUNDARY + "/query?where=1%3D1&outFields=*&outSR=4326&f=geojson"))
    boundary_geom = boundary["features"][0]["geometry"]

    def base_row(**kw):
        r = {c: "" for c in COLS}
        r.update(kw)
        r["in_oak_park"] = "Y" if polygon_contains(boundary_geom, r["longitude"], r["latitude"]) else "N"
        return r

    for agency, url in (("CTA", CTA_GTFS_URL), ("Pace", PACE_GTFS_URL)):
        stops, routes, stop_routes, stop_trips, ref = load_gtfs(agency, url)
        for sid, s in stops.items():
            loc = s.get("location_type") or "0"
            if loc == "2":          # station entrances, folded into the parent station
                continue
            if loc == "0" and s.get("parent_station"):
                continue            # rail platform, represented by its parent station
            rids = sorted(stop_routes.get(sid, ()), key=lambda x: route_label(routes, x))
            if loc == "0" and not rids:
                continue            # in stops.txt but no scheduled service
            wb = (s.get("wheelchair_boarding") or "").strip()
            rows.append(base_row(
                stop_type="rail_station" if loc == "1" else "bus_stop",
                agency=agency, stop_id=sid, stop_code=(s.get("stop_code") or "").strip(),
                stop_name=s["stop_name"].strip(), stop_desc=(s.get("stop_desc") or "").strip(),
                latitude=round(s["_lat"], 7), longitude=round(s["_lon"], 7),
                routes="; ".join(route_label(routes, r) for r in rids),
                route_names="; ".join(route_name(routes, r) for r in rids),
                weekday_trips=len(stop_trips.get(sid, ())), weekday_date=ref.isoformat(),
                wheelchair_boarding=wb if wb in ("1", "2") else "",
                source=f"{agency} GTFS",
            ))

    # Metra: the Village GIS point (Metra's GTFS feed needs an API key).
    for feat in query_bbox(VOP + "/1"):
        a, xy = feat["attributes"], point_xy(feat.get("geometry"))
        rows.append(base_row(
            stop_type="rail_station", agency="Metra", stop_id=f"VOP-{a['OBJECTID']}",
            stop_name=a.get("FACILITYNAME") or "", stop_desc=a.get("LOCATION") or "",
            latitude=round(xy[1], 7), longitude=round(xy[0], 7),
            routes="UP-W", route_names="Union Pacific West Line",
            source="Village GIS layer 1 (Metra Train Station)",
        ))

    # --- Pace shelters (Dec 2015 assessment), keyed on Pace's stop id = GTFS stop_code
    shelters = {}
    shelter_pts = []
    for feat in query_bbox(PACE_SHELTERS):
        a, xy = feat["attributes"], point_xy(feat.get("geometry"))
        if a.get("STOP_ID") is not None:
            shelters[str(int(a["STOP_ID"]))] = a
        if xy:
            shelter_pts.append((xy[0], xy[1], a))
    # --- Pace APC (Spring 2026): one record per route and direction; records for the
    # same physical stop share one point, which coincides with the GTFS stop (0 m) while
    # the opposite-direction stop is 60 m or more away. Cluster by point and join to the
    # nearest cluster within APC_M so the two sides of a street are never summed together.
    apc_clusters = defaultdict(list)
    for feat in query_bbox(PACE_APC):
        xy = point_xy(feat.get("geometry"))
        if xy:
            apc_clusters[(round(xy[0], 6), round(xy[1], 6))].append(feat["attributes"])
    apc_pts = [(lon, lat, recs) for (lon, lat), recs in apc_clusters.items()]
    # --- CMAP TRIP 2024 (layer 0 CTA bus stops, layer 1 Pace bus stops)
    cmap_pts = {"CTA": [], "Pace": []}
    for agency, layer in (("CTA", 0), ("Pace", 1)):
        for feat in query_bbox(f"{CMAP}/{layer}"):
            xy = point_xy(feat.get("geometry"))
            if xy:
                cmap_pts[agency].append((xy[0], xy[1], feat["attributes"]))
    # --- Village 2019 Pace stop snapshot
    village_pts = []
    for feat in query_bbox(VOP + "/0"):
        xy = point_xy(feat.get("geometry"))
        if xy:
            village_pts.append((xy[0], xy[1], feat["attributes"]))
    print(f"joins: {len(shelters)} Pace shelters, {len(apc_clusters)} APC stop points, "
          f"{len(cmap_pts['CTA'])} CMAP CTA stops, {len(cmap_pts['Pace'])} CMAP Pace stops, "
          f"{len(village_pts)} Village 2019 stops")

    for r in rows:
        if r["stop_type"] != "bus_stop":
            continue
        lon, lat = r["longitude"], r["latitude"]
        if r["agency"] == "Pace":
            # Shelter: Pace's STOP_ID is the GTFS stop_code; a shelter with no id is
            # matched only if it sits on the stop itself (shelters serve one corner).
            sh = shelters.get(r["stop_code"])
            if sh is None:
                i, d = nearest(lon, lat, shelter_pts)
                sh = shelter_pts[i][2] if i is not None and d <= SHELTER_M else None
            r["pace_shelter_2015"] = "Y" if sh else "N"
            if sh:
                r["pace_shelter_type"] = sh.get("TYPE") or ""
                r["pace_shelter_corner"] = sh.get("CORNER") or ""
            # APC: nearest stop point, tight tolerance (see apc_clusters above).
            i, d = nearest(lon, lat, apc_pts)
            if i is not None and d <= APC_M:
                recs = apc_pts[i][2]
                r["apc_ons"] = sum(int(x.get("Ons") or 0) for x in recs)
                r["apc_offs"] = sum(int(x.get("Offs") or 0) for x in recs)
                r["apc_total"] = sum(int(x.get("Total") or 0) for x in recs)
                r["apc_routes"] = "; ".join(sorted({str(int(x["ROUTE"])) for x in recs if x.get("ROUTE")}))
                r["apc_match_m"] = round(d, 1)
            i, d = nearest(lon, lat, village_pts)
            r["village_2019_stop"] = "Y" if i is not None and d <= MATCH_M else "N"
            if r["village_2019_stop"] == "Y":
                r["village_2019_routes"] = (village_pts[i][2].get("ROUTEIDENTIFIER") or "").strip()
        pts = cmap_pts[r["agency"]]
        i, d = nearest(lon, lat, pts)
        if i is not None and d <= MATCH_M:
            a = pts[i][2]
            r["cmap_sheltered_2024"] = a.get("sheltered") or ""
            r["cmap_trvi"] = round(a["TRVI"], 3) if a.get("TRVI") is not None else ""
            r["cmap_trvi_category"] = a.get("TRVI_Category") or ""
            r["cmap_mean_svi_norm"] = round(a["MEAN_SVI_norm"], 4) if a.get("MEAN_SVI_norm") is not None else ""
            r["cmap_mean_no_vehicle_norm"] = (round(a["MEAN_HouseholdNoVehicle_norm"], 4)
                                              if a.get("MEAN_HouseholdNoVehicle_norm") is not None else "")
            r["cmap_match_m"] = round(d, 1)

    rows.sort(key=lambda r: (r["stop_type"] != "rail_station", r["agency"], r["routes"], r["stop_name"]))
    with OUT.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=COLS, extrasaction="raise")
        w.writeheader()
        w.writerows(rows)

    bus = [r for r in rows if r["stop_type"] == "bus_stop"]
    print("stop_type/agency:", dict(Counter((r["stop_type"], r["agency"]) for r in rows)))
    print("in_oak_park:", dict(Counter(r["in_oak_park"] for r in rows)))
    print("pace_shelter_2015:", dict(Counter(r["pace_shelter_2015"] for r in bus)))
    print("cmap_sheltered_2024:", dict(Counter(r["cmap_sheltered_2024"] for r in bus)))
    print("wheelchair_boarding:", dict(Counter(r["wheelchair_boarding"] for r in rows)))
    print("apc matched:", sum(1 for r in bus if r["apc_total"] != ""), "of",
          sum(1 for r in bus if r["agency"] == "Pace"), "Pace stops")
    print(f"wrote {OUT} rows={len(rows)} cols={len(COLS)} bytes={OUT.stat().st_size}")


if __name__ == "__main__":
    main()
