import L from 'leaflet'
import { useMemo } from 'react'
import { ImageOverlay, Marker, Pane, Polyline, useMapEvents } from 'react-leaflet'
import { routeColor } from './data'
import { heatImage } from './heat'

const pinIcon = (which) =>
  L.divIcon({
    className: '',
    html: `<div class="travel-pin pin-${which}">${which === 'start' ? 'A' : 'B'}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
const ICONS = { start: pinIcon('start'), end: pinIcon('end') }

function Clicks({ placing, onPlace }) {
  useMapEvents({ click: (e) => placing && onPlace(placing, [e.latlng.lat, e.latlng.lng]) })
  return null
}

export default function TravelLayer({ cells, cellM, minutes, scale, start, end, placing, onPlace, result, palette }) {
  const heat = useMemo(() => (minutes ? heatImage(cells, cellM, minutes, scale) : null), [cells, cellM, minutes, scale])
  return (
    <>
      <Clicks placing={placing} onPlace={onPlace} />
      {/* Over the basemap (200), under route lines (400) so streets and lines stay readable */}
      <Pane name="heat" style={{ zIndex: 300 }}>
        {heat && <ImageOverlay key={heat.url} url={heat.url} bounds={heat.bounds} opacity={0.6} interactive={false} />}
      </Pane>
      {/* The trip: walks dashed, rides in the route's color, over everything but icons */}
      <Pane name="trip" style={{ zIndex: 470 }}>
        {result?.legs.map((l, i) =>
          l.kind === 'wait' ? null : (
            <Polyline
              key={i}
              positions={l.path}
              interactive={false}
              pathOptions={
                l.kind === 'walk'
                  ? { color: palette.boundary, weight: 3, dashArray: '2 7', lineCap: 'round' }
                  : { color: routeColor(l.route, palette), weight: 7, opacity: 0.95, lineCap: 'round' }
              }
            />
          ),
        )}
      </Pane>
      {['start', 'end'].map(
        (k) =>
          (k === 'start' ? start : end) && (
            <Marker
              key={k}
              position={k === 'start' ? start : end}
              icon={ICONS[k]}
              draggable
              zIndexOffset={2000}
              eventHandlers={{ dragend: (e) => onPlace(k, [e.target.getLatLng().lat, e.target.getLatLng().lng]) }}
            />
          ),
      )}
    </>
  )
}
