import { type ReactNode, useMemo, useState } from 'react';
import { type Filters, NO_FILTERS, SIZE_CLASSES, slice } from '../lib/slice';
import { STATUS_META, STATUS_ORDER } from '../lib/status';
import type { AppData, BlockStatus, GenusShare } from '../lib/types';
import { FIFTH_LABELS } from '../lib/vulnerability';
import { GuideButton } from './ClassificationGuide';
import GenusMixBars from './GenusMixBars';
import StatusIcon from './StatusIcon';

interface Props {
  data: AppData;
  filters: Filters;
  onFilters: (f: Filters) => void;
  filtersOpen: boolean;
  onOpenGuide: () => void;
}

const pct1 = (share: number) => `${(share * 100).toFixed(1)}%`;

function Card({
  title,
  sub,
  children,
  className = '',
  action,
}: {
  title: string;
  sub?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="m-0 text-sm font-semibold">{title}</h2>
        {action && <div className="-mt-1.5 -mr-1.5">{action}</div>}
      </div>
      {sub && <p className="m-0 mt-0.5 text-xs text-slate-500 dark:text-slate-400">{sub}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="m-0 text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="m-0 text-2xl font-semibold">{value}</p>
      {sub && <p className="m-0 text-[11px] text-slate-500 dark:text-slate-400">{sub}</p>}
    </div>
  );
}

// share of trees against a 10-20-30 limit; the track is a lighter step of the fill
function Meter({
  label,
  name,
  share,
  limit,
}: {
  label: string;
  name: string;
  share: number;
  limit: number;
}) {
  const scale = limit * 2;
  const over = share >= limit;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="min-w-0">
          <span className="font-medium">{label}</span>{' '}
          <span className="text-slate-500 dark:text-slate-400">{name}</span>
        </span>
        <span className="shrink-0 font-semibold">{pct1(share)}</span>
      </div>
      <div
        className={`relative mt-1 h-3 rounded-full ${over ? 'bg-amber-100 dark:bg-amber-950' : 'bg-teal-100 dark:bg-teal-950'}`}
      >
        <div
          className={`h-3 rounded-full ${over ? 'bg-amber-500' : 'bg-teal-600 dark:bg-teal-500'}`}
          style={{ width: `${Math.min(100, (share / scale) * 100)}%` }}
        />
        <div
          aria-hidden="true"
          className="absolute -top-1 -bottom-1 w-0.5 bg-slate-800 dark:bg-slate-200"
          style={{ left: '50%' }}
        />
      </div>
      <p className="m-0 mt-1 flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
        <StatusIcon status={over ? 'cusp' : 'meets'} />
        {over
          ? `Over the ${pct1(limit).replace('.0', '')} limit by ${((share - limit) * 100).toFixed(1)} points`
          : `Under the ${pct1(limit).replace('.0', '')} limit`}
      </p>
    </div>
  );
}

function ShareBars({
  items,
  guide,
  guideLabel,
  selected,
  onPick,
  what,
}: {
  items: GenusShare[];
  guide: number;
  guideLabel: string;
  selected: string | null;
  onPick: (name: string) => void;
  what: string;
}) {
  const max = Math.max(guide * 1.25, items[0]?.share ?? 0);
  return (
    <>
      <div className="relative">
        <div
          aria-hidden="true"
          className="absolute top-0 bottom-0 border-l border-dashed border-slate-400 dark:border-slate-500"
          style={{ left: `calc(9.5rem + (100% - 12.5rem) * ${guide / max})` }}
        />
        <ol className="m-0 flex list-none flex-col gap-0.5 p-0">
          {items.map((g) => {
            const on = selected === g.name;
            return (
              <li key={g.name}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => onPick(g.name)}
                  title={on ? `Clear ${what} filter` : `Filter to ${g.common ?? g.name}`}
                  className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-1 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800 ${
                    on ? 'bg-blue-50 dark:bg-blue-950/60' : ''
                  }`}
                >
                  <span className="w-34 shrink-0 leading-tight">
                    <span className="block truncate font-medium">{g.common ?? g.name}</span>
                    <span className="block truncate text-[11px] text-slate-500 italic dark:text-slate-400">
                      {g.name}
                    </span>
                  </span>
                  <span className="relative h-3 flex-1">
                    <span
                      className={`absolute inset-y-0 left-0 rounded-r ${
                        on
                          ? 'bg-blue-600 dark:bg-blue-400'
                          : selected
                            ? 'bg-slate-300 dark:bg-slate-600'
                            : 'bg-slate-500 dark:bg-slate-400'
                      }`}
                      style={{ width: `${(g.share / max) * 100}%` }}
                    />
                  </span>
                  <span className="w-10 shrink-0 text-right tabular-nums text-slate-600 dark:text-slate-300">
                    {pct1(g.share)}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      <p className="m-0 mt-2 text-[11px] text-slate-500 dark:text-slate-400">
        Dashed line: {guideLabel}. Tap a bar to filter.
      </p>
    </>
  );
}

function Columns({
  items,
  format,
  label,
  selected,
  onPick,
}: {
  items: { label: string; value: number | null }[];
  format: (v: number) => string;
  label: string;
  selected?: number | null;
  onPick?: (i: number) => void;
}) {
  const max = Math.max(...items.map((i) => i.value ?? 0), 0.0001);
  const hasSel = selected !== null && selected !== undefined;
  return (
    <figure className="m-0">
      <div className="flex h-40 items-end gap-1 border-b border-slate-200 dark:border-slate-800">
        {items.map((it, idx) => {
          const on = selected === idx;
          const bar = (
            <>
              <span className="text-[11px] tabular-nums text-slate-600 dark:text-slate-300">
                {it.value === null ? '—' : format(it.value)}
              </span>
              <span
                className={`block w-full max-w-6 rounded-t ${
                  on
                    ? 'bg-blue-600 dark:bg-blue-400'
                    : hasSel
                      ? 'bg-slate-300 dark:bg-slate-600'
                      : 'bg-slate-500 dark:bg-slate-400'
                }`}
                style={{ height: `${((it.value ?? 0) / max) * 75}%` }}
              />
            </>
          );
          return onPick ? (
            <button
              key={it.label}
              type="button"
              aria-pressed={on}
              aria-label={`${it.label}: ${it.value === null ? 'no data' : format(it.value)}`}
              title={on ? 'Clear filter' : `Filter to ${it.label}`}
              onClick={() => onPick(idx)}
              className={`flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1 rounded-t-lg hover:bg-slate-100 dark:hover:bg-slate-800 ${
                on ? 'bg-blue-50 dark:bg-blue-950/60' : ''
              }`}
            >
              {bar}
            </button>
          ) : (
            <div
              key={it.label}
              className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
            >
              {bar}
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-1">
        {items.map((i) => (
          <span
            key={i.label}
            className="flex-1 text-center text-[11px] tabular-nums text-slate-500 dark:text-slate-400"
          >
            {i.label}
          </span>
        ))}
      </div>
      <figcaption className="mt-1 text-center text-[11px] text-slate-500 dark:text-slate-400">
        {label}
      </figcaption>
    </figure>
  );
}

const CANOPY_GREEN = '#15803d';

function SeriesKey({ items }: { items: { label: string; swatch: ReactNode }[] }) {
  return (
    <ul className="m-0 mb-2 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-[11px] text-slate-600 dark:text-slate-300">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          {i.swatch}
          {i.label}
        </li>
      ))}
    </ul>
  );
}

const canopySwatch = (
  <span
    aria-hidden="true"
    className="inline-block h-2.5 w-4 rounded-sm"
    style={{ backgroundColor: CANOPY_GREEN }}
  />
);
const treesTick = (
  <span
    aria-hidden="true"
    className="inline-block h-3 w-1 rounded-full bg-slate-900 dark:bg-slate-100"
  />
);

// canopy share as a bar, tree share as a tick: bars past the tick give
// more than their share of shade
function CanopyGenera({
  items,
  selected,
  onPick,
}: {
  items: { name: string; common?: string; canopy: number; trees: number }[];
  selected: string | null;
  onPick: (name: string) => void;
}) {
  const max = Math.max(0.25, ...items.map((i) => Math.max(i.canopy, i.trees)));
  return (
    <>
      <SeriesKey
        items={[
          { label: 'Share of canopy', swatch: canopySwatch },
          { label: 'Share of trees', swatch: treesTick },
        ]}
      />
      <ol className="m-0 flex list-none flex-col gap-0.5 p-0">
        {items.map((g) => {
          const on = selected === g.name;
          return (
            <li key={g.name}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onPick(g.name)}
                aria-label={`${g.common ?? g.name}: ${pct1(g.canopy)} of canopy, ${pct1(g.trees)} of trees`}
                className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-1 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800 ${
                  on ? 'bg-blue-50 dark:bg-blue-950/60' : ''
                }`}
              >
                <span className="w-28 shrink-0 leading-tight">
                  <span className="block truncate font-medium">{g.common ?? g.name}</span>
                  <span className="block truncate text-[11px] text-slate-500 italic dark:text-slate-400">
                    {g.name}
                  </span>
                </span>
                <span className="relative h-3 flex-1">
                  <span
                    className="absolute inset-y-0 left-0 rounded-r"
                    style={{
                      width: `${(g.canopy / max) * 100}%`,
                      backgroundColor: CANOPY_GREEN,
                      opacity: selected && !on ? 0.35 : 1,
                    }}
                  />
                  <span
                    className="absolute -top-1 -bottom-1 w-1 -translate-x-1/2 rounded-full bg-slate-900 ring-2 ring-white dark:bg-slate-100 dark:ring-slate-900"
                    style={{ left: `${(g.trees / max) * 100}%` }}
                  />
                </span>
                <span className="w-11 shrink-0 text-right tabular-nums text-slate-600 dark:text-slate-300">
                  {pct1(g.canopy)}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="flex min-w-0 flex-col gap-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-2 text-base text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

function FilterBar({
  data,
  filters: f,
  onFilters,
  open,
  shown,
}: {
  data: AppData;
  filters: Filters;
  onFilters: (f: Filters) => void;
  open: boolean;
  shown: { trees: number; blocks: number };
}) {
  const [expanded, setExpanded] = useState(open);
  const { names, points } = data;
  // genus and species pick lists, most common first
  const { generaList, speciesList, speciesGenus } = useMemo(() => {
    const gc = new Map<string, number>();
    const sc = new Map<string, number>();
    const sg = new Map<string, string>();
    for (const t of points) {
      gc.set(t.g, (gc.get(t.g) ?? 0) + 1);
      sc.set(t.p, (sc.get(t.p) ?? 0) + 1);
      sg.set(t.p, t.g);
    }
    const byCount = (m: Map<string, number>) =>
      [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
    return { generaList: byCount(gc), speciesList: byCount(sc), speciesGenus: sg };
  }, [points]);
  const set = (patch: Partial<Filters>) => onFilters({ ...f, ...patch });
  const genusName = (g: string) => (names.genera[g] ? `${names.genera[g]} (${g})` : g);
  const speciesName = (sp: string) => names.species[sp] ?? sp;

  const pills: [string, () => void][] = [];
  if (f.fifth) pills.push([FIFTH_LABELS[f.fifth - 1] ?? '', () => set({ fifth: null })]);
  if (f.status) pills.push([STATUS_META[f.status].label, () => set({ status: null })]);
  if (f.genus)
    pills.push([names.genera[f.genus] ?? f.genus, () => set({ genus: null, species: null })]);
  if (f.species) pills.push([speciesName(f.species), () => set({ species: null })]);
  if (f.size !== null)
    pills.push([`Trunk ${SIZE_CLASSES[f.size]?.[2]}`, () => set({ size: null })]);

  return (
    // only the pill row sticks; the slicer grid scrolls away so it never covers
    // the charts on a phone
    <>
      <section
        aria-label="Active filters"
        className="sticky top-0 z-10 -mx-3 -mb-1 flex items-center gap-2 border-b border-slate-200 bg-slate-50/95 px-3 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95"
      >
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          aria-controls="dashboard-slicers"
          className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-white px-3 text-sm font-medium shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4 fill-current">
            <path d="M3 4h14l-5.5 6.5V16l-3 1.5v-7L3 4Z" />
          </svg>
          Filters{pills.length ? ` (${pills.length})` : ''}
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
          {pills.map(([label, clear]) => (
            <button
              key={label}
              type="button"
              onClick={clear}
              aria-label={`Remove filter ${label}`}
              className="flex min-h-9 shrink-0 items-center gap-1 rounded-full whitespace-nowrap bg-blue-600 py-1 pr-2 pl-3 text-xs font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
            >
              {label}
              <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4">
                <path
                  d="M6 6l8 8M14 6l-8 8"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          ))}
        </div>
        {pills.length > 0 && (
          <button
            type="button"
            onClick={() => onFilters(NO_FILTERS)}
            className="min-h-9 shrink-0 px-1 text-xs font-medium whitespace-nowrap text-blue-700 underline dark:text-blue-300"
          >
            Clear all
          </button>
        )}
        <span className="hidden shrink-0 text-xs text-slate-500 tabular-nums sm:inline dark:text-slate-400">
          {shown.trees.toLocaleString()} trees · {shown.blocks} blocks
        </span>
      </section>
      {expanded && (
        <section
          id="dashboard-slicers"
          aria-label="Dashboard filters"
          className="grid grid-cols-2 gap-2 lg:grid-cols-5"
        >
          <Select
            label="Vulnerability"
            value={String(f.fifth ?? '')}
            onChange={(v) => set({ fifth: v ? Number(v) : null })}
            options={[
              ['', 'All areas'],
              ...[5, 4, 3, 2, 1].map((n): [string, string] => [
                String(n),
                FIFTH_LABELS[n - 1] ?? '',
              ]),
            ]}
          />
          <Select
            label="Block status"
            value={f.status ?? ''}
            onChange={(v) => set({ status: (v || null) as BlockStatus | null })}
            options={[
              ['', 'All blocks'],
              ...STATUS_ORDER.map((s): [string, string] => [s, STATUS_META[s].label]),
            ]}
          />
          <Select
            label="Genus"
            value={f.genus ?? ''}
            onChange={(v) =>
              set({
                genus: v || null,
                species: f.species && speciesGenus.get(f.species) === v ? f.species : null,
              })
            }
            options={[
              ['', 'All genera'],
              ...generaList.map((g): [string, string] => [g, genusName(g)]),
            ]}
          />
          <Select
            label="Species"
            value={f.species ?? ''}
            onChange={(v) =>
              set({ species: v || null, genus: v ? (speciesGenus.get(v) ?? null) : f.genus })
            }
            options={[
              ['', 'All species'],
              ...speciesList
                .filter((sp) => !f.genus || speciesGenus.get(sp) === f.genus)
                .map((sp): [string, string] => [sp, speciesName(sp)]),
            ]}
          />
          <div className="col-span-2 lg:col-span-1">
            <Select
              label="Trunk size"
              value={String(f.size ?? '')}
              onChange={(v) => set({ size: v === '' ? null : Number(v) })}
              options={[
                ['', 'All sizes'],
                ...SIZE_CLASSES.map(([, , l], i): [string, string] => [String(i), l]),
              ]}
            />
          </div>
        </section>
      )}
    </>
  );
}

export default function Dashboard({
  data,
  filters: f,
  onFilters,
  filtersOpen,
  onOpenGuide,
}: Props) {
  const v = data.village;
  const sl = useMemo(() => slice(data, f), [data, f]);
  const set = (patch: Partial<Filters>) => onFilters({ ...f, ...patch });
  const filtered = Object.values(f).some((x) => x !== null);
  const treeFilter = Boolean(f.genus || f.species);
  const total = STATUS_ORDER.reduce((a, s) => a + sl.statusCounts[s], 0);
  const graded = sl.statusCounts.risk + sl.statusCounts.cusp + sl.statusCounts.meets;
  const whatTrees = f.species
    ? (data.names.species[f.species] ?? f.species)
    : f.genus
      ? (data.names.genera[f.genus] ?? f.genus)
      : 'public';
  const topGenus = sl.topGenus;
  const topSpecies = sl.topSpecies;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-3 px-3 pb-6">
      <FilterBar
        data={data}
        filters={f}
        onFilters={onFilters}
        open={filtersOpen}
        shown={{ trees: sl.trees, blocks: sl.blocks }}
      />
      <section className="flex flex-col gap-3 lg:flex-row">
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm lg:w-80 dark:border-slate-800 dark:bg-slate-900">
          <p className="m-0 text-sm text-slate-500 dark:text-slate-400">
            {filtered ? 'Selected trees' : 'Public trees'}
          </p>
          <p className="m-0 text-5xl leading-tight font-semibold">{sl.trees.toLocaleString()}</p>
          <p className="m-0 text-xs text-slate-500 dark:text-slate-400">
            {filtered
              ? `of ${v.totalTrees.toLocaleString()} public trees, on ${sl.blocks} street blocks`
              : `on parkways and public land along ${v.blocks} street blocks`}
          </p>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="Species" value={String(sl.species)} />
          <Tile label="Genera" value={String(sl.genera)} />
          <Tile
            label="Est. canopy"
            value={`${Math.round(sl.canopyAcres)} ac`}
            sub={
              sl.canopyCover === null
                ? 'from crown spread, approx.'
                : `≈${Math.round(sl.canopyCover * 100)}% of land, approx.`
            }
          />
          <Tile
            label="Median trunk"
            value={sl.medianDbh === null ? '—' : `${sl.medianDbh}"`}
            sub="diameter at chest height"
          />
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card
          title={
            filtered
              ? '10-20-30 diversity check, selection'
              : '10-20-30 diversity check, villagewide'
          }
          sub="No more than 10% of one species, 20% of one genus, 30% of one family"
        >
          {treeFilter ? (
            <p className="m-0 text-sm text-slate-600 dark:text-slate-300">
              The check applies to a whole tree population. Remove the genus and species filters to
              see it.
            </p>
          ) : sl.trees === 0 ? (
            <p className="m-0 text-sm text-slate-600 dark:text-slate-300">
              No trees match these filters.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {topSpecies && (
                <Meter
                  label="Top species"
                  name={topSpecies.common ?? topSpecies.name}
                  share={topSpecies.share}
                  limit={0.1}
                />
              )}
              {topGenus && (
                <Meter
                  label="Top genus"
                  name={`${topGenus.common ?? ''} (${topGenus.name})`}
                  share={topGenus.share}
                  limit={0.2}
                />
              )}
              {sl.topFamily && (
                <Meter
                  label="Top family"
                  name={`${sl.topFamily.common ?? ''} (${sl.topFamily.name})`}
                  share={sl.topFamily.share}
                  limit={0.3}
                />
              )}
              <p className="m-0 text-xs text-slate-500 dark:text-slate-400">
                Family is assigned from genus using the current botanical classification (APG IV).
              </p>
            </div>
          )}
        </Card>

        <Card
          title="Street blocks by diversity status"
          action={<GuideButton onClick={onOpenGuide} />}
          sub={`${graded} graded${f.genus || f.species || f.size !== null ? ' blocks with matching trees' : ' blocks'}; at risk means one genus is 30%+ or one species 50%+`}
        >
          <div className="flex h-6 gap-0.5 overflow-hidden rounded">
            {STATUS_ORDER.map((s) => (
              <button
                key={s}
                type="button"
                tabIndex={-1}
                aria-hidden="true"
                onClick={() => set({ status: f.status === s ? null : s })}
                style={{
                  width: `${total ? (sl.statusCounts[s] / total) * 100 : 0}%`,
                  backgroundColor: STATUS_META[s].color,
                  opacity: f.status && f.status !== s ? 0.3 : 1,
                }}
                title={`${STATUS_META[s].label}: ${sl.statusCounts[s]}`}
              />
            ))}
          </div>
          <ul className="m-0 mt-2 grid list-none grid-cols-1 gap-0.5 p-0 text-sm sm:grid-cols-2">
            {STATUS_ORDER.map((s) => {
              const on = f.status === s;
              return (
                <li key={s}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => set({ status: on ? null : s })}
                    className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-1.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800 ${
                      on ? 'bg-blue-50 dark:bg-blue-950/60' : ''
                    }`}
                  >
                    <StatusIcon status={s} />
                    <span className="flex-1">{STATUS_META[s].label}</span>
                    <span className="font-semibold tabular-nums">{sl.statusCounts[s]}</span>
                    <span className="w-9 text-right text-xs text-slate-500 tabular-nums dark:text-slate-400">
                      {total ? Math.round((sl.statusCounts[s] / total) * 100) : 0}%
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card
          title="Most common genera"
          sub={filtered ? 'Share of selected trees' : 'Share of all public trees'}
        >
          <ShareBars
            items={sl.genera10}
            guide={0.2}
            guideLabel="20% limit for one genus"
            selected={f.genus}
            what="genus"
            onPick={(g) =>
              set(f.genus === g ? { genus: null, species: null } : { genus: g, species: null })
            }
          />
        </Card>

        <Card
          title={
            f.genus ? `${data.names.genera[f.genus] ?? f.genus} species` : 'Most common species'
          }
          sub={
            f.genus
              ? `Drilldown: species within ${f.genus}`
              : filtered
                ? 'Share of selected trees'
                : 'Share of all public trees'
          }
        >
          <ShareBars
            items={sl.species10}
            guide={0.1}
            guideLabel="10% limit for one species"
            selected={f.species}
            what="species"
            onPick={(sp) => {
              const genus = data.points.find((t) => t.p === sp)?.g ?? null;
              set(f.species === sp ? { species: null } : { species: sp, genus });
            }}
          />
        </Card>

        <Card
          title="Who provides the shade"
          sub="Estimated canopy by genus. A bar past its tick gives more than its share of shade."
        >
          {(() => {
            const top = sl.canopyGenera[0];
            return top && !f.genus && !f.species ? (
              <p className="m-0 mb-3 text-sm">
                <span className="font-semibold">{top.common ?? top.name}</span> trees supply{' '}
                <span className="font-semibold">{pct1(top.canopy)}</span> of the canopy from{' '}
                {pct1(top.trees)} of the trees
                {top.canopy >= 0.2
                  ? ': losing that one genus would remove over a fifth of the shade.'
                  : '.'}
              </p>
            ) : null;
          })()}
          <CanopyGenera
            items={sl.canopyGenera}
            selected={f.genus}
            onPick={(g) =>
              set(f.genus === g ? { genus: null, species: null } : { genus: g, species: null })
            }
          />
        </Card>

        <Card
          title="Genus mix by trunk size"
          sub="The biggest trees give most of the shade. Are they diverse?"
        >
          {(() => {
            const canopy = sl.canopySizes.slice(3).reduce((a, x) => a + x.canopy, 0);
            const large = new Map<string, number>();
            let n = 0;
            for (const row of sl.sizeMix.slice(3)) {
              for (const [g, c] of row.genera) large.set(g, (large.get(g) ?? 0) + c);
              n += row.total;
            }
            const lead = [...large.entries()].sort((a, b) => b[1] - a[1])[0];
            if (f.genus) {
              // with a genus chosen, compare its share among large vs small trees
              const small = sl.sizeMix.slice(0, 2);
              const sN = small.reduce((a, r) => a + r.total, 0);
              const sG = small.reduce((a, r) => a + (r.genera.get(f.genus as string) ?? 0), 0);
              const lG = large.get(f.genus) ?? 0;
              const gName = data.names.genera[f.genus] ?? f.genus;
              return n && sN ? (
                <p className="m-0 mb-3 text-sm">
                  {gName} is <span className="font-semibold">{pct1(lG / n)}</span> of trees
                  18&quot;+ and <span className="font-semibold">{pct1(sG / sN)}</span> of trees
                  under 12&quot;.
                </p>
              ) : null;
            }
            return lead && n ? (
              <p className="m-0 mb-3 text-sm">
                Trees 18&quot;+ give <span className="font-semibold">{pct1(canopy)}</span> of the
                canopy, and <span className="font-semibold">{pct1(lead[1] / n)}</span> of them are{' '}
                {(data.names.genera[lead[0]] ?? lead[0]).toLowerCase()}.
              </p>
            ) : null;
          })()}
          <GenusMixBars
            rows={SIZE_CLASSES.map(([, , label], i) => ({
              label,
              total: sl.sizeMix[i]?.total ?? 0,
              genera: sl.sizeMix[i]?.genera ?? new Map(),
            }))}
            points={data.points}
            genusNames={data.names.genera}
            highlight={f.genus}
            selectedRow={f.size}
            onPickRow={(i) => set({ size: f.size === i ? null : i })}
            caption={
              f.genus
                ? `Highlighting ${data.names.genera[f.genus] ?? f.genus}: its share of each size band. Tap a row to filter by size.`
                : 'Right: the leading genus in each size band. Tap a row to filter by size.'
            }
          />
        </Card>

        <Card
          title="Tree sizes"
          sub="Trees by trunk diameter. A size profile, not age: the inventory has no planting year."
        >
          <Columns
            items={SIZE_CLASSES.map(([, , label], i) => ({ label, value: sl.sizes[i] ?? 0 }))}
            format={(n) => n.toLocaleString()}
            label="Trunk diameter (inches) · tap a column to filter"
            selected={f.size}
            onPick={(i) => set({ size: f.size === i ? null : i })}
          />
        </Card>

        <Card
          title="Shade and social vulnerability"
          sub={`Median ${whatTrees === 'public' ? 'public' : whatTrees} trees per acre across census block groups, by the Village seniors index`}
        >
          <Columns
            items={sl.seniors.map((x) => ({ label: String(x.level), value: x.value }))}
            format={(n) => n.toFixed(1)}
            label="Seniors index (1 low – 5 high)"
          />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
            <div>
              <p className="m-0 text-2xl font-semibold">
                {filtered ? `${sl.priority} of ${v.priorityCount}` : sl.priority} blocks
              </p>
              <p className="m-0 text-xs text-slate-600 dark:text-slate-300">
                to look at first: high vulnerability, at risk, low canopy
                {filtered ? ' (in this selection)' : ''}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <p className="m-0 text-[11px] text-slate-500 dark:text-slate-400">
        Village of Oak Park tree inventory (public view) and Social Vulnerability Index; park
        outlines © OpenStreetMap contributors. Public trees only; no tree condition or age is
        recorded. Canopy overlaps are not removed.
      </p>
    </div>
  );
}
