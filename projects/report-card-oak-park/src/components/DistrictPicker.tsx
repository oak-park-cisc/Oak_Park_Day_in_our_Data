import { Lock, Plus, Search, X } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";
import { type Entity, SUGGESTED, typeLabel } from "../data";

export type Series = {
	id: string;
	name: string;
	color: string;
	entity: Entity;
	anchor?: boolean;
};

type Props = {
	series: Series[];
	all: Entity[];
	byId: Map<string, Entity>;
	maxExtra: number;
	onAdd: (id: string) => void;
	onRemove: (id: string) => void;
	showState: boolean;
	onToggleState: (v: boolean) => void;
	stateColor: string;
};

export function shortName(name: string) {
	return name
		.replace(/^Oak Park - River Forest SD 200$/, "OPRF D200")
		.replace(/^Oak Park ESD 97$/, "Oak Park D97")
		.replace(/ (C?C?SD|ESD|CUSD|CHSD|Twp HSD|HSD|Twp SD|SD|UD|USD) (\d+)$/, " $2");
}

export function DistrictPicker({
	series,
	all,
	byId,
	maxExtra,
	onAdd,
	onRemove,
	showState,
	onToggleState,
	stateColor,
}: Props) {
	const [q, setQ] = useState("");
	const [open, setOpen] = useState(false);
	const [active, setActive] = useState(0);
	const listId = useId();
	const inputRef = useRef<HTMLInputElement>(null);
	const chosen = new Set(series.map((s) => s.id));
	const extras = series.filter((s) => !s.anchor).length;
	const full = extras >= maxExtra;

	const matches = useMemo(() => {
		const t = q.trim().toLowerCase();
		const pool = all.filter((e) => e.type !== "state" && !chosen.has(e.id));
		if (!t) return SUGGESTED.map((id) => byId.get(id)).filter((e): e is Entity => !!e && !chosen.has(e.id));
		const words = t.split(/\s+/);
		return pool
			.filter((e) => {
				const hay = `${e.name} ${e.city} ${e.county}`.toLowerCase();
				return words.every((w) => hay.includes(w));
			})
			.slice(0, 8);
	}, [q, all, byId, chosen]);

	const pick = (id: string) => {
		onAdd(id);
		setQ("");
		setActive(0);
		inputRef.current?.focus();
	};

	return (
		<div className="flex flex-col gap-2">
			<ul
				className="scrollbar-none -mx-3 flex gap-1.5 overflow-x-auto px-3 sm:mx-0 sm:flex-wrap sm:px-0"
				aria-label="Districts being compared"
			>
				{series.map((s) => (
					<li
						key={s.id}
						className="flex min-h-9 shrink-0 items-center gap-2 rounded-full border border-line bg-card py-1 pr-1 pl-3 text-sm dark:border-line-dark dark:bg-card-dark"
					>
						<span aria-hidden className="h-0.5 w-4 rounded" style={{ background: s.color, height: 3 }} />
						<span className="font-medium">{shortName(s.name)}</span>
						{s.anchor ? (
							<span
								className="flex size-7 items-center justify-center text-muted dark:text-muted-dark"
								title="Always shown"
							>
								<Lock size={14} aria-label="Always shown" />
							</span>
						) : (
							<button
								type="button"
								onClick={() => onRemove(s.id)}
								className="flex size-7 items-center justify-center rounded-full text-ink-2 hover:bg-line focus-visible:outline-2 focus-visible:outline-accent dark:text-ink-2-dark dark:hover:bg-line-dark"
								aria-label={`Remove ${s.name}`}
								title={`Remove ${s.name}`}
							>
								<X size={16} />
							</button>
						)}
					</li>
				))}
				<li>
					<label className="flex min-h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full border whitespace-nowrap border-line px-3 py-1 text-sm text-ink-2 dark:border-line-dark dark:text-ink-2-dark">
						<input
							type="checkbox"
							checked={showState}
							onChange={(e) => onToggleState(e.target.checked)}
							className="size-4 accent-accent"
						/>
						<span aria-hidden className="w-4 border-t-2 border-dashed" style={{ borderColor: stateColor }} />
						Illinois average
					</label>
				</li>
			</ul>

			<div className="relative max-w-md">
				<Search
					size={18}
					aria-hidden
					className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted dark:text-muted-dark"
				/>
				<input
					ref={inputRef}
					type="search"
					role="combobox"
					aria-expanded={open && !full && matches.length > 0}
					aria-controls={listId}
					aria-autocomplete="list"
					aria-activedescendant={open && matches[active] ? `${listId}-${matches[active].id}` : undefined}
					aria-label="Add a district to compare"
					placeholder={
						full
							? `Up to ${maxExtra} districts. Remove one to add another.`
							: "Add a district: name, town or county"
					}
					disabled={full}
					value={q}
					onChange={(e) => {
						setQ(e.target.value);
						setActive(0);
						setOpen(true);
					}}
					onFocus={() => setOpen(true)}
					onBlur={() => setTimeout(() => setOpen(false), 150)}
					onKeyDown={(e) => {
						if (e.key === "ArrowDown") {
							e.preventDefault();
							setOpen(true);
							setActive((a) => Math.min(a + 1, matches.length - 1));
						} else if (e.key === "ArrowUp") {
							e.preventDefault();
							setActive((a) => Math.max(a - 1, 0));
						} else if (e.key === "Enter" && open && matches[active]) {
							e.preventDefault();
							pick(matches[active].id);
						} else if (e.key === "Escape") {
							setOpen(false);
						}
					}}
					className="min-h-11 w-full rounded-lg border border-line bg-card py-2 pr-3 pl-10 text-base placeholder:text-muted focus:outline-2 focus:outline-accent disabled:opacity-60 dark:border-line-dark dark:bg-card-dark dark:placeholder:text-muted-dark"
				/>
				{open && !full && matches.length > 0 && (
					<div
						id={listId}
						role="listbox"
						aria-label={q ? "Matching districts" : "Suggested nearby districts"}
						className="absolute z-20 mt-1 max-h-[min(20rem,50dvh)] w-full overflow-y-auto rounded-lg border border-line bg-card py-1 shadow-lg dark:border-line-dark dark:bg-card-dark"
					>
						{!q && (
							<div className="px-3 pt-1 pb-1 text-xs text-muted dark:text-muted-dark" role="presentation">
								Nearby districts
							</div>
						)}
						{matches.map((e, i) => (
							<div
								key={e.id}
								tabIndex={-1}
								id={`${listId}-${e.id}`}
								role="option"
								aria-selected={i === active}
								onMouseDown={(ev) => {
									ev.preventDefault();
									pick(e.id);
								}}
								onMouseEnter={() => setActive(i)}
								className={`flex min-h-11 cursor-pointer items-center gap-2 px-3 py-1.5 ${i === active ? "bg-line dark:bg-line-dark" : ""}`}
							>
								<Plus size={16} aria-hidden className="shrink-0 text-muted dark:text-muted-dark" />
								<span className="min-w-0">
									<span className="block truncate">{e.name}</span>
									<span className="block text-xs text-muted dark:text-muted-dark">
										{[typeLabel(e.type), e.city, e.county && `${e.county} County`]
											.filter(Boolean)
											.join(" · ")}
									</span>
								</span>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
