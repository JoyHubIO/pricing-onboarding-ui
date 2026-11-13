import { useEffect, useMemo, useState } from 'react'
import { ApiError, apiLookup, fetchManagers, fetchQuote, submitOrder } from './api'
import type { ManagerInfo } from './data'
import { advance, back } from './flow'
import type { AddressLookup } from './lookup'
import { initialState, type CheckoutChoice, type FlowState } from './model'
import { ORDER_ERRORS, ORDER_FAILED, readFiles, restore, toOrder, type CompanyAnswer, type OrderIn, type OrderResult, type SavedQuote } from './order'
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
  /** The test routes and status panels; off on a production build unless VITE_TEST_ROUTES=on. */
  tools?: boolean
}

const TOOLS = import.meta.env.VITE_TEST_ROUTES === 'on' || (import.meta.env.DEV && import.meta.env.VITE_TEST_ROUTES !== 'off')

/** The emailed link's token, read once: the link is `<page>?quote=<token>`. */
function linkToken(): string | null {
  try {
    return new URLSearchParams(window.location.search).get('quote')
  } catch {
    return null
  }
}

type Load = { state: 'loading' } | { state: 'failed' } | { state: 'ready'; managers: ManagerInfo[] }

/** The pricing page on live manager data: the list is read once from the pricing API before the first
 * screen, since every route depends on it. The test routes panel loads any route case in a click, on real
 * companies from that list, and the status panel shows what each answer led to; both are developer tools. */
export default function App({ loadManagers = fetchManagers, lookup, tools = TOOLS, submit = submitOrder, loadQuote = fetchQuote, quoteToken }: Props) {
  const [load, setLoad] = useState<Load>({ state: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [s, setS] = useState<FlowState>(initialState)
  const [active, setActive] = useState<string | null>(null)
  const [panel, setPanel] = useState(true)
  const [status, setStatus] = useState(true)
  const [order, setOrder] = useState<OrderView>({ state: 'idle' })
  const token = useMemo(() => (quoteToken === undefined ? linkToken() : quoteToken), [quoteToken])
  const addressLookup = useMemo(() => lookup ?? apiLookup(), [lookup])

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
        if (token) {
          loadQuote(token)
            .then(q => {
              if (!live) return
              const state = q && restore(q.payload.page, managers)
              if (!q || !state) return setOrder({ state: 'idle', reopened: { missing: true } })
              setS(state)
              setOrder({
                state: 'idle',
                reopened: { number: q.number, replaced: q.replaced, expired: q.expired, quoted: q.monthlyTotal, today: q.currentTotal },
              })
            })
            .catch(() => live && setOrder({ state: 'idle', reopened: { missing: true } }))
        }
      })
      .catch(() => live && setLoad({ state: 'failed' }))
    return () => {
      live = false
    }
  }, [loadManagers, loadQuote, token, attempt])

  const managers = load.state === 'ready' ? load.managers : null
  const cases = useMemo(() => (managers ? scenarios(managers) : []), [managers])

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
  const onSubmit = (checkout: CheckoutChoice, answer: CompanyAnswer = {}) => {
    setOrder({ state: 'sending', checkout })
    readFiles(s)
      .then(files => submit(toOrder(s, checkout, files, answer)))
      .then(r => {
        if (r.needsConfirmation) setOrder({ state: 'confirm', checkout, candidates: r.candidates })
        else setOrder({ state: 'saved', checkout, number: r.number ?? '', total: r.monthlyTotal ?? null, email: s.you.email.trim() })
      })
      .catch(e => setOrder({ state: 'failed', checkout, message: (e instanceof ApiError && ORDER_ERRORS[e.code]) || ORDER_FAILED }))
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
