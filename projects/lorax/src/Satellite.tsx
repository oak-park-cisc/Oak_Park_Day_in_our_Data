import { ArrowLeft, Info } from "lucide-react";
import { LineChart } from "./LineChart";
import { cellValue } from "./metrics";
import type { ModisData } from "./types";
import { Stat } from "./ui";

type Props = {
	data: ModisData | null;
	error: string | null;
	/** Index into metadata.years, or null for the recent average */
	yearIdx: number | null;
	onYear: (idx: number | null) => void;
	selectedCell: string | null;
	onSelectCell: (id: string | null) => void;
};

const BLUE = "#2a78d6";
const GRAY = "#898781";

export function Satellite({ data, error, yearIdx, onYear, selectedCell, onSelectCell }: Props) {
	if (error) return <p className="p-4 text-sm text-red-700 dark:text-red-400">Couldn't load satellite data: {error}</p>;
	if (!data) return <p className="p-4 text-sm text-neutral-500">Loading…</p>;

	const { years, recent_years, village_mean } = data.metadata;
	const recentLabel = `${recent_years[0]}–${recent_years.at(-1)} average`;
	const periodLabel = yearIdx == null ? recentLabel : String(years[yearIdx]);
	const cell = data.features.find((f) => f.properties.id === selectedCell)?.properties ?? null;
	const villageNow =
		yearIdx == null
			? Math.round((village_mean.slice(-recent_years.length).reduce((a, b) => a + b, 0) / recent_years.length) * 10) /
				10
			: village_mean[yearIdx];

	const yearSelect = (
		<label className="flex items-center gap-2 text-sm">
			Show
			<select
				value={yearIdx ?? ""}
				onChange={(e) => onYear(e.target.value === "" ? null : Number(e.target.value))}
				className="h-11 min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-2 text-base dark:border-neutral-700 dark:bg-neutral-900"
			>
				<option value="">{recentLabel}</option>
				{years.map((y, i) => (
					<option key={y} value={i}>
						{y} only
					</option>
				))}
			</select>
		</label>
	);

	if (cell) {
		const value = cellValue(cell.cover, cell.recent_mean, yearIdx);
		return (
			<div className="min-h-0 flex-1 overflow-y-auto">
				<div className="sticky top-0 z-10 flex items-center gap-2 border-b border-neutral-200 bg-white p-2 dark:border-neutral-800 dark:bg-neutral-950">
					<button
						type="button"
						onClick={() => onSelectCell(null)}
						title="Back to village view"
						aria-label="Back to village view"
						className="grid size-11 shrink-0 place-items-center rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800"
					>
						<ArrowLeft className="size-5" aria-hidden />
					</button>
					<h2 className="min-w-0 truncate text-lg font-semibold">Satellite cell</h2>
				</div>
				<div className="space-y-4 p-4">
					{yearSelect}
					<dl className="grid grid-cols-2 gap-2">
						<Stat label={`Tree cover, ${periodLabel}`} value={value == null ? "—" : `${value}%`} />
						<Stat label="Village average" value={`${villageNow}%`} />
						<Stat label="Public trees recorded" value={cell.inventory_trees} />
						<Stat label="Their crown area (est.)" value={`${cell.inventory_canopy_pct}% of cell`} />
					</dl>
					<p className="text-xs text-neutral-600 dark:text-neutral-400">
						The satellite sees every tree, public and private. The inventory only lists public trees, mostly in
						parkways, so its crown area is usually lower.
					</p>
					<LineChart
						title="Tree cover in this cell by year"
						years={years}
						highlight={yearIdx == null ? null : years[yearIdx]}
						series={[
							{ label: "This cell", values: cell.cover, color: BLUE },
							{ label: "Village average", values: village_mean, color: GRAY, dashed: true },
						]}
					/>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-0 flex-1 overflow-y-auto">
			<div className="space-y-3 p-3">
				<p className="text-sm text-neutral-700 dark:text-neutral-300">
					NASA MODIS satellite estimate of tree cover, public and private, in {data.features.length} cells of about{" "}
					{Math.round(data.metadata.cell_size_m)} m. Tap a cell to compare it with the tree inventory.
				</p>
				{yearSelect}
				<p className="text-sm">
					Village average tree cover ({periodLabel}): <strong className="tabular-nums">{villageNow}%</strong>
				</p>
				<LineChart
					title="Village average tree cover by year"
					years={years}
					highlight={yearIdx == null ? null : years[yearIdx]}
					series={[{ label: "Village average", values: village_mean, color: BLUE }]}
				/>
				<p className="flex gap-2 rounded-md bg-neutral-100 p-3 text-xs text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
					<Info className="size-4 shrink-0" aria-hidden />
					<span>
						Year-to-year swings are mostly measurement noise, not real canopy gain or loss, so the map defaults to a
						5-year average. At 250 m a cell spans several blocks, and MODIS tends to undercount tree cover in cities.
						Data: MOD44B Collection 6.1 (the successor to version 6.0, doi:10.5067/MODIS/MOD44B.006), via the ORNL DAAC
						MODIS web service.
					</span>
				</p>
			</div>
		</div>
	);
}
