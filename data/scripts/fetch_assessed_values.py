#!/usr/bin/env python3
"""
Build data/assessed-values-oak-park.csv: one row per parcel (PIN) per assessment
year for every parcel in Oak Park Township (township code 27, which is
coterminous with the Village of Oak Park), with assessed values joined to
building characteristics and the property address.

Sources (Cook County Assessor, Cook County Open Data Portal, Socrata API):
    Assessed Values
        https://datacatalog.cookcountyil.gov/Property-Taxation/Assessor-Assessed-Values/uzyt-m557
        API: https://datacatalog.cookcountyil.gov/resource/uzyt-m557.json
    Residential Improvement Characteristics
        https://datacatalog.cookcountyil.gov/Property-Taxation/Assessor-Single-and-Multi-Family-Improvement-Chara/x54s-btds
        API: https://datacatalog.cookcountyil.gov/resource/x54s-btds.json
    Residential Condominium Unit Characteristics
        https://datacatalog.cookcountyil.gov/Property-Taxation/Assessor-Residential-Condominium-Unit-Characteristics/3r7i-mrz4
        API: https://datacatalog.cookcountyil.gov/resource/3r7i-mrz4.json
    Parcel Addresses
        https://datacatalog.cookcountyil.gov/Property-Taxation/Assessor-Parcel-Addresses/3723-97qp
        API: https://datacatalog.cookcountyil.gov/resource/3723-97qp.json

Usage:
    python3 data/scripts/fetch_assessed_values.py [--years 2025 2026] [--out data/assessed-values-oak-park.csv]

Requires only the Python 3 standard library (urllib). No app token is needed;
the portal rate-limits anonymous use, so the script pages politely and retries.

Method notes:
  * SoQL `$where` clauses against these datasets frequently time out, so the
    script uses only simple equality filters (township_name / township_code /
    prop_address_city_name plus year) with `$limit`/`$offset` paging ordered by
    a stable key.
  * The `year` column is typed inconsistently across vintages ("2025" in one,
    "2026.0" in another). The script requests `year=<N>`, which the portal
    matches against both spellings; if a year returns nothing it retries with
    `year=<N>.0`.
  * The improvement characteristics dataset covers residential classes (2xx)
    other than condominiums and has one row per building "card" (a PIN with two
    houses has two cards). Cards are aggregated to one row per PIN: building
    square feet, beds and baths are summed; year built is the oldest card; land
    square feet is taken once. sqft_source = "improvement".
  * Condominium units (class 299) come from the condominium characteristics
    dataset: building_sqft is the unit's square feet (char_unit_sf), and the
    whole building's square feet and the unit's percent of ownership are kept
    in condo_building_sqft / condo_pct_ownership. sqft_source = "condo_unit".
    Unit square feet is blank for most condo units in the source, so
    condo_est_unit_sqft = condo_building_sqft * condo_pct_ownership is also
    provided as a rough estimate (typically within 10 to 20 percent of the
    recorded unit size where both are known).
    Parking spaces and common-area PINs are flagged in is_parking_or_common.
  * Vacant land (201, 241), minor improvements (290) and non-residential
    classes have no characteristics row, so their sqft columns are blank.
  * Property address comes from the Parcel Addresses vintage for the same year,
    falling back to the newest other vintage fetched. Owner and mailing names
    are deliberately not carried into the output.
"""
import argparse
import csv
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

PORTAL = "https://datacatalog.cookcountyil.gov/resource/"
ASSESSED_VALUES = PORTAL + "uzyt-m557.json"
CHARACTERISTICS = PORTAL + "x54s-btds.json"
CONDO_CHARACTERISTICS = PORTAL + "3r7i-mrz4.json"
PARCEL_ADDRESSES = PORTAL + "3723-97qp.json"
PAGE = 5000

OUT_COLUMNS = [
    "pin", "year", "class", "township_code", "township_name", "nbhd",
    "mailed_bldg", "mailed_land", "mailed_tot",
    "certified_bldg", "certified_land", "certified_tot",
    "board_bldg", "board_land", "board_tot",
    "building_sqft", "land_sqft", "year_built", "units", "beds", "full_baths", "half_baths",
    "cards", "residential_type", "sqft_source",
    "condo_building_sqft", "condo_pct_ownership", "condo_est_unit_sqft", "is_parking_or_common",
    "prop_address", "prop_city", "prop_zip", "address_year",
]

APTS_TO_UNITS = {"None": 1, "One": 1, "Two": 2, "Three": 3, "Four": 4, "Five": 5, "Six": 6}


def get_json(url, params, attempts=6):
    """GET a Socrata resource with simple filters; retry on timeouts/5xx/429."""
    full = url + "?" + urllib.parse.urlencode(params)
    delay = 5
    for attempt in range(1, attempts + 1):
        try:
            req = urllib.request.Request(full, headers={"User-Agent": "Mozilla/5.0 (Oak Park Day in Our Data)"})
            with urllib.request.urlopen(req, timeout=180) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, ConnectionError) as exc:
            code = getattr(exc, "code", None)
            if code is not None and code < 500 and code != 429:
                raise
            if attempt == attempts:
                raise
            print("  retry %d/%d after error: %s" % (attempt, attempts, exc), file=sys.stderr)
            time.sleep(delay)
            delay = min(delay * 2, 60)


def fetch_all(url, filters, order, label):
    """Page through every row matching the simple filters."""
    rows = []
    offset = 0
    while True:
        params = dict(filters)
        params.update({"$limit": PAGE, "$offset": offset, "$order": order})
        t0 = time.time()
        batch = get_json(url, params)
        rows.extend(batch)
        print("  %s: offset %d -> %d rows (%.1fs)" % (label, offset, len(batch), time.time() - t0), file=sys.stderr)
        if len(batch) < PAGE:
            break
        offset += PAGE
    return rows


def fetch_year(url, base_filters, year, order, label):
    """Try year=N, then year=N.0 (the portal types `year` differently by vintage)."""
    for spelling in (str(year), "%d.0" % year):
        filters = dict(base_filters)
        filters["year"] = spelling
        rows = fetch_all(url, filters, order, "%s %s" % (label, spelling))
        if rows:
            return rows
    return []


def num(value):
    """'36125.0' -> '36125'; '' or None -> ''. Non-integral values are kept as-is."""
    if value in (None, ""):
        return ""
    try:
        f = float(value)
    except ValueError:
        return value
    return str(int(f)) if f == int(f) else str(f)


def aggregate_characteristics(rows):
    """One record per PIN from per-card rows."""
    by_pin = {}
    for r in rows:
        pin = r["pin"]
        rec = by_pin.setdefault(pin, {
            "building_sqft": 0, "land_sqft": "", "year_built": None, "units": 0,
            "beds": 0, "full_baths": 0, "half_baths": 0, "cards": 0, "residential_type": "",
            "sqft_source": "improvement", "condo_building_sqft": "", "condo_pct_ownership": "",
            "condo_est_unit_sqft": "", "is_parking_or_common": "",
        })
        rec["cards"] += 1
        rec["building_sqft"] += int(float(r.get("char_bldg_sf") or 0))
        if not rec["land_sqft"]:
            rec["land_sqft"] = num(r.get("char_land_sf"))
        yb = r.get("char_yrblt")
        if yb:
            yb = int(float(yb))
            rec["year_built"] = yb if rec["year_built"] is None else min(rec["year_built"], yb)
        rec["units"] += APTS_TO_UNITS.get(r.get("char_apts", ""), 1 if r.get("char_apts") in (None, "") else 0)
        rec["beds"] += int(float(r.get("char_beds") or 0))
        rec["full_baths"] += int(float(r.get("char_fbath") or 0))
        rec["half_baths"] += int(float(r.get("char_hbath") or 0))
        if not rec["residential_type"]:
            rec["residential_type"] = r.get("char_type_resd", "")
    for rec in by_pin.values():
        rec["year_built"] = rec["year_built"] if rec["year_built"] is not None else ""
    return by_pin


def condo_characteristics(rows):
    """One record per condominium unit PIN."""
    by_pin = {}
    for r in rows:
        try:
            est = str(int(round(float(r["char_building_sf"]) * float(r["tieback_proration_rate"]))))
        except (KeyError, ValueError, TypeError):
            est = ""
        by_pin[r["pin"]] = {
            "building_sqft": num(r.get("char_unit_sf")), "land_sqft": num(r.get("char_land_sf")),
            "year_built": num(r.get("char_yrblt")), "units": 1,
            "beds": num(r.get("char_bedrooms")), "full_baths": num(r.get("char_full_baths")),
            "half_baths": num(r.get("char_half_baths")), "cards": 1, "residential_type": "Condominium",
            "sqft_source": "condo_unit", "condo_building_sqft": num(r.get("char_building_sf")),
            "condo_pct_ownership": r.get("tieback_proration_rate", ""),
            "condo_est_unit_sqft": est if est not in ("0",) else "",
            "is_parking_or_common": "1" if (r.get("is_parking_space") or r.get("is_common_area")) else "0",
        }
    return by_pin


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--years", type=int, nargs="+", default=[2025, 2026])
    ap.add_argument("--out", default="data/assessed-values-oak-park.csv")
    args = ap.parse_args()

    # Addresses: fetch each requested year's vintage once; fall back across years.
    addresses_by_year = {}
    for year in args.years:
        print("Parcel addresses %d" % year, file=sys.stderr)
        rows = fetch_year(PARCEL_ADDRESSES, {"prop_address_city_name": "OAK PARK"}, year, "pin", "addresses")
        addresses_by_year[year] = {r["pin"]: r for r in rows}

    def lookup_address(pin, year):
        for y in [year] + sorted(addresses_by_year, reverse=True):
            r = addresses_by_year.get(y, {}).get(pin)
            if r:
                return r, y
        return None, ""

    out_rows = []
    for year in args.years:
        print("Assessed values %d" % year, file=sys.stderr)
        values = fetch_year(ASSESSED_VALUES, {"township_name": "Oak Park"}, year, "pin", "assessed values")
        print("Characteristics %d" % year, file=sys.stderr)
        chars = aggregate_characteristics(
            fetch_year(CHARACTERISTICS, {"township_code": "27"}, year, "pin,card", "characteristics"))
        print("Condominium characteristics %d" % year, file=sys.stderr)
        for pin, rec in condo_characteristics(
                fetch_year(CONDO_CHARACTERISTICS, {"township_code": "27"}, year, "pin", "condos")).items():
            chars.setdefault(pin, rec)
        matched = 0
        for v in values:
            pin = v["pin"]
            c = chars.get(pin, {})
            if c:
                matched += 1
            addr, addr_year = lookup_address(pin, year)
            row = {
                "pin": pin, "year": year, "class": v.get("class", ""),
                "township_code": v.get("township_code", ""), "township_name": v.get("township_name", ""),
                "nbhd": v.get("nbhd", ""),
            }
            for col in ("mailed_bldg", "mailed_land", "mailed_tot", "certified_bldg", "certified_land",
                        "certified_tot", "board_bldg", "board_land", "board_tot"):
                row[col] = num(v.get(col))
            for col in ("building_sqft", "land_sqft", "year_built", "units", "beds", "full_baths",
                        "half_baths", "cards", "residential_type", "sqft_source",
                        "condo_building_sqft", "condo_pct_ownership", "condo_est_unit_sqft",
                        "is_parking_or_common"):
                row[col] = c.get(col, "")
            row["prop_address"] = addr.get("prop_address_full", "") if addr else ""
            row["prop_city"] = addr.get("prop_address_city_name", "") if addr else ""
            row["prop_zip"] = addr.get("prop_address_zipcode_1", "") if addr else ""
            row["address_year"] = num(addr_year) if addr else ""
            out_rows.append(row)
        print("%d: %d parcels, %d with characteristics, %d with address" % (
            year, len(values), matched, sum(1 for r in out_rows if r["year"] == year and r["prop_address"])),
            file=sys.stderr)

    out_rows.sort(key=lambda r: (r["year"], r["pin"]))
    with open(args.out, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=OUT_COLUMNS)
        w.writeheader()
        w.writerows(out_rows)
    print("Wrote %d rows to %s" % (len(out_rows), args.out), file=sys.stderr)


if __name__ == "__main__":
    main()
