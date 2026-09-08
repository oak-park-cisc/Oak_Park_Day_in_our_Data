#!/usr/bin/env python3
"""
Fetch Oak Park business licenses from the Village's public Power BI dashboard.

Source: Village of Oak Park, "Business License - Public" dashboard
  https://opendata.oak-park.us/BusinessLicense/
  https://app.powerbigov.us/view?r=eyJrIjoiZmNjOWJlNGEtYjE2NS00YjYzLWEwNzQtMWFlYzFjNTA5MjI1IiwidCI6IjZjOGIyOTRlLTVmZjUtNDJiMi1hM2Q3LWMzYmQ3MGE3OWYyNSJ9

The Village page is a one-line HTML redirect to the Power BI report. The report
is a "publish to web" dashboard with no export button, but the page loads its
data through Power BI's public, unauthenticated query API using a resource key
embedded in the dashboard URL. This script does what the dashboard's own
JavaScript does:

  1. Read the Village page to find the current dashboard URL (it falls back to
     DASHBOARD_URL above if the page cannot be read), then decode the `r=`
     parameter (base64 JSON with the resource key `k` and tenant id `t`).
  2. Resolve the Power BI cluster for the tenant.
  3. GET  /public/reports/{key}/modelsAndExploration  -> model id, dataset id,
     report id, and the id of a "Fact Licenses" table visual that the queries
     are attributed to.
  4. POST /public/reports/querydata once per table: the `Fact Licenses` table
     (one row per license) and the lookup tables that hold the address, the
     coordinates, the category names, and the license classes.
  5. Decode Power BI's compressed "DSR" result format, join the lookups to the
     licenses locally, and write a CSV.

The lookups are pulled as separate tables and joined here on purpose. Asking
Power BI to join `Fact Licenses` to `Dim CVLocation` in one query returns every
address in the Village (about 24,000 rows) with a blank license on most of
them, which is the same fan-out the crash extractor works around. The address
table is also far larger than the 30,000-row query cap (266,909 rows), so it
is fetched in chunks filtered to the license ids we actually need.

Usage:
    python3 data/scripts/fetch_business_licenses.py [-o data/business-licenses-oak-park.csv]
                                                    [--include-home-coords]

Requires Python 3.8+ and nothing outside the standard library.

Notes on the data:
  * One row per business license record in the Village's CityView permitting
    system (record_id and license_number are both unique). The report's own
    documentation page says a license "can have more than one Business Class",
    which is why `license_classes` is a semicolon-separated list.
  * license_status is Active or InActive; issued_status is whether the most
    recent license year was Renewed or Not Renewed. An Active license whose
    last_issued_expired_date is in the past has lapsed without being closed.
  * The license year runs April 1 to March 31: most licenses expire on 03-31
    and are reissued in April, so last_issued_date is a renewal date, not an
    opening date. Use date_start (the business's start date, which can be
    decades old) for openings and date_end for closings.
  * Closings (date_end) only exist from 2015 on, when the Village moved to
    CityView; businesses that closed before then are not in the dataset, and
    2016 has almost no closings (3). Treat 2017 onward as the reliable range.
  * date_start of 1900-01-01 is a placeholder the source uses for "unknown".
  * The report's documentation page lists eight test records the Village
    filters out of every visual. They are dropped here too (TEST_NAMES).
  * Coordinates come from the Village GIS address table joined on the street
    address. The dashboard's map deliberately hides home-based businesses
    (they are people's homes), so latitude/longitude are left blank for
    home_based = 1 unless --include-home-coords is given. The street address
    itself is kept because the dashboard's drill-through table shows it.
  * business_district is the Village business district the address falls in
    (blank for home-based and residential addresses). zoning and land_use_code
    are the GIS values for the address.
"""

import argparse
import base64
import csv
import datetime as dt
import gzip
import json
import re
import sys
import urllib.parse
import urllib.request
import uuid

VILLAGE_PAGE_URL = "https://opendata.oak-park.us/BusinessLicense/"

DASHBOARD_URL = (
    "https://app.powerbigov.us/view?r=eyJrIjoiZmNjOWJlNGEtYjE2NS00YjYzLWEwNzQtMWFlYzFjNTA5MjI1IiwidCI6IjZjOGIyOTRlLTVmZjUtNDJiMi1hM2Q3LWMzYmQ3MGE3OWYyNSJ9"
)

# The Power BI cluster the dashboard is hosted on. Only used if cluster
# resolution fails; the script normally discovers it from the tenant id.
DEFAULT_API_HOST = "https://wabi-us-gov-virginia-api.analysis.usgovcloudapi.net"

# Fact table and columns in the dashboard's data model. Each entry is
# (Power BI column name, CSV column name, kind). kind is one of:
#   "str", "int", "yesno" (Yes/No -> 1/0), "date" (YYYY-MM-DD)
FACT = "Fact Licenses"
FACT_COLUMNS = [
    ("RecordID", "record_id", "int"),
    ("License#", "license_number", "str"),
    ("Name", "name", "str"),
    ("DoingBusinessAs", "doing_business_as", "str"),
    ("LicenseStatus", "license_status", "str"),
    ("LicenseIssuedStatus", "issued_status", "str"),
    ("DateStart", "date_start", "date"),
    ("DateEnd", "date_end", "date"),
    ("FirstIssuedDate", "first_issued_date", "date"),
    ("LastIssuedDate", "last_issued_date", "date"),
    ("LastIssuedExpiredDate", "last_issued_expired_date", "date"),
    ("LicenseEnteredDate", "license_entered_date", "date"),
    ("LastIssuedEnteredDate", "last_issued_entered_date", "date"),
    ("MajorCategory", "major_category_code", "str"),
    ("GeneralCategory", "general_category_code", "str"),
    ("Sub-Category", "sub_category_code", "str"),
    ("SubCategory", "sub_category_group", "str"),
    ("HomeBased Flag", "home_based", "yesno"),
    ("Liquor Flag", "liquor", "yesno"),
    ("Mobile Flag", "mobile", "yesno"),
    ("District", "business_district", "str"),
    ("GNCommonID", "location_id", "int"),
    ("Link", "cityview_link", "str"),
]

# Lookup tables. The address table joins to the fact table on GNCommonID; the
# GIS table joins to the address table on the upper-case street address; the
# class table joins to the fact table on LCLicenseeID = RecordID.
DIM_LOCATION = ("Dim CVLocation", ["GNCommonID", "AddrStatus", "StreetLocation", "UnitLocation", "StreetUnitLocation"])
DIM_GIS = ("Dim2 GISLocation", ["STREETADDRESS", "ZONED", "BUSINESS_DISTRICTNAME", "LANDUSECODE", "XCOORD", "YCOORD"])
DIM_CATEGORY_MAJOR = ("Dim LookupC2LCCategoryMajor", ["Code", "Desc"])
DIM_CATEGORY_BASE = ("Dim LookupC2LCCategoryBase", ["Code", "Desc"])
DIM_CATEGORY_SUB = ("Dim LookupC2LCCategorySub", ["Code", "Desc"])
DIM_CLASS = ("Dim LCClass", ["LCLicenseeID", "Type"])
DIM_CLASS_LOOKUP = ("Dim2 LookupLCClass", ["Code", "Desc"])

OUTPUT_HEADER = [
    "record_id", "license_number", "name", "doing_business_as",
    "license_status", "issued_status",
    "date_start", "start_year", "date_end", "end_year",
    "first_issued_date", "last_issued_date", "last_issued_expired_date",
    "license_entered_date", "last_issued_entered_date",
    "major_category_code", "major_category",
    "general_category_code", "general_category",
    "sub_category_code", "sub_category", "sub_category_group",
    "license_classes", "home_based", "liquor", "mobile",
    "business_district", "street_address", "unit", "address", "street",
    "address_status", "zoning", "land_use_code",
    "latitude", "longitude", "cityview_link",
]

# Test records the Village filters out of every page of the report (listed on
# the report's "Doc - Note" page). Compared case-insensitively.
TEST_NAMES = {
    "LO'S PLACE", "LORETTA'S LLC", "MY TEST", "HUZAIFA NADEEM", "HUZAIFA TEST",
    "TEST HUZAIFA", "ALVIN BUSINESS TEST", "TEST CASE",
}

# Upper bound on rows requested per query. Power BI caps a single query at
# 30,000 rows; the fact table is ~2.5k rows and the GIS table ~14k as of
# September 2026. The script verifies both against a COUNT query.
MAX_ROWS = 100000
FILTER_CHUNK = 500


# ----------------------------------------------------------------------------
# HTTP helpers
# ----------------------------------------------------------------------------

def _headers(resource_key, content_type=None):
    h = {
        "Accept": "application/json, text/plain, */*",
        "X-PowerBI-ResourceKey": resource_key,
        "ActivityId": str(uuid.uuid4()),
        "RequestId": str(uuid.uuid4()),
        "User-Agent": "Mozilla/5.0 (oak-park-day-in-our-data business license extract)",
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


def discover_dashboard_url(page_url):
    """Read the Village page and return the Power BI URL it redirects to.

    The page is a bare <meta http-equiv="refresh"> to app.powerbigov.us. It
    only answers to a browser-like User-Agent. Returns None on any failure so
    the caller can fall back to the hard-coded DASHBOARD_URL.
    """
    req = urllib.request.Request(
        page_url,
        headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            html = resp.read().decode("utf-8", "replace")
    except Exception as e:  # noqa: BLE001
        print("warning: could not read %s (%s)" % (page_url, e), file=sys.stderr)
        return None
    # Ignore any commented-out redirects (the page keeps an "under construction"
    # one inside an HTML comment).
    html = re.sub(r"<!--.*?-->", "", html, flags=re.S)
    m = re.search(r"url=(https://app\.powerbigov\.us/view\?r=[^\"'\s>]+)", html, flags=re.I)
    return m.group(1) if m else None


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
    # Attribute the queries to one of the report's own Fact Licenses table
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


def build_table_query(ctx, entity, props, in_filter=None, top=MAX_ROWS):
    """Select `props` from `entity`; in_filter = (column, [int ids]) restricts rows."""
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
    if in_filter:
        column, ids = in_filter
        query["Where"] = [
            {
                "Condition": {
                    "In": {
                        "Expressions": [_col(column)],
                        "Values": [[{"Literal": {"Value": "%dL" % v}}] for v in ids],
                    }
                }
            }
        ]
    return _wrap(ctx, query, top)


def build_count_query(ctx, entity, prop):
    """COUNT(prop) over a whole table, to verify nothing was truncated."""
    agg = {"Aggregation": {"Expression": _col(prop), "Function": 5}, "Name": "N"}
    query = {
        "Version": 2,
        "From": [{"Name": "f", "Entity": entity, "Type": 0}],
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


def server_count(api_host, resource_key, ctx, entity, prop):
    cnt = query_data(api_host, resource_key, build_count_query(ctx, entity, prop))
    # A bare aggregate comes back as {"S": [...], "M0": <value>} or with C=[value].
    dm0 = cnt["results"][0]["result"]["data"]["dsr"]["DS"][0]["PH"][0]["DM0"][0]
    return int(dm0["M0"] if "M0" in dm0 else dm0["C"][0])


# ----------------------------------------------------------------------------
# DSR (Data Shape Result) decoding
# ----------------------------------------------------------------------------
# Rows come back compressed:
#   S  : schema on the first row of a page; per column, T = type code and
#        DN = name of the value dictionary the column's values index into
#   C  : the values that are actually present for this row, in column order
#   R  : bitmask, bit i set -> column i repeats the previous row's value
#   Ø  : bitmask, bit i set -> column i is null
# Type code 7 is DateTime, delivered as milliseconds since the Unix epoch
# (or, for a few very old placeholder dates, as an ISO string).

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


def fetch_table(api_host, resource_key, ctx, entity, props, in_filter=None):
    data = query_data(api_host, resource_key, build_table_query(ctx, entity, props, in_filter))
    if "error" in data:
        raise SystemExit("querydata error for %s: %s" % (entity, json.dumps(data["error"])[:500]))
    rows = decode_dsr(data, len(props))
    return rows


def fetch_table_by_ids(api_host, resource_key, ctx, entity, props, id_column, ids):
    """Fetch only the rows of a large table whose id_column is in `ids`."""
    ids = sorted(set(i for i in ids if i is not None))
    rows = []
    for start in range(0, len(ids), FILTER_CHUNK):
        chunk = ids[start:start + FILTER_CHUNK]
        rows.extend(fetch_table(api_host, resource_key, ctx, entity, props, (id_column, chunk)))
    print("  %s: %d rows for %d ids" % (entity, len(rows), len(ids)), file=sys.stderr)
    return rows


# ----------------------------------------------------------------------------
# Formatting
# ----------------------------------------------------------------------------

def to_datetime(v):
    # Naive timestamps stored as epoch milliseconds; do not shift zones.
    if isinstance(v, (int, float)):
        return dt.datetime(1970, 1, 1) + dt.timedelta(milliseconds=v)
    return dt.datetime.fromisoformat(str(v).replace("Z", ""))


def format_value(v, kind):
    if v is None or v == "":
        return ""
    if kind == "date":
        return to_datetime(v).strftime("%Y-%m-%d")
    if kind == "int":
        try:
            return str(int(v))
        except (TypeError, ValueError):
            return str(v)
    if kind == "yesno":
        s = str(v).strip().lower()
        return "1" if s == "yes" else "0" if s == "no" else s
    return str(v).strip()


def fmt_coord(v):
    if v is None or v == "":
        return ""
    try:
        return "%.7f" % float(v)
    except (TypeError, ValueError):
        return str(v)


STREET_RE = re.compile(r"^\d+[A-Za-z]?(?:\s*-\s*\d+)?\s+(.+)$")


def street_of(street_address):
    """'1010 LAKE ST' -> 'LAKE ST'; '' if there is no house number."""
    m = STREET_RE.match(street_address or "")
    return m.group(1).strip().upper() if m else ""


def rows_to_records(fact_rows, locations, gis, majors, bases, subs, classes, include_home_coords):
    records = []
    for raw in fact_rows:
        rec = {}
        for (prop, name, kind), v in zip(FACT_COLUMNS, raw):
            rec[name] = format_value(v, kind)
        rec["start_year"] = rec["date_start"][:4] if rec["date_start"] else ""
        rec["end_year"] = rec["date_end"][:4] if rec["date_end"] else ""
        rec["major_category"] = majors.get(rec["major_category_code"], "")
        rec["general_category"] = bases.get(rec["general_category_code"], "")
        rec["sub_category"] = subs.get(rec["sub_category_code"], "")
        rec["license_classes"] = "; ".join(classes.get(rec["record_id"], []))

        loc = locations.get(rec["location_id"])
        street_address = (loc[2] if loc else None) or ""
        rec["address_status"] = (loc[1] if loc else None) or ""
        rec["street_address"] = street_address.strip()
        rec["unit"] = ((loc[3] if loc else None) or "").strip()
        rec["address"] = ((loc[4] if loc else None) or "").strip()
        rec["street"] = street_of(rec["street_address"])

        g = gis.get(rec["street_address"].upper())
        rec["zoning"] = (g[1] if g else None) or ""
        rec["land_use_code"] = (g[3] if g else None) or ""
        if not rec["business_district"] and g and g[2]:
            rec["business_district"] = g[2]
        hide = rec["home_based"] == "1" and not include_home_coords
        rec["latitude"] = fmt_coord(g[5]) if g and not hide else ""
        rec["longitude"] = fmt_coord(g[4]) if g and not hide else ""
        del rec["location_id"]
        records.append(rec)
    return records


# ----------------------------------------------------------------------------
# main
# ----------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument(
        "-o", "--output", default="data/business-licenses-oak-park.csv",
        help="CSV path to write (default: data/business-licenses-oak-park.csv)",
    )
    ap.add_argument(
        "--dashboard-url", default=None,
        help="Power BI publish-to-web URL (default: read it from the Village page, "
             "falling back to the URL in this script)",
    )
    ap.add_argument(
        "--include-home-coords", action="store_true",
        help="keep latitude/longitude for home-based businesses (the Village's map hides them)",
    )
    args = ap.parse_args()

    dashboard_url = args.dashboard_url or discover_dashboard_url(VILLAGE_PAGE_URL) or DASHBOARD_URL
    if dashboard_url != DASHBOARD_URL:
        print("Dashboard URL from Village page: %s" % dashboard_url, file=sys.stderr)
    resource_key, tenant_id = decode_dashboard_url(dashboard_url)
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
        expected = server_count(api_host, resource_key, ctx, FACT, "RecordID")
        print("Server row count (COUNT RecordID): %d" % expected, file=sys.stderr)
    except Exception as e:  # noqa: BLE001
        print("warning: count query failed: %s" % e, file=sys.stderr)

    print("Fetching tables ...", file=sys.stderr)
    fact_rows = fetch_table(api_host, resource_key, ctx, FACT, [c[0] for c in FACT_COLUMNS])
    print("  %s: %d rows" % (FACT, len(fact_rows)), file=sys.stderr)
    if expected is not None and len(fact_rows) != expected:
        raise SystemExit(
            "Row count mismatch: decoded %d rows but server reports %d. "
            "Check MAX_ROWS or the DSR decoder." % (len(fact_rows), expected)
        )
    if not fact_rows:
        raise SystemExit("No rows returned; the dashboard feed may have changed.")

    props = [c[0] for c in FACT_COLUMNS]
    record_ids = [r[props.index("RecordID")] for r in fact_rows]
    location_ids = [r[props.index("GNCommonID")] for r in fact_rows]

    locations = {
        str(int(r[0])): r
        for r in fetch_table_by_ids(api_host, resource_key, ctx, DIM_LOCATION[0], DIM_LOCATION[1], "GNCommonID", location_ids)
    }

    gis_rows = fetch_table(api_host, resource_key, ctx, *DIM_GIS)
    print("  %s: %d rows" % (DIM_GIS[0], len(gis_rows)), file=sys.stderr)
    try:
        gis_expected = server_count(api_host, resource_key, ctx, DIM_GIS[0], "STREETADDRESS")
        if gis_expected != len(gis_rows):
            raise SystemExit("GIS table truncated: %d of %d rows" % (len(gis_rows), gis_expected))
    except SystemExit:
        raise
    except Exception as e:  # noqa: BLE001
        print("warning: GIS count query failed: %s" % e, file=sys.stderr)
    gis = {str(r[0]).strip().upper(): r for r in gis_rows if r[0]}

    def lookup(entity, cols):
        rows = fetch_table(api_host, resource_key, ctx, entity, cols)
        print("  %s: %d rows" % (entity, len(rows)), file=sys.stderr)
        return {str(r[0]).strip(): str(r[1] or "").strip() for r in rows}

    majors = lookup(*DIM_CATEGORY_MAJOR)
    bases = lookup(*DIM_CATEGORY_BASE)
    subs = lookup(*DIM_CATEGORY_SUB)
    class_names = lookup(*DIM_CLASS_LOOKUP)

    classes = {}
    for lic_id, code in fetch_table_by_ids(api_host, resource_key, ctx, DIM_CLASS[0], DIM_CLASS[1], "LCLicenseeID", record_ids):
        if code:
            classes.setdefault(str(lic_id), []).append(class_names.get(str(code).strip(), str(code)))
    for v in classes.values():
        v.sort()

    records = rows_to_records(fact_rows, locations, gis, majors, bases, subs, classes, args.include_home_coords)

    before = len(records)
    records = [r for r in records if r["name"].strip().upper() not in TEST_NAMES]
    print("Dropped %d test records listed on the report's Doc - Note page" % (before - len(records)), file=sys.stderr)

    records.sort(key=lambda r: int(r["record_id"]))

    with open(args.output, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=OUTPUT_HEADER, lineterminator="\n")
        w.writeheader()
        w.writerows(records)

    with_addr = sum(1 for r in records if r["street_address"])
    with_geo = sum(1 for r in records if r["latitude"])
    active = sum(1 for r in records if r["license_status"] == "Active")
    print(
        "Wrote %d rows to %s (%d active); %d with a street address, %d with coordinates"
        % (len(records), args.output, active, with_addr, with_geo),
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
