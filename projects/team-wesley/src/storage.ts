import type { Config, GameState } from "./types";

const KEY = "op-survivor-save-v1";

export function loadSave(): GameState | null {
	try {
		const raw = localStorage.getItem(KEY);
		const s = raw ? (JSON.parse(raw) as GameState) : null;
		return s?.v === 1 ? s : null;
	} catch {
		return null;
	}
}

export function writeSave(s: GameState | null) {
	try {
		if (s) localStorage.setItem(KEY, JSON.stringify(s));
		else localStorage.removeItem(KEY);
	} catch {
		// storage full or disabled: the game still works, it just won't resume
	}
}

export function shareUrl(c: Config): string {
	const q = new URLSearchParams({
		s: c.schools.join(","),
		n: String(c.castSize),
		f: String(c.finalN),
		seed: String(c.seed),
		p: c.playerId,
		preset: c.preset,
	});
	return `${location.origin}${location.pathname}#${q}`;
}

export function configFromHash(): Partial<Config> | null {
	if (!location.hash.includes("seed=")) return null;
	const q = new URLSearchParams(location.hash.slice(1));
	const seed = Number(q.get("seed"));
	if (!Number.isFinite(seed)) return null;
	const f = Number(q.get("f"));
	return {
		schools: (q.get("s") ?? "").split(",").filter(Boolean),
		castSize: Number(q.get("n")) || undefined,
		finalN: f === 2 ? 2 : 3,
		seed,
		playerId: q.get("p") ?? undefined,
		preset: (q.get("preset") as Config["preset"]) ?? "custom",
	};
}
