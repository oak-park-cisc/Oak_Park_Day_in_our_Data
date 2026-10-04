import { Check, Map as MapIcon, Shuffle } from "lucide-react";
import { drawCast, mergeAtFor, PRESETS } from "./engine";
import { newSeed } from "./rng";
import { BODY_SHORT } from "./text";
import type { Config, GameData, PresetId } from "./types";
import { Avatar, Btn, Card, Host, textOn } from "./ui";

export const MIN_TRIBES = 2;
export const MAX_TRIBES = 4;

export function castLimits(d: GameData, tribes: number) {
	return {
		min: Math.max(8, tribes * 3),
		max: Math.min(24, d.officials.length),
	};
}

export function validConfig(d: GameData, c: Config) {
	const { min, max } = castLimits(d, c.schools.length);
	return (
		c.schools.length >= MIN_TRIBES &&
		c.schools.length <= MAX_TRIBES &&
		c.castSize >= min &&
		c.castSize <= max
	);
}

export function Setup({
	d,
	config,
	colors,
	onChange,
	onStart,
	onShowMap,
}: {
	d: GameData;
	config: Config;
	colors: Record<string, string>;
	onChange: (c: Config) => void;
	onStart: () => void;
	onShowMap: () => void;
}) {
	const { min, max } = castLimits(d, config.schools.length);
	const cast = drawCast(d, config.seed, config.castSize);
	const ok = validConfig(d, config);
	const set = (patch: Partial<Config>) => onChange({ ...config, ...patch });

	const toggle = (id: string) => {
		const on = config.schools.includes(id);
		if (!on && config.schools.length >= MAX_TRIBES) return;
		set({
			schools: on
				? config.schools.filter((s) => s !== id)
				: [...config.schools, id],
		});
	};

	const setPreset = (p: PresetId) => {
		if (p === "custom") return set({ preset: p });
		const { castSize, finalN } = PRESETS[p];
		const next = { ...config, preset: p, castSize, finalN };
		if (
			!next.playerId ||
			!drawCast(d, next.seed, castSize).includes(next.playerId)
		)
			next.playerId = drawCast(d, next.seed, castSize)[0];
		onChange(next);
	};

	const groups: [string, typeof d.schools][] = [
		["Elementary (D97)", d.schools.filter((s) => s.level === "Elementary")],
		["Middle (D97)", d.schools.filter((s) => s.level === "Middle")],
		["High school (D200)", d.schools.filter((s) => s.level === "High")],
	];

	return (
		<div className="space-y-4 p-4">
			<div>
				<h2 className="text-2xl font-black">New season</h2>
				<p className="text-stone-600 dark:text-stone-400">
					Oak Park's elected officials compete for the title of Sole Survivor.
				</p>
			</div>
			<Host>
				Welcome to Survivor: Oak Park! Pick the schools that will be your
				tribes, set the length of the season, and choose who you'll play as.
			</Host>

			<Card>
				<div className="mb-2 flex items-center justify-between gap-2">
					<h3 className="text-lg font-bold">1. Pick 2–4 schools as tribes</h3>
					<Btn
						variant="ghost"
						className="md:hidden"
						onClick={onShowMap}
						aria-label="Pick on map"
						title="Pick on map"
					>
						<MapIcon size={18} aria-hidden /> Map
					</Btn>
				</div>
				{groups.map(([label, list]) => (
					<fieldset key={label} className="mb-2">
						<legend className="mb-1 text-sm font-semibold text-stone-500 dark:text-stone-400">
							{label}
						</legend>
						<div className="flex flex-wrap gap-2">
							{list.map((s) => {
								const on = config.schools.includes(s.id);
								const full = !on && config.schools.length >= MAX_TRIBES;
								return (
									<button
										key={s.id}
										type="button"
										aria-pressed={on}
										disabled={full}
										onClick={() => toggle(s.id)}
										title={s.mascot ? `${s.name} · ${s.mascot}` : s.name}
										className="inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 px-3 font-semibold disabled:opacity-40"
										style={
											on
												? {
														background: colors[s.id],
														borderColor: colors[s.id],
														color: textOn(colors[s.id]),
													}
												: { borderColor: "#a8a29e" }
										}
									>
										{on && <Check size={16} aria-hidden />}
										{s.short}
									</button>
								);
							})}
						</div>
					</fieldset>
				))}
				<p
					className="text-sm text-stone-500 dark:text-stone-400"
					aria-live="polite"
				>
					{config.schools.length} of {MAX_TRIBES} selected
					{config.schools.length < MIN_TRIBES ? ". Pick at least 2." : ""}
				</p>
			</Card>

			<Card>
				<h3 className="mb-2 text-lg font-bold">2. Season size</h3>
				<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
					{(["short", "classic", "long", "custom"] as PresetId[]).map((p) => (
						<button
							key={p}
							type="button"
							aria-pressed={config.preset === p}
							onClick={() => setPreset(p)}
							className={`min-h-11 rounded-lg border-2 px-2 py-1 text-left ${config.preset === p ? "border-orange-600 bg-orange-50 dark:bg-orange-950" : "border-stone-300 dark:border-stone-600"}`}
						>
							<div className="font-bold">
								{p === "custom" ? "Custom" : PRESETS[p].label}
							</div>
							<div className="text-xs text-stone-500 dark:text-stone-400">
								{p === "custom"
									? "Your rules"
									: `${PRESETS[p].castSize} cast · Final ${PRESETS[p].finalN}`}
							</div>
						</button>
					))}
				</div>
				{config.preset === "custom" && (
					<div className="mt-3 flex flex-wrap items-end gap-4">
						<label className="flex flex-col text-sm font-semibold">
							Castaways ({min}–{max})
							<input
								type="number"
								inputMode="numeric"
								min={min}
								max={max}
								value={config.castSize}
								onChange={(e) => set({ castSize: Number(e.target.value) })}
								className="mt-1 min-h-11 w-28 rounded-lg border border-stone-300 bg-white px-3 dark:border-stone-600 dark:bg-stone-800"
							/>
						</label>
						<fieldset className="text-sm font-semibold">
							<legend>Finalists</legend>
							<div className="mt-1 flex gap-2">
								{([2, 3] as const).map((n) => (
									<label
										key={n}
										className="flex min-h-11 items-center gap-2 rounded-lg border border-stone-300 px-3 dark:border-stone-600"
									>
										<input
											type="radio"
											name="finalN"
											checked={config.finalN === n}
											onChange={() => set({ finalN: n })}
										/>
										Final {n}
									</label>
								))}
							</div>
						</fieldset>
					</div>
				)}
				{ok && (
					<p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
						Merge at {mergeAtFor(config.castSize, config.finalN)} players.
					</p>
				)}
				{!ok && config.schools.length >= MIN_TRIBES && (
					<p
						className="mt-2 text-sm font-semibold text-red-700 dark:text-red-400"
						role="alert"
					>
						Choose {min}–{max} castaways for {config.schools.length} tribes.
					</p>
				)}
			</Card>

			<Card>
				<div className="mb-2 flex items-center justify-between gap-2">
					<h3 className="text-lg font-bold">3. Choose your castaway</h3>
					<Btn
						variant="outline"
						onClick={() => {
							const seed = newSeed();
							onChange({
								...config,
								seed,
								playerId: drawCast(d, seed, config.castSize)[0],
							});
						}}
						title="Draw a new random cast"
					>
						<Shuffle size={18} aria-hidden /> Redraw
					</Btn>
				</div>
				<p className="mb-2 text-sm text-stone-500 dark:text-stone-400">
					A random draw of {cast.length} of {d.officials.length} Oak Park
					elected officials.
				</p>
				<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
					{cast.map((id) => {
						const o = d.officials.find((x) => x.id === id);
						if (!o) return null;
						const on = config.playerId === id;
						return (
							<button
								key={id}
								type="button"
								aria-pressed={on}
								onClick={() => set({ playerId: id })}
								className={`flex min-h-14 items-center gap-3 rounded-lg border-2 p-2 text-left ${on ? "border-orange-600 bg-orange-50 dark:bg-orange-950" : "border-transparent hover:bg-stone-100 dark:hover:bg-stone-800"}`}
							>
								<Avatar
									d={d}
									id={id}
									color={on ? "#ea580c" : "#a8a29e"}
									size={44}
								/>
								<span className="min-w-0">
									<span className="block truncate font-semibold">{o.name}</span>
									<span className="block truncate text-sm text-stone-500 dark:text-stone-400">
										{o.role}, {BODY_SHORT[o.body]}
									</span>
								</span>
							</button>
						);
					})}
				</div>
			</Card>

			<div className="sticky bottom-0 -mx-4 border-t border-stone-200 bg-stone-100/95 p-4 backdrop-blur dark:border-stone-800 dark:bg-stone-950/95">
				<Btn className="w-full text-lg" disabled={!ok} onClick={onStart}>
					Start the season
				</Btn>
			</div>
		</div>
	);
}
