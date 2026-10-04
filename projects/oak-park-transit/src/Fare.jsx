import fares from './content/fares.json'

// Key into content/fares.json: "CTA:bus", "CTA:train", "Pace:bus", "Metra:train"
export const fareKey = (agency, rail) => `${agency}:${rail ? 'train' : 'bus'}`

// What it costs to board. Edit the amounts in src/content/fares.json.
export default function Fare({ agency, rail, compact = false }) {
  const f = fares.fares[fareKey(agency, rail)]
  if (!f) return null
  return (
    <div className="fare">
      <div className="fare-main">
        <b className="fare-amount">{f.fare}</b>
        <span className="muted">{f.payWith}</span>
      </div>
      {f.cash && <div className="fare-line">{f.cash}</div>}
      {f.pass && <div className="fare-line">{f.pass}</div>}
      {!compact && f.transfers && <div className="fare-line">{f.transfers}</div>}
      <div className="fare-line muted">{f.reduced}</div>
      {!compact && f.free && <div className="fare-line muted">{f.free}</div>}
      <a className="fare-source small" href={f.source} target="_blank" rel="noreferrer">
        {agency} fares
      </a>
      {!compact && <div className="muted small">Checked {fares.checkedOn}</div>}
    </div>
  )
}
