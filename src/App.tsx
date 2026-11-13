import { useEffect, useMemo, useState } from 'react'
import { ApiError, apiLookup, fetchManagers, fetchQuote, submitCall, submitCheckout, submitOrder } from './api'
import type { ManagerInfo } from './data'
import { advance, back } from './flow'
import type { AddressLookup } from './lookup'
import { initialState, money, personOk, type CheckoutChoice, type FlowState, type Person } from './model'
import {
  ORDER_ERRORS,
  ORDER_FAILED,
  readFiles,
  restore,
  toCallOrder,
  toOrder,
  type CheckoutResult,
  type CompanyAnswer,
  type OrderIn,
  type OrderResult,
  type PersonIn,
  type SavedQuote,
} from './order'
import { scenarios, type Scenario } from './scenarios'
import FlowView, { type OrderView } from './views/FlowView'
import RoutesPanel from './views/RoutesPanel'
import StatusPanel from './views/StatusPanel'

type Props = {
  /** Where the manager list comes from; the pricing API unless a test hands one in. */
  loadManagers?: () => Promise<ManagerInfo[]>
  lookup?: AddressLookup
  /** The submit behind Save quote, Pay now and Send invoice; the pricing API unless a test hands one in. */
  submit?: (order: OrderIn) => Promise<OrderResult>
  /** A saved quote by its link's token. */
  loadQuote?: (token: string) => Promise<SavedQuote | null>
  /** The token of the `?quote=` link the page was opened from, if any. */
  quoteToken?: string | null
  /** Open payment for a stored order: Stripe's page for Pay now, the invoice for Send invoice. */
  checkout?: (token: string, billing?: PersonIn) => Promise<CheckoutResult>
  /** The call request behind the "Let's set up a call" screen. */
  requestCall?: (order: OrderIn) => Promise<OrderResult>
  /** The token of the `?paid=` link Stripe sends the buyer back on after payment, if any. */
  paidToken?: string | null
  /** The buyer came back from Stripe's page without paying (`checkout=cancelled` beside `?quote=`). */
  cancelled?: boolean
  /** Leave for Stripe's page; a test hands one in to see where the buyer would go. */
  redirect?: (url: string) => void
  /** The test routes and status panels; off on a production build unless VITE_TEST_ROUTES=on. */
  tools?: boolean
}

const TOOLS = import.meta.env.VITE_TEST_ROUTES === 'on' || (import.meta.env.DEV && import.meta.env.VITE_TEST_ROUTES !== 'off')

/** What the page was opened with, read in this one place: `?quote=<token>` from the emailed link,
 * `?paid=<token>` on the way back from Stripe, and `checkout=cancelled` when the buyer left Stripe unpaid. */
function link(): { quote: string | null; paid: string | null; cancelled: boolean } {
  try {
    const q = new URLSearchParams(window.location.search)
    return { quote: q.get('quote'), paid: q.get('paid'), cancelled: q.get('checkout') === 'cancelled' }
  } catch {
    return { quote: null, paid: null, cancelled: false }
  }
}

/** Drop the link's query, so a reload after "Start a new plan" does not show the paid order again. */
function clearLink() {
  try {
    window.history.replaceState(null, '', window.location.pathname)
  } catch {
    // The address bar keeps the link; the page still starts a new plan.
  }
}

const leave = (url: string) => window.location.assign(url)

/** The order a `?paid=` link names: still being looked up, found, or not one of ours. */
type Received = { state: 'loading' } | { state: 'found'; number: string; total: number } | { state: 'missing' }

type Load = { state: 'loading' } | { state: 'failed' } | { state: 'ready'; managers: ManagerInfo[] }

/** The pricing page on live manager data: the list is read once from the pricing API before the first
 * screen, since every route depends on it. The test routes panel loads any route case in a click, on real
 * companies from that list, and the status panel shows what each answer led to; both are developer tools. */
export default function App({
  loadManagers = fetchManagers,
  lookup,
  tools = TOOLS,
  submit = submitOrder,
  loadQuote = fetchQuote,
  quoteToken,
  checkout: openCheckout = submitCheckout,
  requestCall = submitCall,
  paidToken,
  cancelled,
  redirect = leave,
}: Props) {
  const [load, setLoad] = useState<Load>({ state: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [s, setS] = useState<FlowState>(initialState)
  const [active, setActive] = useState<string | null>(null)
  const [panel, setPanel] = useState(true)
  const [status, setStatus] = useState(true)
  const [order, setOrder] = useState<OrderView>({ state: 'idle' })
  // Who receives the invoice: null follows the buyer's own details until it is edited.
  const [billing, setBilling] = useState<Person | null>(null)
  const [billingTried, setBillingTried] = useState(false)
  const opened = useMemo(link, [])
  const token = quoteToken === undefined ? opened.quote : quoteToken
  const paid = paidToken === undefined ? opened.paid : paidToken
  const unpaid = cancelled === undefined ? opened.cancelled : cancelled
  const [received, setReceived] = useState<Received | null>(paid ? { state: 'loading' } : null)
  const addressLookup = useMemo(() => lookup ?? apiLookup(), [lookup])

  // Back from Stripe after paying: the order is shown as received whether or not Stripe's own notice has
  // reached the server yet. It does not wait on the manager list, which a paid buyer has no use for.
  useEffect(() => {
    if (!paid) return
    let live = true
    loadQuote(paid)
      .then(q => live && setReceived(q ? { state: 'found', number: q.number, total: q.monthlyTotal } : { state: 'missing' }))
      .catch(() => live && setReceived({ state: 'missing' }))
    return () => {
      live = false
    }
  }, [paid, loadQuote])

  useEffect(() => {
    let live = true
    setLoad({ state: 'loading' })
    loadManagers()
      .then(managers => {
        if (!live) return
        setLoad({ state: 'ready', managers })
        setS({ ...initialState, managers })
        setActive(null)
        setOrder({ state: 'idle' })
        // Opened from a saved quote's link: every screen as the buyer left it, on today's manager list.
        if (token && !paid) {
          loadQuote(token)
            .then(q => {
              if (!live) return
              const state = q && restore(q.payload.page, managers)
              if (!q || !state) return setOrder({ state: 'idle', reopened: { missing: true } })
              setS(state)
              setOrder({
                state: 'idle',
                reopened: { number: q.number, replaced: q.replaced, expired: q.expired, quoted: q.monthlyTotal, today: q.currentTotal, cancelled: unpaid },
              })
            })
            .catch(() => live && setOrder({ state: 'idle', reopened: { missing: true } }))
        }
      })
      .catch(() => live && setLoad({ state: 'failed' }))
    return () => {
      live = false
    }
  }, [loadManagers, loadQuote, token, paid, unpaid, attempt])

  const managers = load.state === 'ready' ? load.managers : null
  const startNew = () => {
    clearLink()
    setReceived(null)
  }
  const cases = useMemo(() => (managers ? scenarios(managers) : []), [managers])

  if (received) {
    return (
      <div className="app">
        <div className="top">
          <img src={import.meta.env.BASE_URL + 'logo.png'} alt="Revolution RE" />
        </div>
        <div className="body">
          <main className="stage stage-a">
            <div className="col">
              {received.state === 'loading' ? (
                <p role="status">Loading…</p>
              ) : received.state === 'found' ? (
                <>
                  <div className="head">
                    <div className="titlerow">
                      <h1 className="title">Order received</h1>
                    </div>
                    <div className="sub">
                      Order {received.number} · {money(received.total)} / month
                    </div>
                  </div>
                  <div className="stack">
                    <div className="notice" role="status">
                      Thank you. Your payment is with Stripe, and we will email your login and the next steps shortly.
                    </div>
                    <div className="ctarow">
                      <button type="button" className="btn" onClick={startNew}>
                        Start a new plan
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="stack">
                  <p role="alert">We couldn’t find that order. If you have paid, your receipt from Stripe is your record; contact us and we will look into it.</p>
                  <div className="ctarow">
                    <button type="button" className="btn" onClick={startNew}>
                      Start a new plan
                    </button>
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    )
  }

  if (!managers) {
    return (
      <div className="app">
        <div className="top">
          <img src={import.meta.env.BASE_URL + 'logo.png'} alt="Revolution RE" />
        </div>
        <div className="body">
          <main className="stage stage-a">
            <div className="col">
              {load.state === 'loading' ? (
                <p role="status">Loading…</p>
              ) : (
                <>
                  <p role="alert">We can’t load pricing right now. Please try again.</p>
                  <button type="button" className="restart" onClick={() => setAttempt(n => n + 1)}>
                    Try again
                  </button>
                </>
              )}
            </div>
          </main>
        </div>
      </div>
    )
  }

  const fresh: FlowState = { ...initialState, managers }
  const top = () => window.scrollTo(0, 0)
  // An answer changed after an order was saved: the saved order no longer describes the screens.
  const edited = () => setOrder(o => (o.state === 'idle' ? o : { state: 'idle' }))
  const set = (patch: Partial<FlowState>) => {
    setS(prev => ({ ...prev, ...patch }))
    setActive(null)
    edited()
  }
  const choose = (patch: Partial<FlowState>) => {
    setS(prev => advance({ ...prev, ...patch }))
    setActive(null)
    edited()
    top()
  }
  const failed = (checkout: CheckoutChoice | 'call') => (e: unknown) =>
    setOrder({ state: 'failed', checkout, message: (e instanceof ApiError && ORDER_ERRORS[e.code]) || ORDER_FAILED })
  const bill: Person = billing ?? s.you
  const onSubmit = (checkout: CheckoutChoice, answer: CompanyAnswer = {}) => {
    if (checkout === 'invoice' && !personOk(bill)) return setBillingTried(true)
    setOrder({ state: 'sending', checkout })
    readFiles(s)
      .then(files => submit(toOrder(s, checkout, files, answer)))
      .then(async r => {
        if (r.needsConfirmation) return setOrder({ state: 'confirm', checkout, candidates: r.candidates })
        const saved = { number: r.number ?? '', total: r.monthlyTotal ?? null }
        if (checkout === 'quote') return setOrder({ state: 'saved', checkout, ...saved, email: s.you.email.trim() })
        // Pay now and Send invoice: the stored order is then opened for payment by its token.
        if (!r.token) throw new ApiError('The order came back with no token')
        if (checkout === 'invoice') {
          const to = { first: bill.first.trim(), last: bill.last.trim(), email: bill.email.trim() }
          await openCheckout(r.token, to)
          return setOrder({ state: 'saved', checkout, ...saved, email: to.email })
        }
        const c = await openCheckout(r.token)
        if (!c.url) throw new ApiError('Checkout came back with no page to pay on')
        // The screen keeps saying where the buyer is going until the browser leaves.
        redirect(c.url)
      })
      .catch(failed(checkout))
  }
  const onCall = () => {
    setOrder({ state: 'sending', checkout: 'call' })
    readFiles(s)
      .then(files => requestCall(toCallOrder(s, files)))
      .then(r => setOrder({ state: 'saved', checkout: 'call', number: r.number ?? '', total: null, email: s.caller.email.trim() }))
      .catch(failed('call'))
  }
  const onContinue = () => {
    setS(prev => advance(prev))
    top()
  }
  const onBack = () => {
    setS(prev => back(prev))
    top()
  }
  const onRestart = () => {
    setS(fresh)
    setActive(null)
    setOrder({ state: 'idle' })
    top()
  }
  const onLoad = (sc: Scenario) => {
    if (sc.missing) return
    setS(sc.build())
    setActive(sc.id)
    setOrder({ state: 'idle' })
    top()
  }
  return (
    <FlowView
      s={s}
      set={set}
      choose={choose}
      onContinue={onContinue}
      onBack={onBack}
      onRestart={onRestart}
      order={order}
      onSubmit={onSubmit}
      onCall={onCall}
      billing={bill}
      onBilling={p => setBilling(p)}
      billingTried={billingTried}
      lookup={addressLookup}
      panelOpen={tools && panel}
      onTogglePanel={tools ? () => setPanel(p => !p) : undefined}
      aside={tools && panel ? <RoutesPanel s={s} cases={cases} active={active} onLoad={onLoad} onClose={() => setPanel(false)} /> : null}
      statusOpen={tools && status}
      onToggleStatus={tools ? () => setStatus(p => !p) : undefined}
      asideRight={tools && status ? <StatusPanel s={s} onClose={() => setStatus(false)} /> : null}
    />
  )
}
