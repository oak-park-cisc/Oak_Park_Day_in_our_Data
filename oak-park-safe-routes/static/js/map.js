// Leaflet map coloring every street block in Oak Park by danger score: blocks
// with no incidents are green, the rest run through orange to red. Incidents at
// intersections (or on streets missing from the street data) are dots.

const OAK_PARK_BOUNDS = [[41.865, -87.806], [41.9093, -87.7742]];
const LINE_WIDTH = 4;
const DOT_RADIUS = 5;

// Danger score (points/yr) to color: green, through orange, to red. Hue, saturation
// and lightness are interpolated between stops on a log scale, since scores
// run from under 1 to over 200.
const DANGER_STOPS = [
  { score: 0, h: 120, s: 86, l: 34 },
  { score: 8, h: 30, s: 92, l: 52 },
  { score: 40, h: 0, s: 61, l: 52 },
];
const DANGER_TICKS = [0, 5, 15, 40];

// ---------------------------------------------------------------------------
// CARTO basemap API key (from https://clausa.app.carto.com/ > Developers >
// API keys). Left empty, the map falls back to CARTO's keyless tiles.
// ---------------------------------------------------------------------------
const MAP_API_KEY = "cb1_48ts_1_3bb1cf30bf0c9d89d66eaeed";

const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const CARTO_ATTRIBUTION = `${OSM_ATTRIBUTION} &copy; <a href="https://carto.com/attributions">CARTO</a>`;
const ESRI_ATTRIBUTION = "Imagery &copy; Esri, Maxar, Earthstar Geographics";

// Voyager is the default because it's CARTO's keyed, production tile service.
// OpenStreetMap's own tile servers ("Detailed streets") are donated and their
// usage policy discourages heavy app traffic, so they're offered but not default.
const LIGHT_BASEMAP = "Voyager";
const DARK_BASEMAP = "Dark";
const IS_TOUCH = window.matchMedia("(hover: none), (pointer: coarse)").matches;

function cartoLayer(style) {
  const url = MAP_API_KEY
    ? `https://basemaps.cartocdn.com/rastertiles/${style}/{z}/{x}/{y}.png?key=${MAP_API_KEY}`
    : `https://{s}.basemaps.cartocdn.com/rastertiles/${style}/{z}/{x}/{y}{r}.png`;
  return L.tileLayer(url, { attribution: CARTO_ATTRIBUTION, subdomains: "abcd", maxZoom: 19 });
}

// "Detailed streets" is the OpenStreetMap house style: buildings, trees,
// parks, shops and schools are all drawn in color once zoomed in.
function buildBasemaps() {
  return {
    [LIGHT_BASEMAP]: cartoLayer("voyager"),
    "Detailed streets": L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: OSM_ATTRIBUTION,
      maxZoom: 19,
    }),
    Satellite: L.layerGroup([
      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        attribution: ESRI_ATTRIBUTION,
        maxZoom: 19,
      }),
      cartoLayer("voyager_only_labels"),
    ]),
    [DARK_BASEMAP]: cartoLayer("dark_all"),
  };
}

function buildLandmarkOverlays() {
  const overlays = {};
  for (const category of LANDMARK_CATEGORIES) {
    const icon = L.divIcon({
      className: "landmark-marker",
      html: `<span style="--landmark-color: ${category.color}">${category.icon}</span>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
    const markers = category.places.map((place) =>
      L.marker([place.lat, place.lon], { icon, pane: "landmarks", alt: place.name }).bindTooltip(
        () => buildLandmarkTooltip(category, place),
        { direction: "top", offset: [0, -14], className: "dot-tooltip" },
      ),
    );
    overlays[`<span class="layer-icon">${category.icon}</span>${category.label}`] = L.layerGroup(markers);
  }
  return overlays;
}

const MapButtons = L.Control.extend({
  options: { position: "topleft" },

  onAdd(map) {
    const bar = L.DomUtil.create("div", "leaflet-bar map-buttons");
    this.addButton(bar, "⌂", "Reset view to all of Oak Park", () => map.fitBounds(OAK_PARK_BOUNDS));
    // iPhone Safari has no element full screen; leave the button out there.
    if (document.fullscreenEnabled) {
      this.addButton(bar, "⛶", "Toggle full screen", () => {
        if (document.fullscreenElement) document.exitFullscreen();
        else map.getContainer().requestFullscreen().catch(() => {});
      });
      document.addEventListener("fullscreenchange", () => map.invalidateSize());
    }
    L.DomEvent.disableClickPropagation(bar);
    return bar;
  },

  addButton(bar, text, title, onClick) {
    const button = L.DomUtil.create("a", "", bar);
    button.href = "#";
    button.role = "button";
    button.title = title;
    button.setAttribute("aria-label", title);
    button.textContent = text;
    L.DomEvent.on(button, "click", (e) => {
      L.DomEvent.preventDefault(e);
      onClick();
    });
  },
});

const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function dangerPosition(score) {
  const max = DANGER_STOPS[DANGER_STOPS.length - 1].score;
  return Math.log1p(Math.min(Math.max(score, 0), max)) / Math.log1p(max);
}

function dangerColor(score) {
  const t = dangerPosition(score);
  let i = 1;
  while (i < DANGER_STOPS.length - 1 && t > dangerPosition(DANGER_STOPS[i].score)) i++;
  const a = DANGER_STOPS[i - 1];
  const b = DANGER_STOPS[i];
  const ta = dangerPosition(a.score);
  const f = Math.min(Math.max((t - ta) / (dangerPosition(b.score) - ta), 0), 1);
  const mix = (key) => a[key] + (b[key] - a[key]) * f;
  return `hsl(${mix("h").toFixed(1)}, ${mix("s").toFixed(1)}%, ${mix("l").toFixed(1)}%)`;
}

function dangerGradientCss() {
  const steps = 12;
  const max = DANGER_STOPS[DANGER_STOPS.length - 1].score;
  const colors = [];
  for (let k = 0; k <= steps; k++) {
    const score = Math.expm1((k / steps) * Math.log1p(max));
    colors.push(`${dangerColor(score)} ${((k / steps) * 100).toFixed(1)}%`);
  }
  return `linear-gradient(to right, ${colors.join(", ")})`;
}

class CrimeMap {
  constructor(elementId, legendId) {
    this.legendEl = document.getElementById(legendId);
    // Canvas tolerance widens each line's hit area beyond its painted pixels;
    // fingers need more room than a mouse pointer.
    this.renderer = L.canvas({ tolerance: IS_TOUCH ? 14 : 8 });
    this.map = L.map(elementId, { renderer: this.renderer, scrollWheelZoom: true, maxZoom: 19 });
    this.map.fitBounds(OAK_PARK_BOUNDS);
    // Landmarks sit above the incident dots (overlay pane, 400) but below popups.
    this.map.createPane("landmarks").style.zIndex = 450;
    // Every outline sits below every colored line so an outline never cuts
    // across a neighboring block where streets meet.
    this.streetCasings = L.layerGroup().addTo(this.map);
    this.casings = L.layerGroup().addTo(this.map);
    this.streets = L.layerGroup().addTo(this.map);
    this.dots = L.layerGroup().addTo(this.map);
    this.lastData = null;
    this.loadStreets().catch((err) => console.error("Street layer failed to load", err));

    this.basemaps = buildBasemaps();
    this.base = null;
    this.userPickedBase = false;
    this.settingBase = false;
    this.map.on("baselayerchange", (e) => {
      this.base = e.layer;
      if (!this.settingBase) this.userPickedBase = true;
    });
    this.applyTheme();

    const landmarks = buildLandmarkOverlays();
    for (const layer of Object.values(landmarks)) layer.addTo(this.map);
    L.control
      .layers(this.basemaps, landmarks, { collapsed: IS_TOUCH || window.innerWidth < 900 })
      .addTo(this.map);
    L.control.scale({ metric: false }).addTo(this.map);
    new MapButtons().addTo(this.map);

    darkQuery.addEventListener("change", () => {
      this.applyTheme();
      if (this.lastData) this.render(this.lastData);
    });
  }

  // Follows the OS light/dark setting until the user picks a basemap themselves.
  applyTheme() {
    if (this.userPickedBase) return;
    const next = this.basemaps[darkQuery.matches ? DARK_BASEMAP : LIGHT_BASEMAP];
    if (next === this.base) return;
    this.settingBase = true;
    if (this.base) this.map.removeLayer(this.base);
    next.addTo(this.map);
    this.base = next;
    this.settingBase = false;
  }

  setLoading(loading) {
    this.map.getContainer().classList.toggle("is-loading", loading);
  }

  // Draws every street in the village green once; blocks with incidents are
  // drawn over their green line by render().
  async loadStreets() {
    const streets = await fetchStreets();
    const color = dangerColor(0);
    for (const feature of streets.features) {
      const latlngs = feature.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
      this.streetCasings.addLayer(L.polyline(latlngs, this.casingStyle()));
      const line = L.polyline(latlngs, { color, weight: LINE_WIDTH, opacity: 0.95 });
      line.bindTooltip(() => buildQuietStreetTooltip(feature.properties.name), TOOLTIP_OPTIONS);
      this.streets.addLayer(line);
    }
  }

  casingStyle() {
    return { color: cssVar("--surface-1"), weight: LINE_WIDTH + 3, opacity: 0.85, interactive: false };
  }

  render(geojson) {
    this.lastData = geojson;
    this.casings.clearLayers();
    this.dots.clearLayers();
    this.streetCasings.eachLayer((casing) => casing.setStyle(this.casingStyle()));

    const ring = cssVar("--surface-1");
    const levels = levelsByKey(geojson.danger_levels);

    // Most dangerous last, so red blocks sit on top where streets meet.
    const ordered = [...geojson.features].sort((a, b) => a.properties.danger_score - b.properties.danger_score);
    for (const feature of ordered) {
      const props = feature.properties;
      const color = dangerColor(props.danger_score);
      let mark;
      if (feature.geometry.type === "LineString") {
        const latlngs = feature.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
        this.casings.addLayer(L.polyline(latlngs, this.casingStyle()));
        mark = L.polyline(latlngs, { color, weight: LINE_WIDTH, opacity: 0.95 });
      } else {
        const [lon, lat] = feature.geometry.coordinates;
        mark = L.circleMarker([lat, lon], {
          radius: DOT_RADIUS,
          color: ring,
          weight: 2,
          fillColor: color,
          fillOpacity: 0.95,
        });
      }
      mark.bindTooltip(() => buildTooltip(props, levels), TOOLTIP_OPTIONS);
      this.dots.addLayer(mark);
    }

    this.renderLegend();
  }

  renderLegend() {
    this.legendEl.replaceChildren();

    const colorGroup = legendGroup("Danger (pts/yr)");
    const scale = document.createElement("div");
    scale.className = "legend-gradient";
    scale.setAttribute("role", "img");
    scale.setAttribute("aria-label", "Color scale from green (safer) through orange to red (more dangerous)");
    const bar = document.createElement("div");
    bar.className = "legend-gradient-bar";
    bar.style.background = dangerGradientCss();
    const ticks = document.createElement("div");
    ticks.className = "legend-gradient-ticks";
    DANGER_TICKS.forEach((value, index) => {
      const tick = document.createElement("span");
      tick.style.left = `${dangerPosition(value) * 100}%`;
      tick.textContent = index === DANGER_TICKS.length - 1 ? `${value}+` : String(value);
      ticks.appendChild(tick);
    });
    scale.append(bar, ticks);
    colorGroup.appendChild(scale);

    const note = document.createElement("span");
    note.className = "legend-note";
    note.textContent = `Green streets had no incidents for these filters; dots are incidents at intersections. ${
      IS_TOUCH ? "Tap" : "Hover over"
    } a street for details.`;

    this.legendEl.append(colorGroup, note);
  }
}

const TOOLTIP_OPTIONS = { direction: "top", sticky: true, offset: [0, -8], className: "dot-tooltip" };

function buildQuietStreetTooltip(name) {
  const root = document.createElement("div");
  const value = document.createElement("div");
  value.className = "tt-value";
  value.textContent = "No incidents";
  const label = document.createElement("div");
  label.className = "tt-label";
  label.textContent = `${name} · none match the current filters`;
  root.append(value, label);
  return root;
}

function legendGroup(titleText) {
  const group = document.createElement("div");
  group.className = "legend-group";
  const title = document.createElement("span");
  title.className = "legend-title";
  title.textContent = titleText;
  group.appendChild(title);
  return group;
}

function levelsByKey(levels) {
  return Object.fromEntries(levels.map((level) => [level.key, level]));
}

function buildTooltip(props, levels) {
  const root = document.createElement("div");

  const count = document.createElement("div");
  count.className = "tt-value";
  count.textContent = `${props.count.toLocaleString()} incident${props.count === 1 ? "" : "s"}`;

  const place = document.createElement("div");
  place.className = "tt-label";
  place.textContent = `${props.location} · ${props.zone}`;

  const danger = document.createElement("div");
  danger.className = "tt-danger";
  const swatch = document.createElement("span");
  swatch.className = "legend-swatch";
  swatch.style.background = dangerColor(props.danger_score);
  const dangerText = document.createElement("span");
  dangerText.textContent = `${levels[props.danger_level].label} danger · ${props.danger_score.toLocaleString()} pts/yr`;
  danger.append(swatch, dangerText);

  const list = document.createElement("ul");
  list.className = "tt-types";
  for (const [type, n] of props.top_types) {
    const li = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = type;
    const num = document.createElement("span");
    num.className = "tt-num";
    num.textContent = n.toLocaleString();
    li.append(name, num);
    list.appendChild(li);
  }

  const latest = document.createElement("div");
  latest.className = "tt-label";
  latest.textContent = `Most recent: ${formatDate(props.latest_date)}`;

  root.append(count, place, danger, list, latest);
  return root;
}

function buildLandmarkTooltip(category, place) {
  const root = document.createElement("div");

  const name = document.createElement("div");
  name.className = "tt-value";
  name.textContent = place.name;

  const kind = document.createElement("div");
  kind.className = "tt-label tt-category";
  kind.style.setProperty("--landmark-color", category.color);
  kind.textContent = category.label;

  root.append(name, kind);
  if (place.address) {
    const address = document.createElement("div");
    address.className = "tt-label";
    address.textContent = place.address;
    root.appendChild(address);
  }
  return root;
}

function formatDate(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
