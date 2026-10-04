import L from "leaflet";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { AreaTree } from "./area";
import type { Bounds } from "./canopy";
import {
	binColor,
	binWeight,
	cellValue,
	coverColor,
	coverLegend,
	LOW_COUNT_COLOR,
	legendItems,
	type Metric,
	niceName,
	zoneColor,
	zoneLegend,
} from "./metrics";
import type { Center, Nearby } from "./nearby";
import type { BlockFeature, ModisData, ZonesData } from "./types";

export type Mode = "blocks" | "near" | "zones" | "satellite" | "area";

type Props = {
	mode: Mode;
	blocks: BlockFeature[];
	metric: Metric;
	/** Blocks passing the filters; others are drawn faded */
	visible: Set<string>;
	/** With the majority flag on, only these blocks are drawn (null = flag off) */
	flagged: Set<string> | null;
	selected: string | null;
	/** Increments when the map should zoom to the selected block */
	focusToken: number;
	onSelect: (block: string) => void;
	zones: ZonesData | null;
	selectedZone: string | null;
	onSelectZone: (zone: string) => void;
	center: Center | null;
	radiusFt: number;
	nearby: Nearby | null;
	selectedTree: number | null;
	onSelectTree: (idx: number) => void;
	onMapClick: (lat: number, lon: number) => void;
	modis: ModisData | null;
	/** Index into modis years, or null for the recent average */
	satYearIdx: number | null;
	selectedCell: string | null;
	onSelectCell: (id: string) => void;
	/** Area tool: the finished rectangle, the first corner while drawing, and trees inside */
	areaBounds: Bounds | null;
	areaCorner: [number, number] | null;
	drawing: boolean;
	areaTrees: AreaTree[] | null;
	onAreaClick: (lat: number, lon: number) => void;
	/** Increments when the app wants the current map view as the area */
	viewToken: number;
	onViewBounds: (b: Bounds) => void;
};

const FADED = "#c3c2b7";
/** Violet, so flagged blocks stand apart from the red–green scale on the other tabs */
const FLAG_COLOR = "#4a3aa7";
const FT_TO_M = 0.3048;

export function MapView(props: Props) {
	const { mode, blocks, metric, visible, flagged, selected, focusToken, zones, selectedZone } = props;
	const { center, radiusFt, nearby, selectedTree, modis, satYearIdx, selectedCell } = props;
	const { areaBounds, areaCorner, drawing, areaTrees, viewToken } = props;
	const el = useRef<HTMLElement>(null);
	const map = useRef<L.Map | null>(null);
	const layers = useRef(new Map<string, { casing: L.Polyline; line: L.Polyline }>());
	const zoneLayer = useRef<L.GeoJSON | null>(null);
	const nearLayer = useRef<L.LayerGroup | null>(null);
	const cellLayer = useRef<L.GeoJSON | null>(null);
	const areaLayer = useRef<L.LayerGroup | null>(null);
	const previewRect = useRef<L.Rectangle | null>(null);
	const treeLayers = useRef(new Map<number, L.Circle>());
	// Start the legend collapsed when the map is short so it doesn't cover the map.
	const [legendOpen, setLegendOpen] = useState(() => !matchMedia("(max-height: 600px)").matches);
	// Latest props for Leaflet event handlers created once.
	const live = useRef(props);
	live.current = props;

	// Create the map and one casing + line per block once.
	useEffect(() => {
		if (!el.current) return;
		const m = L.map(el.current, { zoomSnap: 0.5, preferCanvas: true });
		map.current = m;
		L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
			maxZoom: 20,
			maxNativeZoom: 19,
			attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
		}).addTo(m);
		// Each layer group gets its own pane; only the active tab's pane takes taps (see below).
		m.createPane("zones").style.zIndex = "350";
		m.createPane("blocks").style.zIndex = "400";
		m.createPane("trees").style.zIndex = "450";

		// Generous tap tolerance so thin street lines are easy to hit on touch screens.
		const renderer = L.canvas({ tolerance: 10, pane: "blocks" });
		const group = L.featureGroup().addTo(m);
		for (const f of blocks) {
			if (!f.geometry) continue;
			const latlngs = f.geometry.coordinates.map((seg) => seg.map(([x, y]) => [y, x] as [number, number]));
			const casing = L.polyline(latlngs, { renderer, color: "#fff", weight: 8, interactive: false }).addTo(group);
			const line = L.polyline(latlngs, { renderer, weight: 5, lineCap: "round" }).addTo(group);
			line.bindTooltip(f.properties.block, { sticky: true });
			line.on("click", (e) => {
				const p = live.current;
				if (p.mode !== "blocks" || !p.visible.has(f.properties.block)) return;
				L.DomEvent.stop(e);
				p.onSelect(f.properties.block);
			});
			layers.current.set(f.properties.block, { casing, line });
		}
		m.on("click", (e) => {
			if (live.current.mode === "near") live.current.onMapClick(e.latlng.lat, e.latlng.lng);
			if (live.current.mode === "area" && live.current.drawing) live.current.onAreaClick(e.latlng.lat, e.latlng.lng);
		});
		m.fitBounds(group.getBounds(), { padding: [8, 8] });
		const ro = new ResizeObserver(() => m.invalidateSize());
		ro.observe(el.current);
		return () => {
			ro.disconnect();
			m.remove();
			layers.current.clear();
		};
	}, [blocks]);

	// A full-size canvas in a higher pane would swallow taps meant for the layers below it.
	useEffect(() => {
		const m = map.current;
		if (!m) return;
		for (const [pane, active] of [
			["blocks", mode === "blocks"],
			["trees", mode === "near"],
		] as const) {
			const el = m.getPane(pane);
			if (el) el.style.pointerEvents = active ? "" : "none";
		}
	}, [mode]);

	// Restyle blocks on mode, metric, filter or selection change.
	useEffect(() => {
		for (const f of blocks) {
			const l = layers.current.get(f.properties.block);
			if (!l) continue;
			const id = f.properties.block;
			const hidden = flagged != null && !flagged.has(id);
			// The Area tab shows every (unhidden) block for context; taps there place corners instead.
			const shown = !hidden && (mode === "area" || (mode === "blocks" && visible.has(id)));
			// Outside the Blocks tab, flagged blocks stay visible on top of zones, cells and trees.
			const flagOverlay = !hidden && flagged != null && mode !== "blocks" && mode !== "area";
			const isSel = shown && id === selected;
			l.line.setStyle(
				hidden
					? { opacity: 0 }
					: shown
						? {
								color: binColor(metric, f.properties, flagged != null),
								// Thicker = needs more attention, a second cue alongside red/green.
								weight: binWeight(metric, f.properties, flagged != null) + (isSel ? 4 : 0),
								opacity: 1,
								dashArray: f.properties.low_count ? "2 8" : undefined,
							}
						: flagOverlay
							? { color: FLAG_COLOR, weight: 5, opacity: 1, dashArray: undefined }
							: { color: FADED, weight: 2, opacity: mode === "blocks" ? 0.8 : 0.5, dashArray: undefined },
			);
			l.casing.setStyle({
				weight: (shown ? binWeight(metric, f.properties, flagged != null) : 5) + (isSel ? 8 : 3),
				// A dark casing keeps the light green and orange steps visible on the pale basemap.
				color: "#0b0b0b",
				opacity: shown || flagOverlay ? (isSel ? 1 : 0.35) : 0,
			});
			if (isSel || shown || flagOverlay) {
				l.casing.bringToFront();
				l.line.bringToFront();
			}
		}
	}, [blocks, metric, selected, visible, mode, flagged]);

	// Zoom to the selected block when asked (e.g. picked from the list).
	// biome-ignore lint/correctness/useExhaustiveDependencies: only react to explicit focus requests
	useEffect(() => {
		const l = selected ? layers.current.get(selected) : null;
		if (l && map.current) map.current.fitBounds(l.line.getBounds(), { maxZoom: 17, padding: [40, 40] });
	}, [focusToken]);

	// School zones, shaded by share of one-genus blocks.
	useEffect(() => {
		const m = map.current;
		if (!m) return;
		zoneLayer.current?.remove();
		zoneLayer.current = null;
		if (mode !== "zones" || !zones) return;
		zoneLayer.current = L.geoJSON(zones as GeoJSON.FeatureCollection, {
			pane: "zones",
			style: (f) => {
				const sel = f?.properties.zone === selectedZone;
				return {
					fillColor: zoneColor(f?.properties.share_blocks_genus_30pct_plus ?? null),
					fillOpacity: sel ? 0.7 : 0.55,
					color: sel ? "#0b0b0b" : "#fff",
					weight: sel ? 4 : 2,
				};
			},
			onEachFeature: (f, layer) => {
				layer.bindTooltip(f.properties.zone, { permanent: true, direction: "center", className: "zone-label" });
				layer.on("click", () => live.current.onSelectZone(f.properties.zone));
			},
		}).addTo(m);
	}, [mode, zones, selectedZone]);

	// MODIS satellite tree-cover cells.
	useEffect(() => {
		const m = map.current;
		if (!m) return;
		cellLayer.current?.remove();
		cellLayer.current = null;
		if (mode !== "satellite" || !modis) return;
		cellLayer.current = L.geoJSON(modis as GeoJSON.FeatureCollection, {
			pane: "zones",
			style: (f) => {
				const p = f?.properties;
				const sel = p.id === selectedCell;
				return {
					fillColor: coverColor(cellValue(p.cover, p.recent_mean, satYearIdx)),
					fillOpacity: sel ? 0.8 : 0.6,
					color: "#0b0b0b",
					weight: sel ? 3 : 0,
				};
			},
			onEachFeature: (f, layer) => {
				const v = cellValue(f.properties.cover, f.properties.recent_mean, satYearIdx);
				layer.bindTooltip(`${v ?? "—"}% tree cover`, { sticky: true });
				layer.on("click", () => live.current.onSelectCell(f.properties.id));
			},
		}).addTo(m);
		const sel =
			selectedCell &&
			cellLayer.current.getLayers().find((l) => (l as L.Polygon).feature?.properties.id === selectedCell);
		if (sel) (sel as L.Polygon).bringToFront();
	}, [mode, modis, satYearIdx, selectedCell]);

	// Area tool: rectangle, a preview that follows the pointer after the first corner, and the
	// crowns of trees inside drawn at their recorded spread (overlaps show darker).
	useEffect(() => {
		const m = map.current;
		if (!m) return;
		areaLayer.current?.remove();
		areaLayer.current = null;
		if (mode !== "area") return;
		const g = L.layerGroup().addTo(m);
		areaLayer.current = g;
		if (areaBounds) {
			// Gray out everything outside the rectangle: a world-sized polygon with the rectangle as a hole.
			L.polygon(
				[
					[
						[-85, -180],
						[-85, 180],
						[85, 180],
						[85, -180],
					],
					[
						[areaBounds.south, areaBounds.west],
						[areaBounds.north, areaBounds.west],
						[areaBounds.north, areaBounds.east],
						[areaBounds.south, areaBounds.east],
					],
				],
				{ pane: "trees", stroke: false, fillColor: "#3a3a38", fillOpacity: 0.55, interactive: false },
			).addTo(g);
			for (const t of (areaTrees ?? []).slice(0, 6000)) {
				L.circle([t.lat, t.lon], {
					pane: "trees",
					radius: Math.max(1, ((t.spread ?? 0) / 2) * FT_TO_M),
					stroke: false,
					fillColor: "#2e8b3e",
					fillOpacity: 0.45,
					interactive: false,
				}).addTo(g);
			}
			L.rectangle(
				[
					[areaBounds.south, areaBounds.west],
					[areaBounds.north, areaBounds.east],
				],
				{ pane: "trees", color: "#0b0b0b", weight: 2, dashArray: "6 6", fill: false, interactive: false },
			).addTo(g);
		}
		if (areaCorner) {
			L.circleMarker(areaCorner, {
				pane: "trees",
				radius: 6,
				color: "#0b0b0b",
				weight: 3,
				fillColor: "#fff",
				fillOpacity: 1,
				interactive: false,
			}).addTo(g);
			previewRect.current = L.rectangle([areaCorner, areaCorner], {
				pane: "trees",
				color: "#0b0b0b",
				weight: 1.5,
				dashArray: "4 4",
				fillOpacity: 0.05,
				interactive: false,
			}).addTo(g);
			const follow = (e: L.LeafletMouseEvent) => previewRect.current?.setBounds(L.latLngBounds(areaCorner, e.latlng));
			m.on("mousemove", follow);
			return () => {
				m.off("mousemove", follow);
				previewRect.current = null;
			};
		}
	}, [mode, areaBounds, areaCorner, areaTrees]);

	// Hand the visible map area to the app when asked ("Map view" button).
	useEffect(() => {
		const m = map.current;
		if (!m || viewToken === 0) return;
		const b = m.getBounds();
		live.current.onViewBounds({ south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() });
	}, [viewToken]);

	// Nearby trees drawn at their recorded crown spread, plus the search radius.
	useEffect(() => {
		const m = map.current;
		if (!m) return;
		nearLayer.current?.remove();
		nearLayer.current = null;
		treeLayers.current.clear();
		if (mode !== "near" || !center) return;
		const g = L.layerGroup().addTo(m);
		nearLayer.current = g;
		const range = L.circle([center.lat, center.lon], {
			radius: radiusFt * FT_TO_M,
			pane: "trees",
			color: "#0b0b0b",
			weight: 2,
			dashArray: "6 6",
			fill: false,
			interactive: false,
		}).addTo(g);
		for (const t of nearby?.trees ?? []) {
			const c = L.circle([t.lat, t.lon], {
				pane: "trees",
				radius: Math.max(1.5, ((t.spread ?? 0) / 2) * FT_TO_M),
				color: "#fff",
				weight: 1.5,
				fillColor: t.color,
				fillOpacity: 0.75,
			}).addTo(g);
			c.bindTooltip(`${niceName(t.common)} · ${t.dbh ?? "—"} in DBH`);
			c.on("click", (e) => {
				L.DomEvent.stop(e);
				live.current.onSelectTree(t.idx);
			});
			treeLayers.current.set(t.idx, c);
		}
		L.circleMarker([center.lat, center.lon], {
			pane: "trees",
			radius: 7,
			color: "#0b0b0b",
			weight: 3,
			fillColor: "#fff",
			fillOpacity: 1,
			interactive: false,
		}).addTo(g);
		m.fitBounds(range.getBounds(), { padding: [12, 12] });
	}, [mode, center, radiusFt, nearby]);

	// Highlight the selected tree (re-applied whenever the tree layers are rebuilt).
	// biome-ignore lint/correctness/useExhaustiveDependencies: nearby triggers a rebuild of treeLayers
	useEffect(() => {
		for (const [idx, c] of treeLayers.current) {
			const sel = idx === selectedTree;
			c.setStyle({ color: sel ? "#0b0b0b" : "#fff", weight: sel ? 4 : 1.5 });
			if (sel) {
				c.bringToFront();
				c.openTooltip();
				if (map.current && !map.current.getBounds().contains(c.getLatLng())) map.current.panTo(c.getLatLng());
			}
		}
	}, [selectedTree, nearby]);

	const legend =
		mode === "blocks"
			? { title: metric.label, items: legendItems(metric), extra: true }
			: mode === "satellite"
				? { title: "Satellite tree cover", items: coverLegend(), extra: false }
				: mode === "area"
					? { title: metric.label, items: legendItems(metric), extra: false }
					: mode === "zones"
						? { title: "Blocks ≥30% one genus", items: zoneLegend(), extra: false }
						: null;

	return (
		<div
			className={`relative h-full w-full overflow-hidden ${mode === "near" || (mode === "area" && drawing) ? "near-mode" : ""}`}
		>
			{/* Leaflet adds its own classes to this element, so its className must never change. */}
			<section ref={el} className="h-full w-full" aria-label="Map of blocks" />
			{legend && (
				<details
					open={legendOpen}
					onToggle={(e) => setLegendOpen(e.currentTarget.open)}
					className="group absolute top-2 right-2 z-[1000] rounded-md bg-white/95 text-xs text-neutral-800 shadow"
				>
					<summary className="flex min-h-9 cursor-pointer list-none items-center gap-1 px-2 font-semibold [&::-webkit-details-marker]:hidden">
						{legend.title}
						<ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
					</summary>
					<ul className="space-y-0.5 px-2 pb-1.5">
						{legend.items.map((it) => (
							<li key={it.label} className="flex items-center gap-1.5">
								<span
									className="inline-block w-5 rounded-full"
									style={{ background: it.color, height: mode === "blocks" ? it.weight / 2 + 1 : 8 }}
								/>
								{it.label}
							</li>
						))}
						{flagged && mode !== "blocks" && (
							<li className="flex items-center gap-1.5">
								<span className="inline-block h-1.5 w-5 rounded-full" style={{ background: FLAG_COLOR }} />
								Flagged block
							</li>
						)}
						{legend.extra && (
							<>
								<li className="flex items-center gap-1.5">
									<span
										className="inline-block h-0 w-5 border-t-[3px] border-dotted"
										style={{ borderColor: LOW_COUNT_COLOR }}
									/>
									Under 10 trees
								</li>
								<li className="flex items-center gap-1.5">
									<span className="inline-block h-0.5 w-5 rounded-full" style={{ background: FADED }} />
									Filtered out
								</li>
							</>
						)}
					</ul>
				</details>
			)}
		</div>
	);
}
