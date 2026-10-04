import { ArrowRight, House, Scale, TrendingUp, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { D97, D200, type Dataset, type Entity, format, value } from "../data";
import { makeTools } from "../findings";
import { useTheme } from "../theme";
import { shortName } from "./DistrictPicker";

export type Levy = { tax_year: number; eav: number; rate: number; extension: number; oak_park_share: number };
export type Levies = Record<"D97" | "D200", Levy[]>;

type Props = {
	districts: Dataset;
	levies: Levies | null;
	onScatter: (x: string, type: string) => void;
};

export function TaxesView({ districts, levies, onScatter }: Props) {
	const t = useTheme();
	const years = districts.years;
	const NOW = years[years.length - 1];
	const TEST = 2024;
	const [peerType, setPeerType] = useState<"elementary" | "high">("elementary");
	const [showAll, setShowAll] = useState(false);
	const byId = useMemo(() => new Map(districts.rows.map((r) => [r.id, r])), [districts]);
	const g = (e: Entity | undefined, k: string, y: number) => value(e, k, years.indexOf(y));

	const tools = useMemo(() => makeTools(districts), [districts]);
	const communities = tools.communities(NOW).map((c) => ({
		...c,
		eEla: g(c.e, "ela_prof", TEST),
		hEla: g(c.h, "ela_prof", TEST),
	}));
	const maxTotal = Math.max(...communities.map((c) => c.total ?? 0));
	const levyChange = (k: "D97" | "D200", from: number) => {
		const rows = levies?.[k] ?? [];
		const a = rows.find((r) => r.tax_year === from);
		const b = rows[rows.length - 1];
		return a && b ? { pct: ((b.extension - a.extension) / a.extension) * 100, from: a, to: b } : null;
	};
	const l97 = levyChange("D97", 2015);
	const l200 = levyChange("D200", 2015);

	const taxYear = NOW - 3;

	const peers = districts.rows
		.filter(
			(r) =>
				r.county === "Cook" &&
				r.type === peerType &&
				(g(r, "pct_low_income", TEST) ?? 100) <= 25 &&
				g(r, "ela_prof", TEST) != null &&
				g(r, "tax_rate", NOW) != null,
		)
		.sort((a, b) => (g(b, "ela_prof", TEST) ?? 0) - (g(a, "ela_prof", TEST) ?? 0));
	const target = peerType === "elementary" ? D97 : D200;

	const levyRows =
		levies?.D97.map((r) => ({
			year: r.tax_year,
			D97: r.extension / 1e6,
			D200: (levies.D200.find((x) => x.tax_year === r.tax_year)?.extension ?? Number.NaN) / 1e6,
		})) ?? [];

	return (
		<section className="flex flex-col gap-4" aria-labelledby="taxes-title">
			<div>
				<h2 id="taxes-title" className="text-xl font-bold">
					What do taxpayers get for their school taxes?
				</h2>
				<p className="text-sm text-ink-2 dark:text-ink-2-dark">
					Tax rates, tax base and results compared with Cook County districts. Rates are from tax year{" "}
					{taxYear} (the {NOW} report card).
				</p>
			</div>

			<div className="rounded-xl border border-line bg-card p-4 dark:border-line-dark dark:bg-card-dark">
				<h3 className="flex items-center gap-2 font-semibold">
					<Scale size={18} aria-hidden /> Is it good value?
				</h3>
				<ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-sm text-ink-2 dark:text-ink-2-dark">
					<li>
						<strong className="text-ink dark:text-ink-dark">OPRF: yes, by these measures.</strong> A
						middle-of-the-road tax rate buys near-top results.
					</li>
					<li>
						<strong className="text-ink dark:text-ink-dark">D97: mixed.</strong> It raises more local tax per
						student than most, but with little state aid it spends about the median, and its results trail
						similar towns.
					</li>
					<li>
						<strong className="text-ink dark:text-ink-dark">Why the rate is high:</strong> little taxable
						property per student ({format(g(byId.get(D97), "eav_per_pupil", NOW), "usd")} for D97 vs.{" "}
						{format(g(byId.get("050160650040000"), "eav_per_pupil", NOW), "usd")} in Evanston 65).
					</li>
				</ul>
				<p className="mt-2 text-xs text-muted dark:text-muted-dark">
					A rate is not a bill: home values and exemptions decide what each household pays. Test scores are
					one measure of value.
				</p>
			</div>

			<figure className="flex flex-col gap-3 rounded-xl border border-line bg-card p-3 sm:p-4 dark:border-line-dark dark:bg-card-dark">
				<figcaption>
					<h3 className="flex items-center gap-2 text-lg font-semibold">
						<House size={20} aria-hidden /> Combined school tax rate by community
					</h3>
					<p className="text-xs text-muted dark:text-muted-dark">
						Elementary + high school district rates per $100 of taxable value, tax year {taxYear}. Right:
						share of students proficient in reading, {TEST}. Other taxes on the bill (village, county, parks)
						are not included.
					</p>
				</figcaption>
				<ul
					className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-2 dark:text-ink-2-dark"
					aria-label="Legend"
				>
					<li className="flex items-center gap-1.5">
						<span aria-hidden className="size-2.5 rounded-sm" style={{ background: t.series[0] }} />
						Elementary district
					</li>
					<li className="flex items-center gap-1.5">
						<span aria-hidden className="size-2.5 rounded-sm" style={{ background: t.series[1] }} />
						High school district
					</li>
				</ul>
				<ol className="tabular flex flex-col gap-2.5">
					{communities.map((c, i) => {
						const me = c.name === "Oak Park";
						return (
							<li
								key={c.name}
								className="flex flex-col gap-1 sm:grid sm:grid-cols-[13rem_1fr_13rem] sm:items-center sm:gap-3"
							>
								<div className="flex items-baseline justify-between gap-2 sm:block">
									<span className={`text-sm ${me ? "font-bold" : "font-medium"}`}>
										<span className="text-muted dark:text-muted-dark">{i + 1}. </span>
										{c.name}
									</span>
									<span className="block text-xs text-muted dark:text-muted-dark">
										{shortName(c.e?.name ?? "")} + {shortName(c.h?.name ?? "")}
									</span>
								</div>
								<div className="flex items-center gap-2">
									<div
										className="flex h-5 shrink-0 gap-0.5"
										style={{ width: `calc((100% - 3.5rem) * ${(c.total ?? 0) / maxTotal})` }}
										role="img"
										aria-label={`${c.name}: ${format(c.er, "rate")} elementary + ${format(c.hr, "rate")} high school`}
									>
										<div
											className="h-full rounded-l"
											style={{ width: `${((c.er ?? 0) / (c.total ?? 1)) * 100}%`, background: t.series[0] }}
										/>
										<div
											className="h-full rounded-r"
											style={{ width: `${((c.hr ?? 0) / (c.total ?? 1)) * 100}%`, background: t.series[1] }}
										/>
									</div>
									<span className={`text-sm ${me ? "font-bold" : "font-semibold"}`}>
										{format(c.total, "rate")}
									</span>
								</div>
								<p className="text-xs text-ink-2 sm:text-right sm:whitespace-nowrap dark:text-ink-2-dark">
									Reading: {c.eEla == null ? "–" : Math.round(c.eEla)}% elem. ·{" "}
									{c.hEla == null ? "–" : Math.round(c.hEla)}% HS
								</p>
							</li>
						);
					})}
				</ol>
				<button
					type="button"
					onClick={() => onScatter("tax_rate", "elementary")}
					className="flex min-h-11 items-center gap-1.5 self-start text-sm font-medium text-accent hover:underline dark:text-accent-dark"
				>
					Tax rate vs. reading scores for every Cook County district <ArrowRight size={16} aria-hidden />
				</button>
			</figure>

			{levyRows.length > 0 && (
				<figure className="flex flex-col gap-2 rounded-xl border border-line bg-card p-3 sm:p-4 dark:border-line-dark dark:bg-card-dark">
					<figcaption>
						<h3 className="flex items-center gap-2 text-lg font-semibold">
							<TrendingUp size={20} aria-hidden className="shrink-0" />
							School property tax collected, 2006–{levyRows.at(-1)?.year}
						</h3>
						<p className="text-xs text-muted dark:text-muted-dark">
							Total tax extended (billed) per tax year, in millions of dollars, not adjusted for inflation.
							D200 includes River Forest (about{" "}
							{Math.round((1 - (levies?.D200.at(-1)?.oak_park_share ?? 0)) * 100)}%).
							{l97 && l200 && ` Since 2015: D97 +${Math.round(l97.pct)}%, D200 +${Math.round(l200.pct)}%.`}
						</p>
					</figcaption>
					<ul
						className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-2 dark:text-ink-2-dark"
						aria-label="Legend"
					>
						<li className="flex items-center gap-1.5">
							<span
								aria-hidden
								className="inline-block w-4 rounded"
								style={{ background: t.series[0], height: 3 }}
							/>
							Oak Park D97
						</li>
						<li className="flex items-center gap-1.5">
							<span
								aria-hidden
								className="inline-block w-4 rounded"
								style={{ background: t.series[1], height: 3 }}
							/>
							OPRF D200
						</li>
					</ul>
					<div className="-ml-2 h-60">
						<ResponsiveContainer width="100%" height="100%">
							<LineChart data={levyRows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
								<CartesianGrid stroke={t.grid} vertical={false} />
								<XAxis
									dataKey="year"
									tick={{ fill: t.muted, fontSize: 12 }}
									stroke={t.axis}
									tickLine={false}
									tickFormatter={(y: number) => `'${String(y).slice(2)}`}
									interval="preserveStartEnd"
								/>
								<YAxis
									tick={{ fill: t.muted, fontSize: 12 }}
									stroke="none"
									width={56}
									tickFormatter={(v: number) => `$${v}M`}
									domain={[0, "auto"]}
								/>
								<Tooltip
									isAnimationActive={false}
									cursor={{ stroke: t.axis }}
									contentStyle={{ background: t.surface, borderColor: t.grid, borderRadius: 8, fontSize: 13 }}
									labelStyle={{ color: t.muted }}
									itemStyle={{ color: t.ink }}
									formatter={(v, name) => [
										`$${Number(v).toFixed(1)}M`,
										name === "D97" ? "Oak Park D97" : "OPRF D200",
									]}
									labelFormatter={(y) => `Tax year ${y}`}
								/>
								{(["D97", "D200"] as const).map((k, i) => (
									<Line
										key={k}
										dataKey={k}
										stroke={t.series[i]}
										strokeWidth={2}
										dot={{ r: 2.5, fill: t.series[i], stroke: t.surface, strokeWidth: 1 }}
										isAnimationActive={false}
									/>
								))}
							</LineChart>
						</ResponsiveContainer>
					</div>
				</figure>
			)}

			<figure className="flex flex-col gap-3 rounded-xl border border-line bg-card p-3 sm:p-4 dark:border-line-dark dark:bg-card-dark">
				<figcaption className="flex flex-wrap items-end justify-between gap-2">
					<div>
						<h3 className="flex items-center gap-2 text-lg font-semibold">
							<Users size={20} aria-hidden className="shrink-0" /> Similar Cook County districts: taxes vs.
							results
						</h3>
						<p className="text-xs text-muted dark:text-muted-dark">
							Districts with 25% or fewer low-income students, sorted by reading proficiency ({TEST}).
						</p>
					</div>
					<div className="flex gap-1.5" role="toolbar" aria-label="District type">
						{(["elementary", "high"] as const).map((k) => (
							<button
								key={k}
								type="button"
								aria-pressed={peerType === k}
								onClick={() => {
									setPeerType(k);
									setShowAll(false);
								}}
								className="min-h-11 rounded-full border border-line px-4 text-sm font-medium aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-page dark:border-line-dark dark:aria-pressed:border-ink-dark dark:aria-pressed:bg-ink-dark dark:aria-pressed:text-page-dark"
							>
								{k === "elementary" ? "Elementary" : "High school"}
							</button>
						))}
					</div>
				</figcaption>
				{/* biome-ignore lint/a11y/noNoninteractiveTabindex: scrollable tables must be keyboard-focusable (WCAG 2.1.1) */}
				<section className="overflow-x-auto" tabIndex={0} aria-label="Similar districts table">
					<table className="tabular w-full min-w-[36rem] text-sm">
						<thead className="bg-card text-xs text-muted dark:bg-card-dark dark:text-muted-dark">
							<tr>
								<th scope="col" className="px-2 py-1.5 text-left font-medium">
									District
								</th>
								<th scope="col" className="px-2 py-1.5 text-right font-medium">
									Reading
								</th>
								<th scope="col" className="px-2 py-1.5 text-right font-medium">
									Tax rate
								</th>
								<th scope="col" className="px-2 py-1.5 text-right font-medium">
									Local tax / student
								</th>
								<th scope="col" className="px-2 py-1.5 text-right font-medium">
									Spending / student
								</th>
								<th scope="col" className="px-2 py-1.5 text-right font-medium">
									Low income
								</th>
							</tr>
						</thead>
						<tbody>
							{peers
								.filter((r, i) => showAll || i < 8 || r.id === target)
								.map((r) => {
									const me = r.id === target;
									return (
										<tr
											key={r.id}
											className={`border-t border-line dark:border-line-dark ${me ? "bg-line/60 font-semibold dark:bg-line-dark/60" : ""}`}
										>
											<th scope="row" className="px-2 py-1.5 text-left font-[inherit]">
												{r.name}
											</th>
											<td className="px-2 py-1.5 text-right">{format(g(r, "ela_prof", TEST), "pct")}</td>
											<td className="px-2 py-1.5 text-right">{format(g(r, "tax_rate", NOW), "rate")}</td>
											<td className="px-2 py-1.5 text-right">
												{format(g(r, "local_tax_per_pupil", NOW), "usd")}
											</td>
											<td className="px-2 py-1.5 text-right">
												{format(g(r, "operating_per_pupil", NOW), "usd")}
											</td>
											<td className="px-2 py-1.5 text-right">
												{format(g(r, "pct_low_income", TEST), "pct")}
											</td>
										</tr>
									);
								})}
						</tbody>
					</table>
				</section>
				{peers.length > 9 && (
					<button
						type="button"
						onClick={() => setShowAll((v) => !v)}
						aria-expanded={showAll}
						className="flex min-h-11 items-center self-start text-sm font-medium text-accent hover:underline dark:text-accent-dark"
					>
						{showAll ? "Show fewer" : `Show all ${peers.length}`}
					</button>
				)}
			</figure>
		</section>
	);
}
