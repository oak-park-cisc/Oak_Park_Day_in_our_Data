import { useId, useMemo, useState } from 'react';
import { canopyPercentile } from '../lib/canopy';
import { STATUS_META, STATUS_ORDER } from '../lib/status';
import type { Block, BlockGroup, BlockStatus, ColorBy, GenusShare, Village } from '../lib/types';
import { fifthColor, fifthLabel, HEAT_COUNT, SVI_LABELS } from '../lib/vulnerability';
import { GuideButton } from './ClassificationGuide';
import StatusIcon from './StatusIcon';
import VulnerabilityScatter from './VulnerabilityScatter';

interface Props {
  village: Village;
  blocks: Block[];
  block: Block | null;
  onSelect: (id: string) => void;
  onClear: () => void;
  groups: BlockGroup[];
  colorBy: ColorBy;
  onColorBy: (c: ColorBy) => void;
  onOpenGuide: () => void;
  // the phone bottom sheet shows the title row itself
  showHeader?: boolean;
}

const pct = (share: number) => `${Math.round(share * 100)}%`;
const GUIDE = 0.3;

function StatusPill({ status }: { status: BlockStatus }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium dark:bg-slate-800">
      <StatusIcon status={status} />
      {STATUS_META[status].label}
    </span>
  );
}

function statusLine(b: Block): string {
  if (b.status === 'few') return `Only ${b.trees} trees recorded — too few to grade.`;
  if (b.status === 'risk')
    return b.topSpecies.share >= 0.5
      ? `${b.topSpecies.name} alone is ${pct(b.topSpecies.share)} of trees.`
      : `${b.topGenus.name} is ${pct(b.topGenus.share)} of trees — over the 30% genus limit.`;
  if (b.status === 'cusp')
    return b.topGenus.share >= 0.2
      ? `${b.topGenus.name} is ${pct(b.topGenus.share)} of trees — over the 20% genus target.`
      : `${b.topSpecies.name} is ${pct(b.topSpecies.share)} of trees — over the 10% species target.`;
  return 'No species over 10% and no genus over 20%.';
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-slate-100 px-2.5 py-2 dark:bg-slate-800/80">
      <p className="text-[11px] text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-base leading-tight font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-slate-500 tabular-nums dark:text-slate-400">{sub}</p>}
    </div>
  );
}

function GenusBars({ genera }: { genera: GenusShare[] }) {
  // scale to 50% (or the top share if higher) so the 30% line sits mid-chart
  const max = Math.max(0.5, genera[0]?.share ?? 0);
  return (
    <figure className="m-0">
      <figcaption className="mb-1.5 flex items-baseline justify-between text-sm font-medium">
        Top genera
        <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
          share of trees
        </span>
      </figcaption>
      <div className="relative">
        <div
          aria-hidden="true"
          className="absolute top-0 bottom-0 border-l border-dashed border-slate-400 dark:border-slate-500"
          style={{ left: `calc(5.5rem + (100% - 8rem) * ${GUIDE / max})` }}
        />
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {genera.map((g) => (
            <li key={g.name} className="flex items-center gap-2 text-xs">
              <span className="w-20 shrink-0 truncate" title={g.name}>
                {g.name}
              </span>
              <span className="relative h-3 flex-1">
                <span
                  className="absolute inset-y-0 left-0 rounded-r bg-slate-500 dark:bg-slate-400"
                  style={{ width: `${(g.share / max) * 100}%` }}
                />
              </span>
              <span className="w-8 shrink-0 text-right tabular-nums text-slate-600 dark:text-slate-300">
                {pct(g.share)}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
        Dashed line: 30% limit for any one genus
      </p>
    </figure>
  );
}

function compare(value: number | null, base: number | null, unit: string): string | undefined {
  if (value === null || base === null) return undefined;
  const d = Math.round((value - base) * 10) / 10;
  if (d === 0) return 'same as village';
  return `${d > 0 ? '▲' : '▼'} ${Math.abs(d)}${unit} vs village`;
}

function Dots({ value }: { value: number }) {
  return (
    <span role="img" aria-label={`${value} of 5`} className="flex shrink-0 gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`inline-block size-2 rounded-full ${
            i <= value ? 'bg-violet-700 dark:bg-violet-400' : 'bg-slate-200 dark:bg-slate-700'
          }`}
        />
      ))}
    </span>
  );
}

function Swatch({ fifth }: { fifth: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-3 w-4 shrink-0 rounded-sm border border-slate-300 dark:border-slate-600"
      style={{ backgroundColor: fifthColor(fifth) }}
    />
  );
}

function IndexRows({ group, from, to }: { group: BlockGroup; from: number; to: number }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-0 text-xs">
      {SVI_LABELS.slice(from, to).map(([key, label]) => (
        <li key={key} className="flex items-center justify-between gap-2">
          <span>{label}</span>
          <Dots value={group.indices[key]} />
        </li>
      ))}
    </ul>
  );
}

function BlockVulnerability({ group, total }: { group: BlockGroup; total: number }) {
  return (
    <section>
      <h3 className="m-0 mb-1.5 text-sm font-medium">Social vulnerability</h3>
      <p className="m-0 mb-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
        <Swatch fifth={group.fifth} />
        <span className="font-medium">{fifthLabel(group.fifth)}</span>
        <span className="text-slate-500 tabular-nums dark:text-slate-400">
          score {group.composite} · #{group.rank} of {total}
        </span>
      </p>
      <IndexRows group={group} from={0} to={HEAT_COUNT} />
      <details className="mt-1">
        <summary className="flex min-h-9 cursor-pointer items-center text-xs font-medium text-slate-600 select-none dark:text-slate-300">
          All {SVI_LABELS.length} factors
        </summary>
        <IndexRows group={group} from={HEAT_COUNT} to={SVI_LABELS.length} />
      </details>
      <p className="m-0 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
        Census block group {group.id}. Each factor is ranked 1–5 within Oak Park; the Village has
        not published the method or year.
      </p>
    </section>
  );
}

function PriorityIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4 shrink-0 fill-current">
      <path d="M10 2a6 6 0 0 1 6 6c0 4.2-6 10-6 10S4 12.2 4 8a6 6 0 0 1 6-6Zm0 3.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z" />
    </svg>
  );
}

function priorityCriteria(village: Village) {
  return `Most vulnerable two-fifths of block groups, at risk on the 10-20-30 rule, and estimated canopy under ${village.lowCanopyPer100Ft.toLocaleString()} sq ft per 100 ft of street (bottom quarter of blocks).`;
}

function VillageVulnerability({
  village,
  blocks,
  groups,
  colorBy,
  onColorBy,
  onSelect,
}: {
  village: Village;
  blocks: Block[];
  groups: BlockGroup[];
  colorBy: ColorBy;
  onColorBy: (c: ColorBy) => void;
  onSelect: (id: string) => void;
}) {
  const priority = blocks.filter((b) => b.priority);
  return (
    <>
      <VulnerabilityScatter groups={groups} village={village} />
      {colorBy !== 'vulnerability' && (
        <button
          type="button"
          onClick={() => onColorBy('vulnerability')}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-100 text-sm font-medium hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4 fill-current">
            <path d="M2 4l5-2 6 2 5-2v14l-5 2-6-2-5 2V4Zm5 0v10l6 2V6L7 4Z" />
          </svg>
          Color map by vulnerability
        </button>
      )}
      <section>
        <h3 className="m-0 mb-1 flex items-center gap-1.5 text-sm font-medium">
          <PriorityIcon />
          Look here first ({priority.length} blocks)
        </h3>
        <p className="m-0 mb-1.5 text-[11px] text-slate-500 dark:text-slate-400">
          {priorityCriteria(village)} Candidates for a field visit, not conclusions.
        </p>
        <ul className="m-0 flex list-none flex-col p-0">
          {priority.map((b) => (
            <li key={b.id} className="border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => onSelect(b.id)}
                className="flex min-h-11 w-full items-center gap-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                <span className="min-w-0 flex-1 truncate">{b.name}</span>
                <span className="shrink-0 text-xs text-slate-500 tabular-nums dark:text-slate-400">
                  {b.trees} trees
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function Search({ blocks, onSelect }: { blocks: Block[]; onSelect: (id: string) => void }) {
  const [q, setQ] = useState('');
  const listId = useId();
  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    return blocks.filter((b) => b.name.toLowerCase().includes(t)).slice(0, 6);
  }, [q, blocks]);
  return (
    <div className="relative">
      <label className="sr-only" htmlFor={`${listId}-q`}>
        Find a block by street name
      </label>
      <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 dark:bg-slate-800/80">
        <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4 shrink-0 fill-slate-500">
          <path d="M8.5 2a6.5 6.5 0 0 1 5.2 10.4l4 4-1.4 1.4-4-4A6.5 6.5 0 1 1 8.5 2Zm0 2a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Z" />
        </svg>
        <input
          id={`${listId}-q`}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Find a street"
          autoComplete="off"
          className="min-h-11 w-full bg-transparent text-base outline-none placeholder:text-slate-500"
        />
      </div>
      {matches.length > 0 && (
        <ul className="absolute inset-x-0 top-full z-10 mt-1 list-none overflow-hidden rounded-xl border border-slate-200 bg-white p-0 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {matches.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(b.id);
                  setQ('');
                }}
                className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm hover:bg-slate-100 focus-visible:bg-slate-100 dark:hover:bg-slate-800 dark:focus-visible:bg-slate-800"
              >
                <StatusIcon status={b.status} />
                <span className="truncate">{b.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Sidebar({
  village,
  blocks,
  block,
  onSelect,
  onClear,
  groups,
  colorBy,
  onColorBy,
  onOpenGuide,
  showHeader = true,
}: Props) {
  const v = village;
  const canopySorted = useMemo(
    () =>
      blocks
        .map((b) => b.canopyPer100Ft)
        .filter((x): x is number => x !== null)
        .sort((a, b) => a - b),
    [blocks],
  );
  const group = block?.bg ? groups.find((g) => g.id === block.bg) : undefined;
  const graded = v.statusCounts.risk + v.statusCounts.cusp + v.statusCounts.meets;
  return (
    <div className="flex flex-col gap-3">
      <Search blocks={blocks} onSelect={onSelect} />

      {block ? (
        <>
          {showHeader && (
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="m-0 text-base leading-snug font-semibold">{block.name}</h2>
                <div className="mt-1">
                  <StatusPill status={block.status} />
                </div>
              </div>
              <button
                type="button"
                onClick={onClear}
                aria-label="Back to village view"
                title="Back to village view"
                className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
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
            </div>
          )}
          <p className="m-0 text-sm text-slate-700 dark:text-slate-300">
            {statusLine(block)}{' '}
            <button
              type="button"
              onClick={onOpenGuide}
              aria-haspopup="dialog"
              className="text-emerald-700 underline decoration-dotted underline-offset-2 hover:decoration-solid dark:text-emerald-300"
            >
              How grades work
            </button>
          </p>
          {block.priority && (
            <div className="rounded-xl border border-slate-900 p-2 text-sm dark:border-slate-200">
              <p className="m-0 flex items-center gap-1.5 font-medium">
                <PriorityIcon />
                Look here first
              </p>
              <p className="m-0 mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                {priorityCriteria(village)}
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Stat
              label="Trees"
              value={block.trees.toLocaleString()}
              sub={
                block.treesPer100Ft !== null
                  ? `${block.treesPer100Ft} per 100 ft of street`
                  : undefined
              }
            />
            <Stat label="Species" value={String(block.species)} sub={`${block.genera} genera`} />
          </div>
          {block.trees > 0 && <GenusBars genera={block.topGenera} />}
          {block.trees > 0 && (
            <section>
              <h3 className="m-0 mb-1.5 text-sm font-medium">Size &amp; shade</h3>
              <div className="grid grid-cols-2 gap-2">
                <Stat
                  label="Median trunk"
                  value={block.medianDbh !== null ? `${block.medianDbh}"` : '—'}
                  sub={compare(block.medianDbh, v.medianDbh, '"')}
                />
                <Stat
                  label="Avg height"
                  value={block.meanHeight !== null ? `${block.meanHeight} ft` : '—'}
                  sub={compare(block.meanHeight, v.meanHeight, ' ft')}
                />
                <Stat
                  label="Avg spread"
                  value={block.meanSpread !== null ? `${block.meanSpread} ft` : '—'}
                  sub={compare(block.meanSpread, v.meanSpread, ' ft')}
                />
                <Stat
                  label="Est. canopy"
                  value={`${block.canopySqFt.toLocaleString()} sq ft`}
                  sub={
                    block.canopyPer100Ft === null
                      ? undefined
                      : `${block.canopyPer100Ft.toLocaleString()} per 100 ft · more than ${Math.round(
                          canopyPercentile(block.canopyPer100Ft, canopySorted) * 100,
                        )}% of blocks`
                  }
                />
              </div>
            </section>
          )}
          {block.trees > 0 && (
            <p className="m-0 text-[11px] text-slate-500 dark:text-slate-400">
              Most common species: {block.topSpecies.name} ({pct(block.topSpecies.share)})
              {block.topFamily && (
                <>
                  {' · '}Top family: {block.topFamily.name} ({pct(block.topFamily.share)})
                </>
              )}
            </p>
          )}
          {group && <BlockVulnerability group={group} total={groups.length} />}
        </>
      ) : (
        <>
          {showHeader && (
            <div>
              <h2 className="m-0 text-base font-semibold">Village of Oak Park</h2>
              <p className="m-0 text-xs text-slate-500 dark:text-slate-400">
                Public trees · tap a block for details
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Trees" value={v.totalTrees.toLocaleString()} />
            <Stat label="Species" value={String(v.species)} sub={`${v.genera} genera`} />
          </div>
          <section>
            <div className="mb-1 flex items-center justify-between gap-2">
              <h3 className="m-0 text-sm font-medium">Blocks by 10-20-30 rule</h3>
              <GuideButton onClick={onOpenGuide} />
            </div>
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
              {STATUS_ORDER.map((s) => (
                <li key={s} className="flex items-center gap-2">
                  <StatusIcon status={s} />
                  <span className="flex-1">{STATUS_META[s].label}</span>
                  <span className="tabular-nums font-medium">{v.statusCounts[s]}</span>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              {pct(v.statusCounts.risk / graded)} of graded blocks rely on one genus for 30%+ of
              trees
            </p>
          </section>
          <GenusBars genera={v.topGenera.slice(0, 5)} />
          <section>
            <h3 className="m-0 mb-1.5 text-sm font-medium">Size &amp; shade</h3>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Median trunk" value={`${v.medianDbh ?? '—'}"`} />
              <Stat label="Avg height" value={`${v.meanHeight ?? '—'} ft`} />
              <Stat label="Avg spread" value={`${v.meanSpread ?? '—'} ft`} />
              <Stat
                label="Est. canopy"
                value={`${v.canopyAcres} ac`}
                sub={`≈${Math.round(v.canopyCover * 100)}% of village land`}
              />
            </div>
          </section>
          <VillageVulnerability
            village={v}
            blocks={blocks}
            groups={groups}
            colorBy={colorBy}
            onColorBy={onColorBy}
            onSelect={onSelect}
          />
        </>
      )}
    </div>
  );
}
