import {
	CircleHelp,
	Download,
	Flag,
	Info,
	List,
	MapPin,
	Satellite as SatelliteIcon,
	Scan,
	School,
	TreeDeciduous,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Area } from "./Area";
import { analyzeArea } from "./area";
import { BlockDetail } from "./BlockDetail";
import { BlockList } from "./BlockList";
import type { Bounds } from "./canopy";
import { useData } from "./data";
import { applyFilters, DEFAULT_FILTERS, type Filters } from "./filters";
import { MajorityMenu } from "./MajorityMenu";
import { MapView, type Mode } from "./MapView";
import { DEFAULT_MAJORITY, type Majority, majorityLabel, meetsMajority } from "./majority";
import { METRICS, type MetricKey, niceName } from "./metrics";
import { NearMe } from "./NearMe";
import { type Center, findNearby } from "./nearby";
import { Satellite } from "./Satellite";
import type { BlocksData, ModisData, TreesData, ZonesData } from "./types";
import { Welcome } from "./Welcome";
import { ZoneDetail, ZoneList } from "./Zones";

const TABS: { key: Mode; label: string; icon: typeof List }[] = [
	{ key: "blocks", label: "Blocks", icon: List },
	{ key: "near", label: "Near me", icon: MapPin },
	{ key: "zones", label: "Zones", icon: School },
	{ key: "satellite", label: "Satellite", icon: SatelliteIcon },
	{ key: "area", label: "Area", icon: Scan },
];

const DOWNLOADS: Record<Mode, { file: string; label: string }> = {
	blocks: { file: "blocks.csv", label: "Download full block table (CSV)" },
	near: { file: "blocks.csv", label: "Download full block table (CSV)" },
	zones: { file: "zones.csv", label: "Download zone table (CSV)" },
	satellite: { file: "modis-tree-cover.geojson", label: "Download satellite tree-cover cells (GeoJSON)" },
	area: { file: "blocks.csv", label: "Download full block table (CSV)" },
};

export default function App() {
	const { data, error } = useData<BlocksData>("blocks.geojson");
	const { data: zonesData } = useData<ZonesData>("zones.geojson");
	// The app opens on the Area tab with the welcome popup shown on every load.
	const [tab, setTab] = useState<Mode>("area");
	const [welcomeOpen, setWelcomeOpen] = useState(true);
	const [metricKey, setMetricKey] = useState<MetricKey>("top_genus_share");
	const [selected, setSelected] = useState<string | null>(null);
	const [focusToken, setFocusToken] = useState(0);
	const [query, setQuery] = useState("");
	const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
	const [filtersOpen, setFiltersOpen] = useState(false);
	const [selectedZone, setSelectedZone] = useState<string | null>(null);
	const [center, setCenter] = useState<Center | null>(null);
	const [radiusFt, setRadiusFt] = useState(300);
	const [selectedTree, setSelectedTree] = useState<number | null>(null);
	// The individual tree file is large, so it loads only once "Near me" is opened.
	const [wantTrees, setWantTrees] = useState(true);
	const trees = useData<TreesData>("trees.json", wantTrees);
	const [wantModis, setWantModis] = useState(true);
	const modis = useData<ModisData>("modis-tree-cover.geojson", wantModis);
	const [satYearIdx, setSatYearIdx] = useState<number | null>(null);
	const [selectedCell, setSelectedCell] = useState<string | null>(null);
	const [majority, setMajority] = useState<Majority>(DEFAULT_MAJORITY);
	const [areaBounds, setAreaBounds] = useState<Bounds | null>(null);
	const [areaCorner, setAreaCorner] = useState<[number, number] | null>(null);
	const [drawing, setDrawing] = useState(false);
	const [viewToken, setViewToken] = useState(0);

	const metric = METRICS.find((m) => m.key === metricKey) ?? METRICS[0];
	const blocks = data?.features ?? [];
	const props = useMemo(() => blocks.map((f) => f.properties), [blocks]);
	// With the majority flag on, every view is limited to flagged blocks (null = no limit).
	const flagged = useMemo(
		() => (majority.on ? new Set(props.filter((b) => meetsMajority(b, majority)).map((b) => b.block)) : null),
		[props, majority],
	);
	const current = props.find((b) => b.block === selected && (!flagged || flagged.has(b.block))) ?? null;
	const rows = useMemo(
		() =>
			flagged
				? // The majority menu sets its own tree minimum, so the list's tree-count filter is set aside.
					applyFilters(props, { ...filters, minTrees: 1 }, query).filter((b) => flagged.has(b.block))
				: applyFilters(props, filters, query),
		[props, filters, query, flagged],
	);
	const visible = useMemo(() => new Set(rows.map((b) => b.block)), [rows]);
	const zones = useMemo(() => zonesData?.features.map((f) => f.properties) ?? [], [zonesData]);
	const currentZone = zones.find((z) => z.zone === selectedZone) ?? null;
	const nearby = useMemo(
		() =>
			trees.data && center
				? findNearby(trees.data, center, radiusFt, flagged ? (b) => flagged.has(b) : undefined)
				: null,
		[trees.data, center, radiusFt, flagged],
	);

	const areaResult = useMemo(
		() =>
			areaBounds && trees.data
				? analyzeArea(areaBounds, trees.data, props, modis.data, flagged ? (b) => flagged.has(b) : undefined)
				: null,
		[areaBounds, trees.data, props, modis.data, flagged],
	);

	function areaClick(lat: number, lon: number) {
		if (!areaCorner) {
			setAreaCorner([lat, lon]);
			return;
		}
		const [lat0, lon0] = areaCorner;
		setAreaBounds({
			south: Math.min(lat0, lat),
			north: Math.max(lat0, lat),
			west: Math.min(lon0, lon),
			east: Math.max(lon0, lon),
		});
		setAreaCorner(null);
		setDrawing(false);
	}

	const genusOptions = useMemo(() => {
		const counts = new Map<string, { label: string; n: number }>();
		for (const b of props) {
			const e = counts.get(b.top_genus) ?? { label: b.top_genus_common, n: 0 };
			e.n++;
			counts.set(b.top_genus, e);
		}
		return [...counts].sort((a, b) => b[1].n - a[1].n).map(([g, e]) => [g, e.label] as [string, string]);
	}, [props]);
	const flaggedByZone = useMemo(() => {
		if (!flagged) return null;
		const counts = new Map<string, number>();
		for (const b of props) if (flagged.has(b.block)) counts.set(b.zone, (counts.get(b.zone) ?? 0) + 1);
		return counts;
	}, [props, flagged]);
	const zoneOptions = useMemo(() => [...new Set(props.map((b) => b.zone))].sort(), [props]);

	const summary = useMemo(() => {
		if (!data) return null;
		const genera = new Map<string, { label: string; n: number }>();
		for (const b of props)
			for (const [g, label, n] of b.genera) {
				const e = genera.get(g) ?? { label, n: 0 };
				e.n += n;
				genera.set(g, e);
			}
		const [topGenus, top] = [...genera].sort((a, b) => b[1].n - a[1].n)[0];
		const total = data.metadata.trees_used;
		return {
			total,
			topGenus,
			topLabel: niceName(top.label),
			topShare: top.n / total,
			flagged: props.filter((b) => b.genus_30pct_plus).length,
			speciesDominant: props.filter((b) => !b.low_count && b.top_species_share >= 0.3).length,
		};
	}, [data, props]);

	function switchTab(next: Mode) {
		setTab(next);
		if (next === "near") setWantTrees(true);
		if (next === "satellite") setWantModis(true);
		if (next === "area") {
			setWantTrees(true);
			setWantModis(true);
		}
		if (next !== "area") {
			setDrawing(false);
			setAreaCorner(null);
		}
	}

	function openBlock(block: string) {
		setTab("blocks");
		setSelected(block);
		setFocusToken((t) => t + 1);
	}

	return (
		<div className="flex h-dvh flex-col bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
			<header className="flex items-center gap-x-3 gap-y-1 border-b border-neutral-200 px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] dark:border-neutral-800">
				<h1
					className={`flex min-w-0 items-center gap-2 text-base font-semibold lg:flex-1 sm:text-lg ${tab === "blocks" || tab === "area" ? "" : "flex-1"}`}
				>
					<TreeDeciduous className="size-6 shrink-0 text-green-700 dark:text-green-500" aria-hidden />
					<span className="sr-only lg:not-sr-only">
						<span className="block truncate">Oak Park street tree diversity</span>
					</span>
				</h1>
				{(tab === "blocks" || tab === "area") && (
					<label className="flex min-w-0 flex-1 items-center gap-2 text-sm lg:flex-none">
						<span className="hidden sm:inline">Color by</span>
						<select
							value={metricKey}
							onChange={(e) => setMetricKey(e.target.value as MetricKey)}
							aria-label="Color blocks by"
							className="h-11 w-full min-w-0 rounded-md border border-neutral-300 bg-white px-2 text-base sm:w-auto dark:border-neutral-700 dark:bg-neutral-900"
						>
							{(["Diversity", "Size and shade"] as const).map((g) => (
								<optgroup key={g} label={g}>
									{METRICS.filter((m) => m.group === g).map((m) => (
										<option key={m.key} value={m.key}>
											{m.label}
										</option>
									))}
								</optgroup>
							))}
						</select>
					</label>
				)}
				<button
					type="button"
					onClick={() => setWelcomeOpen(true)}
					title="How to use this map"
					aria-label="How to use this map"
					className="grid size-11 shrink-0 place-items-center rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800"
				>
					<CircleHelp className="size-5" aria-hidden />
				</button>
				{data && <MajorityMenu value={majority} onChange={setMajority} blocks={props} />}
				<a
					href={`${import.meta.env.BASE_URL}data/${DOWNLOADS[tab].file}`}
					download
					title={DOWNLOADS[tab].label}
					aria-label={DOWNLOADS[tab].label}
					className="grid size-11 place-items-center rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800"
				>
					<Download className="size-5" aria-hidden />
				</a>
			</header>

			<main className="flex min-h-0 flex-1 flex-col md:flex-row [@media(orientation:landscape)_and_(max-height:500px)]:flex-row">
				<div className="h-[42dvh] min-h-48 shrink-0 [@media(orientation:portrait)_and_(max-height:600px)]:h-[30dvh] [@media(orientation:portrait)_and_(max-height:600px)]:min-h-28 md:h-auto md:flex-1 [@media(orientation:landscape)_and_(max-height:500px)]:h-auto [@media(orientation:landscape)_and_(max-height:500px)]:flex-1">
					{data && (
						<MapView
							mode={tab}
							blocks={blocks}
							metric={metric}
							visible={visible}
							flagged={flagged}
							selected={selected}
							focusToken={focusToken}
							onSelect={setSelected}
							zones={zonesData}
							selectedZone={selectedZone}
							onSelectZone={setSelectedZone}
							center={center}
							radiusFt={radiusFt}
							nearby={nearby}
							selectedTree={selectedTree}
							onSelectTree={setSelectedTree}
							modis={modis.data}
							satYearIdx={satYearIdx}
							selectedCell={selectedCell}
							onSelectCell={setSelectedCell}
							areaBounds={areaBounds}
							areaCorner={areaCorner}
							drawing={drawing}
							areaTrees={areaResult?.trees ?? null}
							onAreaClick={areaClick}
							viewToken={viewToken}
							onViewBounds={(b) => {
								setAreaBounds(b);
								setDrawing(false);
								setAreaCorner(null);
							}}
							onMapClick={(lat, lon) => {
								setSelectedTree(null);
								setCenter({ lat, lon, label: "the spot you tapped" });
							}}
						/>
					)}
				</div>

				<aside className="flex min-h-0 flex-1 flex-col border-neutral-200 pb-[env(safe-area-inset-bottom)] md:w-[400px] md:flex-none md:border-l dark:border-neutral-800 [@media(orientation:landscape)_and_(max-height:500px)]:w-[45%] [@media(orientation:landscape)_and_(max-height:500px)]:flex-none">
					<nav
						className="grid shrink-0 grid-cols-5 border-b border-neutral-200 dark:border-neutral-800"
						aria-label="Views"
					>
						{TABS.map(({ key, label, icon: Icon }) => (
							<button
								key={key}
								type="button"
								onClick={() => switchTab(key)}
								aria-current={tab === key ? "page" : undefined}
								className="flex min-h-11 flex-col items-center justify-center gap-0.5 border-b-2 border-transparent px-1 py-1 text-xs text-neutral-600 hover:bg-neutral-100 aria-[current=page]:border-blue-600 aria-[current=page]:font-semibold aria-[current=page]:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:aria-[current=page]:border-blue-400 dark:aria-[current=page]:text-neutral-100"
							>
								<Icon className="size-4 shrink-0" aria-hidden />
								<span className="truncate">{label}</span>
							</button>
						))}
					</nav>

					{flagged && (
						<div className="flex shrink-0 items-center gap-2 border-b border-red-200 bg-red-50 px-3 py-1 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/60 dark:text-red-100">
							<Flag className="size-4 shrink-0" aria-hidden />
							<span className="min-w-0 flex-1">
								Only flagged blocks: {majorityLabel(majority)} ·{" "}
								<strong className="tabular-nums">{flagged.size}</strong>
							</span>
							<button
								type="button"
								onClick={() => setMajority({ ...majority, on: false })}
								className="min-h-11 shrink-0 rounded-md px-2 font-medium underline hover:bg-red-100 dark:hover:bg-red-900/60"
							>
								Turn off
							</button>
						</div>
					)}

					{error && <p className="p-4 text-sm text-red-700 dark:text-red-400">Couldn't load block data: {error}</p>}
					{!data && !error && <p className="p-4 text-sm text-neutral-500">Loading…</p>}

					{data &&
						tab === "blocks" &&
						(current ? (
							<BlockDetail block={current} onBack={() => setSelected(null)} />
						) : (
							<BlockList
								rows={rows}
								metric={metric}
								query={query}
								onQuery={setQuery}
								filters={filters}
								onFilters={setFilters}
								filtersOpen={filtersOpen}
								minTreesLocked={!!flagged}
								onFiltersOpen={setFiltersOpen}
								genusOptions={genusOptions}
								zoneOptions={zoneOptions}
								selected={selected}
								intro={
									summary && (
										<details className="border-b border-neutral-200 px-3 py-2 text-sm dark:border-neutral-800">
											<summary className="flex min-h-11 cursor-pointer items-center gap-2">
												<Info className="size-4 shrink-0" aria-hidden />
												<span>
													{summary.total.toLocaleString()} trees · top genus {summary.topLabel}{" "}
													{(summary.topShare * 100).toFixed(1)}% · <strong>{summary.flagged}</strong> blocks ≥30% one
													genus · <strong>{summary.speciesDominant}</strong> ≥30% one species
												</span>
											</summary>
											<div className="space-y-2 pb-2 text-neutral-700 dark:text-neutral-300">
												<p>{metric.hint}</p>
												<p>
													Foresters' 10-20-30 guideline: no more than 10% of trees from one species, 20% from one genus,
													30% from one family. A pest that targets one genus can strip a block where that genus
													dominates.
												</p>
												<p>
													Blocks with under 10 trees aren't flagged. Canopy is estimated from crown spread. The
													inventory has no tree age or condition data.
												</p>
											</div>
										</details>
									)
								}
								onSelect={(b) => {
									setSelected(b);
									setFocusToken((t) => t + 1);
								}}
							/>
						))}

					{data && tab === "near" && (
						<NearMe
							center={center}
							onCenter={(c) => {
								setSelectedTree(null);
								setCenter(c);
							}}
							radiusFt={radiusFt}
							onRadius={setRadiusFt}
							nearby={nearby}
							treesLoading={!trees.data && !trees.error}
							treesError={trees.error}
							selectedTree={selectedTree}
							onSelectTree={setSelectedTree}
							onOpenBlock={openBlock}
						/>
					)}

					{data &&
						tab === "zones" &&
						(currentZone ? (
							<ZoneDetail
								zone={currentZone}
								onBack={() => setSelectedZone(null)}
								onShowBlocks={() => {
									setFilters({ ...DEFAULT_FILTERS, zone: currentZone.zone });
									setFiltersOpen(true);
									setSelected(null);
									setTab("blocks");
								}}
							/>
						) : (
							<ZoneList
								zones={zones}
								selected={selectedZone}
								onSelect={setSelectedZone}
								flaggedByZone={flaggedByZone}
							/>
						))}
					{data && tab === "satellite" && (
						<Satellite
							data={modis.data}
							error={modis.error}
							yearIdx={satYearIdx}
							onYear={setSatYearIdx}
							selectedCell={selectedCell}
							onSelectCell={setSelectedCell}
						/>
					)}
					{data && tab === "area" && (
						<Area
							drawing={drawing}
							hasFirstCorner={areaCorner != null}
							onDraw={() => {
								setDrawing((d) => !d);
								setAreaCorner(null);
							}}
							onUseView={() => {
								setWantTrees(true);
								setViewToken((t) => t + 1);
							}}
							onClear={() => {
								setAreaBounds(null);
								setAreaCorner(null);
							}}
							result={areaResult}
							loading={areaBounds != null && !trees.data && !trees.error}
							error={trees.error}
							villageCoverPct={
								data.metadata.village_area_sqft
									? (data.metadata.canopy_covered_sqft / data.metadata.village_area_sqft) * 100
									: null
							}
							flagOn={!!flagged}
							onOpenBlock={openBlock}
						/>
					)}
				</aside>
			</main>
			<Welcome
				open={welcomeOpen}
				onClose={() => setWelcomeOpen(false)}
				onStart={() => {
					setWelcomeOpen(false);
					switchTab("area");
					setAreaCorner(null);
					setDrawing(true);
				}}
			/>
		</div>
	);
}
