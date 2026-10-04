#!/usr/bin/env python3
"""
Build public/data/districts.json and public/data/schools.json from the ISBE
Illinois Report Card public data sets (2018-2025).

Adapted from the parent repo's data/scripts/fetch_report_card_d97_d200.py
(oak-park-cisc/Oak_Park_Day_in_our_Data), extended to every Illinois district
plus race/ethnicity, funding, staffing and student-group proficiency columns.

Source: https://www.isbe.net/Pages/Illinois-State-Report-Card-Data.aspx
Workbooks are read from data/raw/ (git-ignored); missing ones are downloaded
from https://www.isbe.net/Documents/<file>.

Requirements: pandas, python-calamine, requests (or curl on PATH).
Usage: python3 scripts/build_report_card_data.py
"""

import json
import math
import os
import re
import subprocess
import sys

import pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "raw")
OUT = os.path.join(ROOT, "public", "data")
BASE = "https://www.isbe.net/Documents/"

FILES = {
    2018: "Report-Card-Public-Data-Set.xlsx",
    2019: "2019-Report-Card-Public-Data-Set.xlsx",
    2020: "2020-Report-Card-Public-Data-Set.xlsx",
    2021: "2021-RC-Pub-Data-Set.xlsx",
    2022: "2022-Report-Card-Public-Data-Set.xlsx",
    2023: "23-RC-Pub-Data-Set.xlsx",
    2024: "24-RC-Pub-Data-Set.xlsx",
    2025: "2025-Report-Card-Public-Data-Set.xlsx",
}
YEARS = sorted(FILES)

# School rows are kept only for D97 and D200 (first 11 RCDTS characters).
SCHOOL_PREFIXES = ("06016097002", "06016200013")


def pct_pair(label):
    """Header variants for a percentage: '% <label>' (2019+) and '<label> %' (2018)."""
    return [f"% {label}", f"{label} %"]


# Output key -> candidate normalized headers in priority order.
INDICATORS = {
    "enrollment": ["# student enrollment", "student enrollment - total"],
    "pct_white": pct_pair("student enrollment - white"),
    "pct_black": pct_pair("student enrollment - black or african american"),
    "pct_hispanic": pct_pair("student enrollment - hispanic or latino"),
    "pct_asian": pct_pair("student enrollment - asian"),
    "pct_multiracial": pct_pair("student enrollment - two or more races"),
    "pct_low_income": pct_pair("student enrollment - low income"),
    "pct_el": pct_pair("student enrollment - el"),
    "pct_iep": pct_pair("student enrollment - iep"),
    "pct_homeless": pct_pair("student enrollment - homeless"),
    "attendance_rate": ["student attendance rate"],
    "chronic_absenteeism": ["chronic absenteeism"],
    "mobility_rate": ["student mobility rate"],
    "avg_class_size": ["avg class size - all grades"],
    "pupil_teacher_elem": ["pupil teacher ratio - elementary"],
    "pupil_teacher_hs": ["pupil teacher ratio - high school"],
    "teacher_fte": ["total teacher fte"],
    "teacher_salary": ["teacher avg salary"],
    "admin_salary": ["admin avg salary"],
    "teacher_retention": ["teacher retention rate"],
    "pct_teachers_white": ["% teachers - white"],
    "operating_per_pupil": ["$ operating expenditures", "operating expenditures"],
    "instructional_per_pupil": ["$ instructional expenditure per pupil", "instructional expenditure per pupil"],
    "pct_local_property_tax": ["% local property taxes", "local property taxes - percent"],
    "pct_state_funding": ["% other state funding", "other state funding - percent"],
    "pct_federal_funding": ["% federal funding", "federal funding - percent"],
    "ebf_tier": ["ebf tier"],
    "tax_rate": ["$ total school tax rate per $100", "total school tax rate per $100"],
    "eav_per_pupil": ["$ eav per pupil", "eav per pupil"],
    "local_property_tax_dollars": ["$ local property taxes", "local property taxes - dollars"],
    "ebf_capacity": ["% ebf capacity to meet expectations", "ebf capacity to meet expectations"],
    "ela_prof": ["% ela proficiency", "ela proficiency total %"],
    "math_prof": ["% math proficiency", "math proficiency total %"],
    "science_prof": ["% science proficiency", "isa proficiency total %", "% isa proficiency"],
    "ela_prof_white": pct_pair("ela proficiency - white") + ["ela proficiency white %"],
    "ela_prof_black": pct_pair("ela proficiency - black or african american") + ["ela proficiency black or african american %"],
    "ela_prof_hispanic": pct_pair("ela proficiency - hispanic or latino") + ["ela proficiency hispanic or latino %"],
    "ela_prof_low_income": pct_pair("ela proficiency - low income") + ["ela proficiency low income %"],
    "math_prof_white": pct_pair("math proficiency - white") + ["math proficiency white %"],
    "math_prof_black": pct_pair("math proficiency - black or african american") + ["math proficiency black or african american %"],
    "math_prof_hispanic": pct_pair("math proficiency - hispanic or latino") + ["math proficiency hispanic or latino %"],
    "math_prof_low_income": pct_pair("math proficiency - low income") + ["math proficiency low income %"],
    "grad_rate_4yr": ["high school 4-year graduation rate - total"],
    "dropout_rate": ["high school dropout rate - total"],
    "ninth_on_track": ["% 9th grade on track", "9th grade on track"],
}
WHOLE_DOLLARS = ("operating_per_pupil", "instructional_per_pupil", "teacher_salary", "admin_salary",
                 "eav_per_pupil", "local_tax_per_pupil")
OMIT = ("ebf_tier", "local_property_tax_dollars")
SHEET_PREFIXES = ("General", "Finance", "Financial", "ELA Math Science", "ELAMathScience", "ELA and Math", "ISA")
TEXT_FIELDS = ("summative_designation",)
INDICATORS["summative_designation"] = ["summative designation"]


def sheet_rank(name):
    for i, p in enumerate(SHEET_PREFIXES):
        if name.startswith(p):
            return i
    return None


def norm(name):
    s = str(name).replace("–", "-").replace("—", "-").lower()
    s = re.sub(r"\s+", " ", s).strip()
    s = re.sub(r" (19|20)\d\d-\d\d", "", s)  # drop ' 2016-17' style school-year tags
    return s


def download(fname):
    os.makedirs(RAW, exist_ok=True)
    path = os.path.join(RAW, fname)
    if not (os.path.exists(path) and os.path.getsize(path) > 100000):
        print(f"downloading {fname} ...", file=sys.stderr)
        subprocess.run(["curl", "-sSfL", "-A", "Mozilla/5.0", "-o", path, BASE + fname], check=True)
    return path


def classify(rcdts, typ, district):
    rcdts = str(rcdts or "").strip().replace("-", "")
    typ = str(typ or "").strip().lower()
    if typ.startswith("state") or district in ("Statewide", "State") or rcdts.startswith("65000") or (
            not rcdts and typ not in ("school", "district")):
        return "STATE", "state"
    if not typ:
        typ = "district" if rcdts.endswith("0000") else "school"
    return rcdts, typ


def to_num(v):
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return None if (isinstance(v, float) and math.isnan(v)) else float(v)
    s = str(v).strip().replace(",", "").replace("$", "").replace("%", "")
    try:
        return float(s)
    except ValueError:
        return None


def place(v):
    s = clean_str(v).title()
    s = re.sub(r"\bMc(\w)", lambda m: "Mc" + m.group(1).upper(), s)
    return s.replace("Dupage", "DuPage").replace("Dekalb", "DeKalb").replace("Lasalle", "LaSalle")


def type_label(t):
    t = str(t or "").upper()
    for key, label in (("ELEM", "elementary"), ("HIGH", "high"), ("UNIT", "unit")):
        if key in t:
            return label
    return ""


def clean_str(v):
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return ""
    return str(v).strip()


def extract_year(year, path):
    xl = pd.ExcelFile(path, engine="calamine")
    entities, matched = {}, {}
    for sheet in sorted([n for n in xl.sheet_names if sheet_rank(n) is not None], key=lambda n: (sheet_rank(n), n)):
        df = xl.parse(sheet, dtype=object)
        df.columns = [norm(c) for c in df.columns]
        df = df.loc[:, ~pd.Index(df.columns).duplicated()]
        if "rcdts" not in df.columns:
            continue
        colmap = {}
        for key, cands in INDICATORS.items():
            if key in matched:
                continue
            for c in cands:
                if c in df.columns:
                    colmap[key] = c
                    matched[key] = f"{sheet}: {c}"
                    break
        typecol = "type" if "type" in df.columns else ("level" if "level" in df.columns else None)
        for rec in df.to_dict("records"):
            rcdts, level = classify(rec.get("rcdts"), rec.get(typecol) if typecol else "", rec.get("district"))
            if level == "school" and not rcdts.startswith(SCHOOL_PREFIXES):
                continue
            if level not in ("state", "district", "school"):
                continue
            ent = entities.get(rcdts)
            if ent is None:
                ent = entities[rcdts] = {
                    "level": level,
                    "name": "Illinois" if level == "state" else clean_str(rec.get("school name") if level == "school" else rec.get("district")),
                    "district": clean_str(rec.get("district")),
                    "county": place(rec.get("county")),
                    "city": place(rec.get("city")),
                    "type": type_label(rec.get("district type")),
                    "school_type": clean_str(rec.get("school type")).lower(),
                }
            for key, col in colmap.items():
                if ent.get(key) is not None:
                    continue
                v = rec.get(col)
                if key in TEXT_FIELDS:
                    s = clean_str(v)
                    ent[key] = s if s and s not in ("-", "N/A", "*") else None
                else:
                    ent[key] = to_num(v)
    missing = [k for k in INDICATORS if k not in matched]
    print(f"{year}: {len(entities)} entities, missing: {', '.join(missing) or 'none'}", file=sys.stderr)
    return entities, matched


def main():
    by_year, mapping = {}, {}
    for y in YEARS:
        by_year[y], mapping[y] = extract_year(y, download(FILES[y]))

    # The latest year supplies names and metadata.
    meta = {}
    for y in YEARS:
        for rcdts, e in by_year[y].items():
            m = meta.setdefault(rcdts, {})
            for k in ("level", "name", "district", "county", "city", "type", "school_type"):
                if e.get(k):
                    m[k] = e[k]

    def series(rcdts):
        out = {}
        for key in INDICATORS:
            vals = [by_year[y].get(rcdts, {}).get(key) for y in YEARS]
            if any(v is not None for v in vals):
                out[key] = [round(v, 2) if isinstance(v, float) else v for v in vals]
        # Derived: local property tax revenue (prior fiscal year) per enrolled student.
        # Derived: White minus Black proficiency (percentage points).
        for subj in ("ela", "math"):
            w, b = out.get(f"{subj}_prof_white"), out.get(f"{subj}_prof_black")
            if w and b:
                out[f"{subj}_gap_wb"] = [
                    round(x - y, 1) if x is not None and y is not None else None for x, y in zip(w, b)
                ]
        tax, enr = out.get("local_property_tax_dollars"), out.get("enrollment")
        if tax and enr:
            out["local_tax_per_pupil"] = [
                round(t / e, 2) if t is not None and e else None for t, e in zip(tax, enr)
            ]
        # Dollar amounts to whole dollars; drop columns the app doesn't display.
        for key in WHOLE_DOLLARS:
            if key in out:
                out[key] = [round(v) if isinstance(v, (int, float)) else v for v in out[key]]
        for key in OMIT:
            out.pop(key, None)
        return out

    districts, schools = [], []
    for rcdts, m in meta.items():
        rec = {"id": rcdts, "name": m.get("name", ""), "county": m.get("county", ""),
               "city": m.get("city", ""), "type": m.get("type", "")}
        if m["level"] == "school":
            rec["district_id"] = rcdts[:11] + "0000"
            rec["school_type"] = m.get("school_type", "")
            rec["data"] = series(rcdts)
            schools.append(rec)
        elif m["level"] in ("district", "state"):
            if m["level"] == "state":
                rec.update(name="Illinois (state average)", county="", city="", type="state")
            rec["data"] = series(rcdts)
            districts.append(rec)

    districts.sort(key=lambda r: (r["id"] != "STATE", r["name"]))
    schools.sort(key=lambda r: (r["district_id"], r["name"]))
    os.makedirs(OUT, exist_ok=True)
    for fname, rows in (("districts.json", districts), ("schools.json", schools)):
        with open(os.path.join(OUT, fname), "w") as fh:
            json.dump({"years": YEARS, "rows": rows}, fh, separators=(",", ":"))
        print(f"wrote {len(rows)} rows to public/data/{fname}", file=sys.stderr)
    with open(os.path.join(ROOT, "data", "column-mapping.json"), "w") as fh:
        json.dump(mapping, fh, indent=1)


if __name__ == "__main__":
    main()
