// Travel-time estimates for the Travel tab, computed in the browser from
// public/data/travel.json (scripts/build_travel.py). A small RAPTOR: walk to
// nearby stops, ride up to three vehicles with walking transfers between, walk
// to the destination. Times are minutes since midnight of the service day.
//
// Walking follows real streets (OpenStreetMap). The build script measured
// street-network minutes from each 100 m cell to nearby stops and to its 8
// neighbor cells, and between stops; here a pin snaps to its nearest cell and
// walking spreads over that cell graph. So the Eisenhower is crossed only
// where a street actually crosses it.

// Up to three vehicles: e.g. 86 down Ridgeland, Green Line to Austin, 91 south.
// Oak Park's routes are short straight lines, so corner-to-corner trips need it.
const RIDES = 3
const KY = 111320
const KX = 111320 * Math.cos((41.887 * Math.PI) / 180)
const INF = 1e9

const xy = ([lat, lon]) => [lon * KX, lat * KY]

export function prepare(data) {
  const { speed, cellStops, cellNbrs, transfers } = data.walk
  return { raw: data, cells: data.cells.map(xy), speed, cellStops, cellNbrs, transfers, stopCount: data.stops.length }
}

// A pin: its nearest cell, plus the straight walk to that cell's center
// (under ~70 m inside the Village)
function anchor(net, ll) {
  const p = xy(ll)
  let cell = 0
  let best = INF
  net.cells.forEach((c, i) => {
    const d = Math.hypot(c[0] - p[0], c[1] - p[1])
    if (d < best) {
      best = d
      cell = i
    }
  })
  return { cell, snap: best / net.speed }
}

// Walking minutes from an anchor to every cell over the cell graph (Dijkstra).
// The graph is symmetric, so this is also minutes from every cell to it.
function walkCells(net, { cell, snap }) {
  const dist = new Float64Array(net.cells.length).fill(INF)
  dist[cell] = snap
  const heap = [[snap, cell]]
  const push = (item) => {
    heap.push(item)
    for (let i = heap.length - 1; i > 0; ) {
      const up = (i - 1) >> 1
      if (heap[up][0] <= heap[i][0]) break
      ;[heap[up], heap[i]] = [heap[i], heap[up]]
      i = up
    }
  }
  const pop = () => {
    const top = heap[0]
    const last = heap.pop()
    if (heap.length) {
      heap[0] = last
      for (let i = 0; ; ) {
        const l = 2 * i + 1
        const r = l + 1
        let m = i
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r
        if (m === i) break
        ;[heap[m], heap[i]] = [heap[i], heap[m]]
        i = m
      }
    }
    return top
  }
  while (heap.length) {
    const [d, c] = pop()
    if (d > dist[c]) continue
    for (const [n, w] of net.cellNbrs[c]) {
      if (d + w < dist[n]) {
        dist[n] = d + w
        push([d + w, n])
      }
    }
  }
  return dist
}

// You can always walk from a neighboring cell, so no cell should be slower than
// a neighbor plus the hop. Each cell only checks its own short list of stops,
// so without this an edge cell with few stops nearby can come out several
// minutes slower than the cell next door. Multi-source Dijkstra over the cells.
function relax(net, values) {
  const out = Float64Array.from(values)
  // Sweep cells in time order, repeating until nothing improves (two or three
  // passes in practice; ~1,200 cells)
  const order = Array.from(out.keys()).sort((a, b) => out[a] - out[b])
  for (let changed = true; changed; ) {
    changed = false
    for (const c of order) {
      for (const [n, w] of net.cellNbrs[c]) {
        if (out[c] + w < out[n] - 1e-9) {
          out[n] = out[c] + w
          changed = true
        }
      }
    }
  }
  return Array.from(out)
}

// Stops reachable on foot from an anchor: its cell's street-network list plus the snap
const stopsNear = (net, a) => net.cellStops[a.cell].map(([s, w]) => [s, w + a.snap])

// First trip in a pattern leaving stop column i at or after time t (trips are sorted)
function firstTrip(rows, i, t) {
  let lo = 0
  let hi = rows.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (rows[mid][i] < t) lo = mid + 1
    else hi = mid
  }
  return lo < rows.length ? lo : -1
}

// Earliest arrival at every stop, starting with a walk to the `access` stops ([stop, min]) at t0
function raptor(net, day, access, t0) {
  const n = net.stopCount
  const best = new Float64Array(n).fill(INF)
  const prev = Array.from({ length: n })
  for (const [s, w] of access) {
    best[s] = t0 + w
    prev[s] = { kind: 'access', walk: w }
  }
  const patterns = net.raw.days[day] || []
  for (let k = 0; k < RIDES; k++) {
    const from = best.slice()
    const improved = []
    for (const pat of patterns) {
      let trip = -1
      let boardAt = -1
      for (let i = 0; i < pat.s.length; i++) {
        const s = pat.s[i]
        if (trip >= 0) {
          const t = pat.t[trip][i]
          if (t < best[s]) {
            best[s] = t
            prev[s] = { kind: 'ride', pat, trip, board: boardAt, alight: i, fromStop: pat.s[boardAt] }
            improved.push(s)
          }
        }
        if (from[s] < INF && (trip < 0 || from[s] < pat.t[trip][i])) {
          const j = firstTrip(pat.t, i, from[s])
          if (j >= 0 && (trip < 0 || j < trip)) {
            trip = j
            boardAt = i
          }
        }
      }
    }
    if (!improved.length) break
    for (const s of improved) {
      for (const [u, w] of net.transfers[s]) {
        if (best[s] + w < best[u]) {
          best[u] = best[s] + w
          prev[u] = { kind: 'transfer', fromStop: s, walk: w }
        }
      }
    }
  }
  return { best, prev }
}

// Minutes to a destination leaving at t0, given a finished raptor(): the
// better of walking the whole way and riding then walking from an `egress` stop
function arriveAt(r, walkOnly, egress, t0) {
  let best = t0 + walkOnly
  let via = -1
  for (const [s, w] of egress) {
    if (r.best[s] + w < best) {
      best = r.best[s] + w
      via = s
    }
  }
  return { minutes: best - t0, via }
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  return s[s.length >> 1]
}

// Leaving every 5 min over the next half hour, so one lucky or unlucky
// connection doesn't decide the map
const SAMPLES = [0, 5, 10, 15, 20, 25, 30]

// Each heat map returns { minutes, walk }: best time per cell (transit or
// walking) and the walk-only time, so the map can also show time saved

// (1) Start pin: minutes from `start` to every cell
export function fromStart(net, day, start, t0) {
  const a = anchor(net, start)
  const walk = walkCells(net, a)
  const runs = SAMPLES.map((d) => raptor(net, day, stopsNear(net, a), t0 + d))
  return {
    minutes: relax(
      net,
      net.cells.map((_, i) => median(runs.map((r, k) => arriveAt(r, walk[i], net.cellStops[i], t0 + SAMPLES[k]).minutes))),
    ),
    walk: Array.from(walk),
  }
}

// (2) End pin: minutes from every cell to `end`. One forward search per cell
// (the network is tiny), so waiting at the first stop counts the same as in (1).
// Three samples, not seven: this runs a search per cell, and street walking
// makes each one a bit heavier; keeps slow phones well under 2 s
const END_SAMPLES = [0, 15, 30]
export function toEnd(net, day, end, t0) {
  const b = anchor(net, end)
  const walk = walkCells(net, b)
  const egress = stopsNear(net, b)
  return {
    minutes: relax(
      net,
      net.cells.map((_, i) =>
        median(END_SAMPLES.map((d) => arriveAt(raptor(net, day, net.cellStops[i], t0 + d), walk[i], egress, t0 + d).minutes)),
      ),
    ),
    walk: Array.from(walk),
  }
}

// (3) Both pins: the fastest trip leaving at t0, as legs
export function trip(net, day, start, end, t0) {
  const a = anchor(net, start)
  const b = anchor(net, end)
  const walkOnly = walkCells(net, a)[b.cell] + b.snap
  const r = raptor(net, day, stopsNear(net, a), t0)
  const { minutes, via } = arriveAt(r, walkOnly, stopsNear(net, b), t0)
  const stopLL = (s) => net.raw.stops[s]
  if (via < 0) return { minutes, walkOnly, legs: [{ kind: 'walk', min: walkOnly, path: [start, end] }] }

  // Walk back through the labels from the last stop to the start
  const legs = []
  let s = via
  legs.unshift({ kind: 'walk', min: minutes + t0 - r.best[via], path: [stopLL(via), end] })
  while (s !== undefined && r.prev[s]) {
    const pr = r.prev[s]
    if (pr.kind === 'access') {
      legs.unshift({ kind: 'walk', min: pr.walk, path: [start, stopLL(s)] })
      break
    }
    if (pr.kind === 'transfer') {
      legs.unshift({ kind: 'walk', min: pr.walk, path: [stopLL(pr.fromStop), stopLL(s)] })
      s = pr.fromStop
      continue
    }
    const row = pr.pat.t[pr.trip]
    legs.unshift({
      kind: 'ride',
      route: pr.pat.r,
      depart: row[pr.board],
      arrive: row[pr.alight],
      stops: pr.alight - pr.board,
      min: row[pr.alight] - row[pr.board],
      path: pr.pat.s.slice(pr.board, pr.alight + 1).map(stopLL),
    })
    s = pr.fromStop
  }
  // Waits: the gap between reaching a stop and the vehicle leaving. Back-to-back
  // walks (a transfer chained to another) read as one walk.
  let clock = t0
  const out = []
  for (const leg of legs) {
    if (leg.kind === 'ride') {
      if (leg.depart - clock > 0.5) out.push({ kind: 'wait', min: leg.depart - clock })
      clock = leg.arrive
      out.push(leg)
      continue
    }
    clock += leg.min
    const last = out.at(-1)
    if (last?.kind === 'walk') {
      last.min += leg.min
      last.path = [...last.path, ...leg.path.slice(1)]
    } else out.push({ ...leg })
  }
  return { minutes, walkOnly, legs: out }
}
