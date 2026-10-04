import { Rng } from "./rng";
import {
	ALLIANCE_NAMES,
	BODY_SHORT,
	CAMP_EVENTS,
	confessional,
	fill,
	firstName,
	ordinal,
	STONE_LINE,
} from "./text";
import type {
	Advantage,
	Award,
	Castaway,
	ChallengeKind,
	Config,
	GameData,
	GameState,
	IdolCamp,
	Official,
	PresetId,
	RecapLine,
	TribalState,
	Vote,
} from "./types";

export const PRESETS: Record<
	Exclude<PresetId, "custom">,
	{ label: string; castSize: number; finalN: 2 | 3 }
> = {
	short: { label: "Short", castSize: 12, finalN: 3 },
	classic: { label: "Classic", castSize: 18, finalN: 3 },
	long: { label: "Long", castSize: 20, finalN: 3 },
};

export const MERGE_CAMP = "merge";
export const MERGE_NAME = "Village";
export const MERGE_COLOR = "#7c3aed";
const HL_ROUNDS = 5;
const TRIVIA_ROUNDS = 3;

// ---------- helpers ----------

export const relKey = (a: string, b: string) =>
	a < b ? `${a}|${b}` : `${b}|${a}`;
export const getRel = (s: GameState, a: string, b: string) =>
	s.rel[relKey(a, b)] ?? 0;
function addRel(s: GameState, a: string, b: string, d: number) {
	const k = relKey(a, b);
	s.rel[k] = Math.max(-100, Math.min(100, (s.rel[k] ?? 0) + d));
}

export const alive = (s: GameState) => s.cast.filter((c) => !c.out);
export const castaway = (s: GameState, id: string) =>
	s.cast.find((c) => c.id === id) as Castaway;
export const player = (s: GameState) => castaway(s, s.config.playerId);
export const playerActive = (s: GameState) => !player(s).out && !s.watching;
export const campOf = (s: GameState, id: string) => castaway(s, id).tribe;
export const tribeMembers = (s: GameState, tribe: string) =>
	alive(s).filter((c) => c.tribe === tribe);
export const allianceOf = (s: GameState, id: string) =>
	s.alliances.find((a) => a.members.includes(id));

function official(d: GameData, id: string): Official {
	return d.officials.find((o) => o.id === id) as Official;
}
export function displayName(d: GameData, id: string) {
	return official(d, id).name;
}
const fn = (d: GameData, id: string) => firstName(displayName(d, id));

function line(
	s: GameState,
	kind: RecapLine["kind"],
	text: string,
	link?: string,
) {
	s.episodes[s.episodes.length - 1].lines.push({ kind, text, link });
}

export function mergeAtFor(castSize: number, finalN: number) {
	return Math.max(finalN + 4, Math.round(castSize * 0.55));
}

/** The pool is shuffled by seed so a shared link reproduces the same cast. */
export function drawCast(d: GameData, seed: number, size: number): string[] {
	const r = new Rng({ rng: seed });
	return r.shuffle(d.officials.map((o) => o.id)).slice(0, size);
}

export function campCoords(d: GameData, camp: string): [number, number] {
	if (camp === MERGE_CAMP) {
		const p = mergePlace(d);
		return [p.lat, p.lon];
	}
	const sch = d.schools.find((x) => x.id === camp);
	return sch ? [sch.lat, sch.lon] : [41.885, -87.79];
}

export function mergePlace(d: GameData) {
	return (
		d.places.find((p) => /scoville/i.test(p.name)) ??
		d.places.find((p) => p.type === "venue") ??
		d.places[0]
	);
}

export function tribalPlace(d: GameData) {
	return d.places.find((p) => p.type === "tribal") ?? d.places[0];
}

function dist(a: [number, number], b: [number, number]) {
	const dx = (a[1] - b[1]) * Math.cos((a[0] * Math.PI) / 180);
	return Math.hypot(a[0] - b[0], dx);
}

function hideIdol(s: GameState, d: GameData, r: Rng, camp: string) {
	const c = campCoords(d, camp);
	const spots = d.places
		.filter((p) => p.type !== "tribal")
		.sort((a, b) => dist([a.lat, a.lon], c) - dist([b.lat, b.lon], c))
		.slice(0, 5)
		.map((p) => p.id);
	s.idols[camp] = {
		spots,
		at: r.pick(spots),
		holder: null,
		searched: [],
		hint: null,
	};
}

// ---------- setup ----------

export function createGame(config: Config, d: GameData): GameState {
	const ids = drawCast(d, config.seed, config.castSize);
	if (!ids.includes(config.playerId)) ids[ids.length - 1] = config.playerId;
	const s: GameState = {
		v: 1,
		config,
		rng: config.seed ^ 0x2545f491,
		episode: 0,
		phase: "camp",
		cast: [],
		rel: {},
		alliances: [],
		merged: false,
		mergeAt: mergeAtFor(config.castSize, config.finalN),
		idols: {},
		actions: 2,
		rested: false,
		challenge: null,
		tribal: null,
		episodes: [],
		watching: false,
		pitch: null,
		juryVotes: {},
		winner: null,
		notice: null,
	};
	const r = new Rng(s);
	const stat = () => Math.round(r.range(0.2, 0.95) * 100) / 100;
	r.shuffle(ids).forEach((id, i) => {
		const tribe = config.schools[i % config.schools.length];
		s.cast.push({
			id,
			tribe,
			origTribe: tribe,
			stats: { phys: stat(), mental: stat(), social: stat(), strat: stat() },
			wins: 0,
			teamWins: 0,
			votesAgainst: 0,
			idol: false,
			idolsPlayed: 0,
			advantages: [],
			shotUsed: false,
			out: null,
			juror: false,
		});
	});
	for (let i = 0; i < ids.length; i++)
		for (let j = i + 1; j < ids.length; j++) {
			const colleagues = official(d, ids[i]).body === official(d, ids[j]).body;
			s.rel[relKey(ids[i], ids[j])] = Math.round(
				r.range(-10, 20) + (colleagues ? 15 : 0),
			);
		}
	for (const t of config.schools) hideIdol(s, d, r, t);
	startEpisode(s, d);
	return s;
}

// ---------- episode flow ----------

function startEpisode(s: GameState, d: GameData) {
	const r = new Rng(s);
	s.episode++;
	s.actions = 2;
	s.rested = false;
	s.challenge = null;
	s.tribal = null;
	s.notice = null;
	s.episodes.push({ n: s.episode, lines: [], out: null });

	const tribes = new Set(alive(s).map((c) => c.tribe));
	const tinyTribe = [...tribes].some((t) => tribeMembers(s, t).length < 2);
	if (
		!s.merged &&
		(alive(s).length <= s.mergeAt || tinyTribe || tribes.size < 2)
	) {
		s.merged = true;
		for (const c of alive(s)) c.tribe = MERGE_CAMP;
		hideIdol(s, d, r, MERGE_CAMP);
		line(
			s,
			"host",
			`Jeff: "Drop your buffs! You are now one tribe: ${MERGE_NAME}."`,
		);
		line(
			s,
			"twist",
			`Merge! The ${alive(s).length} remaining castaways move to a new camp at ${mergePlace(d).name} as one ${MERGE_NAME} tribe. From now on, immunity is individual and everyone voted out joins the jury.`,
		);
	}

	aiCamp(s, d, r);

	const speaker = r.pick(alive(s));
	const o = official(d, speaker.id);
	line(
		s,
		"confessional",
		`${o.name} (${BODY_SHORT[o.body]}): "${confessional(o.body, (a) => r.pick(a))}"`,
	);
	const info = d.bodies.find((b) => b.body === o.body);
	if (info?.facts.length) {
		const i = r.int(info.facts.length);
		line(
			s,
			"civic",
			`Civic fact: ${info.facts[i]}`,
			info.factSources[i] ?? info.url,
		);
	}

	s.phase = "camp";
	if (!playerActive(s)) autoEpisode(s, d);
}

function aiCamp(s: GameState, d: GameData, r: Rng) {
	const pid = s.config.playerId;
	const camps = new Set(alive(s).map((c) => c.tribe));
	const events = r.shuffle(CAMP_EVENTS);
	for (const camp of camps) {
		const members = tribeMembers(s, camp);
		if (members.length < 2) continue;
		for (let k = 0; k < 3; k++) {
			const [a, b] = r.shuffle(members);
			addRel(s, a.id, b.id, Math.round(r.range(-6, 10)));
		}
		const ais = members.filter((m) => m.id !== pid);
		if (ais.length >= 2 && r.chance(0.4)) {
			const [a, b] = r.shuffle(ais);
			line(
				s,
				"camp",
				fill(events.shift() ?? CAMP_EVENTS[0], {
					a: fn(d, a.id),
					b: fn(d, b.id),
				}),
			);
			addRel(s, a.id, b.id, 6);
		}
		// AI alliances form between castaways who like each other
		const maxSize = s.merged ? 5 : 4;
		for (const a of r.shuffle(ais)) {
			if (allianceOf(s, a.id) || !r.chance(0.4)) continue;
			const best = ais
				.filter((b) => b.id !== a.id)
				.sort((x, y) => getRel(s, a.id, y.id) - getRel(s, a.id, x.id))[0];
			if (!best || getRel(s, a.id, best.id) < 10) continue;
			const existing = allianceOf(s, best.id);
			if (existing) {
				if (
					existing.members.length < maxSize &&
					!existing.members.includes(pid)
				) {
					existing.members.push(a.id);
				}
			} else {
				const used = new Set(s.alliances.map((x) => x.name));
				const name =
					ALLIANCE_NAMES.find((n) => !used.has(n)) ??
					`Alliance ${s.alliances.length + 1}`;
				s.alliances.push({
					id: `a${s.episode}-${a.id}`,
					name,
					members: [a.id, best.id],
				});
			}
		}
		// AI idol hunting
		const idol = s.idols[camp];
		if (idol && !idol.holder) {
			for (const a of r.shuffle(ais)) {
				if (r.chance(0.05)) {
					giveIdol(s, d, a.id, idol);
					break;
				}
			}
		}
	}
}

function giveIdol(s: GameState, d: GameData, id: string, idol: IdolCamp) {
	idol.holder = id;
	castaway(s, id).idol = true;
	if (id !== s.config.playerId || s.watching) {
		const p = d.places.find((x) => x.id === idol.at);
		line(
			s,
			"camp",
			`${fn(d, id)} quietly found a hidden immunity idol near ${p?.name ?? "camp"}.`,
		);
	}
}

// ---------- player camp actions ----------

export function talk(prev: GameState, d: GameData, target: string): GameState {
	const s = structuredClone(prev);
	const r = new Rng(s);
	const p = player(s);
	const gain = Math.round(5 + p.stats.social * 8 + r.range(0, 6));
	addRel(s, p.id, target, gain);
	s.actions--;
	s.notice = `You spent time with ${fn(d, target)}. They seem to trust you more.`;
	return s;
}

export function propose(
	prev: GameState,
	d: GameData,
	target: string,
): GameState {
	const s = structuredClone(prev);
	const r = new Rng(s);
	const pid = s.config.playerId;
	const rel = getRel(s, pid, target);
	const theirs = allianceOf(s, target);
	const odds = Math.max(
		0.05,
		Math.min(0.95, (rel + 20) / 60 - (theirs ? 0.25 : 0)),
	);
	s.actions--;
	if (r.chance(odds)) {
		if (theirs) theirs.members = theirs.members.filter((m) => m !== target);
		s.alliances = s.alliances.filter(
			(a) => a.members.length > 1 || a.members.includes(pid),
		);
		const mine = allianceOf(s, pid);
		if (mine) mine.members.push(target);
		else {
			const used = new Set(s.alliances.map((x) => x.name));
			const name = ALLIANCE_NAMES.find((n) => !used.has(n)) ?? "Your alliance";
			s.alliances.push({ id: `p${s.episode}`, name, members: [pid, target] });
		}
		addRel(s, pid, target, 4);
		s.notice = `${fn(d, target)} is in. Your alliance: ${allianceOf(s, pid)?.name}.`;
	} else {
		addRel(s, pid, target, -3);
		s.notice = `${fn(d, target)} politely declined. Maybe build more trust first.`;
	}
	return s;
}

export function search(prev: GameState, d: GameData, spot: string): GameState {
	const s = structuredClone(prev);
	const r = new Rng(s);
	const p = player(s);
	const idol = s.idols[p.tribe];
	const place = d.places.find((x) => x.id === spot)?.name ?? "that spot";
	s.actions--;
	if (!idol) return s;
	if (spot === idol.at && !idol.holder) {
		idol.holder = p.id;
		p.idol = true;
		s.notice = `You found a hidden immunity idol at ${place}! Keep it secret.`;
		return s;
	}
	if (!idol.searched.includes(spot)) idol.searched.push(spot);
	const missing = (["extra", "steal"] as Advantage[]).filter(
		(a) => !p.advantages.includes(a),
	);
	if (missing.length && r.chance(0.25)) {
		const adv = r.pick(missing);
		p.advantages.push(adv);
		s.notice = `No idol at ${place}, but you found an advantage: ${ADVANTAGE_LABEL[adv]}.`;
	} else {
		s.notice =
			spot === idol.at
				? `Someone already dug up the idol at ${place}.`
				: `Nothing at ${place}.`;
	}
	return s;
}

export const ADVANTAGE_LABEL: Record<Advantage, string> = {
	extra: "Extra Vote",
	steal: "Steal-a-Vote",
};

export function rest(prev: GameState): GameState {
	const s = structuredClone(prev);
	s.actions--;
	s.rested = true;
	s.notice = "You rested up. You'll do a bit better in the next challenge.";
	return s;
}

// ---------- challenges ----------

function kindFor(episode: number): ChallengeKind {
	return (["trivia", "physical", "hl"] as const)[episode % 3];
}

export function beginChallenge(prev: GameState, d: GameData): GameState {
	const s = structuredClone(prev);
	setupChallenge(s, d);
	s.phase = "challenge";
	s.notice = null;
	return s;
}

function setupChallenge(s: GameState, d: GameData) {
	const r = new Rng(s);
	let kind = kindFor(s.episode);
	if (kind === "trivia" && d.trivia.length < TRIVIA_ROUNDS) kind = "hl";
	let items: number[][] = [];
	let placeId: string;
	if (kind === "hl") {
		for (let i = 0; i < HL_ROUNDS; i++) {
			let a = r.int(d.homes.length);
			let b = r.int(d.homes.length);
			while (
				b === a ||
				Math.abs(d.homes[a].av - d.homes[b].av) / d.homes[a].av < 0.05
			) {
				a = r.int(d.homes.length);
				b = r.int(d.homes.length);
			}
			items.push([a, b]);
		}
		placeId =
			d.places.find((p) => /library/i.test(p.name))?.id ?? tribalPlace(d).id;
	} else if (kind === "trivia") {
		// One question per topic so a round mixes people, history, places and so on.
		const picked: number[] = [];
		const topics = new Set<string | undefined>();
		const order = r.shuffle(d.trivia.map((_, i) => i));
		for (const i of order) {
			if (picked.length >= TRIVIA_ROUNDS) break;
			if (topics.has(d.trivia[i].topic)) continue;
			topics.add(d.trivia[i].topic);
			picked.push(i);
		}
		for (const i of order)
			if (picked.length < TRIVIA_ROUNDS && !picked.includes(i)) picked.push(i);
		items = picked.map((i) => [i]);
		placeId =
			d.trivia[items[0][0]].placeId ??
			r.pick(d.places.filter((p) => p.type === "landmark")).id;
	} else {
		const outdoor = d.places.filter(
			(p) => p.type === "venue" && !/library/i.test(p.name),
		);
		placeId = r.pick(
			outdoor.length ? outdoor : d.places.filter((p) => p.type === "venue"),
		).id;
	}
	s.challenge = {
		kind,
		placeId,
		individual: s.merged,
		items,
		answers: [],
		effort: null,
		result: null,
	};
}

export function answer(
	prev: GameState,
	d: GameData,
	choice: number,
): GameState {
	const s = structuredClone(prev);
	const ch = s.challenge;
	if (!ch || ch.result) return s;
	ch.answers.push(choice);
	if (ch.answers.length >= ch.items.length) resolveChallenge(s, d);
	return s;
}

export function chooseEffort(
	prev: GameState,
	d: GameData,
	effort: "push" | "steady",
): GameState {
	const s = structuredClone(prev);
	if (!s.challenge || s.challenge.result) return s;
	s.challenge.effort = effort;
	resolveChallenge(s, d);
	return s;
}

export function isCorrect(
	d: GameData,
	kind: ChallengeKind,
	item: number[],
	ans: number,
) {
	if (kind === "hl") {
		const [a, b] = item;
		return (d.homes[a].av > d.homes[b].av ? 0 : 1) === ans;
	}
	if (kind === "trivia") return d.trivia[item[0]].answer === ans;
	return false;
}

function resolveChallenge(s: GameState, d: GameData) {
	const r = new Rng(s);
	const ch = s.challenge;
	if (!ch) return;
	const pid = s.config.playerId;
	const scores: Record<string, number> = {};
	const correct: Record<string, number> = {};
	for (const c of alive(s)) {
		const isPlayer = c.id === pid && playerActive(s);
		let sc: number;
		if (ch.kind === "physical") {
			sc = c.stats.phys * 0.55 + r.next() * 0.45;
			if (isPlayer && ch.effort === "push") sc += (r.next() - 0.35) * 0.3;
		} else if (isPlayer) {
			const right = ch.items.filter((it, i) =>
				isCorrect(d, ch.kind, it, ch.answers[i]),
			).length;
			correct[c.id] = right;
			sc = right / ch.items.length + r.next() * 0.01;
		} else {
			const p = 0.4 + 0.45 * c.stats.mental;
			const right = ch.items.filter(() => r.chance(p)).length;
			correct[c.id] = right;
			sc = right / ch.items.length + r.next() * 0.01;
		}
		if (isPlayer && s.rested) sc += 0.06;
		scores[c.id] = sc;
	}
	const place =
		d.places.find((p) => p.id === ch.placeId)?.name ?? "the challenge site";
	const what = CHALLENGE_LABEL[ch.kind];
	const tribeScores: Record<string, number> = {};
	let winners: string[];
	let winnerTribe: string | null = null;
	let loserTribes: string[] = [];
	if (ch.individual) {
		const top = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
		winners = [top];
		castaway(s, top).wins++;
		line(
			s,
			"challenge",
			`${fn(d, top)} won individual immunity in the ${what} at ${place}.`,
		);
	} else {
		const tribes = [...new Set(alive(s).map((c) => c.tribe))];
		for (const t of tribes) {
			const m = tribeMembers(s, t);
			tribeScores[t] = m.reduce((n, c) => n + scores[c.id], 0) / m.length;
		}
		const ranked = [...tribes].sort((a, b) => tribeScores[b] - tribeScores[a]);
		winnerTribe = ranked[0];
		loserTribes = [ranked[ranked.length - 1]];
		winners = tribeMembers(s, winnerTribe).map((c) => c.id);
		for (const c of tribeMembers(s, winnerTribe))
			c.teamWins = (c.teamWins ?? 0) + 1;
		const name = (t: string) => d.schools.find((x) => x.id === t)?.short ?? t;
		line(
			s,
			"challenge",
			`${name(winnerTribe)} won the ${what} at ${place}. ${name(loserTribes[0])} heads to Tribal Council.`,
		);
	}
	// Reward: the winner's camp idol hint
	const hintCamp = castaway(s, winners[0]).tribe;
	const idol = s.idols[hintCamp];
	if (idol && !idol.holder) {
		if (winners.includes(pid) && playerActive(s)) {
			const others = idol.spots.filter(
				(x) => x !== idol.at && !idol.searched.includes(x),
			);
			idol.hint = [idol.at, ...(others.length ? [r.pick(others)] : [])];
		} else {
			const ai = winners.filter((w) => w !== pid);
			if (ai.length && r.chance(0.35)) giveIdol(s, d, r.pick(ai), idol);
		}
	}
	ch.result = {
		scores,
		tribeScores,
		winners,
		winnerTribe,
		loserTribes,
		correct,
	};
	ch.result.why = playerActive(s) ? explainResult(s, d) : null;
}

const pts = (n: number) => Math.round(n * 100);

/** One plain sentence on why the player won or lost, built from the actual scores. */
function explainResult(s: GameState, d: GameData): string | null {
	const ch = s.challenge;
	const res = ch?.result;
	if (!ch || !res) return null;
	const p = player(s);
	const n = ch.items.length;
	const mine = res.correct?.[p.id];
	const physical = ch.kind === "physical";
	const myPart = physical
		? ch.effort === "push"
			? "you went all out"
			: "you played it steady"
		: `you got ${mine} of ${n} right`;
	const rest = s.rested ? " Resting at camp gave you a small boost." : "";
	if (ch.individual) {
		const ranked = Object.entries(res.scores).sort((a, b) => b[1] - a[1]);
		const rank = ranked.findIndex(([id]) => id === p.id) + 1;
		const top = res.winners[0];
		if (top === p.id) {
			return physical
				? `You won because ${myPart} and finished with the best time of all ${ranked.length} players.${rest}`
				: `You won because ${myPart}, the best score of all ${ranked.length} players.${rest}`;
		}
		const theirs = physical
			? `${fn(d, top)} was the fastest of the ${ranked.length} players`
			: `${fn(d, top)} got ${res.correct?.[top] ?? n} of ${n} right`;
		return `You lost: ${myPart} and finished ${ordinal(rank)} of ${ranked.length}, while ${theirs}.${rest}`;
	}
	const name = (t: string) => d.schools.find((x) => x.id === t)?.short ?? t;
	const myTribe = p.tribe;
	const avg = res.tribeScores[myTribe];
	const versus = Object.entries(res.tribeScores)
		.filter(([t]) => t !== myTribe)
		.sort((a, b) => b[1] - a[1])
		.map(([t, v]) => `${name(t)} ${pts(v)}`)
		.join(", ");
	const myScore = res.scores[p.id];
	const pulled =
		myScore >= avg
			? "pulled your tribe's average up"
			: "was below your tribe's average";
	const score = `${name(myTribe)} averaged ${pts(avg)} points (${versus})`;
	if (res.winnerTribe === myTribe)
		return `You won: ${score}, and ${myPart}, which ${pulled}.${rest}`;
	if (res.loserTribes.includes(myTribe))
		return `You lost: ${score}, the lowest score. ${myPart[0].toUpperCase()}${myPart.slice(1)}, which ${pulled}.${rest}`;
	return `You're safe in the middle: ${score}. ${myPart[0].toUpperCase()}${myPart.slice(1)}, which ${pulled}.${rest}`;
}

export const CHALLENGE_LABEL: Record<ChallengeKind, string> = {
	physical: "endurance relay",
	hl: "Higher or Lower assessment challenge",
	trivia: "Oak Park trivia",
};

export function afterChallenge(prev: GameState, d: GameData): GameState {
	const s = structuredClone(prev);
	if (s.phase === "challenge" && s.challenge?.kind !== "physical") {
		s.phase = "learn";
		return s;
	}
	beginTribal(s, d);
	return s;
}

// ---------- tribal council ----------

function threat(s: GameState, c: Castaway) {
	if (!s.merged) return (1 - c.stats.phys) * 12;
	return (
		c.wins * 6 + c.stats.social * 8 + c.stats.strat * 6 + c.idolsPlayed * 6
	);
}

function planVotes(
	s: GameState,
	r: Rng,
	attendees: string[],
	protectedIds: string[],
	pool?: string[],
): Record<string, string> {
	const plan: Record<string, string> = {};
	const pid = s.config.playerId;
	for (const v of attendees) {
		if (v === pid && playerActive(s)) continue;
		const cands = (pool ?? attendees).filter(
			(c) => c !== v && !protectedIds.includes(c),
		);
		if (!cands.length) continue;
		const al = allianceOf(s, v);
		const present = al ? al.members.filter((m) => attendees.includes(m)) : [];
		let bloc: string | null = null;
		if (al && present.length >= 2) {
			let best = Number.NEGATIVE_INFINITY;
			for (const c of cands) {
				if (al.members.includes(c)) continue;
				const score =
					present.reduce((n, m) => n - getRel(s, m, c), 0) +
					threat(s, castaway(s, c)) * present.length;
				if (score > best) {
					best = score;
					bloc = c;
				}
			}
		}
		if (bloc && r.chance(0.85)) {
			plan[v] = bloc;
			continue;
		}
		let best = Number.NEGATIVE_INFINITY;
		for (const c of cands) {
			const score =
				-getRel(s, v, c) +
				threat(s, castaway(s, c)) +
				(al?.members.includes(c) ? -80 : 0) +
				r.range(0, 15);
			if (score > best) {
				best = score;
				plan[v] = c;
			}
		}
	}
	return plan;
}

function beginTribal(s: GameState, d: GameData) {
	const r = new Rng(s);
	const ch = s.challenge;
	const tribe = s.merged
		? MERGE_CAMP
		: (ch?.result?.loserTribes[0] ?? alive(s)[0].tribe);
	const attendees = tribeMembers(s, tribe).map((c) => c.id);
	const immune = s.merged ? (ch?.result?.winners ?? []) : [];
	const planned = planVotes(s, r, attendees, immune);
	const pid = s.config.playerId;
	let whisper: string | null = null;
	const counts: Record<string, number> = {};
	for (const t of Object.values(planned)) counts[t] = (counts[t] ?? 0) + 1;
	const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
	if (top) {
		whisper = r.chance(0.75)
			? top
			: r.pick(attendees.filter((a) => a !== pid && !immune.includes(a)));
	}
	s.tribal = {
		tribe,
		attendees,
		immune,
		planned,
		whisper,
		votes: [],
		idolPlays: [],
		shotSafe: null,
		nullifiedVoters: [],
		out: null,
		tiebreak: null,
		resolved: false,
	};
	s.notice = null;
	if (attendees.includes(pid) && playerActive(s)) {
		s.phase = "tribal";
	} else {
		resolveTribal(s, d, null);
		s.phase = "recap";
	}
}

export interface PlayerVote {
	target: string | null;
	advantage: Advantage | "shot" | null;
	stealFrom: string | null;
	idolOn: string | null;
}

export function castVote(
	prev: GameState,
	d: GameData,
	choice: PlayerVote,
): GameState {
	const s = structuredClone(prev);
	resolveTribal(s, d, choice);
	return s;
}

function resolveTribal(s: GameState, d: GameData, choice: PlayerVote | null) {
	const r = new Rng(s);
	const t = s.tribal as TribalState;
	const pid = s.config.playerId;
	const p = player(s);
	const votes: Vote[] = [];
	const nullified: string[] = [];
	if (choice) {
		if (choice.advantage === "shot") {
			p.shotUsed = true;
			if (r.chance(1 / 6)) t.shotSafe = pid;
		} else if (choice.target) {
			votes.push({ voter: pid, target: choice.target });
			if (choice.advantage === "extra" || choice.advantage === "steal") {
				votes.push({ voter: pid, target: choice.target });
				p.advantages = p.advantages.filter((a) => a !== choice.advantage);
				if (choice.advantage === "steal" && choice.stealFrom)
					nullified.push(choice.stealFrom);
			}
		}
	}
	for (const [voter, target] of Object.entries(t.planned)) {
		if (nullified.includes(voter)) continue;
		let tgt = target;
		const myAl = allianceOf(s, voter);
		if (
			choice?.target &&
			choice.target !== voter &&
			myAl?.members.includes(pid) &&
			getRel(s, voter, pid) >= 15 &&
			r.chance(0.7)
		)
			tgt = choice.target;
		votes.push({ voter, target: tgt });
	}
	// Idols are played after votes are cast, before they are read.
	const tally = (vs: Vote[]) => {
		const c: Record<string, number> = {};
		for (const v of vs) c[v.target] = (c[v.target] ?? 0) + 1;
		return c;
	};
	const pre = tally(votes);
	const ranked = Object.entries(pre).sort((a, b) => b[1] - a[1]);
	for (const id of t.attendees) {
		const c = castaway(s, id);
		if (id === pid && choice) continue;
		if (!c.idol) continue;
		const mine = pre[id] ?? 0;
		const danger = ranked.slice(0, 2).some(([x]) => x === id) && mine >= 2;
		if (danger && r.chance(0.8)) playIdol(s, d, id, id);
	}
	if (choice?.idolOn && p.idol) playIdol(s, d, pid, choice.idolOn);

	const safe = new Set([...t.immune, ...t.idolPlays.map((x) => x.on)]);
	if (t.shotSafe) safe.add(t.shotSafe);
	let counted = votes.filter((v) => !safe.has(v.target));
	if (!counted.length) {
		const pool = t.attendees.filter((a) => !safe.has(a));
		const plan = planVotes(s, r, t.attendees, [...safe], pool);
		for (const [voter, target] of Object.entries(plan))
			if (!nullified.includes(voter))
				votes.push({ voter, target, revote: true });
		if (choice && !nullified.includes(pid)) {
			const fallback = lowestRel(
				s,
				pid,
				pool.filter((x) => x !== pid),
			);
			if (fallback) votes.push({ voter: pid, target: fallback, revote: true });
		}
		counted = votes.filter((v) => v.revote);
	}
	if (!counted.length) {
		const pool = t.attendees.filter((a) => !safe.has(a));
		counted = [
			{
				voter: "",
				target: r.pick(pool.length ? pool : t.attendees),
				revote: true,
			},
		];
	}
	let counts = tally(counted);
	let max = Math.max(...Object.values(counts));
	let tied = Object.keys(counts).filter((k) => counts[k] === max);
	if (tied.length > 1) {
		t.tiebreak = "revote";
		const revotes: Vote[] = [];
		for (const voter of t.attendees) {
			if (tied.includes(voter) || nullified.includes(voter)) continue;
			const target = lowestRel(s, voter, tied);
			if (target) revotes.push({ voter, target, revote: true });
		}
		votes.push(...revotes);
		if (revotes.length) {
			counts = tally(revotes);
			max = Math.max(...Object.values(counts));
			tied = Object.keys(counts).filter((k) => counts[k] === max);
		}
		if (tied.length > 1) t.tiebreak = "stone";
	}
	const out = tied.length > 1 ? r.pick(tied) : tied[0];
	t.votes = votes;
	t.nullifiedVoters = nullified;
	for (const v of votes) {
		if (nullified.includes(v.voter) || !v.voter) continue;
		const c = castaway(s, v.target);
		c.votesAgainst = (c.votesAgainst ?? 0) + 1;
	}
	t.out = out;
	t.resolved = true;

	const byWho = votes
		.filter((v) => v.target === out && !v.revote)
		.map((v) => v.voter);
	eliminate(s, d, out, counted.filter((v) => v.target === out).length, byWho);

	const tribeName =
		t.tribe === MERGE_CAMP
			? MERGE_NAME
			: (d.schools.find((x) => x.id === t.tribe)?.short ?? t.tribe);
	const summary = Object.entries(tally(votes.filter((v) => !v.revote)))
		.sort((a, b) => b[1] - a[1])
		.map(([k, n]) => `${n} ${fn(d, k)}`)
		.join(", ");
	line(
		s,
		"tribal",
		`${tribeName} Tribal Council at Village Hall. Votes: ${summary || "none"}.`,
	);
	if (t.tiebreak === "stone")
		line(s, "tribal", fill(STONE_LINE, { x: fn(d, out) }));
	else if (t.tiebreak === "revote") line(s, "tribal", "A tie forced a revote.");
	line(
		s,
		"tribal",
		`${displayName(d, out)} was voted out (${ordinal(castaway(s, out).out?.place ?? 0)} place). The tribe has spoken.`,
	);
}

function lowestRel(s: GameState, voter: string, among: string[]) {
	return [...among]
		.filter((x) => x !== voter)
		.sort((a, b) => getRel(s, voter, a) - getRel(s, voter, b))[0];
}

function playIdol(s: GameState, d: GameData, by: string, on: string) {
	const t = s.tribal as TribalState;
	const c = castaway(s, by);
	c.idol = false;
	c.idolsPlayed++;
	t.idolPlays.push({ by, on });
	line(
		s,
		"twist",
		by === on
			? `${fn(d, by)} played a hidden immunity idol!`
			: `${fn(d, by)} played a hidden immunity idol for ${fn(d, on)}!`,
	);
	rehideIdolOf(s, d, by);
}

function rehideIdolOf(s: GameState, d: GameData, holder: string) {
	for (const [camp, idol] of Object.entries(s.idols)) {
		if (idol.holder !== holder) continue;
		delete s.idols[camp];
		const active = camp === MERGE_CAMP ? s.merged : !s.merged;
		if (active && alive(s).length > 5) hideIdol(s, d, new Rng(s), camp);
	}
}

function eliminate(
	s: GameState,
	d: GameData,
	id: string,
	votes: number,
	by: string[],
) {
	const c = castaway(s, id);
	const place = alive(s).length;
	c.out = { episode: s.episode, place, votes, by };
	c.juror = s.merged;
	s.episodes[s.episodes.length - 1].out = id;
	for (const v of by) if (v !== id) addRel(s, id, v, -20);
	for (const a of s.alliances) a.members = a.members.filter((m) => m !== id);
	s.alliances = s.alliances.filter((a) => a.members.length > 1);
	if (c.idol) {
		c.idol = false;
		line(s, "twist", `${fn(d, id)} left with an idol in their pocket.`);
		rehideIdolOf(s, d, id);
	}
}

export function afterTribal(prev: GameState): GameState {
	const s = structuredClone(prev);
	s.phase = player(s).out && !s.watching ? "eliminated" : "recap";
	return s;
}

function autoEpisode(s: GameState, d: GameData) {
	setupChallenge(s, d);
	resolveChallenge(s, d);
	beginTribal(s, d);
	s.phase = "recap";
}

export function nextEpisode(prev: GameState, d: GameData): GameState {
	const s = structuredClone(prev);
	if (alive(s).length <= s.config.finalN) {
		s.phase = "finale";
		s.challenge = null;
		s.tribal = null;
		s.notice = null;
		return s;
	}
	startEpisode(s, d);
	return s;
}

export function watchRest(prev: GameState, d: GameData): GameState {
	const s = structuredClone(prev);
	s.watching = true;
	return nextEpisode(s, d);
}

// ---------- finale ----------

export const PITCHES = {
	phys: "My challenge record speaks for itself.",
	social: "I built real relationships with every one of you.",
	strat: "I made the big moves that shaped this game.",
	mental: "I outthought this game at every turn.",
} as const;
export type Pitch = keyof typeof PITCHES;

/**
 * A tied jury is settled by achievement bonus points instead of chance.
 * Each award goes to whichever tied finalist did best at it; the most points wins.
 * If points also tie, the finalist the jury trusts most on average wins.
 * The returned `tied` list is ordered winner-first.
 */
function breakJuryTie(
	tied: Castaway[],
	points: Record<string, number>,
	juryTrust: (c: Castaway) => number,
	r: Rng,
) {
	const n = (v: number, one: string, many: string) =>
		`${v} ${v === 1 ? one : many}`;
	const rules: {
		label: string;
		detail: (v: number) => string;
		value: (c: Castaway) => number;
		higher: boolean;
	}[] = [
		{
			label: "Immunity champ",
			detail: (v) =>
				n(v, "individual immunity win", "individual immunity wins"),
			value: (c) => c.wins,
			higher: true,
		},
		{
			label: "Team player",
			detail: (v) => n(v, "tribe challenge win", "tribe challenge wins"),
			value: (c) => c.teamWins ?? 0,
			higher: true,
		},
		{
			label: "Least voted",
			detail: (v) => `only ${n(v, "vote", "votes")} received all season`,
			value: (c) => c.votesAgainst ?? 0,
			higher: false,
		},
		{
			label: "Idol hunter",
			detail: (v) => n(v, "idol played", "idols played"),
			value: (c) => c.idolsPlayed,
			higher: true,
		},
		{
			label: "Jury favorite",
			detail: () => "most trusted by the jury",
			value: (c) => Math.round(juryTrust(c)),
			higher: true,
		},
	];
	const awards: Award[] = [];
	for (const c of tied) points[c.id] = 0;
	for (const rule of rules) {
		const vals = tied.map((c) => rule.value(c));
		const best = rule.higher ? Math.max(...vals) : Math.min(...vals);
		const winners = tied.filter((c) => rule.value(c) === best).map((c) => c.id);
		if (winners.length === tied.length) continue; // everyone even: no award
		for (const w of winners) points[w]++;
		awards.push({ label: rule.label, detail: rule.detail(best), winners });
	}
	const topPts = Math.max(...tied.map((c) => points[c.id]));
	const leaders = tied.filter((c) => points[c.id] === topPts);
	let winner: Castaway;
	let decidedBy: "points" | "trust" = "points";
	if (leaders.length === 1) winner = leaders[0];
	else {
		decidedBy = "trust";
		const trust = Math.max(...leaders.map(juryTrust));
		const best = leaders.filter((c) => juryTrust(c) === trust);
		winner = best.length === 1 ? best[0] : r.pick(best);
	}
	return {
		tied: [winner.id, ...tied.filter((c) => c !== winner).map((c) => c.id)],
		awards,
		points: { ...points },
		decidedBy,
	};
}

function resume(c: Castaway) {
	return c.wins * 5 + c.idolsPlayed * 6 + c.stats.strat * 8;
}

export function finishSeason(
	prev: GameState,
	opts: { pitch?: Pitch; vote?: string },
): GameState {
	const s = structuredClone(prev);
	const r = new Rng(s);
	const pid = s.config.playerId;
	const finalists = alive(s);
	const jurors = s.cast.filter((c) => c.juror);
	s.pitch = opts.pitch ?? null;
	s.juryVotes = {};
	for (const j of jurors) {
		if (j.id === pid && opts.vote) {
			s.juryVotes[j.id] = opts.vote;
			continue;
		}
		const fav = (Object.keys(j.stats) as Pitch[]).sort(
			(a, b) => j.stats[b] - j.stats[a],
		)[0];
		let best = Number.NEGATIVE_INFINITY;
		for (const f of finalists) {
			let score = getRel(s, j.id, f.id) + resume(f) + r.range(-10, 10);
			if (f.id === pid && opts.pitch === fav) score += 12;
			if (score > best) {
				best = score;
				s.juryVotes[j.id] = f.id;
			}
		}
	}
	const counts: Record<string, number> = {};
	for (const f of finalists) counts[f.id] = 0;
	for (const v of Object.values(s.juryVotes)) counts[v]++;
	const top = Math.max(...Object.values(counts));
	const tied = finalists.filter((f) => counts[f.id] === top);
	s.finalTiebreak = null;
	const bonus: Record<string, number> = {};
	const juryTrust = (c: Castaway) =>
		jurors.length
			? jurors.reduce((n, j) => n + getRel(s, j.id, c.id), 0) / jurors.length
			: 0;
	if (tied.length > 1)
		s.finalTiebreak = breakJuryTie(tied, bonus, juryTrust, r);
	const ranked = [...finalists].sort(
		(a, b) =>
			counts[b.id] - counts[a.id] ||
			(bonus[b.id] ?? 0) - (bonus[a.id] ?? 0) ||
			juryTrust(b) - juryTrust(a),
	);
	if (s.finalTiebreak) {
		ranked.sort((a, b) =>
			a.id === s.finalTiebreak?.tied[0]
				? -1
				: b.id === s.finalTiebreak?.tied[0]
					? 1
					: 0,
		);
	}
	s.winner = ranked[0].id;
	ranked.forEach((c, i) => {
		c.out =
			c.id === s.winner
				? null
				: { episode: s.episode, place: i + 1, votes: 0, by: [] };
	});
	s.phase = "done";
	return s;
}
