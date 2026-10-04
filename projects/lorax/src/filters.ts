import type { BlockProps } from "./types";

export type Filters = {
	/** Minimum top-genus share, 0–1 */
	minShare: number;
	/** Minimum top-species share, 0–1 */
	minSpeciesShare: number;
	/** Maximum Simpson diversity, or null for any */
	maxSimpson: number | null;
	/** Dominant (top) genus, or "" for any */
	genus: string;
	/** D97 zone, or "" for any */
	zone: string;
	minTrees: number;
};

export const DEFAULT_FILTERS: Filters = {
	minShare: 0,
	minSpeciesShare: 0,
	maxSimpson: null,
	genus: "",
	zone: "",
	minTrees: 10,
};

export function activeFilterCount(f: Filters): number {
	return (
		Number(f.minShare > 0) +
		Number(f.minSpeciesShare > 0) +
		Number(f.maxSimpson != null) +
		Number(f.genus !== "") +
		Number(f.zone !== "") +
		Number(f.minTrees !== DEFAULT_FILTERS.minTrees)
	);
}

export function applyFilters(blocks: BlockProps[], f: Filters, query: string): BlockProps[] {
	const q = query.trim().toUpperCase();
	return blocks.filter(
		(b) =>
			b.trees >= f.minTrees &&
			b.top_genus_share >= f.minShare &&
			b.top_species_share >= f.minSpeciesShare &&
			(f.maxSimpson == null || b.simpson < f.maxSimpson) &&
			(!f.genus || b.top_genus === f.genus) &&
			(!f.zone || b.zone === f.zone) &&
			(!q || b.block.includes(q)),
	);
}

const COLUMNS: (keyof BlockProps)[] = [
	"block",
	"zone",
	"trees",
	"species_count",
	"genus_count",
	"top_genus",
	"top_genus_common",
	"top_genus_share",
	"top_species",
	"top_species_latin",
	"top_species_share",
	"simpson",
	"shannon",
	"genus_30pct_plus",
	"median_dbh_in",
	"median_height_ft",
	"median_spread_ft",
	"canopy_sqft",
	"street_length_ft",
];

/** Downloads the given blocks as a CSV file. */
export function downloadCsv(blocks: BlockProps[], filename: string) {
	const cell = (v: unknown) => {
		const s = v == null ? "" : String(v);
		return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
	};
	const csv = [COLUMNS.join(","), ...blocks.map((b) => COLUMNS.map((c) => cell(b[c])).join(","))].join("\n");
	const url = URL.createObjectURL(new Blob([`${csv}\n`], { type: "text/csv" }));
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}
