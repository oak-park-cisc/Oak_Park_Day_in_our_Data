import { type KeyboardEvent, type PointerEvent, useRef, useState } from "react";

export type Series = { label: string; values: (number | null)[]; color: string; dashed?: boolean };

type Props = {
	title: string;
	years: number[];
	series: Series[];
	unit?: string;
	/** Highlighted year (e.g. the one shown on the map) */
	highlight?: number | null;
};

const W = 340;
const H = 150;
const PAD = { l: 34, r: 40, t: 10, b: 22 };

/** Small responsive line chart with a crosshair tooltip (pointer, touch and arrow keys) and a table view. */
export function LineChart({ title, years, series, unit = "%", highlight }: Props) {
	const [hover, setHover] = useState<number | null>(null);
	const svg = useRef<SVGSVGElement>(null);
	const all = series.flatMap((s) => s.values).filter((v): v is number => v != null);
	const yMax = Math.max(10, Math.ceil(Math.max(...all) / 5) * 5);
	const x = (i: number) => PAD.l + (i / Math.max(1, years.length - 1)) * (W - PAD.l - PAD.r);
	const y = (v: number) => PAD.t + (1 - v / yMax) * (H - PAD.t - PAD.b);
	const step = yMax > 20 ? 10 : 5;
	const ticks = Array.from({ length: Math.floor(yMax / step) + 1 }, (_, i) => i * step);
	const xTicks = years.map((yr, i) => [yr, i] as const).filter(([yr]) => yr % 5 === 0);

	function pick(e: PointerEvent<HTMLDivElement>) {
		const box = svg.current?.getBoundingClientRect();
		if (!box) return;
		const sx = ((e.clientX - box.left) / box.width) * W;
		const i = Math.round(((sx - PAD.l) / (W - PAD.l - PAD.r)) * (years.length - 1));
		setHover(Math.max(0, Math.min(years.length - 1, i)));
	}
	function key(e: KeyboardEvent<HTMLDivElement>) {
		if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
		e.preventDefault();
		const d = e.key === "ArrowLeft" ? -1 : 1;
		setHover((h) => Math.max(0, Math.min(years.length - 1, (h ?? years.length - 1) + d)));
	}

	const valueText = (i: number) =>
		`${years[i]}: ${series.map((s) => `${s.label} ${s.values[i] ?? "no data"}${s.values[i] != null ? unit : ""}`).join(", ")}`;

	const hi = highlight != null ? years.indexOf(highlight) : -1;
	const tip = hover != null ? hover : null;

	return (
		<figure className="space-y-1">
			<figcaption className="text-sm font-semibold">{title}</figcaption>
			{series.length > 1 && (
				<ul className="flex flex-wrap gap-x-3 text-xs text-neutral-600 dark:text-neutral-400">
					{series.map((s) => (
						<li key={s.label} className="flex items-center gap-1.5">
							<svg width="18" height="6" aria-hidden="true">
								<line
									x1="1"
									y1="3"
									x2="17"
									y2="3"
									stroke={s.color}
									strokeWidth="2"
									strokeLinecap="round"
									strokeDasharray={s.dashed ? "3 3" : undefined}
								/>
							</svg>
							{s.label}
						</li>
					))}
				</ul>
			)}
			<div
				className="relative touch-pan-y select-none rounded outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
				role="slider"
				aria-label={`${title}. Use left and right arrow keys to read each year.`}
				aria-valuemin={years[0]}
				aria-valuemax={years.at(-1)}
				aria-valuenow={years[tip ?? years.length - 1]}
				aria-valuetext={valueText(tip ?? years.length - 1)}
				tabIndex={0}
				onPointerMove={pick}
				onPointerDown={pick}
				onPointerLeave={(e) => e.pointerType === "mouse" && setHover(null)}
				onKeyDown={key}
				onBlur={() => setHover(null)}
			>
				<svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="w-full" aria-hidden="true">
					{ticks.map((t) => (
						<g key={t}>
							<line
								x1={PAD.l}
								x2={W - PAD.r}
								y1={y(t)}
								y2={y(t)}
								className="stroke-[#e1e0d9] dark:stroke-[#2c2c2a]"
								strokeWidth="1"
							/>
							<text
								x={PAD.l - 6}
								y={y(t)}
								dy="0.32em"
								textAnchor="end"
								className="fill-[#898781] text-[10px] tabular-nums"
							>
								{t}
								{unit}
							</text>
						</g>
					))}
					{xTicks.map(([yr, i]) => (
						<text key={yr} x={x(i)} y={H - 6} textAnchor="middle" className="fill-[#898781] text-[10px] tabular-nums">
							{yr}
						</text>
					))}
					{hi >= 0 && (
						<rect
							x={x(hi) - 5}
							y={PAD.t}
							width="10"
							height={H - PAD.t - PAD.b}
							className="fill-neutral-200/60 dark:fill-neutral-700/50"
						/>
					)}
					{series.map((s) => (
						<polyline
							key={s.label}
							fill="none"
							stroke={s.color}
							strokeWidth="2"
							strokeLinejoin="round"
							strokeLinecap="round"
							strokeDasharray={s.dashed ? "4 4" : undefined}
							points={s.values
								.map((v, i) => (v == null ? null : `${x(i)},${y(v)}`))
								.filter(Boolean)
								.join(" ")}
						/>
					))}
					{/* End label on the first (primary) series */}
					{(() => {
						const s = series[0];
						const last = s.values.at(-1);
						if (last == null) return null;
						return (
							<g>
								<circle
									cx={x(years.length - 1)}
									cy={y(last)}
									r="4"
									fill={s.color}
									className="stroke-white dark:stroke-neutral-950"
									strokeWidth="2"
								/>
								<text
									x={x(years.length - 1) + 8}
									y={y(last)}
									dy="0.32em"
									className="fill-neutral-700 text-[11px] font-semibold tabular-nums dark:fill-neutral-200"
								>
									{last}
									{unit}
								</text>
							</g>
						);
					})()}
					{tip != null && (
						<g>
							<line x1={x(tip)} x2={x(tip)} y1={PAD.t} y2={H - PAD.b} className="stroke-neutral-500" strokeWidth="1" />
							{series.map((s) =>
								s.values[tip] == null ? null : (
									<circle
										key={s.label}
										cx={x(tip)}
										cy={y(s.values[tip] as number)}
										r="4"
										fill={s.color}
										className="stroke-white dark:stroke-neutral-950"
										strokeWidth="2"
									/>
								),
							)}
						</g>
					)}
				</svg>
				{tip != null && (
					<div
						className="pointer-events-none absolute top-0 rounded-md bg-white px-2 py-1 text-xs shadow ring-1 ring-black/10 dark:bg-neutral-800 dark:ring-white/10"
						style={{
							left: `${(x(tip) / W) * 100}%`,
							transform: `translateX(${tip > years.length / 2 ? "-105%" : "5%"})`,
						}}
						aria-live="polite"
					>
						<p className="font-semibold">{years[tip]}</p>
						{series.map((s) => (
							<p key={s.label} className="flex items-center gap-1.5 whitespace-nowrap tabular-nums">
								<span className="inline-block h-0.5 w-3 rounded-full" style={{ background: s.color }} aria-hidden />
								{s.label}: {s.values[tip] ?? "—"}
								{s.values[tip] != null && unit}
							</p>
						))}
					</div>
				)}
			</div>
			<details className="text-xs">
				<summary className="min-h-11 cursor-pointer content-center text-neutral-600 dark:text-neutral-400">
					Show values as a table
				</summary>
				<div className="max-h-48 overflow-y-auto">
					<table className="w-full tabular-nums">
						<thead>
							<tr className="text-left text-neutral-600 dark:text-neutral-400">
								<th className="py-1 font-medium">Year</th>
								{series.map((s) => (
									<th key={s.label} className="py-1 text-right font-medium">
										{s.label}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{years.map((yr, i) => (
								<tr key={yr} className="border-t border-neutral-100 dark:border-neutral-800">
									<td className="py-0.5">{yr}</td>
									{series.map((s) => (
										<td key={s.label} className="py-0.5 text-right">
											{s.values[i] ?? "—"}
											{s.values[i] != null && unit}
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</details>
		</figure>
	);
}
