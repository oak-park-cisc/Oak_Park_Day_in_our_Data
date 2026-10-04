// Wires the filter controls to the map, summary tiles and locations table.

const els = {
  dataSpan: document.getElementById("data-span"),
  loadError: document.getElementById("load-error"),
  filtersPanel: document.getElementById("filters-panel"),
  filtersSummary: document.getElementById("filters-summary"),
  years: document.getElementById("years-filter"),
  yearsValue: document.getElementById("years-value"),
  yearsSpan: document.getElementById("years-span"),
  routeWindow: document.getElementById("route-window"),
  period: document.getElementById("period-filter"),
  start: document.getElementById("start-date"),
  end: document.getElementById("end-date"),
  category: document.getElementById("category-filter"),
  type: document.getElementById("type-filter"),
  reset: document.getElementById("reset-filters"),
  total: document.getElementById("stat-total"),
  locations: document.getElementById("stat-locations"),
  topType: document.getElementById("stat-top-type"),
  topTypeCount: document.getElementById("stat-top-type-count"),
  busiest: document.getElementById("stat-busiest"),
  busiestCount: document.getElementById("stat-busiest-count"),
  tableBody: document.querySelector("#locations-table tbody"),
};

const DEFAULT_YEARS = 10;

const crimeMap = new CrimeMap("map", "map-legend");
const routePlanner = new RoutePlanner(crimeMap, () => ({ start: els.start.value, end: els.end.value }));
let options = null;
let requestId = 0;

// Filters stay tucked away on phones, where the route planner comes first.
if (window.matchMedia("(min-width: 900px)").matches) els.filtersPanel.open = true;

// The day after the date `years` years before the newest incident, so the
// window is exactly that many years long.
function yearsBackStart(years) {
  const [y, m, d] = options.max_date.split("-").map(Number);
  return new Date(Date.UTC(y - years, m - 1, d + 1)).toISOString().slice(0, 10);
}

function yearsLabel(years) {
  return `Last ${years} year${years === 1 ? "" : "s"}`;
}

function describeYears(years) {
  const start = yearsBackStart(years);
  els.yearsValue.textContent = yearsLabel(years);
  els.yearsSpan.textContent = start < options.min_date
    ? `All data: ${formatDate(options.min_date)} to ${formatDate(options.max_date)}`
    : `${formatDate(start)} to ${formatDate(options.max_date)}`;
}

function applyYears(years) {
  const start = yearsBackStart(years);
  els.years.value = years;
  els.years.classList.remove("is-custom");
  els.period.value = "";
  els.start.value = start < options.min_date ? options.min_date : start;
  els.end.value = options.max_date;
  describeYears(years);
}

// Another date control took over; the slider no longer describes the window.
function markYearsCustom(label = "Custom dates") {
  els.years.classList.add("is-custom");
  els.yearsValue.textContent = label;
  els.yearsSpan.textContent = "Move the slider to pick a time frame again";
}

function addOptions(select, values, labelFn = (v) => v) {
  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = labelFn(value);
    select.appendChild(option);
  }
}

function setupFilters() {
  els.dataSpan.textContent = `${formatDate(options.min_date)} to ${formatDate(options.max_date)}`;
  for (const input of [els.start, els.end]) {
    input.min = options.min_date;
    input.max = options.max_date;
  }

  const firstYear = Number(options.min_date.slice(0, 4));
  const lastYear = Number(options.max_date.slice(0, 4));
  const years = [];
  for (let y = lastYear; y >= firstYear; y--) years.push(String(y));
  addOptions(els.period, years);
  addOptions(els.category, options.crime_against);
  addOptions(els.type, options.types);

  // The label follows the thumb while dragging; the data reloads on release.
  els.years.addEventListener("input", () => describeYears(Number(els.years.value)));
  els.years.addEventListener("change", () => {
    applyYears(Number(els.years.value));
    refresh();
  });
  els.period.addEventListener("change", () => {
    const year = els.period.value;
    if (year) {
      // A year still in progress ends at the newest incident, so it isn't
      // treated as a full year of data.
      const yearEnd = `${year}-12-31`;
      els.start.value = `${year}-01-01` < options.min_date ? options.min_date : `${year}-01-01`;
      els.end.value = yearEnd > options.max_date ? options.max_date : yearEnd;
      markYearsCustom(`Year ${year}`);
    } else {
      applyYears(Number(els.years.value));
    }
    refresh();
  });
  for (const input of [els.start, els.end]) {
    input.addEventListener("change", () => {
      els.period.value = "";
      markYearsCustom();
      refresh();
    });
  }
  els.category.addEventListener("change", refresh);
  els.type.addEventListener("change", refresh);
  els.reset.addEventListener("click", () => {
    for (const el of [els.category, els.type]) el.value = "";
    applyYears(DEFAULT_YEARS);
    refresh();
  });

  applyYears(DEFAULT_YEARS);
}

function currentFilters() {
  return {
    type: els.type.value,
    crimeAgainst: els.category.value,
    start: els.start.value,
    end: els.end.value,
  };
}

function describeFilters(filters) {
  const when = els.years.classList.contains("is-custom") ? els.yearsValue.textContent : yearsLabel(Number(els.years.value));
  const what = filters.type || (filters.crimeAgainst ? `Crimes against ${filters.crimeAgainst.toLowerCase()}` : "All crimes");
  return `${when} · ${what}`;
}

function renderSummary(summary) {
  els.total.textContent = summary.total.toLocaleString();
  els.locations.textContent = summary.locations.toLocaleString();

  const [topType, topTypeCount] = summary.by_type[0] || ["–", 0];
  els.topType.textContent = topType;
  els.topTypeCount.textContent = topTypeCount ? `${topTypeCount.toLocaleString()} incidents` : "";

  const busiest = summary.busiest_location;
  els.busiest.textContent = busiest ? busiest.location : "–";
  els.busiestCount.textContent = busiest ? `${busiest.count.toLocaleString()} incidents` : "";
}

function renderTable(geojson) {
  els.tableBody.replaceChildren();
  const top = geojson.features.slice(0, 25);
  if (!top.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 6;
    cell.className = "empty";
    cell.textContent = "No incidents match the current filters.";
    row.appendChild(cell);
    els.tableBody.appendChild(row);
    return;
  }
  const levels = levelsByKey(geojson.danger_levels);
  for (const { properties: p } of top) {
    const row = document.createElement("tr");
    // Zone, type and date drop out on phones (.hide-sm) so the table fits.
    const cells = [
      [p.location, ""],
      [p.zone, "hide-sm"],
      [p.count.toLocaleString(), "num"],
      [`${levels[p.danger_level].label} (${p.danger_score.toLocaleString()})`, "danger-cell"],
      [p.top_types[0][0], "hide-sm"],
      [formatDate(p.latest_date), "hide-sm"],
    ];
    for (const [text, cls] of cells) {
      const td = document.createElement("td");
      td.textContent = text;
      if (cls) td.className = cls;
      row.appendChild(td);
    }
    const swatch = document.createElement("span");
    swatch.className = "legend-swatch";
    swatch.style.background = dangerColor(p.danger_score);
    row.children[3].prepend(swatch);
    els.tableBody.appendChild(row);
  }
}

function showLoadError(message) {
  els.loadError.textContent = message;
  els.loadError.hidden = !message;
}

async function refresh() {
  const id = ++requestId;
  const filters = currentFilters();
  els.filtersSummary.textContent = describeFilters(filters);
  els.routeWindow.textContent = filters.start || filters.end
    ? `from ${formatDate(filters.start || options.min_date)} to ${formatDate(filters.end || options.max_date)}`
    : "in all the data";
  routePlanner.timeFrameChanged();
  crimeMap.setLoading(true);
  try {
    const [points, summary] = await Promise.all([fetchMapPoints(filters), fetchSummary(filters)]);
    if (id !== requestId) return;
    crimeMap.render(points);
    renderSummary(summary);
    renderTable(points);
    showLoadError("");
  } catch (err) {
    console.error(err);
    if (id === requestId) showLoadError("Couldn't load the crime data. Check your connection and try again.");
  } finally {
    if (id === requestId) crimeMap.setLoading(false);
  }
}

fetchOptions()
  .then((opts) => {
    options = opts;
    setupFilters();
    return refresh();
  })
  .catch((err) => {
    console.error(err);
    els.dataSpan.textContent = "unavailable";
    showLoadError("Couldn't load the crime data. Check your connection and reload the page.");
  });

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((err) => console.warn("Service worker not registered", err));
  });
}
