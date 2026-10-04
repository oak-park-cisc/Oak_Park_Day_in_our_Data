// Canopy estimates from recorded crown spread. Shared by the app and scripts/build-blocks.mjs.
//
// Two estimates:
// - crownSumSqft: each crown as a circle of the recorded spread, added up. Overlapping crowns
//   count twice, so this is an upper bound.
// - coveredSqft: the ground actually under at least one crown, found by marking a fine grid.
//   Overlaps count once. Still approximate: crowns aren't perfect circles and spread is recorded
//   in 10 ft classes.

export type CrownPoint = { lat: number; lon: number; spread: number | null };
export type Bounds = { south: number; west: number; north: number; east: number };

const FT_PER_DEG_LAT = 364_000;
const FT_PER_DEG_LON = 364_000 * Math.cos((41.88 * Math.PI) / 180);
/** Largest grid we'll allocate; the cell size grows for very large areas to stay under it */
const MAX_CELLS = 12_000_000;

export const crownArea = (spreadFt: number | null) => (spreadFt ? Math.PI * (spreadFt / 2) ** 2 : 0);

export function boundsAreaSqft(b: Bounds) {
	return (b.north - b.south) * FT_PER_DEG_LAT * (b.east - b.west) * FT_PER_DEG_LON;
}

/**
 * Covered ground area under the given crowns. When `clip` is given, only ground inside it counts
 * (crowns of trees near the edge may hang over the line).
 */
export function canopyEstimate(trees: CrownPoint[], clip?: Bounds, targetCellFt = 2) {
	const withCrown = trees.filter((t) => t.spread && t.spread > 0);
	const crownSumSqft = withCrown.reduce((s, t) => s + crownArea(t.spread), 0);
	if (!withCrown.length) return { crownSumSqft: 0, coveredSqft: 0, cellFt: targetCellFt };

	// Grid extent: all crowns, optionally clipped.
	let south = Infinity;
	let west = Infinity;
	let north = -Infinity;
	let east = -Infinity;
	for (const t of withCrown) {
		const r = (t.spread as number) / 2;
		south = Math.min(south, t.lat - r / FT_PER_DEG_LAT);
		north = Math.max(north, t.lat + r / FT_PER_DEG_LAT);
		west = Math.min(west, t.lon - r / FT_PER_DEG_LON);
		east = Math.max(east, t.lon + r / FT_PER_DEG_LON);
	}
	if (clip) {
		south = Math.max(south, clip.south);
		north = Math.min(north, clip.north);
		west = Math.max(west, clip.west);
		east = Math.min(east, clip.east);
		if (south >= north || west >= east) return { crownSumSqft, coveredSqft: 0, cellFt: targetCellFt };
	}
	const wFt = (east - west) * FT_PER_DEG_LON;
	const hFt = (north - south) * FT_PER_DEG_LAT;
	const cellFt = Math.max(targetCellFt, Math.sqrt((wFt * hFt) / MAX_CELLS));
	const cols = Math.max(1, Math.ceil(wFt / cellFt));
	const rows = Math.max(1, Math.ceil(hFt / cellFt));
	const grid = new Uint8Array(cols * rows);

	for (const t of withCrown) {
		const r = (t.spread as number) / 2;
		const cx = (t.lon - west) * FT_PER_DEG_LON;
		const cy = (north - t.lat) * FT_PER_DEG_LAT;
		const r0 = Math.max(0, Math.floor((cy - r) / cellFt));
		const r1 = Math.min(rows - 1, Math.floor((cy + r) / cellFt));
		for (let row = r0; row <= r1; row++) {
			const dy = (row + 0.5) * cellFt - cy;
			const half = r * r - dy * dy;
			if (half < 0) continue;
			const dx = Math.sqrt(half);
			const c0 = Math.max(0, Math.ceil((cx - dx) / cellFt - 0.5));
			const c1 = Math.min(cols - 1, Math.floor((cx + dx) / cellFt - 0.5));
			if (c1 >= c0) grid.fill(1, row * cols + c0, row * cols + c1 + 1);
		}
	}
	let marked = 0;
	for (let i = 0; i < grid.length; i++) marked += grid[i];
	return { crownSumSqft, coveredSqft: marked * cellFt * cellFt, cellFt };
}
