import {
	Bed,
	Flag,
	Handshake,
	MapPin,
	MessageCircle,
	Search,
	Shield,
	Sparkles,
} from "lucide-react";
import { useState } from "react";
import {
	ADVANTAGE_LABEL,
	allianceOf,
	getRel,
	player,
	propose,
	rest,
	search,
	talk,
	tribeMembers,
} from "./engine";
import { RecapLines } from "./Recap";
import { BODY_SHORT } from "./text";
import type { GameData, GameState } from "./types";
import { Avatar, Btn, Card, Host, TribeChip, tribeName } from "./ui";

type Mode = null | "talk" | "ally" | "search";

export function TrustMeter({ value }: { value: number }) {
	const pct = Math.round((value + 100) / 2);
	const label =
		value >= 30
			? "Close"
			: value >= 10
				? "Friendly"
				: value >= -10
					? "Neutral"
					: "Wary";
	return (
		<span
			className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400"
			title={`Trust: ${label}`}
		>
			<span
				className="h-1.5 w-16 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700"
				aria-hidden
			>
				<span
					className="block h-full rounded-full bg-orange-500"
					style={{ width: `${pct}%` }}
				/>
			</span>
			{label}
		</span>
	);
}

export function Camp({
	d,
	s,
	colors,
	setGame,
	onContinue,
	onSearchMode,
	onShowMap,
}: {
	d: GameData;
	s: GameState;
	colors: Record<string, string>;
	setGame: (s: GameState) => void;
	onContinue: () => void;
	onSearchMode: (on: boolean) => void;
	onShowMap: () => void;
}) {
	const [mode, setMode] = useState<Mode>(null);
	const p = player(s);
	const mates = tribeMembers(s, p.tribe).filter((c) => c.id !== p.id);
	const idol = s.idols[p.tribe];
	const myAlliance = allianceOf(s, p.id);
	const ep = s.episodes[s.episodes.length - 1];
	const done = s.actions <= 0;

	const choose = (m: Mode) => {
		setMode(m);
		onSearchMode(m === "search");
	};
	const act = (next: GameState) => {
		setGame(next);
		choose(null);
	};

	return (
		<div className="space-y-4 p-4">
			<div className="flex flex-wrap items-center gap-2">
				<h2 className="text-xl font-black">Episode {s.episode}: Camp</h2>
				<TribeChip d={d} id={p.tribe} color={colors[p.tribe]} />
			</div>
			<Host>
				{s.episode === 1
					? `Welcome to Oak Park! Your camp is at ${tribeName(d, p.tribe)}. You get two moves before the challenge. Make them count.`
					: ep.lines.some((l) => l.kind === "host")
						? "Drop your buffs! You're one tribe now, and immunity is individual from here on."
						: `Day ${s.episode * 3}. ${mates.length + 1} of you left at this camp. Two moves before we meet for the challenge.`}
			</Host>

			{ep.lines.length > 0 && (
				<Card>
					<RecapLines lines={ep.lines} />
				</Card>
			)}

			<Card>
				<div className="mb-3 flex items-center justify-between">
					<h3 className="font-bold">Your moves</h3>
					<span className="text-sm font-semibold" aria-live="polite">
						{s.actions} of 2 left
					</span>
				</div>
				{s.notice && (
					<p
						className="mb-3 rounded-lg bg-amber-100 p-2 text-amber-950 dark:bg-amber-950 dark:text-amber-100"
						role="status"
					>
						{s.notice}
					</p>
				)}
				<div className="grid grid-cols-2 gap-2">
					<Btn
						variant={mode === "talk" ? "primary" : "outline"}
						disabled={done}
						onClick={() => choose(mode === "talk" ? null : "talk")}
						aria-pressed={mode === "talk"}
					>
						<MessageCircle size={18} aria-hidden /> Talk
					</Btn>
					<Btn
						variant={mode === "ally" ? "primary" : "outline"}
						disabled={done}
						onClick={() => choose(mode === "ally" ? null : "ally")}
						aria-pressed={mode === "ally"}
					>
						<Handshake size={18} aria-hidden /> Alliance
					</Btn>
					<Btn
						variant={mode === "search" ? "primary" : "outline"}
						disabled={done || !idol}
						onClick={() => choose(mode === "search" ? null : "search")}
						aria-pressed={mode === "search"}
						title={idol ? "Search near camp" : "No idol at this camp right now"}
					>
						<Search size={18} aria-hidden /> Idol hunt
					</Btn>
					<Btn variant="outline" disabled={done} onClick={() => act(rest(s))}>
						<Bed size={18} aria-hidden /> Rest
					</Btn>
				</div>

				{(mode === "talk" || mode === "ally") && (
					<ul className="mt-3 space-y-1">
						{mates.map((c) => {
							const o = d.officials.find((x) => x.id === c.id);
							const inMine = myAlliance?.members.includes(c.id);
							return (
								<li key={c.id}>
									<button
										type="button"
										disabled={mode === "ally" && inMine}
										onClick={() =>
											act(
												mode === "talk"
													? talk(s, d, c.id)
													: propose(s, d, c.id),
											)
										}
										className="flex w-full min-h-12 items-center gap-3 rounded-lg p-2 text-left hover:bg-stone-100 disabled:opacity-50 dark:hover:bg-stone-800"
									>
										<Avatar d={d} id={c.id} color={colors[c.tribe]} size={36} />
										<span className="min-w-0 flex-1">
											<span className="block truncate font-semibold">
												{o?.name}
											</span>
											<TrustMeter value={getRel(s, p.id, c.id)} />
										</span>
										{inMine && (
											<span className="text-xs font-semibold">Allied</span>
										)}
									</button>
								</li>
							);
						})}
					</ul>
				)}

				{mode === "search" && idol && (
					<div className="mt-3">
						<div className="mb-2 flex items-center justify-between gap-2">
							<p className="text-sm">
								{idol.hint
									? "Your reward hint narrows it to the orange spots."
									: "The idol is hidden at one of these spots near camp."}
							</p>
							<Btn
								variant="ghost"
								className="md:hidden"
								onClick={onShowMap}
								title="Show spots on map"
							>
								<MapPin size={18} aria-hidden /> Map
							</Btn>
						</div>
						<ol className="space-y-1">
							{idol.spots.map((id, i) => {
								const pl = d.places.find((x) => x.id === id);
								const searched = idol.searched.includes(id);
								const hinted = idol.hint?.includes(id);
								const ruledOut = !!idol.hint && !hinted;
								return (
									<li key={id}>
										<button
											type="button"
											disabled={searched}
											onClick={() => act(search(s, d, id))}
											className={`flex w-full min-h-11 items-center gap-2 rounded-lg p-2 text-left hover:bg-stone-100 disabled:line-through disabled:opacity-50 dark:hover:bg-stone-800 ${ruledOut ? "opacity-50" : ""}`}
										>
											<span
												className={`flex size-7 items-center justify-center rounded font-bold ${hinted ? "bg-orange-500 text-white" : "bg-yellow-400 text-stone-900"}`}
											>
												{i + 1}
											</span>
											{pl?.name}
										</button>
									</li>
								);
							})}
						</ol>
					</div>
				)}
			</Card>

			<Card>
				<h3 className="mb-2 font-bold">Your bag</h3>
				<ul className="space-y-1 text-sm">
					<li className="flex items-center gap-2">
						<Shield size={16} aria-hidden /> Hidden immunity idol:{" "}
						{p.idol ? <strong>Yes</strong> : "None"}
					</li>
					<li className="flex items-center gap-2">
						<Sparkles size={16} aria-hidden /> Advantages:{" "}
						{p.advantages.length ? (
							<strong>
								{p.advantages.map((a) => ADVANTAGE_LABEL[a]).join(", ")}
							</strong>
						) : (
							"None"
						)}
					</li>
					<li className="flex items-center gap-2">
						<Flag size={16} aria-hidden /> Shot in the Dark:{" "}
						{p.shotUsed ? "Used" : "Available at Tribal"}
					</li>
					<li className="flex items-center gap-2">
						<Handshake size={16} aria-hidden /> Alliance:{" "}
						{myAlliance ? (
							<span>
								<strong>{myAlliance.name}</strong> (
								{myAlliance.members
									.filter((m) => m !== p.id)
									.map(
										(m) =>
											d.officials.find((o) => o.id === m)?.name.split(" ")[0],
									)
									.join(", ")}
								)
							</span>
						) : (
							"None yet"
						)}
					</li>
				</ul>
				<p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
					You: {d.officials.find((o) => o.id === p.id)?.role},{" "}
					{
						BODY_SHORT[
							d.officials.find((o) => o.id === p.id)?.body ?? "Township"
						]
					}
				</p>
			</Card>

			<div className="sticky bottom-0 -mx-4 border-t border-stone-200 bg-stone-100/95 p-4 backdrop-blur dark:border-stone-800 dark:bg-stone-950/95">
				<Btn
					className="w-full"
					onClick={() => {
						onSearchMode(false);
						onContinue();
					}}
				>
					Head to the challenge
				</Btn>
			</div>
		</div>
	);
}
