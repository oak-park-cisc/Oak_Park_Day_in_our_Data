import { X } from "lucide-react";
import { useState } from "react";
import type { Tree } from "../lib/data";
import {
	isFiltered,
	type KindOption,
	NO_FILTER,
	type TreeFilter,
} from "../lib/filter";
import { fmt, speciesCommon } from "../lib/names";
import { Section, TreeList } from "./Panel";

const PRESETS: [string, string, string][] = [
	['Under 6"', "", "5.9"],
	['6–18"', "6", "17.9"],
	['18"+', "18", ""],
	['30"+', "30", ""],
];

const inputClass =
	"min-h-11 w-full min-w-0 rounded-lg border border-neutral-300 bg-white px-3 text-base dark:border-neutral-700 dark:bg-neutral-800";

export function Filters({
	filter,
	setFilter,
	options,
	matches,
	total,
	onPick,
}: {
	filter: TreeFilter;
	setFilter: (f: TreeFilter) => void;
	options: { genera: KindOption[]; species: KindOption[] };
	matches: Tree[];
	total: number;
	onPick: (t: Tree) => void;
}) {
	const [shown, setShown] = useState(20);
	const update = (patch: Partial<TreeFilter>) => {
		setShown(20);
		setFilter({ ...filter, ...patch });
	};
	const largest = isFiltered(filter)
		? [...matches].sort((a, b) => (b.dbh ?? 0) - (a.dbh ?? 0))
		: [];

	return (
		<Section title="Filter trees">
			<label
				htmlFor="kind"
				className="text-sm text-neutral-600 dark:text-neutral-400"
			>
				Kind of tree
			</label>
			<select
				id="kind"
				value={filter.kind}
				onChange={(e) => update({ kind: e.target.value })}
				className={`${inputClass} mt-1`}
			>
				<option value="">All trees</option>
				<optgroup label="Genus (group)">
					{options.genera.map((o) => (
						<option key={o.value} value={o.value}>
							{o.label} · {fmt(o.count)}
						</option>
					))}
				</optgroup>
				<optgroup label="Species">
					{options.species.map((o) => (
						<option key={o.value} value={o.value}>
							{o.label} – {speciesCommon(o.label)} · {fmt(o.count)}
						</option>
					))}
				</optgroup>
			</select>

			<label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3 text-sm">
				<input
					type="checkbox"
					checked={filter.itree}
					onChange={(e) => update({ itree: e.target.checked })}
					className="size-5 accent-blue-700"
				/>
				Only trees with i-Tree Stormwater results (200 largest and smallest)
			</label>

			<fieldset className="mt-3">
				<legend className="text-sm text-neutral-600 dark:text-neutral-400">
					Trunk diameter (inches)
				</legend>
				<div className="mt-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
					<input
						aria-label="Smallest trunk, inches"
						inputMode="decimal"
						placeholder="Min"
						value={filter.min}
						onChange={(e) => update({ min: e.target.value })}
						className={inputClass}
					/>
					<span aria-hidden>to</span>
					<input
						aria-label="Largest trunk, inches"
						inputMode="decimal"
						placeholder="Max"
						value={filter.max}
						onChange={(e) => update({ max: e.target.value })}
						className={inputClass}
					/>
				</div>
				<div className="mt-2 flex flex-wrap gap-2">
					{PRESETS.map(([label, min, max]) => {
						const active = filter.min === min && filter.max === max;
						return (
							<button
								key={label}
								type="button"
								aria-pressed={active}
								onClick={() =>
									update(active ? { min: "", max: "" } : { min, max })
								}
								className="min-h-11 rounded-full border border-neutral-300 px-3 text-sm aria-pressed:border-blue-700 aria-pressed:bg-blue-700 aria-pressed:text-white dark:border-neutral-700"
							>
								{label}
							</button>
						);
					})}
				</div>
				<p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
					For one exact size, enter the same number in both boxes.
				</p>
			</fieldset>

			{filter.area && (
				<p className="mt-3 inline-flex items-center gap-1 rounded-full bg-neutral-100 py-0.5 pl-3 text-sm dark:bg-neutral-800">
					Only{" "}
					{filter.area.type === "zone"
						? `zone ${filter.area.id}`
						: filter.area.id}
					<button
						type="button"
						onClick={() => update({ area: null })}
						aria-label="Show trees everywhere"
						title="Show trees everywhere"
						className="grid size-11 place-items-center rounded-full"
					>
						<X aria-hidden size={16} />
					</button>
				</p>
			)}

			<div className="mt-3 flex items-center justify-between gap-2">
				<p className="text-sm font-medium" aria-live="polite">
					Showing {fmt(matches.length)} of {fmt(total)} trees
				</p>
				{isFiltered(filter) && (
					<button
						type="button"
						onClick={() => update(NO_FILTER)}
						className="min-h-11 rounded-lg px-3 text-sm font-medium text-blue-700 hover:bg-neutral-100 dark:text-blue-300 dark:hover:bg-neutral-800"
					>
						Clear filters
					</button>
				)}
			</div>

			{largest.length > 0 && (
				<>
					<h4 className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
						Matching trees, largest trunk first
					</h4>
					<TreeList trees={largest.slice(0, shown)} onPick={onPick} />
					{largest.length > shown && (
						<button
							type="button"
							onClick={() => setShown(shown + 40)}
							className="mt-1 min-h-11 w-full rounded-lg border border-neutral-300 text-sm font-medium dark:border-neutral-700"
						>
							Show more ({fmt(largest.length - shown)} left)
						</button>
					)}
				</>
			)}
		</Section>
	);
}
