import L from "leaflet";
import { LocateFixed, Search, X } from "lucide-react";
import {
	type FormEvent,
	type ReactNode,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { Filters } from "./components/Filters";
import {
	type ColorBy,
	type Focus,
	MapView,
	type Selection,
	type View,
} from "./components/MapView";
import {
	AreaDetail,
	GenusBars,
	GenusSwatch,
	Section,
	SizeMix,
	StatTiles,
	StatusBadge,
	TreeDetail,
	TreeList,
} from "./components/Panel";
import {
	GENUS_COLORS,
	OTHER_GENUS_COLOR,
	SIZE_COLORS,
	STATUS_COLORS,
} from "./lib/colors";
import {
	type BlocksGeo,
	loadJson,
	loadTrees,
	type Tree,
	type ZonesGeo,
} from "./lib/data";
import { SIZE_LABELS, type SizeGroup } from "./lib/estimates";
import {
	applyFilter,
	isFiltered,
	kindOptions,
	NO_FILTER,
	type TreeFilter,
} from "./lib/filter";
import { genusName, pct } from "./lib/names";
import { searchAddress, treesNear } from "./lib/search";
import {
	groupBy,
	MIN_TREES,
	STATUS_LABELS,
	type Stats,
	type Status,
	summarize,
} from "./lib/stats";
import { streetViewUrl } from "./lib/streetview";

type Data = { trees: Tree[]; blocks: BlocksGeo; zones: ZonesGeo };
type Results = { label: string; trees: Tree[] } | null;

const VIEWS: [View, string][] = [
	["blocks", "Blocks"],
	["zones", "Zones"],
	["trees", "Trees"],
];

const boundsOf = (trees: Tree[]) =>
	L.latLngBounds(trees.map((t) => [t.lat, t.lon]));

export default function App() {
	const [data, setData] = useState<Data | null>(null);
	const [error, setError] = useState("");
	const [view, setView] = useState<View>("blocks");
	const [colorBy, setColorBy] = useState<ColorBy>("genus");
	const [selection, setSelection] = useState<Selection>(null);
	const [query, setQuery] = useState("");
	const [message, setMessage] = useState("");
	const [results, setResults] = useState<Results>(null);
	const [focus, setFocus] = useState<Focus>(null);
	const [filter, setFilter] = useState<TreeFilter>(NO_FILTER);
	const panel = useRef<HTMLDivElement>(null);

	useEffect(() => {
		Promise.all([
			loadTrees(),
			loadJson<BlocksGeo>("/data/blocks.geojson"),
			loadJson<ZonesGeo>("/data/zones.geojson"),
		])
			.then(([trees, blocks, zones]) => setData({ trees, blocks, zones }))
			.catch(() => setError("Could not load the tree data."));
	}, []);

	const stats = useMemo(() => {
		if (!data) return null;
		const byBlock = groupBy(data.trees, (t) => t.block);
		const byZone = groupBy(data.trees, (t) => t.zone);
		return {
			village: summarize(data.trees),
			byBlock,
			byZone,
			blocks: new Map([...byBlock].map(([k, v]) => [k, summarize(v)])),
			zones: new Map([...byZone].map(([k, v]) => [k, summarize(v)])),
		};
	}, [data]);

	const reliant = useMemo(() => {
		if (!stats) return [];
		return [...stats.blocks]
			.filter(([, s]) => s.status === "critical")
			.sort(
				(a, b) => (b[1].topGenus?.share ?? 0) - (a[1].topGenus?.share ?? 0),
			);
	}, [stats]);

	const options = useMemo(
		() => (data ? kindOptions(data.trees) : { genera: [], species: [] }),
		[data],
	);
	const filtered = useMemo(
		() => (data ? applyFilter(data.trees, filter) : []),
		[data, filter],
	);

	const select = (s: Selection, move = false) => {
		setSelection(s);
		panel.current?.scrollTo({ top: 0 });
		if (!move || !s || !stats || !data) return;
		const trees =
			s.type === "block"
				? stats.byBlock.get(s.id)
				: s.type === "zone"
					? stats.byZone.get(s.id)
					: data.trees.filter((t) => t.id === s.id);
		if (trees?.length) setFocus({ bounds: boundsOf(trees), key: Date.now() });
	};

	const showResults = (label: string, trees: Tree[]) => {
		setResults({ label, trees });
		setSelection(null);
		setView("trees");
		setFocus({ bounds: boundsOf(trees), key: Date.now() });
		panel.current?.scrollTo({ top: 0 });
	};

	const onSearch = (e: FormEvent) => {
		e.preventDefault();
		if (!data) return;
		const r = searchAddress(query, data.trees);
		if (r.kind === "error") {
			setMessage(r.message);
			return;
		}
		setMessage("");
		showResults(`Trees near ${r.label}`, r.trees);
	};

	const onLocate = () => {
		if (!data) return;
		if (!navigator.geolocation) {
			setMessage("Location is not available in this browser.");
			return;
		}
		setMessage("Finding your location…");
		navigator.geolocation.getCurrentPosition(
			(pos) => {
				const near = treesNear(
					pos.coords.latitude,
					pos.coords.longitude,
					data.trees,
				);
				if (!near.length) {
					setMessage("No public trees within 150 m. Are you in Oak Park?");
					return;
				}
				setMessage("");
				showResults("Trees near you", near);
			},
			() => setMessage("Location permission was denied."),
		);
	};

	const clearResults = () => {
		setResults(null);
		setQuery("");
		setMessage("");
	};

	if (error) return <p className="p-6">{error}</p>;

	const tree =
		selection?.type === "tree"
			? data?.trees.find((t) => t.id === selection.id)
			: undefined;
	const area =
		selection && selection.type !== "tree" && stats
			? (selection.type === "block" ? stats.blocks : stats.zones).get(
					selection.id,
				)
			: undefined;

	return (
		<div className="flex h-dvh flex-col bg-white text-neutral-900 md:flex-row-reverse dark:bg-neutral-900 dark:text-neutral-100">
			<main className="relative h-[45dvh] min-h-48 shrink-0 md:h-auto md:flex-1">
				{data && stats ? (
					<MapView
						view={view}
						colorBy={colorBy}
						trees={filtered}
						blocks={data.blocks}
						zones={data.zones}
						blockStats={stats.blocks}
						zoneStats={stats.zones}
						selection={selection}
						highlight={results?.trees ?? []}
						focus={focus}
						onSelect={(s) => select(s)}
					/>
				) : (
					<div className="grid h-full place-items-center text-neutral-600 dark:text-neutral-400">
						Loading 18,837 trees…
					</div>
				)}
				<fieldset className="absolute top-2 right-2 z-[1000] flex rounded-lg bg-white p-1 shadow-md dark:bg-neutral-800">
					<legend className="sr-only">Map view</legend>
					{VIEWS.map(([v, label]) => (
						<label
							key={v}
							className="min-h-11 min-w-16 cursor-pointer rounded-md px-3 text-center text-sm leading-[2.75rem] font-medium has-checked:bg-blue-700 has-checked:text-white has-focus-visible:ring-2 has-focus-visible:ring-blue-500"
						>
							<input
								type="radio"
								name="view"
								value={v}
								checked={view === v}
								onChange={() => setView(v)}
								className="sr-only"
							/>
							{label}
						</label>
					))}
				</fieldset>
				{view === "trees" && isFiltered(filter) && (
					<div className="absolute bottom-6 left-2 z-[1000] flex items-center gap-1 rounded-full bg-white py-0.5 pl-3 text-sm font-medium shadow-md dark:bg-neutral-800">
						{filtered.length.toLocaleString("en-US")} trees match filter
						<button
							type="button"
							onClick={() => setFilter(NO_FILTER)}
							aria-label="Clear filters"
							title="Clear filters"
							className="grid size-11 place-items-center rounded-full"
						>
							<X aria-hidden size={16} />
						</button>
					</div>
				)}
			</main>

			<aside className="flex min-h-0 flex-1 flex-col border-neutral-200 md:w-[400px] md:flex-none md:border-r dark:border-neutral-800">
				<header className="border-b border-neutral-200 px-4 pt-3 pb-3 dark:border-neutral-800">
					<h1 className="text-lg font-semibold">
						How resilient is Oak Park's urban forest?
					</h1>
					<search>
						<form onSubmit={onSearch} className="mt-2 flex gap-2">
							<label htmlFor="addr" className="sr-only">
								Address
							</label>
							<input
								id="addr"
								value={query}
								onChange={(e) => setQuery(e.target.value)}
								placeholder="Address, e.g. 1216 N Austin Blvd"
								autoComplete="street-address"
								enterKeyHint="search"
								className="min-h-11 min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-3 text-base dark:border-neutral-700 dark:bg-neutral-800"
							/>
							<button
								type="submit"
								aria-label="Search address"
								title="Search address"
								className="grid size-11 shrink-0 place-items-center rounded-lg bg-blue-700 text-white hover:bg-blue-800"
							>
								<Search aria-hidden size={20} />
							</button>
							<button
								type="button"
								onClick={onLocate}
								aria-label="Trees near my location"
								title="Trees near my location"
								className="grid size-11 shrink-0 place-items-center rounded-lg border border-neutral-300 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
							>
								<LocateFixed aria-hidden size={20} />
							</button>
						</form>
					</search>
					{message && (
						<p
							className="mt-2 text-sm text-neutral-700 dark:text-neutral-300"
							role="status"
						>
							{message}
						</p>
					)}
				</header>

				<div
					ref={panel}
					className="min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]"
				>
					{!data || !stats ? null : tree ? (
						<TreeDetail
							key={tree.id}
							streetViewUrl={streetViewUrl(tree, data.blocks)}
							t={tree}
							onBack={() => setSelection(null)}
							onBlock={() => select({ type: "block", id: tree.block }, true)}
						/>
					) : area && selection ? (
						<AreaDetail
							key={`${selection.type}:${selection.id}`}
							title={
								selection.type === "zone"
									? `Zone ${selection.id}`
									: selection.id
							}
							sub={
								selection.type === "zone"
									? "Grid area, about 0.6 × 0.55 miles"
									: `Zone ${stats.byBlock.get(selection.id)?.[0].zone}`
							}
							s={area}
							village={stats.village}
							trees={
								(selection.type === "block" ? stats.byBlock : stats.byZone).get(
									selection.id,
								) ?? []
							}
							isBlock={selection.type === "block"}
							showingOnly={
								view === "trees" &&
								filter.area?.type === selection.type &&
								filter.area.id === selection.id
							}
							onBack={() => setSelection(null)}
							onShowTrees={() => {
								const only =
									view === "trees" &&
									filter.area?.type === selection.type &&
									filter.area.id === selection.id;
								if (only) {
									setFilter({ ...filter, area: null });
									return;
								}
								const area = {
									type: selection.type as "block" | "zone",
									id: selection.id,
								};
								setFilter({ ...filter, area });
								setView("trees");
								select(selection, true);
							}}
							onPick={(t) => select({ type: "tree", id: t.id }, true)}
						/>
					) : results ? (
						<div>
							<div className="flex items-center justify-between gap-2">
								<h2 className="text-xl font-semibold">{results.label}</h2>
								<button
									type="button"
									onClick={clearResults}
									aria-label="Clear results"
									title="Clear results"
									className="grid size-11 place-items-center rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
								>
									<X aria-hidden size={20} />
								</button>
							</div>
							<p className="mb-2 text-sm text-neutral-600 dark:text-neutral-400">
								{results.trees.length} public trees, closest first
							</p>
							<TreeList
								trees={results.trees}
								onPick={(t) => select({ type: "tree", id: t.id }, true)}
							/>
						</div>
					) : (
						<Overview
							s={stats.village}
							view={view}
							colorBy={colorBy}
							setColorBy={setColorBy}
							reliant={reliant}
							filters={
								view === "trees" ? (
									<Filters
										filter={filter}
										setFilter={setFilter}
										options={options}
										matches={filtered}
										total={data.trees.length}
										onPick={(t) => select({ type: "tree", id: t.id }, true)}
									/>
								) : null
							}
							onPickBlock={(b) => {
								setView("blocks");
								select({ type: "block", id: b }, true);
							}}
						/>
					)}
				</div>
			</aside>
		</div>
	);
}

function Overview(props: {
	s: Stats;
	view: View;
	colorBy: ColorBy;
	setColorBy: (c: ColorBy) => void;
	reliant: [string, Stats][];
	filters: ReactNode;
	onPickBlock: (b: string) => void;
}) {
	const { s, view, colorBy, setColorBy, reliant, filters, onPickBlock } = props;
	return (
		<div>
			<Legend view={view} colorBy={colorBy} setColorBy={setColorBy} />
			{filters}
			<Section title="Village-wide">
				<StatTiles s={s} />
			</Section>
			<GenusBars s={s} />
			<p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
				Foresters suggest no more than 10% of one species and 20% of one genus,
				so a single pest (like emerald ash borer) can't wipe out a street.
			</p>
			<SizeMix s={s} />
			<Section title={`${reliant.length} blocks rely on one genus`}>
				<p className="mb-2 text-sm text-neutral-600 dark:text-neutral-400">
					One genus is 30% or more of trees (blocks with {MIN_TREES}+ trees).
				</p>
				<ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
					{reliant.slice(0, 15).map(([b, bs]) => (
						<li key={b}>
							<button
								type="button"
								onClick={() => onPickBlock(b)}
								className="flex min-h-11 w-full items-center justify-between gap-2 py-1 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
							>
								<span>{b}</span>
								<span className="shrink-0 text-neutral-600 dark:text-neutral-400">
									{bs.topGenus &&
										`${genusName(bs.topGenus.name)} ${pct(bs.topGenus.share)}`}{" "}
									of {bs.count}
								</span>
							</button>
						</li>
					))}
				</ul>
				{reliant.length > 15 && (
					<p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
						Showing the top 15. Red lines on the map show all.
					</p>
				)}
			</Section>
			<p className="mt-5 text-xs text-neutral-600 dark:text-neutral-400">
				Data: Village of Oak Park tree inventory and street centerlines; Cook
				County Assessor addresses. Zones are a simple 5 × 3 grid, not official
				areas.
			</p>
		</div>
	);
}

function Legend({
	view,
	colorBy,
	setColorBy,
}: {
	view: View;
	colorBy: ColorBy;
	setColorBy: (c: ColorBy) => void;
}) {
	if (view !== "trees") {
		const items = (
			view === "zones"
				? ["good", "warning", "critical"]
				: ["good", "warning", "critical", "few"]
		) as Status[];
		return (
			<Section
				title={
					view === "blocks" ? "Blocks: tap a street" : "Zones: tap an area"
				}
			>
				<ul className="space-y-1">
					{items.map((st) => (
						<li key={st} className="flex items-center gap-2">
							<span
								className="h-1.5 w-6 rounded"
								style={{ background: STATUS_COLORS[st] }}
							/>
							<StatusBadge status={st} />
						</li>
					))}
				</ul>
				<p className="sr-only">
					{items.map((st) => STATUS_LABELS[st]).join(", ")}
				</p>
			</Section>
		);
	}
	const items: [string, string][] =
		colorBy === "genus"
			? [
					...GENUS_COLORS.map(
						([g, c]) => [genusName(g), c] as [string, string],
					),
					["Other genera", OTHER_GENUS_COLOR],
				]
			: (Object.keys(SIZE_LABELS) as SizeGroup[]).map((g) => [
					SIZE_LABELS[g],
					SIZE_COLORS[g],
				]);
	return (
		<Section title="Trees: tap a dot">
			<fieldset className="mb-2 inline-flex rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800">
				<legend className="sr-only">Color trees by</legend>
				{(
					[
						["genus", "Genus"],
						["size", "Trunk size"],
					] as [ColorBy, string][]
				).map(([c, label]) => (
					<label
						key={c}
						className="min-h-11 cursor-pointer rounded-md px-3 text-sm leading-[2.75rem] font-medium has-checked:bg-white has-checked:shadow has-focus-visible:ring-2 has-focus-visible:ring-blue-500 dark:has-checked:bg-neutral-700"
					>
						<input
							type="radio"
							name="colorBy"
							value={c}
							checked={colorBy === c}
							onChange={() => setColorBy(c)}
							className="sr-only"
						/>
						{label}
					</label>
				))}
			</fieldset>
			<ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
				{items.map(([label, c]) => (
					<li key={label} className="flex items-center gap-1.5">
						{label === "Other genera" ? (
							<GenusSwatch genus={null} />
						) : (
							<span className="size-3 rounded-full" style={{ background: c }} />
						)}
						{label}
					</li>
				))}
			</ul>
		</Section>
	);
}
