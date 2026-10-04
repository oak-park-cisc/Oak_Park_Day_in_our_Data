import { type Entity, value } from "../data";
import { useTheme } from "../theme";
import { type Series, shortName } from "./DistrictPicker";

const GROUPS = [
	{ key: "pct_white", label: "White" },
	{ key: "pct_black", label: "Black" },
	{ key: "pct_hispanic", label: "Hispanic or Latino" },
	{ key: "pct_asian", label: "Asian" },
	{ key: "pct_multiracial", label: "Multiracial" },
];

type Props = {
	series: Series[];
	state?: Entity;
	years: number[];
	year: number;
};

export function Demographics({ series, state, years, year }: Props) {
	const t = useTheme();
	const yi = years.indexOf(year);
	const colors = [t.series[0], t.series[1], t.series[2], t.series[3], t.series[6], t.other];
	const rows = [
		...series.map((s) => ({
			id: s.id,
			name: shortName(s.name),
			entity: s.entity,
			color: s.color,
		})),
		...(state ? [{ id: state.id, name: "Illinois", entity: state, color: t.stateLine }] : []),
	].map((r) => {
		const parts = GROUPS.map((g) => value(r.entity, g.key, yi) ?? 0);
		const other = Math.max(0, 100 - parts.reduce((a, b) => a + b, 0));
		return { ...r, parts: [...parts, other] };
	});
	const labels = [...GROUPS.map((g) => g.label), "Other or not reported"];

	return (
		<figure className="flex flex-col gap-3">
			<figcaption>
				<h3 className="text-lg font-semibold">Students by race and ethnicity, {year}</h3>
				<p className="text-xs text-muted dark:text-muted-dark">
					Share of enrolled students. “Other” covers American Indian, Pacific Islander and, from 2025, Middle
					Eastern or North African students.
				</p>
			</figcaption>
			<ul
				className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-2 dark:text-ink-2-dark"
				aria-label="Legend"
			>
				{labels.map((l, i) => (
					<li key={l} className="flex items-center gap-1.5">
						<span aria-hidden className="size-2.5 rounded-sm" style={{ background: colors[i] }} />
						{l}
					</li>
				))}
			</ul>
			<ul className="flex flex-col gap-3">
				{rows.map((r) => (
					<li key={r.id} className="flex flex-col gap-1">
						<div className="flex items-center gap-2 text-sm">
							<span
								aria-hidden
								className="inline-block w-3 rounded"
								style={{ background: r.color, height: 3 }}
							/>
							<span className="font-medium">{r.name}</span>
						</div>
						<div
							className="flex h-6 w-full gap-0.5 overflow-hidden rounded"
							role="img"
							aria-label={`${r.name}: ${labels.map((l, i) => `${l} ${r.parts[i].toFixed(1)}%`).join(", ")}`}
						>
							{r.parts.map((p, i) =>
								p > 0 ? (
									<div
										key={labels[i]}
										title={`${labels[i]}: ${p.toFixed(1)}%`}
										className="flex h-full items-center justify-center overflow-visible text-[11px] font-medium"
										style={{
											width: `${p}%`,
											background: colors[i],
											color: i === 3 || i === 5 ? "#0b0b0b" : "#ffffff",
										}}
									>
										{p >= 9 ? `${Math.round(p)}%` : ""}
									</div>
								) : null,
							)}
						</div>
					</li>
				))}
			</ul>
			<details className="text-sm">
				<summary className="min-h-11 cursor-pointer content-center text-ink-2 dark:text-ink-2-dark">
					Table
				</summary>
				{/* biome-ignore lint/a11y/noNoninteractiveTabindex: scrollable tables must be keyboard-focusable (WCAG 2.1.1) */}
				<section className="overflow-x-auto" tabIndex={0} aria-label="Race and ethnicity table">
					<table className="tabular w-full min-w-max text-sm">
						<thead>
							<tr>
								<th scope="col" className="px-2 py-1 text-left font-medium">
									District
								</th>
								{labels.map((l) => (
									<th key={l} scope="col" className="px-2 py-1 text-right font-medium">
										{l}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{rows.map((r) => (
								<tr key={r.id} className="border-t border-line dark:border-line-dark">
									<th scope="row" className="px-2 py-1 text-left font-normal whitespace-nowrap">
										{r.name}
									</th>
									{r.parts.map((p, i) => (
										<td key={labels[i]} className="px-2 py-1 text-right">
											{p.toFixed(1)}%
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</section>
			</details>
		</figure>
	);
}
