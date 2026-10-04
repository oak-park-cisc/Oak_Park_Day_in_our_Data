import { useEffect, useMemo, useRef } from 'react';
import { STATUS_META, STATUS_ORDER } from '../lib/status';
import type { AppData, Block, BlockStatus } from '../lib/types';
import StatusIcon from './StatusIcon';

interface Props {
  open: boolean;
  onClose: () => void;
  data: AppData;
  onShowBlock: (id: string) => void;
}

const RULES: Record<BlockStatus, string> = {
  risk: 'One genus is 30% or more of the trees, or one species is 50% or more.',
  cusp: 'One genus is 20–30% of the trees, one species is 10–50%, or one family is 30% or more.',
  meets: 'No genus over 20%, no species over 10% and no family over 30%.',
  few: 'Fewer than 10 trees: too small a sample to grade.',
};

const pct = (share: number) => `${Math.round(share * 100)}%`;

// a horizontal scale with colored zones and ticks, e.g. 0–50% top-genus share
function Scale({
  label,
  max,
  zones,
  ticks,
}: {
  label: string;
  max: number;
  zones: { to: number; status: BlockStatus }[];
  ticks: number[];
}) {
  let from = 0;
  return (
    <figure className="m-0">
      <figcaption className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-300">
        {label}
      </figcaption>
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
        {zones.map((z) => {
          const width = ((z.to - from) / max) * 100;
          from = z.to;
          return (
            <div
              key={z.status}
              style={{ width: `${width}%`, backgroundColor: STATUS_META[z.status].color }}
            />
          );
        })}
      </div>
      <div className="relative mt-1 h-4 text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
        {ticks.map((t) => (
          <span
            key={t}
            className="absolute -translate-x-1/2 first:translate-x-0 last:-translate-x-full"
            style={{ left: `${(t / max) * 100}%` }}
          >
            {t}%
          </span>
        ))}
      </div>
      <p className="sr-only">
        {zones
          .map((z, i) => {
            const lo = i === 0 ? 0 : (zones[i - 1]?.to ?? 0);
            return i === zones.length - 1
              ? `${STATUS_META[z.status].label}: ${lo}% and above`
              : `${STATUS_META[z.status].label}: ${lo}% to under ${z.to}%`;
          })
          .join('; ')}
      </p>
    </figure>
  );
}

// a real block's genus mix: top genus in its status color, the rest in grays
function GenusMix({ block, genusNames }: { block: Block; genusNames: Record<string, string> }) {
  const shades = ['#94a3b8', '#cbd5e1', '#e2e8f0'];
  const top = block.topGenera.slice(0, 3);
  const rest = Math.max(0, 1 - top.reduce((a, g) => a + g.share, 0));
  const name = (g: string) => genusNames[g] ?? g;
  return (
    <div>
      <div
        className="flex h-2.5 gap-0.5 overflow-hidden rounded-full"
        role="img"
        aria-label={`Genus mix: ${top.map((g) => `${name(g.name)} ${pct(g.share)}`).join(', ')}, other ${pct(rest)}`}
      >
        {top.map((g, i) => (
          <div
            key={g.name}
            style={{
              width: `${g.share * 100}%`,
              backgroundColor: i === 0 ? STATUS_META[block.status].color : shades[i - 1],
            }}
          />
        ))}
        <div className="bg-slate-100 dark:bg-slate-700" style={{ width: `${rest * 100}%` }} />
      </div>
      <p className="m-0 mt-1 text-[11px] text-slate-600 dark:text-slate-300">
        {top.map((g, i) => (
          <span key={g.name}>
            {i > 0 && ' · '}
            <span className={i === 0 ? 'font-semibold' : ''}>
              {name(g.name)} {pct(g.share)}
            </span>
          </span>
        ))}
      </p>
    </div>
  );
}

// small trigger used beside status lists on the map, sidebar and dashboard
export function GuideButton({
  onClick,
  label = 'How it works',
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/60"
    >
      <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4 fill-current">
        <path d="M10 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16Zm0 1.6a6.4 6.4 0 1 0 0 12.8 6.4 6.4 0 0 0 0-12.8ZM9.2 9h1.6v5H9.2V9Zm0-3h1.6v1.6H9.2V6Z" />
      </svg>
      {label}
    </button>
  );
}

export default function ClassificationGuide({ open, onClose, data, onShowBlock }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  // the largest block in each status serves as its real-world example
  const examples = useMemo(() => {
    const out = {} as Partial<Record<BlockStatus, Block>>;
    for (const b of data.blocks) {
      const cur = out[b.status];
      if (!cur || b.trees > cur.trees) out[b.status] = b;
    }
    return out;
  }, [data.blocks]);

  const counts = data.village.statusCounts;

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
      aria-labelledby="guide-title"
      className="m-auto max-h-[min(88dvh,56rem)] w-[min(42rem,calc(100vw-1rem))] overflow-hidden rounded-3xl border-0 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/60 backdrop:backdrop-blur-sm dark:bg-slate-900 dark:text-slate-100"
    >
      <div className="flex max-h-[min(88dvh,56rem)] flex-col">
        <header className="flex shrink-0 items-start gap-3 border-b border-slate-200 bg-gradient-to-br from-emerald-50 to-white px-5 py-4 dark:border-slate-800 dark:from-emerald-950/50 dark:to-slate-900">
          <span
            aria-hidden="true"
            className="hidden size-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm sm:flex"
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5 fill-current">
              <path d="M10 1 4 9h3l-3 5h5v5h2v-5h5l-3-5h3L10 1Z" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="guide-title" className="m-0 text-lg leading-tight font-semibold">
              How blocks are classified
            </h2>
            <p className="m-0 mt-0.5 text-sm text-slate-600 dark:text-slate-300">
              Each street block is graded on the <strong>10-20-30 rule</strong>: no more than 10% of
              one species, 20% of one genus or 30% of one family.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            title="Close"
            className="-mt-1 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-slate-200/70 dark:hover:bg-slate-800"
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5">
              <path
                d="M6 6l8 8M14 6l-8 8"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          <div className="grid gap-4 rounded-2xl bg-slate-50 p-4 sm:grid-cols-3 dark:bg-slate-800/60">
            <Scale
              label="Largest genus on the block"
              max={50}
              zones={[
                { to: 20, status: 'meets' },
                { to: 30, status: 'cusp' },
                { to: 50, status: 'risk' },
              ]}
              ticks={[0, 10, 20, 30, 40, 50]}
            />
            <Scale
              label="Largest species on the block"
              max={60}
              zones={[
                { to: 10, status: 'meets' },
                { to: 50, status: 'cusp' },
                { to: 60, status: 'risk' },
              ]}
              ticks={[0, 20, 40, 60]}
            />
            <Scale
              label="Largest family on the block"
              max={50}
              zones={[
                { to: 30, status: 'meets' },
                { to: 50, status: 'cusp' },
              ]}
              ticks={[0, 10, 20, 30, 40, 50]}
            />
            <p className="m-0 text-xs text-slate-500 sm:col-span-3 dark:text-slate-400">
              A block takes the most serious of its results. A family over 30% puts a block on the
              cusp. Blocks need at least 10 trees to be graded.
            </p>
          </div>

          <ul className="m-0 mt-4 grid list-none gap-3 p-0 sm:grid-cols-2">
            {STATUS_ORDER.map((s) => {
              const ex = examples[s];
              return (
                <li
                  key={s}
                  className="relative overflow-hidden rounded-2xl border border-slate-200 p-3 pl-4 dark:border-slate-700"
                >
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-0 left-0 w-1.5"
                    style={{ backgroundColor: STATUS_META[s].color }}
                  />
                  <div className="flex items-center gap-2">
                    <StatusIcon status={s} />
                    <h3 className="m-0 flex-1 text-sm font-semibold">{STATUS_META[s].label}</h3>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium tabular-nums dark:bg-slate-800">
                      {counts[s]} blocks
                    </span>
                  </div>
                  <p className="m-0 mt-1 text-sm text-slate-700 dark:text-slate-300">{RULES[s]}</p>
                  {ex && (
                    <div className="mt-2.5 rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/60">
                      <div className="mb-1.5 flex items-start justify-between gap-2">
                        <p className="m-0 min-w-0 text-xs leading-snug">
                          <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                            Example · {ex.trees} trees
                          </span>
                          <span className="block font-medium">{ex.name}</span>
                        </p>
                        <button
                          type="button"
                          onClick={() => onShowBlock(ex.id)}
                          className="flex min-h-9 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-medium text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950"
                        >
                          <svg
                            aria-hidden="true"
                            viewBox="0 0 20 20"
                            className="size-3.5 fill-current"
                          >
                            <path d="M10 2a6 6 0 0 1 6 6c0 4.2-6 10-6 10S4 12.2 4 8a6 6 0 0 1 6-6Zm0 3.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z" />
                          </svg>
                          See on map
                        </button>
                      </div>
                      <GenusMix block={ex} genusNames={data.names.genera} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <section className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
            <h3 className="m-0 flex items-center gap-1.5 text-sm font-semibold text-amber-900 dark:text-amber-200">
              <StatusIcon status="cusp" />
              Why one genus is a risk
            </h3>
            <p className="m-0 mt-1 text-sm text-amber-900/90 dark:text-amber-100/90">
              Pests and diseases tend to strike one genus or species at a time: Dutch elm disease
              killed most American elms in the mid-1900s, and the emerald ash borer has since killed
              ash trees across the Midwest. When one genus dominates a street, a single outbreak can
              take most of its shade at once.
            </p>
          </section>

          <ul className="m-0 mt-4 mb-1 list-disc space-y-1 pl-5 text-xs text-slate-500 dark:text-slate-400">
            <li>
              A block is one hundred-block of a street (e.g. 1200 N Austin Blvd); each tree counts
              toward its nearest street.
            </li>
            <li>
              Families follow the current botanical classification (APG IV), assigned from each
              tree&apos;s genus: maples share the soapberry family with horsechestnuts.
            </li>
            <li>
              Public trees only, and no health or age data: the grade describes the mix of trees,
              not their condition.
            </li>
          </ul>
        </div>
      </div>
    </dialog>
  );
}
