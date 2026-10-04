#!/usr/bin/env python3
"""Build a single-file copy of the trends page that opens with a double-click.

site/index.html fetches its CSVs at runtime, which browsers block for pages opened
from disk. This script embeds the current ECHO snapshot and, if they exist, the
resource directory, the monthly crime summary and the yearly calls-for-service
totals into one HTML file to email or zip (for example, for judges).
The copy is a snapshot: rerun after the resource directory changes.

Standard library only. Usage, from anywhere:
    python3 scripts/build_standalone.py                # writes dist/echo-trends.html
    python3 scripts/build_standalone.py -o out.html
"""
import argparse
import datetime as dt
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / 'site' / 'index.html'
# Keys are the URLs the page requests, relative to site/.
SOURCES = {
    '../data/echo-activity-oak-park.csv': ROOT / 'data' / 'echo-activity-oak-park.csv',
    '../resources/resource-directory.csv': ROOT / 'resources' / 'resource-directory.csv',
    '../data/crime-monthly-oak-park.csv': ROOT / 'data' / 'crime-monthly-oak-park.csv',
    '../data/calls-for-service-totals.csv': ROOT / 'data' / 'calls-for-service-totals.csv',
}
MARKER = '<script>\n(() => {'


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('-o', '--out', type=Path, default=ROOT / 'dist' / 'echo-trends.html')
    args = parser.parse_args()

    html = PAGE.read_text(encoding='utf-8')
    if html.count(MARKER) != 1:
        raise SystemExit(f'expected exactly one "{MARKER!r}" in {PAGE}; the page script changed')

    embedded = {}
    for url, path in SOURCES.items():
        if path.exists():
            embedded[url] = path.read_text(encoding='utf-8')
            print(f'embedded {path.relative_to(ROOT)} ({len(embedded[url].splitlines()) - 1} rows)')
        else:
            print(f'skipped {path.relative_to(ROOT)} (not found; the page shows a placeholder)')
    if '../data/echo-activity-oak-park.csv' not in embedded:
        raise SystemExit('the ECHO data file is required')

    # Escape '</' so CSV text can never close the script tag.
    data = json.dumps(embedded, ensure_ascii=False).replace('</', '<\\/')
    stamp = dt.datetime.now().astimezone().strftime('%Y-%m-%d %H:%M %Z')
    inject = f'<!-- Standalone copy built {stamp} by scripts/build_standalone.py -->\n' \
             f'<script>window.EMBEDDED_CSV = {data};</script>\n'
    out = html.replace(MARKER, inject + MARKER)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(out, encoding='utf-8')
    print(f'wrote {args.out} ({args.out.stat().st_size // 1024} KB)')


if __name__ == '__main__':
    main()
