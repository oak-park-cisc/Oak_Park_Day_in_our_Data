import type { Tree } from "./data";
import { crownSqFt, type SizeGroup } from "./estimates";

export const MIN_TREES = 10; // smaller blocks are too small to judge diversity

export type Status = "good" | "warning" | "critical" | "few";

export const STATUS_LABELS: Record<Status, string> = {
	good: "Diverse: top genus under 20%",
	warning: "Watch: top genus 20–30%",
	critical: "Reliant: one genus 30%+",
	few: `Fewer than ${MIN_TREES} trees`,
};

export type SpeciesCount = { name: string; genus: string; count: number };

export type Stats = {
	count: number;
	species: number;
	genera: number;
	topGenus: { name: string; share: number } | null;
	topSpecies: { name: string; share: number } | null;
	shannon: number;
	genusCounts: [string, number][];
	speciesCounts: SpeciesCount[];
	sizes: Record<SizeGroup, number>;
	co2Lbs: number;
	crownSqFt: number;
	status: Status;
};

export const isKnownGenus = (g: string) =>
	g !== "" && g !== "STUMP" && g !== "UNKNOWN";

// Species are counted by normalized Latin name (cultivars folded into their species).
export const speciesKey = (t: Tree) => t.species;

export function summarize(all: Tree[]): Stats {
	const trees = all.filter((t) => isKnownGenus(t.genus));
	const genus = new Map<string, number>();
	const species = new Map<string, SpeciesCount>();
	const sizes: Record<SizeGroup, number> = { small: 0, medium: 0, large: 0 };
	let co2 = 0;
	let crown = 0;
	for (const t of trees) {
		genus.set(t.genus, (genus.get(t.genus) ?? 0) + 1);
		const key = speciesKey(t);
		const s = species.get(key) ?? { name: key, genus: t.genus, count: 0 };
		s.count++;
		species.set(key, s);
		if (t.size) sizes[t.size]++;
		co2 += t.co2 ?? 0;
		crown += crownSqFt(t.spread);
	}
	const n = trees.length;
	const genusCounts = [...genus.entries()].sort((a, b) => b[1] - a[1]);
	const speciesCounts = [...species.values()].sort((a, b) => b.count - a.count);
	const topSp = speciesCounts[0];
	let shannon = 0;
	for (const { count } of species.values()) {
		const p = count / n;
		shannon -= p * Math.log(p);
	}
	const topGenus = n
		? { name: genusCounts[0][0], share: genusCounts[0][1] / n }
		: null;
	return {
		count: n,
		species: species.size,
		genera: genus.size,
		topGenus,
		topSpecies: topSp ? { name: topSp.name, share: topSp.count / n } : null,
		shannon,
		genusCounts,
		speciesCounts,
		sizes,
		co2Lbs: co2,
		crownSqFt: crown,
		status: statusFor(n, topGenus?.share ?? 0),
	};
}

export function statusFor(count: number, topShare: number): Status {
	if (count < MIN_TREES) return "few";
	if (topShare >= 0.3) return "critical";
	if (topShare >= 0.2) return "warning";
	return "good";
}

export function groupBy(trees: Tree[], key: (t: Tree) => string) {
	const groups = new Map<string, Tree[]>();
	for (const t of trees) {
		const k = key(t);
		const list = groups.get(k);
		if (list) list.push(t);
		else groups.set(k, [t]);
	}
	return groups;
}
