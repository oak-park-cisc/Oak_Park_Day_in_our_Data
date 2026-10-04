import type { Body } from "./types";

export const BODY_SHORT: Record<Body, string> = {
	"Village Board": "Village Board",
	"District 97 Board": "D97 Board",
	"District 200 Board": "D200 Board",
	"Park District Board": "Park Board",
	"Library Board": "Library Board",
	Township: "Township",
};

/** Good-natured confessionals keyed by body. {n} = first name. */
const CONFESSIONALS: Record<Body | "any", string[]> = {
	"Village Board": [
		"I've sat through five-hour budget hearings. Three days at camp is nothing.",
		"Out here every vote is a roll-call vote. I'm used to that.",
		"Public comment taught me to listen first. Turns out that's a Survivor skill.",
	],
	"District 97 Board": [
		"I know how to read a room full of parents. A tribe is easier.",
		"Strategic plan for this game: show up, do the homework, stay off the agenda.",
		"Ten schools, one district. I can manage one tribe.",
	],
	"District 200 Board": [
		"I've been to more Huskie games than this tribe has had campfires.",
		"Big picture thinking. That's what gets you to the final vote.",
		"Every board meeting is basically Tribal Council with better snacks.",
	],
	"Park District Board": [
		"I know every park in this village. The idol isn't hiding from me.",
		"Ridgeland Common is my home turf. Bring on the challenge.",
		"Parks people are outdoor people. This camp is practically a field trip.",
	],
	"Library Board": [
		"I've read about strategy. Now I'm doing the field research.",
		"Quiet in the library, loud at Tribal Council. That's the plan.",
		"Late fees? Gone. Late-game blindsides? Coming soon.",
	],
	Township: [
		"Township government is the oldest form of local government in Illinois. Patience is in my blood.",
		"People forget about the township. That's exactly how I like it in this game.",
		"Under the radar is a strategy. Ask anyone who's never heard of a township assessor.",
	],
	any: [
		"I came here to win, and to maybe find out where the idol is hidden on Lake Street.",
		"My neighbors are watching. I can't go home first.",
		"Alliances are like committees: small, focused, and everyone thinks they're in charge.",
	],
};

export function confessional(
	body: Body,
	pick: <T>(a: readonly T[]) => T,
): string {
	return pick([...CONFESSIONALS[body], ...CONFESSIONALS.any]);
}

export const ALLIANCE_NAMES = [
	"The Prairie School",
	"The Lake Street Loop",
	"The Unity Temple Pact",
	"The Ridgeland Regulars",
	"The Green Line Crew",
	"The Farmers Market Five",
	"The Scoville Squad",
	"The Blue Line Bloc",
	"The Conservatory Club",
	"The Arts District Alliance",
	"The Austin Gardens Accord",
	"The Day in Our Village",
];

export const CAMP_EVENTS = [
	"{a} and {b} bonded over a shared love of Oak Park block parties.",
	"{a} organized the camp chores into a tidy agenda. {b} seconded the motion.",
	"{a} and {b} swapped stories about their favorite neighborhood park.",
	"{a} kept the fire going all night. {b} noticed.",
	"{a} and {b} argued about the best Lake Street lunch spot, then made up.",
	"{a} taught {b} how to read a zoning map by firelight.",
];

export const STONE_LINE =
	"The vote was still tied, so the tied castaways drew stones. {x} drew the white stone and is out.";

export function firstName(name: string): string {
	return name.split(" ")[0];
}

export function fill(tpl: string, vars: Record<string, string>): string {
	return tpl.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? "");
}

export function ordinal(n: number): string {
	const s = ["th", "st", "nd", "rd"];
	const v = n % 100;
	return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
