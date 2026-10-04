// Browser port of the Oak Park Safe Routes server: server/analysis.py,
// server/routing.py, server/geocode.py and the request handling in
// server/app.py. Functions mirror the Python ones line for line, including
// Python's float semantics (compensated sum(), round() half-to-even on the exact
// binary value, math.hypot, float %, min/max tie handling) so every response
// matches the Flask app's JSON. tests/compare.mjs checks that against the
// original Python.
//
// Works as a classic browser script (defines globalThis.SafeRoutesCore) and in
// Node (module.exports).

(function (root, factory) {
  const core = factory();
  if (typeof module === "object" && module && module.exports) module.exports = core;
  root.SafeRoutesCore = core;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  "use strict";

  // ---------------------------------------------------------------------------
  // Python semantics
  // ---------------------------------------------------------------------------

  /** Python str ordering (by code point), as used by sorted() and < on str. */
  function pyStrCmp(a, b) {
    if (a === b) return 0;
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) {
      let ca = a.charCodeAt(i);
      let cb = b.charCodeAt(i);
      if (ca !== cb) {
        // Surrogates (astral code points) sort after U+E000..U+FFFF.
        if (ca >= 0xd800) ca = ca >= 0xe000 ? ca - 0x800 : ca + 0x2000;
        if (cb >= 0xd800) cb = cb >= 0xe000 ? cb - 0x800 : cb + 0x2000;
        return ca < cb ? -1 : 1;
      }
    }
    return a.length < b.length ? -1 : a.length > b.length ? 1 : 0;
  }

  function sortedStrings(values) {
    return [...values].sort(pyStrCmp);
  }

  /**
   * Python's built-in sum() over floats: CPython 3.12+ uses Neumaier
   * compensated summation. An empty sum is the int 0.
   */
  function pySum(values) {
    let count = 0;
    let hi = 0;
    let lo = 0;
    for (const x of values) {
      if (count === 0) {
        hi = 0 + x;
      } else {
        const t = hi + x;
        if (Math.abs(hi) >= Math.abs(x)) lo += hi - t + x;
        else lo += x - t + hi;
        hi = t;
      }
      count++;
    }
    if (count === 0) return 0;
    if (lo && Number.isFinite(lo)) return hi + lo;
    return hi;
  }

  /** Python min(a, b): the first argument unless the second is strictly smaller. */
  function pyMin(a, b) {
    return b < a ? b : a;
  }

  /** Python max(a, b): the first argument unless the second is strictly larger. */
  function pyMax(a, b) {
    return b > a ? b : a;
  }

  /** Python float % (result takes the divisor's sign). */
  function pyMod(a, b) {
    let mod = a % b;
    if (mod) {
      if (b < 0 !== mod < 0) mod += b;
    } else {
      mod = b < 0 ? -0 : 0;
    }
    return mod;
  }

  const bits = new DataView(new ArrayBuffer(8));

  /** Exact (mantissa, exponent) of a finite positive double: x = m * 2**e. */
  function decompose(x) {
    bits.setFloat64(0, x);
    const hi = bits.getUint32(0);
    const lo = bits.getUint32(4);
    let exp = (hi >>> 20) & 0x7ff;
    let mant = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo);
    if (exp === 0) exp = 1;
    else mant |= 1n << 52n;
    return [mant, exp - 1075];
  }

  /**
   * Python round(x) with no ndigits: round half to even, returning an int.
   */
  function pyRound(x) {
    const f = Math.floor(x);
    const diff = x - f;
    let r;
    if (diff > 0.5) r = f + 1;
    else if (diff < 0.5) r = f;
    else r = f % 2 === 0 ? f : f + 1;
    return r === 0 ? 0 : r;
  }

  /**
   * Python round(x, ndigits) for a float and ndigits >= 0: the exact binary
   * value rounded half-to-even to ndigits decimals, then read back as the
   * nearest double (CPython's dtoa-based double_round).
   */
  function pyRoundDigits(x, ndigits) {
    if (!Number.isFinite(x) || x === 0) return x;
    const negative = x < 0;
    const [mant, e] = decompose(Math.abs(x));
    const num = mant * 10n ** BigInt(ndigits);
    let q;
    if (e >= 0) {
      q = num << BigInt(e);
    } else {
      const den = 1n << BigInt(-e);
      q = num / den;
      const twice = 2n * (num - q * den);
      if (twice > den || (twice === den && (q & 1n) === 1n)) q += 1n;
    }
    // Correctly rounded decimal-to-double, like CPython's _Py_dg_strtod.
    return Number(`${negative ? "-" : ""}${q}e-${ndigits}`);
  }

  function pow2(k) {
    // Exact 2**k for the normal exponent range.
    bits.setUint32(0, ((k + 1023) & 0x7ff) << 20);
    bits.setUint32(4, 0);
    return bits.getFloat64(0);
  }

  function frexpExponent(x) {
    bits.setFloat64(0, x);
    const exp = (bits.getUint32(0) >>> 20) & 0x7ff;
    if (exp === 0) return frexpExponent(x * 2 ** 64) - 64;
    return exp - 1022;
  }

  // Error-free product: [x*y rounded, exact error], as fma(x, y, -x*y) gives.
  function dlMul(x, y) {
    const z = x * y;
    const tx = 134217729 * x;
    const xh = tx - (tx - x);
    const xl = x - xh;
    const ty = 134217729 * y;
    const yh = ty - (ty - y);
    const yl = y - yh;
    const zz = xl * yl - (((z - xh * yh) - xl * yh) - xh * yl);
    return [z, zz];
  }

  const DBL_MIN = 2.2250738585072014e-308;

  // CPython's vector_norm() (Modules/mathmodule.c), used by math.hypot.
  function vectorNorm(vec, max, foundNan) {
    if (max === Infinity) return max;
    if (foundNan) return NaN;
    if (max === 0 || vec.length <= 1) return max;
    const maxE = frexpExponent(max);
    if (maxE < -1023) {
      return DBL_MIN * vectorNorm(vec.map((v) => v / DBL_MIN), max / DBL_MIN, foundNan);
    }
    const scale = pow2(-maxE);
    let csum = 1.0;
    let frac1 = 0.0;
    let frac2 = 0.0;
    for (let x of vec) {
      x *= scale;
      const [prHi, prLo] = dlMul(x, x);
      const smHi = csum + prHi;
      const smLo = csum - smHi + prHi;
      csum = smHi;
      frac1 += prLo;
      frac2 += smLo;
    }
    let h = Math.sqrt(csum - 1.0 + (frac1 + frac2));
    const [prHi, prLo] = dlMul(-h, h);
    const smHi = csum + prHi;
    const smLo = csum - smHi + prHi;
    csum = smHi;
    frac1 += prLo;
    frac2 += smLo;
    const x = csum - 1.0 + (frac1 + frac2);
    h += x / (2.0 * h);
    return h / scale;
  }

  /** Python math.hypot(a, b). */
  function hypot(a, b) {
    const x = Math.abs(a);
    const y = Math.abs(b);
    let max = 0.0;
    let foundNan = false;
    for (const v of [x, y]) {
      foundNan = foundNan || Number.isNaN(v);
      if (v > max) max = v;
    }
    return vectorNorm([x, y], max, foundNan);
  }

  const DEG_TO_RAD = Math.PI / 180.0;
  const RAD_TO_DEG = 180.0 / Math.PI;
  const radians = (x) => x * DEG_TO_RAD;
  const degrees = (x) => x * RAD_TO_DEG;

  // Python's str.isspace() characters, for str.strip().
  const PY_WHITESPACE = "\\t\\n\\x0b\\x0c\\r\\x1c-\\x1f \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000";
  const PY_STRIP = new RegExp(`^[${PY_WHITESPACE}]+|[${PY_WHITESPACE}]+$`, "g");

  function pyStrip(s) {
    return s.replace(PY_STRIP, "");
  }

  const FLOAT_RE = /^[+-]?(?:\d(?:_?\d)*(?:\.(?:\d(?:_?\d)*)?)?|\.\d(?:_?\d)*)(?:[eE][+-]?\d(?:_?\d)*)?$/;
  const SPECIAL_FLOAT_RE = /^([+-]?)(inf|infinity|nan)$/i;

  /** Python float(str); throws on a value Python would reject. */
  function pyFloat(value) {
    const s = pyStrip(String(value));
    if (FLOAT_RE.test(s)) return Number(s.replace(/_/g, ""));
    const special = SPECIAL_FLOAT_RE.exec(s);
    if (special) {
      if (special[2].toLowerCase() === "nan") return NaN;
      return special[1] === "-" ? -Infinity : Infinity;
    }
    throw new ValueError(`could not convert string to float: '${value}'`);
  }

  /** Python int(str) in base 10; throws on a value Python would reject. */
  function pyInt(value) {
    const s = pyStrip(String(value));
    if (!/^[+-]?\d(?:_?\d)*$/.test(s)) throw new ValueError(`invalid literal for int() with base 10: '${value}'`);
    return Number(s.replace(/_/g, ""));
  }

  /** Python repr() of a float, as str.format and f-strings print it. */
  function pyFloatRepr(x) {
    if (Number.isNaN(x)) return "nan";
    if (!Number.isFinite(x)) return x > 0 ? "inf" : "-inf";
    if (x === 0) return Object.is(x, -0) ? "-0.0" : "0.0";
    const [mantissa, expPart] = x.toExponential().split("e");
    const exp = Number(expPart);
    const negative = mantissa.startsWith("-");
    const digits = mantissa.replace("-", "").replace(".", "");
    const sign = negative ? "-" : "";
    if (exp >= -5 && exp < 16) {
      if (exp < 0) return `${sign}0.${"0".repeat(-exp - 1)}${digits}`;
      if (digits.length > exp + 1) return `${sign}${digits.slice(0, exp + 1)}.${digits.slice(exp + 1)}`;
      return `${sign}${digits}${"0".repeat(exp + 1 - digits.length)}.0`;
    }
    const frac = digits.length > 1 ? `.${digits.slice(1)}` : "";
    const expSign = exp < 0 ? "-" : "+";
    return `${sign}${digits[0]}${frac}e${expSign}${String(Math.abs(exp)).padStart(2, "0")}`;
  }

  /** urllib.parse.quote_plus(str). */
  function quotePlus(s) {
    return encodeURIComponent(s)
      .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
      .replace(/%20/g, "+");
  }

  /** urllib.parse.urlencode(dict) for str, int and float values. */
  function urlencode(params) {
    return Object.entries(params)
      .map(([k, v]) => `${quotePlus(k)}=${quotePlus(typeof v === "number" && !Number.isInteger(v) ? pyFloatRepr(v) : String(v))}`)
      .join("&");
  }

  class ValueError extends Error {}

  /** Python truthiness of a parsed JSON value. */
  function pyTruthy(value) {
    if (value === null || value === undefined || value === false || value === 0 || value === "") return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "object") return Object.keys(value).length > 0;
    return true;
  }

  // A collections.Counter: insertion-ordered, most_common() stable by count.
  class Counter extends Map {
    constructor(values) {
      super();
      if (values) for (const v of values) this.set(v, (this.get(v) || 0) + 1);
    }

    mostCommon(n) {
      const items = [...this.entries()].sort((a, b) => b[1] - a[1]);
      return n === undefined ? items : items.slice(0, n);
    }
  }

  // --- Dates (datetime.date) --------------------------------------------------

  const DAYS_IN_MONTH = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const isLeap = (y) => y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const daysInMonth = (y, m) => (m === 2 && isLeap(y) ? 29 : DAYS_IN_MONTH[m]);

  function toOrdinal(y, m, d) {
    const py = y - 1;
    let days = py * 365 + Math.floor(py / 4) - Math.floor(py / 100) + Math.floor(py / 400);
    for (let k = 1; k < m; k++) days += daysInMonth(y, k);
    return days + d;
  }

  function fromOrdinal(n) {
    // Proleptic Gregorian, as datetime.date.fromordinal.
    let y = Math.floor((n - 1) / 365.2425) + 1;
    while (toOrdinal(y, 1, 1) > n) y--;
    while (toOrdinal(y + 1, 1, 1) <= n) y++;
    let rest = n - toOrdinal(y, 1, 1) + 1;
    let m = 1;
    while (rest > daysInMonth(y, m)) {
      rest -= daysInMonth(y, m);
      m++;
    }
    return [y, m, rest];
  }

  const pad = (n, w) => String(n).padStart(w, "0");
  const isoFormat = ([y, m, d]) => `${pad(y, 4)}-${pad(m, 2)}-${pad(d, 2)}`;

  function isoWeekToYmd(isoYear, week, day) {
    if (isoYear < 1 || isoYear > 9999) return null;
    if (week <= 0 || week >= 53) {
      let outOfRange = true;
      if (week === 53) {
        const firstWeekday = (toOrdinal(isoYear, 1, 1) + 6) % 7;
        if (firstWeekday === 3 || (firstWeekday === 2 && isLeap(isoYear))) outOfRange = false;
      }
      if (outOfRange) return null;
    }
    if (day <= 0 || day >= 8) return null;
    const first = toOrdinal(isoYear, 1, 1);
    const firstWeekday = (first + 6) % 7;
    let week1Monday = first - firstWeekday;
    if (firstWeekday > 3) week1Monday += 7;
    return fromOrdinal(week1Monday + (week - 1) * 7 + day - 1);
  }

  /**
   * datetime.date.fromisoformat() as in CPython 3.11+: YYYY-MM-DD, YYYYMMDD and
   * the ISO week forms. Returns [y, m, d] or null where Python raises.
   */
  function parseIsoDate(value) {
    if (/[\ud800-\udfff]/.test(value) && !/^(?:[^\ud800-\udfff]|[\ud800-\udbff][\udc00-\udfff])*$/.test(value)) {
      return null; // lone surrogate: not encodable as UTF-8
    }
    const bytes = new TextEncoder().encode(value);
    const len = bytes.length;
    if (len !== 7 && len !== 8 && len !== 10) return null;
    let p = 0;
    const at = (i) => (i < len ? bytes[i] : 0);
    const digits = (count) => {
      let out = 0;
      for (let k = 0; k < count; k++) {
        const c = at(p);
        if (c < 48 || c > 57) return null;
        out = out * 10 + (c - 48);
        p++;
      }
      return out;
    };
    const year = digits(4);
    if (year === null) return null;
    const usesSeparator = at(p) === 45;
    if (usesSeparator) p++;
    let ymd;
    if (at(p) === 87) {
      p++;
      const week = digits(2);
      if (week === null) return null;
      let day = 1;
      if (p < len) {
        if (usesSeparator && at(p++) !== 45) return null;
        day = digits(1);
        if (day === null) return null;
      }
      ymd = isoWeekToYmd(year, week, day);
      if (!ymd) return null;
    } else {
      const month = digits(2);
      if (month === null) return null;
      if (usesSeparator && at(p++) !== 45) return null;
      const day = digits(2);
      if (day === null) return null;
      ymd = [year, month, day];
    }
    const [y, m, d] = ymd;
    if (y < 1 || y > 9999 || m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
    return ymd;
  }

  // ---------------------------------------------------------------------------
  // analysis.py
  // ---------------------------------------------------------------------------

  const MAX_SNAP_METERS = 60;
  const OAK_PARK_LIMITS = [41.86532, -87.80498, 41.90912, -87.77494];
  const LIMITS_TOLERANCE = 0.0003;

  const SEVERITY_WEIGHTS = {
    "Homicide Offenses": 25,
    "Kidnapping/Abduction": 20,
    "Sex Offenses": 20,
    Robbery: 12,
    "Weapon Law Violations": 10,
    Arson: 10,
    "Drug/Narcotic Offenses": 8,
    "Assault Offenses": 6,
    "Driving Under the Influence": 5,
    "Burglary/Breaking & Entering": 4,
    "Motor Vehicle Theft": 3,
    "Extortion/Blackmail": 3,
    "Prostitution Offenses": 3,
    "Pornography/Obscene Material": 3,
    "Destruction/Damage/Vandalism of Property": 2,
    "Stolen Property Offenses": 2,
    "Animal Cruelty": 2,
    "Larceny/Theft Offenses": 1,
    "Fraud Offenses": 1,
    "Counterfeiting/Forgery": 1,
  };
  const DEFAULT_SEVERITY = 1;

  const DANGER_LEVELS = [
    { key: "low", label: "Low", min_score: 0 },
    { key: "moderate", label: "Moderate", min_score: 5 },
    { key: "high", label: "High", min_score: 15 },
  ];

  /** Incident.to_dict() */
  function incidentToDict(i) {
    return {
      incident_id: i.incident_id,
      label: i.label,
      date: i.date,
      time: i.time,
      location: i.location,
      zone: i.zone,
      latitude: i.latitude,
      longitude: i.longitude,
      types: sortedStrings(i.types),
      offenses: [...i.offenses],
      crime_against: sortedStrings(i.crime_against),
    };
  }

  /** csv.DictReader with the default excel dialect. */
  function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = "";
    let i = 0;
    let quoted = false;
    let fieldStarted = false;
    const n = text.length;
    const endField = () => {
      row.push(field);
      field = "";
      fieldStarted = false;
    };
    const endRow = () => {
      endField();
      rows.push(row);
      row = [];
    };
    while (i < n) {
      const c = text[i];
      if (quoted) {
        if (c === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i += 2;
            continue;
          }
          quoted = false;
          i++;
          continue;
        }
        field += c;
        i++;
        continue;
      }
      if (c === '"' && !fieldStarted && field === "") {
        quoted = true;
        fieldStarted = true;
        i++;
      } else if (c === ",") {
        endField();
        i++;
      } else if (c === "\r" || c === "\n") {
        endRow();
        i += c === "\r" && text[i + 1] === "\n" ? 2 : 1;
      } else {
        field += c;
        fieldStarted = true;
        i++;
      }
    }
    if (field !== "" || fieldStarted || row.length) endRow();
    const [header, ...body] = rows;
    return body
      .filter((r) => r.length > 1 || r[0] !== "")
      .map((r) => Object.fromEntries(header.map((h, k) => [h, k < r.length ? r[k] : null])));
  }

  function compareIncidents(a, b) {
    return pyStrCmp(a.date, b.date) || pyStrCmp(a.time, b.time);
  }

  /** load_incidents(): collapse the CSV's charge rows into incidents, oldest first. */
  function loadIncidentsFromCsv(text) {
    const incidents = new Map();
    for (const row of parseCsv(text)) {
      let inc = incidents.get(row.incident_id);
      if (inc === undefined) {
        let lat;
        let lon;
        try {
          lat = pyFloat(row.latitude);
          lon = pyFloat(row.longitude);
        } catch (err) {
          if (err instanceof ValueError) continue;
          throw err;
        }
        inc = {
          incident_id: row.incident_id,
          label: row.incident_id_label,
          date: row.date,
          time: row.time,
          location: row.location,
          zone: row.zone_label,
          latitude: lat,
          longitude: lon,
          types: new Set(),
          offenses: [],
          crime_against: new Set(),
        };
        incidents.set(row.incident_id, inc);
      }
      inc.types.add(row.incident_type);
      inc.crime_against.add(row.crime_against);
      if (!inc.offenses.includes(row.offense_description)) inc.offenses.push(row.offense_description);
    }
    return [...incidents.values()].sort(compareIncidents);
  }

  // Compact form of the collapsed incidents (data/incidents.json), built by
  // tools/build-data.mjs from the CSV so the browser downloads far less.
  function packIncidents(incidents) {
    const strings = [];
    const index = new Map();
    const intern = (s) => {
      if (!index.has(s)) {
        index.set(s, strings.length);
        strings.push(s);
      }
      return index.get(s);
    };
    const rows = incidents.map((i) => [
      i.incident_id,
      i.label,
      i.date,
      i.time,
      intern(i.location),
      intern(i.zone),
      i.latitude,
      i.longitude,
      [...i.types].map(intern),
      i.offenses.map(intern),
      [...i.crime_against].map(intern),
    ]);
    return {
      format: "oak-park-safe-routes/incidents@1",
      fields: ["incident_id", "label", "date", "time", "location", "zone", "latitude", "longitude", "types", "offenses", "crime_against"],
      strings,
      incidents: rows,
    };
  }

  function unpackIncidents(packed) {
    if (packed.format !== "oak-park-safe-routes/incidents@1") throw new Error("Unknown incident data format.");
    const s = packed.strings;
    return packed.incidents.map(([id, label, date, time, location, zone, lat, lon, types, offenses, against]) => ({
      incident_id: id,
      label,
      date,
      time,
      location: s[location],
      zone: s[zone],
      latitude: lat,
      longitude: lon,
      types: new Set(types.map((k) => s[k])),
      offenses: offenses.map((k) => s[k]),
      crime_against: new Set(against.map((k) => s[k])),
    }));
  }

  function filterIncidents(incidents, { incidentType = null, crimeAgainst = null, start = null, end = null } = {}) {
    return incidents.filter(
      (i) =>
        (!incidentType || i.types.has(incidentType)) &&
        (!crimeAgainst || i.crime_against.has(crimeAgainst)) &&
        (!start || pyStrCmp(i.date, start) >= 0) &&
        (!end || pyStrCmp(i.date, end) <= 0),
    );
  }

  function filterOptions(incidents) {
    const types = new Set();
    const against = new Set();
    for (const i of incidents) {
      for (const t of i.types) types.add(t);
      for (const c of i.crime_against) against.add(c);
    }
    return {
      types: sortedStrings(types),
      crime_against: sortedStrings(against),
      min_date: incidents.length ? incidents[0].date : null,
      max_date: incidents.length ? incidents[incidents.length - 1].date : null,
    };
  }

  function incidentSeverity(incident) {
    let best = null;
    for (const t of incident.types) {
      const w = Object.hasOwn(SEVERITY_WEIGHTS, t) ? SEVERITY_WEIGHTS[t] : DEFAULT_SEVERITY;
      if (best === null || w > best) best = w;
    }
    return best === null ? DEFAULT_SEVERITY : best;
  }

  function dangerLevel(score) {
    return DANGER_LEVELS.filter((lvl) => score >= lvl.min_score).at(-1).key;
  }

  /** window_years(): length in years of the date window. */
  function windowYears(allIncidents, start = null, end = null) {
    if (!allIncidents.length) return 1.0;
    let first = start ? parseIsoDate(start) : null;
    let last = end ? parseIsoDate(end) : null;
    if ((start && !first) || (end && !last)) first = last = null;
    first = first || parseIsoDate(allIncidents[0].date);
    last = last || parseIsoDate(allIncidents[allIncidents.length - 1].date);
    const days = toOrdinal(...last) - toOrdinal(...first);
    return Math.max(days + 1, 1) / 365.25;
  }

  const DIRECTIONS = new Set(["n", "s", "e", "w", "north", "south", "east", "west"]);
  const STREET_TYPES = {
    ave: "avenue",
    st: "street",
    blvd: "boulevard",
    rd: "road",
    ct: "court",
    pl: "place",
    dr: "drive",
    pkwy: "parkway",
    ln: "lane",
    ter: "terrace",
    trl: "trail",
    sq: "square",
    cir: "circle",
  };

  const streetKeyCache = new Map();

  /** street_key(): "N Oak Park Ave" and "North Oak Park Avenue" both become "oakparkavenue". */
  function streetKey(name) {
    let key = streetKeyCache.get(name);
    if (key !== undefined) return key;
    let words = name
      .toLowerCase()
      .replace(/[^a-z0-9 ]/gu, " ")
      .split(" ")
      .filter(Boolean)
      .map((w) => (Object.hasOwn(STREET_TYPES, w) ? STREET_TYPES[w] : w));
    if (words.length > 2 && DIRECTIONS.has(words[0])) words = words.slice(1);
    key = words.join("");
    streetKeyCache.set(name, key);
    return key;
  }

  /** all_segments(): {name, id, coords: [[lon, lat], ...], highway} per street block. */
  function segmentsFromGeojson(geojson) {
    return geojson.features.map((f) => ({
      name: f.properties.name,
      id: f.id,
      coords: f.geometry.coordinates.map((c) => [...c]),
      highway: Object.hasOwn(f.properties, "highway") ? f.properties.highway : "residential",
    }));
  }

  function insideOakPark(coords) {
    const [south, west, north, east] = OAK_PARK_LIMITS;
    const tol = LIMITS_TOLERANCE;
    return coords.every(
      ([lon, lat]) => west - tol <= lon && lon <= east + tol && south - tol <= lat && lat <= north + tol,
    );
  }

  /** distance_to_line_m(): meters from a point to a polyline. */
  function distanceToLineM(lat, lon, coords) {
    const mx = 111320 * Math.cos(radians(lat));
    const my = 110540;
    let best = Infinity;
    for (let k = 0; k + 1 < coords.length; k++) {
      const [x1, y1] = coords[k];
      const [x2, y2] = coords[k + 1];
      const ax = (x1 - lon) * mx;
      const ay = (y1 - lat) * my;
      const dx = (x2 - x1) * mx;
      const dy = (y2 - y1) * my;
      const lengthSq = dx * dx + dy * dy;
      const t = lengthSq === 0 ? 0 : pyMax(0.0, pyMin(1.0, -(ax * dx + ay * dy) / lengthSq));
      best = pyMin(best, hypot(ax + t * dx, ay + t * dy));
    }
    return best;
  }

  const LOCATION_RE = /^\p{Nd}+ Block (.+)\n?$/u;

  class Analysis {
    constructor(incidents, streetsGeojson) {
      this.incidents = incidents;
      this.segments = segmentsFromGeojson(streetsGeojson);
      this.segmentsByStreet = new Map();
      for (const seg of this.segments) {
        const key = streetKey(seg.name);
        if (!this.segmentsByStreet.has(key)) this.segmentsByStreet.set(key, []);
        this.segmentsByStreet.get(key).push([seg.id, seg.coords]);
      }
      this.segmentCache = new Map();
      this.streetsCache = null;
    }

    oakParkStreets() {
      if (!this.streetsCache) {
        this.streetsCache = {
          type: "FeatureCollection",
          features: this.segments
            .filter((seg) => insideOakPark(seg.coords))
            .map((seg) => ({
              type: "Feature",
              id: seg.id,
              geometry: { type: "LineString", coordinates: seg.coords.map((c) => [...c]) },
              properties: { name: seg.name },
            })),
        };
      }
      return this.streetsCache;
    }

    /** street_segment_for(): the block an incident location sits on, as [id, coords], or null. */
    streetSegmentFor(location, lat, lon) {
      const cacheKey = `${location}\u0000${lat}\u0000${lon}`;
      if (this.segmentCache.has(cacheKey)) return this.segmentCache.get(cacheKey);
      let result = null;
      const match = LOCATION_RE.exec(location);
      if (match) {
        const candidates = this.segmentsByStreet.get(streetKey(match[1])) || [];
        let best = null;
        let bestDistance = null;
        for (const seg of candidates) {
          const d = distanceToLineM(lat, lon, seg[1]);
          if (best === null || d < bestDistance) {
            best = seg;
            bestDistance = d;
          }
        }
        if (best !== null && !(distanceToLineM(lat, lon, best[1]) > MAX_SNAP_METERS)) result = best;
      }
      this.segmentCache.set(cacheKey, result);
      return result;
    }

    /** aggregate_locations(): incidents grouped by block as GeoJSON, busiest first. */
    aggregateLocations(incidents, { topTypes = 5, years = 1.0 } = {}) {
      const groups = new Map();
      for (const i of incidents) {
        const segment = this.streetSegmentFor(i.location, i.latitude, i.longitude);
        let key;
        let geometry;
        if (segment) {
          key = `street\u0000${segment[0]}`;
          geometry = () => ({ type: "LineString", coordinates: segment[1].map((c) => [...c]) });
        } else {
          key = `point\u0000${i.latitude}\u0000${i.longitude}`;
          geometry = () => ({
            type: "Point",
            coordinates: [pyRoundDigits(i.longitude, 6), pyRoundDigits(i.latitude, 6)],
          });
        }
        let group = groups.get(key);
        if (!group) {
          group = { id: segment ? segment[0] : null, incidents: [] };
          groups.set(key, group);
        }
        group.geometry = geometry;
        group.incidents.push(i);
      }

      const perYear = pyMax(years, 1.0);
      const features = [];
      for (const group of groups.values()) {
        const members = group.incidents;
        const typeCounts = new Counter(members.flatMap((i) => [...i.types]));
        let severity = 0;
        for (const i of members) severity += incidentSeverity(i);
        const score = severity / perYear;
        features.push({
          type: "Feature",
          id: group.id,
          geometry: group.geometry(),
          properties: {
            location: new Counter(members.map((i) => i.location)).mostCommon(1)[0][0],
            zone: new Counter(members.map((i) => i.zone)).mostCommon(1)[0][0],
            count: members.length,
            top_types: typeCounts.mostCommon(topTypes),
            crime_against: Object.fromEntries(new Counter(members.flatMap((i) => [...i.crime_against]))),
            latest_date: members.map((i) => i.date).reduce((a, b) => (pyStrCmp(b, a) > 0 ? b : a)),
            danger_score: pyRoundDigits(score, 1),
            danger_level: dangerLevel(score),
          },
        });
      }
      features.sort((a, b) => b.properties.count - a.properties.count);
      return { type: "FeatureCollection", features, danger_levels: DANGER_LEVELS.map((l) => ({ ...l })) };
    }

    summarize(incidents) {
      const locations = new Counter(incidents.map((i) => i.location));
      const busiest = locations.mostCommon(1);
      const byPair = (counter) => [...counter.entries()].sort((a, b) => pyStrCmp(a[0], b[0]) || a[1] - b[1]);
      return {
        total: incidents.length,
        locations: new Set(incidents.map((i) => `${i.latitude}\u0000${i.longitude}`)).size,
        min_date: incidents.length ? incidents[0].date : null,
        max_date: incidents.length ? incidents[incidents.length - 1].date : null,
        busiest_location: busiest.length ? { location: busiest[0][0], count: busiest[0][1] } : null,
        by_type: new Counter(incidents.flatMap((i) => [...i.types])).mostCommon(),
        by_crime_against: new Counter(incidents.flatMap((i) => [...i.crime_against])).mostCommon(),
        by_zone: byPair(new Counter(incidents.map((i) => i.zone))),
        by_year: byPair(new Counter(incidents.map((i) => i.date.slice(0, 4)))),
      };
    }
  }

  // ---------------------------------------------------------------------------
  // routing.py
  // ---------------------------------------------------------------------------

  const WALK_MPS = 1.2;
  const BIKE_MPS = 3.5;
  const TRAFFIC_PENALTY = { trunk: 3.0, primary: 3.0, secondary: 1.8, tertiary: 0.7, unclassified: 0.2 };
  const BUSY_CLASSES = new Set(["trunk", "primary", "secondary"]);
  const CRIME_WEIGHT = 1.5;
  const CRIME_SCALE = 5.0;
  const HIGH_DANGER = DANGER_LEVELS.at(-1).min_score;
  const INTERSECTION_PENALTY_M = 25;
  const TURN_PENALTY_M = 60;
  const INTERSECTION_SNAP_M = 40;
  const REUSE_PENALTY = 3.0;
  const MAX_OVERLAP = 0.85;
  const MAX_SNAP_M = 300;

  class RouteError extends Error {}

  const nodeKey = (c) => `${c[0]},${c[1]}`;
  const sameCoord = (a, b) => a[0] === b[0] && a[1] === b[1];

  function meters(lon1, lat1, lon2, lat2) {
    const mx = 111320 * Math.cos(radians((lat1 + lat2) / 2));
    return hypot((lon2 - lon1) * mx, (lat2 - lat1) * 110540);
  }

  function lengthOf(coords) {
    const pieces = [];
    for (let k = 0; k + 1 < coords.length; k++) pieces.push(meters(...coords[k], ...coords[k + 1]));
    return pySum(pieces);
  }

  // A min-heap ordered by (cost, tie), like heapq over (cost, next(tie), state).
  class Heap {
    constructor() {
      this.items = [];
    }

    get size() {
      return this.items.length;
    }

    static less(a, b) {
      return a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);
    }

    push(item) {
      const items = this.items;
      items.push(item);
      let k = items.length - 1;
      while (k > 0) {
        const parent = (k - 1) >> 1;
        if (!Heap.less(items[k], items[parent])) break;
        [items[k], items[parent]] = [items[parent], items[k]];
        k = parent;
      }
    }

    pop() {
      const items = this.items;
      const top = items[0];
      const last = items.pop();
      if (items.length) {
        items[0] = last;
        let k = 0;
        for (;;) {
          const l = 2 * k + 1;
          const r = l + 1;
          let m = k;
          if (l < items.length && Heap.less(items[l], items[m])) m = l;
          if (r < items.length && Heap.less(items[r], items[m])) m = r;
          if (m === k) break;
          [items[k], items[m]] = [items[m], items[k]];
          k = m;
        }
      }
      return top;
    }
  }

  const START = "start";
  const END = "end";
  const COMPASS = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];

  class Router {
    constructor(analysis, incidents) {
      this.analysis = analysis;
      this.incidents = incidents;
      this.network = this.streetNetwork();
      this.nearestCache = new Map();
      this.graphs = new Map();
    }

    streetNetwork() {
      const edges = [];
      const adjacency = new Map();
      const add = (node, idx) => {
        const key = nodeKey(node);
        if (!adjacency.has(key)) adjacency.set(key, { coord: node, edges: [] });
        adjacency.get(key).edges.push(idx);
      };
      for (const seg of this.analysis.segments) {
        if (seg.highway === "service" || sameCoord(seg.coords[0], seg.coords.at(-1)) || !insideOakPark(seg.coords)) {
          continue;
        }
        const edge = {
          u: seg.coords[0],
          v: seg.coords.at(-1),
          uKey: nodeKey(seg.coords[0]),
          vKey: nodeKey(seg.coords.at(-1)),
          coords: seg.coords,
          length: lengthOf(seg.coords),
          name: seg.name,
          highway: seg.highway,
          segment_id: seg.id,
        };
        add(edge.u, edges.length);
        add(edge.v, edges.length);
        edges.push(edge);
      }
      return { edges, adjacency, streetKeys: edges.map((e) => streetKey(e.name)) };
    }

    /** _nearest_node(): the intersection within INTERSECTION_SNAP_M of a point, or null. */
    nearestNode(lon, lat) {
      const cacheKey = `${lon},${lat}`;
      if (this.nearestCache.has(cacheKey)) return this.nearestCache.get(cacheKey);
      let nearest = null;
      let nearestDistance = null;
      for (const [key, { coord }] of this.network.adjacency) {
        const d = meters(lon, lat, ...coord);
        if (nearest === null || d < nearestDistance) {
          nearest = key;
          nearestDistance = d;
        }
      }
      const result = nearest !== null && nearestDistance <= INTERSECTION_SNAP_M ? nearest : null;
      this.nearestCache.set(cacheKey, result);
      return result;
    }

    /** street_graph(): the network with danger scores for incidents dated start..end. */
    streetGraph(start = null, end = null) {
      const cacheKey = `${start}|${end}`;
      const cached = this.graphs.get(cacheKey);
      if (cached) {
        this.graphs.delete(cacheKey);
        this.graphs.set(cacheKey, cached);
        return cached;
      }
      const all = this.incidents;
      const incidents = filterIncidents(all, { start, end });
      const years = windowYears(all, start, end);
      const blocks = this.analysis.aggregateLocations(incidents, { years }).features;

      const blockDanger = new Map();
      for (const f of blocks) if (f.id !== null) blockDanger.set(f.id, f.properties.danger_score);
      const edgeDanger = this.network.edges.map((e) => (blockDanger.has(e.segment_id) ? blockDanger.get(e.segment_id) : 0.0));

      const nodeDanger = new Map();
      for (const f of blocks) {
        if (f.geometry.type === "Point") {
          const node = this.nearestNode(...f.geometry.coordinates);
          if (node !== null) nodeDanger.set(node, (nodeDanger.has(node) ? nodeDanger.get(node) : 0.0) + f.properties.danger_score);
        }
      }
      const graph = { ...this.network, edgeDanger, nodeDanger };
      this.graphs.set(cacheKey, graph);
      if (this.graphs.size > 16) this.graphs.delete(this.graphs.keys().next().value);
      return graph;
    }
  }

  function riskPerMeter(graph, idx) {
    const crime = CRIME_WEIGHT * Math.log1p(graph.edgeDanger[idx] / CRIME_SCALE);
    const highway = graph.edges[idx].highway;
    return crime + (Object.hasOwn(TRAFFIC_PENALTY, highway) ? TRAFFIC_PENALTY[highway] : 0.0);
  }

  function edgeCost(graph, idx, length) {
    return length * (1 + riskPerMeter(graph, idx));
  }

  function nodeCost(graph, key) {
    const danger = graph.nodeDanger.has(key) ? graph.nodeDanger.get(key) : 0.0;
    return danger ? INTERSECTION_PENALTY_M * Math.log1p(danger / CRIME_SCALE) : 0.0;
  }

  function positionAlong(coords, lat, lon) {
    const mx = 111320 * Math.cos(radians(lat));
    const my = 110540;
    let bestDistance = Infinity;
    let bestPosition = 0.0;
    let walked = 0.0;
    for (let k = 0; k + 1 < coords.length; k++) {
      const [x1, y1] = coords[k];
      const [x2, y2] = coords[k + 1];
      const dx = (x2 - x1) * mx;
      const dy = (y2 - y1) * my;
      const ax = (lon - x1) * mx;
      const ay = (lat - y1) * my;
      const lengthSq = dx * dx + dy * dy;
      const t = lengthSq === 0 ? 0.0 : pyMax(0.0, pyMin(1.0, (ax * dx + ay * dy) / lengthSq));
      const distance = hypot(ax - t * dx, ay - t * dy);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestPosition = walked + t * Math.sqrt(lengthSq);
      }
      walked += Math.sqrt(lengthSq);
    }
    return bestPosition;
  }

  /** snap(): the nearest point on any street block, as {edgeIndex, position}, or null. */
  function snap(graph, lat, lon) {
    let best = null;
    graph.edges.forEach((edge, idx) => {
      const distance = distanceToLineM(lat, lon, edge.coords);
      if (best === null || distance < best[0]) best = [distance, idx];
    });
    if (best === null || best[0] > MAX_SNAP_M) return null;
    const edge = graph.edges[best[1]];
    return { edgeIndex: best[1], position: positionAlong(edge.coords, lat, lon) };
  }

  /** _cut(): the part of a polyline between two distances along it, in travel order. */
  function cut(coords, startM, endM) {
    if (startM > endM) return cut(coords, endM, startM).reverse();
    let out = [];
    let walked = 0.0;
    for (let k = 0; k + 1 < coords.length; k++) {
      const a = coords[k];
      const b = coords[k + 1];
      const piece = meters(...a, ...b);
      const lo = walked;
      const hi = walked + piece;
      if (hi >= startM && lo <= endM && piece > 0) {
        if (!out.length) {
          const f = (startM - lo) / piece;
          out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
        }
        if (hi <= endM) {
          out.push(b);
        } else {
          const f = (endM - lo) / piece;
          out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
          break;
        }
      }
      walked = hi;
    }
    if (out.length < 2) out = !out.length ? [coords[0], coords[0]] : [...out, ...out];
    return out;
  }

  function virtualLinks(graph, start, end) {
    const links = new Map();
    const add = (from, link) => {
      if (!links.has(from)) links.set(from, []);
      links.get(from).push(link);
    };
    const sEdge = graph.edges[start.edgeIndex];
    const eEdge = graph.edges[end.edgeIndex];
    add(START, [sEdge.uKey, start.edgeIndex, cut(sEdge.coords, start.position, 0)]);
    add(START, [sEdge.vKey, start.edgeIndex, cut(sEdge.coords, start.position, sEdge.length)]);
    add(eEdge.uKey, [END, end.edgeIndex, cut(eEdge.coords, 0, end.position)]);
    add(eEdge.vKey, [END, end.edgeIndex, cut(eEdge.coords, eEdge.length, end.position)]);
    if (start.edgeIndex === end.edgeIndex) {
      add(START, [END, start.edgeIndex, cut(sEdge.coords, start.position, end.position)]);
    }
    return links;
  }

  /** _search(): Dijkstra from START to END over (intersection, street) states. */
  function search(graph, links, costOf, safety = true) {
    let tie = 0;
    const stateKey = (node, street) => (street === null ? `${node}\u0000` : `${node}\u0000${street}\u0000`);
    const originKey = stateKey(START, null);
    const best = new Map([[originKey, 0.0]]);
    const cameFrom = new Map();
    const heap = new Heap();
    heap.push([0.0, tie++, originKey, START, null]);
    let goal = null;
    while (heap.size) {
      const [cost, , state, node, street] = heap.pop();
      if (node === END) {
        goal = state;
        break;
      }
      if (cost > best.get(state)) continue;
      const steps = [];
      const adjacent = graph.adjacency.get(node);
      if (adjacent) {
        for (const idx of adjacent.edges) {
          const edge = graph.edges[idx];
          const forward = edge.uKey === node;
          steps.push([forward ? edge.vKey : edge.uKey, idx, forward ? edge.coords : [...edge.coords].reverse(), edge.length]);
        }
      }
      for (const [nxt, idx, coords] of links.get(node) || []) steps.push([nxt, idx, coords, lengthOf(coords)]);
      for (const [nxt, idx, coords, length] of steps) {
        const nextStreet = graph.streetKeys[idx];
        let newCost = cost + costOf(idx, length);
        if (safety && nxt !== END) newCost += nodeCost(graph, nxt);
        if (safety && street !== null && nextStreet !== street) newCost += TURN_PENALTY_M;
        const nextState = stateKey(nxt, nextStreet);
        if (newCost < (best.has(nextState) ? best.get(nextState) : Infinity)) {
          best.set(nextState, newCost);
          cameFrom.set(nextState, [state, idx, coords, length]);
          heap.push([newCost, tie++, nextState, nxt, nextStreet]);
        }
      }
    }
    if (goal === null) return null;
    const legs = [];
    let state = goal;
    while (state !== originKey) {
      const [prev, idx, coords, length] = cameFrom.get(state);
      legs.push([idx, coords, length]);
      state = prev;
    }
    return legs.reverse();
  }

  function overlap(legs, other) {
    const shared = new Set(other.map(([idx]) => idx));
    const total = pySum(legs.map(([, , length]) => length)) || 1.0;
    return pySum(legs.filter(([idx]) => shared.has(idx)).map(([, , length]) => length)) / total;
  }

  function bearing(a, b) {
    const dx = (b[0] - a[0]) * Math.cos(radians(a[1]));
    const dy = b[1] - a[1];
    return pyMod(degrees(Math.atan2(dx, dy)), 360);
  }

  function startBearing(coords) {
    for (const b of coords.slice(1)) {
      if (meters(...coords[0], ...b) > 3) return bearing(coords[0], b);
    }
    return bearing(coords[0], coords.at(-1));
  }

  function endBearing(coords) {
    const last = coords.at(-1);
    for (let k = coords.length - 2; k >= 0; k--) {
      if (meters(...coords[k], ...last) > 3) return bearing(coords[k], last);
    }
    return bearing(coords[0], last);
  }

  function turn(angle) {
    const side = angle > 0 ? "right" : "left";
    const size = Math.abs(angle);
    if (size < 30) return "Continue onto";
    if (size < 60) return `Slight ${side} onto`;
    if (size < 150) return `Turn ${side} onto`;
    return "Make a U-turn onto";
  }

  function directions(graph, legs) {
    let groups = [];
    for (const [idx, coords, length] of legs) {
      const edge = graph.edges[idx];
      const key = streetKey(edge.name);
      let group;
      if (groups.length && groups.at(-1).key === key) {
        group = groups.at(-1);
        group.coords.push(...coords.slice(1));
      } else {
        group = { key, name: edge.name, coords: [...coords], length: 0.0, busy: false, highCrime: false };
        groups.push(group);
      }
      group.length += length;
      group.busy = group.busy || BUSY_CLASSES.has(edge.highway);
      group.highCrime = group.highCrime || graph.edgeDanger[idx] >= HIGH_DANGER;
    }

    const kept = groups.filter((g, i) => g.length >= 8 || i === groups.length - 1);
    if (kept.length) groups = kept;

    const steps = groups.map((group, i) => {
      let text;
      if (i === 0) {
        text = `Head ${COMPASS[pyMod(pyRound(startBearing(group.coords) / 45), 8)]} on ${group.name}`;
      } else {
        const angle = pyMod(startBearing(group.coords) - endBearing(groups[i - 1].coords) + 180, 360) - 180;
        text = `${turn(angle)} ${group.name}`;
      }
      return {
        text,
        distance_m: pyRound(group.length),
        busy_street: group.busy,
        high_crime: group.highCrime,
      };
    });
    steps.push({ text: "Arrive at your destination", distance_m: 0, busy_street: false, high_crime: false });
    return steps;
  }

  function describe(graph, legs, label, directM) {
    const distance = pySum(legs.map(([, , length]) => length));
    const edges = legs.map(([idx, , length]) => [graph.edges[idx], graph.edgeDanger[idx], length]);
    const geometry = [];
    for (const [, coords] of legs) {
      const points = coords.map(([lon, lat]) => [pyRoundDigits(lat, 6), pyRoundDigits(lon, 6)]);
      const last = geometry.at(-1);
      const skipFirst = geometry.length && last[0] === points[0][0] && last[1] === points[0][1];
      geometry.push(...(skipFirst ? points.slice(1) : points));
    }
    const highBlocks = new Set(legs.filter(([idx]) => graph.edgeDanger[idx] >= HIGH_DANGER).map(([idx]) => idx));
    let maxDanger = null;
    for (const [, danger] of edges) if (maxDanger === null || danger > maxDanger) maxDanger = danger;
    return {
      label,
      distance_m: pyRound(distance),
      walk_minutes: pyMax(1, pyRound(distance / WALK_MPS / 60)),
      bike_minutes: pyMax(1, pyRound(distance / BIKE_MPS / 60)),
      extra_vs_direct_m: pyMax(0, pyRound(distance - directM)),
      busy_street_m: pyRound(pySum(edges.filter(([edge]) => BUSY_CLASSES.has(edge.highway)).map(([, , length]) => length))),
      high_danger_blocks: highBlocks.size,
      average_danger: pyRoundDigits(pySum(edges.map(([, danger, length]) => danger * length)) / (distance || 1), 1),
      max_danger: pyRoundDigits(maxDanger === null ? 0.0 : maxDanger, 1),
      geometry,
      steps: directions(graph, legs),
    };
  }

  function exposure(graph, legs) {
    const along = pySum(legs.map(([idx, , length]) => length * riskPerMeter(graph, idx)));
    const crossings = pySum(legs.slice(0, -1).map(([, coords]) => nodeCost(graph, nodeKey(coords.at(-1)))));
    return along + crossings;
  }

  /** plan_routes(): up to two walking routes, safest first. */
  function planRoutes(router, fromLat, fromLon, toLat, toLon, startDate = null, endDate = null) {
    const graph = router.streetGraph(startDate || null, endDate || null);
    const start = snap(graph, fromLat, fromLon);
    const end = snap(graph, toLat, toLon);
    if (start === null || end === null) throw new RouteError("That location is too far from Oak Park's streets.");
    if (start.edgeIndex === end.edgeIndex && start.position === end.position) {
      throw new RouteError("The start and destination are the same place.");
    }

    const links = virtualLinks(graph, start, end);
    const safest = search(graph, links, (idx, length) => edgeCost(graph, idx, length));
    if (safest === null) throw new RouteError("No walking route connects those two places.");
    const direct = search(graph, links, (idx, length) => length, false);
    const directM = pySum(direct.map(([, , length]) => length));

    const used = new Set(safest.map(([idx]) => idx));
    let alternative = search(graph, links, (idx, length) => edgeCost(graph, idx, length) * (used.has(idx) ? REUSE_PENALTY : 1.0));
    if (!alternative || !alternative.length || overlap(alternative, safest) >= MAX_OVERLAP) {
      alternative = overlap(direct, safest) < MAX_OVERLAP ? direct : null;
    }
    if (alternative === null) return [describe(graph, safest, "Safest route", directM)];

    let first = safest;
    let second = alternative;
    if (exposure(graph, alternative) < exposure(graph, safest)) [first, second] = [alternative, safest];
    const firstM = pySum(first.map(([, , length]) => length));
    const secondM = pySum(second.map(([, , length]) => length));
    const secondLabel = secondM < firstM ? "Shorter route" : "Alternative route";
    return [describe(graph, first, "Safest route", directM), describe(graph, second, secondLabel, directM)];
  }

  // ---------------------------------------------------------------------------
  // geocode.py
  // ---------------------------------------------------------------------------

  const NOMINATIM_URL = "https://nominatim.openstreetmap.org";
  const MARGIN = 0.004;
  const GEOCODE_UNAVAILABLE = "The address lookup service is unavailable right now.";

  class GeocodeError extends Error {}

  function geocodeLabel(result, addressOnly = false) {
    const address = Object.hasOwn(result, "address") ? result.address : {};
    const road = address.road;
    const street = road ? [address.house_number, road].filter((p) => p).join(" ") : "";
    const name = addressOnly ? null : result.name;
    if (name && street && name !== road) return `${name}, ${street}`;
    const display = Object.hasOwn(result, "display_name") ? result.display_name : "";
    return name || street || display.split(", ").slice(0, 2).join(", ");
  }

  /**
   * Nominatim access as in geocode.py: one request at a time, at least a second
   * between them, repeat lookups cached. getJson(url) does the HTTP request and
   * must reject on network errors, HTTP errors and invalid JSON.
   */
  class Geocoder {
    constructor(getJson, { minIntervalMs = 1000, now = () => Date.now() } = {}) {
      this.getJson = getJson;
      this.minIntervalMs = minIntervalMs;
      this.now = now;
      this.queue = Promise.resolve();
      this.lastRequest = -Infinity;
      this.searchCache = new Map();
      this.reverseCache = new Map();
    }

    get(path, params) {
      const url = `${NOMINATIM_URL}/${path}?${urlencode(params)}`;
      const run = async () => {
        const wait = this.minIntervalMs - (this.now() - this.lastRequest);
        if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
        try {
          return await this.getJson(url);
        } catch (err) {
          throw new GeocodeError(GEOCODE_UNAVAILABLE, { cause: err });
        } finally {
          this.lastRequest = this.now();
        }
      };
      const result = this.queue.then(run, run);
      this.queue = result.catch(() => {});
      return result;
    }

    async search(query) {
      if (this.searchCache.has(query)) return this.searchCache.get(query);
      const [south, west, north, east] = OAK_PARK_LIMITS;
      const results = await this.get("search", {
        q: query,
        format: "jsonv2",
        addressdetails: 1,
        limit: 5,
        countrycodes: "us",
        viewbox: `${pyFloatRepr(west - MARGIN)},${pyFloatRepr(north + MARGIN)},${pyFloatRepr(east + MARGIN)},${pyFloatRepr(south - MARGIN)}`,
        bounded: 1,
      });
      const places = results.map((r) => ({
        label: geocodeLabel(r),
        lat: typeof r.lat === "number" ? r.lat : pyFloat(r.lat),
        lon: typeof r.lon === "number" ? r.lon : pyFloat(r.lon),
      }));
      this.searchCache.set(query, places);
      return places;
    }

    async reverse(lat, lon) {
      const cacheKey = `${lat},${lon}`;
      if (this.reverseCache.has(cacheKey)) return this.reverseCache.get(cacheKey);
      const result = await this.get("reverse", { lat, lon, format: "jsonv2", addressdetails: 1, zoom: 18 });
      let label;
      if (!pyTruthy(result) || pyContains(result, "error")) label = null;
      else label = geocodeLabel(result, true);
      this.reverseCache.set(cacheKey, label);
      return label;
    }
  }

  function pyContains(container, item) {
    if (typeof container === "string") return container.includes(item);
    if (Array.isArray(container)) return container.includes(item);
    return Object.hasOwn(container, item);
  }

  // ---------------------------------------------------------------------------
  // app.py: the JSON API, answered in the browser
  // ---------------------------------------------------------------------------

  const SERVER_ERROR = "Something went wrong on our end. Please try again.";

  function isoDateParam(value) {
    if (!value) return null;
    const ymd = parseIsoDate(value);
    return ymd ? isoFormat(ymd) : null;
  }

  function coordinatePair(value) {
    if (typeof value !== "string") return null;
    const parts = value.split(",");
    if (parts.length !== 2) return null;
    let lat;
    let lon;
    try {
      lat = pyFloat(parts[0]);
      lon = pyFloat(parts[1]);
    } catch (err) {
      if (err instanceof ValueError) return null;
      throw err;
    }
    return -90 <= lat && lat <= 90 && -180 <= lon && lon <= 180 ? [lat, lon] : null;
  }

  /** Python str slicing by code point: s[:n]. */
  function codePointPrefix(s, n) {
    return Array.from(s).slice(0, n).join("");
  }

  /**
   * The Flask app's JSON endpoints. `loadData()` resolves to
   * {incidents, streets} (unpacked incidents and the street GeoJSON).
   * handle(path, URLSearchParams) resolves to {status, body} exactly like the
   * corresponding /api/<path> response.
   */
  class SafeRoutesApi {
    constructor({ loadData, geocoder }) {
      this.loadData = loadData;
      this.geocoder = geocoder;
      this.state = null;
    }

    ready() {
      if (!this.state) {
        this.state = Promise.resolve(this.loadData()).then(({ incidents, streets }) => {
          const analysis = new Analysis(incidents, streets);
          return { incidents, analysis, router: null, cache: new Map() };
        });
        this.state.catch(() => {
          this.state = null;
        });
      }
      return this.state;
    }

    async handle(path, params) {
      try {
        return await this.dispatch(path, params);
      } catch (err) {
        if (typeof console !== "undefined") console.error(err);
        return { status: 500, body: { error: SERVER_ERROR } };
      }
    }

    filters(params) {
      return {
        incidentType: params.get("type") || null,
        crimeAgainst: params.get("crime_against") || null,
        start: isoDateParam(params.get("start")),
        end: isoDateParam(params.get("end")),
      };
    }

    cached(state, key, compute) {
      if (!state.cache.has(key)) {
        state.cache.set(key, compute());
        if (state.cache.size > 128) state.cache.delete(state.cache.keys().next().value);
      }
      return structuredClone(state.cache.get(key));
    }

    async dispatch(path, params) {
      const ok = (body) => ({ status: 200, body });
      const error = (message, status) => ({ status, body: { error: message } });

      if (path === "geocode") {
        const query = pyStrip(params.get("q") || "");
        if (!query) return error("Enter an address or place.", 400);
        try {
          return ok({ results: await this.geocoder.search(codePointPrefix(query, 200)) });
        } catch (err) {
          if (err instanceof GeocodeError) return error(err.message, 502);
          throw err;
        }
      }
      if (path === "reverse") {
        const point = coordinatePair(`${params.get("lat")},${params.get("lon")}`);
        if (!point) return error("Give lat and lon.", 400);
        try {
          return ok({ label: await this.geocoder.reverse(pyRoundDigits(point[0], 5), pyRoundDigits(point[1], 5)) });
        } catch (err) {
          if (err instanceof GeocodeError) return error(err.message, 502);
          throw err;
        }
      }

      const known = ["options", "map-points", "streets", "summary", "incidents", "route"];
      if (!known.includes(path)) return error("Not found.", 404);

      const state = await this.ready();
      const { analysis, incidents } = state;

      if (path === "options") return ok(this.cached(state, "options", () => filterOptions(incidents)));
      if (path === "streets") return ok(structuredClone(analysis.oakParkStreets()));

      if (path === "route") {
        const from = coordinatePair(params.get("from"));
        const to = coordinatePair(params.get("to"));
        if (!from || !to) return error('Give "from" and "to" as "lat,lon".', 400);
        if (!state.router) state.router = new Router(analysis, incidents);
        try {
          const routes = planRoutes(
            state.router,
            ...from,
            ...to,
            isoDateParam(params.get("start")),
            isoDateParam(params.get("end")),
          );
          return ok({ routes });
        } catch (err) {
          if (err instanceof RouteError) return error(err.message, 422);
          throw err;
        }
      }

      const f = this.filters(params);
      const filterKey = JSON.stringify([f.incidentType, f.crimeAgainst, f.start, f.end]);
      if (path === "map-points") {
        return ok(
          this.cached(state, `map-points ${filterKey}`, () =>
            analysis.aggregateLocations(filterIncidents(incidents, f), {
              years: windowYears(incidents, f.start, f.end),
            }),
          ),
        );
      }
      if (path === "summary") {
        return ok(this.cached(state, `summary ${filterKey}`, () => analysis.summarize(filterIncidents(incidents, f))));
      }
      // incidents
      const rows = filterIncidents(incidents, f);
      let limit = 500;
      if (params.has("limit")) {
        try {
          limit = pyInt(params.get("limit"));
        } catch (err) {
          if (!(err instanceof ValueError)) throw err;
        }
      }
      limit = pyMin(limit, 5000);
      return ok({
        count: rows.length,
        incidents: limit > 0 ? rows.slice(-limit).reverse().map(incidentToDict) : [],
      });
    }
  }

  return {
    // Python semantics, exported for tests.
    py: {
      strCmp: pyStrCmp,
      sum: pySum,
      round: pyRound,
      roundDigits: pyRoundDigits,
      hypot,
      mod: pyMod,
      float: pyFloat,
      int: pyInt,
      floatRepr: pyFloatRepr,
      urlencode,
      strip: pyStrip,
      parseIsoDate,
    },
    isoDateParam,
    windowYears,
    streetKey,
    parseCsv,
    loadIncidentsFromCsv,
    packIncidents,
    unpackIncidents,
    incidentToDict,
    filterIncidents,
    filterOptions,
    Analysis,
    Router,
    planRoutes,
    Geocoder,
    SafeRoutesApi,
    meters,
    DANGER_LEVELS,
  };
});
