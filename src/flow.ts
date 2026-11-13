import { OURS } from './data'
import {
  asksCompanyFirst,
  mgrHit,
  mgrRoute,
  newMgr,
  newPms,
  newRow,
  ownHit,
  ownSystems,
  personOk,
  rowErr,
  rowKey,
  rowList,
  stepKey,
  totals,
  type FlowState,
  type Step,
} from './model'

/** Where the self-managed part goes after its last row (map, 1.3: "Both" = 1.1 then 1.2). */
function afterSelf(s: FlowState): Step {
  return s.managed === 'both' ? { id: 'mgrName', i: 0 } : toProduct(s)
}

/** C2 when something is billable; otherwise the order is all X rows and gets a call (map, Section 5). */
function toProduct(s: FlowState): Step {
  return totals(s).props > 0 ? { id: 'product' } : { id: 'call' }
}

/** Own path (map, 1.1 and 2): the lookup decides R1, otherwise the PMS count. */
function afterCompany(s: FlowState): Step {
  const hit = ownHit(s)
  if (hit) return hit.systems.length > 1 ? { id: 'ownSys' } : { id: 'props', k: 'own', i: 0 }
  return { id: 'pmsCount' }
}

/** The next screen after `step`, from the answers in `s` (map, Section 3). Null = the end of this ticket's flow:
 * paying, quoting, invoicing and the call request are wired in later tickets. */
export function next(s: FlowState, step: Step): Step | null {
  switch (step.id) {
    case 'start':
      return s.role === 'owner' ? { id: 'managed' } : s.role === 'manager' ? { id: 'company' } : { id: 'mgrName', i: 0 }
    case 'managed':
      return s.managed === 'third' ? { id: 'mgrName', i: 0 } : { id: 'company' }
    case 'company':
      return afterCompany(s)
    case 'ownSys':
      return { id: 'props', k: 'own', i: 0 }
    case 'pmsCount':
      return s.pmsCount === 0 ? { id: 'confirmNone' } : { id: 'pmsSystem', i: 0 }
    case 'confirmNone':
      // Yes = X2. "Both" still continues to the managers (map, 1.3); otherwise the call.
      return s.managed === 'both' ? { id: 'mgrName', i: 0 } : { id: 'call' }
    case 'pmsSystem':
      return OURS.includes(s.pms[step.i].system) ? { id: 'pmsAdmin', i: step.i } : { id: 'props', k: 'pms', i: step.i }
    case 'pmsAdmin':
      return { id: 'props', k: 'pms', i: step.i }
    case 'props':
      if (step.k === 'own') return step.i + 1 < ownSystems(s).length ? { id: 'props', k: 'own', i: step.i + 1 } : afterSelf(s)
      if (step.k === 'pms') return step.i + 1 < (s.pmsCount ?? 0) ? { id: 'pmsSystem', i: step.i + 1 } : afterSelf(s)
      return { id: 'moreMgr', i: step.i }
    case 'mgrName': {
      const hit = mgrHit(s, step.i)
      // R4 asks the contact up front (map, 1.2.1); R3 with one system asks nothing (1.2.2.1).
      if (hit && (hit.ticket || !hit.hasAdmin)) return { id: 'mgrContact', i: step.i, why: 'ticket' }
      if (hit && hit.systems.length <= 1) return { id: 'props', k: 'mgr', i: step.i }
      return { id: 'mgrSys', i: step.i }
    }
    case 'mgrSys': {
      const hit = mgrHit(s, step.i)
      const v = s.mgrs[step.i].sys
      if (hit) return v === 'unknown' ? { id: 'mgrContact', i: step.i, why: 'which' } : { id: 'props', k: 'mgr', i: step.i }
      if (v === 'Other') return { id: 'props', k: 'mgr', i: step.i }
      if (v === 'unknown') return { id: 'mgrContact', i: step.i, why: 'intro' }
      return { id: 'mgrKnowsAdmin', i: step.i }
    }
    case 'mgrKnowsAdmin':
      return s.mgrs[step.i].knowsAdmin === 'yes' ? { id: 'mgrAdmin', i: step.i } : { id: 'mgrContact', i: step.i, why: 'intro' }
    case 'mgrAdmin':
    case 'mgrContact':
      return { id: 'props', k: 'mgr', i: step.i }
    case 'moreMgr':
      return s.mgrs[step.i].more === 'yes' ? { id: 'mgrName', i: step.i + 1 } : toProduct(s)
    case 'product':
      return { id: 'you' }
    case 'you':
      return { id: 'checkout' }
    case 'checkout':
      return s.checkout === 'pay' ? { id: 'pay' } : null
    case 'pay':
    case 'call':
      return null
  }
}

/** Whether the current screen's answers are complete and valid. */
export function valid(s: FlowState, step: Step): boolean {
  switch (step.id) {
    case 'start':
      return !!s.role
    case 'managed':
      return !!s.managed
    case 'company':
      return !!s.company.trim()
    case 'ownSys':
      return s.ownSys.length > 0
    case 'pmsCount':
      return s.pmsCount !== null
    case 'confirmNone':
      return s.confirmNone === 'yes'
    case 'pmsSystem':
      return !!s.pms[step.i]?.system
    case 'pmsAdmin':
      return personOk(s.pms[step.i].admin)
    case 'props':
      return !rowErr(s.rows[rowKey(step)])
    case 'mgrName':
      return !!s.mgrs[step.i]?.name.trim()
    case 'mgrSys':
      return !!s.mgrs[step.i].sys
    case 'mgrKnowsAdmin':
      return !!s.mgrs[step.i].knowsAdmin
    case 'mgrAdmin':
      return personOk(s.mgrs[step.i].admin)
    case 'mgrContact':
      return personOk(s.mgrs[step.i].contact)
    case 'moreMgr':
      return !!s.mgrs[step.i].more
    case 'product':
      return !!s.product
    case 'you':
      return personOk(s.you, true) && (asksCompanyFirst(s) || !!s.company.trim())
    case 'checkout':
      // Save quote and Send invoice are submitted from this screen; only Pay now has a next one.
      return !!s.checkout
    case 'pay':
      return true
    case 'call':
      return personOk(s.caller)
  }
}

/** Entering a screen: make sure the state it edits exists. */
function prepare(s: FlowState, step: Step): FlowState {
  if (step.id === 'pmsSystem' || step.id === 'pmsAdmin') {
    const pms = s.pms.slice()
    while (pms.length <= step.i) pms.push(newPms())
    return { ...s, pms }
  }
  if (step.id === 'mgrName') {
    const mgrs = s.mgrs.slice()
    while (mgrs.length <= step.i) mgrs.push(newMgr())
    return { ...s, mgrs }
  }
  if (step.id === 'props') {
    const key = rowKey(step)
    if (s.rows[key]) return s
    // PropTech rows default to counts (map, 3); everyone else starts one by one (map, C1).
    const mode = s.role === 'proptech' ? 'count' : 'list'
    return { ...s, rows: { ...s.rows, [key]: newRow(mode) } }
  }
  return s
}

/** Continue: show the errors, or push the next screen. */
export function advance(s: FlowState): FlowState {
  const step = s.stack[s.stack.length - 1]
  if (step.id === 'confirmNone' && s.confirmNone === 'no') {
    // "No → back to the count" (map, 1.1.2.3).
    return { ...s, confirmNone: '', pmsCount: null, stack: s.stack.slice(0, -1) }
  }
  if (!valid(s, step)) return { ...s, tried: { ...s.tried, [stepKey(step)]: true } }
  const nx = next(s, step)
  if (!nx) return { ...s, tried: { ...s.tried, [stepKey(step)]: true } }
  return { ...prepare(s, nx), stack: [...s.stack, nx] }
}

export function back(s: FlowState): FlowState {
  return s.stack.length > 1 ? { ...s, stack: s.stack.slice(0, -1) } : s
}

/** The current screen. */
export function current(s: FlowState): Step {
  return s.stack[s.stack.length - 1]
}

/** Installation notice (map, "**"): on the screens that lead to an automated installation, R2 to R6 and A2, and
 * on the price and pay screens when the order holds such a row. Never for R1 or X rows. */
export function showsNotice(s: FlowState, step: Step): boolean {
  const auto = new Set(['R2', 'R3', 'R4', 'R5', 'R6', 'A2'])
  switch (step.id) {
    case 'pmsAdmin':
      return true // only one of our systems reaches this screen (R2)
    case 'mgrAdmin':
    case 'mgrContact':
      return true // A2; R4, R5, R6
    case 'props':
      return step.k === 'mgr' && mgrRoute(s, step.i).route === 'R3'
    case 'checkout':
    case 'pay':
      return rowList(s).some(r => auto.has(r.route))
    default:
      return false
  }
}

/** Progress: a rough share of the way through, 100 on the last screen. */
export function progress(s: FlowState): number {
  const step = current(s)
  if (step.id === 'pay' || step.id === 'call') return 100
  return Math.min(92, 6 + s.stack.length * 7)
}
