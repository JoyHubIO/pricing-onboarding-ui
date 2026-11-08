import { useState } from 'react'
import { advance, back } from './flow'
import { initialState, type FlowState } from './model'
import type { Scenario } from './scenarios'
import FlowView from './views/FlowView'
import RoutesPanel from './views/RoutesPanel'
import StatusPanel from './views/StatusPanel'

/** The pricing page, static in this ticket: the built-in manager list, no network. The test routes panel
 * loads any route case in a click and the status panel shows what each answer led to; both belong to the
 * stub build and go once the page runs on live data. */
export default function App() {
  const [s, setS] = useState<FlowState>(initialState)
  const [active, setActive] = useState<string | null>(null)
  const [panel, setPanel] = useState(true)
  const [status, setStatus] = useState(true)
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
    setS(initialState)
    setActive(null)
    top()
  }
  const onLoad = (sc: Scenario) => {
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
      panelOpen={panel}
      onTogglePanel={() => setPanel(p => !p)}
      aside={panel ? <RoutesPanel s={s} active={active} onLoad={onLoad} onClose={() => setPanel(false)} /> : null}
      statusOpen={status}
      onToggleStatus={() => setStatus(p => !p)}
      asideRight={status ? <StatusPanel s={s} onClose={() => setStatus(false)} /> : null}
    />
  )
}
