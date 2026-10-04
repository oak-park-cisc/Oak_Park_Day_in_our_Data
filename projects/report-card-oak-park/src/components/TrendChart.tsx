import { Info, Table2 } from "lucide-react";
import { useState } from "react";
import {
	CartesianGrid,
	Line,
	LineChart,
	ReferenceArea,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { type Entity, format, type Indicator, value, yearLabel } from "../data";
import { useTheme } from "../theme";
import { type Series, shortName } from "./DistrictPicker";

type Props = {
	ind: Indicator;
	series: Series[];
	state?: Entity;
	years: number[];
	height?: number;
	compact?: boolean;
};

const NEW = "__new";

type TipProps = {
	active?: boolean;
	label?: string | number;
	payload?: readonly { payload?: unknown }[];
};

export function TrendChart({ ind, series, state, years, height = 260, compact = false }: Props) {
	const t = useTheme();
	const [table, setTable] = useState(false);
	const lines = [
		...series.map((s) => ({
			id: s.id,
			name: s.name,
			color: s.color,
			entity: s.entity,
			dash: false,
		})),
	];
	if (state && ind.unit !== "count")
		lines.push({
			id: state.id,
			name: "Illinois average",
			color: t.stateLine,
			entity: state,
			dash: true,
		});

	const rows = years.map((year, i) => {
		const row: Record<string, number | null> = { year };
		for (const l of lines) {
			const v = value(l.entity, ind.key, i);
			if (ind.testBreak && year >= 2025) row[l.id + NEW] = v;
			else row[l.id] = v;
		}
		return row;
	});
	const hasAny = rows.some((r) => lines.some((l) => r[l.id] != null || r[l.id + NEW] != null));

	return (
		<figure className="flex min-w-0 flex-col gap-2">
			<figcaption className="flex items-start justify-between gap-2">
				<div className="min-w-0">
					<h3 className={`font-semibold ${compact ? "text-base" : "text-lg"}`}>{ind.label}</h3>
					<p className="text-xs text-muted dark:text-muted-dark">
						{ind.lag && "Spending is from the fiscal year before each report card. "}
						{ind.testBreak &&
							"2020: no tests. 2025 used a new test scale; don't compare it with earlier years. "}
						{state && ind.unit === "count" && "Illinois total not shown. "}
						{ind.note}
					</p>
				</div>
				<button
					type="button"
					onClick={() => setTable((v) => !v)}
					aria-pressed={table}
					aria-label={table ? "Show chart" : "Show table"}
					title={table ? "Show chart" : "Show table"}
					className="flex size-11 shrink-0 items-center justify-center rounded-lg text-ink-2 hover:bg-line aria-pressed:bg-line dark:text-ink-2-dark dark:hover:bg-line-dark dark:aria-pressed:bg-line-dark"
				>
					<Table2 size={18} />
				</button>
			</figcaption>

			{!hasAny ? (
				<p
					className="flex items-center gap-2 py-8 text-sm text-muted dark:text-muted-dark"
					style={{ minHeight: height }}
				>
					<Info size={16} aria-hidden /> No data for the selected districts.
				</p>
			) : table ? (
				<DataTable ind={ind} lines={lines} years={years} height={height} />
			) : (
				<>
					<Legend lines={lines} />
					<div style={{ height }} className="-ml-2">
						<ResponsiveContainer width="100%" height="100%">
							<LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
								<CartesianGrid stroke={t.grid} vertical={false} />
								{ind.testBreak && (
									<ReferenceArea
										x1={2024.5}
										x2={2025.5}
										fill={t.band}
										fillOpacity={1}
										stroke="none"
										label={{
											value: "New test",
											position: "insideTop",
											fill: t.muted,
											fontSize: 11,
										}}
									/>
								)}
								<XAxis
									dataKey="year"
									type="number"
									domain={[years[0] - 0.4, years[years.length - 1] + 0.4]}
									ticks={years}
									tickFormatter={(y: number) => (compact ? `'${String(y).slice(2)}` : String(y))}
									tick={{ fill: t.muted, fontSize: 12 }}
									stroke={t.axis}
									tickLine={false}
									interval={0}
								/>
								<YAxis
									tick={{ fill: t.muted, fontSize: 12 }}
									tickFormatter={(v: number) => format(v, ind.unit, true).replace(/\.0(%|K)/, "$1")}
									stroke="none"
									width={ind.unit === "usd" ? 52 : 44}
									domain={ind.unit === "pct" || ind.unit === "pts" ? [0, "auto"] : ["auto", "auto"]}
									allowDecimals={false}
								/>
								<Tooltip
									content={(p) => <TrendTooltip {...p} ind={ind} lines={lines} />}
									cursor={{ stroke: t.axis, strokeWidth: 1 }}
									isAnimationActive={false}
								/>
								{lines.map((l) => (
									<Line
										key={l.id}
										dataKey={l.id}
										name={l.name}
										stroke={l.color}
										strokeWidth={2}
										strokeDasharray={l.dash ? "5 4" : undefined}
										dot={{
											r: 3,
											fill: l.color,
											stroke: t.surface,
											strokeWidth: 1.5,
										}}
										activeDot={{ r: 5, stroke: t.surface, strokeWidth: 2 }}
										connectNulls={false}
										isAnimationActive={false}
									/>
								))}
								{ind.testBreak &&
									lines.map((l) => (
										<Line
											key={l.id + NEW}
											dataKey={l.id + NEW}
											name={l.name}
											stroke="none"
											legendType="none"
											dot={{
												r: 4,
												fill: l.color,
												stroke: t.surface,
												strokeWidth: 2,
											}}
											activeDot={{ r: 5, stroke: t.surface, strokeWidth: 2 }}
											isAnimationActive={false}
										/>
									))}
							</LineChart>
						</ResponsiveContainer>
					</div>
				</>
			)}
		</figure>
	);
}

type Line_ = {
	id: string;
	name: string;
	color: string;
	entity: Entity;
	dash: boolean;
};

function Legend({ lines }: { lines: Line_[] }) {
	return (
		<ul
			className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-2 dark:text-ink-2-dark"
			aria-label="Legend"
		>
			{lines.map((l) => (
				<li key={l.id} className="flex items-center gap-1.5">
					<svg width="16" height="4" aria-hidden>
						<line
							x1="0"
							y1="2"
							x2="16"
							y2="2"
							stroke={l.color}
							strokeWidth={3}
							strokeDasharray={l.dash ? "4 3" : undefined}
						/>
					</svg>
					{shortName(l.name)}
				</li>
			))}
		</ul>
	);
}

function TrendTooltip({ active, label, payload, ind, lines }: TipProps & { ind: Indicator; lines: Line_[] }) {
	if (!active || !payload?.length) return null;
	const row = payload[0].payload as Record<string, number | null>;
	const items = lines
		.map((l) => ({ ...l, v: row[l.id] ?? row[l.id + NEW] ?? null }))
		.sort((a, b) => (b.v ?? Number.NEGATIVE_INFINITY) - (a.v ?? Number.NEGATIVE_INFINITY));
	return (
		<div className="rounded-lg border border-line bg-card px-3 py-2 text-sm shadow-md dark:border-line-dark dark:bg-card-dark">
			<p className="mb-1 text-xs text-muted dark:text-muted-dark">{yearLabel(Number(label), ind)}</p>
			<ul className="tabular flex flex-col gap-0.5">
				{items.map((l) => (
					<li key={l.id} className="flex items-center gap-2">
						<svg width="12" height="4" aria-hidden>
							<line
								x1="0"
								y1="2"
								x2="12"
								y2="2"
								stroke={l.color}
								strokeWidth={3}
								strokeDasharray={l.dash ? "3 2" : undefined}
							/>
						</svg>
						<span className="font-semibold">{format(l.v, ind.unit)}</span>
						<span className="text-ink-2 dark:text-ink-2-dark">{shortName(l.name)}</span>
					</li>
				))}
			</ul>
		</div>
	);
}

function DataTable({
	ind,
	lines,
	years,
	height,
}: {
	ind: Indicator;
	lines: Line_[];
	years: number[];
	height: number;
}) {
	return (
		<section
			// biome-ignore lint/a11y/noNoninteractiveTabindex: scrollable tables must be keyboard-focusable (WCAG 2.1.1)
			tabIndex={0}
			aria-label={`${ind.label} table`}
			className="overflow-auto rounded-lg border border-line dark:border-line-dark"
			style={{ maxHeight: height + 24 }}
		>
			<table className="tabular w-full text-sm">
				<caption className="sr-only">{ind.label} by year</caption>
				<thead className="sticky top-0 bg-card dark:bg-card-dark">
					<tr>
						<th scope="col" className="px-2 py-1.5 text-left font-medium">
							District
						</th>
						{years.map((y) => (
							<th key={y} scope="col" className="px-2 py-1.5 text-right font-medium whitespace-nowrap">
								{ind.lag ? `FY$String(y - 1).slice(2)` : y}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{lines.map((l) => (
						<tr key={l.id} className="border-t border-line dark:border-line-dark">
							<th scope="row" className="px-2 py-1.5 text-left font-normal whitespace-nowrap">
								{shortName(l.name)}
							</th>
							{years.map((y, i) => (
								<td key={y} className="px-2 py-1.5 text-right whitespace-nowrap">
									{format(value(l.entity, ind.key, i), ind.unit)}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</section>
	);
}
