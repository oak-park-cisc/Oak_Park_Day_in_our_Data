import { OTHER_TREE_COLOR, TREE_COLORS } from "./metrics";
import type { TreesData } from "./types";

export type Center = { lat: number; lon: number; label: string };

export type NearTree = {
	idx: number;
	lat: number;
	lon: number;
	distFt: number;
	common: string;
	latin: string;
	genus: string;
	dbh: number | null;
	height: number | null;
	spread: number | null;
	block: string;
	color: string;
};

export type Nearby = {
	trees: NearTree[];
	/** Top three genera nearby with their map colors, then "Other" */
	legend: { genus: string; label: string; color: string; count: number }[];
	speciesCount: number;
	canopySqft: number;
};

const FT_PER_DEG_LAT = 364_000;
const FT_PER_DEG_LON = 364_000 * Math.cos((41.88 * Math.PI) / 180);

/** keepBlock, when given, drops trees whose block it rejects (e.g. blocks hidden by the majority flag). */
export function findNearby(
	data: TreesData,
	center: Center,
	radiusFt: number,
	keepBlock?: (block: string) => boolean,
): Nearby {
	const found: Omit<NearTree, "color">[] = [];
	data.trees.forEach(([lat, lon, sp, dbh, height, spread, block], idx) => {
		const dy = (lat - center.lat) * FT_PER_DEG_LAT;
		const dx = (lon - center.lon) * FT_PER_DEG_LON;
		if (Math.abs(dy) > radiusFt || Math.abs(dx) > radiusFt) return;
		const distFt = Math.hypot(dx, dy);
		if (distFt > radiusFt) return;
		if (keepBlock && !keepBlock(data.blocks[block])) return;
		const [common, latin, genus] = data.species[sp];
		found.push({ idx, lat, lon, distFt, common, latin, genus, dbh, height, spread, block: data.blocks[block] });
	});
	found.sort((a, b) => a.distFt - b.distFt);

	const counts = new Map<string, number>();
	for (const t of found) counts.set(t.genus, (counts.get(t.genus) ?? 0) + 1);
	const ranked = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
	const colorFor = new Map(ranked.slice(0, TREE_COLORS.length).map(([g], i) => [g, TREE_COLORS[i]]));
	const legend = ranked.slice(0, TREE_COLORS.length).map(([genus, count], i) => ({
		genus,
		label: data.genusLabels[genus] ?? "",
		color: TREE_COLORS[i],
		count,
	}));
	const otherCount = ranked.slice(TREE_COLORS.length).reduce((s, [, c]) => s + c, 0);
	if (otherCount) legend.push({ genus: "Other", label: "", color: OTHER_TREE_COLOR, count: otherCount });

	return {
		trees: found.map((t) => ({ ...t, color: colorFor.get(t.genus) ?? OTHER_TREE_COLOR })),
		legend,
		speciesCount: new Set(found.map((t) => t.latin || t.common)).size,
		canopySqft: Math.round(found.reduce((s, t) => s + (t.spread ? Math.PI * (t.spread / 2) ** 2 : 0), 0)),
	};
}
