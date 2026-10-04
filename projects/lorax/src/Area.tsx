import { AlertTriangle, CheckCircle2, Download, Maximize, SquareDashedMousePointer, X } from "lucide-react";
import { type AreaResult, downloadAreaTrees } from "./area";
import { niceName } from "./metrics";
import { GenusRow, pct, Stat } from "./ui";

type Props = {
	drawing: boolean;
	/** True after the first corner has been placed */
	hasFirstCorner: boolean;
	onDraw: () => void;
	onUseView: () => void;
	onClear: () => void;
	result: AreaResult | null;
	loading: boolean;
	error: string | null;
	/** Village-wide canopy cover %, for comparison */
	villageCoverPct: number | null;
	flagOn: boolean;
	onOpenBlock: (block: string) => void;
};

const sqft = (v: number) => `${Math.round(v).toLocaleString()} sq ft`;
const acres = (v: number) => `${(v / 43_560).toFixed(v < 435_600 ? 2 : 1)} acres`;
const perAcre = (n: number, areaSqft: number) => {
	const v = n / (areaSqft / 43_560);
	return v < 1 ? v.toFixed(2) : v.toFixed(1);
};
const fmt = (v: number | null, unit: string) => (v == null ? "—" : `${v} ${unit}`);

export function Area({
	drawing,
	hasFirstCorner,
	onDraw,
	onUseView,
	onClear,
	result: r,
	loading,
	error,
	villageCoverPct,
	flagOn,
	onOpenBlock,
}: Props) {
	const n = r?.trees.length ?? 0;
	const otherGenera = r ? r.genera.slice(8).reduce((s, g) => s + g[2], 0) : 0;
	const maxClass = r ? Math.max(1, ...r.dbhClasses.map((c) => c.n)) : 1;

	return (
		<div className="min-h-0 flex-1 overflow-y-auto">
			<div className="sticky top-0 z-10 space-y-2 border-b border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
				<div className="flex gap-2">
					<button
						type="button"
						onClick={onDraw}
						aria-pressed={drawing}
						className="flex h-11 flex-1 items-center justify-center gap-2 rounded-md bg-blue-700 px-3 text-sm font-medium text-white hover:bg-blue-800 aria-pressed:bg-blue-900"
					>
						<SquareDashedMousePointer className="size-4" aria-hidden />
						{drawing ? "Drawing…" : "Draw rectangle"}
					</button>
					<button
						type="button"
						onClick={onUseView}
						title="Use the area visible on the map"
						className="flex h-11 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
					>
						<Maximize className="size-4" aria-hidden />
						Map view
					</button>
					{r && (
						<button
							type="button"
							onClick={onClear}
							title="Clear area"
							aria-label="Clear area"
							className="grid size-11 shrink-0 place-items-center rounded-md border border-neutral-300 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
						>
							<X className="size-4" aria-hidden />
						</button>
					)}
				</div>
				{r && n > 0 && (
					<button
						type="button"
						onClick={() => downloadAreaTrees(r)}
						className="flex h-11 w-full items-center justify-center gap-2 rounded-md border border-neutral-300 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
					>
						<Download className="size-4" aria-hidden />
						Download these {n.toLocaleString()} trees (CSV)
					</button>
				)}
				<p className="text-sm text-neutral-600 dark:text-neutral-400" aria-live="polite">
					{drawing
						? hasFirstCorner
							? "Now tap the opposite corner."
							: "Tap one corner of the area on the map."
						: r
							? `${acres(r.areaSqft)} selected${flagOn ? " · flagged blocks only" : ""}.`
							: "Draw a rectangle on the map, or use the current map view."}
				</p>
			</div>

			{loading && <p className="p-4 text-sm text-neutral-500">Loading trees…</p>}
			{error && <p className="p-4 text-sm text-red-700 dark:text-red-400">Couldn't load trees: {error}</p>}

			{r && n === 0 && (
				<p className="p-4 text-sm text-neutral-600 dark:text-neutral-400">No public trees are recorded in this area.</p>
			)}

			{r && n > 0 && (
				<div className="space-y-5 p-4">
					<dl className="grid grid-cols-3 gap-2 text-center">
						<Stat label="Trees" value={n.toLocaleString()} />
						<Stat label="Species" value={r.speciesCount} />
						<Stat label="Per acre" value={perAcre(n, r.areaSqft)} />
					</dl>

					<section className="space-y-2">
						<h3 className="text-sm font-semibold">Canopy estimate from recorded crown spread</h3>
						<dl className="grid grid-cols-2 gap-2">
							<Stat label="Ground under crowns" value={sqft(r.canopy.coveredSqft)} />
							<Stat
								label="Share of this area"
								value={`${r.canopy.coverPct.toFixed(1)}%${villageCoverPct != null ? ` (village ${villageCoverPct.toFixed(1)}%)` : ""}`}
							/>
							<Stat label="Crowns added up" value={sqft(r.canopy.crownSumSqft)} />
							<Stat
								label="Satellite tree cover"
								value={
									r.satellite?.meanCover != null
										? `${r.satellite.meanCover}% (${r.satellite.cells} cells)`
										: r.satellite
											? "Area too small"
											: "—"
								}
							/>
						</dl>
						<p className="text-xs text-neutral-600 dark:text-neutral-400">
							Each crown is a circle as wide as its recorded spread. "Ground under crowns" counts overlapping crowns
							once; "crowns added up" counts them twice. Only public trees are in the inventory, while the satellite
							(2021–2025 average, 250 m cells) sees private trees too.
						</p>
					</section>

					<section className="space-y-2">
						<h3 className="text-sm font-semibold">Diversity</h3>
						<Check
							ok={(r.topSpecies?.share ?? 0) <= 0.1}
							text={`Most common species: ${niceName(r.topSpecies?.common ?? "")} (${r.topSpecies?.latin}), ${pct(r.topSpecies?.share ?? 0)} of trees — guideline 10% max.`}
						/>
						<Check
							ok={r.genera[0][2] / n <= 0.2}
							text={`Most common genus: ${niceName(r.genera[0][1])} (${r.genera[0][0]}), ${pct(r.genera[0][2] / n)} — guideline 20% max.`}
						/>
						<p className="text-sm">
							Species diversity: <strong className="tabular-nums">{r.simpson?.toFixed(2)}</strong>{" "}
							<span className="text-neutral-600 dark:text-neutral-400">
								(chance two trees are different species) · {r.genusCount} genera
							</span>
						</p>
						{n < 10 && (
							<p className="text-xs text-neutral-600 dark:text-neutral-400">
								Fewer than 10 trees, so shares are rough.
							</p>
						)}
					</section>

					<section>
						<h3 className="mb-2 text-sm font-semibold">Trees by genus</h3>
						<ul className="space-y-2">
							{r.genera.slice(0, 8).map(([g, label, c]) => (
								<GenusRow key={g} label={niceName(label)} latin={g} n={c} total={n} />
							))}
							{otherGenera > 0 && <GenusRow label="Other genera" n={otherGenera} total={n} />}
						</ul>
					</section>

					<section className="space-y-2">
						<h3 className="text-sm font-semibold">Size and shade (medians)</h3>
						<dl className="grid grid-cols-3 gap-2 text-center">
							<Stat label="Trunk diameter" value={fmt(r.medians.dbh, "in")} />
							<Stat label="Height" value={fmt(r.medians.height, "ft")} />
							<Stat label="Crown spread" value={fmt(r.medians.spread, "ft")} />
						</dl>
						<figure>
							<figcaption className="mb-1 text-xs text-neutral-600 dark:text-neutral-400">
								Trees by trunk diameter (DBH)
							</figcaption>
							<ul className="space-y-1">
								{r.dbhClasses.map((c) => (
									<li key={c.label} className="flex items-center gap-2 text-xs tabular-nums">
										<span className="w-16 shrink-0">{c.label}</span>
										<span className="h-3 flex-1 rounded-sm bg-neutral-100 dark:bg-neutral-800">
											<span
												className="block h-3 rounded-sm bg-[#2a78d6] dark:bg-[#3987e5]"
												style={{ width: `${(c.n / maxClass) * 100}%` }}
											/>
										</span>
										<span className="w-10 shrink-0 text-right">{c.n}</span>
									</li>
								))}
							</ul>
						</figure>
					</section>

					<section>
						<h3 className="mb-2 text-sm font-semibold">
							Blocks in this area ({r.blocks.length}) · {r.zones.map((z) => z.zone).join(", ")}
						</h3>
						<ul className="divide-y divide-neutral-100 text-sm dark:divide-neutral-800">
							{[...r.blocks]
								// Blocks with too few trees to judge go last.
								.sort((a, b) => Number(a.low_count) - Number(b.low_count) || b.top_species_share - a.top_species_share)
								.slice(0, 40)
								.map((b) => (
									<li key={b.block}>
										<button
											type="button"
											onClick={() => onOpenBlock(b.block)}
											className="flex min-h-11 w-full items-center justify-between gap-2 py-1 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800"
										>
											<span className="min-w-0">
												<span className="block truncate">{b.block}</span>
												<span className="block truncate text-xs text-neutral-600 dark:text-neutral-400">
													{b.trees} {b.trees === 1 ? "tree" : "trees"} · top species{" "}
													{niceName(b.top_species).toLowerCase()}
												</span>
											</span>
											<span className="shrink-0 tabular-nums">{pct(b.top_species_share)}</span>
										</button>
									</li>
								))}
						</ul>
						{r.blocks.length > 40 && <p className="mt-1 text-xs text-neutral-500">Showing 40 most dominated.</p>}
					</section>

					<section>
						<h3 className="mb-2 text-sm font-semibold">All species</h3>
						<table className="w-full text-sm">
							<thead className="sr-only">
								<tr>
									<th>Species</th>
									<th>Trees</th>
								</tr>
							</thead>
							<tbody>
								{r.species.map(([common, latin, c]) => (
									<tr key={latin} className="border-b border-neutral-100 dark:border-neutral-800">
										<td className="py-1.5 pr-2">
											{niceName(common)}
											<span className="block text-xs text-neutral-500 italic dark:text-neutral-400">{latin}</span>
										</td>
										<td className="py-1.5 text-right tabular-nums">
											{c} <span className="text-neutral-500 dark:text-neutral-400">({pct(c / n)})</span>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</section>
				</div>
			)}
		</div>
	);
}

function Check({ ok, text }: { ok: boolean; text: string }) {
	return (
		<p
			className={`flex gap-2 rounded-md p-2.5 text-sm ${ok ? "bg-green-50 text-green-900 dark:bg-green-950/60 dark:text-green-100" : "bg-red-50 text-red-900 dark:bg-red-950/60 dark:text-red-100"}`}
		>
			{ok ? (
				<CheckCircle2 className="size-5 shrink-0 text-green-700 dark:text-green-400" aria-label="Within guideline" />
			) : (
				<AlertTriangle className="size-5 shrink-0 text-red-700 dark:text-red-400" aria-label="Above guideline" />
			)}
			<span>{text}</span>
		</p>
	);
}
