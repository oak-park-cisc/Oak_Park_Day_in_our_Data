import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapPin } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
	type Dataset,
	type Entity,
	format,
	INDICATOR_BY_KEY,
	LATEST_COMPARABLE_TEST_YEAR,
	STATE,
	type Unit,
	value,
} from "../data";
import { useTheme } from "../theme";
import { Select } from "./Select";

type GeoData = {
	boundary: number[][][];
	zones: { id: string; polygon: number[][][] }[];
	buildings: { id: string; polygon: number[][][] }[];
	oprf: { id: string; lat: number; lon: number };
};

type Props = { schools: Dataset; districts: Dataset };

const METRICS = [
	{ key: "ela_prof", dir: 1 },
	{ key: "math_prof", dir: 1 },
	{ key: "science_prof", dir: 1 },
	{ key: "attendance_rate", dir: 1 },
	{ key: "chronic_absenteeism", dir: -1 },
	{ key: "teacher_retention", dir: 1 },
	{ key: "grad_rate_4yr", dir: 1 },
	{ key: "ninth_on_track", dir: 1 },
	{ key: "dropout_rate", dir: -1 },
	{ key: "avg_class_size", dir: -1 },
] as const;

function read(e: Entity | undefined, key: string, idx: number): number | string | null {
	return e?.data[key]?.[idx] ?? null;
}

/** GeoJSON rings are [lon, lat]; Leaflet wants [lat, lng]. */
function toLatLng(poly: number[][][]): L.LatLngExpression[][] {
	return poly.map((ring) => ring.map(([lon, lat]) => [lat, lon]));
}

type Score = { key: (typeof METRICS)[number]["key"]; mine: number; delta: number };

function fmtDelta(d: number, unit: Unit): string {
	const sign = d > 0 ? "+" : "−";
	return `${sign}${Math.abs(d).toFixed(1)}${unit === "pct" ? " pts" : ""}`;
}

export function MapView({ schools, districts }: Props) {
	const t = useTheme();
	const [geo, setGeo] = useState<GeoData | null>(null);
	const [geoError, setGeoError] = useState<string | null>(null);
	const [sel, setSel] = useState<string | null>(null);
	const holder = useRef<HTMLDivElement>(null);
	const mapRef = useRef<L.Map | null>(null);
	const shapes = useRef<Map<string, { layers: L.Path[]; fill: number }>>(new Map());

	useEffect(() => {
		let live = true;
		fetch(`${import.meta.env.BASE_URL}data/schools-geo.json`)
			.then((r) => {
				if (!r.ok) throw new Error(`Could not load school geography (${r.status})`);
				return r.json();
			})
			.then((g: GeoData) => {
				if (live) setGeo(g);
			})
			.catch((e: Error) => {
				if (live) setGeoError(e.message);
			});
		return () => {
			live = false;
		};
	}, []);

	const years = schools.years;
	const byId = useMemo(() => new Map(schools.rows.map((r) => [r.id, r])), [schools]);
	const state = useMemo(() => districts.rows.find((r) => r.id === STATE), [districts]);

	useEffect(() => {
		if (!geo || !holder.current || mapRef.current) return;
		const map = L.map(holder.current, { scrollWheelZoom: false, zoomSnap: 0.25 });
		L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
			attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
			maxZoom: 19,
		}).addTo(map);

		let minLat = 90;
		let maxLat = -90;
		let minLon = 180;
		let maxLon = -180;
		const bump = (ring: number[][]) => {
			for (const [lon, lat] of ring) {
				minLat = Math.min(minLat, lat);
				maxLat = Math.max(maxLat, lat);
				minLon = Math.min(minLon, lon);
				maxLon = Math.max(maxLon, lon);
			}
		};
		for (const ring of geo.boundary) bump(ring);

		L.polygon(toLatLng(geo.boundary), {
			color: t.muted,
			weight: 1.5,
			dashArray: "4 4",
			fill: false,
			interactive: false,
		}).addTo(map);

		shapes.current = new Map();
		const track = (layer: L.Path, id: string, fill: number) => {
			layer.bindTooltip(byId.get(id)?.name ?? "", { direction: "top" });
			layer.on("click", () => setSel(id));
			const entry = shapes.current.get(id) ?? { layers: [], fill };
			entry.layers.push(layer);
			shapes.current.set(id, entry);
		};

		geo.zones.forEach((z, i) => {
			const color = t.series[i % t.series.length];
			track(
				L.polygon(toLatLng(z.polygon), {
					color,
					weight: 2,
					fillColor: color,
					fillOpacity: 0.22,
				}).addTo(map),
				z.id,
				0.22,
			);
		});
		for (const b of geo.buildings) {
			const hasZone = geo.zones.some((z) => z.id === b.id);
			if (hasZone) continue;
			track(
				L.polygon(toLatLng(b.polygon), {
					color: t.ink,
					weight: 2,
					fillColor: t.ink,
					fillOpacity: 0.3,
				}).addTo(map),
				b.id,
				0.3,
			);
		}
		track(
			L.circleMarker([geo.oprf.lat, geo.oprf.lon], {
				color: t.ink,
				weight: 2,
				fillColor: t.ink,
				fillOpacity: 0.6,
				radius: 9,
			}).addTo(map),
			geo.oprf.id,
			0.6,
		);

		map.fitBounds(
			[
				[minLat, minLon],
				[maxLat, maxLon],
			],
			{ padding: [12, 12] },
		);
		mapRef.current = map;
		return () => {
			map.remove();
			mapRef.current = null;
			shapes.current = new Map();
		};
	}, [geo, t, byId]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: t is deliberate — the map effect rebuilds shapes on theme change and this pass must re-apply the selection highlight after that.
	useEffect(() => {
		for (const [id, entry] of shapes.current) {
			const active = id === sel;
			for (const layer of entry.layers) {
				layer.setStyle({
					weight: active ? 4 : 2,
					fillOpacity: active ? Math.min(0.75, entry.fill + 0.25) : entry.fill,
				});
				if (active) layer.bringToFront();
			}
		}
	}, [sel, t]);

	const details = useMemo(() => {
		if (!sel) return null;
		const sc = byId.get(sel);
		if (!sc) return null;
		const last = years.length - 1;
		const i24 = years.indexOf(LATEST_COMPARABLE_TEST_YEAR);
		const scores = METRICS.map((m) => {
			const mine = value(sc, m.key, i24);
			const st = value(state, m.key, i24);
			if (mine == null || st == null) return null;
			return { key: m.key, mine, delta: (mine - st) * m.dir };
		}).filter((s): s is Score => s != null);
		const best = [...scores]
			.sort((a, b) => b.delta - a.delta)
			.filter((s) => s.delta > 0)
			.slice(0, 3);
		const opps = [...scores]
			.sort((a, b) => a.delta - b.delta)
			.filter((s) => s.delta < 0)
			.slice(0, 3);
		return {
			sc,
			type: sc.school_type,
			designation: read(sc, "summative_designation", last),
			enrollment: value(sc, "enrollment", last),
			li: value(sc, "pct_low_income", last),
			best,
			opps,
		};
	}, [sel, byId, years, state]);

	const options = useMemo(
		() => [
			{ value: "", label: "Choose a school…" },
			...schools.rows.map((r) => ({ value: r.id, label: r.name })),
		],
		[schools],
	);

	return (
		<section className="flex flex-col gap-3" aria-labelledby="map-title">
			<div>
				<h2 id="map-title" className="flex items-center gap-2 text-xl font-bold">
					<MapPin size={20} aria-hidden /> Map
				</h2>
				<p className="text-sm text-ink-2 dark:text-ink-2-dark">
					Every Oak Park public school. Tap an attendance zone or marker for the school&rsquo;s best metrics
					and biggest opportunities against the Illinois average.
				</p>
			</div>

			<div className="max-w-60">
				<Select label="School" value={sel ?? ""} onChange={(v) => setSel(v || null)} options={options} />
			</div>

			{geoError ? (
				<p
					role="alert"
					className="rounded-xl border border-line bg-card p-4 text-sm dark:border-line-dark dark:bg-card-dark"
				>
					Couldn&rsquo;t load the school boundaries: {geoError}
				</p>
			) : geo ? (
				<figure
					className="overflow-hidden rounded-xl border border-line dark:border-line-dark"
					aria-label="Map of Oak Park school attendance zones"
				>
					<div ref={holder} className="h-[360px] w-full sm:h-[440px]" />
				</figure>
			) : (
				<p
					className="rounded-xl border border-line bg-card py-20 text-center text-sm text-muted dark:border-line-dark dark:bg-card-dark dark:text-muted-dark"
					aria-live="polite"
				>
					Loading school boundaries…
				</p>
			)}
			<p className="text-xs text-muted dark:text-muted-dark">
				Elementary zones are the Village of Oak Park&rsquo;s official attendance boundaries. D97 middle
				schools and the high school serve the whole village, so they have no attendance zone. Basemap:
				OpenStreetMap.
			</p>

			{details && (
				<figure className="flex flex-col gap-3 rounded-xl border border-line bg-card p-4 dark:border-line-dark dark:bg-card-dark">
					<figcaption className="flex flex-wrap items-center gap-2">
						<h3 className="text-lg font-semibold">{details.sc.name}</h3>
						{details.type && (
							<span className="rounded-full border border-line px-2 py-0.5 text-xs dark:border-line-dark">
								{details.type}
							</span>
						)}
						{typeof details.designation === "string" && details.designation && (
							<span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-white dark:bg-accent-dark">
								{details.designation}
							</span>
						)}
						<button
							type="button"
							onClick={() => setSel(null)}
							className="ml-auto flex min-h-11 items-center rounded-lg px-2 text-sm font-medium text-muted hover:bg-line dark:text-muted-dark dark:hover:bg-line-dark"
						>
							Clear
						</button>
					</figcaption>

					<dl className="tabular flex flex-wrap gap-x-6 gap-y-1 text-sm">
						<div>
							<dt className="text-xs text-muted dark:text-muted-dark">
								Enrollment {years[years.length - 1]}
							</dt>
							<dd className="font-semibold">{format(details.enrollment, "count")}</dd>
						</div>
						<div>
							<dt className="text-xs text-muted dark:text-muted-dark">Low-income students</dt>
							<dd className="font-semibold">{format(details.li, "pct")}</dd>
						</div>
					</dl>

					<div className="grid gap-3 md:grid-cols-2">
						<div className="rounded-lg border border-line p-3 dark:border-line-dark">
							<h4 className="text-sm font-semibold">Best metrics</h4>
							<p className="mb-2 text-xs text-muted dark:text-muted-dark">
								Furthest ahead of the Illinois average, 2024
							</p>
							<ul className="flex flex-col gap-1.5 text-sm">
								{details.best.map((s) => (
									<li key={s.key} className="flex flex-wrap items-baseline justify-between gap-x-2">
										<span className="text-ink-2 dark:text-ink-2-dark">{INDICATOR_BY_KEY[s.key].label}</span>
										<span className="tabular">
											<strong>{format(s.mine, INDICATOR_BY_KEY[s.key].unit)}</strong>{" "}
											<span className="text-xs text-muted dark:text-muted-dark">
												{fmtDelta(s.delta, INDICATOR_BY_KEY[s.key].unit)} vs. state
											</span>
										</span>
									</li>
								))}
								{details.best.length === 0 && (
									<li className="text-sm text-muted dark:text-muted-dark">
										None ahead of the state average.
									</li>
								)}
							</ul>
						</div>
						<div className="rounded-lg border border-line p-3 dark:border-line-dark">
							<h4 className="text-sm font-semibold">Biggest opportunities</h4>
							<p className="mb-2 text-xs text-muted dark:text-muted-dark">
								Furthest behind the Illinois average, 2024
							</p>
							<ul className="flex flex-col gap-1.5 text-sm">
								{details.opps.map((s) => (
									<li key={s.key} className="flex flex-wrap items-baseline justify-between gap-x-2">
										<span className="text-ink-2 dark:text-ink-2-dark">{INDICATOR_BY_KEY[s.key].label}</span>
										<span className="tabular">
											<strong>{format(s.mine, INDICATOR_BY_KEY[s.key].unit)}</strong>{" "}
											<span className="text-xs text-muted dark:text-muted-dark">
												{fmtDelta(s.delta, INDICATOR_BY_KEY[s.key].unit)} vs. state
											</span>
										</span>
									</li>
								))}
								{details.opps.length === 0 && (
									<li className="text-sm text-muted dark:text-muted-dark">
										Nothing trails the state average in 2024.
									</li>
								)}
							</ul>
						</div>
					</div>
				</figure>
			)}
		</section>
	);
}
