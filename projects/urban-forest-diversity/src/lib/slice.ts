import { median } from './stats';
import { STATUS_ORDER } from './status';
import type { AppData, BlockStatus, GenusShare, TreePoint } from './types';

export interface Filters {
  fifth: number | null;
  status: BlockStatus | null;
  genus: string | null;
  species: string | null;
  size: number | null;
}

export const NO_FILTERS: Filters = {
  fifth: null,
  status: null,
  genus: null,
  species: null,
  size: null,
};

// trunk-diameter classes in inches, matching scripts/compute-blocks.mjs
export const SIZE_CLASSES: [number, number, string][] = [
  [0, 6, '0–6"'],
  [6, 12, '6–12"'],
  [12, 18, '12–18"'],
  [18, 24, '18–24"'],
  [24, 30, '24–30"'],
  [30, Number.POSITIVE_INFINITY, '30"+'],
];
const sizeClass = (d: number | null) =>
  d === null || d <= 0 ? -1 : SIZE_CLASSES.findIndex(([lo, hi]) => d >= lo && d < hi);

const SQ_FT_PER_ACRE = 43560;

export interface Slice {
  trees: number;
  blocks: number;
  species: number;
  genera: number;
  canopyAcres: number;
  medianDbh: number | null;
  topSpecies: GenusShare | null;
  topGenus: GenusShare | null;
  topFamily: GenusShare | null;
  genera10: GenusShare[];
  species10: GenusShare[];
  sizes: number[];
  statusCounts: Record<BlockStatus, number>;
  seniors: { level: number; value: number | null; groups: number }[];
  priority: number;
  // crown area over land area; only defined when the selection is a whole
  // area (no filters, or only the vulnerability filter)
  canopyCover: number | null;
  // genera ranked by share of canopy, each with its share of trees
  canopyGenera: { name: string; common?: string; canopy: number; trees: number }[];
  // per trunk-size class: share of trees and share of canopy
  canopySizes: { trees: number; canopy: number }[];
  // genus counts per trunk-size class (skips the size and genus filters so the
  // full mix stays visible and a chosen genus can be highlighted within it)
  sizeMix: { total: number; genera: Map<string, number> }[];
}

function top(counts: Map<string, number>, n: number, total: number, names: Record<string, string>) {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, c]) => ({ name, share: total ? c / total : 0, common: names[name] }));
}

// Cross-filtered statistics. Each chart ignores its own filter ("skip") so the
// other bars stay visible to pick from; everything else applies all filters.
export function slice(data: AppData, f: Filters): Slice {
  const { blocks, points, vulnerability, names } = data;
  const treeOk = (t: TreePoint, skip?: 'genus' | 'species' | 'size') =>
    (skip === 'genus' || !f.genus || t.g === f.genus) &&
    (skip === 'species' || !f.species || t.p === f.species) &&
    (skip === 'size' || f.size === null || sizeClass(t.d) === f.size);
  // a tree's vulnerability fifth is that of the block group it stands in;
  // its status is its street block's
  const treeAreaOk = (t: TreePoint, skipStatus = false) => {
    if (f.fifth && vulnerability[t.q]?.fifth !== f.fifth) return false;
    if (!skipStatus && f.status && blocks[t.k]?.status !== f.status) return false;
    return true;
  };
  const match = (t: TreePoint, skip?: 'genus' | 'species' | 'size' | 'status') =>
    treeAreaOk(t, skip === 'status') && treeOk(t, skip === 'status' ? undefined : skip);

  const sel = points.filter((t) => match(t));
  const speciesCounts = new Map<string, number>();
  const familyCounts = new Map<string, number>();
  const genusCounts = new Map<string, number>();
  const dbh: number[] = [];
  let canopy = 0;
  const blocksHit = new Set<number>();
  for (const t of sel) {
    speciesCounts.set(t.p, (speciesCounts.get(t.p) ?? 0) + 1);
    genusCounts.set(t.g, (genusCounts.get(t.g) ?? 0) + 1);
    if (t.f) familyCounts.set(t.f, (familyCounts.get(t.f) ?? 0) + 1);
    if (t.d !== null && t.d > 0) dbh.push(t.d);
    if (t.w !== null) canopy += Math.PI * (t.w / 2) ** 2;
    if (t.k >= 0) blocksHit.add(t.k);
  }

  const countBy = (skip: 'genus' | 'species', key: 'g' | 'p') => {
    const m = new Map<string, number>();
    let n = 0;
    for (const t of points) {
      if (!match(t, skip)) continue;
      m.set(t[key], (m.get(t[key]) ?? 0) + 1);
      n++;
    }
    return { m, n };
  };
  const g = countBy('genus', 'g');
  const sp = countBy('species', 'p');

  const sizes = SIZE_CLASSES.map(() => 0);
  for (const t of points) {
    const c = sizeClass(t.d);
    if (c >= 0 && match(t, 'size')) sizes[c] = (sizes[c] ?? 0) + 1;
  }

  // blocks are counted through their selected trees, so block totals agree
  // with the tree selection (the status chart skips its own filter)
  const blocksFor = (skip?: 'status') => {
    const set = new Set<number>();
    for (const t of points) if (t.k >= 0 && match(t, skip)) set.add(t.k);
    return set;
  };
  const statusBlocks = blocksFor('status');
  const statusCounts = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])) as Record<
    BlockStatus,
    number
  >;
  for (const k of statusBlocks) {
    const b = blocks[k];
    if (b) statusCounts[b.status]++;
  }
  const priority = [...blocksHit].filter((k) => blocks[k]?.priority).length;

  // trees per acre by seniors level: selected trees standing in each block
  // group over the group's land area
  const count = vulnerability.map(() => 0);
  for (const t of sel) if (t.q >= 0) count[t.q] = (count[t.q] ?? 0) + 1;
  const seniors = [1, 2, 3, 4, 5].map((level) => {
    const vals = vulnerability
      .map((grp, i) => ({ grp, i }))
      .filter(({ grp }) => grp.indices.seniors === level && (!f.fifth || grp.fifth === f.fifth))
      .map(({ grp, i }) => (count[i] ?? 0) / grp.areaAcres);
    return { level, value: vals.length ? median(vals) : null, groups: vals.length };
  });

  // canopy by genus (skips its own genus filter, like the genera chart)
  const gc = new Map<string, { n: number; c: number }>();
  let gN = 0;
  let gC = 0;
  for (const t of points) {
    if (!match(t, 'genus')) continue;
    const c = t.w === null ? 0 : Math.PI * (t.w / 2) ** 2;
    const o = gc.get(t.g) ?? { n: 0, c: 0 };
    o.n++;
    o.c += c;
    gc.set(t.g, o);
    gN++;
    gC += c;
  }
  const canopyGenera = [...gc.entries()]
    .sort((a, b) => b[1].c - a[1].c)
    .slice(0, 8)
    .map(([name, o]) => ({
      name,
      common: names.genera[name],
      canopy: gC ? o.c / gC : 0,
      trees: gN ? o.n / gN : 0,
    }));

  // canopy by trunk size (skips its own size filter)
  const sz = SIZE_CLASSES.map(() => ({ n: 0, c: 0 }));
  let sN = 0;
  let sC = 0;
  for (const t of points) {
    const k = sizeClass(t.d);
    if (k < 0 || !match(t, 'size')) continue;
    const c = t.w === null ? 0 : Math.PI * (t.w / 2) ** 2;
    const o = sz[k];
    if (!o) continue;
    o.n++;
    o.c += c;
    sN++;
    sC += c;
  }
  const canopySizes = sz.map((o) => ({ trees: sN ? o.n / sN : 0, canopy: sC ? o.c / sC : 0 }));

  const sizeMix = SIZE_CLASSES.map(() => ({ total: 0, genera: new Map<string, number>() }));
  for (const t of points) {
    const k = sizeClass(t.d);
    const row = sizeMix[k];
    if (!row) continue;
    if (!treeAreaOk(t)) continue;
    row.total++;
    row.genera.set(t.g, (row.genera.get(t.g) ?? 0) + 1);
  }

  const onlyArea = !f.status && !f.genus && !f.species && f.size === null;
  const land = vulnerability
    .filter((g) => !f.fifth || g.fifth === f.fifth)
    .reduce((a, g) => a + g.areaAcres, 0);
  const canopyCover = onlyArea && land ? canopy / SQ_FT_PER_ACRE / land : null;

  return {
    canopyCover,
    canopyGenera,
    canopySizes,
    sizeMix,
    trees: sel.length,
    blocks: blocksHit.size,
    species: speciesCounts.size,
    genera: genusCounts.size,
    canopyAcres: canopy / SQ_FT_PER_ACRE,
    medianDbh: dbh.length ? median(dbh) : null,
    topSpecies: top(speciesCounts, 1, sel.length, names.species)[0] ?? null,
    topGenus: top(genusCounts, 1, sel.length, names.genera)[0] ?? null,
    topFamily: top(familyCounts, 1, sel.length, names.families)[0] ?? null,
    genera10: top(g.m, 10, g.n, names.genera),
    species10: top(sp.m, 10, sp.n, names.species),
    sizes,
    statusCounts,
    seniors,
    priority,
  };
}
