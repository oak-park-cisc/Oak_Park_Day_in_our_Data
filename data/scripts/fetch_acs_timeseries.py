#!/usr/bin/env python3
"""
Build data/acs-oak-park-timeseries.csv: key American Community Survey (ACS)
5-year indicators for Oak Park village, Cook County, and Illinois, one row per
geography x vintage x variable (long format), for every ACS 5-year vintage
from 2009 (2005-2009) through 2024 (2020-2024).

API KEY (optional): if the environment variable CENSUS_API_KEY is set, every
vintage is pulled from the official Census Data API
(https://api.census.gov/data/<year>/acs/acs5). Keyless requests to that API
now redirect to a "Missing Key" page, so without a key the script falls back
to two other Census Bureau sources that do not require a key:

  * 2010-2024: the data.census.gov table endpoint
    https://data.census.gov/api/access/data/table?id=ACSDT5Y<year>.<table>&g=<geo>
    (this is the backend of the official data.census.gov explorer; it serves
    exactly the same estimates and margins of error as the Data API)
  * 2009: the ACS 2005-2009 5-year Summary File on the Census FTP server
    https://www2.census.gov/programs-surveys/acs/summary_file/2009/
    (sequence files for Illinois, "All_Geographies_Not_Tracts_Block_Groups")

Variable labels for every vintage come from the keyless table metadata at
https://api.census.gov/data/<year>/acs/acs5/groups/<table>.json.

Requirements: Python 3 standard library plus `requests`.

Usage:
    python3 data/scripts/fetch_acs_timeseries.py [output.csv]
"""

import csv
import io
import math
import os
import sys
import time
import zipfile

import requests

OUT_PATH = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "acs-oak-park-timeseries.csv")

API_KEY = os.environ.get("CENSUS_API_KEY", "").strip()
UA = {"User-Agent": "Mozilla/5.0 (Oak Park Day in Our Data hackathon data script)"}

VINTAGES = list(range(2009, 2025))

# geography label, full GEOID, Data API "for"/"in" clauses, data.census.gov "g" code
GEOS = [
    ("Oak Park village, Illinois", "16000US1754885", "place:54885", "state:17", "160XX00US1754885"),
    ("Cook County, Illinois", "05000US17031", "county:031", "state:17", "050XX00US17031"),
    ("Illinois", "04000US17", "state:17", None, "040XX00US17"),
]

# Sentinel values the Census uses for "not available" / suppressed
SENTINELS = {"-666666666", "-888888888", "-999999999", "-222222222", "-333333333",
             "-555555555", "*", "**", "***", "(X)", "N", "null", "", "."}


def wanted_variables(vintage):
    """Return the list of (table, variable_id) pairs to extract for a vintage.
    variable_id is the base id without the E/M suffix, e.g. B19013_001."""
    v = [
        ("B01003", ["001"]),                       # total population
        ("B01002", ["001"]),                       # median age
        ("B19013", ["001"]),                       # median household income
        ("B25077", ["001"]),                       # median home value
        ("B25064", ["001"]),                       # median gross rent
        ("B25003", ["001", "002", "003"]),         # tenure: total, owner, renter
        ("B03002", ["001", "003", "004", "006", "012"]),  # race / ethnicity
        ("B25035", ["001"]),                       # median year structure built
        ("B25034", None),                          # year built: all columns (categories shift by vintage)
    ]
    if vintage >= 2012:
        v.append(("B15003", ["001", "022", "023", "024", "025"]))  # educational attainment 25+
    else:
        # B15003 does not exist before the 2012 vintage; use sex-by-attainment B15002
        v.append(("B15002", ["001", "015", "016", "017", "018", "032", "033", "034", "035"]))
    return [(t, None if ids is None else [f"{t}_{i}" for i in ids]) for t, ids in v]


def bachelors_components(vintage):
    if vintage >= 2012:
        return "B15003", "B15003_001", ["B15003_022", "B15003_023", "B15003_024", "B15003_025"]
    return "B15002", "B15002_001", ["B15002_015", "B15002_016", "B15002_017", "B15002_018",
                                    "B15002_032", "B15002_033", "B15002_034", "B15002_035"]


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------
SESSION = requests.Session()
SESSION.headers.update(UA)


def get(url, params=None, tries=4, expect_json=True):
    delay = 2.0
    for attempt in range(tries):
        try:
            r = SESSION.get(url, params=params, timeout=(20, 60), allow_redirects=False)
        except requests.RequestException as e:
            print(f"  network error {e}; retrying", file=sys.stderr)
            time.sleep(delay)
            delay *= 2
            continue
        if r.status_code in (429, 500, 502, 503, 504):
            print(f"  HTTP {r.status_code} from {url}; retrying in {delay:.0f}s", file=sys.stderr)
            time.sleep(delay)
            delay *= 2
            continue
        if r.status_code in (301, 302, 303, 307, 308):
            raise RuntimeError(f"Unexpected redirect to {r.headers.get('Location')} for {url} "
                               "(the Census Data API redirects keyless requests to a Missing Key page)")
        if r.status_code == 204:
            return None
        r.raise_for_status()
        return r.json() if expect_json else r
    raise RuntimeError(f"gave up on {url}")


# ---------------------------------------------------------------------------
# Labels from the (keyless) table metadata endpoint
# ---------------------------------------------------------------------------
_label_cache = {}


def table_labels(vintage, table):
    """{variable_id_without_suffix: label} for a table in a vintage."""
    key = (vintage, table)
    if key in _label_cache:
        return _label_cache[key]
    url = f"https://api.census.gov/data/{vintage}/acs/acs5/groups/{table}.json"
    labels = {}
    try:
        meta = get(url)
        for var, info in meta.get("variables", {}).items():
            if var.endswith("E") and var[:-1].startswith(table + "_"):
                lab = info.get("label", "").replace("Estimate!!", "").replace("!!", " > ")
                labels[var[:-1]] = lab
    except Exception as e:  # metadata is a nicety; do not fail the run
        print(f"  warning: could not load labels for {vintage} {table}: {e}", file=sys.stderr)
    _label_cache[key] = labels
    return labels


def pre1940_variable(vintage):
    """B25034's 'Built 1939 or earlier' line moved from _010 to _011 in the 2015 vintage."""
    labels = table_labels(vintage, "B25034")
    for var, lab in labels.items():
        if "1939" in lab:
            return var
    return "B25034_010" if vintage <= 2014 else "B25034_011"


# ---------------------------------------------------------------------------
# Source 1: official Census Data API (needs CENSUS_API_KEY)
# ---------------------------------------------------------------------------
def fetch_api(vintage, table, var_ids, geo):
    """Return {variable_id: (estimate, moe)} for one geography via api.census.gov."""
    _, _, for_clause, in_clause, _ = geo
    if var_ids is None:
        var_ids = sorted(table_labels(vintage, table).keys())
    fields = ["NAME"] + [v + s for v in var_ids for s in ("E", "M")]
    params = {"get": ",".join(fields), "for": for_clause, "key": API_KEY}
    if in_clause:
        params["in"] = in_clause
    data = get(f"https://api.census.gov/data/{vintage}/acs/acs5", params=params)
    header, row = data[0], data[1]
    rec = dict(zip(header, row))
    return {v: (rec.get(v + "E"), rec.get(v + "M")) for v in var_ids}


# ---------------------------------------------------------------------------
# Source 2: data.census.gov table endpoint (keyless, 2010 onward)
# ---------------------------------------------------------------------------
def fetch_datacensus(vintage, table, var_ids, geo):
    gcode = geo[4]
    data = get("https://data.census.gov/api/access/data/table",
               params={"id": f"ACSDT5Y{vintage}.{table}", "g": gcode})
    if data is None:
        raise RuntimeError(f"no content for {vintage} {table} {gcode}")
    rows = data["response"]["data"]
    header, row = rows[0], rows[1]
    rec = dict(zip(header, row))
    if var_ids is None:
        var_ids = sorted({h[:-1] for h in header if h.startswith(table + "_") and h.endswith("E")
                          and not h.endswith("EA")})
    return {v: (rec.get(v + "E"), rec.get(v + "M")) for v in var_ids}


# ---------------------------------------------------------------------------
# Source 3: ACS 2005-2009 Summary File on the Census FTP server (keyless)
# ---------------------------------------------------------------------------
FTP2009 = "https://www2.census.gov/programs-surveys/acs/summary_file/2009"
FTP2009_DATA = FTP2009 + "/data/5_year_seq_by_state/Illinois/All_Geographies_Not_Tracts_Block_Groups"
_ftp_cache = {}


def ftp2009_lookup():
    """{table: (sequence_number, start_position)} from the sequence/table lookup file."""
    if "lookup" in _ftp_cache:
        return _ftp_cache["lookup"]
    r = get(FTP2009 + "/documentation/5_year/user_tools/Sequence_Number_and_Table_Number_Lookup.txt",
            expect_json=False)
    lookup = {}
    for rec in csv.DictReader(io.StringIO(r.content.decode("latin-1"))):
        start = rec["Start Position"].strip()
        if start.isdigit() and rec["Table ID"] not in lookup:
            lookup[rec["Table ID"]] = (int(rec["Sequence Number"]), int(start))
    _ftp_cache["lookup"] = lookup
    return lookup


def ftp2009_logrecnos():
    """{full_geoid: LOGRECNO} for the three geographies from the fixed-width geography file."""
    if "geo" in _ftp_cache:
        return _ftp_cache["geo"]
    r = get(FTP2009_DATA + "/g20095il.txt", expect_json=False)
    want = {g[1] for g in GEOS}
    found = {}
    for line in r.content.decode("latin-1").splitlines():
        geoid = line[178:218].strip()          # GEOID, columns 179-218
        if geoid in want:
            found[geoid] = line[13:20]         # LOGRECNO, columns 14-20
    _ftp_cache["geo"] = found
    return found


def ftp2009_sequence(seq):
    """Return ({logrecno: [cells]} for estimates, same for margins) for a sequence."""
    key = ("seq", seq)
    if key in _ftp_cache:
        return _ftp_cache[key]
    r = get(f"{FTP2009_DATA}/20095il{seq:04d}000.zip", expect_json=False)
    zf = zipfile.ZipFile(io.BytesIO(r.content))
    want = set(ftp2009_logrecnos().values())
    out = {}
    for kind in ("e", "m"):
        rows = {}
        with zf.open(f"{kind}20095il{seq:04d}000.txt") as fh:
            for line in io.TextIOWrapper(fh, encoding="latin-1"):
                cells = line.rstrip("\r\n").split(",")
                if cells[5] in want:
                    rows[cells[5]] = cells
        out[kind] = rows
    _ftp_cache[key] = out
    return out


def fetch_ftp2009(vintage, table, var_ids, geo):
    assert vintage == 2009
    lookup = ftp2009_lookup()
    seq, start = lookup[table]
    logrec = ftp2009_logrecnos()[geo[1]]
    data = ftp2009_sequence(seq)
    if var_ids is None:
        n = 10  # B25034 had 10 lines in the 2005-2009 release
        var_ids = [f"{table}_{i:03d}" for i in range(1, n + 1)]
    result = {}
    for v in var_ids:
        line = int(v.split("_")[1])
        idx = start - 1 + (line - 1)       # start position is 1-based within the record
        est = data["e"][logrec][idx] if logrec in data["e"] else ""
        moe = data["m"][logrec][idx] if logrec in data["m"] else ""
        result[v] = (est, moe)
    return result


# ---------------------------------------------------------------------------
def clean(val, var=None):
    if val is None:
        return ""
    s = str(val).strip()
    if s in SENTINELS:
        return ""
    # B25035 (median year built) is bottom-coded: the Census reports "1939-"
    # (or 0 in the 2018-2021 releases) when the median is 1939 or earlier.
    if var == "B25035_001" and s in ("1939-", "0"):
        return "1939"
    return s


def fnum(s):
    try:
        return float(s)
    except (TypeError, ValueError):
        return None


def main():
    if API_KEY:
        print("Using the Census Data API with CENSUS_API_KEY for all vintages")
    else:
        print("CENSUS_API_KEY not set: using data.census.gov (2010-2024) and the 2009 Summary File on the Census FTP")

    out_rows = []
    for vintage in VINTAGES:
        period = f"{vintage - 4}-{vintage}"
        if API_KEY:
            fetcher, source = fetch_api, "api.census.gov"
        elif vintage >= 2010:
            fetcher, source = fetch_datacensus, "data.census.gov"
        else:
            fetcher, source = fetch_ftp2009, "www2.census.gov summary file"
        print(f"vintage {vintage} ({period}) via {source}")
        pre1940 = pre1940_variable(vintage)
        edu_table, edu_total, edu_parts = bachelors_components(vintage)

        for geo in GEOS:
            gname, geoid = geo[0], geo[1]
            values = {}
            print(f"  {gname}", file=sys.stderr, flush=True)
            for table, var_ids in wanted_variables(vintage):
                try:
                    values.update(fetcher(vintage, table, var_ids, geo))
                except Exception as e:
                    print(f"  ERROR {vintage} {table} {gname}: {e}", file=sys.stderr)
                time.sleep(0.15)

            for var, (est, moe) in sorted(values.items()):
                table = var.split("_")[0]
                labels = table_labels(vintage, table)
                out_rows.append({
                    "geography": gname, "geoid": geoid, "vintage": vintage, "period": period,
                    "table": table, "variable": var, "label": labels.get(var, ""),
                    "estimate": clean(est, var), "margin_of_error": clean(moe), "source": source,
                })

            # Derived: bachelor's degree or higher, population 25+
            parts = [values.get(p, ("", "")) for p in edu_parts]
            ests = [fnum(clean(p[0])) for p in parts]
            moes = [fnum(clean(p[1])) for p in parts]
            if all(e is not None for e in ests):
                est_sum = sum(ests)
                moe_sum = math.sqrt(sum(m * m for m in moes)) if all(m is not None for m in moes) else ""
                out_rows.append({
                    "geography": gname, "geoid": geoid, "vintage": vintage, "period": period,
                    "table": edu_table, "variable": "DERIVED_BACHELORS_OR_HIGHER_25PLUS",
                    "label": f"Population 25 years and over with a bachelor's degree or higher (sum of {', '.join(edu_parts)})",
                    "estimate": int(est_sum), "margin_of_error": round(moe_sum, 1) if moe_sum != "" else "",
                    "source": source,
                })
            # Derived: pre-1940 housing units (alias so users need not track the column shift)
            if pre1940 in values:
                out_rows.append({
                    "geography": gname, "geoid": geoid, "vintage": vintage, "period": period,
                    "table": "B25034", "variable": "DERIVED_UNITS_BUILT_1939_OR_EARLIER",
                    "label": f"Housing units built 1939 or earlier (copy of {pre1940})",
                    "estimate": clean(values[pre1940][0]), "margin_of_error": clean(values[pre1940][1]),
                    "source": source,
                })

    fields = ["geography", "geoid", "vintage", "period", "table", "variable", "label",
              "estimate", "margin_of_error", "source"]
    with open(OUT_PATH, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=fields)
        w.writeheader()
        w.writerows(out_rows)
    print(f"wrote {len(out_rows)} rows to {OUT_PATH}")


if __name__ == "__main__":
    main()
