import { useCallback, useMemo, useState } from 'react';
import ClassificationGuide from './components/ClassificationGuide';
import Dashboard from './components/Dashboard';
import Findings from './components/Findings';
import MapView from './components/MapView';
import Sidebar from './components/Sidebar';
import { type Filters, NO_FILTERS } from './lib/slice';
import { STATUS_META } from './lib/status';
import type { Block, ColorBy } from './lib/types';
import { useData } from './lib/useData';
import { useIsDesktop } from './lib/useIsDesktop';

type Tab = 'map' | 'dashboard' | 'findings';

const TABS: [Tab, string, string][] = [
  ['map', 'Map', 'M2 4l5-2 6 2 5-2v14l-5 2-6-2-5 2V4Zm5 0v10l6 2V6L7 4Z'],
  ['dashboard', 'Dashboard', 'M3 3h6v8H3V3Zm8 0h6v5h-6V3ZM3 13h6v4H3v-4Zm8-3h6v7h-6v-7Z'],
  [
    'findings',
    'Findings',
    'M10 2a6 6 0 0 1 3.6 10.8V15H6.4v-2.2A6 6 0 0 1 10 2Zm-2 14.5h4V18H8v-1.5Z',
  ],
];

function Tabs({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  return (
    <nav
      aria-label="Views"
      className="grid grid-cols-3 gap-0.5 rounded-full bg-slate-200/80 p-0.5 dark:bg-slate-800"
    >
      {TABS.map(([key, label, icon]) => (
        <button
          key={key}
          type="button"
          aria-current={tab === key ? 'page' : undefined}
          onClick={() => onTab(key)}
          className={`flex min-h-10 items-center justify-center gap-1.5 rounded-full px-2 text-sm font-medium sm:px-4 ${
            tab === key
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-600 dark:text-white'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
          }`}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className="hidden size-4 fill-current min-[380px]:block"
          >
            <path d={icon} />
          </svg>
          {label}
        </button>
      ))}
    </nav>
  );
}

export default function App() {
  const { data, error } = useData();
  const isDesktop = useIsDesktop();
  const [selected, setSelected] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [colorBy, setColorBy] = useState<ColorBy>('diversity');
  const [tab, setTab] = useState<Tab>('map');
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [guideOpen, setGuideOpen] = useState(false);
  const openGuide = useCallback(() => setGuideOpen(true), []);

  const select = useCallback((id: string) => setSelected(id), []);
  const clear = useCallback(() => setSelected(null), []);
  const block = useMemo<Block | null>(
    () => data?.blocks.find((b) => b.id === selected) ?? null,
    [data, selected],
  );

  if (error) {
    return (
      <div className="flex h-dvh items-center justify-center p-6 text-center">
        <p role="alert">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-dvh items-center justify-center p-6 text-center" role="status">
        <p>Loading Oak Park tree data…</p>
      </div>
    );
  }

  const sidebar = (showHeader: boolean) => (
    <Sidebar
      showHeader={showHeader}
      village={data.village}
      blocks={data.blocks}
      block={block}
      onSelect={select}
      onClear={clear}
      groups={data.vulnerability}
      colorBy={colorBy}
      onColorBy={setColorBy}
      onOpenGuide={openGuide}
    />
  );

  const map = (
    <MapView
      points={data.points}
      blocks={data.blocks}
      parks={data.parks}
      boundary={data.boundary}
      canopyBreaks={data.village.canopyBreaks}
      genusNames={data.names.genera}
      vulnerability={data.vulnerability}
      colorBy={colorBy}
      onColorBy={setColorBy}
      selected={selected}
      onSelect={select}
      onClear={clear}
      keyOpen={isDesktop}
      onOpenGuide={openGuide}
    />
  );

  return (
    <div className="flex h-dvh flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="relative flex shrink-0 items-center justify-between gap-2 px-3 py-1.5">
        <a
          href="https://github.com/oak-park-cisc/Oak_Park_Day_in_our_Data"
          target="_blank"
          rel="noreferrer"
          title="Oak Park Day in Our Data (opens in a new tab)"
          className="flex min-h-11 shrink-0 items-center rounded-xl bg-white px-2 shadow-sm ring-1 ring-slate-200 hover:ring-slate-300 dark:ring-slate-700"
        >
          <img
            src="/day-in-our-data-logo.png"
            alt="Day in Our Data"
            width={640}
            height={205}
            className="h-6 w-auto sm:h-8"
          />
        </a>
        <h1 className="m-0 min-w-0 flex-1 text-base leading-tight font-bold sm:text-lg">
          How resilient is our urban forest?
        </h1>
        {isDesktop && <Tabs tab={tab} onTab={setTab} />}
        <button
          type="button"
          onClick={() => setInfoOpen((o) => !o)}
          aria-expanded={infoOpen}
          aria-controls="about-data"
          aria-label="About this data"
          title="About this data"
          className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-slate-200 dark:hover:bg-slate-800"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5 fill-current">
            <path d="M10 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16Zm0 1.6a6.4 6.4 0 1 0 0 12.8 6.4 6.4 0 0 0 0-12.8ZM9.2 9h1.6v5H9.2V9Zm0-3h1.6v1.6H9.2V6Z" />
          </svg>
        </button>
        {infoOpen && (
          <div
            id="about-data"
            className="absolute top-full right-2 z-[1100] w-[min(22rem,calc(100vw-1rem))] rounded-xl border border-slate-200 bg-white p-3 text-xs leading-relaxed shadow-lg dark:border-slate-700 dark:bg-slate-900"
          >
            <p className="m-0">
              Village of Oak Park public tree inventory. Blocks are hundred-blocks of a street (e.g.
              1200 N Austin Blvd): each tree is assigned to its nearest street centerline. Graded
              with the 10-20-30 rule (no species over 10%, genus over 20%) at block scale; blocks
              under 10 trees are not graded. Park outlines from OpenStreetMap. Social vulnerability
              is the Village's index by census block group; each block takes the group most of its
              trees stand in.
            </p>
            <p className="mt-1.5 mb-0 text-slate-500 dark:text-slate-400">
              No tree condition or age is recorded; trunk diameter, height and spread are size and
              shade proxies only. Canopy is estimated from spread and overlaps are not removed, so
              cover figures are upper bounds; yard trees aren't counted.
            </p>
          </div>
        )}
      </header>
      {!isDesktop && (
        <div className="shrink-0 px-3 pb-2">
          <Tabs tab={tab} onTab={setTab} />
        </div>
      )}

      {tab === 'findings' && (
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <Findings
            data={data}
            onOpenGuide={openGuide}
            onShowMap={(c) => {
              setColorBy(c);
              clear();
              setSheetOpen(false);
              setTab('map');
            }}
            onShowBlock={(id) => {
              setTab('map');
              select(id);
            }}
            onShowDashboard={() => {
              setFilters(NO_FILTERS);
              setTab('dashboard');
            }}
          />
        </main>
      )}

      {tab === 'dashboard' && (
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain pt-1">
          <Dashboard
            data={data}
            filters={filters}
            onFilters={setFilters}
            filtersOpen={isDesktop}
            onOpenGuide={openGuide}
          />
        </main>
      )}

      {/* the map stays mounted while the dashboard shows, keeping zoom and selection */}
      <div className={tab === 'map' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
        {isDesktop ? (
          <main className="grid min-h-0 flex-1 grid-cols-[360px_1fr] gap-2.5 px-3 pb-3">
            <aside
              aria-label="Area statistics"
              className="min-h-0 overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              {sidebar(true)}
            </aside>
            <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm dark:border-slate-800">
              {map}
            </div>
          </main>
        ) : (
          <>
            <main className="relative min-h-0 flex-1">{map}</main>
            <aside
              aria-label="Area statistics"
              className="safe-bottom flex min-h-0 shrink-0 flex-col rounded-t-2xl border-t border-slate-200 bg-white shadow-[0_-4px_16px_rgba(0,0,0,0.08)] dark:border-slate-800 dark:bg-slate-900"
              style={{ maxHeight: sheetOpen ? '62dvh' : undefined }}
            >
              <div className="flex shrink-0 items-center pr-1">
                <button
                  type="button"
                  onClick={() => setSheetOpen((o) => !o)}
                  aria-expanded={sheetOpen}
                  aria-controls="sheet-body"
                  className="flex min-h-14 min-w-0 flex-1 items-center gap-2 pl-3 pr-1 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {block ? block.name : 'Village of Oak Park'}
                    </span>
                    <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                      {block
                        ? `${STATUS_META[block.status].label} · ${block.trees} trees · ${block.species} species`
                        : `${data.village.totalTrees.toLocaleString()} trees · ${data.village.statusCounts.risk} blocks at risk`}
                    </span>
                  </span>
                  <span className="sr-only">{sheetOpen ? 'Hide details' : 'Show details'}</span>
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    className={`size-5 shrink-0 fill-current transition-transform ${sheetOpen ? '' : 'rotate-180'}`}
                  >
                    <path d="M5.3 7.3 10 12l4.7-4.7 1.4 1.4L10 14.8 3.9 8.7l1.4-1.4Z" />
                  </svg>
                </button>
                {block && (
                  <button
                    type="button"
                    onClick={clear}
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
                )}
              </div>
              {sheetOpen && (
                <div
                  id="sheet-body"
                  className="min-h-0 overflow-y-auto overscroll-contain px-3 pb-3"
                >
                  {sidebar(false)}
                </div>
              )}
            </aside>
          </>
        )}
      </div>
      <ClassificationGuide
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        data={data}
        onShowBlock={(id) => {
          setGuideOpen(false);
          setTab('map');
          select(id);
        }}
      />
    </div>
  );
}
