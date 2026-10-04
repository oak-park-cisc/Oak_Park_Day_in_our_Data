#!/usr/bin/env python3
"""Summarize the cached crime file into monthly incident counts for the trends page.

data/crime-incidents-oak-park.csv has one row per offense, with block-level
locations. The page only needs Village-wide monthly counts, so this script writes
a small aggregate instead of shipping the raw file:

  month,crime_against,incidents

`incidents` counts distinct incident_id. `All` counts each incident once. The
Person, Property and Society rows count an incident in every category it touches
(about 200 incidents involve more than one), so they do not add up to `All`.
The last month in the raw file is dropped as partial (the snapshot ends on its
first day). Rerun after refreshing the crime file, and update the pinned figures
in tests/test_echo.py together.

Standard library only. Usage:
    python3 scripts/crime_monthly.py                 # writes data/crime-monthly-oak-park.csv
    python3 scripts/crime_monthly.py -o out.csv
"""
import argparse
import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'data' / 'crime-incidents-oak-park.csv'
CATEGORIES = ['All', 'Person', 'Property', 'Society']


def monthly_counts(rows):
    """Return {(month, category): distinct incidents} for complete months only."""
    ids = {}
    for r in rows:
        month = r['date'][:7]
        ids.setdefault((month, 'All'), set()).add(r['incident_id'])
        if r['crime_against'] in CATEGORIES:
            ids.setdefault((month, r['crime_against']), set()).add(r['incident_id'])
    months = sorted({m for m, _ in ids})
    complete = months[:-1]  # the last month in the snapshot is partial
    return {(m, c): len(ids.get((m, c), ())) for m in complete for c in CATEGORIES}


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('-o', '--out', type=Path, default=ROOT / 'data' / 'crime-monthly-oak-park.csv')
    args = parser.parse_args()

    with SOURCE.open(newline='', encoding='utf-8') as f:
        counts = monthly_counts(csv.DictReader(f))
    with args.out.open('w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow(['month', 'crime_against', 'incidents'])
        for (month, cat), n in sorted(counts.items(), key=lambda kv: (kv[0][0], CATEGORIES.index(kv[0][1]))):
            w.writerow([month, cat, n])
    months = sorted({m for m, _ in counts})
    print(f'wrote {args.out} ({len(counts)} rows, {months[0]} to {months[-1]})')


if __name__ == '__main__':
    main()
