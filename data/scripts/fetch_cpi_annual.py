#!/usr/bin/env python3
"""
Build data/cpi-annual.csv: annual average CPI-U (all items, U.S. city average,
seasonally adjusted, 1982-84=100) with a multiplier to restate each year's
dollars in the latest complete year's dollars.

Source: Federal Reserve Bank of St. Louis, FRED series CPIAUCSL
    https://fred.stlouisfed.org/series/CPIAUCSL
    CSV endpoint (annual average aggregation):
    https://fred.stlouisfed.org/graph/fredgraph.csv?id=CPIAUCSL&fq=Annual&fam=avg
    Fallback (monthly, averaged here):
    https://fred.stlouisfed.org/graph/fredgraph.csv?id=CPIAUCSL

Usage:
    python3 data/scripts/fetch_cpi_annual.py [--out data/cpi-annual.csv]

Requires only the Python 3 standard library.

Columns written:
    year                      calendar year (2000 through the latest complete year)
    cpi_u_annual_avg          annual average of the 12 monthly CPI-U index values
    to_latest_year_dollars    multiplier: latest_year_cpi / this_year_cpi. Multiply a
                              dollar amount from `year` by this to express it in
                              the latest complete year's dollars.
    latest_year               the base year the multiplier converts to (same on every row)

A year is "complete" only when FRED reports a non-blank annual value; FRED
leaves the current in-progress year blank in the annual-average view.
"""
import argparse
import csv
import io
import sys
import urllib.request
from collections import defaultdict

FRED_ANNUAL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=CPIAUCSL&fq=Annual&fam=avg"
FRED_MONTHLY = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=CPIAUCSL"
FIRST_YEAR = 2000


def fetch_csv(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        text = resp.read().decode("utf-8-sig")
    rows = list(csv.DictReader(io.StringIO(text)))
    if not rows or "CPIAUCSL" not in rows[0]:
        raise RuntimeError("Unexpected FRED CSV layout from %s" % url)
    return rows


def annual_from_fred_annual(rows):
    """FRED annual-average view: one row per year, blank value for incomplete year."""
    out = {}
    for r in rows:
        year = int(r["observation_date"][:4])
        val = r["CPIAUCSL"].strip()
        if val and val != ".":
            out[year] = float(val)
    return out


def annual_from_monthly(rows):
    """Average the 12 monthly values; only keep years with all 12 months."""
    by_year = defaultdict(list)
    for r in rows:
        val = r["CPIAUCSL"].strip()
        if val and val != ".":
            by_year[int(r["observation_date"][:4])].append(float(val))
    return {y: sum(v) / 12.0 for y, v in by_year.items() if len(v) == 12}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="data/cpi-annual.csv")
    args = ap.parse_args()

    try:
        annual = annual_from_fred_annual(fetch_csv(FRED_ANNUAL))
        source_used = FRED_ANNUAL
    except Exception as exc:  # network hiccup or layout change: fall back to monthly
        print("Annual endpoint failed (%s); averaging monthly series instead" % exc, file=sys.stderr)
        annual = annual_from_monthly(fetch_csv(FRED_MONTHLY))
        source_used = FRED_MONTHLY

    years = sorted(y for y in annual if y >= FIRST_YEAR)
    latest = years[-1]
    base = annual[latest]

    with open(args.out, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["year", "cpi_u_annual_avg", "to_latest_year_dollars", "latest_year"])
        for y in years:
            w.writerow([y, "%.3f" % annual[y], "%.6f" % (base / annual[y]), latest])

    print("Source: %s" % source_used)
    print("Wrote %d rows (%d-%d) to %s; base year %d = %.3f" % (len(years), years[0], latest, args.out, latest, base))


if __name__ == "__main__":
    main()
