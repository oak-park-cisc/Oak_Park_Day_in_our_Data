import { type Bounds, boundsAreaSqft, canopyEstimate } from "./canopy";
import type { BlockProps, ModisData, TreesData } from "./types";

export type AreaTree = {
	lat: number;
	lon: number;
	common: string;
	latin: string;
	genus: string;
	dbh: number | null;
	height: number | null;
	spread: number | null;
	block: string;
};

export type AreaResult = {
	bounds: Bounds;
	areaSqft: number;
	trees: AreaTree[];
	speciesCount: number;
	genusCount: number;
	simpson: number | null;
	topSpecies: { common: string; latin: string; n: number; share: number } | null;
	/** [genus, familiar label, count], most common first */
	genera: [string, string, number][];
	/** [common, latin, count], most common first */
	species: [string, string, number][];
	medians: { dbh: number | null; height: number | null; spread: number | null };
	dbhClasses: { label: string; n: number }[];
	canopy: { crownSumSqft: number; coveredSqft: number; coverPct: number };
	/** Blocks with at least one tree in the area */
	blocks: BlockProps[];
	zones: { zone: string; n: number }[];
	satellite: { cells: number; meanCover: number | null } | null;
};

const DBH_CLASSES: [string, number, number][] = [
	["< 6 in", 0, 6],
	["6–12 in", 6, 12],
	["12–18 in", 12, 18],
	["18–24 in", 18, 24],
	["24–30 in", 24, 30],
	["30+ in", 30, Infinity],
];

function median(values: (number | null)[]) {
	const v = values.filter((x): x is number => x != null && x > 0).sort((a, b) => a - b);
	if (!v.length) return null;
	const m = Math.floor(v.length / 2);
	return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

function tally<T extends string>(items: T[]) {
	const counts = new Map<T, number>();
	for (const k of items) counts.set(k, (counts.get(k) ?? 0) + 1);
	return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export const inBounds = (b: Bounds, lat: number, lon: number) =>
	lat >= b.south && lat <= b.north && lon >= b.west && lon <= b.east;

/** Everything the app knows about the public trees whose trunks fall inside the rectangle. */
export function analyzeArea(
	bounds: Bounds,
	data: TreesData,
	blocks: BlockProps[],
	modis: ModisData | null,
	keepBlock?: (block: string) => boolean,
): AreaResult {
	const trees: AreaTree[] = [];
	for (const [lat, lon, sp, dbh, height, spread, bi] of data.trees) {
		if (!inBounds(bounds, lat, lon)) continue;
		const block = data.blocks[bi];
		if (keepBlock && !keepBlock(block)) continue;
		const [common, latin, genus] = data.species[sp];
		trees.push({ lat, lon, common, latin, genus, dbh, height, spread, block });
	}
	const n = trees.length;
	const areaSqft = boundsAreaSqft(bounds);

	const speciesKey = (t: AreaTree) => t.latin || t.common;
	const commonFor = new Map<string, string>();
	for (const t of trees) if (!commonFor.has(speciesKey(t))) commonFor.set(speciesKey(t), t.common);
	const speciesTally = tally(trees.map(speciesKey));
	const genusTally = tally(trees.map((t) => t.genus));
	const simpson = n ? 1 - speciesTally.reduce((s, [, c]) => s + (c / n) ** 2, 0) : null;

	const canopy = canopyEstimate(trees, bounds);
	const blockSet = new Set(trees.map((t) => t.block));
	const areaBlocks = blocks.filter((b) => blockSet.has(b.block));
	const zoneOf = new Map(blocks.map((b) => [b.block, b.zone]));

	let satellite: AreaResult["satellite"] = null;
	if (modis) {
		// Cells whose center falls inside the rectangle
		const cells = modis.features.filter((f) => {
			const ring = f.geometry.coordinates[0].slice(0, 4);
			const lat = ring.reduce((s, p) => s + p[1], 0) / 4;
			const lon = ring.reduce((s, p) => s + p[0], 0) / 4;
			return inBounds(bounds, lat, lon);
		});
		const vals = cells.map((c) => c.properties.recent_mean).filter((v): v is number => v != null);
		satellite = {
			cells: cells.length,
			meanCover: vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null,
		};
	}

	return {
		bounds,
		areaSqft,
		trees,
		speciesCount: speciesTally.length,
		genusCount: genusTally.length,
		simpson,
		topSpecies: n
			? {
					common: commonFor.get(speciesTally[0][0]) || speciesTally[0][0],
					latin: speciesTally[0][0],
					n: speciesTally[0][1],
					share: speciesTally[0][1] / n,
				}
			: null,
		genera: genusTally.map(([g, c]) => [g, data.genusLabels[g] ?? "", c]),
		species: speciesTally.map(([k, c]) => [commonFor.get(k) || k, k, c]),
		medians: {
			dbh: median(trees.map((t) => t.dbh)),
			height: median(trees.map((t) => t.height)),
			spread: median(trees.map((t) => t.spread)),
		},
		dbhClasses: DBH_CLASSES.map(([label, lo, hi]) => ({
			label,
			n: trees.filter((t) => t.dbh != null && t.dbh >= lo && t.dbh < hi).length,
		})),
		canopy: {
			crownSumSqft: Math.round(canopy.crownSumSqft),
			coveredSqft: Math.round(canopy.coveredSqft),
			coverPct: areaSqft ? (canopy.coveredSqft / areaSqft) * 100 : 0,
		},
		blocks: areaBlocks,
		zones: tally(trees.map((t) => zoneOf.get(t.block) ?? "Unknown")).map(([zone, c]) => ({ zone, n: c })),
		satellite,
	};
}

/** Downloads the trees in the area as CSV. */
export function downloadAreaTrees(r: AreaResult) {
	const cols = [
		"latitude",
		"longitude",
		"common_name",
		"latin_name",
		"genus",
		"dbh_in",
		"height_ft",
		"spread_ft",
		"block",
	];
	const cell = (v: unknown) => {
		const s = v == null ? "" : String(v);
		return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
	};
	const rows = r.trees.map((t) =>
		[t.lat, t.lon, t.common, t.latin, t.genus, t.dbh, t.height, t.spread, t.block].map(cell).join(","),
	);
	const url = URL.createObjectURL(new Blob([`${[cols.join(","), ...rows].join("\n")}\n`], { type: "text/csv" }));
	const a = document.createElement("a");
	a.href = url;
	a.download = "oak-park-trees-in-area.csv";
	a.click();
	URL.revokeObjectURL(url);
}
