#!/usr/bin/env python3
"""
Fetch Oak Park traffic crashes from the Village's public Power BI dashboard.

Source: Village of Oak Park, Police Department, "Traffic Crash - Public" dashboard
  https://opendata.oak-park.us/TrafficCrash/
  https://app.powerbigov.us/view?r=eyJrIjoiMGVkYjlkYzktMDU4ZS00MDFiLThjYjgtZmFjN2JlZjIzYzAyIiwidCI6IjZjOGIyOTRlLTVmZjUtNDJiMi1hM2Q3LWMzYmQ3MGE3OWYyNSJ9

The Village page says: "Dataset is on public roadway crashes within municipal
boundaries reported to Oak Park Police since 2024 and typically posted after
7 days. Dataset may be updated as needed. Dataset export will be updated
typically 15 days after the new month."

The dashboard is a Power BI "publish to web" report with no export button, but
the page loads its data through Power BI's public, unauthenticated query API
using a resource key embedded in the dashboard URL. This script does what the
dashboard's own JavaScript does:

  1. Decode the `r=` parameter of the dashboard URL (base64 JSON with the
     resource key `k` and tenant id `t`).
  2. Resolve the Power BI cluster for the tenant.
  3. GET  /public/reports/{key}/modelsAndExploration  -> model id, dataset id,
     report id, and the id of a FactAccidents table visual that the queries
     are attributed to.
  4. POST /public/reports/querydata once per table: the `FactAccidents` fact
     table (one row per crash) and the `DimCrashType`, `DimContribFactor1`
     and `DimGISLatLon` lookup tables.
  5. Decode Power BI's compressed "DSR" result format, join the lookups to
     the fact rows locally, label the IDOT-style condition codes, and write
     a CSV.

Usage:
    python3 data/scripts/fetch_crashes_village.py [-o data/crashes-village-oak-park.csv]

Requires Python 3.8+. Uses `requests` if installed, otherwise urllib.

Notes on the data:
  * One row per crash report (record_id is unique). A report number can
    appear twice when a report was amended; both records are kept.
  * These are the Police Department's own records (Illinois SR 1050 crash
    report fields), not the IDOT statewide layer. They include crashes below
    IDOT's reporting threshold, so counts run higher than IDOT's.
  * Condition fields (weather, lighting, road surface, traffic control,
    trafficway, flow, road defects) are stored as Illinois crash report codes.
    The *_code column is the raw value; the label column beside it comes from
    the CODE_LABELS tables below (verified against IDOT records for the same
    crashes; a blank label means the code was not verified).
  * latitude/longitude are the Police RMS coordinates the dashboard's map
    uses (converted from Illinois State Plane East, which is also kept as
    state_plane_x/state_plane_y in feet). latitude_geocoded and
    longitude_geocoded are an address geocode of the same location; they
    usually agree within a few meters.
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
    "https://app.powerbigov.us/view?r=eyJrIjoiMGVkYjlkYzktMDU4ZS00MDFiLThjYjgtZmFjN2JlZjIzYzAyIiwidCI6IjZjOGIyOTRlLTVmZjUtNDJiMi1hM2Q3LWMzYmQ3MGE3OWYyNSJ9"
)

# The Power BI cluster the dashboard is hosted on. Only used if cluster
# resolution fails; the script normally discovers it from the tenant id.
DEFAULT_API_HOST = "https://wabi-us-gov-virginia-api.analysis.usgovcloudapi.net"

# Fact table and columns in the dashboard's data model. Each entry is
# (Power BI column name, CSV column name, kind). kind is one of:
#   "str", "int", "float", "bool" (0/1), "date" (YYYY-MM-DD),
#   "datetime" (YYYY-MM-DD HH:MM:SS), "code" (string code, zero padding kept),
#   "spft" (RMS stores State Plane feet times 100; written as feet)
FACT = "FactAccidents"
FACT_COLUMNS = [
    ("tamainid", "record_id", "int"),
    ("ReportNum", "report_number", "str"),
    ("acci_id", "crash_id", "str"),
    ("idotcolno", "idot_crash_number", "str"),
    ("Crash Date", "date", "date"),
    ("Crash Dttm", "occurred_at", "datetime"),
    ("addtime", "record_added_at", "datetime"),
    ("Location", "location", "str"),
    ("StreetNum", "street_number", "str"),
    ("StreetName", "street_name", "str"),
    ("Intersection", "cross_street", "str"),
    ("AtIntersection", "at_intersection", "bool"),
    ("IntersectionRelated", "intersection_related", "bool"),
    ("PrivateProperty", "private_property", "bool"),
    ("Hit&Run", "hit_and_run", "bool"),
    ("CrashSeverity", "crash_severity", "str"),
    ("CrashInjurySeverity", "crash_injury_severity", "str"),
    ("1stCrashType", "crash_type_code", "code"),
    ("TotalUnits", "total_units", "int"),
    ("NumMotorVehicles", "num_motor_vehicles", "int"),
    ("DooringPedalcyclist", "dooring_pedalcyclist", "bool"),
    ("DamageCode", "damage_code", "int"),
    ("A NoInjury/DriveAway", "no_injury_drive_away", "bool"),
    ("B Injury/Towed", "injury_or_towed", "bool"),
    ("K Fatalities", "fatalities", "int"),
    ("A Incapacitated", "a_injuries", "int"),
    ("B NonIncap", "b_injuries", "int"),
    ("C ReportNotEvident", "c_injuries", "int"),
    ("1stContribCause", "cause1_code", "code"),
    ("2ndContribCause", "cause2_code", "code"),
    ("trafcontrl", "traffic_control_code", "code"),
    ("DeviceCond", "device_condition_code", "code"),
    ("weather", "weather_code", "code"),
    ("lightcond", "lighting_code", "code"),
    ("TrafficWay", "trafficway_code", "code"),
    ("rdsurface", "road_surface_code", "code"),
    ("FlowCond", "flow_condition_code", "code"),
    ("rddefects", "road_defects_code", "code"),
    ("Beat/Zone", "beat_zone", "str"),
    ("Post/District", "post_district", "str"),
    ("geox", "state_plane_x", "spft"),
    ("geoy", "state_plane_y", "spft"),
]

# Lookup tables. DimGISLatLon.SourceID equals FactAccidents.tamainid.
DIM_CRASH_TYPE = ("DimCrashType", ["Crash Code", "Crash Type", "Crash Mode"])
DIM_CAUSE = ("DimContribFactor1", ["Contributing Factor Code1", "Contributing Factor1"])
DIM_GEO = ("DimGISLatLon", ["SourceID", "Y_DD", "X_DD", "Y_GEOCODED", "X_GEOCODED"])

OUTPUT_HEADER = [
    "record_id", "report_number", "crash_id", "idot_crash_number",
    "date", "time", "occurred_at", "record_added_at",
    "location", "street_number", "street_name", "cross_street",
    "at_intersection", "intersection_related", "private_property", "hit_and_run",
    "crash_severity", "crash_injury_severity",
    "crash_mode", "crash_type_code", "crash_type",
    "total_units", "num_motor_vehicles", "dooring_pedalcyclist",
    "damage_code", "damage",
    "no_injury_drive_away", "injury_or_towed",
    "fatalities", "a_injuries", "b_injuries", "c_injuries", "total_injured",
    "cause1_code", "cause1", "cause2_code", "cause2",
    "traffic_control_code", "traffic_control",
    "device_condition_code", "device_condition",
    "weather_code", "weather",
    "lighting_code", "lighting",
    "trafficway_code", "trafficway",
    "road_surface_code", "road_surface",
    "flow_condition_code", "flow_condition",
    "road_defects_code", "road_defects",
    "beat_zone", "post_district",
    "latitude", "longitude", "latitude_geocoded", "longitude_geocoded",
    "state_plane_x", "state_plane_y",
]

# Illinois crash report (SR 1050) code labels. Every label below was checked
# against the IDOT statewide crash layer for Oak Park crashes that appear in
# both sources; codes seen in the Village data but not confirmed are omitted
# and get a blank label.
CODE_LABELS = {
    "weather": {
        "1": "Clear", "2": "Rain", "3": "Snow", "4": "Fog/Smoke/Haze",
        "5": "Sleet/Hail", "6": "Severe Cross Wind", "7": "Other",
        "8": "Cloudy/Overcast", "9": "Unknown",
        "10": "Freezing Rain/Drizzle", "11": "Blowing Snow",
    },
    "lighting": {
        "1": "Daylight", "2": "Dawn", "3": "Dusk", "4": "Darkness",
        "5": "Darkness, Lighted Road", "9": "Unknown",
    },
    "road_surface": {
        "1": "Dry", "2": "Wet", "3": "Snow or Slush", "4": "Ice",
        "5": "Sand/Mud/Dirt", "6": "Other", "9": "Unknown",
    },
    "traffic_control": {
        "1": "No Controls", "2": "Stop Sign", "3": "Traffic Signal",
        "4": "Yield Sign", "10": "Other Regulatory Sign",
        "11": "Other Warning Sign", "13": "Other", "14": "Delineators",
        "15": "Flashing Control Signal", "16": "Railroad Crossing Sign",
        "17": "Pedestrian Crossing Sign", "99": "Unknown",
    },
    "device_condition": {
        "1": "No Controls", "3": "Functioning Improperly",
        "4": "Functioning Properly", "9": "Unknown",
    },
    "trafficway": {
        "1": "Not Divided", "2": "Divided, No Median Barrier",
        "3": "Divided With Median Barrier",
        "4": "Two-Way Continuous Left-Turn Lane", "7": "Parking Lot",
        "8": "Other", "9": "Unknown", "10": "One-Way", "11": "Ramp",
        "12": "Alley", "13": "Driveway", "14": "Four-Way Intersection",
        "15": "T-Intersection", "16": "Y-Intersection",
        "20": "L-Intersection",
    },
    "flow_condition": {"1": "Slow", "2": "Stopped", "3": "Free Flow"},
    "road_defects": {
        "1": "No Defects", "7": "Rut, Holes", "9": "Debris On Roadway",
        "10": "Other", "99": "Unknown",
    },
    # Damage bands. Code 5 matches IDOT's "over $1,500" reporting threshold
    # (almost every code-5 crash is in the IDOT layer; codes 3 and 4 mostly
    # are not).
    "damage": {"3": "$500 or less", "4": "$501 to $1,500", "5": "Over $1,500"},
}

# Upper bound on rows requested. The dataset is ~4.6k rows as of Sept 2026;
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
        "User-Agent": "Mozilla/5.0 (oak-park-day-in-our-data crash extract)",
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
    # Attribute the queries to one of the report's own FactAccidents table
    # visuals, the same thing the dashboard does when it renders a page.
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
            if FACT in ents and ctx["visualId"] is None:
                ctx["visualId"] = cfg.get("name")
    return ctx


def _col(prop, source="f"):
    return {"Column": {"Expression": {"SourceRef": {"Source": source}}, "Property": prop}}


def _wrap(ctx, query, top, volume=6):
    return {
        "version": "1.0.0",
        "queries": [
            {
                "Query": {
                    "Commands": [
                        {
                            "SemanticQueryDataShapeCommand": {
                                "Query": query,
                                "Binding": {
                                    "Primary": {
                                        "Groupings": [
                                            {"Projections": list(range(len(query["Select"])))}
                                        ]
                                    },
                                    "DataReduction": {
                                        "DataVolume": volume,
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


def build_table_query(ctx, entity, props, order_by=None, top=MAX_ROWS):
    select = []
    for i, prop in enumerate(props):
        c = _col(prop)
        c["Name"] = "C%d" % i
        select.append(c)
    query = {
        "Version": 2,
        "From": [{"Name": "f", "Entity": entity, "Type": 0}],
        "Select": select,
    }
    if order_by:
        query["OrderBy"] = [{"Direction": 2, "Expression": _col(order_by)}]
    return _wrap(ctx, query, top)


def build_count_query(ctx):
    """COUNT(tamainid) over the whole fact table, to verify nothing was truncated."""
    agg = {"Aggregation": {"Expression": _col("tamainid"), "Function": 5}, "Name": "N"}
    query = {
        "Version": 2,
        "From": [{"Name": "f", "Entity": FACT, "Type": 0}],
        "Select": [agg],
    }
    return _wrap(ctx, query, 1, volume=3)


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
        schema = dm[0].get("S")
        if schema:
            for i, entry in enumerate(schema):
                if entry.get("DN"):
                    dict_names[i] = entry["DN"]
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
    return rows


def fetch_table(api_host, resource_key, ctx, entity, props, order_by=None):
    data = query_data(api_host, resource_key, build_table_query(ctx, entity, props, order_by))
    if "error" in data:
        raise SystemExit("querydata error for %s: %s" % (entity, json.dumps(data["error"])[:500]))
    rows = decode_dsr(data, len(props))
    print("  %s: %d rows" % (entity, len(rows)), file=sys.stderr)
    return rows


# ----------------------------------------------------------------------------
# Formatting
# ----------------------------------------------------------------------------

def to_datetime(ms):
    # Naive local timestamps stored as epoch milliseconds; do not shift zones.
    return dt.datetime(1970, 1, 1) + dt.timedelta(milliseconds=ms)


def format_value(v, kind):
    if v is None:
        return ""
    if kind in ("date", "datetime"):
        if isinstance(v, (int, float)):
            d = to_datetime(v)
        else:
            d = dt.datetime.fromisoformat(str(v).replace("Z", ""))
        return d.strftime("%Y-%m-%d" if kind == "date" else "%Y-%m-%d %H:%M:%S")
    if kind == "int":
        try:
            return str(int(str(v).strip()))
        except ValueError:
            return str(v).strip()
    if kind == "bool":
        s = str(v).strip().lower()
        if s in ("1", "true", "y", "yes"):
            return "1"
        if s in ("0", "false", "n", "no"):
            return "0"
        return s
    if kind == "float":
        try:
            return repr(float(v))
        except (TypeError, ValueError):
            return str(v)
    if kind == "spft":
        try:
            return "%.2f" % (float(v) / 100.0)
        except (TypeError, ValueError):
            return str(v)
    return str(v).strip()


def fmt_coord(v):
    if v is None or v == "":
        return ""
    try:
        return "%.7f" % float(v)
    except (TypeError, ValueError):
        return str(v)


def rows_to_records(fact_rows, crash_types, causes, geo):
    dttm_index = [c[0] for c in FACT_COLUMNS].index("Crash Dttm")
    records = []
    for raw in fact_rows:
        rec = {}
        for (prop, name, kind), v in zip(FACT_COLUMNS, raw):
            rec[name] = format_value(v, kind)
        occ = raw[dttm_index]
        rec["time"] = to_datetime(occ).strftime("%H:%M:%S") if isinstance(occ, (int, float)) else ""

        ct = crash_types.get(rec["crash_type_code"], ("", ""))
        rec["crash_type"], rec["crash_mode"] = ct
        rec["cause1"] = causes.get(rec["cause1_code"], "")
        rec["cause2"] = causes.get(rec["cause2_code"], "")
        for field in ("traffic_control", "device_condition", "weather", "lighting",
                      "trafficway", "road_surface", "flow_condition", "road_defects",
                      "damage"):
            rec[field] = CODE_LABELS[field].get(rec[field + "_code"], "")

        injuries = [rec["a_injuries"], rec["b_injuries"], rec["c_injuries"]]
        rec["total_injured"] = str(sum(int(x) for x in injuries if x != "")) if any(injuries) else ""

        g = geo.get(rec["record_id"])
        rec["latitude"] = fmt_coord(g[0]) if g else ""
        rec["longitude"] = fmt_coord(g[1]) if g else ""
        rec["latitude_geocoded"] = fmt_coord(g[2]) if g else ""
        rec["longitude_geocoded"] = fmt_coord(g[3]) if g else ""
        records.append(rec)
    return records


# ----------------------------------------------------------------------------
# main
# ----------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument(
        "-o", "--output", default="data/crashes-village-oak-park.csv",
        help="CSV path to write (default: data/crashes-village-oak-park.csv)",
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
        # A bare aggregate comes back as {"S": [...], "M0": <value>} or with C=[value].
        dm0 = cnt["results"][0]["result"]["data"]["dsr"]["DS"][0]["PH"][0]["DM0"][0]
        expected = int(dm0["M0"] if "M0" in dm0 else dm0["C"][0])
        print("Server row count (COUNT tamainid): %d" % expected, file=sys.stderr)
    except Exception as e:  # noqa: BLE001
        print("warning: count query failed: %s" % e, file=sys.stderr)

    print("Fetching tables ...", file=sys.stderr)
    fact_rows = fetch_table(
        api_host, resource_key, ctx, FACT, [c[0] for c in FACT_COLUMNS], order_by="Crash Dttm"
    )
    if expected is not None and len(fact_rows) != expected:
        raise SystemExit(
            "Row count mismatch: decoded %d rows but server reports %d. "
            "Increase MAX_ROWS or check the DSR decoder." % (len(fact_rows), expected)
        )
    if not fact_rows:
        raise SystemExit("No rows returned; the dashboard feed may have changed.")

    crash_types = {
        str(r[0]).strip(): (str(r[1] or "").strip(), str(r[2] or "").strip())
        for r in fetch_table(api_host, resource_key, ctx, *DIM_CRASH_TYPE)
    }
    causes = {
        str(r[0]).strip(): str(r[1] or "").strip()
        for r in fetch_table(api_host, resource_key, ctx, *DIM_CAUSE)
    }
    geo = {
        str(r[0]).strip(): tuple(r[1:])
        for r in fetch_table(api_host, resource_key, ctx, *DIM_GEO)
    }

    records = rows_to_records(fact_rows, crash_types, causes, geo)
    # Oldest first, then by record id, for stable diffs between extracts.
    records.sort(key=lambda r: (r["occurred_at"], int(r["record_id"])))

    with open(args.output, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=OUTPUT_HEADER, lineterminator="\n")
        w.writeheader()
        w.writerows(records)

    missing_geo = sum(1 for r in records if not r["latitude"])
    print(
        "Wrote %d rows to %s (%s to %s); %d without coordinates"
        % (len(records), args.output, records[0]["date"], records[-1]["date"], missing_geo),
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
