import Papa from 'papaparse'

const base = import.meta.env.BASE_URL

export const AGENCY_COLORS = {
  CTA: '#C60C30',
  Pace: '#00539F',
  Metra: '#D97706',
}

// GTFS wheelchair_boarding: 1 = accessible, 2 = not accessible, blank/0 = no information
export const ACCESS = {
  yes: { label: 'Accessible', color: '#15803D' },
  no: { label: 'Not accessible', color: '#B91C1C' },
  unknown: { label: 'Unknown', color: '#6B7280' },
}

// Map colors per theme. Rail is colored by line (Green, Blue, Metra) everywhere;
// buses get one quiet color per agency (CTA charcoal like CTA's own maps, Pace
// purple) so no bus color competes with a rail line. Night lifts every hue so
// it reads on the dark basemap.
export const PALETTES = {
  day: {
    agency: { CTA: '#3F4650', Pace: '#6B3FA0', Metra: '#D97706' },
    lines: { Green: '#00843D', Blue: '#0079B8' }, // darker than CTA brand so white labels pass contrast
    access: { yes: '#15803D', no: '#B91C1C', unknown: '#6B7280' },
    stale: '#9CA3AF',
    ring: '#FFFFFF',
    boundary: '#3A3F47',
    fade: '#F4F2EC', // matches --bg in index.css
    tiles: 'Light',
  },
  night: {
    agency: { CTA: '#C3CAD4', Pace: '#B99CFF', Metra: '#F7B23B' },
    lines: { Green: '#3DDC84', Blue: '#4CC9F0' },
    access: { yes: '#4ADE80', no: '#F87171', unknown: '#9CA3AF' },
    stale: '#6B7280',
    ring: '#0B0E13',
    boundary: '#C9CED6',
    fade: '#0B0E13',
    tiles: 'Dark',
  },
}

export function accessOf(stop) {
  if (stop.wheelchair_boarding === '1') return 'yes'
  if (stop.wheelchair_boarding === '2') return 'no'
  return 'unknown'
}

// Color for a stop: rail stations take their line's color, bus stops their agency's
export function stopColor(stop, palette) {
  if (stop.stop_type === 'rail_station') {
    if (stop.agency === 'Metra') return palette.agency.Metra
    const line = stop.routes.includes('Green') ? 'Green' : stop.routes.includes('Blue') ? 'Blue' : null
    if (line) return palette.lines[line]
  }
  return palette.agency[stop.agency]
}

// One key per route across every source, "Agency:Route" (CTA:90, Pace:307,
// CTA:Green, Metra:UP-W). Rail is named like the live feed and palette.lines.
const ROUTE_ALIASES = { G: 'Green', 'Green Line': 'Green', 'Blue Line': 'Blue' }
const routeKey = (agency, route) => `${agency}:${ROUTE_ALIASES[route] ?? route}`

export const stopRouteKeys = (stop) =>
  stop.routes
    .split(';')
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => routeKey(stop.agency, r))
export const featureRouteKey = (feature) => routeKey(feature.properties.agency, feature.properties.route)
export const vehicleRouteKey = (v) => routeKey(v.agency, v.route)

// Same rule as stopColor: rail by line, buses by agency
export function routeColor(key, palette) {
  const [agency, route] = key.split(':')
  return palette.lines[route] ?? palette.agency[agency]
}

// Rail line names in the stops CSV -> ids used in CTA alerts
const RAIL_IDS = { 'Green Line': 'G', 'Blue Line': 'Blue' }

export function routeIds(stop) {
  return stop.routes
    .split(';')
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => RAIL_IDS[r] ?? r)
}

async function getJson(path) {
  const res = await fetch(base + path)
  if (!res.ok) throw new Error(`${path}: ${res.status}`)
  return res.json()
}

// Accessibility the stops file leaves blank but the operator publishes.
// Keyed by `${agency}:${stop_id}`; checked against the source on the date given.
const ACCESS_OVERRIDES = {
  'Metra:VOP-847': {
    wheelchair_boarding: '1',
    access_source: { label: 'Metra station page', url: 'https://metra.com/train-lines/stations/oak-park', checked: '2026-10-03' },
  },
}

export async function loadStops() {
  const res = await fetch(base + 'data/transit-stops-oak-park.csv')
  const text = await res.text()
  const { data } = Papa.parse(text, { header: true, skipEmptyLines: true })
  return data.map((s) => ({ ...s, ...ACCESS_OVERRIDES[`${s.agency}:${s.stop_id}`], lat: +s.latitude, lon: +s.longitude }))
}

export const loadRoutes = () => getJson('data/routes.geojson')

export const loadBoundary = () => getJson('data/boundary.geojson')

// First/last trip and trips per hour at Village stops (scripts/build_service.py)
export const loadService = () => getJson('data/route-service.json')

// Timetable and grid for the Travel tab (scripts/build_travel.py)
export const loadTravel = () => getJson('data/travel.json')

const BUS_PROXY = import.meta.env.VITE_BUS_PROXY_URL

// Live CTA and Pace buses from the Cloudflare Worker (worker/). Falls back to
// a saved sample, clearly flagged, if the proxy or the feeds are down.
export async function loadLiveBuses() {
  try {
    if (!BUS_PROXY) throw new Error('No proxy configured')
    const res = await fetch(`${BUS_PROXY}/vehicles`)
    if (!res.ok) throw new Error(`Proxy ${res.status}`)
    return { ...(await res.json()), live: true }
  } catch (e) {
    const sample = await getJson('data/bus-vehicles-sample.json')
    return { ...sample, live: false, error: e.message }
  }
}

// Stops across Harlem/Austin sit within ~85 m of the Village line; the next
// closest (Lake and Madison in River Forest/Forest Park) are 150 m+ out.
const ACROSS_STREET_M = 100
export const BUS_RANGE_M = 402 // 1/4 mile: live vehicles and their trails; route lines use the same cut (CLIP_M in scripts/build_routes.py)
export const FADE_M = 402 // 1/4 mile; matches FADE_M in scripts/build_boundary.py

const villageRings = (boundary) => boundary.features.find((f) => f.properties.kind === 'village').geometry.coordinates

// Even-odd ray cast against the Village outline
function insideVillage({ lat, lon }, boundary) {
  let inside = false
  for (const ring of villageRings(boundary)) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j]
      if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
    }
  }
  return inside
}

// Distance in meters from a point to the Village outline (flat-earth, fine at this scale)
function metersToBoundary({ lat, lon }, boundary) {
  const kx = 111320 * Math.cos((lat * Math.PI) / 180)
  const ky = 111320
  const px = lon * kx
  const py = lat * ky
  let best = Infinity
  for (const ring of villageRings(boundary)) {
    for (let i = 1; i < ring.length; i++) {
      const ax = ring[i - 1][0] * kx, ay = ring[i - 1][1] * ky
      const bx = ring[i][0] * kx, by = ring[i][1] * ky
      const dx = bx - ax, dy = by - ay
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)))
      best = Math.min(best, Math.hypot(px - ax - t * dx, py - ay - t * dy))
    }
  }
  return best
}

// Meters outside the Village, 0 if inside
export function metersFromVillage(point, boundary) {
  return insideVillage(point, boundary) ? 0 : metersToBoundary(point, boundary)
}

// Inside the Village, or just across a border street from it
export function nearVillage(stop, boundary) {
  if (stop.in_oak_park === 'Y') return true
  return boundary ? metersToBoundary(stop, boundary) <= ACROSS_STREET_M : false
}

// Next arrivals at a CTA rail station (mapid) or bus stop, via the worker
export async function loadArrivals(stop) {
  if (!BUS_PROXY) throw new Error('No proxy configured')
  const type = stop.stop_type === 'rail_station' ? 'train' : 'bus'
  const res = await fetch(`${BUS_PROXY}/arrivals?type=${type}&id=${encodeURIComponent(stop.stop_id)}`)
  if (!res.ok) throw new Error(`Arrivals ${res.status}`)
  return res.json()
}

export async function loadAlerts() {
  try {
    return await getJson('data/alerts.json')
  } catch {
    return { fetchedAt: null, alerts: [] }
  }
}
