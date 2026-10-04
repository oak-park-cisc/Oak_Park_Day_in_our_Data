import {
	Accessibility,
	BookOpen,
	ChartLine,
	ChartScatter,
	ChevronDown,
	Landmark,
	Lightbulb,
	Map as MapIcon,
	School,
	Target,
	Telescope,
	TreeDeciduous,
	X,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { AboutData } from "./components/AboutData";
import { ChangeTable } from "./components/ChangeTable";
import { Demographics } from "./components/Demographics";
import { DistrictPicker, type Series } from "./components/DistrictPicker";
import { KeyFindings } from "./components/KeyFindings";
import { MapView } from "./components/MapView";
import { PrioritiesView } from "./components/PrioritiesView";
import { type ScatterSettings, ScatterView } from "./components/ScatterView";
import { SchoolsView } from "./components/SchoolsView";
import { Select } from "./components/Select";
import { type Levies, TaxesView } from "./components/TaxesView";
import { TrendChart } from "./components/TrendChart";
import {
	ANCHORS,
	D97,
	D200,
	type Dataset,
	GROUPS,
	INDICATOR_BY_KEY,
	INDICATORS,
	loadDataset,
	STATE,
	SUGGESTED,
} from "./data";
import { useTheme } from "./theme";

const TABS = [
	{ id: "priorities", label: "Priorities", icon: Target },
	{ id: "taxes", label: "Taxes & value", icon: Landmark },
	{ id: "trends", label: "Trends", icon: ChartLine },
	{ id: "scatter", label: "Cook County", icon: ChartScatter },
	{ id: "schools", label: "Schools", icon: School },
	{ id: "map", label: "Map", icon: MapIcon },
] as const;
const KEY_MEASURES = "Key measures";
const TOPICS = [KEY_MEASURES, ...GROUPS];
type Tab = (typeof TABS)[number]["id"];

const OVERVIEW_KEYS = ["enrollment", "pct_low_income", "operating_per_pupil", "ela_prof"];
const CHANGE_KEYS = [
	"enrollment",
	"pct_low_income",
	"pct_white",
	"pct_black",
	"pct_hispanic",
	"operating_per_pupil",
	"teacher_salary",
	"ela_prof",
	"math_prof",
	"chronic_absenteeism",
	"grad_rate_4yr",
];
const MAX_EXTRA = 6;
const STORE = "op-schools:v4";

type TextScale = "normal" | "large" | "xlarge";

type A11y = { textScale: TextScale; reduceMotion: boolean };

const A11Y_DEFAULT: A11y = { textScale: "normal", reduceMotion: false };

type Saved = {
	extras: { id: string; slot: number }[];
	tab: Tab;
	group: string;
	showState: boolean;
	fromYear: number;
	toYear: number;
	demoYear: number;
	scatter: ScatterSettings;
	schoolDistrict: string;
	schoolIndicator: string;
	schoolYear: number;
	note: string | null;
	a11y: A11y;
};

const DEFAULTS: Saved = {
	extras: SUGGESTED.slice(0, 4).map((id, i) => ({ id, slot: i + 2 })),
	tab: "taxes",
	group: KEY_MEASURES,
	showState: true,
	fromYear: 2020,
	toYear: 2025,
	demoYear: 2025,
	scatter: {
		x: "operating_per_pupil",
		y: "ela_prof",
		area: "cook",
		type: "elementary",
		year: 2024,
	},
	schoolDistrict: D97,
	schoolIndicator: "ela_prof",
	schoolYear: 2024,
	note: null,
	a11y: A11Y_DEFAULT,
};

function loadSaved(): Saved {
	try {
		const raw = localStorage.getItem(STORE);
		if (!raw) return DEFAULTS;
		const parsed = JSON.parse(raw) as Partial<Saved>;
		return { ...DEFAULTS, ...parsed, a11y: { ...A11Y_DEFAULT, ...(parsed.a11y ?? {}) } };
	} catch {
		return DEFAULTS;
	}
}

export default function App() {
	const t = useTheme();
	const [districts, setDistricts] = useState<Dataset | null>(null);
	const [schools, setSchools] = useState<Dataset | null>(null);
	const [levies, setLevies] = useState<Levies | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [s, setS] = useState<Saved>(loadSaved);
	const [showA11y, setShowA11y] = useState(false);
	const update = (patch: Partial<Saved>) => setS((prev) => ({ ...prev, ...patch }));
	const go = (patch: Partial<Saved>) => {
		update(patch);
		const reduce = s.a11y.reduceMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		requestAnimationFrame(() =>
			document
				.getElementById("learn-more")
				?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" }),
		);
	};

	useEffect(() => {
		const el = document.documentElement;
		el.style.fontSize = s.a11y.textScale === "large" ? "112.5%" : s.a11y.textScale === "xlarge" ? "125%" : "";
		el.classList.toggle("force-reduced-motion", s.a11y.reduceMotion);
	}, [s.a11y]);

	useEffect(() => {
		Promise.all([loadDataset("districts.json"), loadDataset("schools.json")])
			.then(([d, sc]) => {
				setDistricts(d);
				setSchools(sc);
			})
			.catch((e: Error) => setError(e.message));
		fetch(`${import.meta.env.BASE_URL}data/levies.json`)
			.then((r) => (r.ok ? r.json() : null))
			.then(setLevies)
			.catch(() => setLevies(null));
	}, []);

	useEffect(() => {
		localStorage.setItem(STORE, JSON.stringify(s));
	}, [s]);

	const byId = useMemo(() => new Map(districts?.rows.map((r) => [r.id, r]) ?? []), [districts]);
	const state = byId.get(STATE);
	const series: Series[] = useMemo(() => {
		const out: Series[] = [];
		ANCHORS.forEach((id, i) => {
			const e = byId.get(id);
			if (e)
				out.push({
					id,
					name: e.name,
					color: t.series[i],
					entity: e,
					anchor: true,
				});
		});
		for (const x of s.extras) {
			const e = byId.get(x.id);
			if (e)
				out.push({
					id: x.id,
					name: e.name,
					color: t.series[x.slot],
					entity: e,
				});
		}
		return out;
	}, [byId, s.extras, t]);

	const addDistrict = (id: string) =>
		setS((prev) => {
			if (prev.extras.some((x) => x.id === id) || ANCHORS.includes(id) || prev.extras.length >= MAX_EXTRA)
				return prev;
			const used = new Set(prev.extras.map((x) => x.slot));
			const slot = [2, 3, 4, 5, 6, 7].find((n) => !used.has(n)) ?? 7;
			return { ...prev, extras: [...prev.extras, { id, slot }] };
		});
	const removeDistrict = (id: string) => update({ extras: s.extras.filter((x) => x.id !== id) });

	const onTablistKey = (e: React.KeyboardEvent) => {
		const buttons = Array.from(
			(e.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('button[role="tab"]'),
		);
		const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
		if (current < 0) return;
		let next = current;
		if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (current + 1) % buttons.length;
		else if (e.key === "ArrowLeft" || e.key === "ArrowUp")
			next = (current - 1 + buttons.length) % buttons.length;
		else if (e.key === "Home") next = 0;
		else if (e.key === "End") next = buttons.length - 1;
		else return;
		e.preventDefault();
		buttons[next].focus();
		buttons[next].click();
	};

	if (error)
		return (
			<main className="p-6">
				<p role="alert">Couldn't load the data: {error}</p>
			</main>
		);

	const years = districts?.years ?? [];
	const stateIf = s.showState ? state : undefined;

	return (
		<div className="mx-auto flex min-h-dvh max-w-7xl flex-col gap-4 px-3 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6">
			<a
				href="#learn-panel"
				className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white dark:focus:bg-accent-dark"
			>
				Skip to views
			</a>
			<header className="flex flex-col gap-2">
				<div className="flex items-center gap-2">
					<span
						aria-hidden
						className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-white dark:bg-accent-dark"
					>
						<TreeDeciduous size={20} />
					</span>
					<p className="text-sm font-semibold tracking-tight text-accent dark:text-accent-dark">
						Oak Park, Illinois · Day in Our Data
					</p>
					<button
						type="button"
						aria-expanded={showA11y}
						aria-controls="a11y-panel"
						aria-label="Accessibility options"
						title="Accessibility options"
						onClick={() => setShowA11y((v) => !v)}
						className="ml-auto flex min-h-11 min-w-11 items-center justify-center rounded-lg text-ink-2 hover:bg-line dark:text-ink-2-dark dark:hover:bg-line-dark"
					>
						<Accessibility size={20} aria-hidden />
					</button>
				</div>
				<h1 className="text-2xl font-bold tracking-tight sm:text-3xl">How are our schools doing?</h1>
				<p className="text-sm text-ink-2 dark:text-ink-2-dark">
					Oak Park D97 and OPRF D200 compared with other districts and their own past. Illinois Report Card,
					2018–2025.
				</p>
				<div aria-hidden className="prairie-band max-w-72" />
			</header>

			{showA11y && (
				<section
					id="a11y-panel"
					aria-label="Accessibility options"
					className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl border border-line bg-card p-4 dark:border-line-dark dark:bg-card-dark"
				>
					<fieldset className="flex items-center gap-3 border-0 p-0">
						<legend className="sr-only">Text size</legend>
						<span aria-hidden className="text-sm font-medium">
							Text size
						</span>
						<div className="flex gap-1.5">
							{(
								[
									{ id: "normal", label: "A", cls: "text-sm" },
									{ id: "large", label: "A", cls: "text-base" },
									{ id: "xlarge", label: "A", cls: "text-lg" },
								] as const
							).map((opt) => (
								<button
									key={opt.id}
									type="button"
									aria-pressed={s.a11y.textScale === opt.id}
									aria-label={`${opt.id === "normal" ? "Normal" : opt.id === "large" ? "Large" : "Extra large"} text size`}
									onClick={() => update({ a11y: { ...s.a11y, textScale: opt.id } })}
									className={`min-h-11 min-w-11 rounded-lg border border-line ${opt.cls} font-semibold aria-pressed:bg-ink aria-pressed:text-page dark:border-line-dark dark:aria-pressed:bg-ink-dark dark:aria-pressed:text-page-dark`}
								>
									{opt.label}
								</button>
							))}
						</div>
					</fieldset>
					<label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium">
						<input
							type="checkbox"
							checked={s.a11y.reduceMotion}
							onChange={(e) => update({ a11y: { ...s.a11y, reduceMotion: e.target.checked } })}
							className="size-5 accent-[var(--color-accent)]"
						/>
						Reduce motion
					</label>
				</section>
			)}

			{!districts || !schools ? (
				<p className="py-20 text-center text-ink-2 dark:text-ink-2-dark" aria-live="polite">
					Loading report card data…
				</p>
			) : (
				<>
					<KeyFindings
						districts={districts}
						levies={levies}
						onGo={(link) => {
							const patch: Partial<Saved> = { note: link.note ?? null };
							if (link.extras) {
								patch.extras = link.extras.slice(0, MAX_EXTRA).map((id, n) => ({ id, slot: n + 2 }));
								patch.showState = true;
							}
							if (link.tab === "trends") go({ ...patch, tab: "trends", group: link.group });
							else if (link.tab === "scatter")
								go({
									...patch,
									tab: "scatter",
									scatter: { area: "cook", x: link.x, y: link.y, type: link.type, year: link.year },
								});
							else go({ ...patch, tab: "taxes" });
						}}
					/>

					<section id="learn-more" className="flex scroll-mt-4 flex-col gap-3" aria-labelledby="learn-title">
						<h2 id="learn-title" className="flex items-center gap-2 text-xl font-bold">
							<Telescope size={22} aria-hidden /> Learn more
						</h2>
						<div
							role="tablist"
							aria-label="Learn more"
							onKeyDown={onTablistKey}
							className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6"
						>
							{TABS.map(({ id, label, icon: Icon }) => (
								<button
									key={id}
									type="button"
									role="tab"
									id={`tab-${id}`}
									aria-selected={s.tab === id}
									aria-controls="learn-panel"
									onClick={() => update({ tab: id, note: null })}
									className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line bg-card px-3 text-sm font-semibold hover:bg-line aria-selected:border-ink aria-selected:bg-ink aria-selected:text-page dark:border-line-dark dark:bg-card-dark dark:hover:bg-line-dark dark:aria-selected:border-ink-dark dark:aria-selected:bg-ink-dark dark:aria-selected:text-page-dark"
								>
									<Icon size={18} aria-hidden />
									{label}
								</button>
							))}
						</div>
						<div
							key={s.tab}
							id="learn-panel"
							role="tabpanel"
							tabIndex={-1}
							aria-labelledby={`tab-${s.tab}`}
							className="fade-up flex flex-col gap-4 rounded-2xl border border-line p-3 sm:p-5 dark:border-line-dark"
						>
							{s.note && (
								<div
									role="status"
									className="flex items-start gap-3 rounded-xl border border-accent/40 bg-accent/10 p-3 text-sm dark:border-accent-dark/40 dark:bg-accent-dark/15"
								>
									<Lightbulb
										size={20}
										aria-hidden
										className="mt-0.5 shrink-0 text-accent dark:text-accent-dark"
									/>
									<p className="flex-1">
										<strong className="font-semibold">What to look for: </strong>
										{s.note}
									</p>
									<button
										type="button"
										onClick={() => update({ note: null })}
										aria-label="Dismiss"
										title="Dismiss"
										className="-m-2 flex size-11 shrink-0 items-center justify-center rounded-lg text-ink-2 hover:bg-line dark:text-ink-2-dark dark:hover:bg-line-dark"
									>
										<X size={18} />
									</button>
								</div>
							)}
							{(s.tab === "trends" || s.tab === "scatter") && (
								<section
									aria-label="Districts"
									className="rounded-xl border border-line bg-card p-3 dark:border-line-dark dark:bg-card-dark"
								>
									<DistrictPicker
										series={series}
										all={districts.rows}
										byId={byId}
										maxExtra={MAX_EXTRA}
										onAdd={addDistrict}
										onRemove={removeDistrict}
										showState={s.showState}
										onToggleState={(showState) => update({ showState })}
										stateColor={t.stateLine}
									/>
								</section>
							)}

							<main className="flex flex-col gap-4">
								{s.tab === "trends" && (
									<>
										<div role="toolbar" aria-label="Topic" className="flex flex-wrap gap-1.5">
											{TOPICS.map((g) => (
												<button
													key={g}
													type="button"
													aria-pressed={s.group === g}
													onClick={() => update({ group: g, note: null })}
													className="min-h-11 rounded-full border border-line px-4 text-sm font-medium aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-page dark:border-line-dark dark:aria-pressed:border-ink-dark dark:aria-pressed:bg-ink-dark dark:aria-pressed:text-page-dark"
												>
													{g}
												</button>
											))}
										</div>
										{s.group === KEY_MEASURES ? (
											<>
												<div className="grid gap-3 md:grid-cols-2">
													{OVERVIEW_KEYS.map((k) => (
														<Card key={k}>
															<TrendChart
																ind={INDICATOR_BY_KEY[k]}
																series={series}
																state={stateIf}
																years={years}
																compact
																height={220}
															/>
														</Card>
													))}
												</div>
												<section className="flex flex-col gap-2" aria-labelledby="change-title">
													<div className="flex flex-wrap items-end justify-between gap-2">
														<div>
															<h2 id="change-title" className="text-lg font-semibold">
																Then vs. now
															</h2>
															<p className="text-xs text-muted dark:text-muted-dark">
																Latest value and change. Test scores stop at 2024 unless both years are 2025.
															</p>
														</div>
														<div className="flex gap-2">
															<Select
																label="From"
																value={String(s.fromYear)}
																onChange={(v) => update({ fromYear: Number(v) })}
																options={years
																	.filter((y) => y < s.toYear)
																	.map((y) => ({ value: String(y), label: String(y) }))}
															/>
															<Select
																label="To"
																value={String(s.toYear)}
																onChange={(v) => update({ toYear: Number(v) })}
																options={years
																	.filter((y) => y > s.fromYear)
																	.map((y) => ({ value: String(y), label: String(y) }))}
															/>
														</div>
													</div>
													<ChangeTable
														indicators={CHANGE_KEYS.map((k) => INDICATOR_BY_KEY[k])}
														series={series}
														years={years}
														fromYear={s.fromYear}
														toYear={s.toYear}
													/>
												</section>
											</>
										) : (
											<>
												{s.group === "Students" && (
													<Card>
														<div className="mb-3 max-w-40">
															<Select
																label="Report card year"
																value={String(s.demoYear)}
																onChange={(v) => update({ demoYear: Number(v) })}
																options={[...years]
																	.reverse()
																	.map((y) => ({ value: String(y), label: String(y) }))}
															/>
														</div>
														<Demographics series={series} state={stateIf} years={years} year={s.demoYear} />
													</Card>
												)}
												<div className="grid gap-3 md:grid-cols-2">
													{INDICATORS.filter((i) => i.group === s.group).map((ind) => (
														<Card key={ind.key}>
															<TrendChart
																ind={ind}
																series={series}
																state={stateIf}
																years={years}
																compact
																height={220}
															/>
														</Card>
													))}
												</div>
											</>
										)}
									</>
								)}

								{s.tab === "scatter" && (
									<ScatterView
										all={districts.rows}
										years={years}
										series={series}
										settings={s.scatter}
										onChange={(scatter) => update({ scatter, note: null })}
										onAdd={addDistrict}
										canAdd={s.extras.length < MAX_EXTRA}
									/>
								)}

								{s.tab === "schools" && (
									<>
										<div role="toolbar" aria-label="District" className="flex gap-1.5">
											{[D97, D200].map((id) => (
												<button
													key={id}
													type="button"
													aria-pressed={s.schoolDistrict === id}
													onClick={() => update({ schoolDistrict: id })}
													className="min-h-11 rounded-full border border-line px-4 text-sm font-medium aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-page dark:border-line-dark dark:aria-pressed:border-ink-dark dark:aria-pressed:bg-ink-dark dark:aria-pressed:text-page-dark"
												>
													{id === D97 ? "D97 schools" : "OPRF High School"}
												</button>
											))}
										</div>
										<SchoolsView
											schools={schools}
											district={byId.get(s.schoolDistrict)}
											color={t.series[s.schoolDistrict === D97 ? 0 : 1]}
											indicator={s.schoolIndicator}
											year={s.schoolYear}
											onIndicator={(schoolIndicator) => update({ schoolIndicator })}
											onYear={(schoolYear) => update({ schoolYear })}
										/>
									</>
								)}

								{s.tab === "priorities" && <PrioritiesView districts={districts} schools={schools} />}

								{s.tab === "map" && <MapView schools={schools} districts={districts} />}

								{s.tab === "taxes" && (
									<TaxesView
										districts={districts}
										levies={levies}
										onScatter={(x, type) =>
											go({
												tab: "scatter",
												note: "Higher school tax rates don't go with higher scores. Districts with the highest rates tend to have the least taxable property and more low-income students.",
												scatter: { ...s.scatter, area: "cook", x, y: "ela_prof", type, year: 2024 },
											})
										}
									/>
								)}
							</main>
						</div>
					</section>

					<details
						id="about"
						className="group rounded-xl border border-line bg-card dark:border-line-dark dark:bg-card-dark"
					>
						<summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-4 font-semibold [&::-webkit-details-marker]:hidden">
							<span className="flex flex-wrap items-center gap-x-2">
								<BookOpen size={18} aria-hidden /> About the data
								<span className="text-sm font-normal text-muted dark:text-muted-dark">
									caveats and sources
								</span>
							</span>
							<ChevronDown
								size={18}
								aria-hidden
								className="shrink-0 transition-transform group-open:rotate-180"
							/>
						</summary>
						<div className="px-4 pb-4">
							<AboutData />
						</div>
					</details>

					<footer className="flex flex-col gap-1.5 border-t border-line pt-4 text-xs text-muted dark:border-line-dark dark:text-muted-dark">
						<p className="flex items-center gap-1.5">
							<TreeDeciduous size={14} aria-hidden />
							<span>
								Oak Park, Illinois — home to the world&rsquo;s largest collection of Frank Lloyd Wright
								buildings and Ernest Hemingway&rsquo;s birthplace.
							</span>
						</p>
						<p>
							Data: Illinois State Board of Education Report Card, 2018–2025. Built by neighbors, for
							neighbors, for the Day in Our Data project.
						</p>
					</footer>
				</>
			)}
		</div>
	);
}

function Card({ children }: { children: ReactNode }) {
	return (
		<div className="min-w-0 rounded-xl border border-line bg-card p-3 sm:p-4 dark:border-line-dark dark:bg-card-dark">
			{children}
		</div>
	);
}
