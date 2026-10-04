import { type ReactNode, useMemo } from 'react';
import { NO_FILTERS, slice } from '../lib/slice';
import { STATUS_META, STATUS_ORDER } from '../lib/status';
import type { AppData, ColorBy } from '../lib/types';
import GenusMixBars from './GenusMixBars';
import StatusIcon from './StatusIcon';

interface Props {
  data: AppData;
  onShowMap: (colorBy: ColorBy) => void;
  onShowBlock: (id: string) => void;
  onShowDashboard: () => void;
  onOpenGuide: () => void;
}

const pct = (share: number, digits = 0) => `${(share * 100).toFixed(digits)}%`;
const GREEN = '#15803d';

function SeeIt({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-slate-100 px-3 text-sm font-medium text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
    >
      {label}
      <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4 fill-current">
        <path d="M7.3 4.3 13 10l-5.7 5.7-1.4-1.4L10.2 10 5.9 5.7l1.4-1.4Z" />
      </svg>
    </button>
  );
}

function Finding({
  n,
  title,
  stat,
  statLabel,
  children,
  visual,
  action,
}: {
  n: number;
  title: string;
  stat: string;
  statLabel: string;
  children: ReactNode;
  visual?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <article className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white"
        >
          {n}
        </span>
        <h2 className="m-0 text-base leading-snug font-semibold">{title}</h2>
      </div>
      <p className="m-0 mt-3 flex flex-wrap items-baseline gap-x-2">
        <span className="text-4xl font-semibold">{stat}</span>
        <span className="text-sm text-slate-500 dark:text-slate-400">{statLabel}</span>
      </p>
      <div className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
        {children}
      </div>
      {visual && <div className="mt-4">{visual}</div>}
      {action && <div className="mt-auto">{action}</div>}
    </article>
  );
}

// share against a limit; the dark notch marks the limit
function LimitBar({ label, share, limit }: { label: string; share: number; limit: number }) {
  const max = limit * 2;
  const over = share >= limit;
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span>{label}</span>
        <span className="font-semibold tabular-nums">
          {pct(share, 1)} <span className="font-normal text-slate-500">/ {pct(limit)} limit</span>
        </span>
      </div>
      <div
        className={`relative mt-1 h-2.5 rounded-full ${over ? 'bg-amber-100 dark:bg-amber-950' : 'bg-teal-100 dark:bg-teal-950'}`}
      >
        <div
          className={`h-2.5 rounded-full ${over ? 'bg-amber-500' : 'bg-teal-600'}`}
          style={{ width: `${Math.min(100, (share / max) * 100)}%` }}
        />
        <div
          aria-hidden="true"
          className="absolute -top-1 -bottom-1 left-1/2 w-0.5 bg-slate-800 dark:bg-slate-200"
        />
      </div>
    </div>
  );
}

// two stacked 100% bars comparing shares of trees vs canopy
function TwoBars({
  rows,
}: {
  rows: { label: string; share: number; color: string; muted?: boolean }[];
}) {
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="flex justify-between text-xs">
            <span>{r.label}</span>
            <span className="font-semibold tabular-nums">{pct(r.share, 1)}</span>
          </div>
          <div className="mt-1 h-2.5 rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className={`h-2.5 rounded-full ${r.muted ? 'bg-slate-400 dark:bg-slate-500' : ''}`}
              style={{
                width: `${r.share * 100}%`,
                backgroundColor: r.muted ? undefined : r.color,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Findings({
  data,
  onShowMap,
  onShowBlock,
  onShowDashboard,
  onOpenGuide,
}: Props) {
  const v = data.village;
  const names = data.names;
  const all = useMemo(() => slice(data, NO_FILTERS), [data]);

  const graded = v.statusCounts.risk + v.statusCounts.cusp + v.statusCounts.meets;
  const allBlocks = STATUS_ORDER.reduce((a, s) => a + v.statusCounts[s], 0);
  const topGenusName = names.genera[v.topGenus.name] ?? v.topGenus.name;
  const topSpeciesName = names.species[v.topSpecies.name] ?? v.topSpecies.name;
  const topFamily = v.topFamilies[0];

  // at-risk blocks led by the village's top genus
  const riskBlocks = data.blocks.filter((b) => b.status === 'risk');
  const riskByTop = riskBlocks.filter((b) => b.topGenus.name === v.topGenus.name).length;

  const topCanopy = all.canopyGenera[0];
  const top3Canopy = all.canopyGenera.slice(0, 3).reduce((a, g) => a + g.canopy, 0);
  const top3Names = all.canopyGenera.slice(0, 3).map((g) => (g.common ?? g.name).toLowerCase());
  const bigCanopy = all.canopySizes.slice(3).reduce((a, x) => a + x.canopy, 0);

  // genus mix by trunk size: the biggest (shadiest) trees vs the smallest
  const sizeBands = useMemo(() => {
    const bands: [number, number, string][] = [
      [0, 12, 'Under 12"'],
      [12, 18, '12–18"'],
      [18, 30, '18–30"'],
      [30, Number.POSITIVE_INFINITY, '30"+'],
    ];
    const crown = (w: number | null) => (w === null ? 0 : Math.PI * (w / 2) ** 2);
    const totalCanopy = data.points.reduce((a, t) => a + crown(t.w), 0);
    const rows = bands.map(([lo, hi, label]) => {
      const genera = new Map<string, number>();
      let total = 0;
      for (const t of data.points) {
        if (t.d === null || t.d <= 0 || t.d < lo || t.d >= hi) continue;
        genera.set(t.g, (genera.get(t.g) ?? 0) + 1);
        total++;
      }
      return { label, total, genera };
    });
    const top = (r: (typeof rows)[number]) => {
      const e = [...r.genera.entries()].sort((a, b) => b[1] - a[1]);
      return { lead: e[0], top4: e.slice(0, 4).reduce((a, x) => a + x[1], 0) / (r.total || 1) };
    };
    // trees 18"+ pooled
    const large = new Map<string, number>();
    let largeN = 0;
    let largeLeadCanopy = 0;
    for (const t of data.points) {
      if (t.d === null || t.d < 18) continue;
      large.set(t.g, (large.get(t.g) ?? 0) + 1);
      largeN++;
    }
    const largeSorted = [...large.entries()].sort((a, b) => b[1] - a[1]);
    const largeLead = largeSorted[0];
    for (const t of data.points)
      if (t.d !== null && t.d >= 18 && t.g === largeLead?.[0]) largeLeadCanopy += crown(t.w);
    return {
      rows,
      small: top(rows[0] as (typeof rows)[number]),
      biggest: top(rows[3] as (typeof rows)[number]),
      biggestN: rows[3]?.total ?? 0,
      largeLead,
      largeLeadShare: largeLead ? largeLead[1] / largeN : 0,
      largeTop4: largeSorted.slice(0, 4).reduce((a, x) => a + x[1], 0) / (largeN || 1),
      largeTop4Names: largeSorted.slice(0, 4).map(([g]) => (names.genera[g] ?? g).toLowerCase()),
      largeLeadCanopy: totalCanopy ? largeLeadCanopy / totalCanopy : 0,
    };
  }, [data.points, names.genera]);
  const gName = (g?: string) => (g ? (names.genera[g] ?? g) : '');

  const rho = v.treesPerAcreRho;
  const coverByFifth = [1, 2, 3, 4, 5].map((f) => {
    const gs = data.vulnerability.filter((g) => g.fifth === f);
    const area = gs.reduce((a, g) => a + g.areaAcres, 0);
    return area ? gs.reduce((a, g) => a + (g.canopyShare ?? 0) * g.areaAcres, 0) / area : 0;
  });
  const coverMin = Math.min(...coverByFifth);
  const coverMax = Math.max(...coverByFifth);

  const priority = data.blocks.filter((b) => b.priority);
  const corridors = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of priority) {
      const street = b.name.replace(/^\d+ /, '').replace(/^[NS] /, '');
      m.set(street, (m.get(street) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [priority]);
  const priorityExamples = [...priority].sort((a, b) => b.trees - a.trees).slice(0, 4);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 px-3 pt-2 pb-8">
      <header className="rounded-3xl bg-gradient-to-br from-emerald-700 to-emerald-900 px-6 py-6 text-white shadow-sm">
        <p className="m-0 text-xs font-semibold tracking-wide text-emerald-200 uppercase">
          Key findings
        </p>
        <h2 className="m-0 mt-1 text-2xl leading-tight font-semibold sm:text-3xl">
          Oak Park&apos;s street trees lean on maples, and its biggest, shadiest trees are the least
          diverse
        </h2>
        <p className="m-0 mt-2 max-w-3xl text-sm text-emerald-50/90">
          From {v.totalTrees.toLocaleString()} public trees on {allBlocks} street blocks in the
          Village tree inventory, compared with the Village Social Vulnerability Index.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Finding
          n={1}
          title="Villagewide, Oak Park sits right at the diversity line"
          stat={pct(v.topGenus.share, 1)}
          statLabel={`of trees are ${topGenusName.toLowerCase()}s, just over the 20% genus limit`}
          visual={
            <div className="flex flex-col gap-3">
              <LimitBar
                label={`Top genus · ${topGenusName}`}
                share={v.topGenus.share}
                limit={0.2}
              />
              <LimitBar
                label={`Top species · ${topSpeciesName}`}
                share={v.topSpecies.share}
                limit={0.1}
              />
              {topFamily && (
                <LimitBar
                  label={`Top family · ${names.families[topFamily.name] ?? topFamily.name} (${topFamily.name})`}
                  share={topFamily.share}
                  limit={0.3}
                />
              )}
            </div>
          }
          action={<SeeIt label="How the 10-20-30 rule works" onClick={onOpenGuide} />}
        >
          The most common species, {topSpeciesName}, is {pct(v.topSpecies.share, 1)} of trees, under
          the 10% species limit, and the largest family,{' '}
          {topFamily
            ? `${(names.families[topFamily.name] ?? topFamily.name).toLowerCase()} (${topFamily.name})`
            : ''}
          , is {topFamily ? pct(topFamily.share, 1) : ''}, under the 30% family limit. On paper the
          village is close to balanced.
        </Finding>

        <Finding
          n={2}
          title="Block by block, dependence on one genus is common"
          stat={pct(v.statusCounts.risk / graded)}
          statLabel={`of graded blocks are at risk (${v.statusCounts.risk} of ${graded})`}
          visual={
            <div>
              <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
                {STATUS_ORDER.map((s) => (
                  <div
                    key={s}
                    style={{
                      width: `${(v.statusCounts[s] / allBlocks) * 100}%`,
                      backgroundColor: STATUS_META[s].color,
                    }}
                  />
                ))}
              </div>
              <ul className="m-0 mt-2 grid list-none grid-cols-2 gap-1 p-0 text-xs">
                {STATUS_ORDER.map((s) => (
                  <li key={s} className="flex items-center gap-1.5">
                    <StatusIcon status={s} />
                    <span className="flex-1">{STATUS_META[s].label}</span>
                    <span className="font-semibold tabular-nums">{v.statusCounts[s]}</span>
                  </li>
                ))}
              </ul>
            </div>
          }
          action={<SeeIt label="See blocks on the map" onClick={() => onShowMap('diversity')} />}
        >
          Only {v.statusCounts.meets} blocks meet the guideline. {topGenusName}s lead{' '}
          <strong>
            {riskByTop} of the {riskBlocks.length}
          </strong>{' '}
          at-risk blocks ({pct(riskByTop / riskBlocks.length)}), so the village-level balance hides
          streets where one pest or disease could take most of the trees.
        </Finding>

        {topCanopy && (
          <Finding
            n={3}
            title="Shade is even more concentrated than tree counts"
            stat={pct(top3Canopy)}
            statLabel={`of public canopy comes from ${top3Names.slice(0, 2).join(', ')} and ${top3Names[2]} trees`}
            visual={
              <TwoBars
                rows={[
                  {
                    label: `${topCanopy.common ?? topCanopy.name} · share of trees`,
                    share: topCanopy.trees,
                    color: GREEN,
                    muted: true,
                  },
                  {
                    label: `${topCanopy.common ?? topCanopy.name} · share of canopy`,
                    share: topCanopy.canopy,
                    color: GREEN,
                  },
                ]}
              />
            }
            action={<SeeIt label="Canopy by genus on the dashboard" onClick={onShowDashboard} />}
          >
            {topCanopy.common ?? topCanopy.name} trees are {pct(topCanopy.trees, 1)} of trees but
            give {pct(topCanopy.canopy, 1)} of the canopy. Measured by shade, losing that one genus
            would remove more than a fifth of public tree cover.
          </Finding>
        )}

        <Finding
          n={4}
          title="The biggest, shadiest trees are the least diverse"
          stat={pct(sizeBands.largeLeadShare)}
          statLabel={`of trees with trunks 18" or wider are ${gName(sizeBands.largeLead?.[0]).toLowerCase()}s, near the 30% at-risk line`}
          visual={
            <GenusMixBars
              rows={sizeBands.rows}
              points={data.points}
              genusNames={names.genera}
              caption="Genus mix of public trees by trunk diameter. Right: the leading genus in each size band."
            />
          }
          action={<SeeIt label="Genus mix by size on the dashboard" onClick={onShowDashboard} />}
        >
          Trees 18&quot; and wider give {pct(bigCanopy)} of the canopy, and just four genera (
          {sizeBands.largeTop4Names.slice(0, 3).join(', ')} and {sizeBands.largeTop4Names[3]}) make
          up {pct(sizeBands.largeTop4)} of them. Large{' '}
          {gName(sizeBands.largeLead?.[0]).toLowerCase()}s alone give{' '}
          <strong>{pct(sizeBands.largeLeadCanopy, 1)} of all public canopy</strong>. The{' '}
          {sizeBands.biggestN.toLocaleString()} biggest trees (30&quot;+) are{' '}
          {pct((sizeBands.biggest.lead?.[1] ?? 0) / (sizeBands.biggestN || 1))}{' '}
          {gName(sizeBands.biggest.lead?.[0]).toLowerCase()}
          {sizeBands.biggest.lead?.[0] === 'Ulmus'
            ? ', the genus Dutch elm disease devastated.'
            : '.'}{' '}
          Smaller trees are far more mixed: {gName(sizeBands.small.lead?.[0]).toLowerCase()} leads
          at only {pct((sizeBands.small.lead?.[1] ?? 0) / (sizeBands.rows[0]?.total || 1))}, which
          hints at a more diverse canopy ahead if they reach maturity. (Size isn&apos;t age; the
          inventory doesn&apos;t record planting year.)
        </Finding>

        <Finding
          n={5}
          title="The equity gap is in tree numbers, not species or cover"
          stat={rho.noVehicle.toFixed(2)}
          statLabel="rank correlation: households without a car vs trees per acre"
          visual={
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-xs">
              {(
                [
                  ['noVehicle', 'No vehicle'],
                  ['seniors', 'Seniors'],
                  ['disability', 'Disability'],
                  ['composite', 'Overall vulnerability'],
                  ['poverty', 'Poverty'],
                ] as const
              ).map(([k, label]) => {
                const r = rho[k];
                return (
                  <li key={k} className="flex items-center gap-2">
                    <span className="w-36 shrink-0">{label}</span>
                    <span className="relative h-2.5 flex-1 rounded-full bg-slate-100 dark:bg-slate-800">
                      <span
                        aria-hidden="true"
                        className="absolute inset-y-0 left-1/2 w-px bg-slate-400"
                      />
                      <span
                        className={`absolute inset-y-0 rounded-full ${Math.abs(r) >= 0.27 ? 'bg-violet-600 dark:bg-violet-400' : 'bg-slate-300 dark:bg-slate-600'}`}
                        style={
                          r < 0
                            ? { right: '50%', width: `${Math.abs(r) * 100}%` }
                            : { left: '50%', width: `${r * 100}%` }
                        }
                      />
                    </span>
                    <span className="w-10 shrink-0 text-right tabular-nums">{r.toFixed(2)}</span>
                  </li>
                );
              })}
            </ul>
          }
          action={
            <SeeIt
              label="Color the map by vulnerability"
              onClick={() => onShowMap('vulnerability')}
            />
          }
        >
          Census areas with more seniors, more households without a car or more residents with a
          disability have <strong>fewer public trees per acre</strong>. Canopy cover is flat (
          {pct(coverMin)}–{pct(coverMax)} in every vulnerability fifth), and diversity shows no link
          at all.
        </Finding>

        <Finding
          n={6}
          title="Where to look first"
          stat={String(priority.length)}
          statLabel="blocks: high vulnerability, at risk on diversity, bottom-quarter canopy"
          visual={
            <div>
              <p className="m-0 mb-1.5 text-xs text-slate-500 dark:text-slate-400">
                Mostly commercial corridors:{' '}
                {corridors
                  .slice(0, 5)
                  .map(([s, n]) => `${s} (${n})`)
                  .join(', ')}
              </p>
              <ul className="m-0 flex list-none flex-col p-0">
                {priorityExamples.map((b) => (
                  <li key={b.id} className="border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => onShowBlock(b.id)}
                      className="flex min-h-11 w-full items-center gap-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    >
                      <StatusIcon status={b.status} />
                      <span className="flex-1">{b.name}</span>
                      <span className="text-xs text-slate-500 tabular-nums dark:text-slate-400">
                        {b.trees} trees
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          }
          action={<SeeIt label="Color the map by canopy" onClick={() => onShowMap('canopy')} />}
        >
          These are candidates for a field visit, not conclusions. Low public canopy on a storefront
          block may reflect limited planting space rather than neglect.
        </Finding>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/40">
          <h2 className="m-0 text-base font-semibold text-emerald-900 dark:text-emerald-200">
            Suggested next steps
          </h2>
          <ul className="m-0 mt-2 list-disc space-y-1.5 pl-5 text-sm text-emerald-950/90 dark:text-emerald-100/90">
            <li>
              Favor genera other than {topGenusName.toLowerCase()} when replanting, especially on
              the {v.statusCounts.risk} at-risk blocks.
            </li>
            <li>Protect large existing trees: they provide most of the shade today.</li>
            <li>
              Walk the {priority.length} look-here-first blocks to check planting space and
              conditions the inventory can&apos;t show.
            </li>
            <li>
              Compare with the Village forestry planting list and private-tree canopy data before
              setting targets.
            </li>
          </ul>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="m-0 text-base font-semibold">What this data can&apos;t tell us</h2>
          <ul className="m-0 mt-2 list-disc space-y-1.5 pl-5 text-sm text-slate-600 dark:text-slate-300">
            <li>Tree health or age: the inventory records neither.</li>
            <li>
              Private trees: canopy here is public trees only ({pct(v.canopyCover)} of land, an
              upper bound because overlapping crowns aren&apos;t removed).
            </li>
            <li>
              Cause: the vulnerability patterns are modest correlations across 53 areas, from an
              index whose method and year aren&apos;t published.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
