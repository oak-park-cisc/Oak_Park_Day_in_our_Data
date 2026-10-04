import { lazy, Suspense } from 'react'
import { routeColor } from './data'
import Fare from './Fare'
import { every, hourRange } from './hours'
import { Alert } from './StatusPanel'

// Recharts is big; only load it once someone opens a route
const FrequencyChart = lazy(() => import('./FrequencyChart'))

export const DAYS = { weekday: 'Weekday', saturday: 'Saturday', sunday: 'Sunday' }

export const todayType = () => ['sunday', 'weekday', 'weekday', 'weekday', 'weekday', 'weekday', 'saturday'][new Date().getDay()]

const GROUPS = [
  ['Trains', (r) => r.agency === 'Metra' || r.route === 'Green' || r.route === 'Blue'],
  ['CTA buses', (r) => r.agency === 'CTA'],
  ['Pace buses', (r) => r.agency === 'Pace'],
]

const isRail = (r) => GROUPS[0][1](r)

// Badge text matches the Status tab's route tags: "Green", "Blue", "UP-W", "90"
export function RouteBadge({ routeKey, route, palette }) {
  const c = routeColor(routeKey, palette)
  return (
    <span className="route-tag route-badge" style={{ background: c, borderColor: c, color: 'var(--on-marker)' }}>
      {route.route}
    </span>
  )
}

function DayPicker({ day, setDay }) {
  return (
    <div className="segmented day-picker" role="group" aria-label="Day of week">
      {Object.entries(DAYS).map(([k, label]) => (
        <button key={k} type="button" aria-pressed={day === k} onClick={() => setDay(k)}>
          {label}
        </button>
      ))}
    </div>
  )
}

// CTA alerts name lines by id ("G", "Blue", "66"); we only have a CTA alert feed
export function routeAlerts(route, alerts) {
  if (route.agency !== 'CTA' || !alerts) return []
  const id = route.route === 'Green' ? 'G' : route.route
  return alerts.filter((a) => a.routes.includes(id))
}

const OTHER_ALERTS = {
  Pace: { label: 'pacebus.com', url: 'https://www.pacebus.com/' },
  Metra: { label: "Metra's Oak Park station page", url: 'https://metra.com/train-lines/stations/oak-park' },
}

function RouteAlerts({ route, alerts }) {
  const other = OTHER_ALERTS[route.agency]
  if (other) {
    return (
      <section className="direction">
        <h3>Service alerts</h3>
        <p className="muted small">
          {route.agency} alerts aren't included here. Check{' '}
          <a href={other.url} target="_blank" rel="noreferrer">
            {other.label}
          </a>
          .
        </p>
      </section>
    )
  }
  const mine = routeAlerts(route, alerts)
  return (
    <section className="direction">
      <h3>Service alerts{mine.length > 0 && ` (${mine.length})`}</h3>
      {mine.length === 0 ? (
        <p className="empty">No CTA alerts for this route right now.</p>
      ) : (
        <>
          <ul className="alerts">
            {mine.map((a) => (
              <Alert key={a.id} a={a} />
            ))}
          </ul>
          {isRail(route) && <p className="muted small">Alerts cover the whole line, so some may be outside Oak Park.</p>}
        </>
      )}
    </section>
  )
}

const spanText = (s) => (!s ? 'No service' : s.allDay ? '24 hours' : `${s.first} – ${s.last}`)

function RouteDetail({ routeKey, route, service, day, setDay, palette, onClear, alerts }) {
  const color = routeColor(routeKey, palette)
  const dirs = route.days[day] || []
  const yMax = Math.max(1, ...dirs.flatMap((d) => d.hourly))
  const unit = isRail(route) ? 'train' : 'bus'
  const units = unit === 'bus' ? 'buses' : 'trains'
  return (
    <div className="panel route-detail">
      <button type="button" className="back-link" onClick={onClear}>
        ← All routes
      </button>
      <div className="route-title">
        <RouteBadge routeKey={routeKey} route={route} palette={palette} />
        <div>
          <strong>{route.name}</strong>
          <span className="muted">{route.agency}</span>
        </div>
      </div>
      <p className="muted small">The map shows only this route, its stops and its live {units}.</p>

      <RouteAlerts route={route} alerts={alerts} />

      <section className="direction">
        <h3>Fare</h3>
        <Fare agency={route.agency} rail={isRail(route)} />
      </section>

      <section className="direction">
        <h3>When it runs</h3>
        <DayPicker day={day} setDay={setDay} />
      </section>

      {dirs.length === 0 ? (
        <p className="empty">No {DAYS[day].toLowerCase()} service.</p>
      ) : (
        dirs.map((d) => {
          const peak = Math.max(...d.hourly)
          const peakHour = service.firstHour + d.hourly.indexOf(peak)
          return (
            <section key={d.label} className="direction">
              <h3>{d.label}</h3>
              <dl className="facts span-facts">
                <dt>In the Village</dt>
                <dd>{spanText(d)}</dd>
                <dt>Trips</dt>
                <dd>
                  {d.trips} · busiest {every(peak)} ({hourRange(peakHour)})
                </dd>
              </dl>
              <Suspense fallback={<div className="freq-chart" style={{ height: 110 }} />}>
                <FrequencyChart hourly={d.hourly} firstHour={service.firstHour} color={color} yMax={yMax} unit={unit} units={units} />
              </Suspense>
            </section>
          )
        })
      )}

      <p className="muted small route-note">
        {route.agency} schedule for {new Date(`${service.days[day]}T12:00`).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}.
        Counts {units} reaching a stop in or just across the Village, by the hour they arrive. Scheduled, not live.
      </p>
    </div>
  )
}

export default function RoutesPanel({ service, selected, onSelect, day, setDay, palette, alerts }) {
  if (!service) return <div className="panel muted">Loading routes…</div>
  const entries = Object.entries(service.routes)
  if (selected && service.routes[selected]) {
    return (
      <RouteDetail
        routeKey={selected}
        route={service.routes[selected]}
        service={service}
        day={day}
        setDay={setDay}
        palette={palette}
        alerts={alerts}
        onClear={() => onSelect(null)}
      />
    )
  }
  const used = new Set()
  return (
    <div className="panel">
      <p className="muted">Every route that stops in Oak Park. Pick one to see only that route on the map, with its hours and how often it runs.</p>
      <DayPicker day={day} setDay={setDay} />
      <p className="muted small">Hours each route serves the Village, first to last trip in either direction.</p>
      {GROUPS.map(([title, match]) => {
        const group = entries.filter(([k, r]) => !used.has(k) && match(r))
        group.forEach(([k]) => used.add(k))
        group.sort(([, a], [, b]) => (parseInt(a.route) || 0) - (parseInt(b.route) || 0))
        return (
          <section key={title}>
            <h3>{title}</h3>
            <ul className="route-list">
              {group.map(([k, r]) => (
                <li key={k}>
                  <button type="button" className="route-row" onClick={() => onSelect(k)}>
                    <RouteBadge routeKey={k} route={r} palette={palette} />
                    <span className="route-row-name">
                      {r.name}
                      {routeAlerts(r, alerts).length > 0 && (
                        <span className="badge route-alert-count" aria-label={`${routeAlerts(r, alerts).length} alerts`}>
                          {routeAlerts(r, alerts).length}
                        </span>
                      )}
                    </span>
                    <span className="muted small">{spanText(r.spans?.[day])}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
