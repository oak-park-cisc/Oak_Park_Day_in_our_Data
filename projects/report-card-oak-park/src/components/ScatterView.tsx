import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import {
	CartesianGrid,
	ReferenceLine,
	ResponsiveContainer,
	Scatter,
	ScatterChart,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { type Entity, format, INDICATOR_BY_KEY, type Indicator, typeLabel, value } from "../data";
import { useTheme } from "../theme";
import { type Series, shortName } from "./DistrictPicker";
import { Select } from "./Select";

export type ScatterSettings = {
	x: string;
	y: string;
	area: string;
	type: string;
	year: number;
};

const X_KEYS = [
	"operating_per_pupil",
	"instructional_per_pupil",
	"pct_low_income",
	"tax_rate",
	"local_tax_per_pupil",
	"eav_per_pupil",
	"teacher_salary",
];
const Y_KEYS = [
	"ela_prof",
	"math_prof",
	"science_prof",
	"grad_rate_4yr",
	"chronic_absenteeism",
	"ela_prof_low_income",
];
const COLLAR = ["Cook", "DuPage", "Kane", "Lake", "McHenry", "Will"];
const AREAS = [
	{ value: "cook", label: "Cook County" },
	{ value: "metro", label: "Chicago area (6 counties)" },
	{ value: "all", label: "All Illinois" },
];
const TYPES = [
	{ value: "elementary", label: "Elementary districts" },
	{ value: "high", label: "High school districts" },
	{ value: "unit", label: "Unit (K–12) districts" },
];

type TipProps = { active?: boolean; payload?: readonly { payload?: unknown }[] };

type Point = {
	id: string;
	name: string;
	x: number;
	y: number;
	li: number | null;
	entity: Entity;
	color?: string;
};

type Props = {
	all: Entity[];
	years: number[];
	series: Series[];
	settings: ScatterSettings;
	onChange: (s: ScatterSettings) => void;
	onAdd: (id: string) => void;
	canAdd: boolean;
};

export function ScatterView({ all, years, series, settings, onChange, onAdd, canAdd }: Props) {
	const t = useTheme();
	const [picked, setPicked] = useState<Point | null>(null);
	const xi = INDICATOR_BY_KEY[settings.x];
	const yi = INDICATOR_BY_KEY[settings.y];
	// "Low-income students" on the x-axis means the share of students who are low-income.
	const xName = xi.key === "pct_low_income" ? "share of low-income students" : xi.label.toLowerCase();
	const idx = years.indexOf(settings.year);
	const colorOf = new Map(series.map((s) => [s.id, s.color]));

	const points = useMemo(() => {
		const out: Point[] = [];
		for (const e of all) {
			if (e.type !== settings.type) continue;
			if (settings.area === "cook" && e.county !== "Cook") continue;
			if (settings.area === "metro" && !COLLAR.includes(e.county)) continue;
			const x = value(e, settings.x, idx);
			const y = value(e, settings.y, idx);
			if (x == null || y == null) continue;
			out.push({
				id: e.id,
				name: e.name,
				x,
				y,
				li: value(e, "pct_low_income", idx),
				entity: e,
			});
		}
		return out;
	}, [all, settings, idx]);

	const others = points.filter((p) => !colorOf.has(p.id));
	const highlighted = series.flatMap((s) => {
		const p = points.find((q) => q.id === s.id);
		return p ? [{ ...p, color: s.color }] : [];
	});
	const missing = series.filter((s) => s.entity.type === settings.type && !points.some((p) => p.id === s.id));
	// Even percentage ticks: steps of 10 (20 above 60%), starting at zero.
	const yTicks = useMemo(() => {
		if (yi.unit !== "pct" || points.length === 0) return undefined;
		const top = Math.min(100, Math.ceil(Math.max(...points.map((p) => p.y)) / 10) * 10);
		const step = top > 60 ? 20 : 10;
		const max = Math.ceil(top / step) * step;
		return Array.from({ length: max / step + 1 }, (_, i) => i * step);
	}, [points, yi.unit]);
	const fit = useMemo(() => linearFit(points), [points]);
	const xs = points.map((p) => p.x);
	const xMin = Math.min(...xs);
	const xMax = Math.max(...xs);

	const set = (patch: Partial<ScatterSettings>) => {
		setPicked(null);
		onChange({ ...settings, ...patch });
	};
	const noTests = settings.year === 2020 && !["grad_rate_4yr", "chronic_absenteeism"].includes(settings.y);

	return (
		<section className="flex flex-col gap-3" aria-labelledby="scatter-title">
			<div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
				<Select
					label="Across (x)"
					value={settings.x}
					onChange={(x) => set({ x })}
					options={X_KEYS.map((k) => ({
						value: k,
						label: INDICATOR_BY_KEY[k].label,
					}))}
				/>
				<Select
					label="Up (y)"
					value={settings.y}
					onChange={(y) => set({ y })}
					options={Y_KEYS.map((k) => ({
						value: k,
						label: INDICATOR_BY_KEY[k].label,
					}))}
				/>
				<Select label="Area" value={settings.area} onChange={(area) => set({ area })} options={AREAS} />
				<Select label="Type" value={settings.type} onChange={(type) => set({ type })} options={TYPES} />
				<Select
					label="Report card year"
					value={String(settings.year)}
					onChange={(y) => set({ year: Number(y) })}
					options={[...years].reverse().map((y) => ({ value: String(y), label: String(y) }))}
				/>
			</div>

			<figure className="flex flex-col gap-2 rounded-xl border border-line bg-card p-3 sm:p-4 dark:border-line-dark dark:bg-card-dark">
				<figcaption>
					<h2 id="scatter-title" className="text-lg font-semibold">
						{yi.label} vs. {xName}
					</h2>
					<p className="text-xs text-muted dark:text-muted-dark">
						{points.length} {TYPES.find((x) => x.value === settings.type)?.label.toLowerCase()},{" "}
						{AREAS.find((a) => a.value === settings.area)?.label}, {settings.year} report card
						{xi.lag && ` (finance data from FY${settings.year - 1})`}
						{xi.key === "tax_rate" && ` (tax rates from tax year ${settings.year - 3})`}. Each dot is one
						district; the line is the average trend. Tap a dot for details.
					</p>
				</figcaption>
				{highlighted.length > 0 && (
					<ul
						className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-2 dark:text-ink-2-dark"
						aria-label="Legend"
					>
						{highlighted.map((p) => (
							<li key={p.id} className="flex items-center gap-1.5">
								<span aria-hidden className="size-2.5 rounded-full" style={{ background: p.color }} />
								{shortName(p.name)}
							</li>
						))}
						<li className="flex items-center gap-1.5">
							<span aria-hidden className="size-2.5 rounded-full" style={{ background: t.other }} />
							Other districts
						</li>
					</ul>
				)}
				{noTests || points.length === 0 ? (
					<p className="py-16 text-center text-sm text-muted dark:text-muted-dark">
						{noTests
							? "No state tests were given in 2020."
							: "No districts have both measures for this year."}
					</p>
				) : (
					<div className="-ml-2 h-[min(28rem,60dvh)] min-h-72">
						<ResponsiveContainer width="100%" height="100%">
							<ScatterChart margin={{ top: 12, right: 16, bottom: 8, left: 0 }}>
								<CartesianGrid stroke={t.grid} />
								<XAxis
									type="number"
									dataKey="x"
									name={xi.label}
									domain={["auto", "auto"]}
									tickFormatter={(v: number) => format(v, xi.unit, true).replace(/\.0(%|K)/, "$1")}
									tick={{ fill: t.muted, fontSize: 12 }}
									stroke={t.axis}
									tickLine={false}
								/>
								<YAxis
									type="number"
									dataKey="y"
									name={yi.label}
									domain={yTicks ? [0, yTicks[yTicks.length - 1]] : ["auto", "auto"]}
									ticks={yTicks}
									tickFormatter={(v: number) => format(v, yi.unit, true).replace(/\.0(%|K)/, "$1")}
									tick={{ fill: t.muted, fontSize: 12 }}
									stroke="none"
									width={44}
								/>
								{fit && (
									<ReferenceLine
										segment={[
											{ x: xMin, y: fit.a + fit.b * xMin },
											{ x: xMax, y: fit.a + fit.b * xMax },
										]}
										stroke={t.muted}
										strokeWidth={1}
										ifOverflow="hidden"
									/>
								)}
								<Tooltip
									content={(p) => <ScatterTooltip {...p} xi={xi} yi={yi} />}
									cursor={false}
									isAnimationActive={false}
								/>
								<Scatter
									data={others}
									fill={t.other}
									isAnimationActive={false}
									onClick={(d) => setPicked((d as unknown as { payload: Point }).payload)}
									shape={(p: { cx?: number; cy?: number }) => (
										<g style={{ cursor: "pointer" }}>
											<circle cx={p.cx} cy={p.cy} r={12} fill="transparent" />
											<circle cx={p.cx} cy={p.cy} r={4} fill={t.other} stroke={t.surface} strokeWidth={1} />
										</g>
									)}
								/>
								{highlighted.map((h) => (
									<Scatter
										key={h.id}
										data={[h]}
										isAnimationActive={false}
										onClick={() => setPicked(h)}
										shape={(p: { cx?: number; cy?: number }) => (
											<g style={{ cursor: "pointer" }}>
												<circle cx={p.cx} cy={p.cy} r={14} fill="transparent" />
												<circle cx={p.cx} cy={p.cy} r={7} fill={h.color} stroke={t.surface} strokeWidth={2} />
												<text
													x={(p.cx ?? 0) + 10}
													y={(p.cy ?? 0) - 9}
													fontSize={12}
													fontWeight={600}
													fill={t.ink}
													stroke={t.surface}
													strokeWidth={3}
													paintOrder="stroke"
												>
													{shortName(h.name)}
												</text>
											</g>
										)}
									/>
								))}
							</ScatterChart>
						</ResponsiveContainer>
					</div>
				)}
				{missing.length > 0 && (
					<p className="text-xs text-muted dark:text-muted-dark">
						Not shown (outside this area or missing data): {missing.map((s) => shortName(s.name)).join(", ")}
					</p>
				)}
				{picked && (
					<div className="flex flex-wrap items-center gap-3 rounded-lg border border-line p-3 text-sm dark:border-line-dark">
						<div className="min-w-0 flex-1">
							<p className="font-semibold">{picked.name}</p>
							<p className="tabular text-ink-2 dark:text-ink-2-dark">
								{xi.label}: {format(picked.x, xi.unit)} · {yi.label}: {format(picked.y, yi.unit)} · Low
								income: {format(picked.li, "pct")}
								{picked.entity.city && ` · ${picked.entity.city}`}
							</p>
						</div>
						{!colorOf.has(picked.id) && (
							<button
								type="button"
								disabled={!canAdd}
								onClick={() => {
									onAdd(picked.id);
									setPicked(null);
								}}
								className="flex min-h-11 items-center gap-1.5 rounded-lg bg-accent px-3 font-medium text-white disabled:opacity-50 dark:bg-accent-dark"
								title={canAdd ? "Add to comparison" : "Remove a district first"}
							>
								<Plus size={16} aria-hidden /> Compare
							</button>
						)}
					</div>
				)}
				{fit && (
					<p className="text-xs text-muted dark:text-muted-dark">
						Districts above the line do better than the trend predicts for their {xName}, and those below do
						worse. This shows a pattern, not cause and effect.
					</p>
				)}
				<details className="text-sm">
					<summary className="min-h-11 cursor-pointer content-center text-ink-2 dark:text-ink-2-dark">
						Table ({points.length} districts)
					</summary>
					{/* biome-ignore lint/a11y/noNoninteractiveTabindex: scrollable tables must be keyboard-focusable (WCAG 2.1.1) */}
					<section className="max-h-80 overflow-auto" tabIndex={0} aria-label="Districts table">
						<table className="tabular w-full text-sm">
							<thead className="sticky top-0 bg-card dark:bg-card-dark">
								<tr>
									<th scope="col" className="px-2 py-1 text-left font-medium">
										District
									</th>
									<th scope="col" className="px-2 py-1 text-right font-medium">
										{xi.label}
									</th>
									<th scope="col" className="px-2 py-1 text-right font-medium">
										{yi.label}
									</th>
								</tr>
							</thead>
							<tbody>
								{[...points]
									.sort((a, b) => b.y - a.y)
									.map((p) => (
										<tr key={p.id} className="border-t border-line dark:border-line-dark">
											<th scope="row" className="px-2 py-1 text-left font-normal">
												{colorOf.has(p.id) ? <strong>{p.name}</strong> : p.name}
											</th>
											<td className="px-2 py-1 text-right">{format(p.x, xi.unit)}</td>
											<td className="px-2 py-1 text-right">{format(p.y, yi.unit)}</td>
										</tr>
									))}
							</tbody>
						</table>
					</section>
				</details>
			</figure>
		</section>
	);
}

function ScatterTooltip({ active, payload, xi, yi }: TipProps & { xi: Indicator; yi: Indicator }) {
	if (!active || !payload?.length) return null;
	const p = payload[0].payload as Point;
	return (
		<div className="max-w-64 rounded-lg border border-line bg-card px-3 py-2 text-sm shadow-md dark:border-line-dark dark:bg-card-dark">
			<p className="font-semibold">{p.name}</p>
			<p className="text-xs text-muted dark:text-muted-dark">
				{[typeLabel(p.entity.type), p.entity.city].filter(Boolean).join(" · ")}
			</p>
			<dl className="tabular mt-1 grid grid-cols-[auto_auto] gap-x-3 text-xs">
				<dt className="text-ink-2 dark:text-ink-2-dark">{xi.label}</dt>
				<dd className="text-right font-semibold">{format(p.x, xi.unit)}</dd>
				<dt className="text-ink-2 dark:text-ink-2-dark">{yi.label}</dt>
				<dd className="text-right font-semibold">{format(p.y, yi.unit)}</dd>
				{xi.key !== "pct_low_income" && (
					<>
						<dt className="text-ink-2 dark:text-ink-2-dark">Low-income students</dt>
						<dd className="text-right font-semibold">{format(p.li, "pct")}</dd>
					</>
				)}
			</dl>
		</div>
	);
}

function linearFit(pts: { x: number; y: number }[]) {
	if (pts.length < 5) return null;
	const n = pts.length;
	const mx = pts.reduce((s, p) => s + p.x, 0) / n;
	const my = pts.reduce((s, p) => s + p.y, 0) / n;
	let sxy = 0;
	let sxx = 0;
	for (const p of pts) {
		sxy += (p.x - mx) * (p.y - my);
		sxx += (p.x - mx) ** 2;
	}
	if (sxx === 0) return null;
	const b = sxy / sxx;
	return { a: my - b * mx, b };
}
