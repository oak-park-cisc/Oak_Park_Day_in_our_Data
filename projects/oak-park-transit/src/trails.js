// Recent positions per bus, built up from each live poll and kept in
// localStorage so a reload doesn't wipe the trails.

export const TRAIL_MINUTES = 15
const STORAGE_KEY = 'op-transit-trails'
const MAX_JUMP_KM = 2 // bigger jumps are GPS glitches or a bus changing runs

function km(a, b) {
  const dy = (a.lat - b.lat) * 111
  const dx = (a.lon - b.lon) * 111 * Math.cos((a.lat * Math.PI) / 180)
  return Math.hypot(dx, dy)
}

// Bus and train ids come from different feeds, so include the mode
export const vehicleKey = (v) => `${v.agency}-${v.mode ?? 'bus'}-${v.id}`

export function loadTrails() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}
  } catch {
    return {}
  }
}

export function addSnapshot(trails, vehicles, fetchedAt) {
  const t = new Date(fetchedAt).getTime()
  const cutoff = Date.now() - TRAIL_MINUTES * 60_000
  const next = {}
  for (const [key, pts] of Object.entries(trails)) {
    const kept = pts.filter((p) => p.t >= cutoff)
    if (kept.length) next[key] = kept
  }
  for (const v of vehicles) {
    const key = vehicleKey(v)
    const pts = next[key] || []
    const last = pts[pts.length - 1]
    const p = { lat: v.lat, lon: v.lon, t }
    if (last && last.lat === p.lat && last.lon === p.lon) continue
    next[key] = last && km(last, p) > MAX_JUMP_KM ? [p] : [...pts, p]
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // storage full or blocked; trails just won't survive a reload
  }
  return next
}
