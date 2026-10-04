"""Feasibility probe for Idea 1: what can the cached data say about every block?"""
import csv, json, math, collections as C, re, sys

D = __import__('os').path.join(__import__('os').path.dirname(__file__), '../source-data/')
LAT0 = 41.885; KX = 111320 * math.cos(math.radians(LAT0)); KY = 110540
P = lambda lon, lat: (float(lon) * KX, float(lat) * KY)
dist = lambda a, b: math.hypot(a[0] - b[0], a[1] - b[1])

# Assumption: arterials/collectors unlikely to be approved for closure (rule not published).
ARTERIAL = re.compile(r'HARLEM|AUSTIN BLVD|OAK PARK AVE|RIDGELAND|MADISON|ROOSEVELT|NORTH AVE|CHICAGO AVE|LAKE ST|WASHINGTON BLVD|I290|RAMP|EISENHOWER|GARFIELD|JACKSON BLVD|DIVISION|HARRISON')

streets = json.load(open(D + 'streets-oak-park.geojson'))['features']
blocks = []
for f in streets:
    p = f['properties']; g = f['geometry']
    name = p['street_name'] or ''
    if name == 'ALLEY' or p['address_left_from'] in (-1, None) or g['type'] != 'LineString':
        continue
    c = g['coordinates']; a, b = P(*c[0][:2]), P(*c[-1][:2])
    ns = abs(b[1] - a[1]) > abs(b[0] - a[0])
    lo = min(x for x in (p['address_left_from'], p['address_right_from']) if x and x > 0)
    mid = P(*c[len(c) // 2][:2]) if len(c) > 2 else ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
    blocks.append(dict(name=name, hundred=lo // 100 * 100, ns=ns, arterial=bool(ARTERIAL.search(name)),
                       mid=mid, len_ft=p['length_ft']))

# Collapse segments to street + hundred-block
byblock = {}
for b in blocks:
    k = (b['name'], b['hundred'])
    byblock.setdefault(k, b)
print('address-bearing street segments:', len(blocks), '| unique street+hundred blocks:', len(byblock))
elig = {k: b for k, b in byblock.items() if b['ns'] and not b['arterial']}
print('north-south:', sum(b['ns'] for b in byblock.values()),
      '| east-west (ineligible):', sum(not b['ns'] for b in byblock.values()),
      '| N-S & non-arterial (likely eligible):', len(elig))

# Trees: match nearest_street + block number
trees = list(csv.DictReader(open(D + 'trees-oak-park.csv')))
tk = C.Counter((r['nearest_street'], int(r['block'].split()[0]) // 100 * 100) for r in trees if r['block'][:1].isdigit())
big = C.Counter((r['nearest_street'], int(r['block'].split()[0]) // 100 * 100) for r in trees
                if r['block'][:1].isdigit() and r['dbh_in'] and 24 <= float(r['dbh_in']) < 80)
matched = sum(1 for k in elig if tk.get(k))
print(f'tree join: {matched}/{len(elig)} eligible blocks matched by street+block')

# Businesses
lic = [r for r in csv.DictReader(open(D + 'business-licenses-oak-park.csv'))
       if r['license_status'] == 'Active' and r['latitude']]
food = [(P(r['longitude'], r['latitude']), r) for r in lic if r['general_category'] in ('Restaurant', 'Food Sales')]
mobile = [r for r in lic if r['mobile'] == '1']
print('active food businesses w/ location:', len(food), '| active mobile vendors w/ location:', len(mobile))

# Capital projects (published plans) by name+year
cap = json.load(open(D + 'capital-projects-oak-park.geojson'))['features']
print('capital project build years:', sorted(C.Counter(str(f['properties']['build_year']) for f in cap).items()))

# Historic buildings by street + hundred
hist = list(csv.DictReader(open(D + 'historic-buildings-oak-park.csv')))
hk = C.Counter()
for r in hist:
    m = re.match(r'(\d+)\s+(.*)', r['address'] or '')
    if m: hk[(m.group(2).upper().strip(), int(m.group(1)) // 100 * 100)] += 1
hm = sum(1 for k in elig if hk.get(k))
print(f'historic-building join: {hm}/{len(elig)} eligible blocks have >=1 surveyed building (exact name match)')
print('sample historic address:', hist[0]['address'], '| sample street name:', next(iter(elig))[0])

# Rank eligible blocks: shade + food within 400 m
rows = []
for k, b in elig.items():
    nfood = sum(1 for q, _ in food if dist(q, b['mid']) < 400)
    rows.append((k, tk.get(k, 0), big.get(k, 0), nfood, hk.get(k, 0)))
rows.sort(key=lambda r: (-r[2], -r[1]))
print('\nTop shaded eligible blocks (trees, big trees >=24in, food biz <400m, historic bldgs):')
for r in rows[:8]: print(f'  {r[0][1]} {r[0][0]:22} trees={r[1]:3} big={r[2]:3} food={r[3]:3} hist={r[4]}')
nf = [r[3] for r in rows]; print('food businesses within 400m of eligible blocks: median', sorted(nf)[len(nf)//2], '| zero:', nf.count(0))
