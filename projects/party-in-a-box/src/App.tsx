import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { apiConfigured, residentApi, vendorApi, villageApi, type AiExplainInput, type AiExplainOutput, type ChangeRequestInput, type DateChecks, type LocalDate, type Reason, type ThreadMessages } from './api';
import { DemoBanner } from './DemoBanner';
import { PetitionSign } from './PetitionSign';

type Role = 'resident' | 'vendor' | 'village';
type RecordValue = Record<string, unknown>;
const oakParkCenter: [number, number] = [41.885, -87.785];

function useHashRoute() {
  const [route, setRoute] = useState(() => location.hash.replace(/^#/, '') || '/resident/info');
  useEffect(() => { const update = () => setRoute(location.hash.replace(/^#/, '') || '/resident/info'); addEventListener('hashchange', update); return () => removeEventListener('hashchange', update); }, []);
  return [route, (next: string) => { location.hash = next; }] as const;
}


function useApi<T>(loader: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ loading: boolean; data?: T; error?: string }>({ loading: true });
  const [tick, setTick] = useState(0);
  const quiet = useRef(false);
  useEffect(() => {
    let live = true;
    // A reload() keeps the current data on screen so open inline forms are not unmounted.
    if (!quiet.current) setState({ loading: true });
    quiet.current = false;
    loader().then((data) => live && setState({ loading: false, data })).catch((error: unknown) => live && setState({ loading: false, error: error instanceof Error ? error.message : 'Unable to load this data.' }));
    return () => { live = false; };
  // Callers control fetches through stable scalar dependencies; reload() bumps `tick`.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  const reload = useCallback(() => { quiet.current = true; setTick((value) => value + 1); }, []);
  return { ...state, reload };
}

/** Runs one API action at a time and tracks in-flight, error and success state for inline display. */
function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  async function run<T>(action: () => Promise<T>, success: string | ((value: T) => string) = ''): Promise<{ ok: true; value: T } | { ok: false }> {
    setBusy(true); setError(''); setDone('');
    try {
      const value = await action();
      setDone(typeof success === 'function' ? success(value) : success);
      return { ok: true, value };
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Something went wrong. Try again.');
      return { ok: false };
    } finally { setBusy(false); }
  }
  return { busy, error, done, run, reset: () => { setError(''); setDone(''); } };
}

function asRecord(value: unknown): RecordValue { return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {}; }
function records(value: unknown): RecordValue[] { return Array.isArray(value) ? value.map(asRecord) : []; }
function text(value: unknown, fallback = '—') { return typeof value === 'string' || typeof value === 'number' ? String(value) : fallback; }
function list(value: unknown) { return Array.isArray(value) ? value.map((item) => text(item)).filter((item) => item !== '—') : []; }
function titleCase(value: string) { return value ? value[0].toUpperCase() + value.slice(1) : value; }
function dateText(value: unknown, fallback = '—') { if (typeof value !== 'string') return fallback; const date = new Date(`${value}T12:00:00`); return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date); }

function App() {
  const [route, go] = useHashRoute();
  const role: Role = route.startsWith('/vendor') ? 'vendor' : route.startsWith('/village') ? 'village' : 'resident';
  return <div className="site-shell"><RoleBar role={role} go={go} /><Header role={role} route={route} go={go} /><main>{role === 'resident' ? <Resident route={route} go={go} /> : role === 'vendor' ? <Vendor route={route} go={go} /> : <Village route={route} go={go} />}</main><Footer /></div>;
}

function RoleBar({ role, go }: { role: Role; go: (route: string) => void }) {
  const target = (item: Role) => item === 'resident' ? '/resident/info' : item === 'vendor' ? '/vendor/home' : '/village/requests';
  return <div className="rolebar"><div className="wide"><div className="role-switch" aria-label="Select product view">{(['resident', 'vendor', 'village'] as Role[]).map((item) => <button className={role === item ? 'active' : ''} key={item} onClick={() => go(target(item))}>{titleCase(item)}</button>)}</div></div></div>;
}

function Header({ role, route, go }: { role: Role; route: string; go: (route: string) => void }) {
  const nav: [string, string, boolean][] = role === 'resident' ? [['Info', '/resident/info', false], ['New event', '/resident/new', false], ['My events', '/resident/events', false]] : role === 'vendor' ? [['Home', '/vendor/home', false], ['Matched jobs', '/vendor/matches', false], ['My jobs', '/vendor/jobs', false]] : [['Requests', '/village/requests', false], ['Today', '/village/today', false], ['Visualization', '/village/planner', true]];
  return <header className="main-header"><div className="wide header-inner"><button className="brand" onClick={() => go(nav[0][1])} aria-label="Party in a Box home"><span><b>Party in a Box</b><small>Oak Park block parties</small></span></button><nav aria-label={`${titleCase(role)} navigation`}>{nav.map(([label, target, smart]) => <button className={`${route === target ? 'active' : ''} ${smart ? 'smart-tab' : ''}`} key={target} onClick={() => go(target)}>{smart && <span aria-hidden="true">✦</span>}{label}</button>)}</nav><button className="logout" title="Sign-out is provided by the connected identity service" onClick={() => go('/resident/info')}>Sign out</button></div></header>;
}


function Footer() { return <footer className="wide">Not an official Village of Oak Park product. Rules shown are 2026; confirm 2027 with Public Works.</footer>; }
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) { return <section className={`card ${className}`}>{children}</section>; }
function Button({ children, onClick, variant = 'primary', disabled }: { children: React.ReactNode; onClick?: () => void; variant?: 'primary' | 'secondary' | 'quiet' | 'danger'; disabled?: boolean }) { return <button className={`button ${variant}`} onClick={onClick} disabled={disabled}>{children}</button>; }
function PageIntro({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) { return <div className="page-intro"><div><h1>{title}</h1><p>{text}</p></div>{action}</div>; }
function Status({ value }: { value: unknown }) { const status = typeof value === 'string' ? value.toLowerCase() : 'pending'; return <span className={`badge ${status}`}>{titleCase(status)}</span>; }
function LoadingCard({ label = 'Loading…' }: { label?: string }) { return <Card className="loading-card"><span className="spinner" />{label}</Card>; }
function ApiError({ message }: { message: string }) { return <Card className="api-error"><h2>We couldn’t load this data</h2><p>{message}</p>{!apiConfigured && <p className="muted">Set <code>VITE_API_BASE</code> to the Party in a Box API URL, then reload. No sample records are shown.</p>}</Card>; }

const levelColor: Record<string, string> = { low: '#1E6A4C', medium: '#C27C0E', high: '#A3341B' };
type MapClosure = { key: string; label: string; level: string; score?: string; centroid: [number, number] | null; lines: [number, number][][] };
function toMapClosures(items: RecordValue[], withScore: boolean): MapClosure[] {
  return items.map((item, index) => {
    const score = asRecord(item.score);
    const level = text(withScore ? score.level : item.level, 'low');
    const c = Array.isArray(item.centroid) && item.centroid.length === 2 ? item.centroid as [number, number] : null;
    const lines = Array.isArray(item.lines) ? (item.lines as [number, number][][]).filter((line) => Array.isArray(line) && line.length > 1) : [];
    return { key: `${text(item.block_id, '')}-${index}`, label: text(item.block_label, ''), level, score: withScore ? text(score.score, '') : undefined, centroid: c, lines };
  }).filter((item) => item.centroid || item.lines.length);
}
function FitBounds({ closures }: { closures: MapClosure[] }) {
  const map = useMap();
  const points = closures.flatMap((item) => [...item.lines.flat(), ...(item.centroid ? [item.centroid] : [])]);
  const signature = JSON.stringify(points);
  useEffect(() => {
    const pts = JSON.parse(signature) as [number, number][];
    if (pts.length) map.fitBounds(pts, { padding: [30, 30], maxZoom: 16 });
  }, [map, signature]);
  return null;
}
function RealMap({ block, height = 270, closures }: { block?: RecordValue; height?: number; closures?: MapClosure[] }) {
  const centroid = Array.isArray(block?.centroid) && block?.centroid.length === 2 ? block.centroid as [number, number] : oakParkCenter;
  const lines = Array.isArray(block?.lines) ? block.lines as [number, number][][] : [];
  return <div className="real-map" style={{ height }}><MapContainer center={centroid} zoom={block ? 16 : 14} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />{lines.map((line, index) => <Polyline key={index} positions={line} pathOptions={{ color: '#1b745b', weight: 6 }} />)}{!closures && <CircleMarker center={centroid} radius={8} pathOptions={{ color: '#fff', fillColor: '#1b745b', fillOpacity: 1, weight: 3 }} />}{closures && <FitBounds closures={closures} />}{closures?.map((item) => { const color = levelColor[item.level] ?? levelColor.low; return <Fragment key={item.key}>{item.lines.map((line, index) => <Polyline key={index} positions={line} pathOptions={{ color, weight: 6 }} />)}{item.centroid && <CircleMarker center={item.centroid} radius={8} pathOptions={{ color: '#fff', fillColor: color, fillOpacity: 1, weight: 3 }}><Tooltip>{item.label} · {item.level}{item.score !== undefined ? ` ${item.score}` : ''}</Tooltip></CircleMarker>}</Fragment>; })}</MapContainer></div>;
}


function num(value: unknown, fallback = 0) { const parsed = Number(value); return value === null || value === undefined || value === '' || Number.isNaN(parsed) ? fallback : parsed; }
function reasonsOf(value: unknown): Reason[] { return records(value).map((item) => ({ pts: num(item.pts), text: text(item.text, '') })); }
function ActionNote({ error, done }: { error?: string; done?: string }) { return <>{error && <p className="action-error" role="alert">{error}</p>}{done && <p className="success-text" role="status">{done}</p>}</>; }
function ReasonList({ reasons }: { reasons: Reason[] }) { return reasons.length ? <ul className="score-list">{reasons.map((reason, index) => <li key={index}><b>{reason.pts > 0 ? `+${reason.pts}` : reason.pts}</b> {reason.text}</li>)}</ul> : <p className="muted">No score reasons.</p>; }
function when(value: unknown) { if (typeof value !== 'string') return '—'; const date = new Date(value); return Number.isNaN(date.valueOf()) ? value : date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }

type MessageLoader = (threadId: string) => Promise<ThreadMessages>;
type MessageSender = (threadId: string, body: string) => Promise<unknown>;
function ThreadPanel({ threadId, load, send }: { threadId: string; load: MessageLoader; send: MessageSender }) {
  const thread = useApi(() => load(threadId), [threadId]);
  const [body, setBody] = useState('');
  const action = useAction();
  const messages = thread.data?.messages ?? [];
  const submit = async () => { const result = await action.run(() => send(threadId, body.trim()), 'Message sent.'); if (result.ok) { setBody(''); thread.reload(); } };
  return <div className="thread-panel">
    {thread.loading ? <p className="muted">Loading messages…</p> : thread.error ? <p className="action-error" role="alert">{thread.error}</p> : messages.length ? <ul className="messages">{messages.map((message) => <li key={text(message.id)}><b>{text(message.author_display_name, titleCase(text(message.author_role, '')))}</b> <small>{when(message.created_at)}</small><p>{text(message.body, '')}</p></li>)}</ul> : <p className="muted">No messages yet.</p>}
    <label>Message<textarea value={body} maxLength={2000} onChange={(event) => setBody(event.target.value)} placeholder="Write a message" /></label>
    <div className="button-row"><Button onClick={submit} disabled={action.busy || !body.trim()}>{action.busy ? 'Sending…' : 'Send message'}</Button></div>
    <ActionNote error={action.error} done={action.done} />
  </div>;
}

function Resident({ route, go }: { route: string; go: (route: string) => void }) { if (route.startsWith('/petition/')) return <PetitionSign token={decodeURIComponent(route.slice('/petition/'.length).split(/[/?]/)[0])} />; if (route === '/resident/new') return <NewEvent go={go} />; if (route.startsWith('/resident/petition/')) return <Petition id={route.split('/').pop()!} go={go} />; if (route === '/resident/events') return <MyEvents go={go} />; return <ResidentInfo go={go} />; }

function ResidentInfo({ go }: { go: (route: string) => void }) {
  const rules = useApi(() => residentApi.getRules(2027), []);
  const ruleRows = rules.data ? list(asRecord(rules.data).checklist) : [];
  return <div className="wide resident-info"><PageIntro title="How Party in a Box works" text="Plan an Oak Park block party in one place: check your block, gather neighbor signatures, and follow its status." action={<Button onClick={() => go('/resident/new')}>Start a new event</Button>} /><h2>Using the site</h2><div className="steps-card">{[['1','Check your block','Find out whether your street can close.'],['2','Pick dates','See what is due and when.'],['3','Share petition','Gather signatures from neighbors.'],['4','Submit and track','Follow Public Works review.'],['5','Party day','Review approved arrangements.']].map(([number, heading, detail]) => <div className="how-step" key={number}><span>{number}</span><h3>{heading}</h3><p>{detail}</p></div>)}</div><div className="info-grid"><Card><div className="section-heading"><h2>Block party rules</h2><small>Rules are supplied by Public Works</small></div>{rules.loading ? <LoadingCard label="Loading current rules…" /> : rules.error ? <ApiError message={rules.error} /> : <div className="rules-grid">{ruleRows.map((rule) => <div key={rule}><b>Requirement</b><p>{rule}</p></div>)}</div>}</Card><Card className="resources"><h2>Permit resources</h2><a href="https://www.oak-park.us/Community/Events-and-Activities/Block-Parties-and-Sales" target="_blank">Block parties page</a><p>Rules and forms from the Village.</p><b>Public Works</b><a href="mailto:publicworks@oak-park.us">publicworks@oak-park.us</a><a href="tel:+17083585700">708.358.5700</a></Card></div><Card className="faq"><h2>Frequently asked questions</h2>{['Is this the official Village application?','Why can’t my street be closed?','When is my petition due?','How do vendors work?'].map((question, index) => <details key={question} open={index === 0}><summary>{question}</summary><p>{index === 0 ? 'No. Party in a Box was built at the Day in Our Data hackathon and is not run by the Village of Oak Park. Requests here use fictional sample data.' : 'The latest answer is determined by the rules and request data returned by Public Works.'}</p></details>)}</Card></div>;
}

function NewEvent({ go }: { go: (route: string) => void }) {
  const [address, setAddress] = useState('1100 S Cuyler Ave');
  const [block, setBlock] = useState<RecordValue>();
  const [start, setStart] = useState('2027-06-12');
  const [end, setEnd] = useState('2027-06-26');
  const [guests, setGuests] = useState('120');
  const [barricades, setBarricades] = useState(true);
  const [greenKit, setGreenKit] = useState(true);
  const [checks, setChecks] = useState<DateChecks>();
  const [checksError, setChecksError] = useState('');
  const [createdId, setCreatedId] = useState('');
  const lookup = useAction();
  const save = useAction();
  const blockId = block?.eligible === true ? text(block.id, '') : '';

  const check = async (label: string) => {
    setAddress(label); setBlock(undefined); setChecks(undefined);
    const result = await lookup.run(async () => asRecord(await residentApi.lookupBlock(label)));
    if (result.ok) setBlock(asRecord(result.value.block));
  };

  // Re-run the date checks whenever the block or dates change.
  useEffect(() => {
    setChecksError('');
    if (!blockId || !start || !end) { setChecks(undefined); return; }
    let live = true;
    residentApi.dateChecks({ block_id: blockId, date_start: start as LocalDate, date_end: end as LocalDate })
      .then((result) => { if (live) setChecks(result); })
      .catch((reason: unknown) => { if (live) { setChecks(undefined); setChecksError(reason instanceof Error ? reason.message : 'Unable to check these dates.'); } });
    return () => { live = false; };
  }, [blockId, start, end]);
  // Editing the form after a partial save means a new request is needed.
  useEffect(() => { setCreatedId(''); }, [blockId, start, end, guests, barricades, greenKit]);

  const saveAll = async () => {
    if (!blockId) return;
    const result = await save.run(async () => {
      let id = createdId;
      if (!id) {
        const created = asRecord(await residentApi.createRequest({ block_id: blockId, date_start: start as LocalDate, date_end: end as LocalDate, guests: Number(guests), services: { barricades, green_kit: greenKit } }));
        id = text(created.id, '');
        if (!id) throw new Error('The service did not return a request id.');
        setCreatedId(id);
      }
      await residentApi.beginPetition(id);
      return id;
    });
    if (result.ok) go(`/resident/petition/${result.value}`);
  };
  const year = start.slice(0, 4) || '2027';
  const seasonBad = Boolean(checks && !checks.season.ok);
  return <div className="wide new-event"><DemoBanner /><PageIntro title="Plan a new block party" text="Check your block, pick your dates, and see what is due when." /><EventStepper current={1} /><div className="new-grid"><div><h2>1. Check your block</h2><Card><div className="field-row"><label>Street address in Oak Park<input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="1100 S Cuyler Ave" /></label><Button onClick={() => void check(address)} disabled={!address.trim() || lookup.busy}>{lookup.busy ? 'Checking…' : 'Check block'}</Button></div><RealMap block={block} height={240} />{lookup.error && <ApiError message={lookup.error} />}{block && <BlockPacket block={block} onPick={(label) => void check(label)} busy={lookup.busy} />}</Card></div><aside><Card><h2>Village rules checklist</h2><ul className="checklist"><li>Street must be eligible for a closure.</li><li>Petition requires separate addresses.</li><li>Petition must be submitted in time.</li><li>Dates must fall within the current season.</li></ul></Card></aside></div>{block?.eligible === true && <div className="form-area"><h2>2. Pick dates and services</h2><Card><div className="form-grid"><label>Earliest date<input type="date" value={start} onChange={(event) => setStart(event.target.value)} /></label><label>Latest date<input type="date" value={end} onChange={(event) => setEnd(event.target.value)} /></label><label>Expected guests<input type="number" min="1" value={guests} onChange={(event) => setGuests(event.target.value)} /></label></div>{checksError && <p className="action-error" role="alert">{checksError}</p>}{checks && <div className="checks" aria-live="polite"><p>Petition due: <b>{dateText(checks.petition_due)}</b>{checks.due_passed && <span className="issue"> (this date has passed)</span>}</p>{checks.season.ok ? <p>Dates fall inside the party season.</p> : checks.season.problems.map((problem) => <p className="issue" key={problem}>{problem}</p>)}<p>Events on this block in {year}: {checks.block_year_count} of {checks.max_per_block_per_year}</p></div>}<fieldset><legend>Services</legend><label className="service-check"><input type="checkbox" checked={barricades} onChange={(event) => setBarricades(event.target.checked)} /><span><b>Barricades</b><small>Delivery timing is confirmed by Public Works.</small></span></label><label className="service-check"><input type="checkbox" checked={greenKit} onChange={(event) => setGreenKit(event.target.checked)} /><span><b>Green Block Party kit</b><small>Recycling and compost setup.</small></span></label></fieldset><ActionNote error={save.error} /><div className="button-row"><Button onClick={saveAll} disabled={save.busy || !start || !end || !(Number(guests) > 0) || seasonBad}>{save.busy ? 'Saving…' : 'Save and set up petition'}</Button></div></Card></div>}</div>;
}

function EventStepper({ current }: { current: number }) { return <ol className="event-stepper">{[['Fill in permit','Block, dates, services'],['Set up petition','Share a link, addresses'],['Submit permit','Sent to Public Works'],['Permit status','Track the review'],['Approved','Date and arrangements'],['Vendor matches','Automatic once approved']].map(([name, detail], index) => <li className={index + 1 === current ? 'current' : ''} key={name}><span>{index + 1}</span><b>{name}</b><small>{detail}</small></li>)}</ol>; }
function BlockPacket({ block, onPick, busy }: { block: RecordValue; onPick: (label: string) => void; busy: boolean }) {
  const eligible = block.eligible === true;
  const nearest = asRecord(block.nearest_eligible);
  const nearestLabel = text(nearest.label, '');
  return <div className={`block-result ${eligible ? 'eligible' : 'ineligible'}`}><b>{eligible ? `Eligible: ${text(block.label, text(block.name))}` : 'This block is not eligible'}</b><p>{text(block.reason, eligible ? 'This block is available for a party closure.' : 'Public Works has marked this block ineligible.')}</p>{nearestLabel && <p>Nearest eligible block: <button className="link-button" disabled={busy} onClick={() => onPick(nearestLabel)}>{nearestLabel}{nearest.meters !== undefined ? ` (${text(nearest.meters)} m away)` : ''}</button></p>}</div>;
}

function Petition({ id, go }: { id: string; go: (route: string) => void }) {
  const requestState = useApi(() => residentApi.getRequest(id), [id]);
  const sigState = useApi(() => residentApi.signatures(id), [id]);
  const submit = useAction();
  const sample = useAction();
  const [copied, setCopied] = useState('');
  const linkRef = useRef<HTMLInputElement>(null);
  const requestData = asRecord(requestState.data);
  const sigData = asRecord(sigState.data);
  const rows = records(sigData.signatures);
  const needed = num(sigData.needed, num(requestData.needed, 10));
  const distinct = num(sigData.distinct_count, num(requestData.distinct_count, 0));
  const url = text(requestData.petition_url, '');
  const token = url.split('?')[0].split('/').filter(Boolean).pop() ?? '';
  const blockBase = parseInt(text(requestData.block_id, '').split('|')[1] ?? text(requestData.block_label, ''), 10);
  const status = text(requestData.status, '');
  const editable = status === 'draft' || status === 'collecting';
  const copy = async () => {
    try {
      if (!navigator.clipboard) throw new Error('no clipboard');
      await navigator.clipboard.writeText(url);
      setCopied('Copied');
    } catch {
      const field = linkRef.current;
      field?.focus(); field?.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      setCopied(ok ? 'Copied' : 'Link selected. Press Ctrl+C (Cmd+C on Mac) to copy.');
    }
  };
  const addSample = async () => {
    const used = new Set(rows.map((row) => parseInt(text(row.address, ''), 10)));
    let house = Number.isNaN(blockBase) ? 1100 : blockBase;
    while (used.has(house)) house += 1;
    await sample.run(async () => {
      const result = await residentApi.signPetition(token, { name: `Sample Neighbor ${rows.length + 1}`, house_number: String(house), consent: true, captcha: 'demo' });
      sigState.reload(); requestState.reload();
      return result;
    }, (result) => result.state === 'counted' ? `Added house ${house}: counted (${result.distinct_count} of ${result.needed}).` : `Added house ${house}: ${result.state.replace('_', ' ')}.`);
  };
  const doSubmit = async () => { const result = await submit.run(() => residentApi.submitRequest(id)); if (result.ok) go('/resident/events'); };
  const ready = distinct >= needed;
  return <div className="wide petition"><DemoBanner /><PageIntro title="Get your neighbors’ signatures" text="Share your petition link with neighbors and track how many separate addresses have signed." /><EventStepper current={2} />{requestState.loading ? <LoadingCard label="Loading petition…" /> : requestState.error ? <ApiError message={requestState.error} /> : <Card><h2>{text(requestData.block_label, text(asRecord(requestData.block).label, 'Block party request'))}</h2><p>{dateText(requestData.date_start)} – {dateText(requestData.date_end)} · Petition due {dateText(requestData.petition_due)}</p><div className="petition-progress"><strong>{distinct} <small>of {needed} addresses</small></strong><span>Signatures are private. The organizer can only see records returned by the backend.</span></div>{url ? <div className="copy-field"><label>Petition link<input ref={linkRef} readOnly value={url} onFocus={(event) => event.target.select()} /></label><Button variant="secondary" onClick={copy}>Copy petition link</Button>{copied && <span className="success-text" role="status">{copied}</span>}</div> : <p className="muted">The petition has not been started for this request.</p>}{sigState.error ? <ApiError message={sigState.error} /> : <table className="signers"><thead><tr><th>Name</th><th>Address</th><th>Signed</th><th>Counts</th></tr></thead><tbody>{rows.length ? rows.map((row) => <tr key={text(row.id)}><td>{text(row.name)}</td><td>{text(row.address)}</td><td>{when(row.signed_at)}</td><td>{row.counts === true ? 'Yes' : `No (${text(row.state, '').replace('_', ' ')})`}</td></tr>) : <tr><td colSpan={4}>{sigState.loading ? 'Loading signatures…' : 'No signatures yet.'}</td></tr>}</tbody></table>}<div className="button-row"><Button variant="secondary" onClick={addSample} disabled={sample.busy || !token || !editable}>{sample.busy ? 'Adding…' : 'Add sample neighbor'}</Button><Button onClick={doSubmit} disabled={submit.busy || !ready || !editable}>{submit.busy ? 'Submitting…' : 'Submit permit request'}</Button></div>{!ready && editable && <p className="muted">Submit unlocks at {needed} distinct addresses ({distinct} so far).</p>}{!editable && <p className="muted">This request is {status || 'not open'} and can no longer be edited.</p>}<ActionNote error={sample.error} done={sample.done} /><ActionNote error={submit.error} /></Card>}</div>;
}

function MyEvents({ go }: { go: (route: string) => void }) {
  const state = useApi(() => residentApi.myRequests(), []); const items = records(state.data);
  return <div className="wide my-events"><PageIntro title="My events" text="Requests and approval statuses are loaded from the Party in a Box service." action={<Button onClick={() => go('/resident/new')}>New event</Button>} />{state.loading ? <LoadingCard label="Loading your events…" /> : state.error ? <ApiError message={state.error} /> : items.length ? items.map((item) => <EventCard item={item} key={text(item.id)} go={go} reload={state.reload} />) : <Card><h2>No events yet</h2><p>Start a new request to see it here.</p></Card>}</div>;
}
function EventCard({ item, go, reload }: { item: RecordValue; go: (route: string) => void; reload: () => void }) {
  const id = text(item.id, '');
  const status = text(item.status, '');
  const open = asRecord(item.open_change_request);
  const hasOpen = text(open.status, '') === 'open';
  const [mode, setMode] = useState<'' | 'reschedule' | 'cancel'>('');
  const [newStart, setNewStart] = useState(text(item.approved_date ?? item.date_start, ''));
  const [newEnd, setNewEnd] = useState(text(item.approved_date ?? item.date_end, ''));
  const [message, setMessage] = useState('');
  const change = useAction();
  const withdraw = useAction();
  const live = !['rejected', 'withdrawn', 'cancelled', 'completed'].includes(status);
  const canWithdraw = ['draft', 'collecting', 'submitted'].includes(status);
  const fileChange = async () => {
    const body: ChangeRequestInput = mode === 'reschedule'
      ? { type: 'reschedule', proposed_start: newStart as LocalDate, proposed_end: newEnd as LocalDate, message: message.trim() }
      : { type: 'cancel', message: message.trim() };
    const result = await change.run(() => residentApi.changeRequest(id, body), 'Request sent to Public Works.');
    if (result.ok) { setMode(''); setMessage(''); reload(); }
  };
  const doWithdraw = async () => { const result = await withdraw.run(() => residentApi.withdrawRequest(id), 'Request withdrawn.'); if (result.ok) reload(); };
  const toggle = (next: 'reschedule' | 'cancel') => { change.reset(); setMode(mode === next ? '' : next); };
  return <Card className="event-card"><small>BLOCK PARTY · REQUEST {id.toUpperCase()}</small><div className="card-title"><h2>{text(item.block_label, text(asRecord(item.block).label, 'Oak Park block'))}</h2><Status value={item.status} /></div><EventStepper current={item.status === 'approved' ? 5 : 3} /><div className="event-detail-grid"><div><h3>Your date</h3><p>{dateText(item.approved_date ?? item.date_start)} · 9 a.m. – 11 p.m.</p><dl><div><dt>Barricades arrive</dt><dd>{dateText(item.barricade_date, 'Pending approval')}</dd></div><div><dt>Green Block Party kit</dt><dd>{asRecord(item.services).green_kit ? 'Requested' : 'Not requested'}</dd></div></dl></div><div><h3>Matched vendors</h3>{records(item.vendors).length ? records(item.vendors).map((vendor) => <div className="vendor-line" key={text(vendor.id, text(vendor.name))}><b>{text(vendor.name)}</b><span>{text(vendor.service)} · {text(vendor.includes)}</span><Status value={vendor.state} /></div>) : <p className="muted">Vendor matches appear after approval.</p>}</div></div>
    {hasOpen && <div className="change-note"><b>Open {text(open.type)} request</b>{open.type === 'reschedule' && <span> · {dateText(open.proposed_start)} – {dateText(open.proposed_end)}</span>}<p>{text(open.message, '')}</p></div>}
    <div className="button-row card-actions">{(status === 'draft' || status === 'collecting') && <Button variant="secondary" onClick={() => go(`/resident/petition/${id}`)}>Open petition</Button>}{status === 'approved' && <Button variant="secondary" disabled={hasOpen || change.busy} onClick={() => toggle('reschedule')}>Request to reschedule</Button>}{status === 'approved' && <Button variant="secondary" disabled={hasOpen || change.busy} onClick={() => toggle('cancel')}>Request to cancel</Button>}{canWithdraw && <Button variant="danger" disabled={withdraw.busy} onClick={doWithdraw}>{withdraw.busy ? 'Withdrawing…' : 'Withdraw'}</Button>}</div>
    {mode && <div className="inline-form">{mode === 'reschedule' && <div className="form-grid"><label>New start<input type="date" value={newStart} onChange={(event) => setNewStart(event.target.value)} /></label><label>New end<input type="date" value={newEnd} onChange={(event) => setNewEnd(event.target.value)} /></label></div>}<label>{mode === 'reschedule' ? 'Message to Public Works' : 'Why are you cancelling?'}<textarea value={message} maxLength={1000} onChange={(event) => setMessage(event.target.value)} /></label><div className="button-row"><Button variant="quiet" onClick={() => setMode('')}>Never mind</Button><Button onClick={fileChange} disabled={change.busy || !message.trim() || (mode === 'reschedule' && (!newStart || !newEnd))}>{change.busy ? 'Sending…' : mode === 'reschedule' ? 'Send reschedule request' : 'Send cancel request'}</Button></div></div>}
    <ActionNote error={change.error} done={change.done} /><ActionNote error={withdraw.error} done={withdraw.done} />
  </Card>;
}

function Vendor({ route, go }: { route: string; go: (route: string) => void }) { if (route === '/vendor/matches') return <VendorMatches />; if (route === '/vendor/jobs') return <VendorJobs />; return <VendorHome go={go} />; }

const serviceOptions: [string, string][] = [['ice_cream', 'Ice cream'], ['food_truck', 'Food truck'], ['bounce_house', 'Bounce house'], ['face_painting', 'Face painting'], ['music_dj', 'Music / DJ'], ['other', 'Other']];
const dayOptions: [string, string][] = [['weekday', 'Weekdays'], ['saturday', 'Saturdays'], ['sunday', 'Sundays']];
const zipOptions = ['60301', '60302', '60304'];
function toggled(items: string[], item: string, on: boolean) { return on ? [...items.filter((value) => value !== item), item] : items.filter((value) => value !== item); }

function VendorHome({ go }: { go: (route: string) => void }) {
  const me = useApi(() => vendorApi.me(), []);
  const offer = useApi(() => vendorApi.offer(), []);
  const summary = useApi(() => vendorApi.summary(), []);
  const account = asRecord(me.data);
  return <div className="wide vendor-home"><DemoBanner /><PageIntro title="Your offer" text="Set up the standing offer Public Works uses for matching." />{me.loading || offer.loading ? <LoadingCard label="Loading vendor account…" /> : me.error || offer.error ? <ApiError message={me.error ?? offer.error ?? 'Unable to load the vendor account.'} /> : <><Status value={account.status} /><OfferForm offer={asRecord(offer.data)} onSaved={() => { offer.reload(); summary.reload(); }} /><Card className="matching-explainer"><h2>How matching works</h2><ol><li>Public Works approves a block party.</li><li>Matching checks your service, availability, area, and capacity.</li><li>You choose whether to accept the job.</li></ol>{summary.loading ? <LoadingCard label="Loading counts…" /> : summary.error ? <ApiError message={summary.error} /> : <div className="right-now"><span>Right now</span><button onClick={() => go('/vendor/matches')}>{text(asRecord(summary.data).matched_open, '0')} matched jobs</button><button onClick={() => go('/vendor/jobs')}>{text(asRecord(summary.data).accepted, '0')} accepted jobs</button></div>}</Card></>}</div>;
}

function OfferForm({ offer, onSaved }: { offer: RecordValue; onSaved: () => void }) {
  const [service, setService] = useState(text(offer.service, 'ice_cream'));
  const [price, setPrice] = useState(text(offer.price_usd, ''));
  const [maxGuests, setMaxGuests] = useState(text(offer.max_guests, ''));
  const [jobsPerDay, setJobsPerDay] = useState(text(offer.jobs_per_day, ''));
  const [includes, setIncludes] = useState(text(offer.includes, ''));
  const [days, setDays] = useState(list(offer.days));
  const [zips, setZips] = useState(list(offer.zips));
  const [active, setActive] = useState(offer.active !== false);
  const action = useAction();
  const valid = price !== '' && Number(price) >= 0 && Number(maxGuests) >= 1 && Number(jobsPerDay) >= 1 && includes.length <= 300 && days.length > 0 && zips.length > 0;
  const save = async () => {
    const result = await action.run(() => vendorApi.saveOffer({ service, price_usd: Math.round(Number(price)), max_guests: Math.round(Number(maxGuests)), jobs_per_day: Math.round(Number(jobsPerDay)), includes, days, zips, active }), 'Offer saved. Matches were refreshed.');
    if (result.ok) onSaved();
  };
  return <Card><div className="form-grid vendor-form"><label>Service<select value={service} onChange={(event) => setService(event.target.value)}>{serviceOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Price per event $<input type="number" min="0" value={price} onChange={(event) => setPrice(event.target.value)} /></label><label>Most guests you can serve<input type="number" min="1" value={maxGuests} onChange={(event) => setMaxGuests(event.target.value)} /></label><label>Jobs per day<input type="number" min="1" value={jobsPerDay} onChange={(event) => setJobsPerDay(event.target.value)} /></label><label className="full">What’s included<textarea value={includes} maxLength={300} onChange={(event) => setIncludes(event.target.value)} /><small className="muted">{includes.length} of 300 characters</small></label></div><fieldset><legend>Days you work</legend>{dayOptions.map(([value, label]) => <label className="inline-check" key={value}><input type="checkbox" checked={days.includes(value)} onChange={(event) => setDays(toggled(days, value, event.target.checked))} />{label}</label>)}</fieldset><fieldset><legend>Zip codes you serve</legend>{zipOptions.map((zip) => <label className="inline-check" key={zip}><input type="checkbox" checked={zips.includes(zip)} onChange={(event) => setZips(toggled(zips, zip, event.target.checked))} />{zip}</label>)}</fieldset><label className="inline-check"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />Accepting new matches</label><div className="button-row"><Button onClick={save} disabled={action.busy || !valid}>{action.busy ? 'Saving…' : 'Save offer'}</Button></div><ActionNote error={action.error} done={action.done} /></Card>;
}

function MatchCard({ job, decision, onDecided, onUndone }: { job: RecordValue; decision?: 'accepted' | 'declined'; onDecided: (job: RecordValue, decision: 'accepted' | 'declined') => void; onUndone: (id: string) => void }) {
  const id = text(job.match_id, '');
  const action = useAction();
  const decide = async (kind: 'accepted' | 'declined') => {
    const result = await action.run(() => kind === 'accepted' ? vendorApi.accept(id) : vendorApi.decline(id), kind === 'accepted' ? 'Job accepted. It now appears under My jobs.' : 'Job declined.');
    if (result.ok) onDecided(job, kind);
  };
  const undo = async () => { const result = await action.run(() => vendorApi.undo(id), 'Decision undone. The job is back in your matches.'); if (result.ok) onUndone(id); };
  return <Card className="job-card"><h2>{text(job.block_label)} {typeof job.zip === 'string' && job.zip ? <small>({job.zip})</small> : null}</h2><p>{dateText(job.date)} · {text(job.hours)}</p><dl><div><dt>Guests expected</dt><dd>{text(job.guests)}</dd></div><div><dt>Your price</dt><dd>${text(job.price_usd, text(job.price))}</dd></div></dl><p className="match-reason">{list(job.why).join(' · ')}</p>{job.needs_reconfirm === true && <p className="muted">The date changed. Please confirm again.</p>}{decision ? <div className="button-row card-actions"><Status value={decision} /><Button variant="secondary" onClick={undo} disabled={action.busy}>{action.busy ? 'Working…' : 'Undo'}</Button></div> : <div className="button-row card-actions"><Button onClick={() => decide('accepted')} disabled={action.busy}>{action.busy ? 'Working…' : 'Accept job'}</Button><Button variant="secondary" onClick={() => decide('declined')} disabled={action.busy}>Decline</Button></div>}<ActionNote error={action.error} done={action.done} /></Card>;
}

function VendorMatches() {
  const state = useApi(() => vendorApi.matches(), []);
  const [decided, setDecided] = useState<Record<string, { job: RecordValue; decision: 'accepted' | 'declined' }>>({});
  const loaded = records(state.data).filter((job) => !(text(job.match_id, '') in decided));
  const shown = [...loaded.map((job) => ({ job, decision: undefined as 'accepted' | 'declined' | undefined })), ...Object.values(decided)].sort((a, b) => text(a.job.date, '').localeCompare(text(b.job.date, '')));
  const onDecided = (job: RecordValue, decision: 'accepted' | 'declined') => { setDecided((current) => ({ ...current, [text(job.match_id, '')]: { job, decision } })); state.reload(); };
  const onUndone = (id: string) => { setDecided((current) => { const next = { ...current }; delete next[id]; return next; }); state.reload(); };
  return <div className="wide jobs"><PageIntro title="Matched jobs" text="Approved block parties that fit your offer. You decide which ones to take." />{state.loading ? <LoadingCard /> : state.error ? <ApiError message={state.error} /> : shown.length ? shown.map(({ job, decision }) => <MatchCard key={text(job.match_id)} job={job} decision={decision} onDecided={onDecided} onUndone={onUndone} />) : <Card><h2>All caught up</h2><p>There are no matching jobs at the moment.</p></Card>}</div>;
}

function JobCard({ job, onWithdrawn }: { job: RecordValue; onWithdrawn: (label: string) => void }) {
  const id = text(job.match_id, '');
  const threadId = text(job.thread_id, '');
  const [panel, setPanel] = useState<'' | 'message' | 'withdraw'>('');
  const [reason, setReason] = useState('');
  const action = useAction();
  const withdraw = async () => { const result = await action.run(() => vendorApi.withdrawJob(id, reason.trim())); if (result.ok) onWithdrawn(text(job.block_label, 'the job')); };
  const open = (next: 'message' | 'withdraw') => { action.reset(); setPanel(panel === next ? '' : next); };
  return <Card className="accepted-job"><div className="calendar-tile"><b>{text(job.event_date).slice(5,7)}</b><strong>{text(job.event_date).slice(8,10)}</strong></div><div><h2>{text(job.block_label)}</h2><p>{dateText(job.event_date)} · {text(job.hours)} · {text(job.guests)} guests{job.organizer_display_name ? ` · Organizer ${text(job.organizer_display_name)}` : ''}</p>{job.reminder ? <p className="muted">{text(job.reminder)}</p> : null}<div className="button-row card-actions"><Button variant="secondary" disabled={!threadId} onClick={() => open('message')}>Message organizer</Button><Button variant="danger" onClick={() => open('withdraw')}>Withdraw</Button></div>{panel === 'message' && threadId && <ThreadPanel threadId={threadId} load={vendorApi.messages} send={vendorApi.sendMessage} />}{panel === 'withdraw' && <div className="inline-form"><label>Why are you withdrawing? The organizer will see this.<textarea value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} /></label><div className="button-row"><Button variant="quiet" onClick={() => setPanel('')}>Never mind</Button><Button variant="danger" onClick={withdraw} disabled={action.busy || !reason.trim()}>{action.busy ? 'Withdrawing…' : 'Confirm withdraw'}</Button></div></div>}<ActionNote error={action.error} /></div></Card>;
}

function VendorJobs() {
  const state = useApi(() => vendorApi.jobs(), []); const jobs = records(state.data);
  const [notice, setNotice] = useState('');
  return <div className="wide jobs"><PageIntro title="My jobs" text="Jobs you accepted. The organizer can see that you are coming." />{notice && <p className="success-text" role="status">{notice}</p>}{state.loading ? <LoadingCard /> : state.error ? <ApiError message={state.error} /> : jobs.length ? jobs.map((job) => <JobCard key={text(job.match_id)} job={job} onWithdrawn={(label) => { setNotice(`You withdrew from ${label}. The organizer was notified.`); state.reload(); }} />) : <Card><h2>No accepted jobs yet</h2></Card>}</div>;
}

function Village({ route }: { route: string; go: (route: string) => void }) { if (route === '/village/today') return <Today />; if (route === '/village/planner') return <Planner />; return <VillageRequests />; }

const statusChips: [string, string, string][] = [['All', '', 'all'], ['Needs review', 'submitted', 'needs_review'], ['Approved', 'approved', 'approved'], ['Rejected', 'rejected', 'rejected']];
function VillageRequests() {
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState('');
  const state = useApi(() => villageApi.requests(status), [status]);
  const payload = asRecord(state.data);
  const queue = records(payload.requests);
  const facets = asRecord(payload.facets);
  return <div className="wide requests"><PageIntro title="Block party requests" text="Requests are shown oldest first; approvals remain first come, first served." /><div className="filter-row" role="group" aria-label="Filter by status">{statusChips.map(([label, value, facet]) => <button key={label} className={status === value ? 'active' : ''} onClick={() => setStatus(value)}>{label}{facets[facet] !== undefined ? ` (${text(facets[facet])})` : ''}</button>)}</div><div className="request-grid"><div className="request-list">{state.loading ? <LoadingCard label="Loading request queue…" /> : state.error ? <ApiError message={state.error} /> : queue.length ? queue.map((item) => <button key={text(item.id)} className={selected === text(item.id) ? 'selected' : ''} aria-pressed={selected === text(item.id)} onClick={() => setSelected(text(item.id))}><div><b>{text(item.block_label)}</b><Status value={item.status} /></div><span>{dateText(item.date_start)} – {dateText(item.date_end)}</span><small>Petition {text(item.distinct_count)}/{text(item.needed, '10')} · Impact: {text(item.level)}</small></button>) : <Card><p>No requests with this status.</p></Card>}</div>{selected ? <RequestDetail key={selected} id={selected} onChanged={state.reload} /> : <Card className="request-detail"><h2>Select a request</h2><p>Request details, approval gates, candidate dates, and messages are loaded after selecting an item from the queue.</p></Card>}</div></div>;
}

function RequestDetail({ id, onChanged }: { id: string; onChanged: () => void }) {
  const detail = useApi(() => villageApi.request(id), [id]);
  const [picked, setPicked] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [messages, setMessages] = useState(false);
  const decision = useAction();
  if (detail.loading) return <LoadingCard label="Loading request…" />;
  if (detail.error) return <ApiError message={detail.error} />;
  const d = asRecord(detail.data);
  const candidates = records(d.candidates);
  const chosen = picked || text(candidates[0]?.date, '');
  const chosenCandidate = candidates.find((candidate) => text(candidate.date, '') === chosen);
  const gate = asRecord(chosenCandidate?.can_approve);
  const canApprove = gate.ok === true;
  const status = text(d.status, '');
  const threadId = text(d.thread_id, '');
  const changes = records(d.change_requests);
  const after = () => { detail.reload(); onChanged(); };
  const approve = async () => { const result = await decision.run(() => villageApi.approve(id, chosen, text(d.version, '1')), `Approved for ${dateText(chosen)}.`); if (result.ok) after(); };
  const reject = async () => { const result = await decision.run(() => villageApi.reject(id, reason.trim()), 'Request rejected.'); if (result.ok) { setRejecting(false); setReason(''); after(); } };
  return <Card className="request-detail"><small>REQUEST {id.toUpperCase()}</small><div className="card-title"><h2>{text(d.block_label)}</h2><Status value={status} /></div><p>{dateText(d.date_start)} – {dateText(d.date_end)} · {text(d.guests)} guests · Organizer {text(d.organizer_display_name)}</p>{d.approved_date ? <p>Approved date: <b>{dateText(d.approved_date)}</b></p> : null}
    <div className="detail-stats"><span>Petition {text(d.distinct_count)}/{text(d.needed, '10')} addresses</span><span>Version {text(d.version)}</span><span>Submitted {when(d.submitted_at)}</span></div>
    {status === 'submitted' && chosenCandidate && canApprove && <p className="success-text">Ready to approve {dateText(chosen)}: all gates pass.</p>}
    <h3>Candidate dates</h3>
    <div className="chip-row">{candidates.map((candidate) => { const score = asRecord(candidate.score); const date = text(candidate.date, ''); const blocked = asRecord(candidate.can_approve).ok !== true; const why = list(asRecord(candidate.can_approve).reasons)[0]; return <button key={date} className={`chip ${chosen === date ? 'active' : ''}${blocked ? ' blocked' : ''}`} title={blocked ? `Blocked: ${why ?? 'cannot be approved'}` : undefined} aria-pressed={chosen === date} onClick={() => setPicked(date)}><b>{dateText(date)}</b><small>Weekend {text(candidate.weekend_approved)}/{text(candidate.cap)} · {text(score.level)} {text(score.score)}</small></button>; })}</div>
    {chosenCandidate && <><h3>Why {dateText(chosen)} scores {text(asRecord(chosenCandidate.score).score)}</h3><ReasonList reasons={reasonsOf(asRecord(chosenCandidate.score).reasons)} />{chosenCandidate.older_pending_competing === true && <p className="muted">An older pending request is competing for this weekend.</p>}</>}
    <h3>Vendors</h3>{records(d.vendors).length ? records(d.vendors).map((vendor) => <div className="vendor-preview" key={text(vendor.name)}><b>{text(vendor.name)}</b> · {text(vendor.service)} · ${text(vendor.price_usd)} <small>{text(vendor.state)}</small></div>) : <p className="muted">No vendors listed.</p>}
    {changes.length > 0 && <><h3>Change requests</h3>{changes.map((change) => <ChangeRow key={text(change.id)} change={change} onResolved={after} />)}</>}
    {status === 'submitted' && <div className="button-row card-actions"><Button variant="danger" onClick={() => { decision.reset(); setRejecting(!rejecting); }} disabled={decision.busy}>Reject</Button><Button onClick={approve} disabled={decision.busy || !canApprove || !chosen}>{decision.busy ? 'Working…' : `Approve ${chosen ? dateText(chosen) : ''}`}</Button></div>}
    {status === 'submitted' && chosenCandidate && !canApprove && <div className="gate-note"><b>Can’t approve {dateText(chosen)}</b><ul>{list(gate.reasons).map((item) => <li key={item}>{item}</li>)}</ul></div>}
    {rejecting && <div className="inline-form"><label>Reason shown to the organizer<textarea value={reason} maxLength={1000} onChange={(event) => setReason(event.target.value)} /></label><div className="button-row"><Button variant="quiet" onClick={() => setRejecting(false)}>Never mind</Button><Button variant="danger" onClick={reject} disabled={decision.busy || !reason.trim()}>Confirm reject</Button></div></div>}
    <ActionNote error={decision.error} done={decision.done} />
    {threadId && <div className="thread"><Button variant="secondary" onClick={() => setMessages(!messages)}>{messages ? 'Hide messages' : 'Messages with organizer'}</Button>{messages && <ThreadPanel threadId={threadId} load={villageApi.messages} send={villageApi.sendMessage} />}</div>}
  </Card>;
}

function ChangeRow({ change, onResolved }: { change: RecordValue; onResolved: () => void }) {
  const id = text(change.id, '');
  const open = text(change.status, '') === 'open';
  const reschedule = text(change.type, '') === 'reschedule';
  const action = useAction();
  const resolve = async (choice: 'accept' | 'decline') => {
    const result = await action.run(() => villageApi.resolveChange(id, choice, choice === 'accept' && reschedule ? text(change.proposed_start, '') : undefined), choice === 'accept' ? 'Change request accepted.' : 'Change request declined.');
    if (result.ok) onResolved();
  };
  return <div className="change-note"><b>{titleCase(text(change.type, ''))}</b> <Status value={change.status} />{reschedule && <span> · {dateText(change.proposed_start)} – {dateText(change.proposed_end)}</span>}<p>{text(change.message, '')}</p>{open && <div className="button-row card-actions"><Button variant="secondary" onClick={() => resolve('decline')} disabled={action.busy}>Decline</Button><Button onClick={() => resolve('accept')} disabled={action.busy}>{action.busy ? 'Working…' : reschedule ? `Accept ${dateText(change.proposed_start)}` : 'Accept cancellation'}</Button></div>}<ActionNote error={action.error} done={action.done} /></div>;
}

function Today() {
  const [date, setDate] = useState('2027-06-19');
  const state = useApi(() => villageApi.today(date), [date]);
  const payload = asRecord(state.data); const parties = records(payload.parties); const totals = asRecord(payload.totals); const byLevel = asRecord(totals.by_level);
  return <div className="wide today"><PageIntro title="Today" text="Approved parties and their rule-based traffic impact." action={<label className="date-pick">Date<input type="date" value={date} onChange={(event) => event.target.value && setDate(event.target.value)} /></label>} /><RealMap height={340} closures={toMapClosures(parties, false)} />{state.loading ? <LoadingCard label="Loading today’s closures…" /> : state.error ? <ApiError message={state.error} /> : <><div className="today-stats"><Card><b>Block parties today</b><strong>{text(totals.count, '0')}</strong></Card><Card><b>Traffic impact</b><strong>{['low', 'medium', 'high'].map((level) => `${titleCase(level)} ${text(byLevel[level], '0')}`).join(' · ')}</strong></Card><Card><b>Bus stops on closed blocks</b><strong>{text(totals.bus_stops_closed, '0')}</strong></Card><Card><b>Vendors serving today</b><strong>{text(totals.vendors, '0')}</strong></Card></div><div className="today-list">{parties.length ? parties.map((party) => <Card key={text(party.request_id, text(party.block_label))}><div><h3>{text(party.block_label)}</h3><p>{text(party.hours, '9 a.m. – 11 p.m.')} · {text(party.guests)} guests <Status value={party.level} /></p><p>{text(party.why, '')}</p><p className="muted">Vendors: {list(party.vendors).join(', ') || 'none matched'}{party.barricade_date ? ` · Barricades ${dateText(party.barricade_date)}` : ''}</p></div></Card>) : <Card><p>No block parties on this date.</p></Card>}</div></>}</div>;
}

type Closure = { block_id: string; block_label: string };
function Planner() {
  const [date, setDate] = useState('2027-06-19');
  const [weekday, setWeekday] = useState(false);
  const [closures, setClosures] = useState<string[]>([]);
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<RecordValue>();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [ai, setAi] = useState<AiExplainOutput>();
  const ask = useAction();
  const blocks = useApi(async () => {
    const queue = await villageApi.requests();
    const seen = new Map<string, string>();
    records(queue.requests).filter((item) => !['rejected', 'withdrawn', 'cancelled'].includes(text(item.status, ''))).forEach((item) => { const blockId = text(item.block_id, ''); if (blockId && !seen.has(blockId)) seen.set(blockId, text(item.block_label, blockId)); });
    return [...seen].map(([block_id, block_label]): Closure => ({ block_id, block_label }));
  }, []);

  useEffect(() => {
    if (!date) return;
    let live = true;
    setRunning(true); setError(''); setAi(undefined);
    villageApi.whatIf(date as LocalDate, closures, weekday)
      .then((value) => { if (live) setResult(asRecord(value)); })
      .catch((reason: unknown) => { if (live) setError(reason instanceof Error ? reason.message : 'Unable to run the planner.'); })
      .finally(() => { if (live) setRunning(false); });
    return () => { live = false; };
  }, [date, weekday, closures]);

  const dow = date ? new Date(`${date}T12:00:00`).getDay() : 6;
  const isWeekday = weekday || (dow >= 1 && dow <= 5);
  const perBlock = records(result?.per_block);
  const suggestions = records(result?.suggestions);
  const tips = list(result?.tips);
  const weekend = result?.weekend_count ? asRecord(result.weekend_count) : null;
  const worst = result?.worst ? asRecord(result.worst) : null;
  const toggle = (blockId: string) => setClosures((current) => current.includes(blockId) ? current.filter((value) => value !== blockId) : [...current, blockId]);
  const apply = (suggestion: RecordValue) => { const change = asRecord(suggestion.apply); if (typeof change.date === 'string') setDate(change.date); else setWeekday(false); };
  const doAsk = async () => {
    const input: AiExplainInput = {
      question: question.trim().slice(0, 300), date, is_weekday: isWeekday,
      closures: perBlock.map((item) => { const score = asRecord(item.score); return { label: text(item.block_label, ''), score: num(score.score), level: text(score.level, 'low'), reasons: reasonsOf(score.reasons) }; }),
      weekend: weekend ? { count: num(weekend.count), cap: num(weekend.cap) } : null,
      suggestions: suggestions.map((item) => ({ text: text(item.text, '') })), tips
    };
    const response = await ask.run(() => villageApi.explain(input));
    if (response.ok) setAi(response.value);
  };
  return <div className="wide planner"><PageIntro title="Traffic planner" text="Test a closure scenario. The backend calculates scores; this interface only displays them." />
    <Card className="planner-ask"><div><b>Day type</b><label className="inline-check"><input type="radio" checked={!weekday} onChange={() => setWeekday(false)} />Saturday</label><label className="inline-check"><input type="radio" checked={weekday} onChange={() => setWeekday(true)} />A weekday</label><label className="date-pick">Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label></div><div className="ask-row"><label>Ask the traffic planner<input value={question} maxLength={300} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about closures" /></label><Button onClick={doAsk} disabled={ask.busy || running || !result}>{ask.busy ? 'Asking…' : 'Ask'}</Button></div></Card>
    <Card className="closure-picker"><h2>Test closures</h2>{blocks.loading ? <p className="muted">Loading blocks from the request queue…</p> : blocks.error ? <p className="action-error" role="alert">{blocks.error}</p> : <div className="chip-row">{(blocks.data ?? []).map((block) => <button key={block.block_id} className={`chip ${closures.includes(block.block_id) ? 'active' : ''}`} aria-pressed={closures.includes(block.block_id)} onClick={() => toggle(block.block_id)}>{block.block_label}</button>)}</div>}<p className="muted">{closures.length} of {(blocks.data ?? []).length} blocks closed in this scenario.</p></Card>
    <div className="planner-grid"><Card className="assistant-answer"><h2>Planner result {running && <span className="spinner" aria-label="Running" />}</h2>{error ? <p className="action-error" role="alert">{error}</p> : result ? <>
      {perBlock.length ? perBlock.map((item) => { const score = asRecord(item.score); return <div className="planner-block" key={text(item.block_id)}><div className="impact-line"><b>{text(item.block_label)}</b><Status value={score.level} /><span>Score {text(score.score)}</span></div><ReasonList reasons={reasonsOf(score.reasons)} /></div>; }) : <p className="muted">No closures selected. Pick blocks above to score them.</p>}
      <dl><div><dt>Highest impact</dt><dd>{worst ? `${text(worst.level)} · ${text(worst.score)}` : '—'}</dd></div><div><dt>Weekend count</dt><dd>{weekend ? `${text(weekend.count)} of ${text(weekend.cap)}` : 'n/a (weekday)'}</dd></div></dl>
      {suggestions.length > 0 && <><h3>Suggestions</h3><ul className="suggestions">{suggestions.map((item, index) => <li key={index}>{text(item.text)} <Button variant="secondary" onClick={() => apply(item)}>Apply</Button></li>)}</ul></>}
      {tips.length > 0 && <><h3>Tips</h3><ul className="score-list">{tips.map((tip) => <li key={tip}>{tip}</li>)}</ul></>}
      <ActionNote error={ask.error} />
      {ai && <div className="ai-answer"><span className={`badge ai-label ${ai.source}`}>{ai.label}</span><p><b>Summary.</b> {ai.summary}</p><p><b>Answer.</b> {ai.answer}</p></div>}
    </> : running ? <p className="muted">Running scenario…</p> : <p className="muted">Run a scenario to see a backend-calculated result.</p>}</Card><Card className="planner-map"><h2>Map</h2><RealMap height={330} closures={toMapClosures(perBlock, true)} /><p className="legend">Uses OpenStreetMap. Closure geometry is drawn from the backend once a scenario returns it.</p></Card></div></div>;
}

export default App;
