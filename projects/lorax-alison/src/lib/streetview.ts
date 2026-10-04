import type { BlocksGeo, Tree } from "./data";

// Flat projection in metres, fine at the scale of one block.
const M_LAT = 111_320;
const mLon = (lat: number) => 111_320 * Math.cos((lat * Math.PI) / 180);

/** Nearest point on the tree's block centerline, so Street View stands in the street. */
function nearestStreetPoint(
	t: Tree,
	blocks: BlocksGeo,
): [number, number] | null {
	const f = blocks.features.find((b) => b.properties.block === t.block);
	if (!f) return null;
	const kx = mLon(t.lat);
	const px = t.lon * kx;
	const py = t.lat * M_LAT;
	let best: [number, number] | null = null;
	let bestD = Number.POSITIVE_INFINITY;
	for (const line of f.geometry.coordinates) {
		for (let i = 0; i < line.length - 1; i++) {
			const [ax, ay] = [line[i][0] * kx, line[i][1] * M_LAT];
			const [bx, by] = [line[i + 1][0] * kx, line[i + 1][1] * M_LAT];
			const dx = bx - ax;
			const dy = by - ay;
			const len2 = dx * dx + dy * dy || 1;
			const u = Math.max(
				0,
				Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2),
			);
			const x = ax + u * dx;
			const y = ay + u * dy;
			const d = Math.hypot(px - x, py - y);
			if (d < bestD) {
				bestD = d;
				best = [y / M_LAT, x / kx];
			}
		}
	}
	return bestD < 80 ? best : null;
}

/**
 * Google Maps URL (official Maps URLs, no API key) that opens Street View on the street
 * beside the tree, facing it. Falls back to the tree's own location.
 */
export function streetViewUrl(t: Tree, blocks: BlocksGeo): string {
	const street = nearestStreetPoint(t, blocks);
	const [lat, lon] = street ?? [t.lat, t.lon];
	const params = new URLSearchParams({
		api: "1",
		map_action: "pano",
		viewpoint: `${lat.toFixed(6)},${lon.toFixed(6)}`,
		pitch: "10",
		fov: "80",
	});
	if (street) {
		const dx = (t.lon - lon) * mLon(lat);
		const dy = (t.lat - lat) * M_LAT;
		const heading = ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
		params.set("heading", heading.toFixed(0));
	}
	return `https://www.google.com/maps/@?${params}`;
}
