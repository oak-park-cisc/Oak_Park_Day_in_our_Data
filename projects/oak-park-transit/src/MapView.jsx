import L from 'leaflet'
import { CircleMarker, GeoJSON, MapContainer, Marker, Pane, Polyline, Popup, TileLayer } from 'react-leaflet'
import { ACCESS, accessOf, BUS_RANGE_M, metersFromVillage, routeIds, stopColor, vehicleRouteKey } from './data'
import Arrivals from './Arrivals'
import Fare from './Fare'
import TravelLayer from './TravelLayer'
import { ARROW_SVG, BUS_SVG, TRAIN_SVG } from './icons'
import { TRAIL_MINUTES, vehicleKey } from './trails'

const CENTER = [41.8875, -87.7915]

// Stop popups grow with arrivals and alerts; scroll instead of overflowing the map on phones
const STOP_POPUP_MAX_H = 340

const vehicleColor = (v, palette) => (v.mode === 'train' ? palette.lines[v.route] : palette.agency[v.agency])

// Reuse icon objects so Leaflet only swaps a vehicle's DOM element when its
// route or heading changes. A fresh icon every render replaced the element
// under the cursor, which could eat clicks and stopped the glide transition.
const vehicleIcons = new Map()

function vehicleIcon(v, live, palette) {
  const color = live ? vehicleColor(v, palette) : palette.stale
  const train = v.mode === 'train'
  const heading = Math.round(v.heading / 15) * 15
  const key = `${train}|${color}|${v.route}|${heading}`
  if (!vehicleIcons.has(key)) {
    vehicleIcons.set(
      key,
      L.divIcon({
        className: 'bus-marker',
        html: `<div class="bus ${train ? 'train' : ''} ${live ? '' : 'bus-stale'}" style="--vehicle:${color}">${train ? TRAIN_SVG : BUS_SVG}<span>${v.route}</span><i class="bus-dir" style="transform: rotate(${heading}deg)">${ARROW_SVG}</i></div>`,
        iconSize: [56, 22],
        iconAnchor: [28, 11],
      }),
    )
  }
  return vehicleIcons.get(key)
}

function stationIcon(fill, alert) {
  return L.divIcon({
    className: '',
    html: `<div class="station ${alert ? 'station-alert' : ''}" style="background:${fill}">${TRAIN_SVG}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  })
}

// Boundary and fade colors come from the theme palette (PALETTES in data.js)
const FADE_MAX = 1 // basemap opacity hidden past 1/4 mile; lower to keep faint streets

// Fade masks are stacked, each covering everything past its distance from the
// Village line. Pick each mask's opacity so the stack ramps linearly to FADE_MAX.
function fadeStyle(feature, steps, fadeColor) {
  const k = feature.properties.step
  const cover = (i) => (i < 0 ? 0 : (FADE_MAX * (i + 1)) / steps)
  return {
    stroke: false,
    fillColor: fadeColor,
    fillOpacity: 1 - (1 - cover(k)) / (1 - cover(k - 1)),
  }
}

function Boundary({ data, fade, palette, theme }) {
  const fades = { ...data, features: data.features.filter((f) => f.properties.kind === 'fade') }
  const village = { ...data, features: data.features.filter((f) => f.properties.kind === 'village') }
  return (
    <>
      {/* Over tiles (200) and route lines/bus trails (400) so they fade out with the
          basemap; under the Village line (450), bus stops (460) and icons (600) */}
      <Pane name="fade" style={{ zIndex: 420 }}>
        {fade && <GeoJSON key={theme} data={fades} style={(f) => fadeStyle(f, fades.features.length, palette.fade)} interactive={false} />}
      </Pane>
      {/* Above routes (400) so Harlem/Austin bus lines don't hide it; below bus stops (460) and icons (600) */}
      <Pane name="boundary" style={{ zIndex: 450 }}>
        <GeoJSON key={theme} data={village} style={{ color: palette.boundary, weight: 2.5, opacity: 0.85, dashArray: '8 6', fill: false }} interactive={false} />
      </Pane>
    </>
  )
}

// focus: route mode, where the one route left on the map draws bold
const routeStyle = (palette, night, focus) => (feature) => {
  const p = feature.properties
  const rail = p.type !== 3 // GTFS route_type 3 = bus
  const railColor = palette.lines[{ G: 'Green', Blue: 'Blue' }[p.route]] ?? (p.agency === 'Metra' ? palette.agency.Metra : p.color)
  return {
    color: rail ? railColor : palette.agency[p.agency],
    weight: focus ? 6 : rail ? 5 : 2.5,
    opacity: focus ? 0.9 : rail ? (night ? 0.75 : 0.85) : night ? 0.4 : 0.35,
    lineCap: 'round',
  }
}

function StopPopup({ stop, alerts, palette }) {
  const key = accessOf(stop)
  const access = ACCESS[key]
  return (
    <div className="popup">
      <strong>{stop.stop_name}</strong>
      <div className="popup-agency">
        <i className="swatch" style={{ background: stopColor(stop, palette) }} />
        {stop.agency} {stop.stop_type === 'rail_station' ? 'station' : 'bus stop'}
        {stop.in_oak_park === 'N' && ' · just outside the Village'}
      </div>
      <div>
        <b>Routes:</b> {stop.routes.split(';').join(', ')}
        {stop.route_names && stop.route_names !== stop.routes && <> ({stop.route_names.split(';').join(', ')})</>}
      </div>
      <div>
        <b>Wheelchair boarding:</b>{' '}
        <span className="access-pill" style={{ '--pill': palette.access[key] }}>{access.label}</span>
        {stop.access_source && (
          <span className="muted small">
            {' '}
            per{' '}
            <a href={stop.access_source.url} target="_blank" rel="noreferrer">
              {stop.access_source.label}
            </a>
          </span>
        )}
      </div>
      {stop.weekday_trips && (
        <div className="muted">
          {stop.weekday_trips} trips on {stop.weekday_date} (one weekday, not a headway)
        </div>
      )}
      <Arrivals stop={stop} />
      {alerts.length > 0 && (
        <div className="popup-alerts">
          <b>{alerts.length} active alert{alerts.length > 1 ? 's' : ''}</b>
          <ul>
            {alerts.slice(0, 3).map((a) => (
              <li key={a.id}>{a.headline}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// One segment per hop so older parts of the trail fade out. At night each hop
// also gets a wide, faint underlay so the trail glows against the dark map.
// Trim a trail hop to the part within BUS_RANGE_M (1/4 mile) of the Village,
// the same limit as route lines and live vehicles. Returns null if none of it is.
function clipHop(a, b, boundary) {
  if (!boundary) return [a, b]
  const near = (p) => metersFromVillage(p, boundary) <= BUS_RANGE_M
  const aIn = near(a)
  const bIn = near(b)
  if (aIn && bIn) return [a, b]
  if (!aIn && !bIn) return null
  // Binary search along the hop for where it crosses the limit
  let inP = aIn ? a : b
  let outP = aIn ? b : a
  for (let i = 0; i < 12; i++) {
    const mid = { lat: (inP.lat + outP.lat) / 2, lon: (inP.lon + outP.lon) / 2 }
    if (near(mid)) inP = mid
    else outP = mid
  }
  return aIn ? [a, inP] : [inP, b]
}

function Trail({ points, color, now, night, boundary }) {
  const maxAge = TRAIL_MINUTES * 60_000
  return points.slice(1).flatMap((p, i) => {
    const hop = clipHop(points[i], p, boundary)
    if (!hop) return []
    const fresh = Math.max(0, 1 - (now - p.t) / maxAge)
    const positions = hop.map((q) => [q.lat, q.lon])
    const line = (
      <Polyline
        key={p.t}
        positions={positions}
        pathOptions={{ color, weight: night ? 3 : 4, opacity: 0.15 + 0.75 * fresh, lineCap: 'round', interactive: false }}
      />
    )
    if (!night) return [line]
    return [
      <Polyline
        key={`${p.t}-glow`}
        positions={positions}
        pathOptions={{ color, weight: 11, opacity: 0.05 + 0.15 * fresh, lineCap: 'round', interactive: false }}
      />,
      line,
    ]
  })
}

export default function MapView({ stops, routes, boundary, fade, alerts, colorBy, showRoutes, focusRoute, onShowRoute, buses, trails, theme, palette, travel }) {
  const night = theme === 'night'
  // Travel tab: clicks on the map drop pins, so stops and stations let clicks through
  const picking = !!travel
  const alertsFor = (stop) =>
    alerts.filter(
      (a) => a.stationIds.includes(stop.stop_id) || (stop.agency === 'CTA' && a.routes.some((r) => routeIds(stop).includes(r))),
    )
  const now = Date.now()
  const fillFor = (s) => (colorBy === 'access' ? palette.access[accessOf(s)] : stopColor(s, palette))

  return (
    <MapContainer center={CENTER} zoom={14} className="map" scrollWheelZoom preferCanvas>
      {/* Esri Canvas basemap (no key): muted base plus a separate street-label layer */}
      <TileLayer
        key={palette.tiles}
        attribution='Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url={`https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_${palette.tiles}_Gray_Base/MapServer/tile/{z}/{y}/{x}`}
        maxZoom={19}
        maxNativeZoom={16}
      />
      <TileLayer
        key={`${palette.tiles}-labels`}
        url={`https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_${palette.tiles}_Gray_Reference/MapServer/tile/{z}/{y}/{x}`}
        maxZoom={19}
        maxNativeZoom={16}
      />
      {boundary && <Boundary data={boundary} fade={fade} palette={palette} theme={theme} />}
      {travel && <TravelLayer {...travel} palette={palette} />}
      {/* GeoJSON ignores new data, so the key changes whenever the visible set does */}
      {showRoutes && routes && (
        <GeoJSON
          key={`routes-${theme}-${focusRoute ?? 'all'}-${routes.features.length}`}
          data={routes}
          style={routeStyle(palette, night, !!focusRoute)}
        />
      )}

      {/* Own pane so bus stops draw over the Village line (450) but under station/bus icons (600) */}
      <Pane name="stops" style={{ zIndex: 460 }}>
        {stops
          .filter((s) => s.stop_type !== 'rail_station')
          .map((s) => (
            <CircleMarker
              // Leaflet reads `interactive` only when a layer is created, so the key changes with it
              key={`${s.agency}-${s.stop_id}-${picking}`}
              interactive={!picking}
              center={[s.lat, s.lon]}
              radius={4.5}
              pathOptions={{ color: palette.ring, weight: 1.5, fillColor: fillFor(s), fillOpacity: 0.95 }}
            >
              {/* Popups inherit the surrounding Pane; put this one back on top (700) */}
              <Popup pane="popupPane" maxHeight={STOP_POPUP_MAX_H}>
                <StopPopup stop={s} alerts={alertsFor(s)} palette={palette} />
              </Popup>
            </CircleMarker>
          ))}
      </Pane>

      {/* Own pane under the fade (420) so trails fade with the basemap; blends as light at night */}
      <Pane name="trails" style={{ zIndex: 410 }}>
        {buses &&
          trails &&
          buses.vehicles.map((v) => {
            const key = vehicleKey(v)
            return (
              trails[key]?.length > 1 && (
                <Trail key={`trail-${key}-${theme}`} points={trails[key]} color={vehicleColor(v, palette)} now={now} night={night} boundary={boundary} />
              )
            )
          })}
      </Pane>

      {stops
        .filter((s) => s.stop_type === 'rail_station')
        .map((s) => (
          <Marker
            key={`${s.agency}-${s.stop_id}-${picking}`}
            interactive={!picking}
            position={[s.lat, s.lon]}
            icon={stationIcon(fillFor(s), alerts.some((a) => a.stationIds.includes(s.stop_id)))}
            zIndexOffset={500}
          >
            <Popup maxHeight={STOP_POPUP_MAX_H}>
              <StopPopup stop={s} alerts={alertsFor(s)} palette={palette} />
            </Popup>
          </Marker>
        ))}

      {buses?.vehicles?.map((v) => (
        <Marker key={vehicleKey(v)} position={[v.lat, v.lon]} icon={vehicleIcon(v, buses.live, palette)} zIndexOffset={v.mode === 'train' ? 1100 : 1000}>
          <Popup>
            <div className="popup">
              {v.mode === 'train' ? (
                <>
                  <strong>CTA {v.route} Line train {v.routeName}</strong>
                  <div>
                    Run #{v.id}
                    {v.delayed && <b className="delayed"> · Delayed</b>}
                  </div>
                  {v.nextStop && <div>{v.approaching ? 'Arriving at' : 'Next stop:'} {v.nextStop}</div>}
                </>
              ) : (
                <>
                  <strong>{v.agency} {v.route} {v.routeName}</strong>
                  <div>Bus #{v.id}{v.delayed && <b className="delayed"> · Delayed</b>}</div>
                </>
              )}
              <div className="muted">
                {buses.live ? 'Live position' : 'Saved sample, not live'} as of {new Date(buses.fetchedAt).toLocaleTimeString()}
              </div>
              <Fare agency={v.agency} rail={v.mode === 'train'} compact />
              {onShowRoute && focusRoute !== vehicleRouteKey(v) && (
                <button type="button" className="popup-action" onClick={() => onShowRoute(vehicleRouteKey(v))}>
                  Show the {v.mode === 'train' ? `${v.route} Line` : `${v.route} route`} only
                </button>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
