// Downloads MODIS MOD44B (Vegetation Continuous Fields) Percent_Tree_Cover for every year
// over Oak Park from the ORNL DAAC MODIS web service (public, no login).
// Usage: node scripts/fetch-modis.mjs
// Output: public/data/modis-mod44b-oak-park.json (raw subsets, unmodified values)

import { writeFileSync } from "node:fs";

const API = "https://modis.ornl.gov/rst/api/v1";
// Village center. The window is a rectangle on MODIS's sinusoidal grid, which is strongly
// sheared at this longitude: on a lat/lon map its east and west edges lean about 5.8 km over
// 6 km of height. ±3 km E–W left the village's NE and SW corners outside, so we ask for ±6 km.
const LAT = 41.8875;
const LON = -87.79;
const KM_NS = 3;
const KM_EW = 6;
const BAND = "Percent_Tree_Cover";

const get = async (url) => {
	const r = await fetch(url, { headers: { Accept: "application/json" } });
	if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
	return r.json();
};

const { dates } = await get(`${API}/MOD44B/dates?latitude=${LAT}&longitude=${LON}`);
const subsets = [];
let header = null;
// The service returns at most 10 dates per request.
for (let i = 0; i < dates.length; i += 10) {
	const chunk = dates.slice(i, i + 10);
	const url =
		`${API}/MOD44B/subset?latitude=${LAT}&longitude=${LON}&band=${BAND}` +
		`&startDate=${chunk[0].modis_date}&endDate=${chunk.at(-1).modis_date}&kmAboveBelow=${KM_NS}&kmLeftRight=${KM_EW}`;
	const res = await get(url);
	const { subset, ...rest } = res;
	header ??= rest;
	subsets.push(...subset);
	console.log(`fetched ${chunk[0].calendar_date} – ${chunk.at(-1).calendar_date}`);
}

const { header: _url, ...meta } = header;
writeFileSync(
	new URL("../public/data/modis-mod44b-oak-park.json", import.meta.url),
	JSON.stringify({
		source: `${API}/MOD44B/subset`,
		retrieved: new Date().toISOString().slice(0, 10),
		request: { latitude: LAT, longitude: LON, kmAboveBelow: KM_NS, kmLeftRight: KM_EW, band: BAND },
		...meta,
		subset: subsets,
	}),
);
console.log(`${subsets.length} years, ${meta.nrows}×${meta.ncols} cells`);
