import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import * as turf from '@turf/turf';

const TREES = 'public/data/trees-oak-park.csv';
const STREETS = 'public/data/streets-oak-park.geojson';
const PARKS = 'public/data/osm-parks.json';
const SVI = 'public/data/social-vulnerability-oak-park.geojson';
const BOUNDARY = 'public/data/oak-park-boundary.geojson';
const FAMILIES = 'public/data/genus-family.csv';

// ---- minimal CSV parser (handles quoted fields with commas/quotes, \r\n) ----
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const rows = parseCsv(readFileSync(TREES, 'utf8'));
const header = rows[0];
const idx = Object.fromEntries(header.map((h, i) => [h, i]));
const get = (r, name) => (r[idx[name]] ?? '').trim();

const numOrNull = (v) => {
  if (v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// generous bounds for Oak Park, IL — used only to catch corrupt coordinates
const BOUNDS = { latMin: 41.8, latMax: 42.0, lonMin: -88.0, lonMax: -87.6 };
const SQ_FT_PER_ACRE = 43560;

function mean(xs) {
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
function median(xs) {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
function shannon(counts, total) {
  let h = 0;
  for (const c of counts.values()) {
    if (c > 0) {
      const p = c / total;
      h -= p * Math.log(p);
    }
  }
  return h;
}
function topOf(map) {
  let best = null;
  let bestCount = 0;
  let sum = 0;
  for (const [name, c] of map) {
    sum += c;
    if (c > bestCount) {
      best = name;
      bestCount = c;
    }
  }
  return { name: best, share: sum > 0 ? bestCount / sum : 0 };
}
function topN(map, n, total) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, c]) => ({ name, share: total > 0 ? round(c / total, 3) : 0 }));
}
function round(v, d) {
  return v === null ? null : Number(v.toFixed(d));
}
// approximate crown area from recorded spread (diameter, ft); crowns overlap,
// so sums overestimate true canopy
const crownSqFt = (spread) => Math.PI * (spread / 2) ** 2;

// 10-20-30 rule at block scale:
//  risk  — one genus >= 30% of trees, or one species >= 50% (monoculture)
//  cusp  — approaching the guideline: genus >= 20%, species >= 10% or family >= 30%
//  meets — fully within the guideline
//  few   — fewer than 10 trees: sample too small to judge
function blockStatus(n, genusShare, speciesShare, familyShare = 0) {
  if (n < 10) return 'few';
  if (genusShare >= 0.3 || speciesShare >= 0.5) return 'risk';
  if (genusShare >= 0.2 || speciesShare >= 0.1 || familyShare >= 0.3) return 'cusp';
  return 'meets';
}

// ---- parks (OpenStreetMap leisure=park) ----
function osmToPolygons(osm) {
  const out = [];
  const ring = (geom) => {
    const c = geom.map((p) => [p.lon, p.lat]);
    const [a, z] = [c[0], c[c.length - 1]];
    if (a[0] !== z[0] || a[1] !== z[1]) c.push(a);
    return c;
  };
  // join open member ways end to end into closed rings
  const stitch = (ways) => {
    const rings = [];
    const pool = ways.map((w) => w.map((p) => [p.lon, p.lat]));
    while (pool.length) {
      let cur = pool.shift();
      let grew = true;
      const same = (p, q) => p[0] === q[0] && p[1] === q[1];
      while (!same(cur[0], cur[cur.length - 1]) && grew) {
        grew = false;
        for (let i = 0; i < pool.length; i++) {
          const w = pool[i];
          const end = cur[cur.length - 1];
          if (same(w[0], end)) cur = cur.concat(w.slice(1));
          else if (same(w[w.length - 1], end)) cur = cur.concat([...w].reverse().slice(1));
          else continue;
          pool.splice(i, 1);
          grew = true;
          break;
        }
      }
      if (same(cur[0], cur[cur.length - 1]) && cur.length >= 4) rings.push(cur);
    }
    return rings;
  };
  for (const e of osm.elements) {
    const name = e.tags?.name ?? 'Park';
    if (e.type === 'way' && e.geometry?.length >= 4) {
      out.push(turf.polygon([ring(e.geometry)], { name }));
    } else if (e.type === 'relation' && e.members) {
      const outers = e.members.filter((m) => m.role === 'outer' && m.geometry);
      for (const r of stitch(outers.map((m) => m.geometry))) out.push(turf.polygon([r], { name }));
    }
  }
  return out;
}
const parks = existsSync(PARKS) ? osmToPolygons(JSON.parse(readFileSync(PARKS, 'utf8'))) : [];

// ---- Village Social Vulnerability Index (block groups) ----
// fourteen 1-5 indices ranked within Oak Park; Composite_Index is their sum
const SVI_FIELDS = {
  poverty: 'HousholdsInPoverty_Index',
  seniors: 'Senior_Index',
  under5: 'ChildrenUnder5_Index',
  disability: 'Disability_Index',
  noVehicle: 'LackOfVehicle_Index',
  frontline: 'Frontline_Index',
  rentBurden: 'RentBurden_Index',
  homeCostBurden: 'HomeCostBurden_Index',
  foodStamps: 'FoodStamp_Index',
  unemployment: 'Unemployment_Index',
  singleParent: 'SingleParent_Index',
  language: 'Language_Index',
  race: 'Race_Index',
  rentedBuildingAge: 'RentedBuildingAge_Index',
};
const sviGroups = JSON.parse(readFileSync(SVI, 'utf8')).features.map((f) => ({
  id: f.properties.tract_block_group,
  composite: f.properties.Composite_Index,
  indices: Object.fromEntries(
    Object.entries(SVI_FIELDS).map(([k, field]) => [k, f.properties[field]]),
  ),
  feature: f,
  bbox: turf.bbox(f),
  areaAcres: turf.area(f) / 4046.86,
}));
// rank 1 = most vulnerable; ties share a rank. Fifths by rank: 5 = most vulnerable
for (const g of sviGroups) {
  g.rank = 1 + sviGroups.filter((o) => o.composite > g.composite).length;
  g.fifth = 5 - Math.floor(((g.rank - 1) * 5) / sviGroups.length);
}
const inBox = ([x, y], b) => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3];
const groupAt = (pt) =>
  sviGroups.findIndex((g) => inBox(pt, g.bbox) && turf.booleanPointInPolygon(pt, g.feature));

// ---- street centerlines, indexed by hundred-block ----
// the CSV's `block` is the hundred-block of the nearest centerline, e.g.
// "1200 N AUSTIN BLVD"; a segment belongs to every hundred its address range covers
const streetSegs = JSON.parse(readFileSync(STREETS, 'utf8')).features.filter(
  (f) => f.geometry?.type === 'LineString' && f.properties.street_name !== 'ALLEY',
);
const segsByBlock = new Map();
for (const f of streetSegs) {
  const p = f.properties;
  const nums = [
    p.address_left_from,
    p.address_left_to,
    p.address_right_from,
    p.address_right_to,
  ].filter((v) => typeof v === 'number' && v >= 0);
  if (!nums.length) continue;
  const [lo, hi] = [Math.min(...nums), Math.max(...nums)];
  for (let h = Math.floor(lo / 100); h <= Math.floor(hi / 100); h++) {
    const key = `${h * 100} ${p.street_name}`;
    segsByBlock.set(key, [...(segsByBlock.get(key) ?? []), f]);
  }
}

// ---- botanical family by genus (APG IV), from a curated lookup ----
const familyRows = parseCsv(readFileSync(FAMILIES, 'utf8'));
const famIdx = Object.fromEntries(familyRows[0].map((h, i) => [h, i]));
const familyOf = new Map();
const familyCommon = new Map();
for (const r of familyRows.slice(1)) {
  const g = (r[famIdx.genus] ?? '').trim();
  const fam = (r[famIdx.family] ?? '').trim();
  if (!g || !fam) continue;
  familyOf.set(g, fam);
  familyCommon.set(fam, (r[famIdx.family_common] ?? '').trim());
}
const unmappedGenera = new Map();
const familyVillage = new Map();

// ---- trees ----
const stats = { total: 0, badCoords: 0, noGroup: 0 };
const genusVillage = new Map();
const speciesVillage = new Map();
const commonNames = new Map(); // latin name → Map(common name → count)
const genusWords = new Map(); // genus → Map(first word of common name → count)
// inventory names read "MAPLE-NORWAY"; residents say "Norway Maple"
const titleCase = (s) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const prettyCommon = (raw) => titleCase(raw.split('-').reverse().join(' ').trim());
const mostCommon = (counts) => [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
// trunk-diameter classes (inches); a size profile only — the data has no age
const DBH_CLASSES = [
  [0, 6, '0–6"'],
  [6, 12, '6–12"'],
  [12, 18, '12–18"'],
  [18, 24, '18–24"'],
  [24, 30, '24–30"'],
  [30, Number.POSITIVE_INFINITY, '30"+'],
];
const dbhCounts = DBH_CLASSES.map(() => 0);
const village = { dbh: [], height: [], spread: [], canopy: 0 };
const byBlock = new Map();
const groupTrees = sviGroups.map(() => ({ trees: 0, canopy: 0 }));
const points = [];

for (const r of rows.slice(1)) {
  if (r.length < header.length / 2) continue; // blank trailing line
  stats.total++;
  const lat = numOrNull(get(r, 'latitude'));
  const lon = numOrNull(get(r, 'longitude'));
  const dbh = numOrNull(get(r, 'dbh_in'));
  const height = numOrNull(get(r, 'height_ft'));
  const spread = numOrNull(get(r, 'spread_ft'));
  const common = get(r, 'common_name') || '(unnamed)';
  const latin = get(r, 'latin_name');
  const genus = get(r, 'genus') || (latin ? latin.split(' ')[0] : '(unknown)');
  const speciesId = latin || common;
  const blockKey = get(r, 'block');
  const crown = spread !== null && spread > 0 ? crownSqFt(spread) : 0;

  // placeholder genera (UNKNOWN, STUMP, blank) have no family
  const family = familyOf.get(genus) ?? null;
  if (!family) unmappedGenera.set(genus, (unmappedGenera.get(genus) ?? 0) + 1);
  else familyVillage.set(family, (familyVillage.get(family) ?? 0) + 1);
  speciesVillage.set(speciesId, (speciesVillage.get(speciesId) ?? 0) + 1);
  genusVillage.set(genus, (genusVillage.get(genus) ?? 0) + 1);
  if (!commonNames.has(speciesId)) commonNames.set(speciesId, new Map());
  const names = commonNames.get(speciesId);
  names.set(common, (names.get(common) ?? 0) + 1);
  if (!genusWords.has(genus)) genusWords.set(genus, new Map());
  const word = common.split('-')[0].trim();
  genusWords.get(genus).set(word, (genusWords.get(genus).get(word) ?? 0) + 1);
  if (dbh !== null && dbh > 0) {
    dbhCounts[DBH_CLASSES.findIndex(([lo, hi]) => dbh >= lo && dbh < hi)]++;
    village.dbh.push(dbh);
  }
  if (height !== null && height > 0) village.height.push(height);
  if (spread !== null && spread > 0) village.spread.push(spread);
  village.canopy += crown;

  const valid =
    lat !== null &&
    lon !== null &&
    lat >= BOUNDS.latMin &&
    lat <= BOUNDS.latMax &&
    lon >= BOUNDS.lonMin &&
    lon <= BOUNDS.lonMax;
  if (!valid) stats.badCoords++;
  const q = valid ? groupAt([lon, lat]) : -1;
  if (q < 0) stats.noGroup++;
  else {
    groupTrees[q].trees++;
    groupTrees[q].canopy += crown;
  }

  if (!byBlock.has(blockKey))
    byBlock.set(blockKey, {
      trees: 0,
      species: new Map(),
      genera: new Map(),
      families: new Map(),
      dbh: [],
      height: [],
      spread: [],
      canopy: 0,
      coords: [],
      groups: new Map(),
      points: [],
    });
  const b = byBlock.get(blockKey);
  b.trees++;
  b.species.set(speciesId, (b.species.get(speciesId) ?? 0) + 1);
  b.genera.set(genus, (b.genera.get(genus) ?? 0) + 1);
  if (family) b.families.set(family, (b.families.get(family) ?? 0) + 1);
  if (dbh !== null && dbh > 0) b.dbh.push(dbh);
  if (height !== null && height > 0) b.height.push(height);
  if (spread !== null && spread > 0) b.spread.push(spread);
  b.canopy += crown;
  if (q >= 0) b.groups.set(q, (b.groups.get(q) ?? 0) + 1);
  if (!valid) continue;
  b.coords.push([lon, lat]);
  // k = block index, q = block-group index (-1 outside), p = species id,
  // w = crown spread — lets the dashboard re-slice everything client-side
  const point = {
    i: Number(get(r, 'object_id')),
    la: round(lat, 6),
    lo: round(lon, 6),
    g: genus,
    s: common,
    p: speciesId,
    f: family,
    d: dbh === null ? null : Number(dbh.toFixed(1)),
    w: spread !== null && spread > 0 ? spread : null,
    k: -1,
    q,
  };
  b.points.push(point);
  points.push(point);
}

// ---- block geometry: the block's centerline segments ----
// blocks whose street has no address ranges fall back to same-name segments
// within 80 m of the block's trees
const FALLBACK_M = 80;
let fallbackBlocks = 0;
let noGeometry = 0;
function geometryFor(key, coords) {
  const segs = segsByBlock.get(key);
  if (segs?.length) return segs;
  const name = key.replace(/^\d+ /, '');
  const near = streetSegs.filter(
    (f) =>
      f.properties.street_name === name &&
      coords.some((c) => turf.pointToLineDistance(c, f, { units: 'meters' }) <= FALLBACK_M),
  );
  if (near.length) fallbackBlocks++;
  return near;
}
const toLatLng = (ring) => ring.map(([x, y]) => [round(y, 5), round(x, 5)]);

// order blocks by street, then hundred
const keyOrder = (k) => {
  const m = k.match(/^(\d+) (.*)$/);
  return m ? [m[2], Number(m[1])] : [k, -1];
};
const keys = [...byBlock.keys()].sort((a, b) => {
  const [sa, na] = keyOrder(a);
  const [sb, nb] = keyOrder(b);
  return sa.localeCompare(sb) || na - nb;
});

const blocks = keys.map((key, i) => {
  const b = byBlock.get(key);
  for (const pt of b.points) pt.k = i;
  const n = b.trees;
  const topGenus = topOf(b.genera);
  const topSpecies = topOf(b.species);
  const segs = geometryFor(key, b.coords);
  if (!segs.length) noGeometry++;
  const lines = segs.map((f) => toLatLng(f.geometry.coordinates));
  const lengthFt = segs.reduce((a, f) => a + (f.properties.length_ft ?? 0), 0);
  const all = [...segs.flatMap((f) => f.geometry.coordinates), ...b.coords];
  const xs = all.map((c) => c[0]);
  const ys = all.map((c) => c[1]);
  // the block takes the block group most of its trees stand in (streets often
  // form block-group boundaries, so its two sides can differ)
  const q = b.groups.size ? [...b.groups.entries()].sort((x, y) => y[1] - x[1])[0][0] : -1;
  return {
    id: `b${String(i + 1).padStart(3, '0')}`,
    name: titleCase(key),
    trees: n,
    species: b.species.size,
    genera: b.genera.size,
    shannon: round(shannon(b.species, n), 2),
    topGenus: { name: topGenus.name, share: round(topGenus.share, 3) },
    topSpecies: { name: topSpecies.name, share: round(topSpecies.share, 3) },
    topGenera: topN(b.genera, 5, n),
    topFamily: (() => {
      const t = topOf(b.families);
      return t.name ? { name: t.name, share: round(b.families.get(t.name) / n, 3) } : null;
    })(),
    status: blockStatus(
      n,
      topGenus.share,
      topSpecies.share,
      b.families.size ? Math.max(...b.families.values()) / n : 0,
    ),
    medianDbh: round(median(b.dbh), 1),
    meanHeight: round(mean(b.height), 0),
    meanSpread: round(mean(b.spread), 0),
    canopySqFt: Math.round(b.canopy),
    lengthFt: Math.round(lengthFt),
    treesPer100Ft: lengthFt ? round((n / lengthFt) * 100, 1) : null,
    canopyPer100Ft: lengthFt ? Math.round((b.canopy / lengthFt) * 100) : null,
    bg: q >= 0 ? sviGroups[q].id : null,
    bbox: [
      [round(Math.min(...ys), 5), round(Math.min(...xs), 5)],
      [round(Math.max(...ys), 5), round(Math.max(...xs), 5)],
    ],
    lines,
  };
});

// ---- trees × social vulnerability ----
// SVI only varies by block group, so comparisons use the 53 groups as the
// unit: trees standing in each group over the group's land area
sviGroups.forEach((g, i) => {
  g.treesPerAcre = round(groupTrees[i].trees / g.areaAcres, 1);
  g.canopyShare = round(groupTrees[i].canopy / (g.areaAcres * SQ_FT_PER_ACRE), 3);
});
function ranks(xs) {
  const order = xs.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]);
  const r = new Array(xs.length);
  for (let i = 0; i < order.length; ) {
    let j = i;
    while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++;
    for (let k = i; k <= j; k++) r[order[k][1]] = (i + j) / 2;
    i = j + 1;
  }
  return r;
}
function spearman(xs, ys) {
  const [rx, ry] = [ranks(xs), ranks(ys)];
  const mx = rx.reduce((a, b) => a + b, 0) / rx.length;
  const my = ry.reduce((a, b) => a + b, 0) / ry.length;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < rx.length; i++) {
    num += (rx[i] - mx) * (ry[i] - my);
    dx += (rx[i] - mx) ** 2;
    dy += (ry[i] - my) ** 2;
  }
  return num / Math.sqrt(dx * dy);
}
const factorValue = (g, f) => (f === 'composite' ? g.composite : g.indices[f]);
const SCATTER_FACTORS = ['composite', 'seniors', 'noVehicle', 'disability', 'under5', 'poverty'];

// "look here first": high vulnerability (top two fifths), at risk on the
// 10-20-30 rule, and in the bottom quarter of blocks for canopy per 100 ft of street
const groupById = new Map(sviGroups.map((g) => [g.id, g]));
const perFt = blocks
  .filter((b) => b.canopyPer100Ft !== null)
  .map((b) => b.canopyPer100Ft)
  .sort((a, b) => a - b);
const lowCanopy = perFt[Math.floor(perFt.length / 4)];
for (const b of blocks) {
  const g = b.bg ? groupById.get(b.bg) : null;
  b.priority = Boolean(
    g &&
      g.fifth >= 4 &&
      b.status === 'risk' &&
      b.canopyPer100Ft !== null &&
      b.canopyPer100Ft < lowCanopy,
  );
}

// ---- village summary ----
const villageTopSpecies = topOf(speciesVillage);
const villageTopGenus = topOf(genusVillage);
const statusCounts = { risk: 0, cusp: 0, meets: 0, few: 0 };
for (const b of blocks) statusCounts[b.status]++;

const villageOut = {
  totalTrees: stats.total,
  blocks: blocks.length,
  species: speciesVillage.size,
  genera: genusVillage.size,
  topSpecies: { name: villageTopSpecies.name, share: round(villageTopSpecies.share, 3) },
  topGenus: { name: villageTopGenus.name, share: round(villageTopGenus.share, 3) },
  // family shares use all trees as the base (placeholder genera count as no family)
  families: familyVillage.size,
  topFamilies: [...familyVillage.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, c]) => ({
      name,
      share: round(c / stats.total, 3),
      common: familyCommon.get(name),
    })),
  topGenera: topN(genusVillage, 10, stats.total).map((g) => ({
    ...g,
    common: titleCase(mostCommon(genusWords.get(g.name))),
  })),
  topSpeciesList: topN(speciesVillage, 10, stats.total).map((sp) => ({
    ...sp,
    common: prettyCommon(mostCommon(commonNames.get(sp.name))),
  })),
  dbhClasses: DBH_CLASSES.map(([, , label], i) => ({ label, count: dbhCounts[i] })),
  shannon: round(shannon(speciesVillage, stats.total), 2),
  statusCounts,
  medianDbh: round(median(village.dbh), 1),
  meanHeight: round(mean(village.height), 0),
  meanSpread: round(mean(village.spread), 0),
  canopyAcres: round(village.canopy / SQ_FT_PER_ACRE, 0),
  treesPerAcreRho: Object.fromEntries(
    SCATTER_FACTORS.map((f) => [
      f,
      round(
        spearman(
          sviGroups.map((g) => factorValue(g, f)),
          sviGroups.map((g) => g.treesPerAcre),
        ),
        2,
      ),
    ]),
  ),
  lowCanopyPer100Ft: lowCanopy,
  // canopy cover: crown area over the village's land area (block groups tile it)
  landAcres: round(
    sviGroups.reduce((a, g) => a + g.areaAcres, 0),
    0,
  ),
  canopyCover: round(
    village.canopy / SQ_FT_PER_ACRE / sviGroups.reduce((a, g) => a + g.areaAcres, 0),
    3,
  ),
  // quintile cutoffs of canopy per 100 ft of street, for the map's canopy colors
  canopyBreaks: [0.2, 0.4, 0.6, 0.8].map((q) => perFt[Math.floor(q * (perFt.length - 1))]),
  priorityCount: blocks.filter((b) => b.priority).length,
};

const vulnerability = sviGroups.map((g) => ({
  id: g.id,
  composite: g.composite,
  rank: g.rank,
  fifth: g.fifth,
  indices: g.indices,
  areaAcres: round(g.areaAcres, 1),
  treesPerAcre: g.treesPerAcre,
  canopyShare: g.canopyShare,
  rings: turf
    .simplify(g.feature, { tolerance: 0.00002, highQuality: true })
    .geometry.coordinates.map(toLatLng),
}));

// park outlines for the map: only parks inside the village's block groups
// (drops parks across the boundary streets in Chicago and River Forest)
const parkShapes = parks
  .filter((park) => sviGroups.some((g) => turf.booleanIntersects(park, g.feature)))
  .map((park) => ({
    name: park.properties.name,
    rings: turf
      .simplify(park, { tolerance: 0.00001, highQuality: true })
      .geometry.coordinates.map(toLatLng),
  }));

// village outline for the map's outside-the-village shading
const boundary = turf
  .simplify(JSON.parse(readFileSync(BOUNDARY, 'utf8')).features[0], {
    tolerance: 0.00001,
    highQuality: true,
  })
  .geometry.coordinates.map(toLatLng);

writeFileSync(
  'public/data/block-summary.json',
  JSON.stringify({
    village: villageOut,
    boundary,
    blocks,
    parks: parkShapes,
    vulnerability,
    // readable names for every species and genus, for dashboard drilldowns
    names: {
      families: Object.fromEntries(familyCommon),
      species: Object.fromEntries(
        [...commonNames.entries()].map(([id, counts]) => [id, prettyCommon(mostCommon(counts))]),
      ),
      genera: Object.fromEntries(
        [...genusWords.entries()].map(([g, counts]) => [g, titleCase(mostCommon(counts))]),
      ),
    },
  }),
);
writeFileSync('public/data/tree-points.json', JSON.stringify(points));

// enriched copy of the tree CSV with family columns after `genus`; the
// cached source CSV is left untouched
const csvCell = (v) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const gi = idx.genus;
const enriched = rows
  .filter((r, i) => i === 0 || r.length >= header.length / 2)
  .map((r, i) => {
    const out = [...r];
    const fam = i === 0 ? 'family' : (familyOf.get((r[gi] ?? '').trim()) ?? '');
    const famCommon = i === 0 ? 'family_common' : (familyCommon.get(fam) ?? '');
    out.splice(gi + 1, 0, fam, famCommon);
    return out.map(csvCell).join(',');
  });
writeFileSync('public/data/trees-oak-park-with-family.csv', `${enriched.join('\n')}\n`);

// ---- verification report ----
console.log('--- data quality ---');
console.log(
  `total rows: ${stats.total}, bad coords: ${stats.badCoords}, outside block groups: ${stats.noGroup}`,
);
console.log(
  `blocks: ${blocks.length}; geometry by fallback: ${fallbackBlocks}; no geometry: ${noGeometry}`,
);
console.log('--- village checksums (expected 8.8% / 20.5% / 18,837) ---');
console.log(
  `top species: ${villageTopSpecies.name} ${(villageTopSpecies.share * 100).toFixed(1)}%`,
);
console.log(
  `families: ${familyVillage.size}; top ${[...familyVillage.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([f, c]) => `${f} ${((c / stats.total) * 100).toFixed(1)}%`)
    .join(
      ', ',
    )}; no family: ${[...unmappedGenera.entries()].map(([g, c]) => `${g || '(blank)'} ${c}`).join(', ')}`,
);
console.log(`top genus: ${villageTopGenus.name} ${(villageTopGenus.share * 100).toFixed(1)}%`);
console.log(
  `blocks with one genus >= 30%: any size ${blocks.filter((b) => b.topGenus.share >= 0.3).length}, >=10 trees ${statusCounts.risk} (status incl. species >= 50%)`,
);
console.log(
  `status: risk ${statusCounts.risk}, cusp ${statusCounts.cusp}, meets ${statusCounts.meets}, few ${statusCounts.few}`,
);
console.log(
  `canopy (approx): ${villageOut.canopyAcres} acres; park outlines: ${parkShapes.length}`,
);
console.log('trees/acre rank correlation by factor:', villageOut.treesPerAcreRho);
console.log(
  `look here first: ${villageOut.priorityCount} blocks (canopy < ${lowCanopy} sq ft per 100 ft of street)`,
);
