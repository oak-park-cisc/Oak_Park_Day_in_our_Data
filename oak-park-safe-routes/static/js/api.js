// Static-site version of api.js: the same calls as the original, answered in the
// browser by safe-routes-core.js (a port of the Flask server) instead of /api/*.
// Data files load once from ./data; address lookups go straight to Nominatim.

const safeRoutes = new SafeRoutesCore.SafeRoutesApi({
  loadData: async () => {
    const [csv, streets] = await Promise.all([
      fetch("data/crime-incidents-oak-park.csv").then((r) => {
        if (!r.ok) throw new Error(`Request failed: ${r.status} ${r.statusText}`);
        return r.text();
      }),
      fetch("data/street_segments.geojson").then((r) => {
        if (!r.ok) throw new Error(`Request failed: ${r.status} ${r.statusText}`);
        return r.json();
      }),
    ]);
    return { incidents: SafeRoutesCore.loadIncidentsFromCsv(csv), streets };
  },
  geocoder: new SafeRoutesCore.Geocoder(async (url) => {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    return res.json();
  }),
});

async function fetchJson(url) {
  const parsed = new URL(url, "http://local");
  const { status, body } = await safeRoutes.handle(parsed.pathname.replace(/^\/api\//, ""), parsed.searchParams);
  if (status >= 400) throw new Error(body && body.error ? body.error : `Request failed: ${status}`);
  return body;
}

function fetchRoutes(from, to, { start = "", end = "" } = {}) {
  const params = new URLSearchParams({ from: `${from.lat},${from.lon}`, to: `${to.lat},${to.lon}` });
  if (start) params.set("start", start);
  if (end) params.set("end", end);
  return fetchJson(`/api/route?${params}`);
}

function geocodePlace(query) {
  return fetchJson(`/api/geocode?${new URLSearchParams({ q: query })}`);
}

function reverseGeocode(lat, lon) {
  return fetchJson(`/api/reverse?${new URLSearchParams({ lat, lon })}`);
}

function filterParams({ type = "", crimeAgainst = "", start = "", end = "" } = {}) {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (crimeAgainst) params.set("crime_against", crimeAgainst);
  if (start) params.set("start", start);
  if (end) params.set("end", end);
  return params;
}

function fetchOptions() {
  return fetchJson("/api/options");
}

function fetchMapPoints(filters) {
  return fetchJson(`/api/map-points?${filterParams(filters)}`);
}

function fetchStreets() {
  return fetchJson("/api/streets");
}

function fetchSummary(filters) {
  return fetchJson(`/api/summary?${filterParams(filters)}`);
}

function fetchIncidents(filters, limit = 500) {
  const params = filterParams(filters);
  params.set("limit", limit);
  return fetchJson(`/api/incidents?${params}`);
}
