#!/usr/bin/env python3
"""Refresh all citizen boards/commissions and published upcoming meetings.

Source: the Village's official Granicus board directory (excluding the elected
Board of Trustees). Dates come from published Upcoming Meetings, never inferred
from recurring schedules. Standard library only; run from any directory.
"""
import argparse
import csv
import datetime as dt
import html
import re
import urllib.request
import urllib.parse
from pathlib import Path
from zoneinfo import ZoneInfo

DIRECTORY = 'https://oak-park.granicus.com/boards/w/d6ac89421af6f1dd'
FIELDS = ['Commission', 'Description', 'Schedule', 'Next Meeting 1',
          'Next Meeting 2', 'Next Meeting 3', 'Meeting Status', 'URL',
          'Apply URL', 'Checked At', 'Directory URL']


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (Day in Our Data directory refresh)'}), timeout=45) as r:
        return r.read().decode('utf-8')


def text(markup):
    return ' '.join(html.unescape(re.sub(r'<[^>]+>', ' ', markup)).split())


def section(page, label, end):
    m = re.search(r'<b>\s*' + re.escape(label) + r'\s*</b>(.*?)' + end, page, re.S)
    return m.group(1) if m else ''


def parse_board(page, name, url, now, apply_url):
    description = text(section(page, 'Description', '</div>'))
    schedule = text(section(page, 'Meeting Schedule', '</li>'))
    schedule = schedule.split('If you require assistance')[0].strip()
    if not description or not schedule:
        raise ValueError(f'Missing description/schedule for {name}; source layout changed')
    upcoming = section(page, 'Upcoming Meetings', '</ul>')
    meetings = []
    for item in re.findall(r'<li[^>]*>(.*?)</li>', upcoming, re.S):
        label = text(item)
        m = re.match(r'([A-Z][a-z]{2} \d{1,2}, \d{4}) -\s*(\d{1,2}:\d{2}[ap]m)', label)
        if not m:
            raise ValueError(f'Unrecognized meeting date: {label}')
        when = dt.datetime.strptime(' '.join(m.groups()), '%b %d, %Y %I:%M%p').replace(tzinfo=now.tzinfo)
        if when >= now:
            meetings.append((when, label))
    meetings.sort()
    return {'Commission': name, 'Description': description, 'Schedule': schedule,
            **{f'Next Meeting {i+1}': meetings[i][1] if i < len(meetings) else '' for i in range(3)},
            'Meeting Status': 'Published upcoming meetings; recheck source for changes' if meetings else
                'No future meeting published in source; check board page',
            'URL': url, 'Apply URL': apply_url, 'Checked At': now.isoformat(timespec='seconds'),
            'Directory URL': DIRECTORY}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, default=Path(__file__).resolve().parents[2] / 'commissions-diod.csv')
    args = parser.parse_args()
    now = dt.datetime.now(ZoneInfo('America/Chicago'))
    page = get(DIRECTORY)
    apply = re.search(r'href=["\']([^"\']*/boards/forms/[^"\']+/apply)["\']', page)
    if not apply:
        raise ValueError('Missing directory application link')
    apply_url = urllib.parse.urljoin(DIRECTORY, html.unescape(apply.group(1)))
    boards = re.findall(r'<a[^>]+href=[\"\'](/boards/w/[^\"\']+/boards/\d+)[\"\'][^>]*>(.*?)</a>', page, re.S)
    boards = [(path, text(name)) for path, name in boards if text(name).lower() != 'board of trustees']
    if not boards or len({p for p, _ in boards}) != len(boards):
        raise ValueError('Empty or duplicate board directory; refusing to overwrite')
    rows = []
    for path, name in boards:
        url = urllib.parse.urljoin(DIRECTORY, path)
        rows.append(parse_board(get(url), name, url, now, apply_url))
        print(name, flush=True)
    tmp = args.out.with_suffix('.csv.tmp')
    with tmp.open('w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    tmp.replace(args.out)
    print(f'Wrote {len(rows)} citizen boards and commissions; checked {now.isoformat()}')


if __name__ == '__main__':
    main()
