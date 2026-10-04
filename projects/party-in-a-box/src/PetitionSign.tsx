import { useEffect, useState } from 'react';
import { ApiFailure, publicApi, residentApi, type PublicPetition, type SignatureState } from './api';
import { DemoBanner } from './DemoBanner';

const results: Record<SignatureState, string> = {
  counted: 'Thanks — your address counts toward the petition.',
  duplicate_address: 'Someone at this address already signed; each address counts once.',
  off_block: "That house number isn't on this block, so it doesn't count.",
  struck: 'This signature was removed and does not count.'
};

function dateText(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

type Load = { loading: true } | { loading: false; petition?: PublicPetition; status?: number; error?: string };

export function PetitionSign({ token }: { token: string }) {
  const [load, setLoad] = useState<Load>({ loading: true });
  const [name, setName] = useState('');
  const [house, setHouse] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  const fetchPetition = () => publicApi.getPetition(token);
  useEffect(() => {
    let live = true;
    setLoad({ loading: true });
    fetchPetition()
      .then((petition) => live && setLoad({ loading: false, petition }))
      .catch((reason: unknown) => live && setLoad({ loading: false, status: reason instanceof ApiFailure ? reason.status : undefined, error: reason instanceof Error ? reason.message : 'Unable to load this petition.' }));
    return () => { live = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const houseOk = /^\d+(\s?\/\s?\d+)?$/.test(house.trim());
  const valid = name.trim().length > 0 && houseOk && consent;

  async function sign(event: React.FormEvent) {
    event.preventDefault();
    if (!valid || busy) return;
    setBusy(true); setError(''); setResult('');
    try {
      const response = await residentApi.signPetition(token, { name: name.trim(), house_number: house.trim(), consent: true, captcha: 'demo' });
      setResult(results[response.state] ?? 'Thanks for signing.');
      if (response.state === 'counted') { setName(''); setHouse(''); setConsent(false); }
      const petition = await fetchPetition().catch(() => undefined);
      if (petition) setLoad({ loading: false, petition });
    } catch (reason) {
      if (reason instanceof ApiFailure && reason.status === 410) setLoad({ loading: false, status: 410 });
      else if (reason instanceof ApiFailure && reason.status === 429) setError('Too many attempts. Please wait a moment and try again.');
      else setError(reason instanceof Error ? reason.message : 'Something went wrong. Try again.');
    } finally { setBusy(false); }
  }

  let body: React.ReactNode;
  if (load.loading) body = <section className="card loading-card"><span className="spinner" />Loading petition…</section>;
  else if (load.status === 404) body = <section className="card api-error"><h2>This petition link isn't valid.</h2></section>;
  else if (load.status === 410 || (load.petition && !load.petition.open)) body = <section className="card api-error"><h2>This petition is closed — the request has already been submitted or decided.</h2></section>;
  else if (!load.petition) body = <section className="card api-error"><h2>We couldn’t load this petition</h2><p>{load.error}</p></section>;
  else {
    const p = load.petition;
    body = <section className="card">
      <h2>{p.block_label}</h2>
      <p>{dateText(p.date_start)} – {dateText(p.date_end)} · {p.hours}</p>
      <p>Organized by {p.organizer_display_name}</p>
      {p.barricades && <p className="muted">This event includes street barricades.</p>}
      <div className="petition-progress"><strong>{p.distinct_count} <small>of {p.needed} separate addresses</small></strong></div>
      <form className="sign-form" onSubmit={(event) => void sign(event)}>
        <label>Name<input value={name} onChange={(event) => setName(event.target.value)} autoComplete="off" required /></label>
        <label>House number on this block<input value={house} onChange={(event) => setHouse(event.target.value)} inputMode="numeric" placeholder="1150" autoComplete="off" required /></label>
        <label className="service-check"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} required /><span>I live on this block and support closing it for this event</span></label>
        <div className="button-row"><button className="button primary" type="submit" disabled={!valid || busy}>{busy ? 'Signing…' : 'Sign'}</button></div>
      </form>
      {error && <p className="action-error" role="alert">{error}</p>}
      {result && <p className="success-text" role="status">{result}</p>}
    </section>;
  }
  return <div className="wide petition-sign"><DemoBanner /><div className="page-intro"><div><h1>Sign the block party petition</h1></div></div>{body}</div>;
}
