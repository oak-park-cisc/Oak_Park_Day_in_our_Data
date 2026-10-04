import type { BlockProps } from "./types";

export type Majority = {
	on: boolean;
	/** Compare the block's single most common species, or its most common genus */
	basis: "species" | "genus";
	/** Share of the block's trees, 0–1 */
	threshold: number;
	minTrees: number;
};

export const DEFAULT_MAJORITY: Majority = { on: false, basis: "species", threshold: 0.55, minTrees: 1 };

export const majorityShare = (b: BlockProps, m: Majority) =>
	m.basis === "species" ? b.top_species_share : b.top_genus_share;

/** True when one species (or genus) makes up at least the threshold share of the block's trees. */
export const meetsMajority = (b: BlockProps, m: Majority) =>
	b.trees >= m.minTrees && majorityShare(b, m) >= m.threshold;

export function majorityLabel(m: Majority) {
	return `one ${m.basis} ≥ ${Math.round(m.threshold * 100)}%${m.minTrees > 1 ? `, ${m.minTrees}+ trees` : ""}`;
}
