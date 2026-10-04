import type { AddressSegment } from "./types";

const ABBREV: Record<string, string> = {
	NORTH: "N",
	SOUTH: "S",
	EAST: "E",
	WEST: "W",
	AVENUE: "AVE",
	AV: "AVE",
	STREET: "ST",
	BOULEVARD: "BLVD",
	COURT: "CT",
	PLACE: "PL",
	LANE: "LN",
	ROAD: "RD",
	DRIVE: "DR",
	TERRACE: "TER",
	TRAIL: "TRL",
};
const DIRS = new Set(["N", "S", "E", "W"]);
const SUFFIXES = new Set(["AVE", "ST", "BLVD", "CT", "PL", "LN", "RD", "DR", "TER", "TRL"]);

export type GeocodeResult = { lat: number; lon: number; label: string } | { error: string };

/**
 * Finds a house number on Oak Park's street centerlines by interpolating within the
 * segment's address range. Runs entirely in the browser; results are approximate.
 */
export function geocode(input: string, segments: AddressSegment[]): GeocodeResult {
	const text = input.toUpperCase().split(",")[0].replace(/[.#]/g, " ");
	const m = text.match(/^\s*(\d+)\s+(.+)$/);
	if (!m) return { error: "Enter a house number and street, e.g. 1043 N Kenilworth Ave." };
	const num = Number(m[1]);
	const words = m[2]
		.split(/\s+/)
		.filter(Boolean)
		.map((w) => ABBREV[w] ?? w)
		.filter((w) => w !== "OAK" && w !== "PARK" && w !== "IL" && !/^\d{5}$/.test(w));
	// Core name words must all match; direction and suffix only need to match when given.
	const core = words.filter((w) => !DIRS.has(w) && !SUFFIXES.has(w));
	if (!core.length) return { error: "Enter a street name." };
	const dir = words.find((w) => DIRS.has(w));
	const suffix = words.find((w) => SUFFIXES.has(w));

	const candidates = segments.filter(([name]) => {
		const parts = name.split(" ");
		const nameCore = parts.filter((w) => !DIRS.has(w) && !SUFFIXES.has(w));
		return (
			core.every((w) => nameCore.includes(w)) &&
			nameCore.length === core.length &&
			(!dir || parts.includes(dir)) &&
			(!suffix || parts.includes(suffix))
		);
	});
	if (!candidates.length) return { error: `No Oak Park street matches "${m[2].trim()}".` };

	// Pick the segment whose range contains the number (matching odd/even side first),
	// otherwise the closest range on that street.
	let best: { seg: AddressSegment; from: number; to: number; miss: number } | null = null;
	for (const seg of candidates) {
		for (const [from, to] of [
			[seg[1], seg[2]],
			[seg[3], seg[4]],
		]) {
			if (from <= 0 || to <= 0) continue;
			const lo = Math.min(from, to);
			const hi = Math.max(from, to);
			const parity = from % 2 === num % 2 ? 0 : 0.5;
			const miss = (num < lo ? lo - num : num > hi ? num - hi : 0) + parity;
			if (!best || miss < best.miss) best = { seg, from, to, miss };
		}
	}
	if (!best || best.miss > 100) return { error: `${num} is outside the address ranges for that street.` };

	const t = best.to === best.from ? 0.5 : Math.min(1, Math.max(0, (num - best.from) / (best.to - best.from)));
	const [lat, lon] = pointAlong(best.seg[5], t);
	return { lat, lon, label: `${num} ${best.seg[0]}` };
}

function pointAlong(line: [number, number][], t: number): [number, number] {
	const lengths = line.slice(1).map(([y, x], i) => Math.hypot(y - line[i][0], x - line[i][1]));
	let target = t * lengths.reduce((a, b) => a + b, 0);
	for (let i = 0; i < lengths.length; i++) {
		if (target <= lengths[i] || i === lengths.length - 1) {
			const f = lengths[i] ? Math.min(1, target / lengths[i]) : 0;
			return [line[i][0] + f * (line[i + 1][0] - line[i][0]), line[i][1] + f * (line[i + 1][1] - line[i][1])];
		}
		target -= lengths[i];
	}
	return line[0];
}
