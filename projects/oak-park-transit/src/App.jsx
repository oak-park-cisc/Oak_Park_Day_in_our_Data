import { useEffect, useMemo, useRef, useState } from 'react'
import AboutData from './AboutData'
import {
  ACCESS,
  BUS_RANGE_M,
  FADE_M,
  featureRouteKey,
  loadAlerts,
  loadBoundary,
  loadLiveBuses,
  loadRoutes,
  loadService,
  loadTravel,
  loadStops,
  metersFromVillage,
  nearVillage,
  PALETTES,
  stopRouteKeys,
  vehicleRouteKey,
} from './data'
import MapView from './MapView'
import ProviderGuide from './ProviderGuide'
import RoutesPanel, { RouteBadge, todayType } from './RoutesPanel'
import TravelPanel from './TravelPanel'
import { fromStart, prepare, toEnd, trip } from './travel'

const nowHHMM = () => new Date().toTimeString().slice(0, 5)
const toMinutes = (hhmm) => +hhmm.slice(0, 2) * 60 + +hhmm.slice(3, 5)
import StatusPanel from './StatusPanel'
import { BUS_SVG, MOON_SVG, SUN_SVG, TRAIN_SVG } from './icons'
import { addSnapshot, loadTrails } from './trails'

const BUS_POLL_MS = 30000

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

function liveCount(vehicles) {
  const trains = vehicles.filter((v) => v.mode === 'train').length
  const buses = vehicles.length - trains
  return trains ? `${plural(buses, 'bus', 'buses')} · ${plural(trains, 'train', 'trains')}` : plural(buses, 'bus', 'buses')
}

const timeOf = (iso) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

// "About the data" wrapped to two lines once Routes made four tabs
const TABS = { status: 'Status', routes: 'Routes', travel: 'Travel', providers: 'Providers', about: 'About' }

const THEME_KEY = 'op-transit-theme'

function initialTheme() {
  try {
    return localStorage.getItem(THEME_KEY) === 'night' ? 'night' : 'day'
  } catch {
    return 'day'
  }
}

function Glyph({ svg, className = 'glyph' }) {
  return <span className={className} dangerouslySetInnerHTML={{ __html: svg }} />
}

function Logo() {
  return (
    <svg className="logo" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--logo-bg)" />
      <path d="M6 12h20" stroke="#3DDC84" strokeWidth="3" strokeLinecap="round" />
      <path d="M6 20h20" stroke="#4CC9F0" strokeWidth="3" strokeLinecap="round" />
      <path d="M16 6v20" stroke="#B99CFF" strokeWidth="3" strokeLinecap="round" />
      <circle cx="16" cy="12" r="2.6" fill="#fff" />
      <circle cx="16" cy="20" r="2.6" fill="#fff" />
    </svg>
  )
}

function LiveStatus({ on, data }) {
  if (!on) return <span className="live-chip is-off">Live vehicles off</span>
  if (!data) return <span className="live-chip is-loading">Finding vehicles…</span>
  if (!data.live)
    return (
      <span className="live-chip is-stale" title={data.error}>
        Live feed unavailable · sample from {timeOf(data.fetchedAt)}
      </span>
    )
  return (
    <span className="live-chip is-live">
      <i className="pulse" aria-hidden="true" />
      <span>
        <b>{liveCount(data.vehicles)}</b>
        <span className="live-word"> live</span>
      </span>
      <span className="live-time">{timeOf(data.fetchedAt)}</span>
    </span>
  )
}

function Chip({ pressed, onClick, disabled, swatch, children }) {
  return (
    <button type="button" className="chip" aria-pressed={pressed} onClick={onClick} disabled={disabled}>
      {swatch && <i className="swatch" style={{ background: swatch }} />}
      {children}
    </button>
  )
}

function MapKey({ colorBy, palette }) {
  const lines = [
    ['Green Line', palette.lines.Green],
    ['Blue Line', palette.lines.Blue],
    ['Metra UP-W', palette.agency.Metra],
    ['CTA bus', palette.agency.CTA],
    ['Pace bus', palette.agency.Pace],
  ]
  // Open on wide screens; folded on phones so it doesn't cover the map
  const [open] = useState(() => window.matchMedia('(min-width: 861px)').matches)
  return (
    <details className="map-key" open={open}>
      <summary>Map key</summary>
      <ul>
        {colorBy === 'agency' &&
          lines.map(([label, color]) => (
            <li key={label}>
              <i className="key-line" style={{ background: color }} />
              {label}
            </li>
          ))}
        {colorBy === 'access' &&
          Object.entries(ACCESS).map(([k, a]) => (
            <li key={k}>
              <i className="key-dot" style={{ background: palette.access[k] }} />
              {a.label}
            </li>
          ))}
        <li className="key-divider">
          <i className="key-dot" />
          Bus stop
        </li>
        <li>
          <Glyph svg={TRAIN_SVG} className="key-station" />
          Rail station
        </li>
        <li>
          <Glyph svg={BUS_SVG} className="key-vehicle" />
          Live bus
        </li>
        <li>
          <Glyph svg={TRAIN_SVG} className="key-vehicle is-train" />
          Live train
        </li>
        <li>
          <i className="key-ring" />
          Station alert
        </li>
        <li>
          <i className="key-boundary" />
          Village line
        </li>
      </ul>
    </details>
  )
}

export default function App() {
  const [stops, setStops] = useState([])
  const [routes, setRoutes] = useState(null)
  const [boundary, setBoundary] = useState(null)
  const [alertData, setAlertData] = useState({ fetchedAt: null, alerts: [] })
  const [error, setError] = useState(null)

  const [theme, setTheme] = useState(initialTheme)
  const palette = PALETTES[theme]
  const tabRefs = useRef({})

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      // private mode: theme just won't be remembered
    }
  }, [theme])

  const [tab, setTab] = useState('status')
  const [colorBy, setColorBy] = useState('agency')
  const [agencies, setAgencies] = useState({ CTA: true, Pace: true, Metra: true })
  const [villageOnly, setVillageOnly] = useState(false)
  const [showRoutes, setShowRoutes] = useState(true)
  const [showBuses, setShowBuses] = useState(true)
  const [buses, setBuses] = useState(null)
  const [showTrails, setShowTrails] = useState(true)
  const [trails, setTrails] = useState(loadTrails)

  // Route mode: one route's line, stops and live vehicles, plus its schedule in the Routes tab
  const [service, setService] = useState(null)
  const [route, setRoute] = useState(null)
  const [day, setDay] = useState(todayType)

  // Travel time: pins, when, and the in-browser estimate (src/travel.js)
  const [net, setNet] = useState(null)
  const [placing, setPlacing] = useState('start')
  const [pins, setPins] = useState({ start: null, end: null })
  const [travelDay, setTravelDay] = useState(todayType)
  const [travelTime, setTravelTime] = useState(nowHHMM)
  const [heatView, setHeatView] = useState('time') // 'time' or 'saved' (Transit Time Saver)

  const busesOn = showBuses && (route || agencies.CTA || agencies.Pace)

  useEffect(() => {
    if (!busesOn) return
    let cancelled = false
    const tick = () =>
      loadLiveBuses().then((b) => {
        if (cancelled) return
        setBuses(b)
        if (b.live) setTrails((t) => addSnapshot(t, b.vehicles, b.fetchedAt))
      })
    tick()
    const id = setInterval(tick, BUS_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [busesOn])

  // Buses within BUS_RANGE_M of the Village; in Village-only mode, only inside the fade (FADE_M)
  const busRange = villageOnly ? FADE_M : BUS_RANGE_M
  const visibleBuses = useMemo(
    () =>
      busesOn && buses
        ? {
            ...buses,
            vehicles: buses.vehicles.filter(
              (v) =>
                (route ? vehicleRouteKey(v) === route : agencies[v.agency]) &&
                (!boundary || metersFromVillage(v, boundary) <= busRange),
            ),
          }
        : null,
    [busesOn, buses, agencies, boundary, busRange, route],
  )

  useEffect(() => {
    Promise.all([loadStops(), loadRoutes(), loadBoundary(), loadAlerts()])
      .then(([s, r, b, a]) => {
        setStops(s.map((stop) => ({ ...stop, nearVillage: nearVillage(stop, b) })))
        setRoutes(r)
        setBoundary(b)
        setAlertData(a)
      })
      .catch((e) => setError(e.message))
    // Schedules only feed the Routes tab, so a failure here shouldn't blank the map
    loadService()
      .then(setService)
      .catch(() => setService({ routes: {}, days: {}, firstHour: 4 }))
  }, [])

  const visibleStops = useMemo(
    () =>
      stops.filter(
        (s) => (route ? stopRouteKeys(s).includes(route) : agencies[s.agency]) && (!villageOnly || s.nearVillage),
      ),
    [stops, agencies, villageOnly, route],
  )
  const visibleRoutes = useMemo(
    () =>
      routes && {
        ...routes,
        features: routes.features.filter((f) => (route ? featureRouteKey(f) === route : agencies[f.properties.agency])),
      },
    [routes, agencies, route],
  )

  const pickRoute = (key) => {
    setRoute(key)
    if (key) setTab('routes')
  }

  // Load the timetable the first time someone opens the Travel tab
  const travelOn = tab === 'travel'
  useEffect(() => {
    if (travelOn && !net) loadTravel().then((d) => setNet(prepare(d)))
  }, [travelOn, net])

  const travelResult = useMemo(() => {
    if (!travelOn || !net || (!pins.start && !pins.end)) return null
    const t0 = toMinutes(travelTime)
    const began = performance.now()
    if (pins.start && pins.end) return { trip: trip(net, travelDay, pins.start, pins.end, t0), ms: performance.now() - began }
    const heat = pins.start ? fromStart(net, travelDay, pins.start, t0) : toEnd(net, travelDay, pins.end, t0)
    // Minutes transit saves over walking the whole way (0 where walking is as fast)
    const saved = heat.minutes.map((m, i) => Math.max(0, heat.walk[i] - m))
    return { minutes: heat.minutes, saved, ms: performance.now() - began }
  }, [travelOn, net, pins, travelDay, travelTime])

  const placePin = (which, ll) => {
    setPins((p) => ({ ...p, [which]: ll }))
    // After the start goes down, the next click sets the end
    setPlacing(which === 'start' && !pins.end ? 'end' : null)
  }

  const loading = !error && stops.length === 0

  const tabKeys = Object.keys(TABS)
  const onTabKey = (e) => {
    const i = tabKeys.indexOf(tab)
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabKeys.length - 1 }[e.key]
    if (next === undefined) return
    e.preventDefault()
    const k = tabKeys[(next + tabKeys.length) % tabKeys.length]
    setTab(k)
    tabRefs.current[k]?.focus()
  }

  return (
    <div className="app">
      <header className="appbar">
        <div className="brand">
          <Logo />
          <div>
            <h1>Oak Park Transit</h1>
            <p>Stops, routes, accessibility and live service for CTA, Pace and Metra</p>
          </div>
        </div>
        <div className="appbar-actions">
          <LiveStatus on={busesOn} data={visibleBuses} />
          <button
            type="button"
            className="theme-toggle"
            onClick={() => setTheme(theme === 'night' ? 'day' : 'night')}
            aria-label={theme === 'night' ? 'Switch to day map' : 'Switch to night map'}
          >
            <Glyph svg={theme === 'night' ? SUN_SVG : MOON_SVG} />
            <span>{theme === 'night' ? 'Day' : 'Night'}</span>
          </button>
        </div>
      </header>

      <main>
        <section className="map-wrap" aria-label="Transit map">
          <div className="toolbar">
            <div className="chip-group" role="group" aria-label="Providers">
              {Object.keys(agencies).map((a) => (
                <Chip
                  key={a}
                  pressed={agencies[a]}
                  disabled={!!route}
                  swatch={palette.agency[a]}
                  onClick={() => setAgencies({ ...agencies, [a]: !agencies[a] })}
                >
                  {a}
                </Chip>
              ))}
            </div>
            <div className="chip-group" role="group" aria-label="Map layers">
              <Chip pressed={showRoutes} onClick={() => setShowRoutes(!showRoutes)}>
                Routes
              </Chip>
              <Chip pressed={showBuses} onClick={() => setShowBuses(!showBuses)}>
                Live vehicles
              </Chip>
              <Chip pressed={showTrails && showBuses} disabled={!showBuses} onClick={() => setShowTrails(!showTrails)}>
                Trails
              </Chip>
              <Chip pressed={villageOnly} onClick={() => setVillageOnly(!villageOnly)}>
                Village only
              </Chip>
            </div>
            <div className="segmented" role="group" aria-label="Color stops by">
              <button type="button" aria-pressed={colorBy === 'agency'} onClick={() => setColorBy('agency')}>
                Provider
              </button>
              <button type="button" aria-pressed={colorBy === 'access'} onClick={() => setColorBy('access')}>
                Accessibility
              </button>
            </div>
          </div>

          <div className="map-stage">
            {error ? (
              <div className="map-error" role="alert">
                <b>The map data didn't load.</b>
                <span>{error}. Check your connection and reload the page.</span>
              </div>
            ) : (
              <MapView
                stops={visibleStops}
                routes={visibleRoutes}
                boundary={boundary}
                fade={villageOnly}
                alerts={alertData.alerts}
                colorBy={colorBy}
                showRoutes={showRoutes || !!route}
                focusRoute={route}
                onShowRoute={pickRoute}
                travel={
                  travelOn && net
                    ? {
                        cells: net.raw.cells,
                        cellM: net.raw.cellM,
                        minutes: (heatView === 'saved' ? travelResult?.saved : travelResult?.minutes) ?? null,
                        scale: heatView,
                        result: travelResult?.trip ?? null,
                        start: pins.start,
                        end: pins.end,
                        placing,
                        onPlace: placePin,
                      }
                    : null
                }
                // Travel time is schedule-based, and moving vehicles would catch pin clicks
                buses={travelOn ? null : visibleBuses}
                trails={!travelOn && showTrails && visibleBuses?.live ? trails : null}
                theme={theme}
                palette={palette}
              />
            )}
            {loading && (
              <div className="map-toast" role="status">
                Loading stops and routes…
              </div>
            )}
            {route && service?.routes[route] && (
              <div className="route-banner" role="status">
                <RouteBadge routeKey={route} route={service.routes[route]} palette={palette} />
                <span>
                  <b>{service.routes[route].name}</b> only
                </span>
                <button type="button" onClick={() => pickRoute(null)}>
                  Show all routes
                </button>
              </div>
            )}
            {!error && <MapKey colorBy={colorBy} palette={palette} />}
            {!loading && !error && <span className="stop-count">{plural(visibleStops.length, 'stop', 'stops')}</span>}
          </div>
        </section>

        <aside aria-label="Service information">
          <nav className="tabs" role="tablist" aria-label="Panels" onKeyDown={onTabKey}>
            {Object.entries(TABS).map(([k, label]) => (
              <button
                key={k}
                ref={(el) => (tabRefs.current[k] = el)}
                id={`tab-${k}`}
                role="tab"
                type="button"
                aria-selected={tab === k}
                aria-controls={`panel-${k}`}
                tabIndex={tab === k ? 0 : -1}
                onClick={() => setTab(k)}
              >
                {label}
                {k === 'status' && alertData.alerts.length > 0 && (
                  <span className="badge" aria-label={`${alertData.alerts.length} alerts`}>
                    {alertData.alerts.length}
                  </span>
                )}
              </button>
            ))}
          </nav>
          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} tabIndex={0} className="tabpanel">
            {tab === 'status' && <StatusPanel alerts={alertData.alerts} fetchedAt={alertData.fetchedAt} />}
            {tab === 'routes' && (
              <RoutesPanel service={service} selected={route} onSelect={pickRoute} day={day} setDay={setDay} palette={palette} alerts={alertData.alerts} />
            )}
            {tab === 'travel' && (
              <TravelPanel
                ready={!!net}
                placing={placing}
                setPlacing={setPlacing}
                start={pins.start}
                end={pins.end}
                clear={() => {
                  setPins({ start: null, end: null })
                  setPlacing('start')
                }}
                day={travelDay}
                setDay={setTravelDay}
                time={travelTime}
                setTime={setTravelTime}
                result={travelResult?.trip ?? null}
                saved={travelResult?.saved ?? null}
                heatView={heatView}
                setHeatView={setHeatView}
                ms={travelResult?.ms ?? null}
                palette={palette}
              />
            )}
            {tab === 'providers' && <ProviderGuide />}
            {tab === 'about' && <AboutData />}
          </div>
        </aside>
      </main>
    </div>
  )
}
