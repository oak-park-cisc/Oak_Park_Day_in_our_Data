import notices from './content/notices.json'
import { ALERT_SVG, ELEVATOR_SVG, PIN_SVG } from './icons'

function fmtDate(s) {
  if (!s) return ''
  return new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const ROUTE_LABELS = { G: 'Green', Blue: 'Blue' }

function Icon({ svg, tone }) {
  return <span className={`alert-icon tone-${tone}`} dangerouslySetInnerHTML={{ __html: svg }} />
}

export function Alert({ a }) {
  return (
    <li className="alert">
      <Icon svg={a.accessibility ? ELEVATOR_SVG : ALERT_SVG} tone={a.accessibility ? 'access' : a.major ? 'major' : 'info'} />
      <div className="alert-main">
        <div className="alert-head">
          {a.routes.map((r) => (
            <span key={r} className={`route-tag route-${r}`}>
              {ROUTE_LABELS[r] ?? r}
            </span>
          ))}
          {a.stationIds.length > 0 && <span className="route-tag">Station</span>}
          <span className="alert-title">{a.headline}</span>
        </div>
        <div className="alert-body">{a.description}</div>
        <div className="muted">
          {a.impact}
          {a.start && ` · since ${fmtDate(a.start)}`}
          {a.end && ` · until ${fmtDate(a.end)}`}
          {a.url && (
            <>
              {' · '}
              <a href={a.url} target="_blank" rel="noreferrer">
                Details
              </a>
            </>
          )}
        </div>
      </div>
    </li>
  )
}

export default function StatusPanel({ alerts, fetchedAt }) {
  const access = alerts.filter((a) => a.accessibility)
  const service = alerts.filter((a) => !a.accessibility)

  return (
    <div className="panel">
      <section>
        <h3>Local notices</h3>
        <p className="muted">Block parties, street closures and stop closures in the Village, entered by hand.</p>
        {notices.length === 0 ? (
          <p className="empty">No local notices yet.</p>
        ) : (
          <ul className="alerts">
            {notices.map((n, i) => (
              <li key={i} className="alert">
                <Icon svg={PIN_SVG} tone="local" />
                <div className="alert-main">
                  <div className="alert-head">
                    <span className="route-tag">{n.type}</span>
                    <span className="alert-title">{n.title}</span>
                  </div>
                  <div className="alert-body">{n.location}</div>
                  <div className="muted">
                    {n.dates}
                    {n.source && (
                      <>
                        {' · '}
                        <a href={n.source} target="_blank" rel="noreferrer">
                          Source
                        </a>
                      </>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3>CTA elevator alerts ({access.length})</h3>
        {access.length === 0 ? (
          <p className="empty">None on lines serving Oak Park.</p>
        ) : (
          <ul className="alerts">
            {access.map((a) => (
              <Alert key={a.id} a={a} />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3>CTA service alerts ({service.length})</h3>
        {service.length === 0 ? (
          <p className="empty">None on routes serving Oak Park.</p>
        ) : (
          <ul className="alerts">
            {service.map((a) => (
              <Alert key={a.id} a={a} />
            ))}
          </ul>
        )}
      </section>

      <p className="muted small">
        CTA alerts as of {fetchedAt ? new Date(fetchedAt).toLocaleString() : 'unknown'}. They cover whole lines, so some may be outside Oak
        Park. Pace and Metra alerts aren't included yet. Check{' '}
        <a href="https://www.pacebus.com/" target="_blank" rel="noreferrer">
          Pace
        </a>{' '}
        and{' '}
        <a href="https://metra.com/train-lines/stations/oak-park" target="_blank" rel="noreferrer">
          Metra
        </a>
        .
      </p>
    </div>
  )
}
