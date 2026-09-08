#!/usr/bin/env python3
"""Build data/schools-oak-park.csv: every K-12 school located in Oak Park, IL.

Sources
  1. Illinois State Board of Education (ISBE), Directory of Educational Entities 2025-26
     (Excel workbook; sheets "1 Public Dist & Sch" and "5 Non Pub Sch"), linked from
     https://www.isbe.net/Pages/Data-Analysis-Directories.aspx and downloaded from
     https://www.isbe.net/Documents/2025-26-Directory-Ed-Entities.xlsx
     Provides school name, district, grades served, address, and affiliation. Filter:
     City == "Oak Park" and RecType in ("Sch", "Non Pub Sch").
  2. Village of Oak Park GIS, "Elementary_and_Middle_Schools" building footprints
     https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/Elementary_and_Middle_Schools/FeatureServer/0
     Polygon centroids give the coordinates for the ten District 97 schools.
  3. Cook County Address Points (Socrata dataset 78yw-iddh)
     https://datacatalog.cookcountyil.gov/resource/78yw-iddh.json
     Used to geocode the street address of every non-D97 school (and to cross-check D97).

Python 3 standard library only (the .xlsx is read with zipfile + xml). Usage:
    python3 data/scripts/fetch_schools_oak_park.py
"""
import csv
import json
import re
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from io import BytesIO
from pathlib import Path

ISBE_PAGE = "https://www.isbe.net/Pages/Data-Analysis-Directories.aspx"
ISBE_XLSX = "https://www.isbe.net/Documents/2025-26-Directory-Ed-Entities.xlsx"
D97_FOOTPRINTS = ("https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/"
                  "Elementary_and_Middle_Schools/FeatureServer/0/query?"
                  "where=1%3D1&outFields=*&outSR=4326&f=geojson")
COOK_ADDR = "https://datacatalog.cookcountyil.gov/resource/78yw-iddh.json"
OUT = Path(__file__).resolve().parents[1] / "schools-oak-park.csv"
# isbe.net rejects requests without a browser-like User-Agent.
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120 Safari/537.36 oak-park-day-in-our-data/1.0")
M = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"

COLUMNS = ["name", "type", "district", "affiliation", "grades_served", "address", "city",
           "zip", "latitude", "longitude", "geocode_method", "isbe_rcdts", "nces_id",
           "website", "source", "notes"]


def fetch(url, tries=4):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                return r.read()
        except Exception as e:  # noqa: BLE001
            if attempt == tries - 1:
                raise
            print(f"  retry {attempt + 1} after error: {e}", file=sys.stderr)
            time.sleep(3 * (attempt + 1))


# ---------- ISBE workbook (stdlib xlsx reader) ----------
def col_idx(ref):
    n = 0
    for ch in re.match(r"[A-Z]+", ref).group(0):
        n = n * 26 + ord(ch) - 64
    return n - 1


def read_workbook(data):
    z = zipfile.ZipFile(BytesIO(data))
    shared = ["".join(t.text or "" for t in si.iter(M + "t"))
              for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall(M + "si")]
    rels = {r.get("Id"): r.get("Target")
            for r in ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))}
    sheets = {s.get("name"): rels[s.get(R + "id")]
              for s in ET.fromstring(z.read("xl/workbook.xml")).find(M + "sheets")}

    def rows_of(target):
        path = target[1:] if target.startswith("/") else "xl/" + target
        out = []
        for row in ET.fromstring(z.read(path)).iter(M + "row"):
            cells = {}
            for c in row.findall(M + "c"):
                v = c.find(M + "v")
                if v is None:
                    isv = c.find(M + "is")
                    val = "".join(x.text or "" for x in isv.iter(M + "t")) if isv is not None else ""
                elif c.get("t") == "s":
                    val = shared[int(v.text)]
                else:
                    val = v.text
                cells[col_idx(c.get("r"))] = val
            if cells:
                out.append([cells.get(i, "") for i in range(max(cells) + 1)])
        return out

    def as_dicts(name):
        rows = rows_of(sheets[name])
        hdr = [str(h).strip() for h in rows[0]]
        return [dict(zip(hdr, r)) for r in rows[1:]]

    return as_dicts("1 Public Dist & Sch"), as_dicts("5 Non Pub Sch")


def clean_name(n):
    n = re.sub(r"\bElem\b", "Elementary", n)
    n = re.sub(r"\bSch\b", "School", n)
    n = re.sub(r"\bOliver W\b", "Oliver Wendell", n)
    return n.replace("&", "and").strip()


# ---------- geometry ----------
def centroid(geom):
    polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
    A = Cx = Cy = 0.0
    for poly in polys:
        ring = poly[0]
        for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]):
            c = x1 * y2 - x2 * y1
            A += c
            Cx += (x1 + x2) * c
            Cy += (y1 + y2) * c
    A /= 2.0
    return round(Cy / (6 * A), 6), round(Cx / (6 * A), 6)  # lat, lon


def geocode_cook(address):
    """Look an Oak Park street address up in Cook County Address Points."""
    parts = address.split()
    number = parts[0]
    rest = [p for p in parts[1:]]
    # strip suite / unit suffixes
    for i, p in enumerate(rest):
        if p.lower() in ("ste", "suite", "unit", "apt", "#"):
            rest = rest[:i]
            break
    predir = None
    if rest and rest[0].upper() in ("N", "S", "E", "W"):
        predir = rest[0].upper()
        rest = rest[1:]
    st_type = rest[-1].upper() if len(rest) > 1 else None
    st_name = " ".join(rest[:-1] if len(rest) > 1 else rest).upper()
    where = f"post_comm='OAK PARK' AND add_number='{number}' AND upper(st_name)='{st_name}'"
    if predir:
        where += f" AND lst_predir='{predir}'"
    url = COOK_ADDR + "?" + urllib.parse.urlencode({"$where": where, "$limit": 50})
    hits = json.loads(fetch(url))
    if st_type:
        typed = [h for h in hits if (h.get("lst_type") or "").upper() == st_type]
        hits = typed or hits
    if not hits:
        return None
    lat = sum(float(h["lat"]) for h in hits) / len(hits)
    lon = sum(float(h["long"]) for h in hits) / len(hits)
    return round(lat, 6), round(lon, 6), len(hits)


def dist_m(a, b):
    import math
    dlat = (a[0] - b[0]) * 111_320
    dlon = (a[1] - b[1]) * 111_320 * math.cos(math.radians(a[0]))
    return math.hypot(dlat, dlon)


def main():
    print("downloading ISBE directory ...")
    public, nonpub = read_workbook(fetch(ISBE_XLSX))
    public = [r for r in public if r["City"].strip() == "Oak Park" and r["RecType"] == "Sch"]
    nonpub = [r for r in nonpub if r["City"].strip() == "Oak Park" and r["RecType"] == "Non Pub Sch"]
    print(f"ISBE Oak Park: {len(public)} public schools, {len(nonpub)} nonpublic schools")

    print("downloading D97 footprints ...")
    fp = json.loads(fetch(D97_FOOTPRINTS))["features"]
    cents = {}
    for f in fp:
        key = f["properties"]["NAME"]
        cents[key] = centroid(f["geometry"])
    print(f"D97 footprints: {len(fp)}")

    def match_footprint(isbe_name):
        for key in cents:
            for tok in ("Beye", "Hatch", "Holmes", "Irving", "Lincoln", "Longfellow",
                        "Mann", "Whittier", "Brooks", "Julian"):
                if tok in isbe_name and tok in key:
                    return key
        return None

    rows = []
    for r in public:
        rcdts = r["Region-2\nCounty-3\nDistrict-4"] + r["School"]
        grades = r["GradeServed"]
        if r["Region-2\nCounty-3\nDistrict-4"] == "060160970":
            district = "D97"
            typ = "public middle" if grades.endswith("8") else "public elementary"
        elif r["Region-2\nCounty-3\nDistrict-4"] == "060162000":
            district, typ = "D200", "public high"
        else:
            district, typ = r["FacilityName"], "public"
        row = {
            "name": clean_name(r["FacilityName"]), "type": typ, "district": district,
            "affiliation": "", "grades_served": grades, "address": r["Mailing Address"],
            "city": "Oak Park", "zip": r["Zip"].split()[0], "isbe_rcdts": rcdts,
            "nces_id": r["NCES ID"], "website": r["Website"], "notes": "",
        }
        key = match_footprint(r["FacilityName"]) if district == "D97" else None
        cook = geocode_cook(r["Mailing Address"])
        time.sleep(0.3)
        if key:
            row["latitude"], row["longitude"] = cents[key]
            row["geocode_method"] = "centroid of Village of Oak Park school footprint polygon"
            row["source"] = f"ISBE directory {ISBE_XLSX}; Village of Oak Park GIS {D97_FOOTPRINTS.split('/query')[0]}"
            if cook:
                d = dist_m(cents[key], cook[:2])
                print(f"  {row['name']}: footprint centroid vs Cook County address point = {d:.0f} m")
                if d > 250:
                    row["notes"] = f"footprint centroid is {d:.0f} m from the address point"
            else:
                print(f"  {row['name']}: address not found in Cook County Address Points")
        elif cook:
            row["latitude"], row["longitude"] = cook[:2]
            row["geocode_method"] = "Cook County Address Points"
            row["source"] = f"ISBE directory {ISBE_XLSX}; Cook County Address Points {COOK_ADDR}"
        else:
            row["latitude"] = row["longitude"] = ""
            row["geocode_method"] = ""
            row["source"] = f"ISBE directory {ISBE_XLSX}"
            row["notes"] = "address not found in Cook County Address Points; not geocoded"
        rows.append(row)

    for r in nonpub:
        grades = r["GradeServed"]
        row = {
            "name": clean_name(r["FacilityName"]), "type": "private",
            "district": r["Affiliation"], "affiliation": r["Affiliation"],
            "grades_served": grades, "address": r["Mailing Address"], "city": "Oak Park",
            "zip": r["Zip"].split()[0], "isbe_rcdts": r["Region-2\nCounty-3\nDistrict-4"],
            "nces_id": "", "website": r["Website"], "notes": "",
        }
        cook = geocode_cook(r["Mailing Address"])
        time.sleep(0.3)
        if cook:
            row["latitude"], row["longitude"] = cook[:2]
            row["geocode_method"] = "Cook County Address Points"
            row["source"] = f"ISBE directory {ISBE_XLSX}; Cook County Address Points {COOK_ADDR}"
        else:
            row["latitude"] = row["longitude"] = ""
            row["geocode_method"] = ""
            row["source"] = f"ISBE directory {ISBE_XLSX}"
            row["notes"] = "address not found in Cook County Address Points; not geocoded"
            print(f"  {row['name']}: NOT geocoded ({r['Mailing Address']})")
        if grades in ("P,K", "P-K", "K"):
            row["notes"] = (row["notes"] + "; " if row["notes"] else "") + \
                "ISBE lists preschool and kindergarten only"
        if "ALF" in r["FacilityName"]:
            row["notes"] = (row["notes"] + "; " if row["notes"] else "") + \
                "ISBE-registered alternative learning facility in an office building, not a conventional campus"
        rows.append(row)

    order = {"public elementary": 0, "public middle": 1, "public high": 2, "private": 3}
    rows.sort(key=lambda r: (order.get(r["type"], 9), r["name"]))
    with OUT.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=COLUMNS)
        w.writeheader()
        w.writerows(rows)
    print(f"wrote {OUT} rows={len(rows)}")
    for r in rows:
        print(f"  {r['type']:18} {r['name']:45} {r['grades_served']:5} {r['address']:28} {r['latitude']} {r['longitude']}")


if __name__ == "__main__":
    main()
