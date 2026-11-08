import { BI_TIERS, DA_FIRST, DA_RATE_1, DA_RATE_2, FREE, INVOICE_THRESHOLD, MGRS, OURS, type ManagerInfo } from './data'
import type { Problem } from './upload'

export type Role = 'owner' | 'manager' | 'proptech'
export type Managed = 'self' | 'third' | 'both'
export type Product = 'bi' | 'da'
export type CheckoutChoice = 'pay' | 'quote' | 'invoice'

export type Person = { first: string; last: string; email: string }
export const blank = (): Person => ({ first: '', last: '', email: '' })

export type Property = { id: number; name: string; addr: string; units: number; year: number }
export type PropsMode = 'list' | 'upload' | 'count'
export type Draft = { name: string; addr: string; units: string; year: string; looked: boolean; found: boolean; err: string }
export const emptyDraft = (): Draft => ({ name: '', addr: '', units: '', year: '', looked: false, found: false, err: '' })
/** C1, one per route row: properties one by one, an uploaded list, or counts (map, C1). An upload is parsed
 * into `items` (corrected on screen); `file`/`blob` keep the original for ticket 2 to store; when nothing could
 * be read the buyer types `count` and `units` instead. */
export type PropsRow = {
  mode: PropsMode
  items: Property[]
  count: number
  units: number
  file: string
  blob: File | null
  problems: Problem[]
  draft: Draft
}
export const newRow = (mode: PropsMode): PropsRow => ({ mode, items: [], count: 0, units: 0, file: '', blob: null, problems: [], draft: emptyDraft() })

/** One of the user's own PMSs (map, 1.1.2). `same` = the "Same administrator" box copied the first system's administrator in. */
export type PmsEntry = { system: string; admin: Person; same: boolean }
export const newPms = (): PmsEntry => ({ system: '', admin: blank(), same: false })

/** One third-party manager, or a PropTech's client (map, 1.2 and 3). */
export type MgrEntry = {
  name: string
  url: string
  /** The PMS picked: one of OURS, 'Other', 'unknown' or '' (not asked). */
  sys: string
  knowsAdmin: '' | 'yes' | 'no'
  admin: Person
  contact: Person
  more: '' | 'yes' | 'no'
}
export const newMgr = (): MgrEntry => ({ name: '', url: '', sys: '', knowsAdmin: '', admin: blank(), contact: blank(), more: '' })

export type Step =
  | { id: 'start' }
  | { id: 'managed' }
  | { id: 'company' }
  | { id: 'ownSys' }
  | { id: 'pmsCount' }
  | { id: 'confirmNone' }
  | { id: 'pmsSystem'; i: number }
  | { id: 'pmsAdmin'; i: number }
  | { id: 'props'; k: 'own' | 'pms' | 'mgr'; i: number }
  | { id: 'mgrName'; i: number }
  | { id: 'mgrSys'; i: number }
  | { id: 'mgrKnowsAdmin'; i: number }
  | { id: 'mgrAdmin'; i: number }
  | { id: 'mgrContact'; i: number; why: 'ticket' | 'which' | 'intro' }
  | { id: 'moreMgr'; i: number }
  | { id: 'product' }
  | { id: 'you' }
  | { id: 'checkout' }
  | { id: 'pay' }
  | { id: 'call' }

export type FlowState = {
  /** The built-in list (ticket 2: live from the managers endpoint). */
  managers: ManagerInfo[]
  /** The screens visited, last = current. Back pops; answers are kept. */
  stack: Step[]
  /** Steps where Continue was pressed with errors: their errors are shown. */
  tried: Record<string, boolean>
  company: string
  companyUrl: string
  role: Role | ''
  managed: Managed | ''
  /** R1 with more than one integration: which of the company's systems hold the properties. */
  ownSys: string[]
  pmsCount: number | null
  confirmNone: '' | 'yes' | 'no'
  pms: PmsEntry[]
  mgrs: MgrEntry[]
  rows: Record<string, PropsRow>
  product: Product | ''
  you: Person
  checkout: CheckoutChoice | ''
  caller: Person
}

export const initialState: FlowState = {
  managers: MGRS,
  stack: [{ id: 'start' }],
  tried: {},
  company: '',
  companyUrl: '',
  role: '',
  managed: '',
  ownSys: [],
  pmsCount: null,
  confirmNone: '',
  pms: [],
  mgrs: [newMgr()],
  rows: {},
  product: '',
  you: blank(),
  checkout: '',
  caller: blank(),
}

export function stepKey(step: Step): string {
  return step.id + ('k' in step ? ':' + step.k : '') + ('i' in step ? ':' + step.i : '') + ('why' in step ? ':' + step.why : '')
}

export function rowKey(step: { k: 'own' | 'pms' | 'mgr'; i: number }): string {
  return step.k + step.i
}

export function patchMgr(s: FlowState, i: number, p: Partial<MgrEntry>): Partial<FlowState> {
  return { mgrs: s.mgrs.map((m, j) => (j === i ? { ...m, ...p } : m)) }
}

export function patchPms(s: FlowState, i: number, p: Partial<PmsEntry>): Partial<FlowState> {
  return { pms: s.pms.map((m, j) => (j === i ? { ...m, ...p } : m)) }
}

/* ---------- lookup (map, Rule 13) ---------- */

export function normUrl(u: string): string {
  return u
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
}

/** Website first (the more precise match), then the exact name. */
export function lookup(managers: ManagerInfo[], name: string, url: string): ManagerInfo | null {
  const u = normUrl(url || '')
  if (u) {
    const byUrl = managers.find(m => m.website && normUrl(m.website) === u)
    if (byUrl) return byUrl
  }
  const n = (name || '').trim().toLowerCase()
  return n ? (managers.find(m => m.name.toLowerCase() === n) ?? null) : null
}

/** Suggestions after the first 5 characters. */
export function suggest(managers: ManagerInfo[], q: string): ManagerInfo[] {
  const s = q.trim().toLowerCase()
  if (s.length < 5) return []
  return managers.filter(m => m.name.toLowerCase().includes(s)).slice(0, 7)
}

/* ---------- validation ---------- */

export function emailErr(v: string, work = false): string {
  const e = (v || '').trim().toLowerCase()
  if (!e) return 'Required'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return 'Enter a valid email address.'
  if (work && FREE.includes(e.split('@')[1])) return 'Please use a work email, not a personal address.'
  return ''
}

export function personErr(p: Person, work = false): Person {
  return { first: p.first.trim() ? '' : 'Required', last: p.last.trim() ? '' : 'Required', email: emailErr(p.email, work) }
}

export function personOk(p: Person, work = false): boolean {
  const e = personErr(p, work)
  return !e.first && !e.last && !e.email
}

export function rowErr(r: PropsRow | undefined): string {
  if (!r) return 'Add at least one property.'
  if (r.mode === 'list') return r.items.length ? '' : 'Add at least one property.'
  if (r.mode === 'upload') {
    if (!r.file) return 'Attach your property list.'
    if (r.items.length) return r.items.every(p => p.units > 0) ? '' : 'Enter the units for every property.'
  }
  return r.count > 0 && r.units > 0 ? '' : 'Enter a property count and units.'
}

/* ---------- routes (map, Section 2) ---------- */

export type RouteCode = 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'A2' | 'X1' | 'X2'

export type RouteRow = {
  key: string
  kind: 'own' | 'pms' | 'mgr'
  i: number
  route: RouteCode
  billable: boolean
  /** The PMS, when known. */
  system: string
  /** The manager's name (or the user's own company). */
  party: string
  manager: ManagerInfo | null
  /** The person we will write to: an admin (R2, A2) or the user's contact at the manager (R4, R5, R6). */
  person: Person | null
}

export const ROUTE_TEXT: Record<RouteCode, string> = {
  R1: 'Your company is already connected. Nothing to set up.',
  R2: 'We email your system administrator to set up the connection.',
  R3: 'We email the manager’s system administrator, from you, to share your properties.',
  R4: 'We email your contact at the manager, who submits the request on their side.',
  R5: 'We email your contact at the manager for an introduction.',
  R6: 'We email your contact at the manager to ask which system holds your properties.',
  A2: 'We email the manager’s system administrator to set up the connection.',
  X1: 'Not one of our connected systems: covered on a call, not billed.',
  X2: 'No system to connect: covered on a call, not billed.',
}

export function includesSelf(s: FlowState): boolean {
  return s.role === 'manager' || s.managed === 'self' || s.managed === 'both'
}

/** Whether the company name has its own screen: only when the buyer manages properties itself, where the
 * answer drives the integration lookup. Otherwise it is asked once, with the login details. */
export function asksCompanyFirst(s: FlowState): boolean {
  return includesSelf(s)
}

export function includesMgr(s: FlowState): boolean {
  return s.role === 'proptech' || s.managed === 'third' || s.managed === 'both'
}

export function ownHit(s: FlowState): ManagerInfo | null {
  return lookup(s.managers, s.company, s.companyUrl)
}

export function mgrHit(s: FlowState, i: number): ManagerInfo | null {
  const m = s.mgrs[i]
  return m ? lookup(s.managers, m.name, m.url) : null
}

/** The systems an R1 company's properties can be on: the chosen ones, or its single integration. */
export function ownSystems(s: FlowState): string[] {
  const hit = ownHit(s)
  if (!hit) return []
  if (hit.systems.length > 1) return s.ownSys
  return [hit.systems[0] ?? '']
}

export function mgrRoute(s: FlowState, i: number): { route: RouteCode; system: string; person: Person | null } {
  const m = s.mgrs[i]
  const hit = mgrHit(s, i)
  if (hit) {
    // The ticket path never asks the system; the manager's one integration says which email its contact gets.
    if (hit.ticket || !hit.hasAdmin) return { route: 'R4', system: hit.systems.length === 1 ? hit.systems[0] : '', person: m.contact }
    if (hit.systems.length <= 1) return { route: 'R3', system: hit.systems[0] ?? '', person: null }
    if (m.sys === 'unknown') return { route: 'R6', system: '', person: m.contact }
    return { route: 'R3', system: m.sys, person: null }
  }
  if (m.sys === 'Other') return { route: 'X1', system: m.sys, person: null }
  if (m.sys === 'unknown' || m.sys === '') return { route: 'R5', system: '', person: m.contact }
  if (m.knowsAdmin === 'no') return { route: 'R5', system: m.sys, person: m.contact }
  return { route: 'A2', system: m.sys, person: m.admin }
}

/** Every management relationship in the order, each with its route (map, Rule 9: X rows are listed, not billed). */
export function rowList(s: FlowState): RouteRow[] {
  const out: RouteRow[] = []
  if (includesSelf(s)) {
    const hit = ownHit(s)
    if (hit) {
      ownSystems(s).forEach((system, i) =>
        out.push({ key: 'own' + i, kind: 'own', i, route: 'R1', billable: true, system, party: s.company, manager: hit, person: null }),
      )
    } else if (s.pmsCount === 0) {
      out.push({ key: 'x2', kind: 'own', i: 0, route: 'X2', billable: false, system: '', party: s.company, manager: null, person: null })
    } else {
      s.pms.forEach((p, i) => {
        const ours = OURS.includes(p.system)
        out.push({
          key: 'pms' + i,
          kind: 'pms',
          i,
          route: ours ? 'R2' : 'X1',
          billable: ours,
          system: p.system,
          party: s.company,
          manager: null,
          person: ours ? p.admin : null,
        })
      })
    }
  }
  if (includesMgr(s)) {
    s.mgrs.forEach((m, i) => {
      if (!m.name.trim()) return
      const r = mgrRoute(s, i)
      out.push({
        key: 'mgr' + i,
        kind: 'mgr',
        i,
        route: r.route,
        billable: r.route !== 'X1',
        system: r.system,
        party: mgrHit(s, i)?.name ?? m.name,
        manager: mgrHit(s, i),
        person: r.person,
      })
    })
  }
  return out
}

/* ---------- totals and prices (map, Rule 5) ---------- */

export function rowTotals(r: PropsRow | undefined): { props: number; units: number } {
  if (!r) return { props: 0, units: 0 }
  if (r.mode === 'list' || (r.mode === 'upload' && r.items.length)) {
    return { props: r.items.length, units: r.items.reduce((t, x) => t + (x.units || 0), 0) }
  }
  return { props: r.count || 0, units: r.units || 0 }
}

export type Totals = { props: number; units: number; offProps: number; offUnits: number }

export function totals(s: FlowState): Totals {
  const t: Totals = { props: 0, units: 0, offProps: 0, offUnits: 0 }
  for (const row of rowList(s)) {
    const rt = rowTotals(s.rows[row.key])
    if (row.billable) {
      t.props += rt.props
      t.units += rt.units
    } else {
      t.offProps += rt.props
      t.offUnits += rt.units
    }
  }
  return t
}

export function biPrice(units: number): number {
  let left = units
  let total = 0
  for (const [size, rate] of BI_TIERS) {
    const n = Math.min(left, size)
    total += n * rate
    left -= n
    if (left <= 0) break
  }
  return total
}

export function daPrice(props: number): number {
  const n = Math.max(props, 1)
  return Math.min(n, DA_FIRST) * DA_RATE_1 + Math.max(n - DA_FIRST, 0) * DA_RATE_2
}

export function monthly(s: FlowState): number {
  const t = totals(s)
  return s.product === 'da' ? daPrice(t.props) : biPrice(t.units)
}

export function money(n: number): string {
  const whole = Math.round(n * 100) % 100 === 0
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })
}

/** C4: Save quote and Pay now always; Send invoice only above the threshold (map, Rule 12). */
export function checkoutOptions(monthlyTotal: number): CheckoutChoice[] {
  return monthlyTotal > INVOICE_THRESHOLD ? ['pay', 'quote', 'invoice'] : ['pay', 'quote']
}

/** The BI tier breakdown for a unit count, for the price card. */
export function biBreakdown(units: number): string[] {
  const out: string[] = []
  let left = units
  let from = 1
  for (const [size, rate] of BI_TIERS) {
    const n = Math.min(left, size)
    if (n <= 0) break
    out.push(n.toLocaleString('en-US') + ' units × $' + rate.toFixed(2) + (from > 1 ? ' (from ' + from.toLocaleString('en-US') + ')' : ''))
    left -= n
    from += size
  }
  return out
}
