import { useMemo } from "react";
import { type Dataset, type Entity, format, INDICATORS, value, yearLabel } from "../data";
import { Select } from "./Select";

type Props = {
	schools: Dataset;
	district: Entity | undefined;
	color: string;
	indicator: string;
	year: number;
	onIndicator: (k: string) => void;
	onYear: (y: number) => void;
};

export function SchoolsView({ schools, district, color, indicator, year, onIndicator, onYear }: Props) {
	const years = schools.years;
	const available = useMemo(
		() =>
			INDICATORS.filter((i) => schools.rows.some((s) => s.data[i.key]?.some((v) => typeof v === "number"))),
		[schools],
	);
	const ind = available.find((i) => i.key === indicator) ?? available[0];
	const yi = years.indexOf(year);
	const rows = schools.rows
		.filter((s) => s.district_id === district?.id)
		.map((s) => ({ s, v: value(s, ind.key, yi) }))
		.filter((r): r is { s: Entity; v: number } => r.v != null)
		.sort((a, b) => b.v - a.v);
	const avg = value(district, ind.key, yi);
	const max = Math.max(...rows.map((r) => r.v), avg ?? 0, ind.unit === "pct" ? 0 : 1);
	const scale = ind.unit === "pct" ? Math.max(100, max) : max * 1.05;

	return (
		<section className="flex flex-col gap-3" aria-labelledby="schools-title">
			<div className="grid grid-cols-2 gap-2 sm:max-w-xl">
				<Select
					label="Indicator"
					value={ind.key}
					onChange={onIndicator}
					options={available.map((i) => ({
						value: i.key,
						label: i.label,
						group: i.group,
					}))}
				/>
				<Select
					label="Report card year"
					value={String(year)}
					onChange={(y) => onYear(Number(y))}
					options={[...years].reverse().map((y) => ({ value: String(y), label: String(y) }))}
				/>
			</div>
			<figure className="flex flex-col gap-3 rounded-xl border border-line bg-card p-3 sm:p-4 dark:border-line-dark dark:bg-card-dark">
				<figcaption>
					<h2 id="schools-title" className="text-lg font-semibold">
						{district?.name} schools · {ind.label}, {yearLabel(year, ind)}
					</h2>
					<p className="text-xs text-muted dark:text-muted-dark">
						{ind.testBreak && year === 2025 && "2025 used a new test scale. "}
						{avg != null && `District: ${format(avg, ind.unit)} (gray line).`}
					</p>
				</figcaption>
				{rows.length === 0 ? (
					<p className="py-10 text-center text-sm text-muted dark:text-muted-dark">
						No school data for this year.
					</p>
				) : (
					<ul className="flex flex-col gap-2">
						{rows.map(({ s, v }) => (
							<li
								key={s.id}
								className="grid grid-cols-[minmax(0,8rem)_1fr_4.5rem] items-center gap-2 sm:grid-cols-[13rem_1fr_5rem]"
							>
								<span className="truncate text-sm" title={s.name}>
									{s.name.replace(/ (Elem|Elementary) School$/, "").replace(/ Middle School$/, " MS")}
								</span>
								<div className="relative h-6">
									<div
										className="h-full rounded-r"
										style={{
											width: `${(v / scale) * 100}%`,
											background: color,
										}}
									/>
									{avg != null && (
										<div
											aria-hidden
											className="absolute -top-1 -bottom-1 w-0.5 bg-muted dark:bg-muted-dark"
											style={{ left: `${(avg / scale) * 100}%` }}
										/>
									)}
								</div>
								<span className="tabular text-right text-sm font-semibold">{format(v, ind.unit)}</span>
							</li>
						))}
					</ul>
				)}
			</figure>
		</section>
	);
}
