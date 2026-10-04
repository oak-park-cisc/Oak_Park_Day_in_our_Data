import { useEffect, useState } from 'react'
import { loadArrivals } from './data'
import { loadMetraSchedule, nextDepartures } from './metra'

const REFRESH_MS = 30000
const PER_DIRECTION = 3
const LINE_TAGS = { Green: 'route-G', Blue: 'route-Blue' }

// Group predictions into one row per route and direction, soonest first
function group(arrivals) {
  const rows = new Map()
  for (const a of [...arrivals].sort((x, y) => x.minutes - y.minutes)) {
    const key = `${a.route}|${a.direction}`
    if (!rows.has(key)) rows.set(key, { route: a.route, direction: a.direction, times: [] })
    const row = rows.get(key)
    if (row.times.length < PER_DIRECTION) row.times.push(a)
  }
  return [...rows.values()]
}

function Time({ a }) {
  const label = a.minutes <= 1 || a.approaching ? 'Due' : `${a.minutes} min`
  return (
    <span className={`eta ${a.minutes <= 1 || a.approaching ? 'is-due' : ''}`} title={a.scheduled ? 'Scheduled, not tracked live' : undefined}>
      {label}
      {a.scheduled && <sup>*</sup>}
      {a.delayed && <span className="eta-delayed"> delayed</span>}
    </span>
  )
}

// Scheduled departures at the Oak Park Metra station; recomputed every 30 s
function MetraDepartures() {
  const [state, setState] = useState({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    let id
    loadMetraSchedule()
      .then((data) => {
        const tick = () => !cancelled && setState({ status: 'ok', byDir: nextDepartures(data) })
        tick()
        id = setInterval(tick, REFRESH_MS)
      })
      .catch(() => !cancelled && setState({ status: 'error' }))
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  if (state.status === 'loading') return <p className="arrivals-note">Checking the schedule…</p>
  if (state.status === 'error') return <p className="arrivals-note">The Metra schedule isn't available right now.</p>

  const rows = [
    [1, 'toward Chicago'],
    [0, 'toward Elburn'],
  ].filter(([dir]) => state.byDir[dir].length)
  return (
    <div className="arrivals">
      <b className="arrivals-title">Next scheduled departures</b>
      {rows.length === 0 ? (
        <p className="arrivals-note">No more trains scheduled today.</p>
      ) : (
        <ul>
          {rows.map(([dir, label]) => (
            <li key={dir}>
              <span className="route-tag route-metra">UP-W</span>
              <span className="arrivals-dir">{label}</span>
              <span className="arrivals-times">
                {state.byDir[dir].map((d, i) => (
                  <span key={i} className={`eta ${d.minutesAway <= 1 ? 'is-due' : ''}`} title={`To ${d.headsign}`}>
                    {d.minutesAway < 60 ? (d.minutesAway <= 1 ? 'Due' : `${d.minutesAway} min`) : d.clock}
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="arrivals-foot">From Metra's published schedule, not tracked live</p>
    </div>
  )
}

// Next arrivals for a stop popup: live for CTA, scheduled for Metra. Mounts
// when the popup opens and refreshes while it stays open.
export default function Arrivals({ stop }) {
  if (stop.agency === 'Metra') return <MetraDepartures />
  if (stop.agency !== 'CTA') return <p className="arrivals-note">Live arrivals aren't available for {stop.agency} stops yet.</p>
  return <CtaArrivals stop={stop} />
}

function CtaArrivals({ stop }) {
  const [state, setState] = useState({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    const tick = () =>
      loadArrivals(stop)
        .then((d) => !cancelled && setState({ status: 'ok', ...d }))
        .catch(() => !cancelled && setState((s) => (s.status === 'ok' ? s : { status: 'error' })))
    tick()
    const id = setInterval(tick, REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [stop])

  if (state.status === 'loading') return <p className="arrivals-note">Checking next arrivals…</p>
  if (state.status === 'error') return <p className="arrivals-note">Arrival times aren't available right now.</p>

  const rows = group(state.arrivals)
  const anyScheduled = state.arrivals.some((a) => a.scheduled)
  return (
    <div className="arrivals" aria-live="polite">
      <b className="arrivals-title">Next arrivals</b>
      {rows.length === 0 ? (
        <p className="arrivals-note">No arrivals predicted right now.</p>
      ) : (
        <ul>
          {rows.map((r) => (
            <li key={`${r.route}|${r.direction}`}>
              <span className={`route-tag ${LINE_TAGS[r.route] ?? ''}`}>{r.route}</span>
              <span className="arrivals-dir">{r.direction}</span>
              <span className="arrivals-times">
                {r.times.map((a, i) => (
                  <Time key={i} a={a} />
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}
      {anyScheduled && <p className="arrivals-foot">* From the schedule, not tracked live</p>}
    </div>
  )
}
