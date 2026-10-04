import type { Tree } from "./data";
import { genusName } from "./names";
import { groupBy, isKnownGenus, speciesKey } from "./stats";

/** Inputs stay as strings so half-typed values survive re-renders. */
export type TreeFilter = {
	min: string;
	max: string;
	kind: string; // "" | "g:<Genus>" | "s:<species key>"
	area: { type: "block" | "zone"; id: string } | null;
	itree: boolean; // only trees with i-Tree Stormwater results
};

export const NO_FILTER: TreeFilter = {
	min: "",
	max: "",
	kind: "",
	area: null,
	itree: false,
};

export const isFiltered = (f: TreeFilter) =>
	f.itree || f.min !== "" || f.max !== "" || f.kind !== "" || f.area !== null;

const toNum = (v: string) => {
	const n = Number.parseFloat(v);
	return Number.isFinite(n) ? n : null;
};

export function applyFilter(trees: Tree[], f: TreeFilter): Tree[] {
	if (!isFiltered(f)) return trees;
	const min = toNum(f.min);
	const max = toNum(f.max);
	const genus = f.kind.startsWith("g:") ? f.kind.slice(2) : null;
	const species = f.kind.startsWith("s:") ? f.kind.slice(2) : null;
	return trees.filter((t) => {
		if (f.itree && !t.stormwater) return false;
		if (f.area && (f.area.type === "block" ? t.block : t.zone) !== f.area.id)
			return false;
		if (genus && t.genus !== genus) return false;
		if (species && speciesKey(t) !== species) return false;
		if (min !== null || max !== null) {
			if (t.dbh === null) return false;
			if (min !== null && t.dbh < min) return false;
			if (max !== null && t.dbh > max) return false;
		}
		return true;
	});
}

export type KindOption = { value: string; label: string; count: number };

/** Genus and species choices for the filter, most common first. */
export function kindOptions(trees: Tree[]) {
	const known = trees.filter((t) => isKnownGenus(t.genus));
	const genera: KindOption[] = [...groupBy(known, (t) => t.genus)]
		.map(([g, list]) => ({
			value: `g:${g}`,
			label: `${g} (${genusName(g)})`,
			count: list.length,
		}))
		.sort((a, b) => b.count - a.count);
	const species: KindOption[] = [...groupBy(known, speciesKey)]
		.map(([key, list]) => ({
			value: `s:${key}`,
			label: key,
			count: list.length,
		}))
		.sort((a, b) => b.count - a.count);
	return { genera, species };
}
