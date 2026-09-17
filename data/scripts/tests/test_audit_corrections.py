"""Regression checks for the September 17 brief/data corrections.
Run: python3 -m unittest discover -s data/scripts/tests -v
Requires requests (the ACS extractor's dependency).
"""
import csv
import datetime as dt
import importlib.util
import json
from pathlib import Path
import unittest
from unittest.mock import patch
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[3]


def module(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'data/scripts' / (name + '.py'))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


acs = module('fetch_acs_timeseries')
echo = module('fetch_echo_activity')
commissions = module('fetch_commissions')


class SourceSemantics(unittest.TestCase):
    def test_census_annotation_survives_both_json_paths(self):
        header = ['B25035_001E', 'B25035_001M', 'B25035_001EA', 'B25035_001MA']
        values = ['1938', '-333333333', '1939-', '***']
        with patch.object(acs, 'get', return_value={'response': {'data': [header, values]}}):
            rec = acs.fetch_datacensus(2024, 'B25035', ['B25035_001'], acs.GEOS[0])
        with patch.object(acs, 'get', return_value=[header, values]) as get:
            direct = acs.fetch_api(2024, 'B25035', ['B25035_001'], acs.GEOS[0])
        self.assertEqual(rec, direct)
        self.assertIn('B25035_001EA', get.call_args.kwargs['params']['get'])
        e, m, ea, ma = rec['B25035_001']
        self.assertEqual(acs.normalized_estimate(e, ea, 'B25035_001'), ('', '1939-'))
        self.assertEqual(acs.clean(m), '')
        self.assertEqual(ma, '***')

    def test_historical_year_bounds_and_uncensored_year(self):
        for value in (0, '0', '1939-', '1938', '1939'):
            self.assertEqual(acs.normalized_estimate(value, '', 'B25035_001'), ('', '1939-'))
        self.assertEqual(acs.normalized_estimate('1961', '', 'B25035_001'), ('1961', ''))
        self.assertEqual(acs.normalized_estimate('1938', '', 'B01003_001'), ('1938', ''))

    def test_complementary_suppression_is_not_a_less_than_five_bound(self):
        cells = {('A', 'X'): 2, ('A', 'Y'): 12, ('B', 'X'): 8, ('B', 'Y'): 30}
        result = echo.suppress(cells)
        self.assertEqual(set(result.values()), {'suppressed'})
        self.assertEqual(echo.suppress({('A', 'X'): 0, ('A', 'Y'): 7}), {('A', 'X'): 0, ('A', 'Y'): 7})

    def test_meeting_dates_are_published_future_entries_not_recurrences(self):
        page = '''<b>Description</b><p>Technology advice.</p></div>
        <b>Meeting Schedule</b><p>Third Thursday. If you require assistance call.</p></li>
        <b>Upcoming Meetings</b><ul>
        <li>Sep 17, 2026 - 7:00pm - Meeting - Room 101</li>
        <li>Aug 20, 2026 - 7:00pm - Old meeting</li>
        <li>Oct 15, 2026 - 7:00pm - Meeting - Room 101</li></ul>'''
        now = dt.datetime(2026, 9, 17, 20, tzinfo=ZoneInfo('America/Chicago'))
        row = commissions.parse_board(page, 'CISC', 'https://example.com', now, 'https://example.com/apply')
        self.assertTrue(row['Next Meeting 1'].startswith('Oct 15'))
        self.assertEqual(row['Next Meeting 2'], '')
        self.assertEqual(row['Schedule'], 'Third Thursday.')

    def test_missing_board_fields_fail_closed(self):
        with self.assertRaises(ValueError):
            commissions.parse_board('<b>Description</b><p>Test</p></div>', 'Test', 'https://example.com',
                                    dt.datetime.now(ZoneInfo('America/Chicago')), 'https://example.com/apply')


class CachedData(unittest.TestCase):
    def test_census_bound_is_not_a_numeric_year(self):
        with (ROOT / 'data/acs-oak-park-timeseries.csv').open() as f:
            rows = list(csv.DictReader(f))
        bounded = [r for r in rows if r['geoid'] == '16000US1754885' and r['variable'] == 'B25035_001']
        self.assertEqual(len(bounded), 16)
        self.assertTrue(all(r['estimate'] == '' and r['estimate_annotation'] == '1939-' for r in bounded))

    def test_echo_preserves_published_monthly_totals_and_neutral_marker(self):
        with (ROOT / 'data/echo-activity-oak-park.csv').open() as f:
            rows = list(csv.DictReader(f))
        self.assertEqual(sum(r['count'] == 'suppressed' for r in rows), 73)
        self.assertFalse(any(r['count'] == '<5' for r in rows))
        for breakdown in ('service_by_month', 'referral_by_month'):
            self.assertEqual(sum(int(r['count']) for r in rows if r['breakdown'] == breakdown), 1598)

    def test_commission_snapshot_is_complete_and_has_unique_headers(self):
        with (ROOT / 'commissions-diod.csv').open() as f:
            reader = csv.DictReader(f)
            rows = list(reader)
            self.assertEqual(len(reader.fieldnames), len(set(reader.fieldnames)))
            self.assertNotIn('', reader.fieldnames)
        self.assertEqual(len(rows), 18)
        self.assertEqual(len({r['Commission'] for r in rows}), 18)
        for name in ('Civic Information Systems Commission', 'Board of Fire and Police Commissioners',
                     'Liquor Control Review Board'):
            self.assertIn(name, {r['Commission'] for r in rows})
        for r in rows:
            self.assertTrue(r['URL'] and r['Apply URL'] and r['Checked At'])
            checked = dt.datetime.fromisoformat(r['Checked At'])
            for k in ('Next Meeting 1', 'Next Meeting 2', 'Next Meeting 3'):
                if r[k]:
                    date, time, *_ = r[k].split(' - ')
                    when = dt.datetime.strptime(date+' '+time, '%b %d, %Y %I:%M%p').replace(tzinfo=checked.tzinfo)
                    self.assertGreaterEqual(when, checked)

    def test_bike_layer_geometries_and_ids(self):
        expected = {'bikeways-oak-park.geojson': 85, 'safe-school-routes-oak-park.geojson': 1826,
                    'school-route-hazards-oak-park.geojson': 890, 'traffic-calming-oak-park.geojson': 292}
        for filename, count in expected.items():
            features = json.loads((ROOT / 'data' / filename).read_text())['features']
            self.assertEqual(len(features), count)
            self.assertTrue(all(f['geometry'] for f in features))
            oid = 'FID' if filename in ('bikeways-oak-park.geojson', 'traffic-calming-oak-park.geojson') else 'OBJECTID'
            self.assertEqual(len({f['properties'][oid] for f in features}), count)


if __name__ == '__main__':
    unittest.main()
