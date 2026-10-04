#!/usr/bin/env python3
"""
Fetch Oak Park crime incidents from the Village's public Power BI dashboard.

Source: Village of Oak Park, Police Department, "Crime Incident - Public" dashboard
  https://www.oak-park.us/Public-Safety/Police-Department/Reports-Maps/Crime-Maps
  https://app.powerbigov.us/view?r=eyJrIjoiMTg0ZGI4YTYtZTgxNC00MzVmLThlNDYtMTE4MTQwNDlkYzdlIiwidCI6IjZjOGIyOTRlLTVmZjUtNDJiMi1hM2Q3LWMzYmQ3MGE3OWYyNSJ9&pageName=2180cdf0aa49c0286272

The dashboard is a Power BI "publish to web" report. It has no export button,
but the page itself loads its data through Power BI's public, unauthenticated
query API using a resource key that is embedded in the dashboard URL. This
script does exactly what the dashboard's own JavaScript does:

  1. Decode the `r=` parameter of the dashboard URL (base64 JSON with the
     resource key `k` and tenant id `t`).
  2. Resolve the Power BI cluster for the tenant.
  3. GET  /public/reports/{key}/modelsAndExploration  -> model id, dataset id,
     report id, and the report layout (used to pick the "Crime Dataset" table
     visual id, which the query is attributed to).
  4. POST /public/reports/querydata with a semantic query that selects every
     column of the `FactLwMain_Combined` fact table.
  5. Decode Power BI's compressed "DSR" result format and write a CSV.

Usage:
    python3 data/scripts/fetch_crime_incidents.py [-o data/crime-incidents-oak-park.csv]

Requires Python 3.8+. Uses `requests` if installed, otherwise urllib.

Notes on the data:
  * One row per charge (lwchrgid is unique). An incident (inci_id) with more
    than one charge appears on more than one row.
  * Locations are block-level ("100 Block Washington Blvd") or intersections;
    lat/lon are geocoded from that, not the exact address.
  * The Village says the dashboard is refreshed roughly 15 days after the end
    of each month, so the most recent weeks are always incomplete.
"""

import argparse
import base64
import csv
import datetime as dt
import gzip
import json
import sys
import urllib.parse
import uuid

try:
    import requests  # type: ignore
except ImportError:  # pragma: no cover - fallback for a bare Python install
    requests = None
    import urllib.request

DASHBOARD_URL = (
    "https://app.powerbigov.us/view?r=eyJrIjoiMTg0ZGI4YTYtZTgxNC00MzVmLThlNDYtMTE4MTQwNDlkYzdlIiwidCI6IjZjOGIyOTRlLTVmZjUtNDJiMi1hM2Q3LWMzYmQ3MGE3OWYyNSJ9"
    "&pageName=2180cdf0aa49c0286272"
)

# The Power BI cluster the dashboard is hosted on. Only used if cluster
# resolution fails; the script normally discovers it from the tenant id.
DEFAULT_API_HOST = "https://wabi-us-gov-virginia-api.analysis.usgovcloudapi.net"

# Fact table and columns in the dashboard's data model. Each entry is
# (Power BI column name, CSV column name, kind). kind is one of:
#   "str", "int", "float", "date" (datetime rendered as YYYY-MM-DD),
#   "datetime" (rendered as YYYY-MM-DD HH:MM:SS)
ENTITY = "FactLwMain_Combined"
COLUMNS = [
    ("inci_id", "incident_id", "str"),
    ("IncidentIdLabel", "incident_id_label", "str"),
    ("lwchrgid", "charge_id", "int"),
    ("lwmainid", "record_id", "int"),
    ("OccurDate", "date", "date"),
    ("OccurDttm", "occurred_at", "datetime"),
    ("OccurHour", "hour", "str"),
    ("OccurDttmLabel", "occurred_at_label", "str"),
    ("NIBRS.Offense_Type", "incident_type", "str"),
    ("NIBRS.Offense_Description", "offense_description", "str"),
    ("NIBRS.Offense_Code", "offense_code", "str"),
    ("NIBRS.Desc+Code", "offense_description_code", "str"),
    ("NIBRS.Offense_Group", "offense_group", "str"),
    ("NIBRS.Crime_Against", "crime_against", "str"),
    ("ucr_code", "ucr_code", "str"),
    ("XY_LocationDesc", "location", "str"),
    ("BeginStreetNbr", "block_begin_number", "int"),
    ("OddStreetNbr", "block_odd_number", "int"),
    ("Post", "post", "int"),
    ("PostLabel", "post_label", "str"),
    ("ZoneDerived", "zone", "int"),
    ("ZoneLabel", "zone_label", "str"),
    ("Y_Lat", "latitude", "float"),
    ("X_Lon", "longitude", "float"),
]
# Derived output column: "time" (HH:MM:SS) split out of OccurDttm.
OUTPUT_HEADER = (
    [c[1] for c in COLUMNS[:5]] + ["time"] + [c[1] for c in COLUMNS[5:]]
)

# Upper bound on rows requested. The dataset is ~14k rows as of Sept 2026;
# the script verifies the returned count against a COUNT query and fails
# loudly if it does not match.
MAX_ROWS = 100000


# ----------------------------------------------------------------------------
# HTTP helpers
# ----------------------------------------------------------------------------

def _headers(resource_key, content_type=None):
    h = {
        "Accept": "application/json, text/plain, */*",
        "X-PowerBI-ResourceKey": resource_key,
        "ActivityId": str(uuid.uuid4()),
        "RequestId": str(uuid.uuid4()),
        "User-Agent": "Mozilla/5.0 (oak-park-day-in-our-data crime extract)",
    }
    if content_type:
        h["Content-Type"] = content_type
    return h


def http_json(method, url, resource_key, body=None, timeout=120):
    data = None
    content_type = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        content_type = "application/json;charset=UTF-8"
    headers = _headers(resource_key, content_type)
    if requests is not None:
        r = requests.request(method, url, headers=headers, data=data, timeout=timeout)
        if r.status_code != 200:
            raise RuntimeError("HTTP %s from %s: %s" % (r.status_code, url, r.text[:500]))
        return r.json()
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
    except urllib.error.HTTPError as e:  # type: ignore[attr-defined]
        raise RuntimeError("HTTP %s from %s: %s" % (e.code, url, e.read()[:500]))
    # The API gzips responses whether or not the client asked for it.
    if raw[:2] == b"\x1f\x8b":
        raw = gzip.decompress(raw)
    return json.loads(raw.decode("utf-8"))


# ----------------------------------------------------------------------------
# Power BI publish-to-web plumbing
# ----------------------------------------------------------------------------

def decode_dashboard_url(url):
    """Return (resource_key, tenant_id) from a Power BI publish-to-web URL."""
    q = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)
    r = q["r"][0]
    r += "=" * (-len(r) % 4)
    d = json.loads(base64.b64decode(r))
    return d["k"], d["t"]


def resolve_api_host(tenant_id, resource_key):
    """Ask the default cluster where this tenant lives; return the -api host."""
    try:
        d = http_json(
            "GET",
            "%s/public/routing/cluster/%s" % (DEFAULT_API_HOST, tenant_id),
            resource_key,
        )
        fixed = d.get("FixedClusterUri") or ""
        host = urllib.parse.urlparse(fixed).hostname or ""
        if host:
            parts = host.split(".")
            parts[0] = parts[0].replace("-redirect", "").replace("global-", "") + "-api"
            return "https://" + ".".join(parts)
    except Exception as e:  # noqa: BLE001
        print("warning: cluster resolution failed (%s); using default" % e, file=sys.stderr)
    return DEFAULT_API_HOST


def get_report_context(api_host, resource_key):
    """Return dict with modelId, datasetId, reportId, visualId, lastRefresh."""
    d = http_json(
        "GET",
        "%s/public/reports/%s/modelsAndExploration?preferReadOnlySession=true"
        % (api_host, resource_key),
        resource_key,
    )
    model = d["models"][0]
    ex = d["exploration"]
    report = ex.get("report") or {}
    ctx = {
        "modelId": model["id"],
        "datasetId": model["dbName"],
        "reportId": report["objectId"],
        "reportName": report.get("displayName"),
        "lastRefresh": (report.get("model") or {}).get("LastRefreshTime"),
        "visualId": None,
    }
    # Attribute the query to the report's own "Crime Dataset" table visual,
    # the same thing the dashboard does when it renders that page.
    for section in ex.get("sections", []):
        for vc in section.get("visualContainers", []):
            try:
                cfg = json.loads(vc.get("config") or "{}")
            except ValueError:
                continue
            sv = cfg.get("singleVisual") or {}
            if sv.get("visualType") != "tableEx":
                continue
            ents = [f.get("Entity") for f in (sv.get("prototypeQuery") or {}).get("From", [])]
            if ENTITY in ents:
                ctx["visualId"] = cfg.get("name")
                break
        if ctx["visualId"]:
            break
    return ctx


def _col(prop):
    return {"Column": {"Expression": {"SourceRef": {"Source": "f"}}, "Property": prop}}


def build_query(ctx, top=MAX_ROWS):
    select = []
    for i, (prop, _name, _kind) in enumerate(COLUMNS):
        c = _col(prop)
        c["Name"] = "C%d" % i
        select.append(c)
    return {
        "version": "1.0.0",
        "queries": [
            {
                "Query": {
                    "Commands": [
                        {
                            "SemanticQueryDataShapeCommand": {
                                "Query": {
                                    "Version": 2,
                                    "From": [{"Name": "f", "Entity": ENTITY, "Type": 0}],
                                    "Select": select,
                                    "OrderBy": [
                                        {"Direction": 2, "Expression": _col("OccurDttm")}
                                    ],
                                },
                                "Binding": {
                                    "Primary": {
                                        "Groupings": [{"Projections": list(range(len(COLUMNS)))}]
                                    },
                                    "DataReduction": {
                                        "DataVolume": 6,
                                        "Primary": {"Top": {"Count": top}},
                                    },
                                    "Version": 1,
                                },
                                "ExecutionMetricsKind": 1,
                            }
                        }
                    ]
                },
                "QueryId": "",
                "ApplicationContext": {
                    "DatasetId": ctx["datasetId"],
                    "Sources": [{"ReportId": ctx["reportId"], "VisualId": ctx["visualId"]}],
                },
            }
        ],
        "cancelQueries": [],
        "modelId": ctx["modelId"],
    }


def build_count_query(ctx):
    """COUNT(lwchrgid) over the whole fact table, to verify nothing was truncated."""
    agg = {
        "Aggregation": {"Expression": _col("lwchrgid"), "Function": 5},
        "Name": "N",
    }
    return {
        "version": "1.0.0",
        "queries": [
            {
                "Query": {
                    "Commands": [
                        {
                            "SemanticQueryDataShapeCommand": {
                                "Query": {
                                    "Version": 2,
                                    "From": [{"Name": "f", "Entity": ENTITY, "Type": 0}],
                                    "Select": [agg],
                                },
                                "Binding": {
                                    "Primary": {"Groupings": [{"Projections": [0]}]},
                                    "DataReduction": {
                                        "DataVolume": 3,
                                        "Primary": {"Top": {"Count": 1}},
                                    },
                                    "Version": 1,
                                },
                                "ExecutionMetricsKind": 1,
                            }
                        }
                    ]
                },
                "QueryId": "",
                "ApplicationContext": {
                    "DatasetId": ctx["datasetId"],
                    "Sources": [{"ReportId": ctx["reportId"], "VisualId": ctx["visualId"]}],
                },
            }
        ],
        "cancelQueries": [],
        "modelId": ctx["modelId"],
    }


def query_data(api_host, resource_key, body):
    return http_json(
        "POST",
        "%s/public/reports/querydata?synchronous=true" % api_host,
        resource_key,
        body=body,
        timeout=300,
    )


# ----------------------------------------------------------------------------
# DSR (Data Shape Result) decoding
# ----------------------------------------------------------------------------
# Rows come back compressed:
#   S  : schema on the first row of a page; per column, T = type code and
#        DN = name of the value dictionary the column's values index into
#   C  : the values that are actually present for this row, in column order
#   R  : bitmask, bit i set -> column i repeats the previous row's value
#   Ø  : bitmask, bit i set -> column i is null
# Type code 7 is DateTime, delivered as milliseconds since the Unix epoch.

def decode_dsr(result_json, ncols):
    res = result_json["results"][0]["result"]["data"]
    dsr = res["dsr"]
    ds = dsr["DS"][0]
    value_dicts = ds.get("ValueDicts", {})
    rows = []
    for page in ds.get("PH", []):
        dm = page.get("DM0", [])
        if not dm:
            continue
        dict_names = {}
        types = {}
        schema = dm[0].get("S")
        if schema:
            for i, entry in enumerate(schema):
                if entry.get("DN"):
                    dict_names[i] = entry["DN"]
                types[i] = entry.get("T")
        prev = [None] * ncols
        for row in dm:
            c = row.get("C", [])
            r = row.get("R", 0)
            nulls = row.get("Ø", 0)
            vals = []
            ci = 0
            for col in range(ncols):
                bit = 1 << col
                if r & bit:
                    vals.append(prev[col])
                elif nulls & bit:
                    vals.append(None)
                else:
                    vals.append(c[ci])
                    ci += 1
            prev = vals
            out = []
            for col in range(ncols):
                v = vals[col]
                if v is None:
                    out.append(None)
                elif col in dict_names and isinstance(v, int):
                    out.append(value_dicts[dict_names[col]][v])
                else:
                    out.append(v)
            rows.append(out)
    return rows, types


def to_datetime(ms):
    # Naive local timestamps stored as epoch milliseconds; do not shift zones.
    return dt.datetime(1970, 1, 1) + dt.timedelta(milliseconds=ms)


def format_value(v, kind):
    if v is None or v == "":
        return ""
    if kind in ("date", "datetime"):
        if isinstance(v, (int, float)):
            d = to_datetime(v)
        else:
            d = dt.datetime.fromisoformat(str(v).replace("Z", ""))
        return d.strftime("%Y-%m-%d" if kind == "date" else "%Y-%m-%d %H:%M:%S")
    if kind == "int":
        try:
            return str(int(v))
        except (TypeError, ValueError):
            return str(v)
    if kind == "float":
        try:
            return repr(float(v))
        except (TypeError, ValueError):
            return str(v)
    return str(v).strip()


def rows_to_records(raw_rows):
    """Turn decoded DSR rows into output dicts keyed by OUTPUT_HEADER."""
    records = []
    dttm_index = [c[0] for c in COLUMNS].index("OccurDttm")
    for raw in raw_rows:
        rec = {}
        for (prop, name, kind), v in zip(COLUMNS, raw):
            rec[name] = format_value(v, kind)
        occ = raw[dttm_index]
        if isinstance(occ, (int, float)):
            rec["time"] = to_datetime(occ).strftime("%H:%M:%S")
        else:
            rec["time"] = rec["occurred_at"][11:] if rec["occurred_at"] else ""
        records.append(rec)
    return records


# ----------------------------------------------------------------------------
# main
# ----------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument(
        "-o", "--output", default="data/crime-incidents-oak-park.csv",
        help="CSV path to write (default: data/crime-incidents-oak-park.csv)",
    )
    ap.add_argument("--dashboard-url", default=DASHBOARD_URL, help="Power BI publish-to-web URL")
    args = ap.parse_args()

    resource_key, tenant_id = decode_dashboard_url(args.dashboard_url)
    api_host = resolve_api_host(tenant_id, resource_key)
    print("Power BI API host: %s" % api_host, file=sys.stderr)

    ctx = get_report_context(api_host, resource_key)
    print(
        "Report %r  model=%s dataset=%s report=%s visual=%s last_refresh=%s"
        % (ctx["reportName"], ctx["modelId"], ctx["datasetId"], ctx["reportId"],
           ctx["visualId"], ctx["lastRefresh"]),
        file=sys.stderr,
    )

    expected = None
    try:
        cnt = query_data(api_host, resource_key, build_count_query(ctx))
        # A bare aggregate comes back as {"S": [...], "M0": <value>}.
        dm0 = cnt["results"][0]["result"]["data"]["dsr"]["DS"][0]["PH"][0]["DM0"][0]
        expected = int(dm0["M0"])
        print("Server row count (COUNT lwchrgid): %d" % expected, file=sys.stderr)
    except Exception as e:  # noqa: BLE001
        print("warning: count query failed: %s" % e, file=sys.stderr)

    print("Fetching all %d columns of %s ..." % (len(COLUMNS), ENTITY), file=sys.stderr)
    data = query_data(api_host, resource_key, build_query(ctx))
    if "error" in data:
        raise SystemExit("querydata error: %s" % json.dumps(data["error"])[:500])
    raw_rows, _types = decode_dsr(data, len(COLUMNS))
    print("Decoded %d rows" % len(raw_rows), file=sys.stderr)

    if expected is not None and len(raw_rows) != expected:
        raise SystemExit(
            "Row count mismatch: decoded %d rows but server reports %d. "
            "Increase MAX_ROWS or check the DSR decoder." % (len(raw_rows), expected)
        )
    if not raw_rows:
        raise SystemExit("No rows returned; the dashboard feed may have changed.")

    records = rows_to_records(raw_rows)
    # Oldest first, then by charge id, for stable diffs between extracts.
    records.sort(key=lambda r: (r["occurred_at"], r["charge_id"]))

    with open(args.output, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=OUTPUT_HEADER, lineterminator="\n")
        w.writeheader()
        w.writerows(records)

    print(
        "Wrote %d rows to %s (%s to %s)"
        % (len(records), args.output, records[0]["date"], records[-1]["date"]),
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
