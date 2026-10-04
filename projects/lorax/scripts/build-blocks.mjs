// Builds per-block and per-school-zone diversity outputs from the cached tree inventory,
// street centerlines and D97 attendance zones.
// Usage: node scripts/build-blocks.mjs
// Inputs:  public/data/trees-oak-park.csv, streets-oak-park.geojson, d97-attendance-zones.geojson
// Outputs: public/data/blocks.csv, blocks.geojson, zones.csv, zones.geojson, trees.json,
//          addresses.json, modis-tree-cover.geojson (needs modis-mod44b-oak-park.json from scripts/fetch-modis.mjs)

import { readFileSync, writeFileSync } from "node:fs";
import { canopyEstimate } from "../src/canopy.ts";

const DATA = new URL("../public/data/", import.meta.url);
const MIN_TREES = 10; // below this, shares are too noisy to flag
const ZONE_SNAP_M = 60; // trees just outside every zone polygon (border streets) snap to the nearest one

function parseCsv(text) {
	const rows = [];
	let row = [];
	let field = "";
	let quoted = false;
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (quoted) {
			if (c === '"' && text[i + 1] === '"') {
				field += '"';
				i++;
			} else if (c === '"') quoted = false;
			else field += c;
		} else if (c === '"') quoted = true;
		else if (c === ",") {
			row.push(field);
			field = "";
		} else if (c === "\n" || c === "\r") {
			if (c === "\r" && text[i + 1] === "\n") i++;
			row.push(field);
			rows.push(row);
			row = [];
			field = "";
		} else field += c;
	}
	if (field || row.length) {
		row.push(field);
		rows.push(row);
	}
	const [header, ...body] = rows.filter((r) => r.length > 1 || r[0] !== "");
	return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

const num = (v) => (v === "" ? null : Number(v));
const round = (v, d = 3) => (v == null ? null : Math.round(v * 10 ** d) / 10 ** d);

function median(values) {
	const v = values.filter((x) => x != null && x > 0).sort((a, b) => a - b);
	if (!v.length) return null;
	const m = Math.floor(v.length / 2);
	return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

function tally(items) {
	const counts = new Map();
	for (const k of items) counts.set(k, (counts.get(k) ?? 0) + 1);
	return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

// --- Trees -----------------------------------------------------------------
const allTrees = parseCsv(readFileSync(new URL("trees-oak-park.csv", DATA), "utf8"));
// Drop the stump and records with no species information at all.
const trees = allTrees.filter((t) => t.common_name !== "STUMP" && (t.latin_name || t.common_name));
const skipped = allTrees.length - trees.length;

// Familiar label per genus: the most common first word of its trees' common names
// (e.g. "MAPLE-NORWAY" -> "MAPLE" for Acer), so residents can read genus names.
const genusLabel = new Map(
	[...Map.groupBy(trees, (t) => t.genus || "Unknown")].map(([g, list]) => {
		const top = tally(list.map((t) => (t.common_name || "").split(/[-,(]/)[0].trim()).filter(Boolean));
		return [g, top[0]?.[0] ?? ""];
	}),
);

// --- D97 attendance zones ---------------------------------------------------
const zonesSrc = JSON.parse(readFileSync(new URL("d97-attendance-zones.geojson", DATA), "utf8"));
const zoneName = (f) => f.properties.PopupInfo.replace(/ Elementary$/, "");
const M_PER_DEG_LAT = 111320;
const M_PER_DEG_LON = 111320 * Math.cos((41.88 * Math.PI) / 180);

function inRings(x, y, rings) {
	let inside = false;
	for (const ring of rings)
		for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
			const [x1, y1] = ring[i];
			const [x2, y2] = ring[j];
			if (y1 > y !== y2 > y && x < ((x2 - x1) * (y - y1)) / (y2 - y1) + x1) inside = !inside;
		}
	return inside;
}

function distToRingsM(x, y, rings) {
	let best = Infinity;
	for (const ring of rings)
		for (let i = 1; i < ring.length; i++) {
			const ax = ring[i - 1][0] * M_PER_DEG_LON;
			const ay = ring[i - 1][1] * M_PER_DEG_LAT;
			const bx = ring[i][0] * M_PER_DEG_LON - ax;
			const by = ring[i][1] * M_PER_DEG_LAT - ay;
			const px = x * M_PER_DEG_LON - ax;
			const py = y * M_PER_DEG_LAT - ay;
			const t = Math.max(0, Math.min(1, (px * bx + py * by) / (bx * bx + by * by || 1)));
			best = Math.min(best, Math.hypot(px - t * bx, py - t * by));
		}
	return best;
}

function zoneFor(t) {
	const x = Number(t.longitude);
	const y = Number(t.latitude);
	const hit = zonesSrc.features.find((f) => inRings(x, y, f.geometry.coordinates));
	if (hit) return zoneName(hit);
	let best = null;
	let bestD = ZONE_SNAP_M;
	for (const f of zonesSrc.features) {
		const d = distToRingsM(x, y, f.geometry.coordinates);
		if (d < bestD) [best, bestD] = [zoneName(f), d];
	}
	return best ?? "Outside zones";
}
for (const t of trees) t.zone = zoneFor(t);

const byBlock = new Map();
for (const t of trees) {
	if (!byBlock.has(t.block)) byBlock.set(t.block, []);
	byBlock.get(t.block).push(t);
}

// --- Street geometry: key each segment by every hundred-block its address range spans
const streets = JSON.parse(readFileSync(new URL("streets-oak-park.geojson", DATA), "utf8"));
const segments = new Map();
for (const f of streets.features) {
	const p = f.properties;
	const addrs = [p.address_left_from, p.address_left_to, p.address_right_from, p.address_right_to].filter((a) => a > 0);
	if (!addrs.length) continue;
	const lo = Math.floor(Math.min(...addrs) / 100) * 100;
	const hi = Math.floor(Math.max(...addrs) / 100) * 100;
	for (let h = lo; h <= hi; h += 100) {
		const key = `${h} ${p.street_name}`;
		if (!segments.has(key)) segments.set(key, []);
		segments.get(key).push(f);
	}
}

// --- Shared metrics for any group of trees ---------------------------------------
function stats(list) {
	const n = list.length;
	const speciesKey = (t) => t.latin_name || t.common_name;
	const commonFor = new Map();
	for (const t of list) if (!commonFor.has(speciesKey(t))) commonFor.set(speciesKey(t), t.common_name);

	const species = tally(list.map(speciesKey));
	const genera = tally(list.map((t) => t.genus || "Unknown"));
	const shares = species.map(([, c]) => c / n);
	const shannon = -shares.reduce((s, p) => s + p * Math.log(p), 0);
	const simpson = 1 - shares.reduce((s, p) => s + p * p, 0);
	const topSpeciesShare = species[0][1] / n;
	const topGenusShare = genera[0][1] / n;
	const canopy = list.reduce((s, t) => {
		const sp = num(t.spread_ft);
		return sp ? s + Math.PI * (sp / 2) ** 2 : s;
	}, 0);
	return {
		props: {
			trees: n,
			species_count: species.length,
			genus_count: genera.length,
			top_species: commonFor.get(species[0][0]) || species[0][0],
			top_species_latin: species[0][0],
			top_species_share: round(topSpeciesShare),
			top_genus: genera[0][0],
			top_genus_common: genusLabel.get(genera[0][0]),
			top_genus_share: round(topGenusShare),
			shannon: round(shannon),
			simpson: round(simpson),
			median_dbh_in: median(list.map((t) => num(t.dbh_in))),
			median_height_ft: median(list.map((t) => num(t.height_ft))),
			median_spread_ft: median(list.map((t) => num(t.spread_ft))),
			canopy_sqft: Math.round(canopy),
			// Ground under at least one crown (overlaps counted once); see src/canopy.ts.
			canopy_covered_sqft: Math.round(
				canopyEstimate(
					list.map((t) => ({ lat: Number(t.latitude), lon: Number(t.longitude), spread: num(t.spread_ft) })),
				).coveredSqft,
			),
		},
		topSpeciesShare,
		topGenusShare,
		breakdown: {
			species: species.map(([k, c]) => [commonFor.get(k) || k, k, c]),
			genera: genera.map(([g, c]) => [g, genusLabel.get(g), c]),
		},
	};
}

// --- Per-block metrics -------------------------------------------------------
const blocks = [];
for (const [block, list] of byBlock) {
	const st = stats(list);
	const enough = list.length >= MIN_TREES;
	const segs = segments.get(block) ?? [];
	const lengthFt = segs.reduce((s, f) => s + (f.properties.length_ft ?? 0), 0);

	blocks.push({
		props: {
			block,
			street: list[0].nearest_street,
			zone: tally(list.map((t) => t.zone))[0][0],
			...st.props,
			low_count: !enough,
			species_over_10pct: enough && st.topSpeciesShare > 0.1,
			genus_over_20pct: enough && st.topGenusShare > 0.2,
			genus_30pct_plus: enough && st.topGenusShare >= 0.3,
			street_length_ft: lengthFt ? Math.round(lengthFt) : null,
			on_map: segs.length > 0,
		},
		breakdown: st.breakdown,
		geometry: segs.length
			? {
					type: "MultiLineString",
					coordinates: segs.map((f) => f.geometry.coordinates.map(([x, y]) => [round(x, 5), round(y, 5)])),
				}
			: null,
	});
}
blocks.sort((a, b) => a.props.block.localeCompare(b.props.block, "en", { numeric: true }));

// Village-wide canopy from every recorded crown.
const villageCanopy = canopyEstimate(
	trees.map((t) => ({ lat: Number(t.latitude), lon: Number(t.longitude), spread: num(t.spread_ft) })),
);
console.log(
	`canopy: crowns ${Math.round(villageCanopy.crownSumSqft)} sq ft summed, ${Math.round(villageCanopy.coveredSqft)} sq ft covered (${villageCanopy.cellFt.toFixed(2)} ft grid)`,
);

// --- Write outputs -----------------------------------------------------------
const csvCell = (v) => {
	const s = v == null ? "" : String(v);
	return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
function writeCsv(name, rows) {
	const cols = Object.keys(rows[0]);
	writeFileSync(
		new URL(name, DATA),
		`${[cols.join(","), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(","))].join("\n")}\n`,
	);
}
writeCsv(
	"blocks.csv",
	blocks.map((b) => b.props),
);

writeFileSync(
	new URL("blocks.geojson", DATA),
	JSON.stringify({
		type: "FeatureCollection",
		metadata: {
			min_trees_for_flags: MIN_TREES,
			records_skipped: skipped,
			trees_used: trees.length,
			canopy_crown_sum_sqft: Math.round(villageCanopy.crownSumSqft),
			canopy_covered_sqft: Math.round(villageCanopy.coveredSqft),
			village_area_sqft: zonesSrc.features.reduce((s, f) => s + zoneArea(zoneName(f)), 0),
		},
		features: blocks.map((b) => ({
			type: "Feature",
			geometry: b.geometry,
			properties: { ...b.props, ...b.breakdown },
		})),
	}),
);

// Zone land area from its polygon (shoelace formula on a local feet projection).
function zoneArea(name) {
	const f = zonesSrc.features.find((z) => zoneName(z) === name);
	if (!f) return null;
	const FT = 3.28084;
	let total = 0;
	f.geometry.coordinates.forEach((ring, i) => {
		let a = 0;
		for (let k = 0, j = ring.length - 1; k < ring.length; j = k++) {
			const [x1, y1] = ring[j];
			const [x2, y2] = ring[k];
			a += x1 * M_PER_DEG_LON * FT * (y2 * M_PER_DEG_LAT * FT) - x2 * M_PER_DEG_LON * FT * (y1 * M_PER_DEG_LAT * FT);
		}
		total += (i === 0 ? 1 : -1) * Math.abs(a / 2);
	});
	return Math.round(total);
}

// --- Per-zone metrics: trees aggregated directly, plus counts of the blocks assigned to each zone
const zoneNames = [...zonesSrc.features.map(zoneName), "Outside zones"];
const zones = zoneNames
	.map((name) => {
		const list = trees.filter((t) => t.zone === name);
		if (!list.length) return null;
		const st = stats(list);
		const zb = blocks.filter((b) => b.props.zone === name);
		const eligible = zb.filter((b) => !b.props.low_count);
		const len = zb.reduce((s, b) => s + (b.props.street_length_ft ?? 0), 0);
		const canopyOnMapped = zb.reduce((s, b) => s + (b.props.street_length_ft ? b.props.canopy_sqft : 0), 0);
		return {
			props: {
				zone: name,
				...st.props,
				blocks: zb.length,
				blocks_10plus_trees: eligible.length,
				blocks_genus_30pct_plus: eligible.filter((b) => b.props.genus_30pct_plus).length,
				share_blocks_genus_30pct_plus: eligible.length
					? round(eligible.filter((b) => b.props.genus_30pct_plus).length / eligible.length)
					: null,
				median_block_simpson: median(eligible.map((b) => b.props.simpson)),
				canopy_sqft_per_street_ft: len ? round(canopyOnMapped / len, 1) : null,
				area_sqft: zoneArea(name),
				// Public-tree canopy (overlaps removed) as a share of the zone's land area.
				canopy_cover_pct: zoneArea(name) ? round((st.props.canopy_covered_sqft / zoneArea(name)) * 100, 1) : null,
			},
			breakdown: st.breakdown,
			geometry: zonesSrc.features.find((f) => zoneName(f) === name)?.geometry ?? null,
		};
	})
	.filter(Boolean);

writeCsv(
	"zones.csv",
	zones.map((z) => z.props),
);
writeFileSync(
	new URL("zones.geojson", DATA),
	JSON.stringify({
		type: "FeatureCollection",
		features: zones
			.filter((z) => z.geometry)
			.map((z) => ({
				type: "Feature",
				geometry: {
					...z.geometry,
					coordinates: z.geometry.coordinates.map((r) => r.map(([x, y]) => [round(x, 5), round(y, 5)])),
				},
				properties: { ...z.props, genera: z.breakdown.genera.slice(0, 10) },
			})),
		outside: zones.find((z) => !z.geometry)?.props ?? null,
	}),
);

// --- Individual trees for the "near me" view (compact: lookup table + rows) ---------
const speciesIndex = new Map();
const speciesTable = [];
const blockIndex = new Map(blocks.map((b, i) => [b.props.block, i]));
const treeRows = trees.map((t) => {
	const key = `${t.common_name}|${t.latin_name}|${t.genus}`;
	if (!speciesIndex.has(key)) {
		speciesIndex.set(key, speciesTable.length);
		speciesTable.push([t.common_name, t.latin_name, t.genus || "Unknown"]);
	}
	return [
		round(Number(t.latitude), 6),
		round(Number(t.longitude), 6),
		speciesIndex.get(key),
		num(t.dbh_in),
		num(t.height_ft),
		num(t.spread_ft),
		blockIndex.get(t.block),
	];
});
writeFileSync(
	new URL("trees.json", DATA),
	JSON.stringify({
		columns: ["lat", "lon", "species", "dbh_in", "height_ft", "spread_ft", "block"],
		species: speciesTable,
		blocks: blocks.map((b) => b.props.block),
		genusLabels: Object.fromEntries(genusLabel),
		trees: treeRows,
	}),
);

// --- MODIS MOD44B tree cover: 250 m sinusoidal cells inside the village ----------------
// Cells are kept when their center falls inside a D97 zone (the zones tile the village).
const modis = JSON.parse(readFileSync(new URL("modis-mod44b-oak-park.json", DATA), "utf8"));
const R = 6371007.181; // MODIS sinusoidal sphere radius
const toLatLon = (x, y) => {
	const lat = y / R;
	return [(lat * 180) / Math.PI, ((x / (R * Math.cos(lat))) * 180) / Math.PI];
};
const toSin = (lat, lon) => {
	const la = (lat * Math.PI) / 180;
	return [R * ((lon * Math.PI) / 180) * Math.cos(la), R * la];
};
const cs = modis.cellsize;
const x0 = Number(modis.xllcorner);
const yTop = Number(modis.yllcorner) + modis.nrows * cs;
const years = modis.subset.map((s) => Number(s.calendar_date.slice(0, 4)));
const RECENT = years.slice(-5);
const cellAreaSqft = cs * cs * 10.7639;

// Public inventory trees and their crown area per cell, for comparison.
const cellTrees = new Map();
for (const t of trees) {
	const [x, y] = toSin(Number(t.latitude), Number(t.longitude));
	const key = `${Math.floor((yTop - y) / cs)},${Math.floor((x - x0) / cs)}`;
	const e = cellTrees.get(key) ?? { n: 0, canopy: 0 };
	e.n++;
	const sp = num(t.spread_ft);
	if (sp) e.canopy += Math.PI * (sp / 2) ** 2;
	cellTrees.set(key, e);
}

const cells = [];
for (let r = 0; r < modis.nrows; r++)
	for (let c = 0; c < modis.ncols; c++) {
		const [cy, cx] = toLatLon(x0 + (c + 0.5) * cs, yTop - (r + 0.5) * cs);
		if (!zonesSrc.features.some((f) => inRings(cx, cy, f.geometry.coordinates))) continue;
		const values = modis.subset.map((s) => {
			const v = s.data[r * modis.ncols + c];
			return v >= 0 && v <= 100 ? v : null;
		});
		const recent = values.slice(-RECENT.length).filter((v) => v != null);
		const inv = cellTrees.get(`${r},${c}`) ?? { n: 0, canopy: 0 };
		const corners = [
			[c, r],
			[c + 1, r],
			[c + 1, r + 1],
			[c, r + 1],
			[c, r],
		].map(([cc, rr]) => {
			const [la, lo] = toLatLon(x0 + cc * cs, yTop - rr * cs);
			return [round(lo, 6), round(la, 6)];
		});
		cells.push({
			type: "Feature",
			geometry: { type: "Polygon", coordinates: [corners] },
			properties: {
				id: `${r}-${c}`,
				cover: values,
				recent_mean: recent.length ? round(recent.reduce((a, b) => a + b, 0) / recent.length, 1) : null,
				inventory_trees: inv.n,
				inventory_canopy_pct: round((inv.canopy / cellAreaSqft) * 100, 1),
			},
		});
	}
const villageMean = years.map((_, i) => {
	const v = cells.map((f) => f.properties.cover[i]).filter((x) => x != null);
	return round(v.reduce((a, b) => a + b, 0) / v.length, 1);
});
writeFileSync(
	new URL("modis-tree-cover.geojson", DATA),
	JSON.stringify({
		type: "FeatureCollection",
		metadata: {
			product: "MOD44B Percent_Tree_Cover, Collection 6.1 (via ORNL DAAC MODIS web service)",
			retrieved: modis.retrieved,
			cell_size_m: round(cs, 1),
			years,
			recent_years: RECENT,
			village_mean: villageMean,
		},
		features: cells,
	}),
);
console.log(`MODIS: ${cells.length} cells inside the village, village mean ${villageMean.join(" ")}`);

// --- Street address ranges for local address lookup (no external geocoder) ---------
writeFileSync(
	new URL("addresses.json", DATA),
	JSON.stringify(
		streets.features
			.filter((f) => [f.properties.address_left_from, f.properties.address_right_from].some((a) => a > 0))
			.map((f) => {
				const p = f.properties;
				return [
					p.street_name,
					p.address_left_from,
					p.address_left_to,
					p.address_right_from,
					p.address_right_to,
					f.geometry.coordinates.map(([x, y]) => [round(y, 6), round(x, 6)]),
				];
			}),
	),
);

console.log(zones.map((z) => `${z.props.zone}: ${z.props.trees} trees, ${z.props.blocks} blocks`).join("\n"));
const flagged = blocks.filter((b) => b.props.genus_30pct_plus).length;
console.log(
	`${blocks.length} blocks, ${trees.length} trees (${skipped} skipped), ` +
		`${blocks.filter((b) => b.props.on_map).length} on map, ${flagged} with a genus >= 30% (>= ${MIN_TREES} trees)`,
);
