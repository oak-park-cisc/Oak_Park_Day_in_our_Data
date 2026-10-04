import { routeColor } from './data'
import { heatGradient, MAX_MIN, MAX_SAVED, savedGradient } from './heat'
import { DAYS } from './RoutesPanel'

const clock = (m) => {
  const h = Math.floor(m / 60) % 24
  const mm = String(Math.floor(m % 60)).padStart(2, '0')
  return `${h % 12 || 12}:${mm} ${h < 12 ? 'a.m.' : 'p.m.'}`
}
const mins = (m) => `${Math.max(1, Math.round(m))} min`

// Continuous scale with evenly spaced ticks; the last one reads "N+ min"
function Legend({ gradient, max, step, label }) {
  const ticks = Array.from({ length: max / step + 1 }, (_, i) => i * step)
  return (
    <div className="heat-legend" role="img" aria-label={`${label}: colors run smoothly from 0 to ${max} minutes and over`}>
      <div className="heat-strip" style={{ background: gradient }} />
      <div className="heat-ticks muted small">
        {ticks.map((m) => (
          <span key={m} style={{ left: `${(m / max) * 100}%` }} className={m === max ? 'is-last' : m === 0 ? 'is-first' : ''}>
            {m === max ? `${m}+ min` : m}
          </span>
        ))}
      </div>
    </div>
  )
}

const TimeLegend = () => <Legend gradient={heatGradient} max={MAX_MIN} step={15} label="Travel time" />
const SavedLegend = () => <Legend gradient={savedGradient} max={MAX_SAVED} step={10} label="Minutes saved" />

// "Transit saves time for 46% of the Village, up to 34 min"
function SavedSummary({ saved }) {
  const helped = saved.filter((m) => m >= 1)
  if (!helped.length) return <p className="muted small">Walking is as fast as transit everywhere from here.</p>
  return (
    <p className="small">
      Transit saves time for <b>{Math.round((helped.length / saved.length) * 100)}%</b> of the Village, up to{' '}
      <b>{Math.round(Math.max(...helped))} min</b>. Clear areas: walking is just as fast.
    </p>
  )
}

function HeatToggle({ view, setView }) {
  return (
    <div className="segmented heat-toggle" role="group" aria-label="Heat map shows">
      <button type="button" aria-pressed={view === 'time'} onClick={() => setView('time')}>
        Travel time
      </button>
      <button type="button" aria-pressed={view === 'saved'} onClick={() => setView('saved')}>
        Transit Time Saver
      </button>
    </div>
  )
}

function Legs({ result, palette }) {
  return (
    <ol className="legs">
      {result.legs.map((l, i) => (
        <li key={i}>
          {l.kind === 'walk' && <>Walk {mins(l.min)}</>}
          {l.kind === 'wait' && <span className="muted">Wait {mins(l.min)}</span>}
          {l.kind === 'ride' && (
            <>
              <span
                className="route-tag route-badge"
                style={{ background: routeColor(l.route, palette), borderColor: routeColor(l.route, palette), color: 'var(--on-marker)' }}
              >
                {l.route.split(':')[1]}
              </span>{' '}
              {clock(l.depart)} · {l.stops} {l.stops === 1 ? 'stop' : 'stops'} · {mins(l.min)}
            </>
          )}
        </li>
      ))}
    </ol>
  )
}

export default function TravelPanel({
  ready,
  placing,
  setPlacing,
  start,
  end,
  clear,
  day,
  setDay,
  time,
  setTime,
  result,
  saved,
  heatView,
  setHeatView,
  ms,
  palette,
}) {
  const mode = start && end ? 'trip' : start ? 'from' : end ? 'to' : null
  return (
    <div className="panel travel">
      <p className="muted">
        Drop a start pin to see how long it takes to get everywhere in Oak Park, an end pin to see how long it takes to get there
        from everywhere, or both for the fastest trip. Walking, waiting and riding are all included.
      </p>
      <div className="travel-pins">
        <button type="button" className="chip" aria-pressed={placing === 'start'} onClick={() => setPlacing(placing === 'start' ? null : 'start')}>
          <i className="pin-dot pin-start" /> {start ? 'Move start' : 'Set start'}
        </button>
        <button type="button" className="chip" aria-pressed={placing === 'end'} onClick={() => setPlacing(placing === 'end' ? null : 'end')}>
          <i className="pin-dot pin-end" /> {end ? 'Move end' : 'Set end'}
        </button>
        {(start || end) && (
          <button type="button" className="chip" onClick={clear}>
            Clear
          </button>
        )}
      </div>
      {placing && <p className="travel-hint">Click the map to place the {placing} pin. You can drag pins afterward.</p>}

      <div className="travel-when">
        <label>
          <span className="muted small">Day</span>
          <select value={day} onChange={(e) => setDay(e.target.value)}>
            {Object.entries(DAYS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="muted small">Leaving at</span>
          <input type="time" value={time} onChange={(e) => e.target.value && setTime(e.target.value)} />
        </label>
      </div>

      {!ready && <p className="empty">Loading schedules…</p>}

      {ready && (mode === 'from' || mode === 'to') && (
        <section>
          <HeatToggle view={heatView} setView={setHeatView} />
          {heatView === 'time' ? (
            <>
              <h3>Minutes {mode === 'from' ? 'from the start pin' : 'to the end pin'}</h3>
              <TimeLegend />
            </>
          ) : (
            <>
              <h3>Minutes saved by taking transit instead of walking</h3>
              <SavedLegend />
              {saved && <SavedSummary saved={saved} />}
            </>
          )}
        </section>
      )}
      {ready && mode === 'trip' && result && (
        <section>
          <h3>
            {mins(result.minutes)}
            {result.legs.some((l) => l.kind === 'ride') ? ' by transit' : ' walking'}
          </h3>
          {result.legs.some((l) => l.kind === 'ride') ? (
            <p className="small">
              <b>Saves {mins(result.walkOnly - result.minutes)}</b> <span className="muted">vs. walking the whole way ({mins(result.walkOnly)})</span>
            </p>
          ) : (
            <p className="muted small">Walking is fastest for this trip.</p>
          )}
          <Legs result={result} palette={palette} />
        </section>
      )}
      {ready && ms != null && <p className="muted small">Calculated in {Math.max(1, Math.round(ms))} ms on this device.</p>}

      <p className="muted small route-note">
        An estimate from the {DAYS[day].toLowerCase()} schedule, leaving over the next half hour (the map shows the middle result). Walking is
        about 3 mph along real streets and paths (OpenStreetMap), crossing the Eisenhower only where a street does. Live delays
        aren't included.
      </p>
    </div>
  )
}
