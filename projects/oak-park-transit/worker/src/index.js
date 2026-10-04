// Cloudflare Worker: CORS proxy for live bus and train positions on Oak Park routes.
//
// GET /vehicles -> { fetchedAt, vehicles: [{ agency, mode, route, routeName, lat, lon, heading, id }], errors }
// GET /arrivals?type=train|bus&id=<CTA station mapid or bus stop id>
//   -> { fetchedAt, arrivals: [{ route, direction, destination, minutes, approaching, scheduled, delayed }] }
//
// Pace has no official real-time API. This calls the undocumented JSON behind
// the TMWebWatch live map, so it may break without notice.
// CTA buses use the Bus Tracker API (CTA_BUS_KEY secret) and CTA trains the
// Train Tracker API (CTA_TRAIN_KEY secret). Set them with
// `npx wrangler secret put <NAME>`; they never reach the browser.
// Only the Oak Park routes below can be requested, so this isn't an open proxy.

const PACE = 'https://tmweb.pacebus.com/TMWebWatch/GoogleMap.aspx/getVehicles'

// Pace route number -> TMWebWatch routeID
const ROUTES = { 307: 33, 309: 35, 311: 37, 313: 38, 314: 271, 315: 39, 318: 41 }

const CTA = 'https://www.ctabustracker.com/bustime/api/v2/getvehicles'
const CTA_ROUTES = ['20', '66', '70', '86', '90', '91', '126'] // max 10 per request

const CTA_TRAINS = 'https://lapi.transitchicago.com/api/1.0/ttpositions.aspx'
const TRAIN_LINES = { g: 'Green', blue: 'Blue' }

const CTA_TRAIN_ARRIVALS = 'https://lapi.transitchicago.com/api/1.0/ttarrivals.aspx'
const CTA_BUS_PREDICTIONS = 'https://www.ctabustracker.com/bustime/api/v2/getpredictions'

const ALLOWED_ORIGINS = [
  'https://captainchemist.github.io',
  'http://localhost:5173',
  'http://localhost:4173',
]

const CACHE_SECONDS = 20

function cors(request) {
  const origin = request.headers.get('Origin')
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    Vary: 'Origin',
  }
}

async function fetchRoute(routeNumber, routeID) {
  const res = await fetch(PACE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ routeID }),
  })
  if (!res.ok) throw new Error(`Pace ${routeNumber}: ${res.status}`)
  const { d } = await res.json()
  return (d || []).map((v) => ({
    agency: 'Pace',
    mode: 'bus',
    route: String(routeNumber),
    routeName: v.routeName,
    lat: v.lat,
    lon: v.lon,
    heading: v.heading,
    id: v.propertyTag,
  }))
}

async function fetchCta(key) {
  if (!key) throw new Error('CTA: no CTA_BUS_KEY secret')
  const url = `${CTA}?key=${encodeURIComponent(key)}&rt=${CTA_ROUTES.join(',')}&format=json`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`CTA: ${res.status}`)
  const body = (await res.json())['bustime-response'] || {}
  // "No data found" just means a route has no buses out right now
  const fatal = (body.error || []).filter((e) => !/no data found/i.test(e.msg))
  if (!body.vehicle && fatal.length) throw new Error(`CTA: ${fatal.map((e) => e.msg).join('; ')}`)
  return (body.vehicle || []).map((v) => ({
    agency: 'CTA',
    mode: 'bus',
    route: v.rt,
    routeName: `to ${v.des}`,
    lat: +v.lat,
    lon: +v.lon,
    heading: +v.hdg,
    id: v.vid,
    delayed: v.dly,
  }))
}

async function fetchCtaTrains(key) {
  if (!key) throw new Error('CTA trains: no CTA_TRAIN_KEY secret')
  const url = `${CTA_TRAINS}?key=${encodeURIComponent(key)}&rt=G,Blue&outputType=JSON`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`CTA trains: ${res.status}`)
  const body = (await res.json()).ctatt || {}
  if (body.errCd && body.errCd !== '0') throw new Error(`CTA trains: ${body.errNm}`)
  return (body.route || []).flatMap((r) =>
    (r.train || []).map((t) => ({
      agency: 'CTA',
      mode: 'train',
      route: TRAIN_LINES[r['@name']] || r['@name'],
      routeName: t.destNm && t.destNm !== 'See train' ? `to ${t.destNm}` : '', // 'See train' is CTA's placeholder
      lat: +t.lat,
      lon: +t.lon,
      heading: +t.heading,
      id: t.rn,
      nextStop: t.nextStaNm,
      approaching: t.isApp === '1',
      delayed: t.isDly === '1',
    })),
  )
}

async function vehicles(env) {
  const results = await Promise.allSettled([
    ...Object.entries(ROUTES).map(([n, id]) => fetchRoute(n, id)),
    fetchCta(env.CTA_BUS_KEY),
    fetchCtaTrains(env.CTA_TRAIN_KEY),
  ])
  const ok = results.filter((r) => r.status === 'fulfilled').flatMap((r) => r.value)
  const errors = results.filter((r) => r.status === 'rejected').map((r) => r.reason.message)
  if (ok.length === 0 && errors.length) throw new Error(errors.join('; '))
  return { fetchedAt: new Date().toISOString(), vehicles: ok, errors }
}

// CTA times are Chicago wall-clock strings with no zone; parse both sides the
// same way so the difference is right regardless of the Worker's time zone.
const wall = (s) => Date.parse(s.replace(' ', 'T').replace(/^(\d{4})(\d{2})(\d{2})T/, '$1-$2-$3T') + 'Z')

async function trainArrivals(key, mapid) {
  if (!key) throw new Error('CTA trains: no CTA_TRAIN_KEY secret')
  const res = await fetch(`${CTA_TRAIN_ARRIVALS}?key=${encodeURIComponent(key)}&mapid=${mapid}&max=12&outputType=JSON`)
  if (!res.ok) throw new Error(`CTA trains: ${res.status}`)
  const body = (await res.json()).ctatt || {}
  if (body.errCd && body.errCd !== '0') throw new Error(`CTA trains: ${body.errNm}`)
  const now = wall(body.tmst)
  return (body.eta || [])
    .filter((e) => !/terminal arrival/i.test(e.stpDe)) // trains ending here aren't boardable
    .map((e) => ({
      route: TRAIN_LINES[{ G: 'g', Blue: 'blue' }[e.rt]] || e.rt,
      direction: e.stpDe.replace(/^Service /, ''),
      destination: e.destNm,
      minutes: Math.max(0, Math.round((wall(e.arrT) - now) / 60000)),
      approaching: e.isApp === '1',
      scheduled: e.isSch === '1',
      delayed: e.isDly === '1',
    }))
}

async function busArrivals(key, stpid) {
  if (!key) throw new Error('CTA buses: no CTA_BUS_KEY secret')
  const res = await fetch(`${CTA_BUS_PREDICTIONS}?key=${encodeURIComponent(key)}&stpid=${stpid}&top=12&format=json`)
  if (!res.ok) throw new Error(`CTA buses: ${res.status}`)
  const body = (await res.json())['bustime-response'] || {}
  const fatal = (body.error || []).filter((e) => !/no (arrival|service|data)/i.test(e.msg))
  if (!body.prd && fatal.length) throw new Error(`CTA buses: ${fatal.map((e) => e.msg).join('; ')}`)
  return (body.prd || []).map((p) => ({
    route: p.rt,
    direction: p.rtdir,
    destination: p.des,
    minutes: p.prdctdn === 'DUE' ? 0 : Number(p.prdctdn) || 0,
    approaching: p.prdctdn === 'DUE',
    scheduled: false,
    delayed: p.dly,
  }))
}

// Cache a JSON response for everyone for `seconds`, keyed by `cacheUrl`
async function cachedJson(ctx, cacheUrl, seconds, build) {
  const cache = caches.default
  const key = new Request(cacheUrl)
  let res = await cache.match(key)
  if (!res) {
    res = new Response(JSON.stringify(await build()), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${seconds}` },
    })
    ctx.waitUntil(cache.put(key, res.clone()))
  }
  return res
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors(request) })

    if (url.pathname === '/arrivals') {
      const type = url.searchParams.get('type')
      const id = url.searchParams.get('id') || ''
      // Only numeric CTA ids, so callers can't use this to reach anything else
      if (!['train', 'bus'].includes(type) || !/^\d{1,6}$/.test(id)) {
        return new Response(JSON.stringify({ error: 'Bad request' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors(request) } })
      }
      try {
        let res = await cachedJson(ctx, `${url.origin}/arrivals/${type}/${id}`, 20, async () => ({
          fetchedAt: new Date().toISOString(),
          arrivals: type === 'train' ? await trainArrivals(env.CTA_TRAIN_KEY, id) : await busArrivals(env.CTA_BUS_KEY, id),
        }))
        res = new Response(res.body, res)
        for (const [k, v] of Object.entries(cors(request))) res.headers.set(k, v)
        return res
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 502, headers: { 'Content-Type': 'application/json', ...cors(request) } })
      }
    }

    if (url.pathname !== '/vehicles') return new Response('Not found', { status: 404 })

    // Share one upstream fetch across all viewers for CACHE_SECONDS
    const cache = caches.default
    const key = new Request(url.origin + '/vehicles')
    let res = await cache.match(key)
    if (!res) {
      try {
        res = new Response(JSON.stringify(await vehicles(env)), {
          headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${CACHE_SECONDS}` },
        })
        ctx.waitUntil(cache.put(key, res.clone()))
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 502,
          headers: { 'Content-Type': 'application/json', ...cors(request) },
        })
      }
    }
    res = new Response(res.body, res)
    for (const [k, v] of Object.entries(cors(request))) res.headers.set(k, v)
    return res
  },
}
