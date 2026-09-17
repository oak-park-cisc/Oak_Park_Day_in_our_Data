#!/usr/bin/env python3
"""Cache Village bikeways and school-route/safety layers as WGS84 GeoJSON.

Each file retains source attributes. Planning phase is not proof a bikeway
has been built; the crowd-sourcing layer aggregates reports by street segment, not crash events.
Standard library only. Outputs are replaced only after count/geometry checks.
"""
import json
import urllib.parse
import urllib.request
from pathlib import Path

BASE = 'https://services5.arcgis.com/aymthbPDQOcCnuwg/arcgis/rest/services/'
LAYERS = {
    'bikeways-oak-park.geojson': 'Oak_Park_Bikeways_July_2025',
    'safe-school-routes-oak-park.geojson': 'SafeRoutesWebMapLayer_gdb',
    'school-route-hazards-oak-park.geojson': 'SafeRoutesToSchoolCrowdSourcing',
    'traffic-calming-oak-park.geojson': 'Oak_Park_Traffic_Calming_Features',
}


def get(url, **params):
    with urllib.request.urlopen(url + '?' + urllib.parse.urlencode(params), timeout=60) as r:
        data = json.load(r)
    if 'error' in data:
        raise RuntimeError(data['error'])
    return data


def main():
    folder = Path(__file__).resolve().parents[1]
    for filename, service in LAYERS.items():
        url = BASE + service + '/FeatureServer/0'
        meta = get(url, f='json')
        oid = meta['objectIdField']
        count = get(url + '/query', where='1=1', returnCountOnly='true', f='json')['count']
        features = []
        while len(features) < count:
            page = get(url + '/query', where='1=1', outFields='*', outSR=4326,
                       orderByFields=oid, resultOffset=len(features), resultRecordCount=1000, f='geojson')
            batch = page.get('features', [])
            if not batch:
                raise RuntimeError(f'Incomplete response for {service}')
            features.extend(batch)
        if len(features) != count or len({f['properties'][oid] for f in features}) != count:
            raise RuntimeError(f'Count or key mismatch for {service}')
        if any(not f.get('geometry') for f in features):
            raise RuntimeError(f'Missing geometry in {service}')
        result = {'type': 'FeatureCollection', 'name': filename[:-8], 'features': features}
        out = folder / filename
        tmp = out.with_suffix('.geojson.tmp')
        tmp.write_text(json.dumps(result, separators=(',', ':')) + '\n')
        tmp.replace(out)
        print(f'{filename}: {count} features', flush=True)


if __name__ == '__main__':
    main()
