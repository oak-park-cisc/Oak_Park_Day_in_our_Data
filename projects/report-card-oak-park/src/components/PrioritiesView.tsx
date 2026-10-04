import { useMemo } from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Line,
	LineChart,
	ReferenceLine,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import {
	D97,
	D200,
	type Dataset,
	type Entity,
	format,
	LATEST_COMPARABLE_TEST_YEAR,
	STATE,
	value,
} from "../data";
import { type Theme, useTheme } from "../theme";

type Props = { districts: Dataset; schools: Dataset };

type TipProps = { active?: boolean; payload?: readonly { payload?: unknown }[] };

type Var = { key: string; label: string };

const MONEY_VARS: Var[] = [
	{ key: "pct_low_income", label: "Low-income share" },
	{ key: "operating_per_pupil", label: "Operating $/pupil" },
	{ key: "instructional_per_pupil", label: "Instr. $/pupil" },
	{ key: "instr_share", label: "Instr. share" },
	{ key: "pct_local_property_tax", label: "Local property tax" },
	{ key: "pct_state_funding", label: "State funding" },
	{ key: "pct_federal_funding", label: "Federal funding" },
	{ key: "ebf_capacity", label: "EBF adequacy" },
];

const TREND_VARS: Var[] = [
	{ key: "mobility_rate", label: "Mobility rate" },
	{ key: "chronic_absenteeism", label: "Chronic absenteeism" },
	{ key: "instr_share", label: "Instr. share" },
	{ key: "ebf_capacity", label: "EBF adequacy" },
	{ key: "teacher_salary", label: "Teacher salary" },
	{ key: "teacher_retention", label: "Teacher retention" },
	{ key: "attendance_rate", label: "Attendance rate" },
];

type Measure = { label: string; raw: number | null; adj: number | null; n: number };

function measure(all: Entity[], v: Var, outcome: string, yi: number): Measure {
	const pts: { x: number; y: number; z: number }[] = [];
	for (const e of all) {
		const x = val(e, v, yi);
		const y = value(e, outcome, yi);
		const z = value(e, "pct_low_income", yi);
		if (x != null && y != null && z != null) pts.push({ x, y, z });
	}
	const raw = corr(pts.map((p) => ({ x: p.x, y: p.y })));
	const rxz = corr(pts.map((p) => ({ x: p.x, y: p.z })));
	const ryz = corr(pts.map((p) => ({ x: p.y, y: p.z })));
	return { label: v.label, raw, adj: partial(raw, rxz, ryz), n: pts.length };
}

function val(e: Entity, v: Var, yi: number): number | null {
	if (v.key === "instr_share") {
		const op = value(e, "operating_per_pupil", yi);
		const inst = value(e, "instructional_per_pupil", yi);
		return op != null && inst != null ? (inst / op) * 100 : null;
	}
	return value(e, v.key, yi);
}

function corr(rows: { x: number; y: number }[]): number | null {
	const n = rows.length;
	if (n < 30) return null;
	const mx = rows.reduce((s, r) => s + r.x, 0) / n;
	const my = rows.reduce((s, r) => s + r.y, 0) / n;
	let sxy = 0;
	let sxx = 0;
	let syy = 0;
	for (const r of rows) {
		sxy += (r.x - mx) * (r.y - my);
		sxx += (r.x - mx) ** 2;
		syy += (r.y - my) ** 2;
	}
	return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null;
}

function partial(rxy: number | null, rxz: number | null, ryz: number | null): number | null {
	if (rxy == null || rxz == null || ryz == null) return null;
	const den = Math.sqrt((1 - rxz ** 2) * (1 - ryz ** 2));
	return den > 0 ? (rxy - rxz * ryz) / den : null;
}

function fmtR(v: number | null): string {
	return v == null ? "–" : `${v > 0 ? "+" : ""}${v.toFixed(2)}`;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

type ImpactKey = "attendance" | "gaps" | "middle" | "money";
type ImpactLabel = "Biggest impact" | "High impact" | "Medium impact" | "Low impact" | "Not applicable";
type ImpactItem = { label: ImpactLabel; stat: string };
type Impact = Record<"d97" | "d200", Record<ImpactKey, ImpactItem | null>>;

const CHIP_CLASS: Record<ImpactLabel, string> = {
	"Biggest impact": "bg-accent text-white dark:bg-accent-dark dark:text-page-dark",
	"High impact": "border border-accent text-accent dark:border-accent-dark dark:text-accent-dark",
	"Medium impact": "border border-line text-ink-2 dark:border-line-dark dark:text-ink-2-dark",
	"Low impact": "border border-line text-muted dark:border-line-dark dark:text-muted-dark",
	"Not applicable": "border border-line text-muted dark:border-line-dark dark:text-muted-dark",
};

function ImpactChips({ impact, k }: { impact: Impact; k: ImpactKey }) {
	return (
		<span className="flex flex-wrap gap-1.5">
			{(["d97", "d200"] as const).map((id) => {
				const item = impact[id][k];
				return (
					<span
						key={id}
						title={item?.stat || undefined}
						className={`rounded-full px-2 py-0.5 text-xs font-medium ${CHIP_CLASS[item?.label ?? "Not applicable"]}`}
					>
						{id === "d97" ? "D97" : "OPRF"} · {item?.label ?? "Not applicable"}
					</span>
				);
			})}
		</span>
	);
}

export function PrioritiesView({ districts, schools }: Props) {
	const t = useTheme();
	const years = districts.years;

	const stats = useMemo(() => {
		const i24 = years.indexOf(LATEST_COMPARABLE_TEST_YEAR);
		const byId = new Map(districts.rows.map((r) => [r.id, r]));
		const d97 = byId.get(D97);
		const d200 = byId.get(D200);
		const il = byId.get(STATE);
		if (!d97 || !d200 || !il) return null;

		const absence = years.map((y, i) => ({
			year: y,
			D97: value(d97, "chronic_absenteeism", i),
			D200: value(d200, "chronic_absenteeism", i),
			State: value(il, "chronic_absenteeism", i),
		}));

		const groups = ["white", "black", "hispanic", "low_income"] as const;
		const math = groups.map((g) => ({
			group:
				g === "low_income" ? "Low-income" : g === "hispanic" ? "Hispanic" : g === "white" ? "White" : "Black",
			D97: value(d97, `math_prof_${g}`, i24),
			D200: value(d200, `math_prof_${g}`, i24),
		}));

		const d97Schools = schools.rows
			.filter((sc) => sc.district_id === D97)
			.map((sc) => ({
				name: sc.name.replace(" Elem School", "").replace(" Middle School", ""),
				math: value(sc, "math_prof", i24),
				middle: (sc.school_type ?? "").startsWith("middle"),
			}))
			.filter((sc) => sc.math != null)
			.sort((a, b) => (b.math ?? 0) - (a.math ?? 0));

		const share = (e: Entity) => {
			const op = value(e, "operating_per_pupil", i24);
			const ins = value(e, "instructional_per_pupil", i24);
			return op != null && ins != null ? (ins / op) * 100 : null;
		};

		const d97Abs18 = value(d97, "chronic_absenteeism", years.indexOf(2018));
		const d97Abs25 = value(d97, "chronic_absenteeism", years.length - 1);
		const d200Abs24 = value(d200, "chronic_absenteeism", i24);

		const middleRows = d97Schools.filter((sc) => sc.middle);
		const middleAvg = middleRows.length
			? middleRows.reduce((sum, sc) => sum + (sc.math ?? 0), 0) / middleRows.length
			: null;

		const buildImpact = (e: Entity, hasMiddle: boolean): Impact["d97"] => {
			const absNow = value(e, "chronic_absenteeism", i24);
			const absThen = value(e, "chronic_absenteeism", years.indexOf(2018));
			const white = value(e, "math_prof_white", i24);
			const lowIncome = value(e, "math_prof_low_income", i24);
			const gap = white != null && lowIncome != null ? white - lowIncome : null;
			const dMath = value(e, "math_prof", i24);
			const cap = value(e, "ebf_capacity", i24);

			const sev = {
				attendance:
					absNow != null && absThen != null
						? clamp01((absNow - 8) / 15) + clamp01((absNow - absThen) / 20)
						: null,
				gaps: gap != null ? clamp01((gap - 20) / 30) : null,
				middle:
					hasMiddle && dMath != null && middleAvg != null
						? clamp01(Math.max(0, dMath - middleAvg) / 10)
						: null,
				money: cap != null ? (cap >= 95 ? 0.1 : 0.5) : null,
			};
			const stat = {
				attendance:
					absNow != null && absThen != null
						? `${absNow.toFixed(1)}% chronic absence · ${absNow >= absThen ? "+" : "−"}${Math.abs(Math.round((absNow - absThen) * 10) / 10)} pts since 2018`
						: "",
				gaps: gap != null ? `${gap.toFixed(1)}-pt math gap, white vs low-income` : "",
				middle:
					hasMiddle && dMath != null && middleAvg != null
						? `middle schools ${Math.round((dMath - middleAvg) * 10) / 10} pts below district average`
						: "",
				money: cap != null ? `EBF funding adequacy ${Math.round(cap)}%` : "",
			};
			const band = (v: number): ImpactLabel =>
				v >= 0.6 ? "High impact" : v >= 0.35 ? "Medium impact" : "Low impact";
			const applicable = (Object.keys(sev) as ImpactKey[]).filter((k) => sev[k] != null);
			const maxKey = applicable.reduce((best, k) => ((sev[k] ?? 0) > (sev[best] ?? 0) ? k : best), "money");
			const label = (k: ImpactKey): ImpactLabel => {
				const v = sev[k];
				if (v == null) return "Not applicable";
				if (k === maxKey && v >= 0.6) return "Biggest impact";
				return band(v);
			};
			return {
				attendance: { label: label("attendance"), stat: stat.attendance },
				gaps: { label: label("gaps"), stat: stat.gaps },
				middle: hasMiddle ? { label: label("middle"), stat: stat.middle } : null,
				money: { label: label("money"), stat: stat.money },
			};
		};

		const rows = districts.rows.filter(
			(r) => r.type === "elementary" || r.type === "high" || r.type === "unit",
		);
		const money = MONEY_VARS.map((v) => measure(rows, v, "ela_prof", i24));
		const trendEla = TREND_VARS.map((v) => measure(rows, v, "ela_prof", i24));
		const trendMath = TREND_VARS.map((v) => measure(rows, v, "math_prof", i24));

		return {
			absence,
			math,
			d97Schools,
			d97Math: value(d97, "math_prof", i24),
			share: [
				{ name: "D97", v: share(d97) },
				{ name: "D200", v: share(d200) },
				{ name: "State", v: share(il) },
			],
			d97LowMath: value(d97, "math_prof_low_income", i24),
			d97WhiteMath: value(d97, "math_prof_white", i24),
			d200LowMath: value(d200, "math_prof_low_income", i24),
			d200WhiteMath: value(d200, "math_prof_white", i24),
			d97Abs18,
			d97Abs25,
			d200Abs24,
			impact: { d97: buildImpact(d97, true), d200: buildImpact(d200, false) },
			money: money.filter((m) => m.raw != null || m.adj != null),
			trend: TREND_VARS.map((v, i) => ({
				label: v.label,
				ela: trendEla[i].adj,
				math: trendMath[i].adj,
			})),
			districtCount: rows.length,
			strong: {
				grad: value(d200, "grad_rate_4yr", i24),
				onTrack: value(d200, "ninth_on_track", years.length - 1),
				dropout: value(d200, "dropout_rate", i24),
				stateDropout: value(il, "dropout_rate", i24),
				retention: value(d97, "teacher_retention", years.length - 1),
			},
		};
	}, [districts, schools, years]);

	if (!stats) return null;

	return (
		<section className="flex flex-col gap-4" aria-labelledby="priorities-title">
			<div>
				<h2 id="priorities-title" className="text-xl font-bold">
					Priorities
				</h2>
				<p className="text-sm text-ink-2 dark:text-ink-2-dark">
					Four opportunities ranked by how strongly the data supports them, and what&rsquo;s already working.
					Badges on each card show where that priority hits hardest for each district, computed from gap size,
					absence level and change since 2018, the middle-school shortfall, and funding adequacy. All patterns
					are from Illinois Report Card data; they show relationships, not causes.
				</p>
			</div>

			<div className="grid gap-3 lg:grid-cols-2">
				<Card>
					<div className="flex flex-wrap items-center justify-between gap-2">
						<h3 className="text-lg font-semibold">1 · Get students back in seats</h3>
						<ImpactChips impact={stats.impact} k="attendance" />
					</div>
					<p className="text-xs text-muted dark:text-muted-dark">
						Chronic absenteeism (% of students missing 10%+ of school days) is the measure that most tracks
						with scores after accounting for poverty. D97&rsquo;s rate has doubled since 2018; the highest
						rates sit at the middle school and the high school.
					</p>
					<Legend
						items={[
							{ color: t.series[0], label: "D97" },
							{ color: t.series[1], label: "OPRF (D200)" },
							{ color: t.stateLine, label: "Illinois average" },
						]}
					/>
					<div className="h-56 min-w-0">
						<ResponsiveContainer width="100%" height="100%">
							<LineChart data={stats.absence} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
								<CartesianGrid stroke={t.grid} />
								<XAxis
									dataKey="year"
									tick={{ fill: t.muted, fontSize: 12 }}
									stroke={t.axis}
									tickLine={false}
								/>
								<YAxis
									domain={[0, 30]}
									ticks={[0, 10, 20, 30]}
									tickFormatter={(v: number) => `${v}%`}
									tick={{ fill: t.muted, fontSize: 11 }}
									stroke="none"
									width={36}
								/>
								<Tooltip content={(p) => <AbsenceTip {...p} />} cursor={false} isAnimationActive={false} />
								<Line
									type="linear"
									dataKey="D97"
									stroke={t.series[0]}
									strokeWidth={2}
									dot={{ r: 2.5 }}
									isAnimationActive={false}
								/>
								<Line
									type="linear"
									dataKey="D200"
									stroke={t.series[1]}
									strokeWidth={2}
									dot={{ r: 2.5 }}
									isAnimationActive={false}
								/>
								<Line
									type="linear"
									dataKey="State"
									stroke={t.stateLine}
									strokeWidth={1.5}
									strokeDasharray="4 3"
									dot={false}
									isAnimationActive={false}
								/>
							</LineChart>
						</ResponsiveContainer>
					</div>
					<p className="tabular text-xs text-ink-2 dark:text-ink-2-dark">
						D97: {format(stats.d97Abs18, "pct")} (2018) → {format(stats.d97Abs25, "pct")} (2025) · OPRF{" "}
						{format(stats.d200Abs24, "pct")} (2024)
					</p>
				</Card>

				<Card>
					<div className="flex flex-wrap items-center justify-between gap-2">
						<h3 className="text-lg font-semibold">2 · Close the subgroup gaps</h3>
						<ImpactChips impact={stats.impact} k="gaps" />
					</div>
					<p className="text-xs text-muted dark:text-muted-dark">
						Math proficiency by student group, 2024 (last year on the old test scale). Low-income students are
						the fastest-growing group in D97 and score lowest. ELA shows the same pattern.
					</p>
					<Legend
						items={[
							{ color: t.series[0], label: "D97" },
							{ color: t.series[1], label: "OPRF (D200)" },
						]}
					/>
					<div className="h-56 min-w-0">
						<ResponsiveContainer width="100%" height="100%">
							<BarChart data={stats.math} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
								<CartesianGrid stroke={t.grid} vertical={false} />
								<XAxis
									dataKey="group"
									tick={{ fill: t.muted, fontSize: 11 }}
									stroke={t.axis}
									tickLine={false}
								/>
								<YAxis
									domain={[0, 100]}
									ticks={[0, 25, 50, 75, 100]}
									tickFormatter={(v: number) => `${v}%`}
									tick={{ fill: t.muted, fontSize: 11 }}
									stroke="none"
									width={36}
								/>
								<Tooltip content={(p) => <GroupTip {...p} />} cursor={false} isAnimationActive={false} />
								<Bar dataKey="D97" fill={t.series[0]} barSize={14} radius={2} isAnimationActive={false} />
								<Bar dataKey="D200" fill={t.series[1]} barSize={14} radius={2} isAnimationActive={false} />
							</BarChart>
						</ResponsiveContainer>
					</div>
					<p className="tabular text-xs text-ink-2 dark:text-ink-2-dark">
						D97 low-income math {format(stats.d97LowMath, "pct")} vs. white{" "}
						{format(stats.d97WhiteMath, "pct")} · OPRF {format(stats.d200LowMath, "pct")} vs.{" "}
						{format(stats.d200WhiteMath, "pct")}
					</p>
				</Card>

				<Card>
					<div className="flex flex-wrap items-center justify-between gap-2">
						<h3 className="text-lg font-semibold">3 · Strengthen the middle years</h3>
						<ImpactChips impact={stats.impact} k="middle" />
					</div>
					<p className="text-xs text-muted dark:text-muted-dark">
						Math proficiency by D97 school, 2024. The two middle schools (orange) sit at the bottom while
						Horace Mann, with the fewest low-income students, leads. The drop from elementary to middle school
						is where D97 loses the most ground. Dashed line: D97 district average.
					</p>
					<Legend
						items={[
							{ color: t.series[0], label: "Elementary" },
							{ color: t.series[1], label: "Middle" },
						]}
					/>
					<div className="h-72 min-w-0">
						<ResponsiveContainer width="100%" height="100%">
							<BarChart
								data={stats.d97Schools}
								layout="vertical"
								margin={{ top: 8, right: 24, bottom: 0, left: 0 }}
							>
								<CartesianGrid stroke={t.grid} horizontal={false} />
								<XAxis
									type="number"
									domain={[0, 80]}
									ticks={[0, 20, 40, 60, 80]}
									tickFormatter={(v: number) => `${v}%`}
									tick={{ fill: t.muted, fontSize: 12 }}
									stroke={t.axis}
									tickLine={false}
								/>
								<YAxis
									type="category"
									dataKey="name"
									width={118}
									tick={{ fill: t.inkSecondary, fontSize: 11 }}
									stroke="none"
									tickLine={false}
								/>
								<ReferenceLine x={stats.d97Math ?? 0} stroke={t.ink} strokeDasharray="3 3" />
								<Tooltip content={(p) => <SchoolTip {...p} />} cursor={false} isAnimationActive={false} />
								<Bar dataKey="math" barSize={12} radius={2} isAnimationActive={false}>
									{stats.d97Schools.map((sc) => (
										<Cell key={sc.name} fill={sc.middle ? t.series[1] : t.series[0]} />
									))}
								</Bar>
							</BarChart>
						</ResponsiveContainer>
					</div>
				</Card>

				<Card>
					<div className="flex flex-wrap items-center justify-between gap-2">
						<h3 className="text-lg font-semibold">4 · Aim spending at classrooms</h3>
						<ImpactChips impact={stats.impact} k="money" />
					</div>
					<p className="text-xs text-muted dark:text-muted-dark">
						Share of operating spending that goes to instruction (2024 report card, prior fiscal year). Both
						districts sit near the state average; the rest covers administration, transport and operations.
						Instructional share is the one budget measure that trends with scores after accounting for
						poverty. Funding itself is not the constraint: EBF capacity is 105% (D97) and 139% (D200).
					</p>
					<div className="h-40 min-w-0">
						<ResponsiveContainer width="100%" height="100%">
							<BarChart data={stats.share} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
								<CartesianGrid stroke={t.grid} vertical={false} />
								<XAxis
									dataKey="name"
									tick={{ fill: t.muted, fontSize: 12 }}
									stroke={t.axis}
									tickLine={false}
								/>
								<YAxis
									domain={[0, 100]}
									ticks={[0, 25, 50, 75]}
									tickFormatter={(v: number) => `${v}%`}
									tick={{ fill: t.muted, fontSize: 11 }}
									stroke="none"
									width={36}
								/>
								<Tooltip content={(p) => <ShareTip {...p} />} cursor={false} isAnimationActive={false} />
								<Bar dataKey="v" fill={t.series[0]} barSize={28} radius={2} isAnimationActive={false} />
							</BarChart>
						</ResponsiveContainer>
					</div>
				</Card>
			</div>

			<section
				className="flex flex-col gap-3 rounded-xl border border-line bg-card p-3 sm:p-4 dark:border-line-dark dark:bg-card-dark"
				aria-labelledby="money-evidence"
			>
				<div>
					<h3 id="money-evidence" className="text-lg font-semibold">
						Why money isn&rsquo;t the lever
					</h3>
					<p className="text-xs text-muted dark:text-muted-dark">
						Correlations across {stats.districtCount} Illinois districts, 2024 report card. Each pair compares
						the raw link (gray) with the link after accounting for low-income share (blue): the spending and
						funding bars collapse to near zero. The second chart shows what still tracks with scores after
						adjusting — the basis for priorities 1 and 4.
					</p>
				</div>
				<div className="grid gap-6 md:grid-cols-2">
					<figure className="flex flex-col gap-2">
						<figcaption className="text-sm font-medium">
							Spending and funding sources vs. ELA proficiency
						</figcaption>
						<CorrBars
							data={stats.money}
							bars={[
								{ key: "raw", label: "Raw", color: t.other },
								{ key: "adj", label: "After adjusting", color: t.series[0] },
							]}
							theme={t}
						/>
					</figure>
					<figure className="flex flex-col gap-2">
						<figcaption className="text-sm font-medium">What tracks with scores after adjusting</figcaption>
						<CorrBars
							data={stats.trend}
							bars={[
								{ key: "ela", label: "ELA", color: t.series[0] },
								{ key: "math", label: "Math", color: t.series[1] },
							]}
							theme={t}
						/>
					</figure>
				</div>
				<p className="text-xs text-muted dark:text-muted-dark">
					Adjustment is a single variable (low-income share); spending describes the prior fiscal year; scores
					are 2024, the last year on the old scale.
				</p>
			</section>

			<div className="rounded-xl border border-line bg-card p-4 dark:border-line-dark dark:bg-card-dark">
				<h3 className="font-semibold">Already strong — protect, don&rsquo;t fix</h3>
				<ul className="tabular mt-2 flex list-disc flex-col gap-1.5 pl-5 text-sm text-ink-2 dark:text-ink-2-dark">
					<li>OPRF 4-year graduation rate {format(stats.strong.grad, "pct")} (2024)</li>
					<li>OPRF 9th graders on track {format(stats.strong.onTrack, "pct")} (2025)</li>
					<li>
						OPRF dropout rate {format(stats.strong.dropout, "pct")} vs.{" "}
						{format(stats.strong.stateDropout, "pct")} statewide (2024)
					</li>
					<li>D97 teacher retention {format(stats.strong.retention, "pct")} (2025)</li>
				</ul>
			</div>
		</section>
	);
}

function Card({ children }: { children: React.ReactNode }) {
	return (
		<div className="min-w-0 rounded-xl border border-line bg-card p-3 sm:p-4 dark:border-line-dark dark:bg-card-dark">
			{children}
		</div>
	);
}

function Legend({ items }: { items: { color: string; label: string }[] }) {
	return (
		<ul
			className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2 dark:text-ink-2-dark"
			aria-label="Legend"
		>
			{items.map((it) => (
				<li key={it.label} className="flex items-center gap-1.5">
					<span aria-hidden className="size-2.5 rounded-full" style={{ background: it.color }} />
					{it.label}
				</li>
			))}
		</ul>
	);
}

function AbsenceTip({ active, payload }: TipProps) {
	if (!active || !payload?.length) return null;
	const d = payload[0].payload as {
		year: number;
		D97: number | null;
		D200: number | null;
		State: number | null;
	};
	return (
		<div className="rounded-lg border border-line bg-card px-3 py-2 text-xs shadow-md dark:border-line-dark dark:bg-card-dark">
			<p className="text-sm font-semibold">{d.year}</p>
			<dl className="mt-1 grid grid-cols-[auto_auto] gap-x-3">
				<dt className="text-ink-2 dark:text-ink-2-dark">D97</dt>
				<dd className="text-right font-semibold">{format(d.D97, "pct")}</dd>
				<dt className="text-ink-2 dark:text-ink-2-dark">OPRF (D200)</dt>
				<dd className="text-right font-semibold">{format(d.D200, "pct")}</dd>
				<dt className="text-ink-2 dark:text-ink-2-dark">Illinois</dt>
				<dd className="text-right font-semibold">{format(d.State, "pct")}</dd>
			</dl>
		</div>
	);
}

function GroupTip({ active, payload }: TipProps) {
	if (!active || !payload?.length) return null;
	const d = payload[0].payload as { group: string; D97: number | null; D200: number | null };
	return (
		<div className="rounded-lg border border-line bg-card px-3 py-2 text-xs shadow-md dark:border-line-dark dark:bg-card-dark">
			<p className="text-sm font-semibold">{d.group} students · math 2024</p>
			<dl className="mt-1 grid grid-cols-[auto_auto] gap-x-3">
				<dt className="text-ink-2 dark:text-ink-2-dark">D97</dt>
				<dd className="text-right font-semibold">{format(d.D97, "pct")}</dd>
				<dt className="text-ink-2 dark:text-ink-2-dark">OPRF (D200)</dt>
				<dd className="text-right font-semibold">{format(d.D200, "pct")}</dd>
			</dl>
		</div>
	);
}

function SchoolTip({ active, payload }: TipProps) {
	if (!active || !payload?.length) return null;
	const d = payload[0].payload as { name: string; math: number | null; middle: boolean };
	return (
		<div className="rounded-lg border border-line bg-card px-3 py-2 text-xs shadow-md dark:border-line-dark dark:bg-card-dark">
			<p className="text-sm font-semibold">{d.name}</p>
			<p className="mt-1">
				Math proficiency: <strong className="tabular">{format(d.math, "pct")}</strong>
			</p>
		</div>
	);
}

function ShareTip({ active, payload }: TipProps) {
	if (!active || !payload?.length) return null;
	const d = payload[0].payload as { name: string; v: number | null };
	return (
		<div className="rounded-lg border border-line bg-card px-3 py-2 text-xs shadow-md dark:border-line-dark dark:bg-card-dark">
			<p className="text-sm font-semibold">{d.name}</p>
			<p className="mt-1">
				Instructional share: <strong className="tabular">{format(d.v, "pct")}</strong>
			</p>
		</div>
	);
}

type BarSpec = { key: string; label: string; color: string };

function CorrBars({
	data,
	bars,
	theme,
}: {
	data: Record<string, number | null | string>[];
	bars: BarSpec[];
	theme: Theme;
}) {
	return (
		<>
			<ul
				className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2 dark:text-ink-2-dark"
				aria-label="Legend"
			>
				{bars.map((b) => (
					<li key={b.key} className="flex items-center gap-1.5">
						<span aria-hidden className="size-2.5 rounded-full" style={{ background: b.color }} />
						{b.label}
					</li>
				))}
			</ul>
			<div className="h-80 min-w-0">
				<ResponsiveContainer width="100%" height="100%">
					<BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 0, left: 0 }}>
						<CartesianGrid stroke={theme.grid} horizontal={false} />
						<XAxis
							type="number"
							domain={[-0.7, 0.7]}
							ticks={[-0.5, 0, 0.5]}
							tickFormatter={fmtR}
							tick={{ fill: theme.muted, fontSize: 12 }}
							stroke={theme.axis}
							tickLine={false}
						/>
						<YAxis
							type="category"
							dataKey="label"
							width={128}
							tick={{ fill: theme.inkSecondary, fontSize: 11 }}
							stroke="none"
							tickLine={false}
						/>
						<ReferenceLine x={0} stroke={theme.axis} />
						<Tooltip content={(p) => <CorrTip {...p} />} cursor={false} isAnimationActive={false} />
						{bars.map((b) => (
							<Bar
								key={b.key}
								dataKey={b.key}
								name={b.label}
								fill={b.color}
								barSize={9}
								radius={2}
								isAnimationActive={false}
							/>
						))}
					</BarChart>
				</ResponsiveContainer>
			</div>
		</>
	);
}

function CorrTip({ active, payload }: TipProps) {
	if (!active || !payload?.length) return null;
	const d = payload[0].payload as {
		label: string;
		raw?: number | null;
		adj?: number | null;
		ela?: number | null;
		math?: number | null;
		n?: number;
	};
	return (
		<div className="rounded-lg border border-line bg-card px-3 py-2 text-xs shadow-md dark:border-line-dark dark:bg-card-dark">
			<p className="text-sm font-semibold">{d.label}</p>
			{d.n != null && "raw" in d ? (
				<dl className="mt-1 grid grid-cols-[auto_auto] gap-x-3">
					<dt className="text-ink-2 dark:text-ink-2-dark">Raw</dt>
					<dd className="text-right font-semibold">{fmtR(d.raw ?? null)}</dd>
					<dt className="text-ink-2 dark:text-ink-2-dark">Adjusted</dt>
					<dd className="text-right font-semibold">{fmtR(d.adj ?? null)}</dd>
				</dl>
			) : (
				<dl className="mt-1 grid grid-cols-[auto_auto] gap-x-3">
					<dt className="text-ink-2 dark:text-ink-2-dark">ELA</dt>
					<dd className="text-right font-semibold">{fmtR(d.ela ?? null)}</dd>
					<dt className="text-ink-2 dark:text-ink-2-dark">Math</dt>
					<dd className="text-right font-semibold">{fmtR(d.math ?? null)}</dd>
				</dl>
			)}
			{d.n != null && <p className="mt-1 text-muted dark:text-muted-dark">{d.n} districts</p>}
		</div>
	);
}
