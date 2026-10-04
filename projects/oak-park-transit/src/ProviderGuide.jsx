import providers from './content/providers.json'
import { EXTERNAL_SVG, PHONE_SVG } from './icons'

const glyph = (svg) => <span className="glyph" dangerouslySetInnerHTML={{ __html: svg }} />

export default function ProviderGuide() {
  return (
    <div className="panel">
      <p className="muted">Who runs transportation in Oak Park, who can ride, and where to find official information.</p>
      <ul className="providers">
        {providers.map((p) => (
          <li key={p.id} className="provider">
            <div className="provider-head">
              <strong>{p.provider}</strong>
              {!p.verified && <span className="tag tag-warn">Not yet verified</span>}
            </div>
            <dl className="facts">
              <dt>Serves</dt>
              <dd>{p.serves}</dd>
              <dt>Who can ride</dt>
              <dd>{p.who}</dd>
            </dl>
            {p.notes && <p className="muted">{p.notes}</p>}
            <div className="links">
              {p.phone && (
                <a className="action" href={`tel:${p.phone.replace(/\D/g, '')}`}>
                  {glyph(PHONE_SVG)}
                  {p.phone}
                </a>
              )}
              {p.links.map((l) => (
                <a key={l.url} className="action" href={l.url} target="_blank" rel="noreferrer">
                  {l.label}
                  {glyph(EXTERNAL_SVG)}
                </a>
              ))}
            </div>
            {p.checkedOn && <div className="muted small">Checked {p.checkedOn}</div>}
          </li>
        ))}
      </ul>
    </div>
  )
}
