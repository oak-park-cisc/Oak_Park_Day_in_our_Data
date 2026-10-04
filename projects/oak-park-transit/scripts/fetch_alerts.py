"""Fetch active CTA alerts that touch Oak Park and write public/data/alerts.json.

Runs in the deploy workflow (on push and on a schedule), since the CTA feed
has no CORS headers and GitHub Pages can't proxy it. No API key needed.

Usage: python3 scripts/fetch_alerts.py
"""
import csv
import json
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STOPS_CSV = ROOT / "public/data/transit-stops-oak-park.csv"
OUT = ROOT / "public/data/alerts.json"
URL = "https://www.transitchicago.com/api/1.0/alerts.aspx?activeonly=true&outputType=JSON"

# Rail line names in the stops CSV -> CTA alert ServiceId
RAIL_IDS = {"Green Line": "G", "Blue Line": "Blue"}


def oak_park_services():
    routes, stations = set(), set()
    for row in csv.DictReader(open(STOPS_CSV)):
        if row["agency"] != "CTA":
            continue
        if row["stop_type"] == "rail_station":
            stations.add(row["stop_id"])
        for r in row["routes"].split(";"):
            r = r.strip()
            if r:
                routes.add(RAIL_IDS.get(r, r))
    return routes, stations


def main():
    routes, stations = oak_park_services()
    req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0 (oak-park-transit-tracker)"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.load(resp)["CTAAlerts"]
    raw = data.get("Alert") or []
    raw = raw if isinstance(raw, list) else [raw]

    alerts = []
    for a in raw:
        svc = a["ImpactedService"]["Service"]
        svc = svc if isinstance(svc, list) else [svc]
        hit_routes = sorted({s["ServiceId"] for s in svc if s["ServiceType"] in ("B", "R") and s["ServiceId"] in routes})
        hit_stations = sorted({s["ServiceId"] for s in svc if s["ServiceType"] == "T" and s["ServiceId"] in stations})
        if not hit_routes and not hit_stations:
            continue
        alerts.append({
            "id": a["AlertId"],
            "agency": "CTA",
            "headline": a["Headline"],
            "impact": a["Impact"],
            "description": a["ShortDescription"],
            "start": a.get("EventStart"),
            "end": a.get("EventEnd"),
            "major": a.get("MajorAlert") == "1",
            "accessibility": "Elevator" in (a.get("Impact") or ""),
            "routes": hit_routes,
            "stationIds": hit_stations,
            "url": (a.get("AlertURL") or {}).get("#cdata-section"),
        })

    OUT.write_text(json.dumps({
        "fetchedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": URL,
        "alerts": alerts,
    }, indent=1))
    print(f"{len(alerts)} Oak Park alerts of {len(raw)} active -> {OUT}")


if __name__ == "__main__":
    main()
