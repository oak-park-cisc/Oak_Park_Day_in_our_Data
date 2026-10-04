import { Shield } from "lucide-react";
import { useState } from "react";
import {
	ADVANTAGE_LABEL,
	alive,
	castVote,
	type PlayerVote,
	player,
} from "./engine";
import type { Advantage, GameData, GameState, Vote } from "./types";
import { Avatar, Btn, Card, Host } from "./ui";

const name = (d: GameData, id: string) =>
	d.officials.find((o) => o.id === id)?.name ?? id;

/** Read votes like the show: spread the suspense and finish on the deciding vote. */
function readingOrder(votes: Vote[], out: string | null) {
	const first = votes.filter((v) => !v.revote);
	const against = first.filter((v) => v.target === out);
	const others = first.filter((v) => v.target !== out);
	const order: Vote[] = [];
	while (against.length || others.length) {
		if (others.length) order.push(others.shift() as Vote);
		if (against.length) order.push(against.shift() as Vote);
	}
	return [...order, ...votes.filter((v) => v.revote)];
}

export function Tribal({
	d,
	s,
	colors,
	setGame,
	onContinue,
}: {
	d: GameData;
	s: GameState;
	colors: Record<string, string>;
	setGame: (s: GameState) => void;
	onContinue: () => void;
}) {
	const t = s.tribal;
	const p = player(s);
	const [target, setTarget] = useState<string | null>(null);
	const [adv, setAdv] = useState<Advantage | "shot" | null>(null);
	const [stealFrom, setStealFrom] = useState<string | null>(null);
	const [idolOn, setIdolOn] = useState<string | null>(null);
	if (!t) return null;
	const others = t.attendees.filter((a) => a !== p.id);
	const candidates = others.filter((a) => !t.immune.includes(a));
	const shotAllowed = !p.shotUsed && alive(s).length > 5;
	const ready =
		adv === "shot" || (!!target && (adv !== "steal" || !!stealFrom));

	if (t.resolved) {
		const order = readingOrder(t.votes, t.out);
		const safe = new Set([
			...t.immune,
			...t.idolPlays.map((x) => x.on),
			...(t.shotSafe ? [t.shotSafe] : []),
		]);
		return (
			<div className="space-y-4 p-4">
				<h2 className="text-xl font-black">Reading the votes</h2>
				<Host>
					I'll read the votes. Once the votes are read, the decision is final.
				</Host>
				{t.idolPlays.map((x) => (
					<p
						key={x.by}
						className="flex items-center gap-2 font-semibold text-amber-700 dark:text-amber-400"
					>
						<Shield size={18} aria-hidden /> {name(d, x.by)} played an idol on{" "}
						{x.on === x.by ? "themself" : name(d, x.on)}.
					</p>
				))}
				{t.shotSafe && (
					<p className="font-semibold">
						Your Shot in the Dark worked! You're safe.
					</p>
				)}
				{p.shotUsed &&
					!t.shotSafe &&
					t.votes.every((v) => v.voter !== p.id || v.revote) && (
						<p className="font-semibold">Shot in the Dark: not safe.</p>
					)}
				<Card>
					<ol className="vote-reveal space-y-1">
						{order.map((v, i) => (
							<li
								// biome-ignore lint/suspicious/noArrayIndexKey: lines are append-only and never reorder
								key={`${v.voter}-${i}`}
								style={{ animationDelay: `${i * 0.4}s` }}
								className={`flex items-center gap-2 ${safe.has(v.target) ? "line-through opacity-60" : ""}`}
							>
								<span className="w-16 text-sm text-stone-500 dark:text-stone-400">
									{v.revote ? "Revote" : `Vote ${i + 1}`}
								</span>
								<Avatar
									d={d}
									id={v.target}
									color={
										colors[
											s.cast.find((c) => c.id === v.target)?.tribe ?? "merge"
										] ?? "#78716c"
									}
									size={28}
								/>
								<span className="font-semibold">{name(d, v.target)}</span>
								{safe.has(v.target) && (
									<span className="text-xs">does not count</span>
								)}
							</li>
						))}
					</ol>
					{t.tiebreak === "stone" && (
						<p className="mt-2 text-sm">
							Still tied: the tied castaways drew stones.
						</p>
					)}
				</Card>
				<div className="vote-reveal" role="status">
					<div style={{ animationDelay: `${order.length * 0.4}s` }}>
						<Host>
							{t.out === p.id
								? `${name(d, p.id).split(" ")[0]}, the tribe has spoken. It's time for you to go.`
								: `${name(d, t.out ?? "").split(" ")[0]}, the tribe has spoken. It's time for you to go.`}
						</Host>
					</div>
				</div>
				<Btn className="w-full" onClick={onContinue}>
					Continue
				</Btn>
			</div>
		);
	}

	const submit = () => {
		const choice: PlayerVote = {
			target: adv === "shot" ? null : target,
			advantage: adv,
			stealFrom,
			idolOn,
		};
		setGame(castVote(s, d, choice));
	};

	return (
		<div className="space-y-4 p-4">
			<h2 className="text-xl font-black">Tribal Council</h2>
			<p className="text-stone-600 dark:text-stone-400">
				Council Chambers, Oak Park Village Hall
			</p>
			<Host>
				{t.immune.length ? "Immunity is off the table for everyone else. " : ""}
				It's time to vote. If anybody has a hidden immunity idol, you'll play it
				after the votes are cast. {name(d, p.id).split(" ")[0]}, you're up.
			</Host>
			{t.immune.length > 0 && (
				<p className="flex items-center gap-2">
					<Shield size={16} aria-hidden /> Immune:{" "}
					{t.immune.map((i) => name(d, i)).join(", ")}
				</p>
			)}
			{t.whisper && (
				<p className="rounded-lg bg-amber-100 p-2 text-amber-950 dark:bg-amber-950 dark:text-amber-100">
					{t.whisper === p.id
						? "Careful: you heard your own name whispered at camp."
						: `Word at camp: ${name(d, t.whisper)}'s name is out there.`}
				</p>
			)}

			<Card>
				<fieldset>
					<legend className="mb-2 font-bold">Who do you vote out?</legend>
					<div className="space-y-1">
						{candidates.map((id) => (
							<label
								key={id}
								className={`flex min-h-12 items-center gap-3 rounded-lg p-2 ${adv === "shot" ? "opacity-50" : "hover:bg-stone-100 dark:hover:bg-stone-800"}`}
							>
								<input
									type="radio"
									name="vote"
									className="size-5"
									disabled={adv === "shot"}
									checked={target === id}
									onChange={() => setTarget(id)}
								/>
								<Avatar
									d={d}
									id={id}
									color={colors[t.tribe] ?? "#78716c"}
									size={32}
								/>
								<span className="font-semibold">{name(d, id)}</span>
							</label>
						))}
					</div>
				</fieldset>
			</Card>

			{(p.advantages.length > 0 || shotAllowed) && (
				<Card>
					<label className="flex flex-col gap-1 font-bold">
						Use an advantage
						<select
							value={adv ?? ""}
							onChange={(e) =>
								setAdv((e.target.value || null) as Advantage | "shot" | null)
							}
							className="min-h-11 w-full min-w-0 rounded-lg border border-stone-300 bg-white px-2 font-normal dark:border-stone-600 dark:bg-stone-800"
						>
							<option value="">None</option>
							{p.advantages.map((a) => (
								<option key={a} value={a}>
									{ADVANTAGE_LABEL[a]}:{" "}
									{a === "extra" ? "vote twice" : "take someone's vote"}
								</option>
							))}
							{shotAllowed && (
								<option value="shot">
									Shot in the Dark (1-in-6 safety, no vote)
								</option>
							)}
						</select>
					</label>
					{adv === "steal" && (
						<label className="mt-2 flex flex-col gap-1 text-sm font-semibold">
							Steal whose vote?
							<select
								value={stealFrom ?? ""}
								onChange={(e) => setStealFrom(e.target.value || null)}
								className="min-h-11 w-full min-w-0 rounded-lg border border-stone-300 bg-white px-2 font-normal dark:border-stone-600 dark:bg-stone-800"
							>
								<option value="">Choose…</option>
								{others.map((id) => (
									<option key={id} value={id}>
										{name(d, id)}
									</option>
								))}
							</select>
						</label>
					)}
				</Card>
			)}

			{p.idol && (
				<Card>
					<label className="flex flex-col gap-1 font-bold">
						Play your hidden immunity idol?
						<select
							value={idolOn ?? ""}
							onChange={(e) => setIdolOn(e.target.value || null)}
							className="min-h-11 w-full min-w-0 rounded-lg border border-stone-300 bg-white px-2 font-normal dark:border-stone-600 dark:bg-stone-800"
						>
							<option value="">Keep it</option>
							<option value={p.id}>Play it on myself</option>
							{others.map((id) => (
								<option key={id} value={id}>
									Play it on {name(d, id)}
								</option>
							))}
						</select>
					</label>
					<p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
						Idols are played after votes are cast, before they're read.
					</p>
				</Card>
			)}

			<div className="sticky bottom-0 -mx-4 border-t border-stone-200 bg-stone-100/95 p-4 backdrop-blur dark:border-stone-800 dark:bg-stone-950/95">
				<Btn className="w-full" disabled={!ready} onClick={submit}>
					Cast your vote
				</Btn>
			</div>
		</div>
	);
}
