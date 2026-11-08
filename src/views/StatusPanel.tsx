import type { ReactNode } from 'react'
import { OURS, type ManagerInfo } from '../data'
import { current } from '../flow'
import { money, monthly, ownHit, mgrHit, mgrRoute, rowList, rowTotals, stepKey, totals, type FlowState, type Person, type PropsRow } from '../model'

type Props = {
  s: FlowState
  onClose: () => void
}

const ROLE: Record<string, string> = { owner: 'Owner', manager: 'Management company', proptech: 'PropTech' }
const MANAGED: Record<string, string> = { self: 'We self-manage', third: 'A third-party manager', both: 'Both' }
const SYS: Record<string, string> = { unknown: 'I don’t know', Other: 'Other (not one of ours)' }

/** The three facts the page reads for a company found in the integration list (map, 1.2). */
export function facts(hit: ManagerInfo): string[] {
  return [
    'Integrated on ' + (hit.systems.length ? hit.systems.join(', ') : 'an unknown system') + (hit.systems.length > 1 ? ' (' + hit.systems.length + ' deals)' : ''),
    hit.installed ? 'Installation completed' : 'Integration in progress',
    hit.hasAdmin ? 'System admin on the deal' : 'No system admin on the deal',
    hit.ticket ? 'Flagged: keep a ticket process' : 'No ticket flag',
  ]
}

const personLine = (p: Person): string => (p.first || p.last || p.email ? [p.first, p.last].filter(Boolean).join(' ') + (p.email ? ' <' + p.email + '>' : '') : 'not entered yet')

function propsLine(r: PropsRow | undefined): string {
  if (!r) return 'not entered yet'
  const t = rowTotals(r)
  const how = r.mode === 'list' ? 'one by one' : r.mode === 'upload' ? 'uploaded ' + (r.file || 'file') : 'counts'
  return t.props + ' properties · ' + t.units + ' units · ' + how
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="status-section">
      <span className="side-group-name">{title}</span>
      {children}
    </div>
  )
}

function Line({ k, v, tone }: { k: string; v: string; tone?: 'ok' | 'off' | 'dim' }) {
  return (
    <div className="status-line">
      <span className="status-k">{k}</span>
      <span className={'status-v' + (tone ? ' ' + tone : '')}>{v}</span>
    </div>
  )
}

function Facts({ hit }: { hit: ManagerInfo }) {
  return (
    <ul className="status-facts">
      {facts(hit).map(f => (
        <li key={f}>{f}</li>
      ))}
    </ul>
  )
}

/** The right-hand panel: what the buyer has typed and what the page made of it, screen by screen. */
export default function StatusPanel({ s, onClose }: Props) {
  const step = current(s)
  const own = ownHit(s)
  const askedCompany = !!s.company.trim()
  const rows = rowList(s)
  const t = totals(s)
  const mgrs = s.mgrs.filter(m => m.name.trim())
  return (
    <aside className="side side-right" aria-label="Entered so far">
      <div className="side-head">
        <span className="lab">Entered so far</span>
        <button type="button" className="side-close" onClick={onClose} aria-label="Hide status">
          ×
        </button>
      </div>
      <Line k="Screen" v={stepKey(step)} tone="dim" />

      <Section title="Buyer">
        <Line k="Role" v={s.role ? ROLE[s.role] : 'not chosen yet'} tone={s.role ? undefined : 'dim'} />
        {s.role === 'owner' && <Line k="Managed" v={s.managed ? MANAGED[s.managed] : 'not chosen yet'} tone={s.managed ? undefined : 'dim'} />}
        {(askedCompany || s.companyUrl) && <Line k="Company" v={s.company + (s.companyUrl ? ' · ' + s.companyUrl : '')} />}
        {askedCompany && (s.role === 'manager' || s.managed === 'self' || s.managed === 'both') && (
          <>
            {own ? (
              <>
                <Line k="Lookup" v={'Found: ' + own.name + ' → R1, already connected'} tone="ok" />
                <Facts hit={own} />
                {own.systems.length > 1 && <Line k="Systems picked" v={s.ownSys.length ? s.ownSys.join(', ') : 'not picked yet'} tone={s.ownSys.length ? undefined : 'dim'} />}
              </>
            ) : (
              <Line k="Lookup" v="Not in the integration list → the system count is asked" tone="off" />
            )}
          </>
        )}
        {s.pmsCount !== null && !own && <Line k="Systems" v={s.pmsCount === 0 ? 'None' + (s.confirmNone === 'yes' ? ' · confirmed → X2' : '') : String(s.pmsCount)} />}
        {s.pms.map((p, i) => (
          <div className="status-sub" key={i}>
            <Line k={'System ' + (i + 1)} v={p.system ? p.system + (OURS.includes(p.system) ? ' · one of ours → R2' : ' · not ours → X1') : 'not picked yet'} tone={p.system ? (OURS.includes(p.system) ? 'ok' : 'off') : 'dim'} />
            {OURS.includes(p.system) && <Line k="Administrator" v={personLine(p.admin) + (p.same ? ' (same as system 1)' : '')} />}
          </div>
        ))}
      </Section>

      {mgrs.length > 0 && (
        <Section title={s.role === 'proptech' ? 'Clients' : 'Managers'}>
          {s.mgrs.map((m, i) => {
            if (!m.name.trim()) return null
            const hit = mgrHit(s, i)
            const r = mgrRoute(s, i)
            return (
              <div className="status-sub" key={i}>
                <Line k={'Manager ' + (i + 1)} v={m.name + (m.url ? ' · ' + m.url : '')} />
                {hit ? (
                  <>
                    <Line k="Lookup" v={'Found: ' + hit.name} tone="ok" />
                    <Facts hit={hit} />
                  </>
                ) : (
                  <Line k="Lookup" v="Not in the integration list → new integration" tone="off" />
                )}
                {m.sys && <Line k="System" v={SYS[m.sys] ?? m.sys} />}
                {m.knowsAdmin && <Line k="Knows the admin" v={m.knowsAdmin === 'yes' ? 'Yes' : 'No'} />}
                {m.knowsAdmin === 'yes' && <Line k="Administrator" v={personLine(m.admin)} />}
                {(m.contact.first || m.contact.email) && <Line k="Contact" v={personLine(m.contact)} />}
                <Line k="Route" v={r.route + (r.system ? ' · ' + r.system : '')} tone={r.route.startsWith('X') ? 'off' : 'ok'} />
              </div>
            )
          })}
        </Section>
      )}

      {rows.length > 0 && (
        <Section title="Properties">
          {rows.map(r => (
            <Line key={r.key} k={r.party + (r.system ? ' · ' + r.system : '')} v={propsLine(s.rows[r.key])} tone={s.rows[r.key] ? undefined : 'dim'} />
          ))}
          <Line k="Billable" v={t.props + ' properties · ' + t.units + ' units'} />
          {t.offProps > 0 && <Line k="On a call" v={t.offProps + ' properties · ' + t.offUnits + ' units'} tone="off" />}
        </Section>
      )}

      {rows.length > 0 && (
        <Section title="Routes">
          {rows.map(r => (
            <div className="status-route" key={r.key}>
              <span className={'code' + (r.billable ? '' : ' off')}>{r.route}</span>
              <span className="status-route-text">
                {r.party}
                {r.person && r.person.email ? ' · email to ' + r.person.first + ' ' + r.person.last : ''}
                {r.route === 'R3' && r.manager ? ' · email to the manager’s admin' : ''}
              </span>
            </div>
          ))}
        </Section>
      )}

      {(s.product || s.you.email || s.checkout) && (
        <Section title="Order">
          {s.product && <Line k="Product" v={s.product === 'da' ? 'Data Access' : 'Business Intelligence'} />}
          {s.product && <Line k="Monthly" v={money(monthly(s))} />}
          {(s.you.first || s.you.email) && <Line k="You" v={personLine(s.you)} />}
          {s.checkout && <Line k="Checkout" v={s.checkout === 'pay' ? 'Pay now' : s.checkout === 'quote' ? 'Save quote' : 'Send invoice'} />}
        </Section>
      )}
    </aside>
  )
}
