"""Build public/data/metra-oak-park.json: scheduled Metra departures at Oak Park.

Metra's live feed needs an API token we don't have yet, so the Metra station
popup shows departures from the published schedule instead. Exports every
departure at OAKPARK with its service id, plus the calendar, so the page can
work out which trains run on any date.

Usage:
  python3 scripts/build_metra.py <path to metra.zip>

Download: https://schedules.metrarail.com/gtfs/schedule.zip
"""
import csv
import io
import json
import sys
import zipfile
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public/data/metra-oak-park.json"
STOP_ID = "OAKPARK"
DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


def read(z, name):
    with z.open(name) as f:
        yield from csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig"), skipinitialspace=True)


def main():
    z = zipfile.ZipFile(sys.argv[1])
    trips = {t["trip_id"]: t for t in read(z, "trips.txt")}

    services = {
        c["service_id"]: {"days": [int(c[d]) for d in DAYS], "start": c["start_date"], "end": c["end_date"]}
        for c in read(z, "calendar.txt")
    }
    exceptions = {}
    for e in read(z, "calendar_dates.txt"):
        day = exceptions.setdefault(e["date"], {"add": [], "remove": []})
        day["add" if e["exception_type"] == "1" else "remove"].append(e["service_id"])

    departures = set()
    for st in read(z, "stop_times.txt"):
        if st["stop_id"] != STOP_ID or st.get("pickup_type", "0") == "1":
            continue
        t = trips[st["trip_id"]]
        hh, mm, _ = st["departure_time"].split(":")
        # [minutes after midnight (may pass 24h), service id, direction (1 = inbound), headsign]
        departures.add((int(hh) * 60 + int(mm), t["service_id"], int(t["direction_id"]), t["trip_headsign"]))

    OUT.write_text(json.dumps({
        "source": "https://schedules.metrarail.com/gtfs/schedule.zip",
        "built": date.today().isoformat(),
        "services": services,
        "exceptions": exceptions,
        "departures": sorted(departures),
    }, separators=(",", ":")))
    print(f"{len(departures)} departures, {len(services)} services -> {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
