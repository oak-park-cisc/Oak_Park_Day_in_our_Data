import L from 'leaflet';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CANOPY_COLORS, CANOPY_LABELS, canopyStep } from '../lib/canopy';
import { colorFor, genusColors, OTHER_LABEL } from '../lib/genusColors';
import { PARK_COLOR, PARK_EDGE, STATUS_META, STATUS_ORDER } from '../lib/status';
import type { Block, BlockGroup, ColorBy, Park, TreePoint } from '../lib/types';
import { FIFTH_COLORS, FIFTH_LABELS, fifthColor, fifthLabel } from '../lib/vulnerability';
import { GuideButton } from './ClassificationGuide';

interface Props {
  points: TreePoint[];
  blocks: Block[];
  parks: Park[];
  boundary: [number, number][][];
  canopyBreaks: number[];
  genusNames: Record<string, string>;
  vulnerability: BlockGroup[];
  colorBy: ColorBy;
  onColorBy: (c: ColorBy) => void;
  selected: string | null;
  onSelect: (id: string) => void;
  onClear: () => void;
  keyOpen: boolean;
  onOpenGuide: () => void;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// street-block line width grows with zoom so blocks stay legible and tappable
const lineWeight = (zoom: number) =>
  zoom <= 13 ? 2 : zoom === 14 ? 3 : zoom === 15 ? 4.5 : zoom === 16 ? 6 : 8;

export default function MapView({
  points,
  blocks,
  parks,
  boundary,
  canopyBreaks,
  genusNames,
  vulnerability,
  colorBy,
  onColorBy,
  selected,
  onSelect,
  onClear,
  keyOpen,
  onOpenGuide,
}: Props) {
  const [showTrees, setShowTrees] = useState(true);
  const [zoom, setZoom] = useState(14);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const pointsLayerRef = useRef<L.LayerGroup | null>(null);
  const selectLayerRef = useRef<L.LayerGroup | null>(null);
  const blockLinesRef = useRef<{ line: L.Polyline; block: Block }[]>([]);
  const parkPolysRef = useRef<L.Polygon[]>([]);
  const groupPolysRef = useRef<{ poly: L.Polygon; group: BlockGroup }[]>([]);
  const groupIndex = useMemo(() => new Map(vulnerability.map((g) => [g.id, g])), [vulnerability]);
  const blockIndex = useMemo(() => new Map(blocks.map((b) => [b.id, b])), [blocks]);
  const colors = useMemo(() => genusColors(points), [points]);
  const handlers = useRef({ onSelect, onClear });
  handlers.current = { onSelect, onClear };

  // tree dots only once a few blocks fill the view
  const showDots = zoom >= 16;

  // init once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      // one shared canvas so draw order = add order (selection and tree dots
      // above street lines); generous tolerance makes thin lines easy to tap
      renderer: L.canvas({ tolerance: 8 }),
      center: [41.8875, -87.7898],
      zoom: 14,
      zoomControl: false,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    L.control.zoom({ position: 'topright' }).addTo(map);
    map.on('zoomend', () => setZoom(map.getZoom()));
    map.on('click', () => handlers.current.onClear());
    // outside-the-village shading sits below every data layer
    map.createPane('mask').style.zIndex = '350';
    mapRef.current = map;
    // keep tiles filling the panel as the sidebar / bottom sheet resizes it
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(containerRef.current);
    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // shade everything outside Oak Park: a world-sized ring with the village
  // cut out as a hole, washed toward the page color so the village stands out
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !boundary.length) return;
    const dark = window.matchMedia('(prefers-color-scheme: dark)');
    const world: [number, number][] = [
      [85, -180],
      [85, 180],
      [-85, 180],
      [-85, -180],
    ];
    const renderer = L.canvas({ pane: 'mask' });
    const mask = L.polygon([world, ...boundary], {
      renderer,
      stroke: false,
      fillOpacity: 0.55,
      interactive: false,
    }).addTo(map);
    const edge = L.polygon(boundary, {
      renderer,
      fill: false,
      weight: 2.5,
      interactive: false,
    }).addTo(map);
    const paint = () => {
      mask.setStyle({ fillColor: dark.matches ? '#020617' : '#ffffff' });
      edge.setStyle({ color: dark.matches ? '#e2e8f0' : '#334155', opacity: 0.8 });
    };
    paint();
    dark.addEventListener('change', paint);
    return () => {
      dark.removeEventListener('change', paint);
      mask.remove();
      edge.remove();
    };
  }, [boundary]);

  // vulnerability block groups sit under the blocks, which stay clickable
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const group = L.layerGroup().addTo(map);
    groupPolysRef.current = vulnerability.map((g) => {
      const poly = L.polygon(g.rings, {
        color: '#ffffff',
        weight: 2,
        fillColor: fifthColor(g.fifth),
        interactive: false,
      }).addTo(group);
      return { poly, group: g };
    });
    return () => {
      group.remove();
    };
  }, [vulnerability]);

  // park outlines, then street-block lines on top
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const group = L.layerGroup().addTo(map);
    parkPolysRef.current = parks.map((p) =>
      L.polygon(p.rings, {
        color: PARK_EDGE,
        weight: 1.5,
        dashArray: '4 3',
        fillColor: PARK_COLOR,
        interactive: false,
      }).addTo(group),
    );
    blockLinesRef.current = blocks.map((b) => {
      const line = L.polyline(b.lines, { lineCap: 'round' });
      line.bindTooltip('', { sticky: true, direction: 'top' });
      line.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        handlers.current.onSelect(b.id);
      });
      line.addTo(group);
      return { line, block: b };
    });
    return () => {
      group.remove();
    };
  }, [blocks, parks]);

  // restyle for the active coloring and zoom; the data deps rerun this after
  // the layer effects above rebuild their shapes
  // biome-ignore lint/correctness/useExhaustiveDependencies: rerun when layers are rebuilt
  useEffect(() => {
    const vuln = colorBy === 'vulnerability';
    const fade = showDots ? 0.55 : 1;
    const w = lineWeight(zoom);
    for (const { poly } of groupPolysRef.current) {
      poly.setStyle({ opacity: vuln ? 1 : 0, fillOpacity: vuln ? 0.6 * fade : 0 });
    }
    for (const { line, block } of blockLinesRef.current) {
      const g = block.bg ? groupIndex.get(block.bg) : undefined;
      const step = canopyStep(block.canopyPer100Ft, canopyBreaks);
      if (vuln) {
        line.setStyle({ color: '#1e293b', opacity: 0.55, weight: Math.max(1.5, w * 0.6) });
        line.setTooltipContent(
          g
            ? `${esc(block.name)} — ${fifthLabel(g.fifth)} (score ${g.composite})`
            : esc(block.name),
        );
      } else if (colorBy === 'canopy') {
        line.setStyle({
          color: step === null ? '#9ca3af' : (CANOPY_COLORS[step] ?? '#9ca3af'),
          opacity: 0.95,
          weight: w,
        });
        line.setTooltipContent(
          block.canopyPer100Ft === null
            ? esc(block.name)
            : `${esc(block.name)} — ${block.canopyPer100Ft.toLocaleString()} sq ft of canopy per 100 ft`,
        );
      } else {
        line.setStyle({
          color: STATUS_META[block.status].color,
          opacity: block.status === 'few' ? 0.7 : 0.95,
          weight: w,
        });
        line.setTooltipContent(`${esc(block.name)} — ${STATUS_META[block.status].label}`);
      }
    }
    for (const poly of parkPolysRef.current) {
      poly.setStyle({ fillOpacity: vuln ? 0 : 0.35 });
    }
  }, [colorBy, showDots, zoom, groupIndex, blocks, parks, vulnerability, canopyBreaks]);

  // tree points layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (pointsLayerRef.current) {
      pointsLayerRef.current.remove();
      pointsLayerRef.current = null;
    }
    if (!showTrees || !showDots) return;
    const group = L.layerGroup().addTo(map);
    for (const p of points) {
      const c = colorFor(colors.colors, p.g);
      const m = L.circleMarker([p.la, p.lo], {
        radius: 3,
        color: '#ffffff',
        weight: 0.5,
        fillColor: c,
        fillOpacity: 0.95,
      });
      m.bindPopup(
        `<strong>${esc(p.s)}</strong><br>${esc(p.g)}${p.d !== null ? `<br>Trunk diameter: ${p.d}&quot;` : ''}`,
      );
      m.on('click', (e) => L.DomEvent.stopPropagation(e));
      m.addTo(group);
    }
    pointsLayerRef.current = group;
  }, [points, colors, showTrees, showDots]);

  // selection: white-cased blue line, resized with zoom
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (selectLayerRef.current) {
      selectLayerRef.current.remove();
      selectLayerRef.current = null;
    }
    const b = selected ? blockIndex.get(selected) : null;
    if (!b) return;
    const group = L.layerGroup().addTo(map);
    const w = lineWeight(zoom);
    L.polyline(b.lines, { color: '#ffffff', weight: w + 6, interactive: false }).addTo(group);
    L.polyline(b.lines, { color: '#1d4ed8', weight: w + 2, interactive: false }).addTo(group);
    selectLayerRef.current = group;
  }, [selected, blockIndex, zoom]);

  // fly to a newly selected block
  useEffect(() => {
    const map = mapRef.current;
    const el = containerRef.current;
    const b = selected ? blockIndex.get(selected) : null;
    // a hidden container has zero size and flyToBounds would compute NaN
    if (!map || !b || !el || el.offsetWidth === 0 || el.offsetHeight === 0) return;
    // the map may have just been unhidden (dashboard → map): refresh its size first
    map.invalidateSize();
    map.flyToBounds(b.bbox, { padding: [40, 40], duration: 0.7, maxZoom: 17 });
  }, [selected, blockIndex]);

  return (
    <div className="relative h-full w-full">
      <section ref={containerRef} aria-label="Map of Oak Park blocks" className="h-full w-full" />
      <details
        open={keyOpen}
        className="absolute top-2 left-2 z-[500] max-w-[70%] rounded-xl border border-slate-200/70 bg-white/90 px-2.5 py-1.5 text-xs shadow-sm backdrop-blur-sm dark:border-slate-700/70 dark:bg-slate-900/90"
      >
        <summary className="flex min-h-8 cursor-pointer items-center font-medium select-none">
          Key
        </summary>
        <fieldset className="m-0 mt-1 min-w-0 border-0 p-0">
          <legend className="sr-only">Color blocks by</legend>
          <div className="grid grid-cols-3 gap-0.5 rounded-lg bg-slate-200/80 p-0.5 dark:bg-slate-800">
            {(
              [
                ['diversity', 'Diversity'],
                ['canopy', 'Canopy'],
                ['vulnerability', 'Vulnerability'],
              ] as const
            ).map(([key, label]) => (
              <label
                key={key}
                className={`flex min-h-10 cursor-pointer items-center justify-center rounded-md px-1.5 font-medium has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-500 ${
                  colorBy === key
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-600 dark:text-white'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="color-by"
                  value={key}
                  checked={colorBy === key}
                  onChange={() => onColorBy(key)}
                  className="sr-only"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        {colorBy === 'canopy' ? (
          <>
            <ul className="m-0 mt-1.5 flex list-none flex-col gap-0.5 p-0">
              {[...CANOPY_COLORS].reverse().map((c, i) => {
                const step = CANOPY_COLORS.length - 1 - i;
                const lo = step === 0 ? null : canopyBreaks[step - 1];
                const hi = canopyBreaks[step];
                const range =
                  lo === undefined || lo === null
                    ? `under ${(hi ?? 0).toLocaleString()}`
                    : hi === undefined
                      ? `${lo.toLocaleString()}+`
                      : `${lo.toLocaleString()}–${hi.toLocaleString()}`;
                return (
                  <li key={c} className="flex items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className="inline-block h-1.5 w-5 shrink-0 rounded-full"
                      style={{ backgroundColor: c }}
                    />
                    <span className="flex-1">{CANOPY_LABELS[step]}</span>
                    <span className="text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                      {range}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="m-0 mt-1 max-w-52 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
              Sq ft of estimated crown area per 100 ft of street; each band is a fifth of blocks
            </p>
          </>
        ) : colorBy === 'vulnerability' ? (
          <>
            <ul className="m-0 mt-1.5 flex list-none flex-col gap-0.5 p-0">
              {[...FIFTH_COLORS].reverse().map((c, i) => (
                <li key={c} className="flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="inline-block h-3 w-4 rounded-sm border border-slate-300 dark:border-slate-600"
                    style={{ backgroundColor: c }}
                  />
                  {FIFTH_LABELS[FIFTH_LABELS.length - 1 - i]}
                </li>
              ))}
            </ul>
            <p className="m-0 mt-1 max-w-48 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
              Village Social Vulnerability Index, ranked across Oak Park&apos;s 53 block groups
            </p>
          </>
        ) : (
          <ul className="m-0 mt-1.5 flex list-none flex-col gap-0.5 p-0">
            {STATUS_ORDER.map((s) => (
              <li key={s} className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="inline-block h-1.5 w-5 rounded-full"
                  style={{ backgroundColor: STATUS_META[s].color }}
                />
                {STATUS_META[s].label}
              </li>
            ))}
          </ul>
        )}
        {colorBy === 'diversity' && (
          <div className="-ml-2 mt-0.5">
            <GuideButton onClick={onOpenGuide} label="How blocks are graded" />
          </div>
        )}
        <p className="m-0 mt-1 flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-3 w-4 rounded-sm border border-dashed"
            style={{ backgroundColor: `${PARK_COLOR}66`, borderColor: PARK_EDGE }}
          />
          Park
        </p>
        <label className="mt-1 flex min-h-8 items-center gap-1.5 font-medium">
          <input
            type="checkbox"
            className="size-4"
            checked={showTrees}
            onChange={(e) => setShowTrees(e.target.checked)}
          />
          Trees{!showDots && showTrees ? ' (zoom in)' : ''}
        </label>
        {showTrees && showDots && (
          <ul className="m-0 grid list-none grid-cols-2 gap-x-3 gap-y-1 p-0 pb-1">
            {[...colors.top, OTHER_LABEL].map((name) => {
              const common = genusNames[name];
              return (
                <li key={name} className="flex items-start gap-1.5">
                  <span
                    aria-hidden="true"
                    className="mt-1 inline-block size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: colorFor(colors.colors, name) }}
                  />
                  <span className="min-w-0 leading-tight">
                    <span className="block">{common ?? name}</span>
                    {common && common !== name && (
                      <span className="block text-[10px] text-slate-500 italic dark:text-slate-400">
                        {name}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </details>
    </div>
  );
}
