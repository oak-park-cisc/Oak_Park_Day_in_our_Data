export type Body =
	| "Village Board"
	| "District 97 Board"
	| "District 200 Board"
	| "Park District Board"
	| "Library Board"
	| "Township";

export interface Official {
	id: string;
	name: string;
	body: Body;
	role: string;
	photoUrl: string | null;
	photoCredit: string | null;
	sourceUrl: string;
}

export interface BodyInfo {
	body: Body;
	fullName: string;
	url: string;
	facts: string[];
	factSources: string[];
}

export interface School {
	id: string;
	name: string;
	short: string;
	district: "D97" | "D200";
	level: "Elementary" | "Middle" | "High";
	address: string;
	lat: number;
	lon: number;
	colors: [string, string] | null;
	/** Main tint of the school's logo, used when no official colors are published. */
	logoAccent?: string | null;
	mascot: string | null;
	colorSource: string | null;
	sourceUrl: string;
}

export interface Place {
	id: string;
	name: string;
	type: "tribal" | "venue" | "landmark";
	address: string;
	lat: number;
	lon: number;
	architect: string | null;
	flw: boolean | null;
	year: number | null;
	fact: string;
	sourceUrl: string;
}

export interface Trivia {
	id: string;
	q: string;
	choices: string[];
	answer: number;
	explain: string;
	placeId: string | null;
	sourceUrl: string;
	topic?: string;
}

export interface Home {
	pin: string;
	address: string;
	zip: string;
	cls: string;
	nbhd: string;
	type: string;
	sqft: number;
	built: number;
	beds: number;
	av: number;
	lat: number;
	lon: number;
}

export interface GameData {
	officials: Official[];
	bodies: BodyInfo[];
	schools: School[];
	places: Place[];
	trivia: Trivia[];
	homes: Home[];
}

export type PresetId = "short" | "classic" | "long" | "custom";

export interface Config {
	schools: string[];
	castSize: number;
	finalN: 2 | 3;
	seed: number;
	playerId: string;
	preset: PresetId;
}

export interface Stats {
	phys: number;
	mental: number;
	social: number;
	strat: number;
}

export type Advantage = "extra" | "steal";

export interface Castaway {
	id: string;
	tribe: string;
	origTribe: string;
	stats: Stats;
	wins: number;
	/** Tribe (team) immunity wins; optional so older saves still load. */
	teamWins?: number;
	/** Every vote cast against this castaway over the season. */
	votesAgainst?: number;
	idol: boolean;
	idolsPlayed: number;
	advantages: Advantage[];
	shotUsed: boolean;
	out: null | { episode: number; place: number; votes: number; by: string[] };
	juror: boolean;
}

export interface Alliance {
	id: string;
	name: string;
	members: string[];
}

export interface IdolCamp {
	spots: string[];
	at: string;
	holder: string | null;
	searched: string[];
	hint: string[] | null;
}

export type ChallengeKind = "physical" | "hl" | "trivia";

export interface ChallengeState {
	kind: ChallengeKind;
	placeId: string;
	individual: boolean;
	items: number[][];
	answers: number[];
	effort: "push" | "steady" | null;
	result: null | {
		scores: Record<string, number>;
		tribeScores: Record<string, number>;
		winners: string[];
		winnerTribe: string | null;
		loserTribes: string[];
		/** Correct answers per castaway in knowledge challenges. */
		correct?: Record<string, number>;
		/** One sentence telling the player why they won or lost. */
		why?: string | null;
	};
}

export interface Vote {
	voter: string;
	target: string;
	revote?: boolean;
}

export interface TribalState {
	tribe: string;
	attendees: string[];
	immune: string[];
	planned: Record<string, string>;
	whisper: string | null;
	votes: Vote[];
	idolPlays: { by: string; on: string }[];
	shotSafe: string | null;
	nullifiedVoters: string[];
	out: string | null;
	tiebreak: "revote" | "stone" | null;
	resolved: boolean;
}

export type Phase =
	| "camp"
	| "challenge"
	| "learn"
	| "tribal"
	| "recap"
	| "eliminated"
	| "finale"
	| "done";

export interface RecapLine {
	kind:
		| "camp"
		| "challenge"
		| "tribal"
		| "civic"
		| "confessional"
		| "twist"
		| "host";
	text: string;
	link?: string;
}

export interface Episode {
	n: number;
	lines: RecapLine[];
	out: string | null;
}

export interface Award {
	label: string;
	detail: string;
	winners: string[];
}

/** How a tied jury vote was settled: achievement bonus points, then jury trust. */
export interface FinalTiebreak {
	tied: string[];
	awards: Award[];
	points: Record<string, number>;
	decidedBy: "points" | "trust";
}

export interface GameState {
	v: 1;
	config: Config;
	rng: number;
	episode: number;
	phase: Phase;
	cast: Castaway[];
	rel: Record<string, number>;
	alliances: Alliance[];
	merged: boolean;
	mergeAt: number;
	idols: Record<string, IdolCamp>;
	actions: number;
	rested: boolean;
	challenge: ChallengeState | null;
	tribal: TribalState | null;
	episodes: Episode[];
	watching: boolean;
	pitch: string | null;
	juryVotes: Record<string, string>;
	finalTiebreak?: FinalTiebreak | null;
	winner: string | null;
	notice: string | null;
}
