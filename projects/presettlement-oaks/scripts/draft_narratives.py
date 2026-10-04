"""Draft short narratives for trees in public/data/oaks.json.

Writes public/data/narratives.json. Existing entries are kept, so reviewed or edited
text is never overwritten. Every new entry starts with "status": "draft"; set it to
"approved" after review.

Run: python3 scripts/draft_narratives.py
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "public" / "data"
YEAR = 2026

# Published local stories, matched by tree key. Keep claims hedged unless confirmed.
STORIES = {
    "village-6516": (
        "Local accounts describe a 'Kenilworth Witness Oak', a bur oak the Potawatomi are said "
        "to have used as a landmark on the route back to the Des Plaines River. Whether this is "
        "that tree is unconfirmed."
    ),
}

COVER_TEXT = {
    "timber (forest)": "mapped this spot as timber, a small wooded patch in what was mostly prairie",
    "prairie": "mapped this spot as open prairie",
    "barrens (open oak woods)": "mapped this spot as barrens, open oak woodland",
}


def place(t: dict) -> str:
    if t["park"]:
        return f"in {t['park']} park"
    num, _, street = t["block"].partition(" ")
    return f"on the {num} block of {street}" if num.isdigit() else f"on {t['block']}"


def draft(t: dict) -> str:
    parts = []
    district = f" in the {t['historic_district']} Historic District" if t["historic_district"] else ""
    parts.append(f"This {t['common'].lower()} stands {place(t)}{district}.")
    if t["landcover_1830s"] in COVER_TEXT:
        parts.append(f"The 1830s federal land survey {COVER_TEXT[t['landcover_1830s']]}.")
    house = t["nearest_house"]
    if house:
        ago = YEAR - house["year"]
        lo, hi = t["age_low"] - ago, t["age_high"] - ago
        if lo >= 20:
            then = f"this oak was already about {lo}–{hi} years old"
        elif hi >= 20:
            then = f"this oak could have been anything from a sapling to about {hi} years old"
        else:
            then = "this oak was at most a sapling"
        parts.append(f"When the house at {house['address']} was built in {house['year']}, {then}.")
    if t["key"] in STORIES:
        parts.append(STORIES[t["key"]])
    return " ".join(parts)


def main():
    trees = json.loads((DATA / "oaks.json").read_text())["trees"]
    path = DATA / "narratives.json"
    existing = json.loads(path.read_text()) if path.exists() else {}
    for t in trees:
        if t["key"] not in existing:
            existing[t["key"]] = {"status": "draft", "text": draft(t)}
    path.write_text(json.dumps(existing, indent=1, ensure_ascii=False))

    # A readable copy for reviewers. Edit narratives.json, not this file.
    label = {"likely": "Likely", "possible": "Possible", "long_shot": "Long shot"}
    lines = [
        "# Narrative review",
        "",
        "Generated from `public/data/narratives.json`. To approve or edit a narrative, change its",
        '`text` there and set `"status": "approved"`. Re-running the draft script keeps your edits.',
        "",
    ]
    for t in trees:
        n = existing[t["key"]]
        where = t["park"] + " park" if t["park"] else f"~{t['address']}"
        lines += [
            f"## {t['common']}, {where}",
            "",
            f"`{t['key']}` · {label[t['confidence']]} · {t['age_low']}–{t['age_high']} yrs · {n['status']}",
            "",
            n["text"],
            "",
        ]
    (ROOT / "docs" / "narratives-review.md").write_text("\n".join(lines))
    print(len(existing), "narratives;", sum(v["status"] == "draft" for v in existing.values()), "drafts")


if __name__ == "__main__":
    main()
