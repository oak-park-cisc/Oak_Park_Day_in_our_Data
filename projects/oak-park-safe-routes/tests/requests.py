"""Build the comparison request list and record the original Flask app's responses.

Run from anywhere with the original app's venv:
  ../../oak-park-crime/.venv/bin/python requests.py
"""
import json, os, re, sys
from datetime import date, timedelta
here = os.path.dirname(os.path.abspath(__file__))
original = os.path.abspath(os.path.join(here, "../../oak-park-crime"))
sys.path.insert(0, original); os.chdir(original)
from server import app as appmod  # noqa: E402
appmod._rate_limited = lambda *_args, **_kw: None  # the comparison makes hundreds of calls
client = appmod.app.test_client()

opts = client.get("/api/options").get_json()
end = date.fromisoformat(opts.get("max_date") or opts.get("end") or "2026-09-01") if isinstance(opts, dict) else date(2026, 9, 1)
types = [t["name"] if isinstance(t, dict) else t for t in (opts.get("types") or opts.get("incident_types") or [])][:6]
cats = [c["name"] if isinstance(c, dict) else c for c in (opts.get("crime_against") or opts.get("categories") or [])]
windows = [("", "")] + [((end - timedelta(days=365 * n)).isoformat(), end.isoformat()) for n in (1, 3, 5, 10)] + [
    ("2023-01-01", "2023-12-31"), ("2025-03-01", "2025-03-31"), ("2024-12-31", "2025-01-01"), ("2026-01-01", "")]
reqs = ["/api/options", "/api/streets"]
filters = [{}] + [{"crime_against": c} for c in cats] + [{"type": t} for t in types] + [{"type": types[0], "crime_against": cats[0]}] if types and cats else [{}]
from urllib.parse import urlencode
for f in filters:
    for s, e in windows:
        q = dict(f)
        if s: q["start"] = s
        if e: q["end"] = e
        for path in ("map-points", "summary"):
            reqs.append(f"/api/{path}?{urlencode(q)}")
        reqs.append(f"/api/incidents?{urlencode({**q, 'limit': 500})}")
reqs.append("/api/incidents?limit=5000"); reqs.append("/api/incidents?limit=0"); reqs.append("/api/incidents?limit=abc")
marks = [(float(a), float(b)) for a, b in re.findall(r"lat: (4\d\.\d+), lon: (-8\d\.\d+)", open("static/js/landmarks.js").read())]
pairs = [(marks[i], marks[(i * 7 + 3) % len(marks)]) for i in range(min(18, len(marks)))]
pairs += [((41.8853, -87.7845), (41.8790, -87.8010)), ((41.9080, -87.7750), (41.8700, -87.8050))]
for a, b in pairs:
    base = {"from": f"{a[0]},{a[1]}", "to": f"{b[0]},{b[1]}"}
    reqs.append(f"/api/route?{urlencode(base)}")
    reqs.append(f"/api/route?{urlencode({**base, 'start': windows[2][0], 'end': windows[2][1]})}")
reqs += ["/api/route?" + urlencode({"from": "41.95,-87.60", "to": "41.88,-87.79"}),
         "/api/route?" + urlencode({"from": "41.888,-87.795", "to": "41.888,-87.795"}),
         "/api/route?from=bad&to=41.88,-87.79", "/api/map-points?start=not-a-date"]
out = {}
for r in reqs:
    resp = client.get(r)
    out[r] = {"status": resp.status_code, "body": resp.get_json()}
json.dump(reqs, open(os.path.join(here, "requests.json"), "w"))
json.dump(out, open(os.path.join(here, "python-responses.json"), "w"))
print(len(reqs), "requests;", len(types), "types;", len(cats), "categories;", len(pairs), "route pairs; data end", end)
