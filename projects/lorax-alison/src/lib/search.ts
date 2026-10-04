import type { Tree } from "./data";

const WORDS: Record<string, string> = {
	NORTH: "N",
	SOUTH: "S",
	EAST: "E",
	WEST: "W",
	AVENUE: "AVE",
	AV: "AVE",
	STREET: "ST",
	BOULEVARD: "BLVD",
	PARKWAY: "PKWY",
	PKY: "PKWY",
	COURT: "CT",
	PLACE: "PL",
	ROAD: "RD",
};

const tokens = (s: string) =>
	s
		.toUpperCase()
		.replace(/[.,#]/g, " ")
		.split(/\s+/)
		.filter(Boolean)
		.map((w) => WORDS[w] ?? w);

export type SearchResult =
	| { kind: "ok"; label: string; trees: Tree[] }
	| { kind: "error"; message: string };

/** Trees on the hundred block of a typed address, same side of the street first, nearest number first. */
export function searchAddress(query: string, trees: Tree[]): SearchResult {
	const m = query.trim().match(/^(\d+)\s+(.+)$/);
	if (!m)
		return {
			kind: "error",
			message: "Enter a house number and street, like 1216 N Austin Blvd.",
		};
	const n = Number(m[1]);
	const typed = tokens(m[2]).filter(
		(w) => !["OAK", "PARK", "IL", "IL60302", "60302", "60304"].includes(w),
	);
	const hundred = Math.floor(n / 100) * 100;
	const matches = trees.filter((t) => {
		const [num, ...street] = t.block.split(" ");
		if (Number(num) !== hundred) return false;
		return typed.every((w) => street.some((s) => s.startsWith(w)));
	});
	if (!matches.length) {
		return {
			kind: "error",
			message: `No public trees recorded on the ${hundred} block of ${m[2]}.`,
		};
	}
	const score = (t: Tree) => {
		const est = t.estNumber ?? hundred;
		return (est % 2 === n % 2 ? 0 : 1000) + Math.abs(est - n);
	};
	return {
		kind: "ok",
		label: `${n} ${m[2]}`,
		trees: [...matches].sort((a, b) => score(a) - score(b)),
	};
}

/** Trees within `meters` of a point, nearest first. */
export function treesNear(
	lat: number,
	lon: number,
	trees: Tree[],
	meters = 150,
): Tree[] {
	const kx = 111_320 * Math.cos((lat * Math.PI) / 180);
	const ky = 110_540;
	return trees
		.map((t) => ({ t, d: Math.hypot((t.lon - lon) * kx, (t.lat - lat) * ky) }))
		.filter((x) => x.d <= meters)
		.sort((a, b) => a.d - b.d)
		.map((x) => x.t);
}
