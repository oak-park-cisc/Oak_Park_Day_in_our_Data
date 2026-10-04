"""Checks on the ECHO extractor's suppression and the cached snapshot.
Adapted from data/scripts/tests/test_audit_corrections.py in the CISC repo.
Run: python3 -m unittest discover -s tests -v   (standard library only)
"""
import csv
import importlib.util
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


def module(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / (name + '.py'))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


echo = module('fetch_echo_activity')


class Suppression(unittest.TestCase):
    def test_complementary_suppression_is_not_a_less_than_five_bound(self):
        cells = {('A', 'X'): 2, ('A', 'Y'): 12, ('B', 'X'): 8, ('B', 'Y'): 30}
        result = echo.suppress(cells)
        self.assertEqual(set(result.values()), {'suppressed'})
        self.assertEqual(echo.suppress({('A', 'X'): 0, ('A', 'Y'): 7}), {('A', 'X'): 0, ('A', 'Y'): 7})


class CachedData(unittest.TestCase):
    def test_echo_preserves_published_monthly_totals_and_neutral_marker(self):
        with (ROOT / 'data/echo-activity-oak-park.csv').open() as f:
            rows = list(csv.DictReader(f))
        self.assertEqual(sum(r['count'] == 'suppressed' for r in rows), 73)
        self.assertFalse(any(r['count'] == '<5' for r in rows))
        for breakdown in ('service_by_month', 'referral_by_month'):
            self.assertEqual(sum(int(r['count']) for r in rows if r['breakdown'] == breakdown), 1598)

    def test_call_volume_files_match_the_board_deck(self):
        with (ROOT / 'data/police-calls-echo-relevant-2025.csv').open() as f:
            rows = list(csv.DictReader(f))
        totals = {}
        for r in rows:
            totals[r['call_group']] = totals.get(r['call_group'], 0) + int(r['calls_2025'])
            self.assertIn(r['match_confidence'], {'high', 'medium', 'low'})
        self.assertEqual(totals, {'Call Type 1 (mental health)': 341,
                                  'Call Type 2 (domestic/abuse)': 670,
                                  'Community Response': 5214})

    def test_resource_directory_follows_the_readme_columns(self):
        with (ROOT / 'resources/resource-directory.csv').open() as f:
            reader = csv.DictReader(f)
            rows = list(reader)
        self.assertEqual(reader.fieldnames, ['echo_category', 'provider', 'program', 'what_they_offer',
                                             'when_to_use', 'who_is_eligible', 'hours', 'how_to_reach', 'cost',
                                             'source_url', 'checked_on', 'notes'])
        categories = {'Unhoused Resident', 'Behavioral Health', 'Senior Services', 'Housing',
                      'Youth/Family Services', 'Financial Support', 'Domestic Violence',
                      'Medical Support', 'Food Services'}
        for r in rows:
            self.assertIn(r['echo_category'], categories)
            self.assertTrue(r['source_url'].startswith('https://'), r['program'])
            self.assertIn('https://', r['how_to_reach'], r['program'])
            for field in ('who_is_eligible', 'hours', 'cost'):
                self.assertNotEqual(r[field].strip(), 'Not listed', r['program'])
            self.assertRegex(r['checked_on'], r'^\d{4}-\d{2}-\d{2}$')
        self.assertEqual({r['echo_category'] for r in rows}, categories)



class PageNumbers(unittest.TestCase):
    """Figures site/index.html draws or annotates. A refreshed snapshot that changes them
    should be checked against the page's wording (peak annotation, partial month, flags)."""

    def setUp(self):
        with (ROOT / 'data/echo-activity-oak-park.csv').open() as f:
            self.rows = [r for r in csv.DictReader(f) if r['breakdown'] == 'service_by_month']

    def test_monthly_totals_peak_and_partial_month(self):
        totals = {}
        for r in self.rows:
            totals[r['month']] = totals.get(r['month'], 0) + int(r['count'])
        months = sorted(totals)
        self.assertEqual((months[0], months[-1]), ('2025-02', '2026-09'))
        self.assertEqual(totals['2026-09'], 17)  # partial month, drawn separately
        complete = {m: v for m, v in totals.items() if m != months[-1]}
        self.assertEqual(max(complete, key=complete.get), '2025-09')  # the annotated peak
        self.assertEqual(complete['2025-09'], 178)

    def test_category_totals(self):
        cats = {}
        for r in self.rows:
            # The source writes uncategorized services as the literal '(blank)'; the page shows 'Not categorized'.
            name = 'Not categorized' if r['service'] in ('', '(blank)') else r['service']
            cats[name] = cats.get(name, 0) + int(r['count'])
        self.assertEqual(sum(cats.values()), 1598)
        self.assertEqual(cats['Unhoused Resident'], 436)
        self.assertEqual(cats['Not categorized'], 25)
        top4 = sorted((v for k, v in cats.items() if k not in ('Other', 'Not categorized')), reverse=True)[:4]
        self.assertEqual(top4, [436, 288, 269, 250])

    def test_referral_source_figures(self):
        """Figures the "By referral source" tab states in its text."""
        with (ROOT / 'data/echo-activity-oak-park.csv').open() as f:
            rows = [r for r in csv.DictReader(f) if r['breakdown'] == 'referral_by_month']
        by = {}
        for r in rows:
            by.setdefault(r['referral_source'], {})[r['month']] = int(r['count'])
        self.assertEqual(sum(sum(m.values()) for m in by.values()), 1598)
        self.assertEqual((by['Police Department']['2025-09'], by['Fire Department']['2025-09']), (76, 37))
        self.assertEqual(sorted(by['Emergency Housing']), ['2025-07', '2025-08', '2025-09', '2025-10'])


class ContextNumbers(unittest.TestCase):
    """Figures the "Community context" tab and research/crime-and-echo.md quote."""

    def setUp(self):
        with (ROOT / 'data/crime-monthly-oak-park.csv').open() as f:
            self.rows = list(csv.DictReader(f))
        self.by = {(r['month'], r['crime_against']): int(r['incidents']) for r in self.rows}

    def test_aggregate_matches_the_raw_crime_file(self):
        with (ROOT / 'data/crime-incidents-oak-park.csv').open() as f:
            expected = module('crime_monthly').monthly_counts(csv.DictReader(f))
        self.assertEqual(self.by, expected, 'rerun scripts/crime_monthly.py after refreshing the crime file')

    def test_complete_months_only(self):
        months = sorted({m for m, _ in self.by})
        self.assertEqual((months[0], months[-1], len(months)), ('2022-01', '2026-08', 56))

    def test_same_month_windows(self):
        def window(y, cat):
            return sum(n for (m, c), n in self.by.items() if c == cat and f'{y}-03' <= m <= f'{y + 1}-02')
        self.assertEqual([window(y, 'All') for y in (2022, 2023, 2024, 2025)], [3115, 3051, 2968, 2708])
        # An incident counts in every category it involves.
        self.assertEqual([window(y, 'Person') for y in (2022, 2023, 2024, 2025)], [560, 504, 546, 533])
        self.assertEqual([window(y, 'Property') for y in (2022, 2023, 2024, 2025)], [2544, 2534, 2426, 2159])

    def test_calls_for_service_totals(self):
        with (ROOT / 'data/calls-for-service-totals.csv').open() as f:
            rows = {r['year']: (int(r['police_calls']), int(r['fire_calls'])) for r in csv.DictReader(f)}
        self.assertEqual(rows['2022'], (46869, 8594))
        self.assertEqual(rows['2025'], (37369, 9474))


class SyntheticIsolation(unittest.TestCase):
    """Synthetic FOIA templates must never reach data/, the trends page, or the standalone build."""

    def test_every_template_row_is_flagged_synthetic(self):
        templates = sorted((ROOT / 'foia/templates').glob('*.csv'))
        self.assertTrue(templates)
        for path in templates:
            self.assertTrue(path.name.startswith('SYNTHETIC-'), path.name)
            with path.open() as f:
                reader = csv.DictReader(f)
                rows = list(reader)
            self.assertEqual(reader.fieldnames[0], 'synthetic', path.name)
            self.assertTrue(rows and all(r['synthetic'] == 'yes' for r in rows), path.name)

    def test_no_synthetic_data_in_data_folder(self):
        for path in (ROOT / 'data').glob('*.csv'):
            with path.open() as f:
                header = next(csv.reader(f))
            self.assertNotIn('synthetic', header, path.name)

    def test_trends_page_and_build_never_touch_foia(self):
        page = (ROOT / 'site/index.html').read_text()
        self.assertNotIn('foia/', page)
        self.assertNotIn('prototype-calls', page)
        build = module('build_standalone')
        self.assertFalse(any('foia' in str(p) for p in build.SOURCES.values()))
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / 'page.html'
            subprocess.run([sys.executable, str(ROOT / 'scripts/build_standalone.py'), '-o', str(out)],
                           check=True, capture_output=True)
            self.assertNotIn('synthetic', out.read_text().lower())


class BuildContract(unittest.TestCase):
    def test_every_csv_the_page_loads_is_embedded_by_the_build(self):
        page = (ROOT / 'site/index.html').read_text()
        urls = set(re.findall(r"'(\.\./(?:data|resources)/[\w.-]+\.csv)'", page))
        self.assertEqual(urls, set(module('build_standalone').SOURCES))


if __name__ == '__main__':
    unittest.main()
