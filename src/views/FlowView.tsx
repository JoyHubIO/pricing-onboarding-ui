import type { ReactNode } from 'react'
import { ADMIN_TIP, INSTALL_NOTICE, OURS, PRODUCT_TIP, PROPTECH_TIP, REFUND_TERMS } from '../data'
import { current, progress, showsNotice, valid } from '../flow'
import {
  asksCompanyFirst,
  biPrice,
  blank,
  checkoutOptions,
  daPrice,
  mgrHit,
  mgrRoute,
  money,
  monthly,
  newPms,
  ownHit,
  ownSystems,
  patchMgr,
  patchPms,
  rowErr,
  rowKey,
  rowList,
  rowTotals,
  ROUTE_TEXT,
  stepKey,
  totals,
  type CheckoutChoice,
  type FlowState,
  type Person,
  type PmsEntry,
  type Step,
} from '../model'
import type { AddressLookup } from '../lookup'
import type { CompanyAnswer } from '../order'
import { CompanyFields, Field, PersonFields } from './Fields'
import PropertiesStep from './PropertiesStep'

type Props = {
  s: FlowState
  /** Change answers without moving. */
  set: (patch: Partial<FlowState>) => void
  /** Change answers and go to the next screen (single-choice screens). */
  choose: (patch: Partial<FlowState>) => void
  onContinue: () => void
  onBack: () => void
  onRestart: () => void
  /** The test routes panel beside the stage, when shown. */
  aside?: ReactNode
  panelOpen?: boolean
  onTogglePanel?: () => void
  /** The status panel on the right, when shown. */
  asideRight?: ReactNode
  statusOpen?: boolean
  onToggleStatus?: () => void
  /** The address lookup behind the properties screens. */
  lookup?: AddressLookup
  /** Where the submitted order stands, and the note of a quote reopened from its link. */
  order?: OrderView
  /** Submit the order under a checkout choice, with the buyer's company answer when one was asked for. */
  onSubmit?: (checkout: CheckoutChoice, answer?: CompanyAnswer) => void
  /** Ask for a call: the end of a plan with nothing to bill. */
  onCall?: () => void
  /** Who receives the invoice (Send invoice): the buyer until changed. */
  billing?: Person
  onBilling?: (p: Person) => void
  /** Show the billing contact's errors: Request invoice was pressed with one missing. */
  billingTried?: boolean
}

/** A quote reopened from its emailed link: which one, and what has changed since it was saved. */
export type Reopened = {
  missing?: boolean
  number?: string
  replaced?: boolean
  expired?: boolean
  quoted?: number
  today?: number
  /** The buyer came back from Stripe's page without paying. */
  cancelled?: boolean
}

/** What was submitted: one of the three checkout choices, or the call request. */
export type Submitted = CheckoutChoice | 'call'

export type OrderView =
  | { state: 'idle'; reopened?: Reopened }
  | { state: 'sending'; checkout: Submitted }
  | { state: 'confirm'; checkout: CheckoutChoice; candidates: { id: number; name: string; website?: string | null }[] }
  /** Stored, and for an invoice or a call nothing more is owed by the buyer. `email` is where word goes. */
  | { state: 'saved'; checkout: Submitted; number: string; total: number | null; email: string }
  | { state: 'failed'; checkout: Submitted; message: string }

const SUBMIT_LABEL: Record<CheckoutChoice, string> = { quote: 'Email my quote', invoice: 'Request invoice', pay: 'Continue to secure payment' }

function reopenedLines(r: Reopened): string[] {
  if (r.missing) return ['We couldn’t open that quote. The link may be incomplete. You can build the plan again here.']
  const out: string[] = []
  if (r.cancelled) out.push('Payment was not completed and nothing was charged. You can carry on from here.')
  if (r.replaced) out.push('This quote was replaced. This is your latest plan, ' + r.number + '.')
  else if (r.number) out.push('Quote ' + r.number + ', as you saved it.')
  if (r.expired) out.push('This quote has expired. Save it again to get today’s price.')
  if (r.quoted != null && r.today != null && r.quoted !== r.today) out.push('Pricing has changed since this quote: it was ' + money(r.quoted) + ' a month and is ' + money(r.today) + ' today.')
  return out
}

function savedLine(checkout: Submitted, number: string, email: string): string {
  switch (checkout) {
    case 'quote':
      return 'Quote ' + number + ' is saved. We have emailed a link to ' + email + '; it is good for 30 days.'
    case 'invoice':
      return 'Order ' + number + ' is received. We will email the invoice to ' + email + '. It is due in 30 days and includes the 2% invoicing charge.'
    case 'call':
      return 'Call request ' + number + ' is received. We will email ' + email + ' to arrange a time. Nothing is charged.'
    case 'pay':
      return 'Order ' + number + ' is saved.'
  }
}

/** The order's standing under the price: the company question (map, C3), the result, or why it failed. */
function OrderPanel({ order, pageTotal, onSubmit }: { order: OrderView; pageTotal: number; onSubmit?: (checkout: CheckoutChoice, answer?: CompanyAnswer) => void }) {
  switch (order.state) {
    case 'idle':
      return null
    case 'sending':
      return (
        <p role="status" className="micro">
          {order.checkout === 'pay' ? 'Taking you to secure payment…' : order.checkout === 'call' ? 'Sending…' : 'Saving…'}
        </p>
      )
    case 'confirm':
      return (
        <div className="stack" style={{ gap: 10 }} role="group" aria-label="Confirm your company">
          <span className="lab">{order.candidates.length ? 'Is one of these your company?' : 'We don’t have your company yet.'}</span>
          {order.candidates.map(c => (
            <button type="button" key={c.id} className="opt" onClick={() => onSubmit?.(order.checkout, { confirmedCompanyId: c.id })}>
              <span className="opt-label">{c.name}</span>
              {c.website && <span className="opt-sub">{c.website}</span>}
            </button>
          ))}
          <button type="button" className="opt" onClick={() => onSubmit?.(order.checkout, { createNewCompany: true })}>
            <span className="opt-label">{order.candidates.length ? 'None of these' : 'Add my company'}</span>
            <span className="opt-sub">Create a new company record</span>
          </button>
        </div>
      )
    case 'saved':
      return (
        <div className="notice" role="status">
          {savedLine(order.checkout, order.number, order.email)}
          {order.total != null && order.total !== pageTotal ? ' The price for this order is ' + money(order.total) + ' a month.' : ''}
        </div>
      )
    case 'failed':
      return (
        <span role="alert" className="err">
          {order.message}
        </span>
      )
  }
}

type Option = { v: string; label: string; sub?: string; links?: { label: string; href: string }[] }

function Choices({ options, value, onPick, cols }: { options: Option[]; value: string | string[]; onPick: (v: string) => void; cols?: number }) {
  const on = (v: string) => (Array.isArray(value) ? value.includes(v) : value === v)
  return (
    <div className="choices" style={{ gridTemplateColumns: 'repeat(' + (cols ?? 1) + ', minmax(0, 1fr))' }}>
      {options.map(o => (
        <div className="optwrap" key={o.v}>
          <button type="button" className={'opt' + (on(o.v) ? ' on' : '')} onClick={() => onPick(o.v)} aria-pressed={on(o.v)}>
            <span className="opt-label">{o.label}</span>
            {o.sub && <span className="opt-sub">{o.sub}</span>}
          </button>
          {o.links && (
            <div className="optlinks">
              {o.links.map(l => (
                <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer">
                  {l.label} ↗
                </a>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

const sys = (list: string[]): Option[] => list.map(x => ({ v: x, label: x }))

type Screen = {
  title: string
  /** The price screen: 52px title. */
  big?: boolean
  sub?: string
  /** The "i" tooltip next to the title. */
  tip?: string
  body?: ReactNode
  cta?: string
  /** No Continue button: the screen moves on its own (single choice) or is the end. */
  noNext?: boolean
  /** Text at the right end of the Continue row (the properties total). */
  trailing?: string
  /** A screen-level error in the Continue row (the properties row). */
  error?: string
}

function resize(pms: PmsEntry[], n: number): PmsEntry[] {
  const out = pms.slice(0, n)
  while (out.length < n) out.push(newPms())
  return out
}

function mgrName(s: FlowState, i: number): string {
  return mgrHit(s, i)?.name || s.mgrs[i].name || 'this company'
}

function countLine(props: number, units: number): string {
  return props + (props === 1 ? ' property · ' : ' properties · ') + units.toLocaleString('en-US') + ' units'
}

const CHECKOUT: Record<CheckoutChoice, Option> = {
  pay: { v: 'pay', label: 'Pay now', sub: 'Card or ACH · start today' },
  quote: { v: 'quote', label: 'Save quote', sub: 'Email me a copy' },
  invoice: { v: 'invoice', label: 'Send invoice', sub: 'Net 30 · +2%' },
}

function screen(s: FlowState, step: Step, show: boolean, props: Props): Screen {
  const { set, choose, onContinue } = props
  const pt = s.role === 'proptech'
  switch (step.id) {
    case 'start':
      return {
        title: 'Which best describes you?',
        noNext: true,
        body: (
          <Choices
            cols={3}
            value={s.role}
            onPick={v => choose({ role: v as FlowState['role'] })}
            options={[
              { v: 'owner', label: 'Owner', sub: 'I own the properties' },
              { v: 'manager', label: 'Manager', sub: 'I manage properties' },
              { v: 'proptech', label: 'PropTech', sub: 'I serve owners or managers' },
            ]}
          />
        ),
      }
    case 'company':
      return {
        title: 'What’s your company name?',
        tip: 'We check whether your company is already connected, so we never ask twice.',
        body: <CompanyFields managers={s.managers} name={s.company} url={s.companyUrl} onChange={(company, companyUrl) => set({ company, companyUrl })} show={show} onEnter={onContinue} />,
      }
    case 'managed':
      return {
        title: 'How are your properties managed?',
        noNext: true,
        body: (
          <Choices
            cols={3}
            value={s.managed}
            onPick={v => choose({ managed: v as FlowState['managed'] })}
            options={[
              { v: 'self', label: 'We self-manage' },
              { v: 'third', label: 'A third-party manager' },
              { v: 'both', label: 'Both' },
            ]}
          />
        ),
      }
    case 'ownSys': {
      const hit = ownHit(s)
      return {
        title: 'Which systems are these properties on?',
        sub: (hit?.name ?? s.company) + ' is already connected on more than one system. Pick every system that holds the properties you want included.',
        body: (
          <Choices
            cols={2}
            value={s.ownSys}
            onPick={v => set({ ownSys: s.ownSys.includes(v) ? s.ownSys.filter(x => x !== v) : [...s.ownSys, v] })}
            options={sys(hit?.systems ?? [])}
          />
        ),
      }
    }
    case 'pmsCount':
      return {
        title: 'How many property management systems does your company use?',
        tip: 'For example Yardi, RealPage, Entrata or ResMan.',
        body: (
          <>
            <Choices
              cols={5}
              value={s.pmsCount === null ? '' : String(Math.min(s.pmsCount, 4))}
              onPick={v => choose({ pmsCount: +v, pms: resize(s.pms, +v), confirmNone: '' })}
              options={[
                { v: '0', label: 'None' },
                { v: '1', label: '1' },
                { v: '2', label: '2' },
                { v: '3', label: '3' },
                { v: '4', label: '4' },
              ]}
            />
            <div className="fields" style={{ marginTop: 18 }}>
              <Field
                label="More than 4? Enter the number"
                type="number"
                min={5}
                value={s.pmsCount !== null && s.pmsCount > 4 ? String(s.pmsCount) : ''}
                onChange={v => {
                  const n = Math.floor(+v || 0)
                  set(n > 4 ? { pmsCount: n, pms: resize(s.pms, n) } : { pmsCount: null })
                }}
                show={false}
                placeholder="5"
                small
                onEnter={onContinue}
              />
            </div>
          </>
        ),
      }
    case 'confirmNone':
      return {
        title: 'Just to confirm: you don’t store your property data in a system we can connect to, or you’d prefer to email it to us?',
        tip: 'Yes: we set up a call, and nothing is charged until after it. No: back to the count.',
        noNext: true,
        body: (
          <Choices
            cols={2}
            value={s.confirmNone}
            onPick={v => choose({ confirmNone: v as FlowState['confirmNone'] })}
            options={[
              { v: 'yes', label: 'Yes, that’s right' },
              { v: 'no', label: 'No, go back' },
            ]}
          />
        ),
      }
    case 'pmsSystem': {
      const n = s.pmsCount ?? 1
      return {
        title: n > 1 ? 'Which is system ' + (step.i + 1) + ' of ' + n + '?' : 'Which system do you use?',
        tip: 'Not on the list? Pick Other. We will set up a quick call for those properties, and they are not billed.',
        noNext: true,
        body: (
          <Choices
            cols={3}
            value={s.pms[step.i].system}
            onPick={v => choose(patchPms(s, step.i, { system: v }))}
            options={[...sys(OURS), { v: 'Other', label: 'Other' }]}
          />
        ),
      }
    }
    case 'pmsAdmin': {
      const p = s.pms[step.i]
      // "Same administrator" copies the first system's administrator (map, 1.1.2.1).
      const first = step.i > 0 ? s.pms[0] : null
      const canSame = !!first && !!first.admin.email
      return {
        title: 'Who is your ' + p.system + ' administrator?',
        tip: ADMIN_TIP,
        body: (
          <>
            {canSame && (
              <label className="checkrow">
                <input
                  type="checkbox"
                  checked={p.same}
                  onChange={e => set(patchPms(s, step.i, e.target.checked ? { same: true, admin: { ...first!.admin } } : { same: false, admin: blank() }))}
                />
                Same administrator as for {first!.system} ({first!.admin.first} {first!.admin.last}, {first!.admin.email})
              </label>
            )}
            <PersonFields p={p.admin} onChange={admin => set(patchPms(s, step.i, { admin, same: false }))} show={show} onEnter={onContinue} />
          </>
        ),
      }
    }
    case 'props': {
      const key = rowKey(step)
      const row = s.rows[key]
      let where = ''
      let offline = false
      if (step.k === 'own') {
        const system = ownSystems(s)[step.i]
        where = system ? 'on ' + system : 'at ' + (s.company || 'your company')
      }
      if (step.k === 'pms') {
        const system = s.pms[step.i].system
        offline = !OURS.includes(system)
        where = offline ? 'on your other system' : 'on ' + system
      }
      if (step.k === 'mgr') {
        where = 'with ' + mgrName(s, step.i)
        offline = mgrRoute(s, step.i).route === 'X1'
      }
      const t = rowTotals(row)
      return {
        title: 'Which properties are ' + where + '?',
        sub: offline ? 'We will cover these on a quick call. They are not billed.' : undefined,
        tip: offline ? undefined : 'Look up an address, then confirm or enter units and year built. We use them to match the right property.',
        body: row ? <PropertiesStep row={row} onChange={r => set({ rows: { ...s.rows, [key]: r } })} onEnter={onContinue} lookup={props.lookup} /> : null,
        trailing: countLine(t.props, t.units) + (offline ? ' · not billed' : ''),
        error: show ? rowErr(row) : '',
      }
    }
    case 'mgrName': {
      const m = s.mgrs[step.i]
      return {
        title: pt
          ? step.i === 0
            ? 'Who has your client’s properties?'
            : 'Who has your next client’s properties?'
          : step.i === 0
            ? 'Who manages your properties?'
            : 'Which other company manages your properties?',
        tip: pt ? 'The management company, or your client if they manage their own properties.' : 'Start typing the management company’s name.',
        body: (
          <CompanyFields
            managers={s.managers}
            name={m.name}
            url={m.url}
            label={pt ? 'Company' : 'Management company'}
            onChange={(name, url) => set(patchMgr(s, step.i, { name, url, sys: '', knowsAdmin: '' }))}
            show={show}
            onEnter={onContinue}
          />
        ),
      }
    }
    case 'mgrSys': {
      const hit = mgrHit(s, step.i)
      const nm = mgrName(s, step.i)
      const m = s.mgrs[step.i]
      return {
        title: hit ? 'Do you know which system ' + nm + ' uses for your properties?' : 'Do you know which system ' + nm + ' uses?',
        tip: hit ? 'Only the systems ' + nm + ' is connected on are listed.' : 'Not sure is fine. We will ask your contact there.',
        noNext: true,
        body: (
          <Choices
            cols={3}
            value={m.sys}
            onPick={v => choose(patchMgr(s, step.i, { sys: v, knowsAdmin: '' }))}
            options={hit ? [...sys(hit.systems), { v: 'unknown', label: 'I don’t know' }] : [...sys(OURS), { v: 'Other', label: 'Other' }, { v: 'unknown', label: 'I don’t know' }]}
          />
        ),
      }
    }
    case 'mgrKnowsAdmin': {
      const m = s.mgrs[step.i]
      return {
        title: 'Do you know ' + mgrName(s, step.i) + '’s ' + m.sys + ' system administrator?',
        tip: ADMIN_TIP,
        noNext: true,
        body: (
          <Choices
            cols={2}
            value={m.knowsAdmin}
            onPick={v => choose(patchMgr(s, step.i, { knowsAdmin: v as 'yes' | 'no' }))}
            options={[
              { v: 'yes', label: 'Yes' },
              { v: 'no', label: 'No', sub: 'I can introduce you to someone there' },
            ]}
          />
        ),
      }
    }
    case 'mgrAdmin': {
      const m = s.mgrs[step.i]
      return {
        title: 'Who is ' + mgrName(s, step.i) + '’s ' + m.sys + ' administrator?',
        tip: ADMIN_TIP + (pt ? ' ' + PROPTECH_TIP : ''),
        body: <PersonFields p={m.admin} onChange={admin => set(patchMgr(s, step.i, { admin }))} show={show} onEnter={onContinue} />,
      }
    }
    case 'mgrContact': {
      const m = s.mgrs[step.i]
      const nm = mgrName(s, step.i)
      const text = {
        ticket: {
          title: 'Who is your regional or property manager, or your main contact, at ' + nm + '?',
          tip: 'We’ll ask them to route the request on their side.',
        },
        which: { title: 'Who is your contact at ' + nm + '?', tip: 'We’ll ask them which system holds your properties.' },
        intro: { title: 'Please introduce us to someone at ' + nm + '.', tip: 'Someone you work with there. We’ll ask them who runs their system.' },
      }[step.why]
      return {
        title: text.title,
        tip: text.tip + (pt ? ' ' + PROPTECH_TIP : ''),
        body: <PersonFields p={m.contact} onChange={contact => set(patchMgr(s, step.i, { contact }))} show={show} onEnter={onContinue} />,
      }
    }
    case 'moreMgr':
      return {
        title: pt ? 'Any other clients?' : 'Any other management companies?',
        noNext: true,
        body: (
          <Choices
            cols={2}
            value={s.mgrs[step.i].more}
            onPick={v => choose(patchMgr(s, step.i, { more: v as 'yes' | 'no' }))}
            options={[
              { v: 'yes', label: 'Yes' },
              { v: 'no', label: 'No' },
            ]}
          />
        ),
      }
    case 'product': {
      const t = totals(s)
      return {
        title: 'What do you need?',
        sub: countLine(t.props, t.units) + ' across your order.',
        tip: PRODUCT_TIP,
        noNext: true,
        body: (
          <Choices
            cols={2}
            value={s.product}
            onPick={v => choose({ product: v as FlowState['product'] })}
            options={[
              {
                v: 'bi',
                label: 'Business Intelligence',
                sub: 'Dashboards and data · ' + money(biPrice(t.units)) + '/mo · tiered per unit from $1.75',
                links: [{ label: 'About Business Intelligence', href: 'https://www.revolutionre.com/products/bi-tool' }],
              },
              {
                v: 'da',
                label: 'Data Access',
                sub: 'Data only · ' + money(daPrice(t.props)) + '/mo · $50 per property, $25 after 100',
                links: [
                  { label: 'About ETL', href: 'https://www.revolutionre.com/products/etl' },
                  { label: 'About MCP', href: 'https://www.revolutionre.com/mcp' },
                ],
              },
            ]}
          />
        ),
      }
    }
    case 'you':
      return {
        title: 'Where should we send your login?',
        tip: 'A work email is required; personal addresses can’t be used.',
        body: (
          <>
            <PersonFields p={s.you} onChange={you => set({ you })} show={show} work emailLabel="Work email" onEnter={onContinue} />
            {!asksCompanyFirst(s) && (
              <div className="fields">
                <Field label="Company" value={s.company} onChange={company => set({ company })} err={s.company.trim() ? '' : 'Required'} show={show} placeholder="Company name" span={2} onEnter={onContinue} />
              </div>
            )}
          </>
        ),
      }
    case 'checkout': {
      const m = monthly(s)
      const t = totals(s)
      const rows = rowList(s)
      const opts = checkoutOptions(m).map(k => CHECKOUT[k])
      return {
        title: money(m) + ' / month',
        big: true,
        sub: countLine(t.props, t.units) + ' · ' + (s.product === 'da' ? 'Data Access' : 'Business Intelligence') + (t.offProps ? ' · ' + t.offProps + ' more covered on a call' : ''),
        tip: 'Setup is free. Billing is monthly from today.',
        noNext: true,
        body: (
          <div className="stack" style={{ gap: 22 }}>
            <Choices cols={opts.length} value={s.checkout} onPick={v => choose({ checkout: v as CheckoutChoice })} options={opts} />
            <div className="stack" style={{ gap: 8 }}>
              <span className="lab">What happens after payment</span>
              <div className="routes">
                {rows.map(r => (
                  <div key={r.key} className="item">
                    <span className={'code' + (r.billable ? '' : ' off')}>{r.route}</span>
                    <div className="item-main">
                      <span className="item-name">
                        {r.party}
                        {r.system ? ' · ' + r.system : ''}
                      </span>
                      <span className="item-line">
                        {ROUTE_TEXT[r.route]}
                        {r.person && r.person.email ? ' (' + r.person.first + ' ' + r.person.last + ', ' + r.person.email + ')' : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ),
      }
    }
    case 'pay': {
      const m = monthly(s)
      return {
        title: 'Pay ' + money(m),
        sub: 'First month, billed monthly from today. ' + REFUND_TERMS,
        cta: SUBMIT_LABEL.pay,
        body: (
          <div className="stripebox">
            <span className="lab">Stripe Checkout</span>
            <span style={{ fontSize: 16 }}>Card or ACH is entered on Stripe’s secure page. No surcharge.</span>
          </div>
        ),
      }
    }
    case 'call':
      return {
        title: 'Let’s set up a quick call.',
        sub: 'We will connect these properties with you directly. Nothing is charged.',
        cta: 'Request a call',
        body: (
          <>
            <PersonFields p={s.caller} onChange={caller => set({ caller })} show={show} work emailLabel="Work email" onEnter={onContinue} />
            {!asksCompanyFirst(s) && (
              <div className="fields">
                <Field label="Company" value={s.company} onChange={company => set({ company })} err={s.company.trim() ? '' : 'Required'} show={show} placeholder="Company name" span={2} onEnter={onContinue} />
              </div>
            )}
          </>
        ),
      }
  }
}

export default function FlowView(props: Props) {
  const { s, onContinue, onBack, onRestart, aside, panelOpen, onTogglePanel, asideRight, statusOpen, onToggleStatus, onSubmit, onCall, onBilling } = props
  const order: OrderView = props.order ?? { state: 'idle' }
  const step = current(s)
  const show = !!s.tried[stepKey(step)]
  const sc = screen(s, step, show, props)
  const pct = progress(s)
  const notice = showsNotice(s, step)
  // The notice names the person this screen collects (map, Section 4), when there is one.
  const noticeFor = step.id === 'pmsAdmin' ? s.pms[step.i].admin : null
  const noticeText = INSTALL_NOTICE + (noticeFor && noticeFor.email ? ' (' + noticeFor.first + ' ' + noticeFor.last + ', ' + noticeFor.email + ')' : '')
  // What this screen submits: Save quote and Send invoice on the price screen itself, Pay now and the call
  // request on their own screens.
  const submits: Submitted | null =
    step.id === 'pay' ? 'pay' : step.id === 'call' ? 'call' : step.id === 'checkout' && (s.checkout === 'quote' || s.checkout === 'invoice') ? s.checkout : null
  const busy = order.state === 'sending'
  // A call request already received is not sent twice.
  const done = order.state === 'saved' && order.checkout === 'call'
  const onNext =
    step.id === 'pay'
      ? () => !busy && onSubmit?.('pay')
      : step.id === 'call'
        ? // Continue shows the errors of an incomplete screen; a complete one is sent.
          () => (valid(s, step) ? !busy && !done && onCall?.() : onContinue())
        : onContinue
  const billing = props.billing ?? s.you
  const invoicing = step.id === 'checkout' && s.checkout === 'invoice'
  const reopened = order.state === 'idle' && order.reopened ? reopenedLines(order.reopened) : []
  const missing = order.state === 'idle' && !!order.reopened?.missing
  return (
    <div className="app">
      <div className="top">
        <img src={import.meta.env.BASE_URL + 'logo.png'} alt="Revolution RE" />
        <div className="grow" />
        {onTogglePanel && (
          <button type="button" className="restart" onClick={onTogglePanel} aria-pressed={!!panelOpen}>
            Test routes
          </button>
        )}
        {onToggleStatus && (
          <button type="button" className="restart" onClick={onToggleStatus} aria-pressed={!!statusOpen}>
            Status
          </button>
        )}
        {s.stack.length > 1 && (
          <button type="button" className="restart" onClick={onRestart}>
            Start over
          </button>
        )}
        <div className="progress" style={{ width: pct + '%' }} />
      </div>
      <div className="body">
        {aside}
        <main className={'stage ' + (s.stack.length % 2 ? 'stage-a' : 'stage-b')} key={stepKey(step)}>
          <div className="col">
            <div className="head">
              <div className="titlerow">
                <h1 className={'title' + (sc.big ? ' big' : '')}>{sc.title}</h1>
                {sc.tip && (
                  <span className="tip" tabIndex={0} aria-label="More info">
                    i<span className="tipbox" role="tooltip">{sc.tip}</span>
                  </span>
                )}
              </div>
              {sc.sub && <div className="sub">{sc.sub}</div>}
            </div>
            <div className="arrows">
              <button type="button" className="arrow" aria-label="Back" onClick={onBack} disabled={s.stack.length <= 1}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <button type="button" className="arrow" aria-label="Next" onClick={onNext}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>
            <div className="stack">
              {(step.id === 'checkout' || step.id === 'pay' || missing) && reopened.length > 0 && (
                <div className="notice" role="status">
                  {reopened.join(' ')}
                </div>
              )}
              {sc.body}
              {invoicing && (
                <div className="stack" style={{ gap: 8 }} role="group" aria-label="Billing contact">
                  <span className="lab">Who should receive the invoice?</span>
                  <PersonFields p={billing} onChange={p => onBilling?.(p)} show={!!props.billingTried} emailLabel="Billing email" />
                </div>
              )}
              {step.id === 'checkout' && (submits === 'quote' || submits === 'invoice') && (
                <div className="ctarow">
                  <button type="button" className="btn" onClick={() => onSubmit?.(submits)} disabled={busy}>
                    {SUBMIT_LABEL[submits]}
                  </button>
                </div>
              )}
              {submits && <OrderPanel order={order} pageTotal={monthly(s)} onSubmit={onSubmit} />}
              {show && sc.noNext && !valid(s, step) && (
                <span role="alert" className="err">
                  Pick one to continue.
                </span>
              )}
              {notice && <div className="notice">{noticeText}</div>}
              {!sc.noNext && (
                <div className="ctarow">
                  <button type="button" className="btn" onClick={onNext} disabled={(step.id === 'pay' || step.id === 'call') && (busy || done)}>
                    {sc.cta ?? 'Continue'}
                  </button>
                  {sc.error && (
                    <span role="alert" className="err">
                      {sc.error}
                    </span>
                  )}
                  <div className="grow" />
                  {sc.trailing && <span className="total">{sc.trailing}</span>}
                </div>
              )}
              {step.id === 'pay' && <span className="micro">Payment is processed securely by Stripe.</span>}
            </div>
          </div>
        </main>
        {asideRight}
      </div>
    </div>
  )
}
