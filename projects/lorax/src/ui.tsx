export const pct = (v: number) => `${Math.round(v * 100)}%`;

export function Stat({ label, value }: { label: string; value: string | number }) {
	return (
		<div className="rounded-md bg-neutral-100 px-2 py-2 dark:bg-neutral-900">
			<dt className="text-xs text-neutral-600 dark:text-neutral-400">{label}</dt>
			<dd className="text-base font-semibold tabular-nums">{value}</dd>
		</div>
	);
}

export function GenusRow({ label, latin, n, total }: { label: string; latin?: string; n: number; total: number }) {
	const share = n / total;
	return (
		<li>
			<div className="flex justify-between gap-2 text-sm">
				<span className="min-w-0 truncate pr-1">
					{label} {latin && <span className="text-xs text-neutral-500 italic dark:text-neutral-400">{latin}</span>}
				</span>
				<span className="shrink-0 tabular-nums">
					{n} · {pct(share)}
				</span>
			</div>
			<div className="relative mt-1 h-2 rounded-full bg-neutral-100 dark:bg-neutral-800">
				<div className="h-2 rounded-full bg-[#2a78d6] dark:bg-[#3987e5]" style={{ width: `${share * 100}%` }} />
				<div
					className="absolute -top-0.5 h-3 border-l-2 border-dashed border-neutral-500"
					style={{ left: "20%" }}
					aria-hidden
				/>
			</div>
		</li>
	);
}
