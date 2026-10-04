import {
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";
import { AboutPanel } from "./AboutPanel";
import { DetailPanel } from "./DetailPanel";
import { InfoIcon, ListIcon } from "./icons";
import { Legend } from "./Legend";
import { ListPanel } from "./ListPanel";
import { Sheet } from "./Sheet";
import { TreeMap } from "./TreeMap";
import type { Narrative, Panel, Tree } from "./types";

function readHash(): { tree: string | null; panel: Panel } {
	const p = new URLSearchParams(window.location.hash.slice(1));
	const panel = p.get("panel");
	return {
		tree: p.get("tree"),
		panel:
			panel === "details" || panel === "list" || panel === "about"
				? panel
				: null,
	};
}

export default function App() {
	const [trees, setTrees] = useState<Tree[] | null>(null);
	const [narratives, setNarratives] = useState<Record<string, Narrative>>({});
	const [error, setError] = useState<string | null>(null);
	const [selected, setSelected] = useState<string | null>(
		() => readHash().tree,
	);
	const [panel, setPanel] = useState<Panel>(() => readHash().panel);
	const [flyTarget, setFlyTarget] = useState<Tree | null>(null);
	const [popupOpen, setPopupOpen] = useState(false);

	useEffect(() => {
		Promise.all([
			fetch("/data/oaks.json").then((r) => r.json()),
			fetch("/data/narratives.json").then((r) => r.json()),
		])
			.then(([oaks, narr]) => {
				setTrees(oaks.trees);
				setNarratives(narr);
				const initial = oaks.trees.find((t: Tree) => t.key === readHash().tree);
				if (initial) setFlyTarget({ ...initial });
			})
			.catch(() => setError("Could not load tree data."));
	}, []);

	// Keep the selection and open panel in the URL so a link or reload restores them.
	useEffect(() => {
		const p = new URLSearchParams();
		if (selected) p.set("tree", selected);
		if (panel) p.set("panel", panel);
		const hash = p.toString();
		history.replaceState(
			null,
			"",
			hash ? `#${hash}` : window.location.pathname,
		);
	}, [selected, panel]);

	const byKey = useMemo(
		() => new Map(trees?.map((t) => [t.key, t]) ?? []),
		[trees],
	);
	const current = selected ? (byKey.get(selected) ?? null) : null;
	const close = useCallback(() => setPanel(null), []);
	const toggle = (p: Panel) => setPanel((cur) => (cur === p ? null : p));

	const pick = (key: string) => {
		const t = byKey.get(key);
		if (!t) return;
		setSelected(key);
		setPanel(null);
		setFlyTarget({ ...t });
	};

	const iconBtn = (p: Panel, label: string, icon: ReactNode) => (
		<button
			type="button"
			onClick={() => toggle(p)}
			aria-label={label}
			title={label}
			aria-pressed={panel === p}
			className="grid size-11 place-items-center rounded-lg hover:bg-hover aria-pressed:bg-hover"
		>
			{icon}
		</button>
	);

	return (
		<div className="flex h-dvh flex-col bg-surface text-ink">
			<header className="z-[1100] flex items-center gap-1 border-line border-b pt-[env(safe-area-inset-top)] pr-[max(0.25rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))]">
				<h1 className="flex-1 truncate font-semibold text-lg">
					Oak Park's Oldest Oaks
				</h1>
				{iconBtn("list", "Tree list", <ListIcon />)}
				{iconBtn("about", "About this map", <InfoIcon />)}
			</header>
			<main className="relative flex-1 overflow-hidden">
				{error && <p className="p-4">{error}</p>}
				{trees && (
					<>
						<TreeMap
							trees={trees}
							narratives={narratives}
							selected={selected}
							onSelect={setSelected}
							onMore={(key) => {
								setSelected(key);
								setPanel("details");
							}}
							flyTarget={flyTarget}
							onPopupChange={setPopupOpen}
						/>
						{/* The legend steps aside while a popup is open so it never covers the card. */}
						{!popupOpen && (
							<div className="pointer-events-none absolute top-3 right-3 z-[900]">
								<Legend />
							</div>
						)}
					</>
				)}
				{panel === "details" && current && (
					<Sheet title={current.common} large onClose={close}>
						<DetailPanel tree={current} narrative={narratives[current.key]} />
					</Sheet>
				)}
				{panel === "list" && trees && (
					<Sheet title={`${trees.length} candidate oaks`} onClose={close}>
						<ListPanel trees={trees} onPick={pick} />
					</Sheet>
				)}
				{panel === "about" && (
					<Sheet title="About this map" onClose={close}>
						<AboutPanel count={trees?.length ?? 0} />
					</Sheet>
				)}
			</main>
		</div>
	);
}
