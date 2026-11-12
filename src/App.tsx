import { useEffect, useMemo, useState } from 'react'
import { apiLookup, fetchManagers } from './api'
import type { ManagerInfo } from './data'
import { advance, back } from './flow'
import type { AddressLookup } from './lookup'
import { initialState, type FlowState } from './model'
import { scenarios, type Scenario } from './scenarios'
import FlowView from './views/FlowView'
import RoutesPanel from './views/RoutesPanel'
import StatusPanel from './views/StatusPanel'

type Props = {
  /** Where the manager list comes from; the pricing API unless a test hands one in. */
  loadManagers?: () => Promise<ManagerInfo[]>
  lookup?: AddressLookup
  /** The test routes and status panels; off on a production build unless VITE_TEST_ROUTES=on. */
  tools?: boolean
}

const TOOLS = import.meta.env.VITE_TEST_ROUTES === 'on' || (import.meta.env.DEV && import.meta.env.VITE_TEST_ROUTES !== 'off')

type Load = { state: 'loading' } | { state: 'failed' } | { state: 'ready'; managers: ManagerInfo[] }

/** The pricing page on live manager data: the list is read once from the pricing API before the first
 * screen, since every route depends on it. The test routes panel loads any route case in a click, on real
 * companies from that list, and the status panel shows what each answer led to; both are developer tools. */
export default function App({ loadManagers = fetchManagers, lookup, tools = TOOLS }: Props) {
  const [load, setLoad] = useState<Load>({ state: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [s, setS] = useState<FlowState>(initialState)
  const [active, setActive] = useState<string | null>(null)
  const [panel, setPanel] = useState(true)
  const [status, setStatus] = useState(true)
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
      })
      .catch(() => live && setLoad({ state: 'failed' }))
    return () => {
      live = false
    }
  }, [loadManagers, attempt])

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
  const set = (patch: Partial<FlowState>) => {
    setS(prev => ({ ...prev, ...patch }))
    setActive(null)
  }
  const choose = (patch: Partial<FlowState>) => {
    setS(prev => advance({ ...prev, ...patch }))
    setActive(null)
    top()
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
    top()
  }
  const onLoad = (sc: Scenario) => {
    if (sc.missing) return
    setS(sc.build())
    setActive(sc.id)
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
