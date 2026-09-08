#!/usr/bin/env python3
"""Build data/cta-ridership-oak-park.csv: CTA ridership for the seven 'L' stations in
and at the edge of Oak Park (daily station entries since 2001) and for the seven CTA
bus routes that stop in Oak Park (monthly day-type averages since 2001).

Both series come from the City of Chicago Data Portal (Socrata), where CTA publishes
them; there is no stop-level bus ridership anywhere, so the bus series is per route.

  CTA - Ridership - 'L' Station Entries - Daily Totals
      https://data.cityofchicago.org/Transportation/CTA-Ridership-L-Station-Entries-Daily-Totals/5neh-572f
      API https://data.cityofchicago.org/resource/5neh-572f.json
      One row per station per day: station_id, stationname, date, daytype (W weekday,
      A Saturday, U Sunday/holiday), rides (entries at all turnstiles combined).
  CTA - Ridership - Bus Routes - Monthly Day-Type Averages & Totals
      https://data.cityofchicago.org/Transportation/CTA-Ridership-Bus-Routes-Monthly-Day-Type-Averages/bynn-gwxy
      API https://data.cityofchicago.org/resource/bynn-gwxy.json
      One row per route per month: route, routename, month_beginning, avg_weekday_rides,
      avg_saturday_rides, avg_sunday_holiday_rides, monthtotal.

Stations are selected by station_id (the same ids as stop_id in transit-stops-oak-park.csv,
CTA's parent-station "map_id"); routes by the route numbers in that file's routes column.
Rows come back in pages of PAGE with $offset, ordered so paging is stable.

Python 3 standard library only. Usage:
    python3 data/scripts/fetch_cta_ridership_oak_park.py [--since 2001]

The default keeps 2015 onward (about 2.5 MB); --since 2001 rebuilds the full history
(about 5.2 MB, both datasets start in January 2001).
"""
import argparse
import csv
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "cta-ridership-oak-park.csv"
UA = "oak-park-day-in-our-data/1.0 (data extraction script)"
BASE = "https://data.cityofchicago.org/resource/"
L_DAILY = "5neh-572f"
BUS_MONTHLY = "bynn-gwxy"
PAGE = 50000

# station_id -> (stop_name as in transit-stops-oak-park.csv, line, in_oak_park)
STATIONS = {
    "40020": ("Harlem/Lake", "Green Line", "Y"),
    "41350": ("Oak Park (Green)", "Green Line", "Y"),
    "40610": ("Ridgeland", "Green Line", "Y"),
    "41260": ("Austin (Green)", "Green Line", "N"),
    "40980": ("Harlem (Blue - Forest Park Branch)", "Blue Line", "N"),
    "40180": ("Oak Park (Blue)", "Blue Line", "Y"),
    "40010": ("Austin (Blue)", "Blue Line", "Y"),
}
ROUTES = ["20", "66", "70", "86", "90", "91", "126"]

COLUMNS = [
    "series", "id", "name", "line", "in_oak_park", "date", "daytype", "rides",
    "avg_weekday_rides", "avg_saturday_rides", "avg_sunday_holiday_rides", "month_total",
]


def get_json(dataset, params, tries=5):
    url = BASE + dataset + ".json?" + urllib.parse.urlencode(params)
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=120) as resp:
                return json.load(resp)
        except Exception as exc:  # throttling or a blip; back off and retry
            if attempt == tries - 1:
                raise
            print(f"  retry {attempt + 1} after {exc}", file=sys.stderr)
            time.sleep(3 * (attempt + 1))


def fetch_all(dataset, where, order):
    rows, offset = [], 0
    while True:
        page = get_json(dataset, {"$where": where, "$order": order, "$limit": PAGE, "$offset": offset})
        rows.extend(page)
        print(f"  {dataset}: {len(rows)} rows", file=sys.stderr)
        if len(page) < PAGE:
            return rows
        offset += PAGE


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--since", type=int, default=2015,
                    help="first year to keep (default 2015, which keeps the file under 5 MB; 2001 is the earliest)")
    ap.add_argument("--out", default=str(OUT))
    args = ap.parse_args()
    since = f"'{args.since}-01-01T00:00:00'"

    ids = ",".join(f"'{s}'" for s in STATIONS)
    print("Fetching daily 'L' station entries", file=sys.stderr)
    daily = fetch_all(L_DAILY, f"station_id in({ids}) AND date >= {since}", "date,station_id")

    routes = ",".join(f"'{r}'" for r in ROUTES)
    print("Fetching monthly bus route averages", file=sys.stderr)
    monthly = fetch_all(BUS_MONTHLY, f"route in({routes}) AND month_beginning >= {since}", "month_beginning,route")

    out = []
    for r in daily:
        name, line, inside = STATIONS[r["station_id"]]
        out.append({
            "series": "rail_station_daily", "id": r["station_id"], "name": name, "line": line,
            "in_oak_park": inside, "date": r["date"][:10], "daytype": r.get("daytype", ""),
            "rides": r.get("rides", ""), "avg_weekday_rides": "", "avg_saturday_rides": "",
            "avg_sunday_holiday_rides": "", "month_total": "",
        })
    for r in monthly:
        out.append({
            "series": "bus_route_monthly", "id": r["route"], "name": r.get("routename", ""),
            "line": "", "in_oak_park": "", "date": r["month_beginning"][:10], "daytype": "",
            "rides": "", "avg_weekday_rides": r.get("avg_weekday_rides", ""),
            "avg_saturday_rides": r.get("avg_saturday_rides", ""),
            "avg_sunday_holiday_rides": r.get("avg_sunday_holiday_rides", ""),
            "month_total": r.get("monthtotal", ""),
        })
    out.sort(key=lambda r: (r["series"], r["date"], r["id"]))

    with open(args.out, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS)
        w.writeheader()
        w.writerows(out)
    print(f"Wrote {len(out)} rows ({len(daily)} daily station, {len(monthly)} monthly route) to {args.out}",
          file=sys.stderr)


if __name__ == "__main__":
    main()
