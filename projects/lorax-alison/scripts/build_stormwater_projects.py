"""Build i-Tree Stormwater Calculator project files (.itr) for the 100 largest and 100 smallest trees.

Run from the project root: python3 scripts/build_stormwater_projects.py <itree-species.json>
The species file is the "i-Tree Species" list the calculator caches in the browser (localStorage).
Each tree is its own group (count 1), so results are per tree. Tool limit: 100 groups per project.
"""

import csv
import json
import re
import sys

SPECIES_FILE = sys.argv[1]
OUT = "exports/itree-stormwater"
SPELLING = {"syringia": "syringa", "circidiphyllum": "cercidiphyllum"}
# Inventory Latin name -> name used in the i-Tree species list
SYNONYMS = {
    "cladrastis kentuckea": "cladrastis kentukea",
    "gymnocladus dioicus": "gymnocladus dioica",
    "platanus x acerifolia": "platanus x hybrida",
}

# Assumptions (the inventory has no condition, sunlight, soil or cover data)
CONDITION = "Good"
SUNLIGHT = "5"  # full sun
PARAMETERS = {
    "electricity": {"units": "metric"},
    "fuel": {"units": "metric"},
    "landUseValue": "Urban",
    "imperviousValue": "50",
    "soilType": "clay_loam",
    "customECEnabled": False,
    "total_p_emc": None,
    "total_n_emc": None,
    "total_ss_emc": None,
    "years": "40",
    "mortality": {"units": "annual"},
}
LOCATION = {  # as saved by the calculator for Oak Park, IL with 2019 weather
    "state": {"id": "258", "name": "Illinois", "abbr": "IL", "zip": "undefined"},
    "county": {"id": "941", "name": "Cook", "abbr": None, "zip": "undefined"},
    "city": {"id": "9746", "name": "Oak Park", "abbr": None, "zip": 60302},
    "weatherYear": "2019",
    "precipitation_inches": None,  # filled by the calculator when the year is selected
    "huc8": 7120004,
    "oidValue": 1455,
}

species = {}
for sci, common, code, level, *_ in json.load(open(SPECIES_FILE))["data"]:
    species.setdefault(sci.lower(), (sci, code, level))


def itree_species(latin, genus):
    """(i-Tree scientific name, code, how matched)."""
    name = re.sub(r"\s*['\"].*$", "", latin).strip().lower()
    genus = genus.lower()
    for wrong, right in SPELLING.items():
        name = name.replace(wrong, right)
        genus = genus.replace(wrong, right)
    name = SYNONYMS.get(name, name)
    if name in species:
        return species[name][0], species[name][1], "species"
    sci, code, _ = species[genus]
    return sci, code, "genus only"


rows = [
    r for r in csv.DictReader(open("public/data/trees.csv"))
    if r["genus"] not in ("", "STUMP", "UNKNOWN") and r["dbh_in"] and 0.5 <= float(r["dbh_in"]) <= 80
]
sets = {
    "largest-100": sorted(rows, key=lambda r: (-float(r["dbh_in"]), int(r["id"])))[:100],
    # 177 trees tie at 1"; the 100 with the lowest Tree IDs are used.
    "smallest-100": sorted(rows, key=lambda r: (float(r["dbh_in"]), int(r["id"])))[:100],
}

PART = 25  # smaller projects: the calculator sends every group to the server at once

for name, all_trees in sets.items():
    for part in range(0, len(all_trees), PART):
        trees = all_trees[part : part + PART]
        groups, key = [], []
        for i, r in enumerate(trees, 1):
            sci, code, match = itree_species(r["latin_name"], r["genus"])
            groups.append({"group": str(i), "species": code, "dbh": r["dbh_in"], "condition": CONDITION,
                           "sunlight": SUNLIGHT, "count": "1"})
            key.append({"group": i, "tree_id": int(r["id"]), "latin_name": r["latin_name"], "itree_species": sci,
                        "itree_code": code, "species_match": match, "dbh_in": float(r["dbh_in"]),
                        "address": r["address"], "address_status": r["address_status"], "block": r["block"],
                        "zone": r["zone"]})
        project = {"__application__": "swcalc", "__version__": "0.4.1", "location": LOCATION,
                   "parameters": PARAMETERS,
                   "trees": {"units": "english", "nomenclature": "scientific", "groups": groups}}
        stem = f"{OUT}/oak-park-{name}-part{part // PART + 1}"
        json.dump(project, open(f"{stem}.itr", "w"))
        json.dump(key, open(f"{stem}-key.json", "w"), indent=1)
        print(stem, len(groups), "groups;", sum(k["species_match"] == "genus only" for k in key), "genus-level")
