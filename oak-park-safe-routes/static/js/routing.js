// Safe route planner: resolves the two inputs to points, asks the server for
// routes, and draws them on the crime map with draggable start/destination pins.

const ROUTE_COLOR = "#7e22ce";
const ROUTE_ALT_COLOR = "#b794f4";
const METERS_PER_MILE = 1609.34;
const FEET_PER_METER = 3.28084;

function pinIcon(kind) {
  const letter = kind === "start" ? "A" : "B";
  const fill = kind === "start" ? "#ffffff" : ROUTE_COLOR;
  const ink = kind === "start" ? ROUTE_COLOR : "#ffffff";
  return L.divIcon({
    className: "route-marker",
    html: `<svg width="32" height="42" viewBox="0 0 32 42" aria-hidden="true">
      <path d="M16 1.5C8 1.5 1.5 7.8 1.5 15.7 1.5 26.4 16 40.5 16 40.5s14.5-14.1 14.5-24.8C30.5 7.8 24 1.5 16 1.5z"
            fill="${fill}" stroke="${ROUTE_COLOR}" stroke-width="3"/>
      <text x="16" y="21" text-anchor="middle" font-size="14" font-weight="700" fill="${ink}"
            font-family="system-ui, sans-serif">${letter}</text>
    </svg>`,
    iconSize: [32, 42],
    iconAnchor: [16, 41],
    tooltipAnchor: [0, -38],
  });
}

function formatDistance(meters) {
  const miles = meters / METERS_PER_MILE;
  if (miles < 0.1) return `${Math.max(50, Math.round((meters * FEET_PER_METER) / 50) * 50)} ft`;
  return `${miles.toFixed(1)} mi`;
}

function formatMinutes(minutes) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hr ${minutes % 60} min`;
}

function landmarkPlaces() {
  return LANDMARK_CATEGORIES.flatMap((category) =>
    category.places.map((place) => ({ label: place.name, lat: place.lat, lon: place.lon })),
  );
}

class RoutePlanner {
  // getTimeFrame() returns the map's {start, end} dates; routes are judged on
  // the incidents in that window so they agree with the street colors.
  constructor(crimeMap, getTimeFrame) {
    this.map = crimeMap.map;
    this.getTimeFrame = getTimeFrame;
    this.routedTimeFrame = null;
    this.els = {
      form: document.getElementById("route-form"),
      from: document.getElementById("route-from"),
      to: document.getElementById("route-to"),
      swap: document.getElementById("route-swap"),
      clear: document.getElementById("route-clear"),
      places: document.getElementById("place-list"),
      status: document.getElementById("route-status"),
      results: document.getElementById("route-results"),
      locate: document.getElementById("route-locate"),
      pickButtons: document.querySelectorAll(".pick-button"),
    };
    this.picking = null;
    this.inputs = { start: this.els.from, end: this.els.to };
    this.points = { start: null, end: null };
    this.markers = { start: null, end: null };
    this.routes = [];
    this.selected = 0;
    this.requestId = 0;

    // Routes sit above the colored streets (400) and below landmarks (450).
    this.map.createPane("routes").style.zIndex = 420;
    this.renderer = L.svg({ pane: "routes" });
    this.routeLayer = L.layerGroup().addTo(this.map);

    this.places = landmarkPlaces();
    for (const place of this.places) {
      const option = document.createElement("option");
      option.value = place.label;
      this.els.places.appendChild(option);
    }

    this.els.form.addEventListener("submit", (e) => {
      e.preventDefault();
      // Put the phone keyboard away so the results are visible.
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      this.plan();
    });
    // "Next" on the phone keyboard moves from the start to the destination.
    this.els.from.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !this.els.to.value.trim()) {
        e.preventDefault();
        this.els.to.focus();
      }
    });
    this.els.swap.addEventListener("click", () => this.swap());
    this.els.clear.addEventListener("click", () => this.clear());
    this.els.locate.addEventListener("click", () => this.useMyLocation());
    for (const button of this.els.pickButtons) {
      button.addEventListener("click", () => this.startPicking(button.dataset.pick));
    }
    for (const kind of ["start", "end"]) {
      this.inputs[kind].addEventListener("input", () => {
        if (this.points[kind] && this.points[kind].label !== this.inputs[kind].value.trim()) {
          this.points[kind] = null;
        }
      });
    }
    // A plain tap shows a street's details, so pins only drop after a 📍
    // button arms the next tap, or on a long-press / right-click.
    this.map.on("click", (e) => {
      if (this.picking) this.placeFromMap(this.picking, e.latlng);
    });
    this.map.on("contextmenu", (e) => {
      this.placeFromMap(this.picking || (this.points.start ? "end" : "start"), e.latlng);
    });
  }

  startPicking(kind) {
    if (this.picking === kind) {
      this.stopPicking();
      this.setStatus("");
      return;
    }
    this.picking = kind;
    this.map.getContainer().classList.add("is-picking");
    for (const button of this.els.pickButtons) {
      button.setAttribute("aria-pressed", String(button.dataset.pick === kind));
    }
    this.setStatus(`Tap the map where you want the ${kind === "start" ? "starting point (A)" : "destination (B)"}.`);
    scrollIntoViewIfHidden(this.map.getContainer());
  }

  stopPicking() {
    this.picking = null;
    this.map.getContainer().classList.remove("is-picking");
    for (const button of this.els.pickButtons) button.setAttribute("aria-pressed", "false");
  }

  placeFromMap(kind, latlng) {
    this.stopPicking();
    this.dropPin(kind, latlng);
    if (this.points.start && this.points.end) {
      this.plan();
    } else {
      this.setStatus(kind === "start" ? "Start set. Now choose a destination." : "Destination set. Now choose a start.");
    }
  }

  useMyLocation() {
    if (!navigator.geolocation) {
      this.setStatus("This browser can't share your location. Type an address instead.", true);
      return;
    }
    this.setStatus("Finding your location…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        this.dropPin("start", L.latLng(latitude, longitude), "My location");
        if (this.points.end) this.plan();
        else this.setStatus("Start set to your location. Now choose a destination.");
      },
      (err) => {
        const message = err.code === err.PERMISSION_DENIED
          ? "Location access is off. Allow it in your browser settings, or type an address."
          : "Couldn't get your location. Type an address instead.";
        this.setStatus(message, true);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }

  // A pin from the map, a drag, or the phone's location. Dropped pins are
  // labeled right away, then relabeled with a street address once the lookup
  // returns; a pin given its own label ("My location") keeps it.
  dropPin(kind, latlng, label = null) {
    const point = { label: label || "Dropped pin", lat: latlng.lat, lon: latlng.lng };
    this.setPoint(kind, point);
    if (label) return;
    reverseGeocode(point.lat.toFixed(5), point.lon.toFixed(5))
      .then(({ label: address }) => {
        if (address && this.points[kind] === point) {
          point.label = address;
          this.inputs[kind].value = address;
        }
      })
      .catch(() => {});
  }

  setPoint(kind, point) {
    this.points[kind] = point;
    this.inputs[kind].value = point.label;
    const latlng = [point.lat, point.lon];
    if (this.markers[kind]) {
      this.markers[kind].setLatLng(latlng);
    } else {
      const marker = L.marker(latlng, {
        icon: pinIcon(kind),
        draggable: true,
        autoPan: true,
        zIndexOffset: 1000,
        title: kind === "start" ? "Start (drag to move)" : "Destination (drag to move)",
      }).addTo(this.map);
      marker.on("dragend", () => {
        this.dropPin(kind, marker.getLatLng());
        if (this.points.start && this.points.end) this.plan();
      });
      this.markers[kind] = marker;
    }
  }

  async resolve(kind) {
    const text = this.inputs[kind].value.trim();
    const current = this.points[kind];
    if (current && current.label === text) return current;
    if (!text) throw new Error(kind === "start" ? "Enter a starting point." : "Enter a destination.");

    const landmark = this.places.find((p) => p.label.toLowerCase() === text.toLowerCase());
    if (landmark) return { ...landmark };

    const { results } = await geocodePlace(text);
    if (!results.length) throw new Error(`Couldn't find "${text}" in Oak Park. Try a street address.`);
    return results[0];
  }

  async plan() {
    const id = ++this.requestId;
    this.setStatus("Finding safe routes…");
    try {
      const [start, end] = await Promise.all([this.resolve("start"), this.resolve("end")]);
      if (id !== this.requestId) return;
      this.setPoint("start", start);
      this.setPoint("end", end);
      const timeFrame = this.getTimeFrame();
      const { routes } = await fetchRoutes(start, end, timeFrame);
      if (id !== this.requestId) return;
      this.routedTimeFrame = `${timeFrame.start}|${timeFrame.end}`;
      this.routes = routes;
      this.selected = 0;
      this.setStatus(routes.length > 1 ? "" : "Only one sensible route connects these places.");
      this.draw(true);
      this.renderResults();
      scrollIntoViewIfHidden(this.map.getContainer());
    } catch (err) {
      if (id !== this.requestId) return;
      this.routes = [];
      this.draw(false);
      this.renderResults();
      this.setStatus(err.message, true);
    }
  }

  // Re-plan routes on screen when the map's time frame moves, so they keep
  // matching the street colors. Other filters (crime type) don't affect routes.
  timeFrameChanged() {
    const { start, end } = this.getTimeFrame();
    if (this.routes.length && this.routedTimeFrame !== `${start}|${end}`) this.plan();
  }

  swap() {
    [this.points.start, this.points.end] = [this.points.end, this.points.start];
    [this.els.from.value, this.els.to.value] = [this.els.to.value, this.els.from.value];
    for (const kind of ["start", "end"]) {
      if (this.points[kind]) {
        this.setPoint(kind, this.points[kind]);
      } else if (this.markers[kind]) {
        this.markers[kind].remove();
        this.markers[kind] = null;
      }
    }
    if (this.els.from.value && this.els.to.value) this.plan();
  }

  clear() {
    this.requestId++;
    this.stopPicking();
    for (const kind of ["start", "end"]) {
      this.points[kind] = null;
      this.inputs[kind].value = "";
      if (this.markers[kind]) this.markers[kind].remove();
      this.markers[kind] = null;
    }
    this.routes = [];
    this.draw(false);
    this.renderResults();
    this.setStatus("");
  }

  select(index) {
    this.selected = index;
    this.draw(false);
    this.renderResults();
  }

  draw(fit) {
    this.routeLayer.clearLayers();
    // The selected route is drawn last so it sits on top where they overlap.
    const order = this.routes.map((_, i) => i).filter((i) => i !== this.selected);
    if (this.routes.length) order.push(this.selected);
    for (const index of order) {
      const route = this.routes[index];
      const selected = index === this.selected;
      const style = { renderer: this.renderer, lineCap: "round", lineJoin: "round" };
      this.routeLayer.addLayer(
        L.polyline(route.geometry, { ...style, color: "#ffffff", weight: selected ? 11 : 9, opacity: 0.9, interactive: false }),
      );
      const line = L.polyline(route.geometry, {
        ...style,
        color: selected ? ROUTE_COLOR : ROUTE_ALT_COLOR,
        weight: selected ? 7 : 5,
        opacity: selected ? 1 : 0.95,
      });
      line.bindTooltip(
        () => document.createTextNode(`${route.label} · ${formatMinutes(route.walk_minutes)} walk`),
        { sticky: true, className: "dot-tooltip" },
      );
      line.on("click", (e) => {
        L.DomEvent.stop(e);
        if (this.picking) this.placeFromMap(this.picking, e.latlng);
        else this.select(index);
      });
      this.routeLayer.addLayer(line);
    }
    if (fit && this.routes.length) {
      const bounds = L.latLngBounds(this.routes.flatMap((r) => r.geometry));
      this.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });
    }
  }

  renderResults() {
    const root = this.els.results;
    root.replaceChildren();
    this.routes.forEach((route, index) => root.appendChild(this.routeCard(route, index)));
    if (this.routes.length) root.appendChild(this.directions(this.routes[this.selected]));
  }

  routeCard(route, index) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "route-option";
    card.setAttribute("aria-pressed", String(index === this.selected));
    card.addEventListener("click", () => this.select(index));

    const head = document.createElement("div");
    head.className = "route-option-head";
    const swatch = document.createElement("span");
    swatch.className = "route-swatch";
    swatch.style.background = index === this.selected ? ROUTE_COLOR : ROUTE_ALT_COLOR;
    const name = document.createElement("span");
    name.className = "route-name";
    name.textContent = route.label;
    head.append(swatch, name);
    if (index === 0) {
      const badge = document.createElement("span");
      badge.className = "route-recommended";
      badge.textContent = "Recommended";
      head.appendChild(badge);
    }

    const eta = document.createElement("div");
    eta.className = "route-eta";
    eta.textContent = formatMinutes(route.walk_minutes);
    const etaUnit = document.createElement("span");
    etaUnit.textContent = " walking";
    eta.appendChild(etaUnit);

    const meta = document.createElement("div");
    meta.className = "route-meta";
    const extra = route.extra_vs_direct_m >= 50 ? ` · ${formatDistance(route.extra_vs_direct_m)} longer than most direct` : " · as short as the most direct way";
    meta.textContent = `${formatDistance(route.distance_m)} · ${formatMinutes(route.bike_minutes)} by bike${extra}`;

    const safety = document.createElement("ul");
    safety.className = "route-safety";
    safety.append(
      safetyItem(
        route.high_danger_blocks === 0,
        route.high_danger_blocks === 0
          ? "No high-crime blocks"
          : `Passes ${route.high_danger_blocks} high-crime block${route.high_danger_blocks === 1 ? "" : "s"}`,
      ),
      safetyItem(
        route.busy_street_m < 50,
        route.busy_street_m < 50 ? "Stays off busy streets" : `${formatDistance(route.busy_street_m)} along busy streets`,
      ),
    );

    card.append(head, eta, meta, safety);
    return card;
  }

  directions(route) {
    const wrap = document.createElement("div");
    wrap.className = "route-directions";
    const title = document.createElement("h3");
    title.textContent = `Directions · ${route.label}`;
    const list = document.createElement("ol");
    for (const step of route.steps) {
      const li = document.createElement("li");
      const text = document.createElement("span");
      text.className = "step-text";
      text.textContent = step.text;
      li.appendChild(text);
      if (step.distance_m) {
        const distance = document.createElement("span");
        distance.className = "step-distance";
        distance.textContent = formatDistance(step.distance_m);
        li.appendChild(distance);
      }
      const tags = [];
      if (step.busy_street) tags.push("Busy street: use crosswalks");
      if (step.high_crime) tags.push("High-crime block");
      for (const tagText of tags) {
        const tag = document.createElement("span");
        tag.className = "step-tag";
        tag.textContent = `⚠ ${tagText}`;
        li.appendChild(tag);
      }
      list.appendChild(li);
    }
    wrap.append(title, list);
    return wrap;
  }

  setStatus(message, isError = false) {
    this.els.status.textContent = message;
    this.els.status.classList.toggle("is-error", isError);
  }
}

// On a phone the map can be scrolled out of view while the form is in use.
function scrollIntoViewIfHidden(element) {
  const rect = element.getBoundingClientRect();
  if (rect.top < 0 || rect.top > window.innerHeight * 0.5) {
    element.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function safetyItem(good, text) {
  const li = document.createElement("li");
  li.className = good ? "is-good" : "is-warning";
  const icon = document.createElement("span");
  icon.className = "safety-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = good ? "✓" : "⚠";
  const label = document.createElement("span");
  label.textContent = text;
  li.append(icon, label);
  return li;
}
