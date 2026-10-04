import {
	Crown,
	Flame,
	Info,
	Landmark,
	MessageSquareQuote,
	Scale,
	Swords,
	Tent,
	Zap,
} from "lucide-react";
import { useState } from "react";
import { alive, PITCHES, type Pitch, player } from "./engine";
import { ordinal } from "./text";
import type { GameData, GameState, RecapLine } from "./types";
import { Avatar, Btn, Card, Host } from "./ui";

const ICONS: Record<RecapLine["kind"], typeof Tent> = {
	camp: Tent,
	challenge: Swords,
	tribal: Flame,
	civic: Landmark,
	confessional: MessageSquareQuote,
	twist: Zap,
	host: Flame,
};
const KIND_LABEL: Record<RecapLine["kind"], string> = {
	camp: "Camp",
	challenge: "Challenge",
	tribal: "Tribal Council",
	civic: "Civic fact",
	confessional: "Confessional",
	twist: "Twist",
	host: "Jeff",
};

export function RecapLines({ lines }: { lines: RecapLine[] }) {
	return (
		<ul className="space-y-2">
			{lines.map((l, i) => {
				const Icon = ICONS[l.kind];
				return (
					<li
						// biome-ignore lint/suspicious/noArrayIndexKey: lines are append-only and never reorder
						key={`${i}-${l.text.slice(0, 12)}`}
						className="flex gap-2 text-sm"
					>
						<Icon
							size={18}
							className="mt-0.5 shrink-0 text-orange-600"
							aria-label={KIND_LABEL[l.kind]}
						/>
						<span
							className={
								l.kind === "confessional"
									? "italic"
									: l.kind === "host"
										? "font-semibold"
										: ""
							}
						>
							{l.text}
							{l.link && (
								<>
									{" "}
									<a
										className="text-orange-700 underline dark:text-orange-400"
										href={l.link}
										target="_blank"
										rel="noreferrer"
									>
										Source
									</a>
								</>
							)}
						</span>
					</li>
				);
			})}
		</ul>
	);
}

const name = (d: GameData, id: string) =>
	d.officials.find((o) => o.id === id)?.name ?? id;

export function Recap({ s, onNext }: { s: GameState; onNext: () => void }) {
	const ep = s.episodes[s.episodes.length - 1];
	const finale = alive(s).length <= s.config.finalN;
	return (
		<div className="space-y-4 p-4">
			<h2 className="text-xl font-black">Episode {ep.n} recap</h2>
			<Card>
				<RecapLines lines={ep.lines} />
			</Card>
			<p className="text-sm text-stone-600 dark:text-stone-400">
				{alive(s).length} castaways remain.
			</p>
			<Btn className="w-full" onClick={onNext}>
				{finale ? "Go to the Final Tribal Council" : "Next episode"}
			</Btn>
		</div>
	);
}

export function Eliminated({
	s,
	onWatch,
	onRestart,
}: {
	s: GameState;
	onWatch: () => void;
	onRestart: () => void;
}) {
	const p = player(s);
	return (
		<div className="space-y-4 p-4">
			<h2 className="text-2xl font-black">Your torch is snuffed</h2>
			<Card>
				<p className="text-lg">
					You finished in <strong>{ordinal(p.out?.place ?? 0)} place</strong>
					{p.juror ? " and joined the jury." : "."}
				</p>
				{p.juror && (
					<p className="mt-1 text-sm">
						If you keep watching, you'll vote for the winner at the end.
					</p>
				)}
			</Card>
			<div className="grid gap-2 sm:grid-cols-2">
				<Btn onClick={onWatch}>Watch the rest of the season</Btn>
				<Btn variant="outline" onClick={onRestart}>
					Start a new season
				</Btn>
			</div>
		</div>
	);
}

export function Finale({
	d,
	s,
	colors,
	onFinish,
}: {
	d: GameData;
	s: GameState;
	colors: Record<string, string>;
	onFinish: (o: { pitch?: Pitch; vote?: string }) => void;
}) {
	const p = player(s);
	const finalists = alive(s);
	const isFinalist = !p.out;
	const isJuror = p.juror && !!p.out;
	const jury = s.cast.filter((c) => c.juror);
	const [pitch, setPitch] = useState<Pitch | null>(null);
	const [vote, setVote] = useState<string | null>(null);

	return (
		<div className="space-y-4 p-4">
			<h2 className="text-2xl font-black">Final Tribal Council</h2>
			<Host>
				Jury, you've watched these {finalists.length} play all season. Tonight
				you decide who wins Survivor: Oak Park and the title of Sole Survivor.
			</Host>
			<Card>
				<h3 className="mb-2 font-bold">Finalists</h3>
				<ul className="flex flex-wrap gap-4">
					{finalists.map((c) => (
						<li key={c.id} className="flex items-center gap-2">
							<Avatar d={d} id={c.id} color={colors.merge} size={44} />
							<span className="font-semibold">{name(d, c.id)}</span>
						</li>
					))}
				</ul>
				<p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
					Jury of {jury.length}:{" "}
					{jury.map((j) => name(d, j.id).split(" ")[0]).join(", ")}
				</p>
			</Card>

			{isFinalist && (
				<Card>
					<fieldset>
						<legend className="mb-2 font-bold">
							Make your case to the jury
						</legend>
						{(Object.keys(PITCHES) as Pitch[]).map((k) => (
							<label
								key={k}
								className="flex min-h-11 items-center gap-3 rounded-lg p-2 hover:bg-stone-100 dark:hover:bg-stone-800"
							>
								<input
									type="radio"
									name="pitch"
									className="size-5"
									checked={pitch === k}
									onChange={() => setPitch(k)}
								/>
								"{PITCHES[k]}"
							</label>
						))}
					</fieldset>
				</Card>
			)}

			{isJuror && (
				<Card>
					<fieldset>
						<legend className="mb-2 font-bold">
							Your jury vote: who should win?
						</legend>
						{finalists.map((c) => (
							<label
								key={c.id}
								className="flex min-h-11 items-center gap-3 rounded-lg p-2 hover:bg-stone-100 dark:hover:bg-stone-800"
							>
								<input
									type="radio"
									name="jury"
									className="size-5"
									checked={vote === c.id}
									onChange={() => setVote(c.id)}
								/>
								{name(d, c.id)}
							</label>
						))}
					</fieldset>
				</Card>
			)}

			<Btn
				className="w-full"
				disabled={(isFinalist && !pitch) || (isJuror && !vote)}
				onClick={() =>
					onFinish({ pitch: pitch ?? undefined, vote: vote ?? undefined })
				}
			>
				Read the jury votes
			</Btn>
		</div>
	);
}

export function Done({
	d,
	s,
	colors,
	onRestart,
}: {
	d: GameData;
	s: GameState;
	colors: Record<string, string>;
	onRestart: () => void;
}) {
	const winner = s.winner ?? "";
	const tb = s.finalTiebreak;
	const p = player(s);
	const counts: Record<string, number> = {};
	for (const v of Object.values(s.juryVotes)) counts[v] = (counts[v] ?? 0) + 1;
	const standings = [...s.cast].sort(
		(a, b) => (a.out?.place ?? 0) - (b.out?.place ?? 0),
	);
	return (
		<div className="space-y-4 p-4">
			<Card className="text-center">
				<Crown className="mx-auto text-amber-500" size={40} aria-hidden />
				<div className="my-2 flex justify-center">
					<Avatar d={d} id={winner} color={colors.merge} size={80} />
				</div>
				<Host>The winner of Survivor: Oak Park is… {name(d, winner)}!</Host>
				<h2 className="mt-3 text-2xl font-black">
					{name(d, winner)} is the Sole Survivor!
				</h2>
				<p className="text-stone-600 dark:text-stone-400">
					{Object.entries(counts)
						.sort((a, b) => b[1] - a[1])
						.map(
							([id, n]) =>
								`${n} ${n === 1 ? "vote" : "votes"} for ${name(d, id).split(" ")[0]}`,
						)
						.join(" · ")}
				</p>
				<p className="mt-2 font-semibold">
					{winner === p.id
						? "That's you. Congratulations!"
						: `You finished ${ordinal(p.out?.place ?? 1)}.`}
				</p>
			</Card>
			{tb && (
				<Card>
					<h3 className="mb-1 flex items-center gap-2 font-bold">
						<Scale size={18} aria-hidden className="text-orange-600" />
						Tied jury: bonus points decide it
					</h3>
					<p className="mb-2 text-sm text-stone-600 dark:text-stone-400">
						{tb.tied.map((id) => name(d, id).split(" ")[0]).join(" and ")} tied
						on jury votes. Each award earns 1 point.
					</p>
					{tb.awards.length > 0 ? (
						<ul className="space-y-1 text-sm">
							{tb.awards.map((a) => (
								<li
									key={a.label}
									className="flex flex-wrap justify-between gap-x-2"
								>
									<span>
										<strong>{a.label}</strong> ({a.detail})
									</span>
									<span>
										{a.winners.map((w) => name(d, w).split(" ")[0]).join(", ")}
									</span>
								</li>
							))}
						</ul>
					) : (
						<p className="text-sm">No award separated them.</p>
					)}
					<p className="mt-2 text-sm font-semibold">
						Points:{" "}
						{tb.tied
							.map((id) => `${name(d, id).split(" ")[0]} ${tb.points[id] ?? 0}`)
							.join(" · ")}
						{tb.decidedBy === "trust" &&
							". Still even, so the finalist the jury trusts most wins."}
					</p>
				</Card>
			)}
			<Card>
				<h3 className="mb-2 font-bold">Jury votes</h3>
				<ul className="space-y-1 text-sm">
					{Object.entries(s.juryVotes).map(([j, f]) => (
						<li key={j}>
							{name(d, j)} → <strong>{name(d, f)}</strong>
						</li>
					))}
				</ul>
			</Card>
			<Card>
				<h3 className="mb-2 font-bold">Final standings</h3>
				<ol className="space-y-1 text-sm">
					<li>1st: {name(d, winner)}</li>
					{standings
						.filter((c) => c.out)
						.map((c) => (
							<li key={c.id}>
								{ordinal(c.out?.place ?? 0)}: {name(d, c.id)}
							</li>
						))}
				</ol>
			</Card>
			<p className="flex items-start gap-2 text-sm text-stone-600 dark:text-stone-400">
				<Info size={16} className="mt-0.5 shrink-0" aria-hidden />
				All in good fun: castaway stats and results are random, not a judgment
				of anyone's public service.
			</p>
			<Btn className="w-full" onClick={onRestart}>
				Start a new season
			</Btn>
		</div>
	);
}
