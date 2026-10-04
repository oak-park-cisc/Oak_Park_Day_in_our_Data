import type { BlockProps } from "./types";

/**
 * Red → green scale, index 0 = needs attention (low diversity, small, little shade), 3 = best.
 * Red and green are hard to tell apart with red-green color blindness, so the map also draws
 * worse bins with thicker lines (WEIGHTS) and every value is listed in the panel.
 */
export const SCALE = ["#a50026", "#f39a50", "#a9d86e", "#2e8b3e"];
export const WEIGHTS = [7, 5.5, 4, 3.5];
export const LOW_COUNT_COLOR = "#898781";

export type MetricKey =
	| "top_genus_share"
	| "top_species_share"
	| "simpson"
	| "median_dbh_in"
	| "median_height_ft"
	| "median_spread_ft"
	| "canopy_per_ft";

export type Metric = {
	key: MetricKey;
	label: string;
	/** Short note shown under the legend */
	hint: string;
	value: (b: BlockProps) => number | null;
	format: (v: number) => string;
	/** Three cut points splitting values into four bins */
	breaks: [number, number, number];
	/** Sort order that puts blocks needing attention first ("desc" = high values are worse) */
	worstFirst: "asc" | "desc";
	group: "Diversity" | "Size and shade";
};

const pct = (v: number) => `${Math.round(v * 100)}%`;

export const METRICS: Metric[] = [
	{
		key: "top_genus_share",
		label: "Top genus share",
		hint: "Share of the block's trees in its most common genus. Red = reliant on one genus; guideline is 20% max.",
		value: (b) => b.top_genus_share,
		format: pct,
		breaks: [0.2, 0.3, 0.4],
		worstFirst: "desc",
		group: "Diversity",
	},
	{
		key: "top_species_share",
		label: "Top species share",
		hint: "Share of the block's trees that are its single most common species. Red = one species dominates; guideline is 10% max.",
		value: (b) => b.top_species_share,
		format: pct,
		breaks: [0.15, 0.2, 0.3],
		worstFirst: "desc",
		group: "Diversity",
	},
	{
		key: "simpson",
		label: "Species diversity",
		hint: "Chance two trees on the block are different species. Red = low diversity, green = high.",
		value: (b) => b.simpson,
		format: (v) => v.toFixed(2),
		breaks: [0.85, 0.9, 0.93],
		worstFirst: "asc",
		group: "Diversity",
	},
	{
		key: "median_dbh_in",
		label: "Median trunk diameter",
		hint: "Diameter at breast height (DBH), the inventory's only size measure. Red = small trees.",
		value: (b) => b.median_dbh_in,
		format: (v) => `${v} in`,
		breaks: [10, 14, 18],
		worstFirst: "asc",
		group: "Size and shade",
	},
	{
		key: "median_height_ft",
		label: "Median height",
		hint: "Recorded in 10 ft classes. Red = short trees.",
		value: (b) => b.median_height_ft,
		format: (v) => `${v} ft`,
		breaks: [20, 30, 40],
		worstFirst: "asc",
		group: "Size and shade",
	},
	{
		key: "median_spread_ft",
		label: "Median crown spread",
		hint: "Crown width, recorded in 10 ft classes; the best single shade indicator. Red = narrow crowns.",
		value: (b) => b.median_spread_ft,
		format: (v) => `${v} ft`,
		breaks: [20, 30, 40],
		worstFirst: "asc",
		group: "Size and shade",
	},
	{
		key: "canopy_per_ft",
		label: "Canopy per foot of street",
		hint: "Crown area from recorded spread per foot of street; overlap not removed. Red = little shade.",
		value: (b) => (b.street_length_ft ? b.canopy_sqft / b.street_length_ft : null),
		format: (v) => `${Math.round(v)} sq ft`,
		breaks: [15, 25, 35],
		worstFirst: "asc",
		group: "Size and shade",
	},
];

/** Bin index by ascending value, 0–3 */
const binOf = (breaks: readonly number[], v: number) => {
	const i = breaks.findIndex((cut) => v < cut);
	return i === -1 ? 3 : i;
};

/**
 * 0 = needs attention (red) … 3 = best (green), or null when there's too little data.
 * includeSmall colors blocks under 10 trees too (used while the majority flag is on).
 */
export function quality(metric: Metric, b: BlockProps, includeSmall = false): number | null {
	const v = metric.value(b);
	if ((b.low_count && !includeSmall) || v == null) return null;
	const i = binOf(metric.breaks, v);
	return metric.worstFirst === "desc" ? 3 - i : i;
}

export function binColor(metric: Metric, b: BlockProps, includeSmall = false): string {
	const q = quality(metric, b, includeSmall);
	return q == null ? LOW_COUNT_COLOR : SCALE[q];
}

export function binWeight(metric: Metric, b: BlockProps, includeSmall = false): number {
	const q = quality(metric, b, includeSmall);
	return q == null ? 4 : WEIGHTS[q];
}

export type LegendItem = { label: string; color: string; weight: number };

/** Legend rows ordered red (needs attention) → green */
function itemsFor(labels: string[], worstHigh: boolean): LegendItem[] {
	const items = labels.map((label, i) => {
		const q = worstHigh ? 3 - i : i;
		return { label, color: SCALE[q], weight: WEIGHTS[q], q };
	});
	return items.sort((a, b) => a.q - b.q).map(({ q: _q, ...rest }) => rest);
}

const rangeLabels = (breaks: readonly number[], f: (v: number) => string) => {
	const [a, b, c] = breaks.map(f);
	return [`< ${a}`, `${a}–${b}`, `${b}–${c}`, `≥ ${c}`];
};

export function legendItems(metric: Metric): LegendItem[] {
	return itemsFor(rangeLabels(metric.breaks, metric.format), metric.worstFirst === "desc");
}
/** "MAPLE-NORWAY" → "Maple, Norway" */
export function niceName(raw: string): string {
	if (!raw) return "Unknown";
	return raw
		.toLowerCase()
		.split("-")
		.map((s) => s.trim())
		.filter(Boolean)
		.join(", ")
		.replace(/^./, (c) => c.toUpperCase());
}

/** Zones are shaded by the share of their blocks (10+ trees) where one genus is 30% or more (high = red). */
export const ZONE_BREAKS: [number, number, number] = [0.2, 0.25, 0.3];

export function zoneColor(share: number | null): string {
	if (share == null) return LOW_COUNT_COLOR;
	return SCALE[3 - binOf(ZONE_BREAKS, share)];
}

export const zoneLegend = () => itemsFor(rangeLabels(ZONE_BREAKS, pct), true);

/** Genus colors for individual trees: the three most common nearby get categorical slots, the rest gray. */
export const TREE_COLORS = ["#2a78d6", "#eb6834", "#1baf7a"];
export const OTHER_TREE_COLOR = "#898781";

/** Satellite tree-cover bins (percent of each 250 m cell); low cover = red. */
export const COVER_BREAKS: [number, number, number] = [10, 14, 18];

export function coverColor(v: number | null): string {
	if (v == null) return LOW_COUNT_COLOR;
	return SCALE[binOf(COVER_BREAKS, v)];
}

export const coverLegend = () =>
	itemsFor(
		rangeLabels(COVER_BREAKS, (v) => `${v}%`),
		false,
	);

/** Value shown for a cell: the recent average, or a single year. */
export function cellValue(cover: (number | null)[], recentMean: number | null, yearIdx: number | null) {
	return yearIdx == null ? recentMean : cover[yearIdx];
}
