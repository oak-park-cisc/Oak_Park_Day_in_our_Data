import type { Confidence, Tree } from "./types";

export const CONFIDENCE: Record<
	Confidence,
	{ label: string; color: string; size: number; blurb: string }
> = {
	likely: {
		label: "Likely",
		color: "#104281",
		size: 22,
		blurb: "Long-lived species, wide margin past 200 years, supporting history",
	},
	possible: {
		label: "Possible",
		color: "#2a78d6",
		size: 17,
		blurb: "Some evidence points to 200+ years",
	},
	long_shot: {
		label: "Long shot",
		color: "#86b6ef",
		size: 13,
		blurb: "Only the highest estimate reaches 200 years",
	},
};

export const CONFIDENCE_ORDER: Confidence[] = [
	"likely",
	"possible",
	"long_shot",
];

export function ageRange(t: Tree) {
	return `${t.age_low}–${t.age_high} yrs`;
}

export function circumference(t: Tree) {
	const c = t.circumference;
	return `${c.ft} ft ${c.rem_in} in (${c.in} in)`;
}

export function feet(v: number | null) {
	return v == null ? "Not recorded" : `~${v} ft`;
}

export function place(t: Tree) {
	if (t.park) return `${t.park} park`;
	return t.address ? `~${t.address}` : (t.block ?? "");
}

export function rankText(t: Tree) {
	const name = t.common.toLowerCase();
	if (t.rank === 1) return `Largest ${name} in Oak Park's public inventories`;
	return `#${t.rank} by trunk size of ${t.rank_of.toLocaleString()} public ${name}s`;
}

export const SETTLEMENT_YEAR = 1833;
const CURRENT_YEAR = 2026;

export const PRESENT_RING = "#d99a06";

/**
 * "Likely present at settlement": a Likely-confidence tree whose age-range midpoint
 * reaches back to 1833.
 */
export function presentAtSettlement(t: Tree) {
	const mid = (t.age_low + t.age_high) / 2;
	return t.confidence === "likely" && mid >= CURRENT_YEAR - SETTLEMENT_YEAR;
}

/** Google Street View at the tree's street, facing it; park trees open at the tree itself. */
export function streetViewUrl(t: Tree) {
	const sv = t.street_view;
	const p = new URLSearchParams({
		api: "1",
		map_action: "pano",
		viewpoint: sv ? `${sv.lat},${sv.lon}` : `${t.lat},${t.lon}`,
	});
	if (sv) p.set("heading", String(sv.heading));
	return `https://www.google.com/maps/@?${p}`;
}
