import { AlertTriangle, ArrowLeft, CheckCircle2, Info } from "lucide-react";
import { niceName } from "./metrics";
import type { BlockProps } from "./types";
import { GenusRow, pct, Stat } from "./ui";

type Props = { block: BlockProps; onBack: () => void };

export function BlockDetail({ block: b, onBack }: Props) {
	const top = b.genera.slice(0, 8);
	const otherCount = b.genera.slice(8).reduce((s, g) => s + g[2], 0);

	return (
		<div className="min-h-0 flex-1 overflow-y-auto">
			<div className="sticky top-0 z-10 flex items-center gap-2 border-b border-neutral-200 bg-white p-2 dark:border-neutral-800 dark:bg-neutral-950">
				<button
					type="button"
					onClick={onBack}
					title="Back to ranked list"
					aria-label="Back to ranked list"
					className="grid size-11 shrink-0 place-items-center rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800"
				>
					<ArrowLeft className="size-5" aria-hidden />
				</button>
				<h2 className="min-w-0 truncate text-lg font-semibold">{b.block}</h2>
			</div>

			<div className="space-y-5 p-4">
				<Status b={b} />

				<p className="text-sm">
					Most common species: <strong>{niceName(b.top_species)}</strong>{" "}
					<i className="text-neutral-600 dark:text-neutral-400">{b.top_species_latin}</i>,{" "}
					<strong className="tabular-nums">{pct(b.top_species_share)}</strong> of trees
					{b.low_count ? "." : b.top_species_share > 0.1 ? " (guideline: 10% max)." : ", within the 10% guideline."}
				</p>

				<dl className="grid grid-cols-3 gap-2 text-center">
					<Stat label="Trees" value={b.trees} />
					<Stat label="Species" value={b.species_count} />
					<Stat label="Genera" value={b.genus_count} />
				</dl>

				<section>
					<h3 className="mb-2 text-sm font-semibold">Trees by genus</h3>
					<ul className="space-y-2">
						{top.map(([genus, common, n]) => (
							<GenusRow key={genus} label={niceName(common)} latin={genus} n={n} total={b.trees} />
						))}
						{otherCount > 0 && <GenusRow label="Other genera" n={otherCount} total={b.trees} />}
					</ul>
					<p className="mt-1.5 flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400">
						<span className="inline-block h-3 border-l-2 border-dashed border-neutral-500" aria-hidden />
						20% guideline for any one genus
					</p>
				</section>

				<section>
					<h3 className="mb-2 text-sm font-semibold">Size and shade (medians)</h3>
					<dl className="grid grid-cols-2 gap-2">
						<Stat label="Trunk diameter" value={b.median_dbh_in == null ? "—" : `${b.median_dbh_in} in`} />
						<Stat label="Height" value={b.median_height_ft == null ? "—" : `${b.median_height_ft} ft`} />
						<Stat label="Crown spread" value={b.median_spread_ft == null ? "—" : `${b.median_spread_ft} ft`} />
						<Stat label="Ground under crowns" value={`${b.canopy_covered_sqft.toLocaleString()} sq ft`} />
					</dl>
					<p className="mt-1.5 text-xs text-neutral-600 dark:text-neutral-400">
						Canopy estimate: each crown as a circle of its recorded spread, overlaps counted once (
						{b.canopy_sqft.toLocaleString()} sq ft if added up).
					</p>
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
							{b.species.map(([common, latin, n]) => (
								<tr key={latin} className="border-b border-neutral-100 dark:border-neutral-800">
									<td className="py-1.5 pr-2">
										{niceName(common)}
										<span className="block text-xs text-neutral-500 italic dark:text-neutral-400">{latin}</span>
									</td>
									<td className="py-1.5 text-right tabular-nums">
										{n} <span className="text-neutral-500 dark:text-neutral-400">({pct(n / b.trees)})</span>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</section>

				{!b.on_map && (
					<p className="flex gap-2 text-xs text-neutral-600 dark:text-neutral-400">
						<Info className="size-4 shrink-0" aria-hidden /> This block has no matching street segment, so it isn't
						drawn on the map.
					</p>
				)}
			</div>
		</div>
	);
}

function Status({ b }: { b: BlockProps }) {
	const genus = `${niceName(b.top_genus_common)} (${b.top_genus})`;
	if (b.low_count) {
		return (
			<p className="flex gap-2 rounded-md bg-neutral-100 p-3 text-sm dark:bg-neutral-900">
				<Info className="size-5 shrink-0" aria-hidden />
				Only {b.trees} trees — too few to judge diversity.
			</p>
		);
	}
	if (b.genus_over_20pct) {
		return (
			<p className="flex gap-2 rounded-md bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950/60 dark:text-red-100">
				<AlertTriangle className="size-5 shrink-0 text-red-700 dark:text-red-400" aria-label="Warning" />
				<span>
					<strong>{pct(b.top_genus_share)}</strong> of trees are {genus}
					{b.genus_30pct_plus ? " — well over" : ", above"} the 20% guideline for one genus.
				</span>
			</p>
		);
	}
	return (
		<p className="flex gap-2 rounded-md bg-green-50 p-3 text-sm text-green-900 dark:bg-green-950/60 dark:text-green-100">
			<CheckCircle2 className="size-5 shrink-0 text-green-700 dark:text-green-400" aria-label="OK" />
			<span>
				No genus is over 20%. Largest: {genus} at {pct(b.top_genus_share)}.
			</span>
		</p>
	);
}
