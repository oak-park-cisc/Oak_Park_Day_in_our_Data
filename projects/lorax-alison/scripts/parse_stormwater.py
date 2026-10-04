"""Combine i-Tree Stormwater Calculator report tables into public/data/stormwater.csv.

Run from the project root after the projects have been run:
    python3 scripts/parse_stormwater.py
Reads exports/itree-stormwater/results/<project>-tables.json (report tables saved from the calculator)
and the matching <project>-key.json (which tree is in which group).
"""

import csv
import glob
import json
import os

DIR = "exports/itree-stormwater"
num = lambda s: float(s.replace(",", "").split("/")[0].strip())  # noqa: E731

rows = []
for key_file in sorted(glob.glob(f"{DIR}/oak-park-*-part*-key.json")):
    project = os.path.basename(key_file).removesuffix("-key.json").removeprefix("oak-park-")
    tables_file = f"{DIR}/results/{project}-tables.json"
    if not os.path.exists(tables_file):
        print("missing results:", project)
        continue
    key = {k["group"]: k for k in json.load(open(key_file))}
    tables = json.load(open(tables_file))
    hydro = next(t for t in tables if t["cls"].startswith("hydro") and t["rows"]
                 and "gallons" in " ".join(t["head"][-1]))
    # The report's growth table shows size after the project period, so canopy is not kept;
    # "Present" hydrological benefits are for the tree at its entered (current) DBH.
    for r in hydro["rows"]:
        if not r[0].isdigit():
            continue  # totals row
        g = int(r[0])
        k = key[g]
        rows.append({
            "tree_id": k["tree_id"],
            "set": project.split("-part")[0],
            "itree_species": k["itree_species"],
            "species_match": k["species_match"],
            "dbh_in": k["dbh_in"],
            "runoff_gal_yr": num(r[3]),
            "runoff_value_usd_yr": float(r[3].split("$")[1].replace(",", "")) if "$" in r[3] else None,
            "tp_lbs_yr": num(r[4]),
            "tn_lbs_yr": num(r[5]),
            "tss_lbs_yr": num(r[6]),
        })

rows.sort(key=lambda r: (r["set"], -r["dbh_in"], r["tree_id"]))
with open("public/data/stormwater.csv", "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0]))
    w.writeheader()
    w.writerows(rows)
print(len(rows), "trees -> public/data/stormwater.csv")
