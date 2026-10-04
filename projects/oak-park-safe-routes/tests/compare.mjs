// Send every recorded request to the JavaScript port and diff it against the
// original Flask app's response (python-responses.json from requests.py).
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const core = require("../static/js/safe-routes-core.js");
const here = new URL(".", import.meta.url).pathname;
const requests = JSON.parse(readFileSync(here + "requests.json", "utf8"));
const python = JSON.parse(readFileSync(here + "python-responses.json", "utf8"));
const api = new core.SafeRoutesApi({
  loadData: () => ({
    incidents: core.loadIncidentsFromCsv(readFileSync(here + "../data/crime-incidents-oak-park.csv", "utf8")),
    streets: JSON.parse(readFileSync(here + "../data/street_segments.geojson", "utf8")),
  }),
  geocoder: null,
});
// Python stores each incident's types and categories in sets, so the order of
// [name, count] entries tied on count varies between server runs (hash seed).
// Counts must match exactly; names must match as a set within each count, and a
// top-N list cut through a tie may hold any of the tied names at its last count.
const COUNTED = new Set(["top_types", "by_type", "by_crime_against"]);
function countedLists(a, b, path) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return `${path}: length differs`;
  const counts = (l) => l.map((e) => e[1]);
  if (JSON.stringify(counts(a)) !== JSON.stringify(counts(b))) return `${path}: counts ${counts(a)} != ${counts(b)}`;
  const last = a.length ? a[a.length - 1][1] : null;
  const names = (l, c) => l.filter((e) => e[1] === c).map((e) => e[0]).sort().join("|");
  for (const c of new Set(counts(a))) if (c !== last && names(a, c) !== names(b, c)) return `${path}: names at count ${c} differ`;
  return null;
}
function diff(a, b, path = "") {
  const key = path.split(".").pop();
  if (COUNTED.has(key)) return countedLists(a, b, path);
  if (typeof a === "number" && typeof b === "number") return a === b || Object.is(a, b) ? null : `${path}: ${a} != ${b}`;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return a === b ? null : `${path}: ${JSON.stringify(a)?.slice(0, 80)} != ${JSON.stringify(b)?.slice(0, 80)}`;
  if (Array.isArray(a) !== Array.isArray(b)) return `${path}: array mismatch`;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return `${path}: length ${a.length} != ${b.length}`;
    for (let i = 0; i < a.length; i++) { const d = diff(a[i], b[i], `${path}[${i}]`); if (d) return d; }
    return null;
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) { if (!(k in a) || !(k in b)) return `${path}.${k}: missing on ${k in a ? "python" : "js"} side`; const d = diff(a[k], b[k], `${path}.${k}`); if (d) return d; }
  return null;
}
let matched = 0; const failures = [];
const t0 = Date.now();
for (const req of requests) {
  const url = new URL(req, "http://x");
  const js = await api.handle(url.pathname.replace("/api/", ""), url.searchParams);
  const py = python[req];
  const d = js.status !== py.status ? `status ${js.status} != ${py.status}` : diff(js.body, py.body);
  if (d) failures.push(`${req}\n    ${d}`); else matched++;
}
console.log(`${matched}/${requests.length} matched in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
for (const f of failures.slice(0, 15)) console.log("DIFF " + f);
process.exitCode = failures.length ? 1 : 0;
