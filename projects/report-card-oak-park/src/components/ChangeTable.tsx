import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import { comparisonYears, format, formatDelta, type Indicator, value } from "../data";
import { type Series, shortName } from "./DistrictPicker";

type Props = {
	indicators: Indicator[];
	series: Series[];
	years: number[];
	fromYear: number;
	toYear: number;
};

export function ChangeTable({ indicators, series, years, fromYear, toYear }: Props) {
	return (
		<section
			// biome-ignore lint/a11y/noNoninteractiveTabindex: scrollable tables must be keyboard-focusable (WCAG 2.1.1)
			tabIndex={0}
			aria-label="Then vs. now table"
			className="overflow-x-auto rounded-xl border border-line bg-card dark:border-line-dark dark:bg-card-dark"
		>
			<table className="tabular w-full min-w-max text-sm">
				<caption className="sr-only">
					Change from {fromYear} to {toYear}
				</caption>
				<thead>
					<tr className="border-b border-line dark:border-line-dark">
						<th
							scope="col"
							className="sticky left-0 bg-card px-3 py-2 text-left font-medium dark:bg-card-dark"
						>
							Indicator
						</th>
						{series.map((s) => (
							<th key={s.id} scope="col" className="px-3 py-2 text-right font-medium whitespace-nowrap">
								<span className="inline-flex items-center gap-1.5">
									<span
										aria-hidden
										className="inline-block w-3 rounded"
										style={{ background: s.color, height: 3 }}
									/>
									{shortName(s.name)}
								</span>
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{indicators.map((ind) => (
						<tr key={ind.key} className="border-b border-line last:border-0 dark:border-line-dark">
							<th
								scope="row"
								className="sticky left-0 max-w-40 bg-card px-3 py-2 text-left align-top font-normal dark:bg-card-dark"
							>
								{ind.label}
							</th>
							{series.map((s) => {
								const { from, to } = comparisonYears(ind, s.entity, years, fromYear, toYear);
								const a = from != null ? value(s.entity, ind.key, years.indexOf(from)) : null;
								const b = to != null ? value(s.entity, ind.key, years.indexOf(to)) : null;
								if (a == null || b == null)
									return (
										<td key={s.id} className="px-3 py-2 text-right text-muted dark:text-muted-dark">
											–
										</td>
									);
								const d = b - a;
								const Icon = Math.abs(d) < 1e-9 ? ArrowRight : d > 0 ? ArrowUp : ArrowDown;
								const shifted = from !== fromYear || to !== toYear;
								return (
									<td key={s.id} className="px-3 py-2 text-right align-top whitespace-nowrap">
										<div className="font-semibold">{format(b, ind.unit)}</div>
										<div className="flex items-center justify-end gap-1 text-xs text-ink-2 dark:text-ink-2-dark">
											<Icon size={12} aria-hidden />
											{formatDelta(d, ind.unit)}
											{ind.unit !== "pct" && a !== 0 && (
												<span className="text-muted dark:text-muted-dark">
													({((d / a) * 100).toFixed(0)}%)
												</span>
											)}
										</div>
										{shifted && (
											<div className="text-xs text-muted dark:text-muted-dark">
												{from}→{to}
											</div>
										)}
									</td>
								);
							})}
						</tr>
					))}
				</tbody>
			</table>
		</section>
	);
}
