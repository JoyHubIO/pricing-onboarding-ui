/** Helpers for walking the flow in tests: apply answers, press Continue, read the screen. */
import { advance, current } from '../flow'
import { initialState, newRow, rowKey, stepKey, type FlowState, type Person, type PropsRow } from '../model'

export const start = (): FlowState => initialState

/** Apply `patch` and press Continue. */
export const go = (s: FlowState, patch: Partial<FlowState> = {}): FlowState => advance({ ...s, ...patch })

/** The current screen's key, e.g. `props:pms:0`. */
export const at = (s: FlowState): string => stepKey(current(s))

export const person = (n = 'a'): Person => ({ first: n.toUpperCase(), last: 'Tester', email: n + '@example.com' })

export const counted = (props: number, units: number): PropsRow => ({ ...newRow('count'), count: props, units })

/** A patch that sets the properties of the current (props) screen. */
export const rowHere = (s: FlowState, row: PropsRow): Partial<FlowState> => {
  const step = current(s)
  if (step.id !== 'props') throw new Error('not on a properties screen: ' + at(s))
  return { rows: { ...s.rows, [rowKey(step)]: row } }
}

/** Press Continue through a props screen with `props` properties and `units` units. */
export const props = (s: FlowState, p: number, u: number): FlowState => go(s, rowHere(s, counted(p, u)))
