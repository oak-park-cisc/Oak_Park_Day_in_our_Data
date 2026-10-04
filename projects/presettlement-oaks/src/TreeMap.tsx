import L from "leaflet";
import { type RefObject, useEffect, useMemo, useRef } from "react";
import {
	MapContainer,
	Marker,
	Popup,
	TileLayer,
	useMap,
	useMapEvents,
} from "react-leaflet";
import { CONFIDENCE, presentAtSettlement } from "./format";
import { PrimaryCard } from "./PrimaryCard";
import type { Confidence, Narrative, Tree } from "./types";

const HIT = 44;
// Likely trees sit above less certain ones where markers overlap.
const LAYER: Record<Confidence, number> = {
	likely: 300,
	possible: 200,
	long_shot: 100,
};

function icon(c: Confidence, selected: boolean, present: boolean) {
	const { color, size } = CONFIDENCE[c];
	const cls = `oak-dot${present ? " is-present" : ""}${selected ? " is-selected" : ""}`;
	const s = selected ? size + 6 : size;
	return L.divIcon({
		className: "oak-marker",
		iconSize: [HIT, HIT],
		iconAnchor: [HIT / 2, HIT / 2],
		popupAnchor: [0, -s / 2],
		html: `<span class="${cls}" style="width:${s}px;height:${s}px;background:${color}"></span>`,
	});
}

function FlyTo({
	tree,
	markers,
}: {
	tree: Tree | null;
	markers: RefObject<Map<string, L.Marker>>;
}) {
	const map = useMap();
	useEffect(() => {
		if (!tree) return;
		const marker = markers.current.get(tree.key);
		const target = L.latLng(tree.lat, tree.lon);
		// Open the popup once the map stops moving so auto-pan can fit it on screen.
		const open = () => marker && !marker.isPopupOpen() && marker.openPopup();
		if (!map.getBounds().pad(-0.15).contains(target) || map.getZoom() < 16) {
			map.once("moveend", open);
			map.flyTo(target, Math.max(map.getZoom(), 17), { duration: 0.6 });
		} else {
			open();
		}
	}, [tree, map, markers]);
	return null;
}

function PopupWatch({ onChange }: { onChange: (open: boolean) => void }) {
	useMapEvents({
		popupopen: () => onChange(true),
		popupclose: () => onChange(false),
	});
	return null;
}

export function TreeMap({
	trees,
	narratives,
	selected,
	onSelect,
	onMore,
	flyTarget,
	onPopupChange,
}: {
	trees: Tree[];
	narratives: Record<string, Narrative>;
	selected: string | null;
	onSelect: (key: string) => void;
	onMore: (key: string) => void;
	flyTarget: Tree | null;
	onPopupChange: (open: boolean) => void;
}) {
	const markers = useRef(new Map<string, L.Marker>());
	const mapRef = useRef<L.Map>(null);
	const popupWidth = Math.min(280, window.innerWidth - 72);

	// Keep the tree visible beside the side panel (desktop) or above the bottom sheet (phone).
	const revealBesidePanel = (t: Tree) => {
		const map = mapRef.current;
		if (!map) return;
		const p = map.latLngToContainerPoint([t.lat, t.lon]);
		const { x: w, y: h } = map.getSize();
		const wide = window.matchMedia("(min-width: 768px)").matches;
		const goal = wide
			? L.point((w - 400) / 2, h / 2)
			: L.point(w / 2, h * 0.15);
		map.panBy(p.subtract(goal));
	};
	const bounds = useMemo(
		() => L.latLngBounds(trees.map((t) => [t.lat, t.lon] as [number, number])),
		[trees],
	);

	return (
		<MapContainer
			ref={mapRef}
			bounds={bounds}
			boundsOptions={{ padding: [24, 24] }}
			className="h-full w-full"
			zoomControl={true}
		>
			<TileLayer
				attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
				url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
				maxZoom={19}
			/>
			{trees.map((t) => (
				<Marker
					key={t.key}
					position={[t.lat, t.lon]}
					icon={icon(t.confidence, t.key === selected, presentAtSettlement(t))}
					title={`${t.common}, ${presentAtSettlement(t) ? "Likely present at settlement (1833)" : CONFIDENCE[t.confidence].label}, ${t.age_low}–${t.age_high} years`}
					alt={`${t.common} marker`}
					zIndexOffset={t.key === selected ? 1000 : LAYER[t.confidence]}
					ref={(m) => {
						if (m) markers.current.set(t.key, m);
						else markers.current.delete(t.key);
					}}
					eventHandlers={{ click: () => onSelect(t.key) }}
				>
					<Popup
						maxWidth={popupWidth}
						minWidth={popupWidth}
						autoPanPadding={[12, 12]}
					>
						<PrimaryCard
							tree={t}
							narrative={narratives[t.key]}
							onMore={() => {
								markers.current.get(t.key)?.closePopup();
								onMore(t.key);
								revealBesidePanel(t);
							}}
						/>
					</Popup>
				</Marker>
			))}
			<FlyTo tree={flyTarget} markers={markers} />
			<PopupWatch onChange={onPopupChange} />
		</MapContainer>
	);
}
