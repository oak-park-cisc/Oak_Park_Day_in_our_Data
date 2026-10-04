import {
	ArrowRight,
	Calculator,
	CalendarX,
	ChevronDown,
	CircleHelp,
	Compass,
	Flag,
	GraduationCap,
	Info,
	type LucideIcon,
	PiggyBank,
	Target,
	TrendingUp,
	TriangleAlert,
	Trophy,
} from "lucide-react";
import { useMemo } from "react";
import type { Dataset } from "../data";
import { computeSummary, type FindingLink, type LevyRow } from "../findings";

const GROUPS = [
	{ id: "stand", title: "Where we stand", icon: Flag },
	{ id: "improve", title: "Where to improve", icon: Target },
] as const;

const ICONS: Record<string, LucideIcon> = {
	oprf: GraduationCap,
	subjects: Trophy,
	math: Calculator,
	d97: TrendingUp,
	taxes: PiggyBank,
	absent: CalendarX,
};

type Props = {
	districts: Dataset;
	levies: Record<"D97" | "D200", LevyRow[]> | null;
	onGo: (link: FindingLink) => void;
};

export function KeyFindings({ districts, levies, onGo }: Props) {
	const summary = useMemo(() => computeSummary(districts, levies), [districts, levies]);
	if (!summary) return null;

	return (
		<section className="flex flex-col gap-4" aria-labelledby="summary-title">
			<div>
				<h2 id="summary-title" className="flex items-center gap-2 text-xl font-bold">
					<Compass size={22} aria-hidden /> The bottom line
				</h2>
				<p className="text-sm text-ink-2 dark:text-ink-2-dark">Open a card to see the argument behind it.</p>
			</div>

			{GROUPS.map((grp) => (
				<div key={grp.id} className="flex flex-col gap-2">
					<h3 className="flex items-center gap-1.5 text-sm font-semibold tracking-wide text-ink-2 uppercase dark:text-ink-2-dark">
						<grp.icon size={16} aria-hidden />
						{grp.title}
					</h3>
					<ol className="flex flex-col gap-3">
						{summary.points
							.filter((p) => p.group === grp.id)
							.map((p) => (
								<li key={p.id}>
									<details className="group rounded-xl border border-line bg-card open:border-ink/40 dark:border-line-dark dark:bg-card-dark dark:open:border-ink-dark/40">
										<summary className="flex cursor-pointer list-none flex-col gap-2 p-4 [&::-webkit-details-marker]:hidden">
											<span className="flex items-start gap-3">
												<span className="relative mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-line text-ink dark:bg-line-dark dark:text-ink-dark">
													{(() => {
														const Icon = ICONS[p.id] ?? Flag;
														return <Icon size={22} aria-hidden />;
													})()}
													<span className="tabular absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-ink text-[11px] font-semibold text-page dark:bg-ink-dark dark:text-page-dark">
														{summary.points.indexOf(p) + 1}
													</span>
												</span>
												<span className="flex-1 text-lg leading-snug font-semibold">{p.claim}</span>
											</span>
											<span className="flex flex-col gap-1 pl-13 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
												<span>
													<span className="block text-3xl font-semibold tracking-tight whitespace-nowrap">
														{p.stat}
													</span>
													<span className="block text-xs text-ink-2 dark:text-ink-2-dark">{p.statLabel}</span>
												</span>
												<span className="flex min-h-11 shrink-0 items-center gap-1 text-sm font-medium text-accent dark:text-accent-dark">
													<span className="group-open:hidden">The argument</span>
													<span className="hidden group-open:inline">Hide</span>
													<ChevronDown
														size={18}
														aria-hidden
														className="transition-transform group-open:rotate-180"
													/>
												</span>
											</span>
										</summary>
										<div className="flex flex-col gap-3 border-t border-line px-4 pt-3 pb-4 sm:pl-17 dark:border-line-dark">
											<ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm">
												{p.argument.map((a) => (
													<li key={a}>{a}</li>
												))}
											</ul>
											<p className="flex items-start gap-2 rounded-lg bg-line/60 px-3 py-2 text-sm text-ink-2 dark:bg-line-dark/60 dark:text-ink-2-dark">
												<TriangleAlert size={16} aria-hidden className="mt-0.5 shrink-0" />
												<span>
													<strong className="font-semibold text-ink dark:text-ink-dark">But: </strong>
													{p.counter}
												</span>
											</p>
											<button
												type="button"
												onClick={() => onGo(p.link)}
												className="flex min-h-11 items-center gap-1.5 self-start text-sm font-medium text-accent hover:underline dark:text-accent-dark"
											>
												{p.linkLabel} <ArrowRight size={16} aria-hidden />
											</button>
										</div>
									</details>
								</li>
							))}
					</ol>
				</div>
			))}

			<div className="grid gap-3 md:grid-cols-2">
				<List title="Also worth knowing" icon={Info} items={summary.alsoNotable} />
				<List title="Questions for the school boards" icon={CircleHelp} items={summary.questions} />
			</div>

			<p className="text-xs text-muted dark:text-muted-dark">
				Test comparisons stop at 2024 because 2025 used a new scale. These are patterns, not causes.
			</p>
		</section>
	);
}

function List({ title, icon: Icon, items }: { title: string; icon: LucideIcon; items: string[] }) {
	return (
		<div className="rounded-xl border border-line bg-card p-4 dark:border-line-dark dark:bg-card-dark">
			<h3 className="flex items-center gap-2 font-semibold">
				<Icon size={18} aria-hidden /> {title}
			</h3>
			<ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-sm text-ink-2 dark:text-ink-2-dark">
				{items.map((q) => (
					<li key={q}>{q}</li>
				))}
			</ul>
		</div>
	);
}
