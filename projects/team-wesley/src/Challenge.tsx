import {
	CheckCircle2,
	ExternalLink,
	House,
	MapPin,
	Trophy,
	XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
	answer,
	CHALLENGE_LABEL,
	chooseEffort,
	isCorrect,
	player,
} from "./engine";
import type { ChallengeKind, GameData, GameState, Home } from "./types";
import { Btn, Card, Host, tribeName } from "./ui";

function hostIntro(kind: ChallengeKind, individual: boolean, place: string) {
	const how = {
		hl: "Which Oak Park home does the Assessor value higher? Five rounds.",
		trivia: "Three questions about Oak Park.",
		physical: `A relay, a puzzle and a balance hold at ${place}.`,
	}[kind];
	const prize = individual
		? "Playing for individual immunity."
		: "Playing for immunity and a clue to the idol.";
	return `Come on in, guys! ${how} ${prize} Survivors ready? Go!`;
}

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

export const ASSESSOR = "https://www.cookcountyassessoril.gov";
export const pinUrl = (pin: string) => `${ASSESSOR}/pin/${pin}`;
/** The Assessor's own property photo, at the path its PIN pages use. Not every parcel has one. */
const photoUrl = (pin: string) =>
	`https://prodassets.cookcountyassessoril.gov/s3fs-public/pin_detail/${pin.slice(0, 3)}-${pin.slice(3, 5)}/${pin.slice(5, 8)}/${pin}_AA.jpg`;

export function HousePhoto({
	h,
	className = "",
	linkFallback = true,
}: {
	h: Home;
	className?: string;
	/** Off inside buttons, where a nested link is not allowed. */
	linkFallback?: boolean;
}) {
	const [failed, setFailed] = useState(false);
	if (failed) {
		const box = `flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 rounded-lg bg-stone-200 text-sm text-stone-600 dark:bg-stone-800 dark:text-stone-300 ${className}`;
		if (!linkFallback)
			return (
				<span className={box}>
					<House size={24} aria-hidden />
					<span className="px-1 text-center text-xs">No photo available</span>
				</span>
			);
		return (
			<a
				href={pinUrl(h.pin)}
				target="_blank"
				rel="noreferrer"
				className={`${box} underline`}
			>
				<House size={24} aria-hidden />
				<span className="px-1 text-center text-xs">Photo on Assessor site</span>
			</a>
		);
	}
	return (
		<img
			src={photoUrl(h.pin)}
			alt={`${h.address}, front view`}
			title="Photo: Cook County Assessor"
			loading="lazy"
			onError={() => setFailed(true)}
			className={`aspect-[4/3] w-full rounded-lg bg-stone-200 object-cover dark:bg-stone-800 ${className}`}
		/>
	);
}

function AnswerCard({
	h,
	label,
	higher,
	picked,
}: {
	h: Home;
	label: string;
	higher: boolean;
	picked: boolean;
}) {
	return (
		<div
			className={`min-w-0 rounded-xl border-2 p-1.5 text-sm sm:p-2 ${higher ? "border-green-600" : "border-stone-300 dark:border-stone-600"}`}
		>
			<HousePhoto h={h} />
			<div className="mt-2 flex flex-wrap items-center gap-x-2 text-xs font-bold uppercase">
				<span className="text-orange-700 dark:text-orange-400">{label}</span>
				{higher && (
					<span className="text-green-700 dark:text-green-400">Higher</span>
				)}
				{picked && (
					<span className="text-stone-500 dark:text-stone-400">Your pick</span>
				)}
			</div>
			<a
				className="font-bold underline"
				href={pinUrl(h.pin)}
				target="_blank"
				rel="noreferrer"
			>
				{h.address}
			</a>
			<div className="text-sm">
				<strong>{usd(h.av)}</strong> assessed
			</div>
			<div className="text-xs">{usd(h.av / h.sqft)}/sq ft</div>
			<div className="text-xs text-stone-500 dark:text-stone-400">
				≈ {usd(h.av * 10)} market est.
			</div>
		</div>
	);
}

function HomeCard({
	h,
	label,
	onPick,
}: {
	h: Home;
	label: string;
	onPick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onPick}
			className="flex min-w-0 flex-col items-start rounded-xl border-2 border-stone-300 bg-white p-1.5 text-left text-sm hover:border-orange-500 focus-visible:outline-2 focus-visible:outline-orange-500 sm:p-2 dark:border-stone-600 dark:bg-stone-900"
		>
			<HousePhoto h={h} linkFallback={false} />
			<span className="mt-2 text-xs font-bold uppercase text-orange-700 dark:text-orange-400">
				{label}
			</span>
			<span className="break-words font-bold">{h.address}</span>
			<span>
				{h.type}, built {h.built}
			</span>
			<span>
				{h.sqft.toLocaleString()} sq ft · {h.beds} bed
			</span>
		</button>
	);
}

export function Challenge({
	d,
	s,
	setGame,
	onContinue,
	onPair,
	onShowMap,
}: {
	d: GameData;
	s: GameState;
	setGame: (s: GameState) => void;
	onContinue: () => void;
	/** The pair of homes currently on screen, for the map. */
	onPair: (pair: number[] | null) => void;
	onShowMap: () => void;
}) {
	const [revealed, setRevealed] = useState(false);
	const ch = s.challenge;
	const hlStep = ch?.answers.length ?? 0;
	const pair =
		ch?.kind !== "hl"
			? null
			: revealed && hlStep > 0
				? ch.items[hlStep - 1]
				: ch.result
					? null
					: ch.items[hlStep];
	const pairKey = pair?.join(",") ?? "";
	// biome-ignore lint/correctness/useExhaustiveDependencies: pairKey captures pair
	useEffect(() => {
		onPair(pair);
	}, [pairKey, onPair]);
	useEffect(() => () => onPair(null), [onPair]);
	if (!ch) return null;
	const place = d.places.find((p) => p.id === ch.placeId);
	const step = ch.answers.length;
	const last =
		step > 0
			? isCorrect(d, ch.kind, ch.items[step - 1], ch.answers[step - 1])
			: null;
	const p = player(s);

	return (
		<div className="space-y-4 p-4">
			<div>
				<h2 className="text-xl font-black">
					{ch.individual ? "Individual" : "Tribal"} immunity:{" "}
					{CHALLENGE_LABEL[ch.kind]}
				</h2>
				<p className="text-stone-600 dark:text-stone-400">At {place?.name}</p>
			</div>
			{!ch.result && step === 0 && (
				<Host>{hostIntro(ch.kind, ch.individual, place?.name ?? "")}</Host>
			)}

			{ch.kind === "hl" && revealed && step > 0 && (
				<Card>
					<h3 className="mb-1 flex items-center gap-2 text-lg font-bold">
						{last ? (
							<CheckCircle2
								className="text-green-700 dark:text-green-400"
								aria-hidden
							/>
						) : (
							<XCircle className="text-red-700 dark:text-red-400" aria-hidden />
						)}
						Round {step}: {last ? "Correct!" : "Not quite."}
					</h3>
					<div className="grid grid-cols-2 gap-2 sm:gap-3">
						{ch.items[step - 1].map((hi, k) => {
							const [a, b] = ch.items[step - 1];
							const higher =
								d.homes[hi].av === Math.max(d.homes[a].av, d.homes[b].av);
							return (
								<AnswerCard
									key={hi}
									h={d.homes[hi]}
									label={k === 0 ? "Home A" : "Home B"}
									higher={higher}
									picked={ch.answers[step - 1] === k}
								/>
							);
						})}
					</div>
					<p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
						Photos: Cook County Assessor. Values: 2025 Board of Review.
					</p>
					{!ch.result && (
						<Btn className="mt-3 w-full" onClick={() => setRevealed(false)}>
							Next pair
						</Btn>
					)}
				</Card>
			)}

			{!ch.result && ch.kind === "hl" && !(revealed && step > 0) && (
				<Card>
					<div className="mb-1 flex items-center justify-between gap-2">
						<p className="text-sm font-semibold">
							Round {step + 1} of {ch.items.length}
						</p>
						<Btn
							variant="ghost"
							className="md:hidden"
							onClick={onShowMap}
							title="See both homes on the map"
						>
							<MapPin size={18} aria-hidden /> Map
						</Btn>
					</div>
					<h3 className="mb-3 text-lg font-bold">
						Which home has the higher 2025 assessed value?
					</h3>
					<div className="grid grid-cols-2 gap-2 sm:gap-3">
						{ch.items[step].map((hi, k) => (
							<HomeCard
								key={hi}
								h={d.homes[hi]}
								label={k === 0 ? "Home A" : "Home B"}
								onPick={() => {
									setGame(answer(s, d, k));
									setRevealed(true);
								}}
							/>
						))}
					</div>
				</Card>
			)}

			{!ch.result && ch.kind === "trivia" && (
				<Card>
					<p className="mb-1 text-sm font-semibold">
						Question {step + 1} of {ch.items.length}
					</p>
					<h3 className="mb-3 text-lg font-bold">
						{d.trivia[ch.items[step][0]].q}
					</h3>
					<div className="grid gap-2">
						{d.trivia[ch.items[step][0]].choices.map((c, k) => (
							<Btn
								key={c}
								variant="outline"
								className="justify-start text-left"
								onClick={() => setGame(answer(s, d, k))}
							>
								{c}
							</Btn>
						))}
					</div>
					{last !== null && <Feedback ok={last} />}
				</Card>
			)}

			{!ch.result && ch.kind === "physical" && (
				<Card>
					<h3 className="mb-2 text-lg font-bold">
						Relay, puzzle, and a final balance hold.
					</h3>
					<p className="mb-3 text-sm">How do you want to play it?</p>
					<div className="grid gap-2 sm:grid-cols-2">
						<Btn onClick={() => setGame(chooseEffort(s, d, "push"))}>
							Go all out (risky)
						</Btn>
						<Btn
							variant="outline"
							onClick={() => setGame(chooseEffort(s, d, "steady"))}
						>
							Slow and steady
						</Btn>
					</div>
				</Card>
			)}

			{ch.result && (
				<Card>
					<Host>
						<span className="flex items-center gap-2">
							<Trophy
								size={18}
								aria-hidden
								className="shrink-0 text-amber-500"
							/>
							{ch.individual
								? `${d.officials.find((o) => o.id === ch.result?.winners[0])?.name} wins individual immunity!`
								: `${tribeName(d, ch.result.winnerTribe ?? "")} wins immunity!`}
						</span>
					</Host>
					{ch.result.why && <p className="mt-3 mb-2">{ch.result.why}</p>}
					{!ch.individual && (
						<ul className="mb-2 text-sm">
							{Object.entries(ch.result.tribeScores)
								.sort((a, b) => b[1] - a[1])
								.map(([t, sc]) => (
									<li key={t}>
										{tribeName(d, t)}: {Math.round(sc * 100)}
									</li>
								))}
						</ul>
					)}
					<p className="font-semibold">
						{ch.result.winners.includes(p.id)
							? s.idols[p.tribe]?.hint
								? "Reward: a hint to the idol's location. Check the idol hunt at camp next episode."
								: "You're safe tonight."
							: ch.individual || ch.result.loserTribes.includes(p.tribe)
								? "You're going to Tribal Council."
								: "You're safe tonight."}
					</p>
					<Btn className="mt-3 w-full" onClick={onContinue}>
						{ch.kind === "physical" ? "Continue" : "See the answers"}
					</Btn>
				</Card>
			)}
		</div>
	);
}

function Feedback({ ok }: { ok: boolean }) {
	return (
		<p
			className={`mt-3 flex items-center gap-2 font-semibold ${ok ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}
			role="status"
		>
			{ok ? (
				<CheckCircle2 size={18} aria-hidden />
			) : (
				<XCircle size={18} aria-hidden />
			)}
			Last answer: {ok ? "correct" : "wrong"}
		</p>
	);
}

export function Learn({
	d,
	s,
	onContinue,
}: {
	d: GameData;
	s: GameState;
	onContinue: () => void;
}) {
	const ch = s.challenge;
	if (!ch) return null;
	const goingToTribal =
		ch.result &&
		(ch.individual || ch.result.loserTribes.includes(player(s).tribe));
	return (
		<div className="space-y-4 p-4">
			<h2 className="text-xl font-black">What you just learned</h2>
			{ch.kind === "hl" && (
				<>
					<Card>
						<ul className="space-y-3">
							{ch.items.map(([a, b], i) => {
								const right = isCorrect(d, "hl", [a, b], ch.answers[i]);
								return (
									<li key={`${a}-${b}`} className="text-sm">
										<span className="font-semibold">
											{right ? "✓" : "✗"} Round {i + 1}
										</span>
										{[a, b].map((hi) => {
											const h = d.homes[hi];
											return (
												<div
													key={hi}
													className="flex flex-wrap justify-between gap-x-3"
												>
													<a
														className="text-orange-700 underline dark:text-orange-400"
														href={pinUrl(h.pin)}
														target="_blank"
														rel="noreferrer"
													>
														{h.address}
													</a>
													<span>
														{usd(h.av)} AV · {usd(h.av / h.sqft)}/sq ft
													</span>
												</div>
											);
										})}
									</li>
								);
							})}
						</ul>
					</Card>
					<Card>
						<h3 className="mb-1 font-bold">Is your assessment fair?</h3>
						<ul className="list-disc space-y-1 pl-5 text-sm">
							<li>
								Assessed value (AV) is 10% of the Assessor's estimate of a
								home's market value. A {usd(50000)} AV means about {usd(500000)}
								.
							</li>
							<li>
								Similar homes can carry very different AV per square foot. That
								gap is what an appeal argues.
							</li>
							<li>
								Find your home and nearby comparables, then check appeal
								deadlines for Oak Park Township.
							</li>
						</ul>
						<div className="mt-2 flex flex-wrap gap-2">
							<a
								className="inline-flex min-h-11 items-center gap-1 font-semibold text-orange-700 underline dark:text-orange-400"
								href={`${ASSESSOR}/address-search`}
								target="_blank"
								rel="noreferrer"
							>
								Look up your home <ExternalLink size={14} aria-hidden />
							</a>
							<a
								className="inline-flex min-h-11 items-center gap-1 font-semibold text-orange-700 underline dark:text-orange-400"
								href="https://www.cookcountyboardofreview.com/"
								target="_blank"
								rel="noreferrer"
							>
								Board of Review appeals <ExternalLink size={14} aria-hidden />
							</a>
						</div>
						<p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
							Values: Cook County Assessor, 2025 Board of Review totals,
							single-family homes only.
						</p>
					</Card>
				</>
			)}
			{ch.kind === "trivia" && (
				<Card>
					<ul className="space-y-3">
						{ch.items.map(([qi], i) => {
							const t = d.trivia[qi];
							const right = t.answer === ch.answers[i];
							return (
								<li key={t.id} className="text-sm">
									<div className="font-semibold">
										{right ? "✓" : "✗"} {t.q}
									</div>
									<div>
										Answer: <strong>{t.choices[t.answer]}</strong>. {t.explain}{" "}
										<a
											className="text-orange-700 underline dark:text-orange-400"
											href={t.sourceUrl}
											target="_blank"
											rel="noreferrer"
										>
											Source
										</a>
									</div>
								</li>
							);
						})}
					</ul>
				</Card>
			)}
			<Btn className="w-full" onClick={onContinue}>
				{goingToTribal ? "Go to Tribal Council" : "Continue"}
			</Btn>
		</div>
	);
}
