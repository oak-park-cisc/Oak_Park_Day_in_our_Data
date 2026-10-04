// Headless smoke test: plays many seasons with a random-choice player and checks invariants.
// Run: npx tsx scripts/simulate.ts
import { readFileSync, writeFileSync } from "node:fs";
import * as E from "../src/engine";
import type { Config, GameData, GameState } from "../src/types";

const load = (f: string) => JSON.parse(readFileSync(`public/data/${f}.json`, "utf8"));
const d: GameData = {
	officials: load("officials"),
	bodies: load("bodies"),
	schools: load("schools"),
	places: load("places"),
	trivia: load("trivia"),
	homes: load("homes"),
};

let wins = 0;
let ties = 0;
let tieSaved = false;
const presets: [number, 2 | 3][] = [[12, 3], [18, 3], [20, 3], [9, 2], [24, 2]];
for (let i = 0; i < 300; i++) {
	const [castSize, finalN] = presets[i % presets.length];
	const nT = 2 + (i % 3);
	const schools = d.schools.slice(i % 5, (i % 5) + nT).map((s) => s.id);
	const seed = 1000 + i;
	const cfg: Config = { schools, castSize: Math.max(castSize, nT * 3), finalN, seed, playerId: E.drawCast(d, seed, Math.max(castSize, nT * 3))[0], preset: "custom" };
	let s: GameState = E.createGame(cfg, d);
	let steps = 0;
	while (s.phase !== "done") {
		if (++steps > 2000) throw new Error(`stuck in ${s.phase} seed ${seed}`);
		const p = E.player(s);
		switch (s.phase) {
			case "camp": {
				const mates = E.tribeMembers(s, p.tribe).filter((c) => c.id !== p.id);
				const idol = s.idols[p.tribe];
				if (idol && s.actions > 0) s = E.search(s, d, idol.spots[steps % idol.spots.length]);
				if (mates.length && s.actions > 0) s = E.propose(s, d, mates[steps % mates.length].id);
				s = E.beginChallenge(s, d);
				break;
			}
			case "challenge":
				if (!s.challenge?.result) {
					s = s.challenge?.kind === "physical" ? E.chooseEffort(s, d, "push") : E.answer(s, d, steps % 2);
				} else s = E.afterChallenge(s, d);
				break;
			case "learn":
				s = E.afterChallenge(s, d);
				break;
			case "tribal": {
				const t = s.tribal!;
				if (t.resolved) { s = E.afterTribal(s); break; }
				const cands = t.attendees.filter((a) => a !== p.id && !t.immune.includes(a));
				s = E.castVote(s, d, {
					target: cands[0],
					advantage: p.advantages[0] ?? null,
					stealFrom: cands[1] ?? cands[0],
					idolOn: p.idol ? p.id : null,
				});
				break;
			}
			case "recap":
				s = E.nextEpisode(s, d);
				break;
			case "eliminated":
				s = E.watchRest(s, d);
				break;
			case "finale": {
				const before = s;
				const p0 = E.player(s);
				s = E.finishSeason(s, { pitch: "social", vote: E.alive(s)[0].id });
				if (s.finalTiebreak && !tieSaved && p0.out && !p0.juror) {
					// a tied finale the browser test can replay (player has no say in it)
					writeFileSync("/tmp/tied-finale.json", JSON.stringify(before));
					tieSaved = true;
				}
				break;
			}
				break;
		}
		const live = s.cast.filter((c) => !c.out).length;
		if (s.phase !== "done" && live < cfg.finalN) throw new Error(`too few alive (${live}) seed ${seed}`);
		JSON.parse(JSON.stringify(s));
	}
	if (s.winner === cfg.playerId) wins++;
	const tally: Record<string, number> = {};
	for (const v of Object.values(s.juryVotes)) tally[v] = (tally[v] ?? 0) + 1;
	const top = Math.max(...Object.values(tally));
	const leaders = Object.keys(tally).filter((k) => tally[k] === top);
	if (leaders.length > 1) {
		ties++;
		const tb = s.finalTiebreak;
		if (!tb || tb.tied[0] !== s.winner || tb.tied.length !== leaders.length)
			throw new Error(`tie not settled by bonus points, seed ${seed}`);
	} else if (s.finalTiebreak || s.winner !== leaders[0]) throw new Error(`wrong winner seed ${seed}`);
	const jurors = s.cast.filter((c) => c.juror).length;
	if (!s.winner || Object.keys(s.juryVotes).length !== jurors) throw new Error(`bad finale seed ${seed}`);
	if (i < 3) console.log(`seed ${seed}: ${s.episode} episodes, jury ${jurors}, winner ${s.winner}`);
}
console.log(`300 seasons OK. Player won ${wins}. Jury ties settled by bonus points: ${ties}.`);
