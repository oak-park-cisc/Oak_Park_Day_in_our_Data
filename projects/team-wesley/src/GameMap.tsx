import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo } from "react";
import {
	LayerGroup,
	LayersControl,
	MapContainer,
	Marker,
	Popup,
	TileLayer,
	useMap,
} from "react-leaflet";
import {
	alive,
	campCoords,
	MERGE_CAMP,
	mergePlace,
	player,
	tribalPlace,
} from "./engine";
import type { GameData, GameState, Place } from "./types";
import { textOn, tribeName } from "./ui";

const CENTER: [number, number] = [41.8855, -87.7845];

function pin(html: string, size: number, cls = "") {
	return L.divIcon({
		html,
		className: `op-pin ${cls}`,
		iconSize: [size, size],
		iconAnchor: [size / 2, size / 2],
	});
}

function campIcon(
	color: string,
	label: string,
	count: number | null,
	dim = false,
) {
	return pin(
		`<div class="op-camp${dim ? " op-dim" : ""}" style="background:${color};color:${textOn(color)}">${count ?? ""}</div><div class="op-label">${label}</div>`,
		34,
	);
}

const ICON_SVG = {
	venue:
		'<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>',
	landmark:
		'<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 22h18M6 18v-7M10 18v-7M14 18v-7M18 18v-7M12 2l8 5H4z"/></svg>',
	tribal:
		'<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2c1.5 3 4 4.5 4 8a4 4 0 0 1-8 0c0-2 1-3 1.5-4.5.5 1.5 1.2 2 2 2C11 5.5 11.2 4 12 2z"/><rect x="11" y="14" width="2" height="8"/></svg>',
};

function placeIcon(p: Place, active: boolean) {
	return pin(
		`<div class="op-place op-${p.type}${active ? " op-active" : ""}">${ICON_SVG[p.type]}</div>`,
		p.type === "tribal" ? 32 : 26,
	);
}

function spotIcon(n: number, state: "open" | "hint" | "searched") {
	return pin(
		`<div class="op-spot op-spot-${state}">${state === "searched" ? "✕" : n}</div>`,
		30,
	);
}

function PlacePopup({ p }: { p: Place }) {
	return (
		<Popup>
			<strong>{p.name}</strong>
			{p.architect && (
				<div>
					{p.architect}
					{p.year ? `, ${p.year}` : ""}
				</div>
			)}
			<div className="mt-1">{p.fact}</div>
			<a href={p.sourceUrl} target="_blank" rel="noreferrer">
				Source
			</a>
		</Popup>
	);
}

function FlyTo({
	bounds,
	visible,
}: {
	bounds: [number, number][];
	visible: boolean;
}) {
	const map = useMap();
	const key = JSON.stringify(bounds);
	// biome-ignore lint/correctness/useExhaustiveDependencies: refit when the target set changes or the map is shown again
	useEffect(() => {
		if (!visible || !bounds.length) return;
		// A hidden map has zero size; wait until layout settles before fitting.
		const t = setTimeout(() => {
			map.invalidateSize();
			if (map.getSize().x === 0) return;
			map.flyToBounds(
				L.latLngBounds(bounds).pad(bounds.length > 2 ? 0.05 : 0.6),
				{
					maxZoom: 16,
					duration: 0.8,
				},
			);
		}, 60);
		return () => clearTimeout(t);
	}, [key, visible, map]);
	return null;
}

/** Leaflet sizes itself on mount; recompute when the tab or layout shows it again. */
function Resizer() {
	const map = useMap();
	useEffect(() => {
		const ro = new ResizeObserver(() => map.invalidateSize());
		ro.observe(map.getContainer());
		return () => ro.disconnect();
	}, [map]);
	return null;
}

export interface MapProps {
	d: GameData;
	colors: Record<string, string>;
	visible: boolean;
	// setup mode
	selected?: string[];
	onToggleSchool?: (id: string) => void;
	// game mode
	game?: GameState | null;
	searchSpots?: string[] | null;
	/** Indexes into d.homes for the Higher-or-Lower pair on screen. */
	housePair?: number[] | null;
	onSearch?: (spot: string) => void;
}

export function GameMap({
	d,
	colors,
	visible,
	selected,
	onToggleSchool,
	game,
	searchSpots,
	housePair,
	onSearch,
}: MapProps) {
	const tribal = tribalPlace(d);
	const venues = d.places.filter((p) => p.type === "venue");
	const landmarks = d.places.filter((p) => p.type === "landmark");
	const activePlace = game?.challenge?.placeId ?? null;

	const camps = useMemo(() => {
		if (!game) return [];
		const counts: Record<string, number> = {};
		for (const c of alive(game)) counts[c.tribe] = (counts[c.tribe] ?? 0) + 1;
		return Object.entries(counts);
	}, [game]);

	const idol =
		game && !player(game).out ? game.idols[player(game).tribe] : null;
	const showSpots = idol && (searchSpots || idol.hint) ? idol.spots : null;

	const houses = housePair?.map((i) => d.homes[i]).filter(Boolean) ?? [];
	const houseKey = housePair?.join(",") ?? "";

	// biome-ignore lint/correctness/useExhaustiveDependencies: houseKey stands in for houses
	const focus: [number, number][] | null = useMemo(() => {
		if (houses.length) return houses.map((h) => [h.lat, h.lon]);
		if (idol?.hint && searchSpots) {
			return idol.hint
				.map((id) => d.places.find((p) => p.id === id))
				.filter((p): p is Place => !!p)
				.map((p) => [p.lat, p.lon]);
		}
		if (searchSpots) {
			return searchSpots
				.map((id) => d.places.find((p) => p.id === id))
				.filter((p): p is Place => !!p)
				.map((p) => [p.lat, p.lon]);
		}
		if (activePlace) {
			const p = d.places.find((x) => x.id === activePlace);
			return p ? [[p.lat, p.lon]] : null;
		}
		return null;
	}, [idol, searchSpots, activePlace, d.places, houseKey]);

	const home = useMemo(
		() => [...d.schools, tribal].map((p) => [p.lat, p.lon] as [number, number]),
		[d.schools, tribal],
	);

	const voted = game
		? game.cast.filter((c) => c.out && c.out.place > game.config.finalN)
		: [];

	return (
		<MapContainer
			center={CENTER}
			zoom={14}
			className="h-full w-full"
			scrollWheelZoom
			aria-label="Map of Oak Park"
		>
			<TileLayer
				attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
				url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
			/>
			<Resizer />
			<FlyTo bounds={focus ?? home} visible={visible} />
			<LayersControl key={game ? "game" : "setup"} position="topright">
				<LayersControl.Overlay checked name="Tribe camps">
					<LayerGroup>
						{!game &&
							d.schools.map((s) => {
								const on = selected?.includes(s.id);
								return (
									<Marker
										key={s.id}
										position={[s.lat, s.lon]}
										title={`${s.name}${on ? " (selected)" : ""}`}
										alt={s.name}
										icon={campIcon(
											on ? colors[s.id] : "#fafaf9",
											s.short,
											on ? null : null,
											!on,
										)}
										zIndexOffset={600}
										eventHandlers={{ click: () => onToggleSchool?.(s.id) }}
									/>
								);
							})}
						{game?.config.schools.map((id) => {
							const live = camps.find(([t]) => t === id);
							const sch = d.schools.find((s) => s.id === id);
							if (!sch) return null;
							return (
								<Marker
									key={id}
									position={[sch.lat, sch.lon]}
									title={`${sch.name}: ${live ? `${live[1]} castaways` : "camp empty"}`}
									icon={campIcon(
										colors[id],
										sch.short,
										live ? live[1] : null,
										!live,
									)}
								>
									<Popup>
										<strong>{sch.name}</strong>
										<div>
											{live
												? `${tribeName(d, id)} camp · ${live[1]} left`
												: "Camp abandoned"}
										</div>
									</Popup>
								</Marker>
							);
						})}
						{game?.merged && (
							<Marker
								position={campCoords(d, MERGE_CAMP)}
								title={`Merged camp at ${mergePlace(d).name}`}
								icon={campIcon(
									colors.merge,
									"Merged camp",
									camps.find(([t]) => t === MERGE_CAMP)?.[1] ?? 0,
								)}
							/>
						)}
					</LayerGroup>
				</LayersControl.Overlay>
				<LayersControl.Overlay checked={!!game} name="Challenge sites">
					<LayerGroup>
						{venues.map((p) => (
							<Marker
								key={p.id}
								position={[p.lat, p.lon]}
								title={p.name}
								icon={placeIcon(p, p.id === activePlace)}
							>
								<PlacePopup p={p} />
							</Marker>
						))}
					</LayerGroup>
				</LayersControl.Overlay>
				<LayersControl.Overlay checked={!!game} name="Landmarks">
					<LayerGroup>
						{landmarks.map((p) => (
							<Marker
								key={p.id}
								position={[p.lat, p.lon]}
								title={p.name}
								icon={placeIcon(p, p.id === activePlace)}
							>
								<PlacePopup p={p} />
							</Marker>
						))}
					</LayerGroup>
				</LayersControl.Overlay>
				<LayersControl.Overlay checked name="Tribal Council">
					<LayerGroup>
						<Marker
							position={[tribal.lat, tribal.lon]}
							title="Tribal Council: Village Hall"
							icon={placeIcon(tribal, false)}
							zIndexOffset={500}
						>
							<Popup>
								<strong>Tribal Council</strong>
								<div>Council Chambers, {tribal.name}</div>
								{voted.length > 0 && (
									<div className="mt-1">
										Voted out:{" "}
										{voted
											.map((c) => d.officials.find((o) => o.id === c.id)?.name)
											.join(", ")}
									</div>
								)}
							</Popup>
						</Marker>
					</LayerGroup>
				</LayersControl.Overlay>
			</LayersControl>
			{houses.map((h, k) => (
				<Marker
					key={`house-${h.pin}`}
					position={[h.lat, h.lon]}
					title={`Home ${k === 0 ? "A" : "B"}: ${h.address}`}
					zIndexOffset={1200}
					icon={pin(`<div class="op-house">${k === 0 ? "A" : "B"}</div>`, 34)}
				>
					<Popup>
						<strong>Home {k === 0 ? "A" : "B"}</strong>
						<div>{h.address}</div>
						<div>
							{h.type}, built {h.built}
						</div>
					</Popup>
				</Marker>
			))}
			{showSpots?.map((id, i) => {
				const p = d.places.find((x) => x.id === id);
				if (!p || !idol) return null;
				const searched = idol.searched.includes(id);
				const hinted = idol.hint?.includes(id);
				if (idol.hint && !hinted && !searched) return null;
				return (
					<Marker
						key={`spot-${id}`}
						position={[p.lat, p.lon]}
						title={`Search spot ${i + 1}: ${p.name}`}
						zIndexOffset={1000}
						icon={spotIcon(
							i + 1,
							searched ? "searched" : hinted ? "hint" : "open",
						)}
						eventHandlers={{
							click: () => searchSpots && !searched && onSearch?.(id),
						}}
					/>
				);
			})}
		</MapContainer>
	);
}
