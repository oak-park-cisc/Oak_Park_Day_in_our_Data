import {
	Flame,
	Gamepad2,
	Map as MapIcon,
	RotateCcw,
	Share2,
	Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camp } from "./Camp";
import { CastList } from "./CastList";
import { Challenge, Learn } from "./Challenge";
import { loadData } from "./data";
import {
	afterChallenge,
	afterTribal,
	alive,
	beginChallenge,
	createGame,
	drawCast,
	finishSeason,
	nextEpisode,
	PRESETS,
	search,
	watchRest,
} from "./engine";
import { GameMap } from "./GameMap";
import { Done, Eliminated, Finale, Recap } from "./Recap";
import { newSeed } from "./rng";
import { Setup, validConfig } from "./Setup";
import { configFromHash, loadSave, shareUrl, writeSave } from "./storage";
import { Tribal } from "./Tribal";
import type { Config, GameData, GameState } from "./types";
import { IconBtn, tribeColors } from "./ui";

type Tab = "game" | "map" | "cast";

function defaultConfig(d: GameData): Config {
	const seed = newSeed();
	const schools = d.schools
		.filter((s) => s.level === "Middle")
		.map((s) => s.id);
	return {
		schools:
			schools.length >= 2
				? schools.slice(0, 2)
				: d.schools.slice(0, 2).map((s) => s.id),
		castSize: PRESETS.classic.castSize,
		finalN: 3,
		seed,
		playerId: drawCast(d, seed, PRESETS.classic.castSize)[0],
		preset: "classic",
	};
}

function normalize(d: GameData, c: Config): Config {
	const schools = c.schools.filter((id) => d.schools.some((s) => s.id === id));
	const cast = drawCast(d, c.seed, Math.max(1, c.castSize || 0));
	return {
		...c,
		schools,
		playerId: cast.includes(c.playerId) ? c.playerId : cast[0],
	};
}

function useMediaQuery(q: string) {
	const [match, setMatch] = useState(() => matchMedia(q).matches);
	useEffect(() => {
		const m = matchMedia(q);
		const on = () => setMatch(m.matches);
		m.addEventListener("change", on);
		return () => m.removeEventListener("change", on);
	}, [q]);
	return match;
}

export default function App() {
	const [data, setData] = useState<GameData | null>(null);
	const [error, setError] = useState<string | null>(null);
	useEffect(() => {
		loadData().then(setData, (e: Error) => setError(e.message));
	}, []);
	if (error) return <p className="p-6">Couldn't load game data: {error}</p>;
	if (!data) return <p className="p-6">Loading Oak Park…</p>;
	return <Shell d={data} />;
}

function Shell({ d }: { d: GameData }) {
	const [game, setGameState] = useState<GameState | null>(() =>
		configFromHash() ? null : loadSave(),
	);
	const [draft, setDraft] = useState<Config>(() => {
		const shared = configFromHash();
		return normalize(d, { ...defaultConfig(d), ...(shared ?? {}) } as Config);
	});
	const [tab, setTab] = useState<Tab>("game");
	const [searchMode, setSearchMode] = useState(false);
	const [housePair, setHousePair] = useState<number[] | null>(null);
	const [toast, setToast] = useState<string | null>(null);
	const panel = useRef<HTMLDivElement>(null);
	const isDesktop = useMediaQuery("(min-width: 768px)");

	const setGame = useCallback((s: GameState | null) => {
		setGameState(s);
		writeSave(s);
	}, []);

	const colors = useMemo(
		() => tribeColors(d, game ? game.config.schools : draft.schools),
		[d, game, draft.schools],
	);

	const phaseKey = game ? `${game.episode}-${game.phase}` : "setup";
	// biome-ignore lint/correctness/useExhaustiveDependencies: scroll to top when the screen changes
	useEffect(() => {
		panel.current?.scrollTo({ top: 0 });
	}, [phaseKey]);

	const start = () => {
		if (!validConfig(d, draft)) return;
		history.replaceState(null, "", location.pathname);
		setGame(createGame(draft, d));
		setTab("game");
	};

	const restart = () => {
		if (
			game &&
			game.phase !== "done" &&
			!window.confirm("Abandon this season and start a new one?")
		)
			return;
		setGame(null);
		setDraft(normalize(d, { ...(game?.config ?? draft), seed: newSeed() }));
		setSearchMode(false);
		setTab("game");
	};

	const share = async () => {
		const url = shareUrl(game?.config ?? draft);
		try {
			if (navigator.share)
				await navigator.share({ title: "Survivor: Oak Park", url });
			else {
				await navigator.clipboard.writeText(url);
				setToast("Season link copied");
				setTimeout(() => setToast(null), 2500);
			}
		} catch {
			// share sheet dismissed
		}
	};

	const toggleSchool = (id: string) => {
		const on = draft.schools.includes(id);
		if (!on && draft.schools.length >= 4) return;
		setDraft({
			...draft,
			schools: on
				? draft.schools.filter((x) => x !== id)
				: [...draft.schools, id],
		});
	};

	let body: React.ReactNode;
	if (!game) {
		body = (
			<Setup
				d={d}
				config={draft}
				colors={colors}
				onChange={(c) => setDraft(normalize(d, c))}
				onStart={start}
				onShowMap={() => setTab("map")}
			/>
		);
	} else {
		const key = phaseKey;
		switch (game.phase) {
			case "camp":
				body = (
					<Camp
						key={key}
						d={d}
						s={game}
						colors={colors}
						setGame={setGame}
						onContinue={() => setGame(beginChallenge(game, d))}
						onSearchMode={setSearchMode}
						onShowMap={() => setTab("map")}
					/>
				);
				break;
			case "challenge":
				body = (
					<Challenge
						key={key}
						d={d}
						s={game}
						setGame={setGame}
						onContinue={() => setGame(afterChallenge(game, d))}
						onPair={setHousePair}
						onShowMap={() => setTab("map")}
					/>
				);
				break;
			case "learn":
				body = (
					<Learn
						key={key}
						d={d}
						s={game}
						onContinue={() => setGame(afterChallenge(game, d))}
					/>
				);
				break;
			case "tribal":
				body = (
					<Tribal
						key={key}
						d={d}
						s={game}
						colors={colors}
						setGame={setGame}
						onContinue={() => setGame(afterTribal(game))}
					/>
				);
				break;
			case "recap":
				body = (
					<Recap
						key={key}
						s={game}
						onNext={() => setGame(nextEpisode(game, d))}
					/>
				);
				break;
			case "eliminated":
				body = (
					<Eliminated
						s={game}
						onWatch={() => setGame(watchRest(game, d))}
						onRestart={restart}
					/>
				);
				break;
			case "finale":
				body = (
					<Finale
						key={key}
						d={d}
						s={game}
						colors={colors}
						onFinish={(o) => setGame(finishSeason(game, o))}
					/>
				);
				break;
			case "done":
				body = <Done d={d} s={game} colors={colors} onRestart={restart} />;
				break;
		}
	}

	const status = game
		? game.phase === "done"
			? "Season complete"
			: `Episode ${game.episode} · ${alive(game).length} left`
		: "Season setup";

	const tabs: {
		id: Tab;
		label: string;
		icon: React.ReactNode;
		show: boolean;
	}[] = [
		{
			id: "game",
			label: game ? "Game" : "Setup",
			icon: <Gamepad2 size={22} aria-hidden />,
			show: true,
		},
		{
			id: "map",
			label: "Map",
			icon: <MapIcon size={22} aria-hidden />,
			show: true,
		},
		{
			id: "cast",
			label: "Cast",
			icon: <Users size={22} aria-hidden />,
			show: !!game,
		},
	];

	return (
		<div className="flex h-dvh flex-col pt-[env(safe-area-inset-top)]">
			<header className="flex items-center gap-2 border-b border-stone-200 bg-white px-3 py-1 dark:border-stone-800 dark:bg-stone-900">
				<Flame className="shrink-0 text-orange-600" aria-hidden />
				<div className="min-w-0 flex-1">
					<h1 className="truncate text-lg font-black leading-tight">
						Survivor: Oak Park
					</h1>
					<p className="truncate text-xs text-stone-500 dark:text-stone-400">
						{status}
					</p>
				</div>
				<IconBtn label="Share this season" onClick={share}>
					<Share2 size={20} />
				</IconBtn>
				{game && (
					<IconBtn label="New season" onClick={restart}>
						<RotateCcw size={20} />
					</IconBtn>
				)}
			</header>
			{toast && (
				<div
					role="status"
					className="fixed left-1/2 top-16 z-[2000] -translate-x-1/2 rounded-lg bg-stone-900 px-4 py-2 text-white shadow-lg"
				>
					{toast}
				</div>
			)}

			<main className="flex min-h-0 flex-1 md:grid md:grid-cols-[1fr_minmax(380px,460px)]">
				<section
					aria-label="Map"
					className={`min-h-0 flex-1 ${tab === "map" ? "flex" : "hidden"} md:flex`}
				>
					<GameMap
						d={d}
						colors={colors}
						visible={tab === "map" || isDesktop}
						selected={draft.schools}
						onToggleSchool={game ? undefined : toggleSchool}
						game={game}
						housePair={game?.phase === "challenge" ? housePair : null}
						searchSpots={
							searchMode && game?.phase === "camp"
								? (game.idols[
										game.cast.find((c) => c.id === game.config.playerId)
											?.tribe ?? ""
									]?.spots ?? null)
								: null
						}
						onSearch={(spot) => {
							if (!game || game.actions <= 0) return;
							setGame(search(game, d, spot));
							setSearchMode(false);
							setTab("game");
						}}
					/>
				</section>
				<div
					className={`min-h-0 min-w-0 flex-1 flex-col md:flex md:border-l md:border-stone-200 md:dark:border-stone-800 ${tab === "map" ? "hidden" : "flex"}`}
				>
					{game && (
						<div
							className="hidden border-b border-stone-200 md:flex dark:border-stone-800"
							role="tablist"
						>
							{tabs
								.filter((t) => t.id !== "map")
								.map((t) => (
									<button
										key={t.id}
										type="button"
										role="tab"
										aria-selected={
											tab === t.id || (tab === "map" && t.id === "game")
										}
										onClick={() => setTab(t.id)}
										className={`flex min-h-11 flex-1 items-center justify-center gap-2 font-semibold ${tab === t.id || (tab === "map" && t.id === "game") ? "border-b-2 border-orange-600 text-orange-700 dark:text-orange-400" : "text-stone-500"}`}
									>
										{t.icon}
										{t.label}
									</button>
								))}
						</div>
					)}
					<div
						ref={panel}
						className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
					>
						{tab === "cast" && game ? (
							<CastList d={d} s={game} colors={colors} />
						) : (
							body
						)}
					</div>
				</div>
			</main>

			<nav
				className="flex border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden dark:border-stone-800 dark:bg-stone-900"
				aria-label="Views"
			>
				{tabs
					.filter((t) => t.show)
					.map((t) => (
						<button
							key={t.id}
							type="button"
							aria-current={tab === t.id ? "page" : undefined}
							onClick={() => setTab(t.id)}
							className={`flex min-h-14 flex-1 flex-col items-center justify-center text-xs font-semibold ${tab === t.id ? "text-orange-700 dark:text-orange-400" : "text-stone-500 dark:text-stone-400"}`}
						>
							{t.icon}
							{t.label}
						</button>
					))}
			</nav>
		</div>
	);
}
