import { ArrowLeft, ListFilter } from "lucide-react";
import { niceName, zoneColor } from "./metrics";
import type { ZoneProps } from "./types";
import { GenusRow, pct, Stat } from "./ui";

type ListProps = {
	zones: ZoneProps[];
	selected: string | null;
	onSelect: (zone: string) => void;
	/** Majority-flagged blocks per zone, when the flag is on */
	flaggedByZone?: Map<string, number> | null;
};

export function ZoneList({ zones, selected, onSelect, flaggedByZone }: ListProps) {
	const ranked = [...zones].sort(
		(a, b) => (b.share_blocks_genus_30pct_plus ?? 0) - (a.share_blocks_genus_30pct_plus ?? 0),
	);
	const max = Math.max(...zones.map((z) => z.share_blocks_genus_30pct_plus ?? 0), 0.01);
	return (
		<div className="min-h-0 flex-1 overflow-y-auto">
			<p className="border-b border-neutral-200 p-3 text-sm text-neutral-700 dark:border-neutral-800 dark:text-neutral-300">
				D97 elementary attendance zones, ranked by the share of blocks (10+ trees) where one genus is 30% or more of the
				trees.
			</p>
			<ol aria-label="School zones ranked by share of one-genus blocks">
				{ranked.map((z) => {
					const share = z.share_blocks_genus_30pct_plus ?? 0;
					return (
						<li key={z.zone}>
							<button
								type="button"
								onClick={() => onSelect(z.zone)}
								aria-current={z.zone === selected}
								className="w-full border-b border-neutral-100 px-3 py-2.5 text-left hover:bg-neutral-100 aria-[current=true]:bg-blue-50 dark:border-neutral-800/60 dark:hover:bg-neutral-800 dark:aria-[current=true]:bg-blue-950"
							>
								<span className="flex items-baseline justify-between gap-2">
									<span className="flex items-center gap-2 font-medium">
										<span
											className="size-3 shrink-0 rounded-sm"
											style={{ background: zoneColor(z.share_blocks_genus_30pct_plus) }}
											aria-hidden
										/>
										{z.zone}
									</span>
									<span className="text-sm font-semibold tabular-nums">{pct(share)}</span>
								</span>
								<span className="mt-1 block h-2 rounded-full bg-neutral-100 dark:bg-neutral-800">
									<span
										className="block h-2 rounded-full bg-[#2a78d6] dark:bg-[#3987e5]"
										style={{ width: `${(share / max) * 100}%` }}
									/>
								</span>
								<span className="mt-1 block text-xs text-neutral-600 tabular-nums dark:text-neutral-400">
									{z.blocks_genus_30pct_plus} of {z.blocks_10plus_trees} blocks · {z.trees.toLocaleString()} trees ·
									diversity {z.median_block_simpson?.toFixed(2) ?? "—"} (median block)
								</span>
								{flaggedByZone && (
									<span className="mt-1 block text-xs font-medium text-red-800 tabular-nums dark:text-red-300">
										{flaggedByZone.get(z.zone) ?? 0} flagged majority{" "}
										{(flaggedByZone.get(z.zone) ?? 0) === 1 ? "block" : "blocks"}
									</span>
								)}
							</button>
						</li>
					);
				})}
			</ol>
			<p className="p-3 text-xs text-neutral-600 dark:text-neutral-400">
				Each block counts toward the zone holding most of its trees. Trees just outside every zone boundary (border
				streets) are counted in the nearest zone.
			</p>
		</div>
	);
}

type DetailProps = { zone: ZoneProps; onBack: () => void; onShowBlocks: () => void };

export function ZoneDetail({ zone: z, onBack, onShowBlocks }: DetailProps) {
	return (
		<div className="min-h-0 flex-1 overflow-y-auto">
			<div className="sticky top-0 z-10 flex items-center gap-2 border-b border-neutral-200 bg-white p-2 dark:border-neutral-800 dark:bg-neutral-950">
				<button
					type="button"
					onClick={onBack}
					title="Back to zones"
					aria-label="Back to zones"
					className="grid size-11 shrink-0 place-items-center rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800"
				>
					<ArrowLeft className="size-5" aria-hidden />
				</button>
				<h2 className="min-w-0 truncate text-lg font-semibold">{z.zone} zone</h2>
			</div>
			<div className="space-y-5 p-4">
				<dl className="grid grid-cols-3 gap-2 text-center">
					<Stat label="Trees" value={z.trees.toLocaleString()} />
					<Stat label="Species" value={z.species_count} />
					<Stat label="Blocks" value={z.blocks} />
				</dl>

				<dl className="grid grid-cols-2 gap-2">
					<Stat
						label="Blocks ≥30% one genus"
						value={`${z.blocks_genus_30pct_plus} of ${z.blocks_10plus_trees} (${pct(z.share_blocks_genus_30pct_plus ?? 0)})`}
					/>
					<Stat label="Median block diversity" value={z.median_block_simpson?.toFixed(2) ?? "—"} />
					<Stat label="Median trunk diameter" value={z.median_dbh_in == null ? "—" : `${z.median_dbh_in} in`} />
					<Stat
						label="Public-tree canopy"
						value={z.canopy_cover_pct == null ? "—" : `${z.canopy_cover_pct}% of land`}
					/>
				</dl>

				<button
					type="button"
					onClick={onShowBlocks}
					className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-blue-700 px-3 text-sm font-medium text-white hover:bg-blue-800"
				>
					<ListFilter className="size-4" aria-hidden />
					Show this zone's blocks
				</button>

				<section>
					<h3 className="mb-2 text-sm font-semibold">Trees by genus (whole zone)</h3>
					<ul className="space-y-2">
						{z.genera.map(([genus, common, n]) => (
							<GenusRow key={genus} label={niceName(common)} latin={genus} n={n} total={z.trees} />
						))}
					</ul>
					<p className="mt-1.5 flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400">
						<span className="inline-block h-3 border-l-2 border-dashed border-neutral-500" aria-hidden />
						20% guideline for any one genus
					</p>
				</section>
			</div>
		</div>
	);
}
