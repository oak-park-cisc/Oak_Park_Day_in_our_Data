import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import {
	genusColor,
	isTopGenus,
	OTHER_COLOR,
	SIZE_COLORS,
	STATUS_COLORS,
} from "../lib/colors";
import type { BlocksGeo, Tree, ZonesGeo } from "../lib/data";
import type { Stats } from "../lib/stats";
import { triangleMarker } from "../lib/triangleMarker";

export type View = "blocks" | "zones" | "trees";
export type ColorBy = "genus" | "size";
export type Selection = { type: "block" | "zone" | "tree"; id: string } | null;
export type Focus = { bounds: L.LatLngBoundsExpression; key: number } | null;

type Props = {
	view: View;
	colorBy: ColorBy;
	trees: Tree[];
	blocks: BlocksGeo;
	zones: ZonesGeo;
	blockStats: Map<string, Stats>;
	zoneStats: Map<string, Stats>;
	selection: Selection;
	highlight: Tree[];
	focus: Focus;
	onSelect: (s: Selection) => void;
};

const OAK_PARK: L.LatLngBoundsExpression = [
	[41.8646, -87.8061],
	[41.9097, -87.7737],
];

export function MapView(props: Props) {
	const {
		view,
		colorBy,
		trees,
		blocks,
		zones,
		blockStats,
		zoneStats,
		selection,
		highlight,
		focus,
	} = props;
	const el = useRef<HTMLDivElement>(null);
	const map = useRef<L.Map | null>(null);
	const onSelect = useRef(props.onSelect);
	onSelect.current = props.onSelect;

	useEffect(() => {
		if (!el.current || map.current) return;
		const m = L.map(el.current, {
			preferCanvas: true,
			zoomSnap: 0.5,
		}).fitBounds(OAK_PARK);
		L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
			maxZoom: 19,
			attribution:
				'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
		}).addTo(m);
		map.current = m;
		const ro = new ResizeObserver(() => m.invalidateSize());
		ro.observe(el.current);
		return () => {
			ro.disconnect();
			m.remove();
			map.current = null;
		};
	}, []);

	// Zones: filled in zone view, outlines elsewhere for orientation.
	useEffect(() => {
		const m = map.current;
		if (!m) return;
		const layer = L.geoJSON(zones, {
			style: (f) => {
				const s = zoneStats.get(f?.properties.zone ?? "");
				const filled = view === "zones";
				return {
					color: filled ? "#ffffff" : "#52514e",
					weight: filled ? 2 : 1,
					dashArray: filled ? undefined : "4 4",
					fillColor: s ? STATUS_COLORS[s.status] : OTHER_COLOR,
					fillOpacity: filled ? 0.35 : 0,
					interactive: filled,
				};
			},
			onEachFeature: (f, l) => {
				l.bindTooltip(f.properties.zone, {
					permanent: true,
					direction: "center",
					className: "zone-label",
				});
				l.on("click", () =>
					onSelect.current({ type: "zone", id: f.properties.zone }),
				);
			},
		}).addTo(m);
		return () => {
			layer.remove();
		};
	}, [zones, zoneStats, view]);

	// Blocks: street lines colored by top-genus share.
	useEffect(() => {
		const m = map.current;
		if (!m || view !== "blocks") return;
		const layer = L.geoJSON(blocks, {
			style: (f) => {
				const s = blockStats.get(f?.properties.block ?? "");
				return {
					color: s ? STATUS_COLORS[s.status] : OTHER_COLOR,
					weight: 6,
					opacity: 0.9,
					lineCap: "round",
				};
			},
			onEachFeature: (f, l) => {
				const s = blockStats.get(f.properties.block);
				l.bindTooltip(
					s?.topGenus
						? `${f.properties.block}: ${s.count} trees`
						: f.properties.block,
					{ sticky: true },
				);
				l.on("click", () =>
					onSelect.current({ type: "block", id: f.properties.block }),
				);
			},
		}).addTo(m);
		return () => {
			layer.remove();
		};
	}, [blocks, blockStats, view]);

	// Trees as canvas dots.
	useEffect(() => {
		const m = map.current;
		if (!m || view !== "trees") return;
		const renderer = L.canvas({ tolerance: 6 });
		const group = L.layerGroup();
		for (const t of trees) {
			const fill =
				colorBy === "genus"
					? genusColor(t.genus)
					: t.size
						? SIZE_COLORS[t.size]
						: OTHER_COLOR;
			// in genus mode, "other" genera are pink triangles 5% larger than the dots
			const other = colorBy === "genus" && !isTopGenus(t.genus);
			(other ? triangleMarker : L.circleMarker)([t.lat, t.lon], {
				renderer,
				// in trunk-size mode the dot grows with the trunk
				radius:
					colorBy === "size" && t.dbh
						? Math.min(10, 3 + Math.min(t.dbh, 60) / 7)
						: other
							? 4.2
							: 4,
				color: "#ffffff",
				weight: 1,
				fillColor: fill,
				fillOpacity: 1,
			})
				.on("click", () => onSelect.current({ type: "tree", id: t.id }))
				.addTo(group);
		}
		group.addTo(m);
		return () => {
			group.remove();
		};
	}, [trees, colorBy, view]);

	// Selected block/zone outline, selected tree ring, and highlighted search results.
	useEffect(() => {
		const m = map.current;
		if (!m) return;
		const group = L.layerGroup();
		for (const t of highlight) {
			L.circleMarker([t.lat, t.lon], {
				radius: 7,
				color: "#0b0b0b",
				weight: 2,
				fill: false,
				interactive: false,
			}).addTo(group);
		}
		if (selection?.type === "tree") {
			const t = trees.find((x) => x.id === selection.id);
			if (t) {
				L.circleMarker([t.lat, t.lon], {
					radius: 11,
					color: "#0b0b0b",
					weight: 3,
					fill: false,
					interactive: false,
				}).addTo(group);
			}
		} else if (selection?.type === "block") {
			const f = blocks.features.find(
				(x) => x.properties.block === selection.id,
			);
			if (f)
				L.geoJSON(f, {
					style: { color: "#0b0b0b", weight: 10, opacity: 0.5 },
					interactive: false,
				}).addTo(group);
		} else if (selection?.type === "zone") {
			const f = zones.features.find((x) => x.properties.zone === selection.id);
			if (f)
				L.geoJSON(f, {
					style: { color: "#0b0b0b", weight: 3, fill: false },
					interactive: false,
				}).addTo(group);
		}
		group.addTo(m);
		return () => {
			group.remove();
		};
	}, [selection, highlight, trees, blocks, zones]);

	useEffect(() => {
		if (focus && map.current) {
			map.current.flyToBounds(focus.bounds, {
				maxZoom: 18,
				padding: [24, 24],
				duration: 0.6,
			});
		}
	}, [focus]);

	return (
		<div
			ref={el}
			className="h-full w-full"
			role="application"
			aria-label="Map of Oak Park trees"
		/>
	);
}
