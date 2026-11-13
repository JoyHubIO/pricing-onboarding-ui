/** The order the page submits (joyhub-integration, `POST /pricing/order`): the one submit behind Save quote,
 * Pay now and Send invoice. The server prices the rows again; its figure is the one the order carries. */
import { initialState, monthly, rowList, rowTotals, totals, type CheckoutChoice, type FlowState, type Person, type PropsRow } from './model'
import type { ManagerInfo } from './data'

export type PersonIn = { first: string; last: string; email: string }
export type PropertyIn = { name: string; address: string | null; units: number; yearBuilt: number | null }
export type PropertiesIn = {
  mode: string
  count: number
  units: number
  file: string | null
  items: PropertyIn[]
  fileType: string | null
  fileData: string | null
}
export type OrderRowIn = {
  key: string
  kind: string
  route: string
  billable: boolean
  system: string | null
  party: string
  managerWebsite: string | null
  person: PersonIn | null
  properties: PropertiesIn | null
}
/** PricingOrderIn. `page` is this page's own answers, handed back with a reopened quote. */
export type OrderIn = {
  company: string
  companyWebsite: string | null
  role: string
  managed: string | null
  product: string
  properties: number
  units: number
  monthlyTotal: number
  firstName: string
  lastName: string
  email: string
  checkout: CheckoutChoice
  rows: OrderRowIn[]
  confirmedCompanyId: number | null
  createNewCompany: boolean | null
  page: unknown
}

/** The buyer's answer to "is one of these your company?" (map, C3). */
export type CompanyAnswer = { confirmedCompanyId?: number; createNewCompany?: boolean }

/** OrderResultDto. */
export type OrderResult = {
  needsConfirmation: boolean
  candidates: { id: number; name: string; website?: string | null }[]
  number?: string | null
  monthlyTotal?: number | null
  checkout?: string | null
}

/** SavedQuoteDto. */
export type SavedQuote = {
  number: string
  status: string
  monthlyTotal: number
  currentTotal: number
  validUntil: string
  expired: boolean
  replaced: boolean
  payload: { page?: unknown }
}

const person = (p: Person | null): PersonIn | null => (p && p.email.trim() ? { first: p.first.trim(), last: p.last.trim(), email: p.email.trim() } : null)

function properties(r: PropsRow | undefined, file: { type: string; data: string } | undefined): PropertiesIn | null {
  if (!r) return null
  const t = rowTotals(r)
  return {
    mode: r.mode,
    count: t.props,
    units: t.units,
    file: r.file || null,
    items: r.mode === 'count' ? [] : r.items.map(x => ({ name: x.name, address: x.addr || null, units: x.units || 0, yearBuilt: x.year || null })),
    fileType: file ? file.type : null,
    fileData: file ? file.data : null,
  }
}

/** The page's answers as stored with the order: everything but the manager list, which is loaded fresh, and
 * the uploaded files, which travel on their rows. */
export function snapshot(s: FlowState): unknown {
  const rows: Record<string, PropsRow> = {}
  for (const [k, r] of Object.entries(s.rows)) rows[k] = { ...r, blob: null }
  return { ...s, managers: [], tried: {}, rows }
}

/** A stored snapshot back as page state on today's manager list, or null when it is not one of ours. */
export function restore(page: unknown, managers: ManagerInfo[]): FlowState | null {
  if (!page || typeof page !== 'object') return null
  const p = page as Partial<FlowState>
  if (!Array.isArray(p.stack) || !p.stack.length || !Array.isArray(p.mgrs) || !Array.isArray(p.pms) || typeof p.rows !== 'object' || !p.rows) return null
  return { ...initialState, ...p, managers, tried: {} }
}

/** An uploaded file's bytes, base64, per row key. */
export type Files = Record<string, { type: string; data: string }>

export async function readFiles(s: FlowState): Promise<Files> {
  const out: Files = {}
  for (const [k, r] of Object.entries(s.rows)) {
    if (r.mode !== 'upload' || !r.blob) continue
    const bytes = new Uint8Array(await r.blob.arrayBuffer())
    let bin = ''
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    out[k] = { type: r.blob.type || 'application/octet-stream', data: btoa(bin) }
  }
  return out
}

export function toOrder(s: FlowState, checkout: CheckoutChoice, files: Files = {}, answer: CompanyAnswer = {}): OrderIn {
  const t = totals(s)
  return {
    company: s.company.trim(),
    companyWebsite: s.companyUrl.trim() || null,
    role: s.role,
    managed: s.managed || null,
    product: s.product,
    properties: t.props,
    units: t.units,
    monthlyTotal: monthly(s),
    firstName: s.you.first.trim(),
    lastName: s.you.last.trim(),
    email: s.you.email.trim(),
    checkout,
    rows: rowList(s).map(r => ({
      key: r.key,
      kind: r.kind,
      route: r.route,
      billable: r.billable,
      system: r.system || null,
      party: r.party.trim(),
      managerWebsite: r.kind === 'mgr' ? r.manager?.website || s.mgrs[r.i]?.url.trim() || null : null,
      person: person(r.person),
      properties: properties(s.rows[r.key], files[r.key]),
    })),
    confirmedCompanyId: answer.confirmedCompanyId ?? null,
    createNewCompany: answer.createNewCompany ?? null,
    page: snapshot(s),
  }
}

/** What the screen says for a rejection code; anything unlisted gets the general line. */
export const ORDER_ERRORS: Record<string, string> = {
  work_email_required: 'Please use your work email address.',
  nothing_to_price: 'Add at least one property before saving.',
  invoice_not_offered: 'An invoice is available for orders of $1,000 a month or more.',
  file_too_large: 'The uploaded list is too large. Please upload a file under 2 MB.',
  quote_unavailable: 'We can’t save this right now. Please try again shortly.',
}
export const ORDER_FAILED = 'We couldn’t save this. Please try again.'
