#!/usr/bin/env python3
"""
Fetch aggregate counts of ECHO program activity from the Village's public
Power BI dashboard.

Source: Village of Oak Park, Neighborhood Services Department,
  "ECHO Activity - Public" dashboard
  https://opendata.oak-park.us/EchoActivity
  https://app.powerbigov.us/view?r=eyJrIjoiODRlMzY0MjUtMTA0Yi00YzRkLTk0YjAtNjg4YmFlM2E1YTE3IiwidCI6IjZjOGIyOTRlLTVmZjUtNDJiMi1hM2Q3LWMzYmQ3MGE3OWYyNSJ9
  Program page:
  https://www.oak-park.us/Community/Community-Services/E.C.H.O-Engaging-Community-for-Healthy-Outcomes

E.C.H.O. (Engaging Community for Healthy Outcomes) is the Village's
non-police response and care-coordination program, launched in February 2025.
Its dashboard is a Power BI "publish to web" report. The report has one data
page with a count of services, a monthly column chart, bar charts by service
type, referral hour block and referral weekday, and donut charts by service
type and referral source. It also has a "Dataset" button that downloads the
Village's own public row-level export (one row per service with a timestamp,
service category and referral source; no location, age, name or notes).

PRIVACY. This program serves people in crisis. This script never downloads
row-level records. Every query it sends asks Power BI to GROUP and COUNT on
the server, exactly as the dashboard's own charts do, so only totals reach
this machine and only totals are written to the CSV:

  * services by month and category
  * services by month and referral source
  * services by weekday and category
  * services by four-hour referral time block and category
  * services by referral source and category

The month-by-category tables are published as they come back. In the three
finer cross-tabs (weekday, time block, referral source, each by category),
any cell with fewer than 5 services is written as "<5", and where a single
suppressed cell could be recovered from a row or column total, the next
smallest cell in that row or column is suppressed too. The dashboard shows
no geography (no address, block, beat or zone), so none is cached.

The script does what the dashboard's own JavaScript does:

  1. Decode the `r=` parameter of the dashboard URL (base64 JSON with the
     resource key `k` and tenant id `t`).
  2. Resolve the Power BI cluster for the tenant.
  3. GET  /public/reports/{key}/modelsAndExploration  -> model id, dataset id,
     report id, and the id of the report's own "Service" bar chart, which
     the queries are attributed to.
  4. POST /public/reports/querydata once per breakdown, with a grouped
     COUNT over the `FactsECHOActivity` fact table joined to the report's
     `DIM Calendar` and `DimTimeBlocks` dimension tables.
  5. Decode Power BI's compressed "DSR" result format, apply the small-cell
     suppression above, and write one long-format CSV.

Usage:
    python3 data/scripts/fetch_echo_activity.py [-o data/echo-activity-oak-park.csv]

Requires Python 3.8+ and nothing outside the standard library.

Notes on the data:
  * A "service" is one logged service contact, not one person. One resident
    can generate many services, so counts are workload, not caseload.
  * The timestamp behind the weekday and time-block tables is the referral
    time as logged by ECHO staff, who work weekday business hours, so it
    reflects when a referral was recorded more than when a need arose.
  * A blank service category appears from mid 2026 (kept as "(blank)").
  * The dashboard is refreshed daily; the current month is always partial.
    If the embed key changes and the script returns 401, update
    DASHBOARD_URL from the meta-refresh on the opendata page above.
"""

import argparse
import base64
import csv
import gzip
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid

DASHBOARD_URL = (
    "https://app.powerbigov.us/view?r=eyJrIjoiODRlMzY0MjUtMTA0Yi00YzRkLTk0YjAtNjg4YmFlM2E1YTE3IiwidCI6IjZjOGIyOTRlLTVmZjUtNDJiMi1hM2Q3LWMzYmQ3MGE3OWYyNSJ9"
)

# The Power BI cluster the dashboard is hosted on. Only used if cluster
# resolution fails; the script normally discovers it from the tenant id.
DEFAULT_API_HOST = "https://wabi-us-gov-virginia-api.analysis.usgovcloudapi.net"

# Tables in the dashboard's data model and the columns the report itself uses.
FACT = "FactsECHOActivity"
CALENDAR = "DIM Calendar"
TIME_BLOCKS = "DimTimeBlocks"
SERVICE_COL = "Services"
REFERRAL_COL = "Referral Source "  # trailing space is in the model
WEEKDAY_COL = "DOWLong"
TIME_BLOCK_COL = "Time Block Hour"
DATE_HIERARCHY = "Date Hierarchy"

# Cells below this many services are suppressed in the finer cross-tabs.
SMALL_CELL = 5
SUPPRESSED = "<5"

MONTHS = {
    "January": 1, "February": 2, "March": 3, "April": 4, "May": 5, "June": 6,
    "July": 7, "August": 8, "September": 9, "October": 10, "November": 11,
    "December": 12,
}
for _name, _n in list(MONTHS.items()):
    MONTHS[_name[:3]] = _n
WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

OUTPUT_HEADER = [
    "breakdown", "month", "weekday", "time_block", "referral_source", "service", "count",
]

# Upper bound on grouped rows requested per query (the largest table is
# months x categories, a few hundred rows).
MAX_ROWS = 10000


# ----------------------------------------------------------------------------
# HTTP helpers
# ----------------------------------------------------------------------------

def _headers(resource_key, content_type=None):
    h = {
        "Accept": "application/json, text/plain, */*",
        "X-PowerBI-ResourceKey": resource_key,
        "ActivityId": str(uuid.uuid4()),
        "RequestId": str(uuid.uuid4()),
        "User-Agent": "Mozilla/5.0 (oak-park-day-in-our-data ECHO aggregate extract)",
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
    req = urllib.request.Request(
        url, data=data, headers=_headers(resource_key, content_type), method=method
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
    except urllib.error.HTTPError as e:
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
    # Attribute the queries to the report's own "Service" bar chart, the
    # same thing the dashboard does when it renders that page. Any visual
    # that groups the fact table will do.
    for section in ex.get("sections", []):
        for vc in section.get("visualContainers", []):
            try:
                cfg = json.loads(vc.get("config") or "{}")
            except ValueError:
                continue
            sv = cfg.get("singleVisual") or {}
            if sv.get("visualType") not in ("barChart", "donutChart", "clusteredColumnChart"):
                continue
            ents = [f.get("Entity") for f in (sv.get("prototypeQuery") or {}).get("From", [])]
            if FACT in ents and ctx["visualId"] is None:
                ctx["visualId"] = cfg.get("name")
    if ctx["visualId"] is None:
        raise SystemExit("Could not find a chart over %s in the report layout." % FACT)
    return ctx


def _col(source, prop):
    return {"Column": {"Expression": {"SourceRef": {"Source": source}}, "Property": prop}}


def _level(source, hierarchy, level):
    return {
        "HierarchyLevel": {
            "Expression": {
                "Hierarchy": {"Expression": {"SourceRef": {"Source": source}}, "Hierarchy": hierarchy}
            },
            "Level": level,
        }
    }


def _count():
    """COUNT of the service column, the measure every dashboard chart uses."""
    return {"Aggregation": {"Expression": _col("f", SERVICE_COL), "Function": 5}}


def build_grouped_query(ctx, select, top=MAX_ROWS):
    """A grouped COUNT query; every non-aggregate Select entry is a group key."""
    select = [dict(s, Name="C%d" % i) for i, s in enumerate(select)]
    query = {
        "Version": 2,
        "From": [
            {"Name": "f", "Entity": FACT, "Type": 0},
            {"Name": "d", "Entity": CALENDAR, "Type": 0},
            {"Name": "t", "Entity": TIME_BLOCKS, "Type": 0},
        ],
        "Select": select,
    }
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
                                        "Groupings": [{"Projections": list(range(len(select)))}]
                                    },
                                    "DataReduction": {
                                        "DataVolume": 4,
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


def fetch_grouped(api_host, resource_key, ctx, label, select):
    """Run one grouped COUNT; return rows of (group keys..., count)."""
    data = query_data(api_host, resource_key, build_grouped_query(ctx, select))
    if "error" in data:
        raise SystemExit("querydata error for %s: %s" % (label, json.dumps(data["error"])[:500]))
    if len(select) == 1:
        # A bare aggregate comes back as {"S": [...], "M0": <value>}, not as a row.
        dm0 = data["results"][0]["result"]["data"]["dsr"]["DS"][0]["PH"][0]["DM0"][0]
        rows = [[dm0.get("M0", 0)]]
    else:
        rows = decode_dsr(data, len(select))
    if len(rows) >= MAX_ROWS:
        raise SystemExit("%s: hit the %d-row cap; raise MAX_ROWS" % (label, MAX_ROWS))
    out = []
    for r in rows:
        keys = [("(blank)" if (k is None or str(k).strip() == "") else str(k).strip()) for k in r[:-1]]
        out.append(tuple(keys) + (int(r[-1] or 0),))
    print("  %s: %d grouped rows, %d services" % (label, len(out), sum(r[-1] for r in out)),
          file=sys.stderr)
    return out


# ----------------------------------------------------------------------------
# Small-cell suppression
# ----------------------------------------------------------------------------

def suppress(cells):
    """
    cells: dict (row_key, col_key) -> count. Return dict of the same keys ->
    count or SUPPRESSED. Primary suppression hides counts of 1 to 4.
    Complementary suppression: if a row or column has exactly one hidden
    cell, its total (which is public elsewhere) would reveal it, so hide the
    next smallest cell in that row or column too, and repeat until stable.
    """
    hidden = {k for k, n in cells.items() if 0 < n < SMALL_CELL}
    changed = True
    while changed:
        changed = False
        for axis in (0, 1):
            groups = {}
            for k in cells:
                groups.setdefault(k[axis], []).append(k)
            for keys in groups.values():
                h = [k for k in keys if k in hidden]
                visible = [k for k in keys if k not in hidden and cells[k] > 0]
                if len(h) == 1 and visible:
                    hidden.add(min(visible, key=lambda k: (cells[k], k)))
                    changed = True
    return {k: (SUPPRESSED if k in hidden else n) for k, n in cells.items()}


# ----------------------------------------------------------------------------
# main
# ----------------------------------------------------------------------------

def month_key(year, month_label):
    m = MONTHS.get(str(month_label))
    if m is None:
        try:
            m = int(month_label)
        except ValueError:
            raise SystemExit("Unrecognised month label %r" % (month_label,))
    return "%04d-%02d" % (int(year), m)


def time_block_key(label):
    """Order four-hour blocks by start hour, but keep the wrap-around block last."""
    try:
        start = int(str(label)[:2])
    except ValueError:
        return (99, str(label))
    end = int(str(label)[5:7]) if len(str(label)) >= 7 else start
    return (99, str(label)) if end < start else (start, str(label))


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument(
        "-o", "--output", default="data/echo-activity-oak-park.csv",
        help="CSV path to write (default: data/echo-activity-oak-park.csv)",
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

    year, month = _level("d", DATE_HIERARCHY, "Year"), _level("d", DATE_HIERARCHY, "Month")
    print("Fetching grouped counts (no row-level data is requested) ...", file=sys.stderr)
    total = fetch_grouped(api_host, resource_key, ctx, "total", [_count()])
    grand_total = total[0][-1] if total else 0
    by_month_service = fetch_grouped(
        api_host, resource_key, ctx, "service_by_month",
        [year, month, _col("f", SERVICE_COL), _count()])
    by_month_referral = fetch_grouped(
        api_host, resource_key, ctx, "referral_by_month",
        [year, month, _col("f", REFERRAL_COL), _count()])
    by_weekday_service = fetch_grouped(
        api_host, resource_key, ctx, "service_by_weekday",
        [_col("d", WEEKDAY_COL), _col("f", SERVICE_COL), _count()])
    by_block_service = fetch_grouped(
        api_host, resource_key, ctx, "service_by_time_block",
        [_col("t", TIME_BLOCK_COL), _col("f", SERVICE_COL), _count()])
    by_referral_service = fetch_grouped(
        api_host, resource_key, ctx, "referral_by_service",
        [_col("f", REFERRAL_COL), _col("f", SERVICE_COL), _count()])

    for label, rows in (
        ("service_by_month", by_month_service), ("referral_by_month", by_month_referral),
        ("service_by_weekday", by_weekday_service), ("service_by_time_block", by_block_service),
        ("referral_by_service", by_referral_service),
    ):
        n = sum(r[-1] for r in rows)
        if n != grand_total:
            raise SystemExit(
                "%s sums to %d services but the model reports %d; the report layout "
                "may have changed." % (label, n, grand_total))
    if grand_total == 0:
        raise SystemExit("No services counted; the dashboard feed may have changed.")

    records = []

    def add(breakdown, month="", weekday="", time_block="", referral="", service="", count=""):
        records.append({
            "breakdown": breakdown, "month": month, "weekday": weekday,
            "time_block": time_block, "referral_source": referral, "service": service,
            "count": count,
        })

    # Month by category: published as returned (the dashboard's own grain).
    for y, m, svc, n in sorted(by_month_service, key=lambda r: (month_key(r[0], r[1]), r[2])):
        add("service_by_month", month=month_key(y, m), service=svc, count=n)
    for y, m, ref, n in sorted(by_month_referral, key=lambda r: (month_key(r[0], r[1]), r[2])):
        add("referral_by_month", month=month_key(y, m), referral=ref, count=n)

    # Finer cross-tabs: small cells suppressed, with complementary suppression.
    wk = suppress({(d, s): n for d, s, n in by_weekday_service})
    for (d, s) in sorted(wk, key=lambda k: (WEEKDAYS.index(k[0]) if k[0] in WEEKDAYS else 9, k[1])):
        add("service_by_weekday", weekday=d, service=s, count=wk[(d, s)])
    tb = suppress({(b, s): n for b, s, n in by_block_service})
    for (b, s) in sorted(tb, key=lambda k: (time_block_key(k[0]), k[1])):
        add("service_by_time_block", time_block=b, service=s, count=tb[(b, s)])
    rs = suppress({(r, s): n for r, s, n in by_referral_service})
    for (r, s) in sorted(rs):
        add("referral_by_service", referral=r, service=s, count=rs[(r, s)])

    hidden = sum(1 for rec in records if rec["count"] == SUPPRESSED)

    with open(args.output, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=OUTPUT_HEADER, lineterminator="\n")
        w.writeheader()
        w.writerows(records)

    months = sorted({rec["month"] for rec in records if rec["month"]})
    print(
        "Wrote %d aggregate rows to %s (%d services, %s to %s, %d cells suppressed as %s)"
        % (len(records), args.output, grand_total, months[0], months[-1], hidden, SUPPRESSED),
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
