import type { GameData } from "./types";

const FILES = [
	"officials",
	"bodies",
	"schools",
	"places",
	"trivia",
	"homes",
] as const;

export async function loadData(): Promise<GameData> {
	const parts = await Promise.all(
		FILES.map(async (f) => {
			const res = await fetch(`${import.meta.env.BASE_URL}data/${f}.json`);
			if (!res.ok) throw new Error(`Could not load ${f}.json`);
			return res.json();
		}),
	);
	return Object.fromEntries(
		FILES.map((f, i) => [f, parts[i]]),
	) as unknown as GameData;
}
