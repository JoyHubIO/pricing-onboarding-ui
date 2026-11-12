import { rowList, type FlowState } from '../model'
import { GROUPS, type Scenario } from '../scenarios'

type Props = {
  s: FlowState
  /** Every route case, built on the loaded manager list. */
  cases: Scenario[]
  /** The scenario loaded last, until the order is changed by hand or restarted. */
  active: string | null
  onLoad: (sc: Scenario) => void
  onClose: () => void
}

/** The test routes panel: every route case in the map, one click to load it on a real company from the
 * manager list with stand-in answers, and the codes of the order on screen. A developer tool: loading a
 * case only fills the screens in, it sends nothing. */
export default function RoutesPanel({ s, cases, active, onLoad, onClose }: Props) {
  const live = rowList(s).map(r => r.route)
  return (
    <aside className="side" aria-label="Test routes">
      <div className="side-head">
        <span className="lab">Test routes</span>
        <button type="button" className="side-close" onClick={onClose} aria-label="Hide test routes">
          ×
        </button>
      </div>
      <p className="side-note">
        Every route case in the map, on companies from the live list. Click one to load it with stand-in answers, or follow its recipe
        from “Start over”.
      </p>
      <div className="side-live">
        <span className="lab">This order</span>
        <span className="side-codes">{live.length ? live.join(' · ') : 'no routes yet'}</span>
      </div>
      {GROUPS.map(g => (
        <div className="side-group" key={g}>
          <span className="side-group-name">{g}</span>
          {cases.filter(x => x.group === g).map(sc => (
            <button
              type="button"
              key={sc.id}
              className={'route-case' + (active === sc.id ? ' active' : '')}
              onClick={() => onLoad(sc)}
              disabled={!!sc.missing}
              aria-pressed={active === sc.id}
              title={'Map ' + sc.map}
            >
              <span className="route-case-top">
                <span className="route-case-codes">
                  {sc.codes.map((c, i) => (
                    <span key={i} className={'code' + (c.startsWith('X') ? ' off' : '')}>
                      {c}
                    </span>
                  ))}
                </span>
                <span className="route-case-label">{sc.label}</span>
              </span>
              <span className="route-case-recipe">{sc.missing ?? sc.recipe}</span>
            </button>
          ))}
        </div>
      ))}
    </aside>
  )
}
