import { Download, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { activeFilterCount, DEFAULT_FILTERS, downloadCsv, type Filters } from "./filters";
import { binColor, type Metric, niceName } from "./metrics";
import type { BlockProps } from "./types";

type Props = {
	/** Blocks that pass the current filters and search */
	rows: BlockProps[];
	metric: Metric;
	query: string;
	onQuery: (q: string) => void;
	filters: Filters;
	onFilters: (f: Filters) => void;
	filtersOpen: boolean;
	/** The majority flag sets its own tree minimum (and colors small blocks), so this filter is disabled while it's on */
	minTreesLocked?: boolean;
	onFiltersOpen: (open: boolean) => void;
	genusOptions: [string, string][];
	zoneOptions: string[];
	selected: string | null;
	onSelect: (block: string) => void;
	/** Shown above the search box; scrolls away with the list */
	intro?: ReactNode;
};

const SELECT =
	"h-11 w-full rounded-md border border-neutral-300 bg-white px-2 text-base dark:border-neutral-700 dark:bg-neutral-900";

export function BlockList({
	rows,
	metric,
	query,
	onQuery,
	filters,
	onFilters,
	filtersOpen,
	minTreesLocked = false,
	onFiltersOpen,
	genusOptions,
	zoneOptions,
	selected,
	onSelect,
	intro,
}: Props) {
	const ranked = rows
		.map((b) => ({ b, v: metric.value(b) }))
		.sort((x, y) => {
			if (x.v == null) return 1;
			if (y.v == null) return -1;
			return metric.worstFirst === "desc" ? y.v - x.v : x.v - y.v;
		});
	const active = activeFilterCount(filters);
	const set = (patch: Partial<Filters>) => onFilters({ ...filters, ...patch });

	return (
		<div className="min-h-0 flex-1 overflow-y-auto">
			{intro}
			<div className="sticky top-0 z-10 space-y-2 border-b border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
				<div className="flex gap-2">
					<label className="relative block min-w-0 flex-1">
						<span className="sr-only">Search blocks by street</span>
						<Search
							className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-500"
							aria-hidden
						/>
						<input
							type="search"
							value={query}
							onChange={(e) => onQuery(e.target.value)}
							placeholder="Search street"
							className="h-11 w-full rounded-md border border-neutral-300 bg-white pr-3 pl-9 text-base dark:border-neutral-700 dark:bg-neutral-900"
						/>
					</label>
					<button
						type="button"
						onClick={() => onFiltersOpen(!filtersOpen)}
						aria-expanded={filtersOpen}
						aria-controls="block-filters"
						title="Filter blocks"
						className="relative flex h-11 shrink-0 items-center gap-1.5 rounded-md border border-neutral-300 px-3 text-sm hover:bg-neutral-100 aria-expanded:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800 dark:aria-expanded:bg-neutral-800"
					>
						<SlidersHorizontal className="size-4" aria-hidden />
						Filters
						{active > 0 && (
							<span className="grid size-5 place-items-center rounded-full bg-blue-600 text-xs text-white">
								{active}
							</span>
						)}
					</button>
				</div>

				{filtersOpen && (
					<fieldset id="block-filters" className="grid grid-cols-2 gap-x-2 gap-y-2 text-sm">
						<legend className="sr-only">Block filters</legend>
						<label className="space-y-1">
							<span>Top genus share</span>
							<select
								className={SELECT}
								value={filters.minShare}
								onChange={(e) => set({ minShare: Number(e.target.value) })}
							>
								<option value={0}>Any</option>
								<option value={0.2}>20% or more</option>
								<option value={0.3}>30% or more</option>
								<option value={0.4}>40% or more</option>
								<option value={0.5}>50% or more</option>
							</select>
						</label>
						<label className="space-y-1">
							<span>Top species share</span>
							<select
								className={SELECT}
								value={filters.minSpeciesShare}
								onChange={(e) => set({ minSpeciesShare: Number(e.target.value) })}
							>
								<option value={0}>Any</option>
								<option value={0.2}>20% or more</option>
								<option value={0.3}>30% or more</option>
								<option value={0.4}>40% or more</option>
								<option value={0.5}>50% or more</option>
							</select>
						</label>
						<label className="space-y-1">
							<span>Species diversity</span>
							<select
								className={SELECT}
								value={filters.maxSimpson ?? ""}
								onChange={(e) => set({ maxSimpson: e.target.value ? Number(e.target.value) : null })}
							>
								<option value="">Any</option>
								<option value={0.9}>Below 0.90</option>
								<option value={0.85}>Below 0.85</option>
								<option value={0.8}>Below 0.80</option>
								<option value={0.7}>Below 0.70</option>
							</select>
						</label>
						<label className="space-y-1">
							<span>Most common genus</span>
							<select className={SELECT} value={filters.genus} onChange={(e) => set({ genus: e.target.value })}>
								<option value="">Any</option>
								{genusOptions.map(([g, label]) => (
									<option key={g} value={g}>
										{niceName(label)} ({g})
									</option>
								))}
							</select>
						</label>
						<label className="space-y-1">
							<span>D97 school zone</span>
							<select className={SELECT} value={filters.zone} onChange={(e) => set({ zone: e.target.value })}>
								<option value="">Any</option>
								{zoneOptions.map((z) => (
									<option key={z} value={z}>
										{z}
									</option>
								))}
							</select>
						</label>
						<label className="space-y-1">
							<span>Trees on block</span>
							<select
								className={`${SELECT} disabled:opacity-50`}
								disabled={minTreesLocked}
								title={minTreesLocked ? "Set in the Majority menu while the flag is on" : undefined}
								value={filters.minTrees}
								onChange={(e) => set({ minTrees: Number(e.target.value) })}
							>
								<option value={1}>Any number</option>
								<option value={10}>10 or more</option>
								<option value={20}>20 or more</option>
								<option value={40}>40 or more</option>
							</select>
						</label>
						<div className="flex items-end gap-2">
							<button
								type="button"
								onClick={() => onFilters(DEFAULT_FILTERS)}
								disabled={active === 0}
								title="Reset filters"
								className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-md border border-neutral-300 hover:bg-neutral-100 disabled:opacity-40 dark:border-neutral-700 dark:hover:bg-neutral-800"
							>
								<RotateCcw className="size-4" aria-hidden />
								Reset
							</button>
						</div>
					</fieldset>
				)}

				<div className="flex items-center justify-between gap-2 text-sm">
					<span className="text-neutral-600 tabular-nums dark:text-neutral-400" aria-live="polite">
						{rows.length} {rows.length === 1 ? "block" : "blocks"}
					</span>
					<button
						type="button"
						onClick={() => downloadCsv(rows, "oak-park-blocks-filtered.csv")}
						disabled={rows.length === 0}
						className="flex min-h-11 items-center gap-1.5 rounded-md px-2 text-blue-700 hover:bg-neutral-100 disabled:opacity-40 dark:text-blue-400 dark:hover:bg-neutral-800"
					>
						<Download className="size-4" aria-hidden />
						Download these (CSV)
					</button>
				</div>
			</div>
			<ol aria-label={`Blocks ranked by ${metric.label}`}>
				{ranked.map(({ b, v }, i) => (
					<li key={b.block}>
						<button
							type="button"
							onClick={() => onSelect(b.block)}
							aria-current={b.block === selected}
							className="flex min-h-12 w-full items-center gap-3 border-b border-neutral-100 px-3 py-2 text-left hover:bg-neutral-100 focus-visible:bg-neutral-100 aria-[current=true]:bg-blue-50 dark:border-neutral-800/60 dark:hover:bg-neutral-800 dark:focus-visible:bg-neutral-800 dark:aria-[current=true]:bg-blue-950"
						>
							<span className="w-7 shrink-0 text-right text-xs text-neutral-500 tabular-nums dark:text-neutral-400">
								{i + 1}
							</span>
							<span
								className="h-6 w-1.5 shrink-0 rounded-full"
								style={{ background: binColor(metric, b, minTreesLocked) }}
								aria-hidden
							/>
							<span className="min-w-0 flex-1">
								<span className="block truncate font-medium">{b.block}</span>
								<span className="block truncate text-xs text-neutral-600 dark:text-neutral-400">
									{b.trees} {b.trees === 1 ? "tree" : "trees"} · top: {b.top_genus_common.toLowerCase() || b.top_genus}{" "}
									{Math.round(b.top_genus_share * 100)}% · {b.zone}
								</span>
							</span>
							<span className="shrink-0 text-sm font-semibold tabular-nums">{v == null ? "—" : metric.format(v)}</span>
						</button>
					</li>
				))}
				{rows.length === 0 && <li className="p-4 text-sm text-neutral-500">No blocks match these filters.</li>}
			</ol>
		</div>
	);
}
