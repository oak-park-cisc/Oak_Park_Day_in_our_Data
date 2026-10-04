import { Flag, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { type Majority, meetsMajority } from "./majority";
import type { BlockProps } from "./types";

type Props = {
	value: Majority;
	onChange: (m: Majority) => void;
	blocks: BlockProps[];
};

const SELECT =
	"h-11 w-full rounded-md border border-neutral-300 bg-white px-2 text-base dark:border-neutral-700 dark:bg-neutral-900";

/** Header button + dropdown that limits every view to blocks where one species or genus is a majority. */
export function MajorityMenu({ value, onChange, blocks }: Props) {
	const [open, setOpen] = useState(false);
	const root = useRef<HTMLDivElement>(null);
	const panelId = useId();
	const set = (patch: Partial<Majority>) => onChange({ ...value, ...patch });

	// Close on outside tap or Escape.
	useEffect(() => {
		if (!open) return;
		const onDown = (e: PointerEvent) => {
			if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
		};
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
		document.addEventListener("pointerdown", onDown);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("pointerdown", onDown);
			document.removeEventListener("keydown", onKey);
		};
	}, [open]);

	const count = blocks.filter((b) => meetsMajority(b, value)).length;
	const count10 = blocks.filter((b) => meetsMajority(b, { ...value, minTrees: Math.max(10, value.minTrees) })).length;

	return (
		<div ref={root} className="relative">
			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				aria-expanded={open}
				aria-controls={panelId}
				title="Majority-tree flag"
				className={`flex h-11 items-center gap-1.5 rounded-md border px-2.5 text-sm ${
					value.on
						? "border-red-700 bg-red-50 text-red-900 dark:border-red-400 dark:bg-red-950/60 dark:text-red-100"
						: "border-neutral-300 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
				}`}
			>
				<Flag className="size-4" aria-hidden />
				<span className="hidden sm:inline">Majority</span>
				<span className="sr-only sm:hidden">Majority-tree flag</span>
				{value.on && <span className="text-xs font-semibold tabular-nums">{count}</span>}
			</button>

			{open && (
				<div
					id={panelId}
					role="dialog"
					aria-label="Majority-tree flag"
					className="absolute top-12 right-0 z-[1100] w-[min(20rem,calc(100vw-1.5rem))] space-y-3 rounded-lg border border-neutral-200 bg-white p-3 text-sm shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
				>
					<div className="flex items-start justify-between gap-2">
						<p className="font-semibold">Flag majority blocks</p>
						<button
							type="button"
							onClick={() => setOpen(false)}
							aria-label="Close"
							title="Close"
							className="-mt-2 -mr-2 grid size-11 place-items-center rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800"
						>
							<X className="size-4" aria-hidden />
						</button>
					</div>

					<label className="flex min-h-11 items-center justify-between gap-3 rounded-md bg-neutral-100 px-3 dark:bg-neutral-800">
						<span>Show only flagged blocks</span>
						<input
							type="checkbox"
							role="switch"
							aria-checked={value.on}
							checked={value.on}
							onChange={(e) => set({ on: e.target.checked })}
							className="size-5 accent-red-700"
						/>
					</label>

					<fieldset className="space-y-1">
						<legend className="mb-1">One tree type makes up the majority, counting by</legend>
						<div className="grid grid-cols-2 gap-2">
							{(["species", "genus"] as const).map((b) => (
								<label
									key={b}
									className="flex min-h-11 items-center gap-2 rounded-md border border-neutral-300 px-3 has-[:checked]:border-blue-600 has-[:checked]:bg-blue-50 dark:border-neutral-700 dark:has-[:checked]:border-blue-400 dark:has-[:checked]:bg-blue-950"
								>
									<input
										type="radio"
										name="majority-basis"
										checked={value.basis === b}
										onChange={() => set({ basis: b })}
										className="size-4 accent-blue-600"
									/>
									{b === "species" ? "Species" : "Genus"}
								</label>
							))}
						</div>
					</fieldset>

					<div className="grid grid-cols-2 gap-2">
						<label className="space-y-1">
							<span>Threshold</span>
							<select
								className={SELECT}
								value={value.threshold}
								onChange={(e) => set({ threshold: Number(e.target.value) })}
							>
								{[0.5, 0.55, 0.6, 0.75].map((t) => (
									<option key={t} value={t}>
										{Math.round(t * 100)}% or more
									</option>
								))}
							</select>
						</label>
						<label className="space-y-1">
							<span>Trees on block</span>
							<select
								className={SELECT}
								value={value.minTrees}
								onChange={(e) => set({ minTrees: Number(e.target.value) })}
							>
								<option value={1}>Any number</option>
								<option value={5}>5 or more</option>
								<option value={10}>10 or more</option>
							</select>
						</label>
					</div>

					<p aria-live="polite">
						<strong className="tabular-nums">{count}</strong> {count === 1 ? "block" : "blocks"} flagged
						{value.minTrees < 10 && <> ({count10} with 10+ trees)</>}.
					</p>
					<p className="text-xs text-neutral-600 dark:text-neutral-400">
						When on, other blocks are removed from the map, list and downloads, and Near me shows only trees on flagged
						blocks. Small blocks reach a majority easily.
					</p>
				</div>
			)}
		</div>
	);
}
