import { useMemo } from 'react';
import { colorFor, genusColors, OTHER_LABEL } from '../lib/genusColors';
import type { TreePoint } from '../lib/types';

interface Row {
  label: string;
  total: number;
  genera: Map<string, number>;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

// 100% stacked bars of genus mix per row (e.g. trunk-size class). Segment
// colors match the map's tree dots; the first `show` genera of the village
// order get their own segment, the rest fold into "Other genera".
export default function GenusMixBars({
  rows,
  points,
  genusNames,
  show = 6,
  highlight,
  selectedRow,
  onPickRow,
  caption,
}: {
  rows: Row[];
  points: TreePoint[];
  genusNames: Record<string, string>;
  show?: number;
  highlight?: string | null;
  selectedRow?: number | null;
  onPickRow?: (i: number) => void;
  caption: string;
}) {
  const { colors, top } = useMemo(() => genusColors(points), [points]);
  const shown = top.slice(0, show);
  const name = (g: string) => genusNames[g] ?? g;
  const legend = [...shown, OTHER_LABEL];

  return (
    <figure className="m-0">
      <ul className="m-0 mb-2.5 flex list-none flex-wrap gap-x-3 gap-y-1 p-0 text-[11px] text-slate-600 dark:text-slate-300">
        {legend.map((g) => (
          <li
            key={g}
            className={`flex items-center gap-1 ${highlight && g !== highlight ? 'opacity-50' : ''}`}
          >
            <span
              aria-hidden="true"
              className="inline-block size-2.5 rounded-sm"
              style={{ backgroundColor: colorFor(colors, g) }}
            />
            {g === OTHER_LABEL ? g : name(g)}
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-1">
        {rows.map((r, i) => {
          const segs = shown.map((g) => ({
            g,
            share: r.total ? (r.genera.get(g) ?? 0) / r.total : 0,
          }));
          const other = Math.max(0, 1 - segs.reduce((a, x) => a + x.share, 0));
          const all = [...segs, { g: OTHER_LABEL, share: other }];
          const lead = [...r.genera.entries()].sort((a, b) => b[1] - a[1])[0];
          const leadShare = lead && r.total ? lead[1] / r.total : 0;
          const hiShare = highlight && r.total ? (r.genera.get(highlight) ?? 0) / r.total : null;
          const label = `${r.label}: ${all
            .filter((x) => x.share > 0.005)
            .map((x) => `${x.g === OTHER_LABEL ? x.g : name(x.g)} ${pct(x.share)}`)
            .join(', ')}`;
          const on = selectedRow === i;
          const body = (
            <>
              <span className="w-12 shrink-0 text-left text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                {r.label}
              </span>
              <span
                className="flex h-5 min-w-0 flex-1 gap-px overflow-hidden rounded"
                aria-hidden="true"
              >
                {all.map((x) =>
                  x.share > 0 ? (
                    <span
                      key={x.g}
                      style={{
                        width: `${x.share * 100}%`,
                        backgroundColor: colorFor(colors, x.g),
                        opacity: highlight && x.g !== highlight ? 0.25 : 1,
                      }}
                    />
                  ) : null,
                )}
              </span>
              <span className="w-24 shrink-0 text-right text-[11px] leading-tight text-slate-600 dark:text-slate-300">
                {hiShare !== null ? (
                  <span className="font-semibold tabular-nums">{pct(hiShare)}</span>
                ) : lead ? (
                  <>
                    <span className="font-semibold tabular-nums">{pct(leadShare)}</span>{' '}
                    {name(lead[0]).toLowerCase()}
                  </>
                ) : null}
              </span>
            </>
          );
          return onPickRow ? (
            <button
              key={r.label}
              type="button"
              aria-pressed={on}
              aria-label={label}
              title={on ? 'Clear size filter' : `Filter to trunk ${r.label}`}
              onClick={() => onPickRow(i)}
              className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-1 hover:bg-slate-100 dark:hover:bg-slate-800 ${
                on ? 'bg-blue-50 dark:bg-blue-950/60' : ''
              }`}
            >
              {body}
            </button>
          ) : (
            <div
              key={r.label}
              role="img"
              aria-label={label}
              className="flex min-h-9 items-center gap-2 px-1"
            >
              {body}
            </div>
          );
        })}
      </div>
      <figcaption className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
        {caption}
      </figcaption>
    </figure>
  );
}
