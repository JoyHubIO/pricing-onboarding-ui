/** Test scenarios: one per route case in the map (Pricing Workflow Map v2, Sections 1 and 2),
 * each built by walking the real flow with stand-in answers. The companies are real: `cast` picks, from the
 * loaded manager list, one company for each combination of facts a case needs, and a case with no such
 * company today says so. The routes panel lists them and loads one in a click; the tests check that every
 * one lands where the map says. */
import type { ManagerInfo } from './data'
import { advance, current } from './flow'
import { initialState, lookup, newRow, patchMgr, patchPms, rowKey, type FlowState, type Person, type RouteCode } from './model'

export type Group = 'Self-managed' | 'Third-party manager' | 'Mixed orders'

export type Scenario = {
  id: string
  /** The route code of every row in the order, in row order. */
  codes: RouteCode[]
  label: string
  group: Group
  /** The map section that decides it. */
  map: string
  /** How to reach it by hand from "Start over". */
  recipe: string
  /** Where the loaded order lands: the price with its routes, or the call screen for an all-offline order. */
  landing: 'checkout' | 'call'
  /** The kinds of company the case needs from the manager list. */
  needs: Need[]
  /** Set when the list has no company of a needed kind: the case cannot be loaded, and this says why. */
  missing?: string
  build: () => FlowState
}

/* ---------- the cast: real companies for each kind a case needs ---------- */

export type Need = 'single' | 'multi' | 'site' | 'flagged' | 'noAdmin' | 'noAdminMulti' | 'ticket'

export const NEED_LABEL: Record<Need, string> = {
  single: 'one system, administrator known, no ticket flag',
  multi: 'several systems, administrator known, no ticket flag',
  site: 'one system, administrator known, no ticket flag, with a website',
  flagged: 'the ticket flag set',
  noAdmin: 'one system and no administrator on the deal',
  noAdminMulti: 'several systems and no administrator on the deal',
  ticket: 'the ticket flag set, or no administrator on the deal',
}

const KIND: Record<Need, (m: ManagerInfo) => boolean> = {
  single: m => m.systems.length <= 1 && m.hasAdmin && !m.ticket,
  multi: m => m.systems.length > 1 && m.hasAdmin && !m.ticket,
  site: m => m.systems.length <= 1 && m.hasAdmin && !m.ticket && !!m.website,
  flagged: m => m.ticket,
  noAdmin: m => m.systems.length <= 1 && !m.hasAdmin && !m.ticket,
  noAdminMulti: m => m.systems.length > 1 && !m.hasAdmin && !m.ticket,
  ticket: m => m.ticket || !m.hasAdmin,
}

/** Every company of each kind, in list order: the case finder behind the panel and the route checklist. */
export function companies(managers: ManagerInfo[]): Record<Need, ManagerInfo[]> {
  const of = (need: Need) => managers.filter(KIND[need])
  return { single: of('single'), multi: of('multi'), site: of('site'), flagged: of('flagged'), noAdmin: of('noAdmin'), noAdminMulti: of('noAdminMulti'), ticket: of('ticket') }
}

/** The first company of each kind, or none. */
export function cast(managers: ManagerInfo[]): Partial<Record<Need, ManagerInfo>> {
  const all = companies(managers)
  const picked: Partial<Record<Need, ManagerInfo>> = {}
  for (const need of Object.keys(all) as Need[]) if (all[need][0]) picked[need] = all[need][0]
  return picked
}

/** A company name the list does not hold, for the cases about a company we have never seen. */
function unknown(managers: ManagerInfo[], name: string): string {
  let n = name
  while (lookup(managers, n, '')) n += ' Test'
  return n
}

/* ---------- stand-in people ---------- */

const who = (first: string, last: string, email: string): Person => ({ first, last, email })
export const BUYER = who('Ann', 'Buyer', 'ann.buyer@acme-holdings.com')
export const ADMIN = who('Sam', 'Admin', 'sam.admin@acme-holdings.com')
export const ADMIN_2 = who('Jo', 'Systems', 'jo.systems@acme-holdings.com')
export const MGR_ADMIN = who('Pat', 'Sysadmin', 'pat.sysadmin@fresh-management.example')
export const CONTACT = who('Lee', 'Regional', 'lee.regional@manager.example')

/* ---------- walking helpers ---------- */

const go = (s: FlowState, patch: Partial<FlowState> = {}): FlowState => advance({ ...s, ...patch })

const index = (s: FlowState): number => {
  const step = current(s)
  return 'i' in step ? step.i : 0
}

/** Continue through the current properties screen with counts. */
const counts = (s: FlowState, props: number, units: number): FlowState => {
  const step = current(s)
  if (step.id !== 'props') throw new Error('not on a properties screen: ' + step.id)
  return go(s, { rows: { ...s.rows, [rowKey(step)]: { ...newRow('count'), count: props, units } } })
}

/** Name the current manager and continue. */
const manager = (s: FlowState, name: string): FlowState => go(s, patchMgr(s, index(s), { name }))

const system = (s: FlowState, sys: string): FlowState => go(s, patchMgr(s, index(s), { sys }))
const knowsAdmin = (s: FlowState, v: 'yes' | 'no'): FlowState => go(s, patchMgr(s, index(s), { knowsAdmin: v }))
const admin = (s: FlowState, p: Person): FlowState => go(s, patchMgr(s, index(s), { admin: p }))
const contact = (s: FlowState, p: Person): FlowState => go(s, patchMgr(s, index(s), { contact: p }))
const more = (s: FlowState, v: 'yes' | 'no'): FlowState => go(s, patchMgr(s, index(s), { more: v }))

const pmsSystem = (s: FlowState, sys: string): FlowState => go(s, patchPms(s, index(s), { system: sys }))
const pmsAdmin = (s: FlowState, p: Person, same = false): FlowState => go(s, patchPms(s, index(s), { admin: p, same }))

/** Product and buyer: lands on the price. A third-party order asks the company with the login (map, C3). */
const finish = (s: FlowState, product: 'bi' | 'da' = 'bi'): FlowState =>
  go(go(s, { product }), { you: BUYER, company: s.company.trim() ? s.company : 'Acme Holdings' })


/* ---------- the cases ---------- */

/** Every route case, built on `managers`. A case whose kind of company the list lacks carries `missing`. */
export function scenarios(managers: ManagerInfo[]): Scenario[] {
  const base: FlowState = { ...initialState, managers }
  const c = cast(managers)
  const n = {
    single: c.single?.name ?? '',
    multi: c.multi?.name ?? '',
    sysA: c.multi?.systems[0] ?? '',
    sysB: c.multi?.systems[1] ?? '',
    site: c.site?.name ?? '',
    siteUrl: c.site?.website ?? '',
    flagged: c.flagged?.name ?? '',
    noAdmin: c.noAdmin?.name ?? '',
    noAdminMulti: c.noAdminMulti?.name ?? '',
    ticket: c.ticket?.name ?? '',
    fresh: unknown(managers, 'Fresh Management'),
    acme: unknown(managers, 'Acme Holdings'),
  }
  const selfOwner = (company: string): FlowState => go(go(go(base, { role: 'owner' }), { managed: 'self' }), { company })
  const thirdOwner = (): FlowState => go(go(base, { role: 'owner' }), { managed: 'third' })
  const list: Scenario[] = [
  {
    id: 'r1-one',
    needs: ['single'],
    codes: ['R1'],
    label: 'R1, one system',
    group: 'Self-managed',
    map: '1.1.1',
    recipe: `Owner · We self-manage · Company "${n.single}" · properties.`,
    landing: 'checkout',
    build: () => finish(counts(selfOwner(n.single), 3, 300)),
  },
  {
    id: 'r1-pick',
    needs: ['multi'],
    codes: ['R1', 'R1'],
    label: 'R1, pick the systems',
    group: 'Self-managed',
    map: '1.1.1, Rule 2a',
    recipe: `Manager · Company "${n.multi}" · pick ${n.sysA} and ${n.sysB} · properties for each.`,
    landing: 'checkout',
    build: () => {
      let s = go(go(base, { role: 'manager' }), { company: n.multi })
      s = go(s, { ownSys: [n.sysA, n.sysB] })
      s = counts(s, 2, 200)
      s = counts(s, 1, 100)
      return finish(s)
    },
  },
  {
    id: 'r1-website',
    needs: ['site'],
    codes: ['R1'],
    label: 'R1, matched by website',
    group: 'Self-managed',
    map: 'Rule 13',
    recipe: `Owner · We self-manage · Company "Not ${n.site}", website "${n.siteUrl}" · properties.`,
    landing: 'checkout',
    build: () => finish(counts(go(go(go(base, { role: 'owner' }), { managed: 'self' }), { company: 'Not ' + n.site, companyUrl: n.siteUrl }), 2, 180)),
  },
  {
    id: 'r2',
    needs: [],
    codes: ['R2'],
    label: 'R2, one of our systems',
    group: 'Self-managed',
    map: '1.1.2.1',
    recipe: `Owner · We self-manage · Company "${n.acme}" · 1 system · Yardi · administrator · properties.`,
    landing: 'checkout',
    build: () => {
      let s = go(selfOwner(n.acme), { pmsCount: 1 })
      s = pmsSystem(s, 'Yardi')
      s = pmsAdmin(s, ADMIN)
      return finish(counts(s, 4, 400))
    },
  },
  {
    id: 'r2-same-admin',
    needs: [],
    codes: ['R2', 'R2'],
    label: 'R2, two systems, same administrator',
    group: 'Self-managed',
    map: '1.1.2.1',
    recipe: `Owner · We self-manage · "${n.acme}" · 2 systems · Yardi, administrator · RealPage, "same administrator".`,
    landing: 'checkout',
    build: () => {
      let s = go(selfOwner(n.acme), { pmsCount: 2 })
      s = pmsSystem(s, 'Yardi')
      s = pmsAdmin(s, ADMIN)
      s = counts(s, 1, 100)
      s = pmsSystem(s, 'RealPage')
      s = pmsAdmin(s, ADMIN, true)
      return finish(counts(s, 1, 100))
    },
  },
  {
    id: 'x1-self',
    needs: [],
    codes: ['R2', 'X1'],
    label: 'X1 beside R2, a system not ours',
    group: 'Self-managed',
    map: '1.1.2.2, Rule 9',
    recipe: `Owner · We self-manage · "${n.acme}" · 2 systems · Yardi, administrator · Other · the Other row is not billed.`,
    landing: 'checkout',
    build: () => {
      let s = go(selfOwner(n.acme), { pmsCount: 2 })
      s = pmsSystem(s, 'Yardi')
      s = pmsAdmin(s, ADMIN_2)
      s = counts(s, 2, 200)
      s = pmsSystem(s, 'Other')
      return finish(counts(s, 5, 500))
    },
  },
  {
    id: 'x1-only',
    needs: [],
    codes: ['X1'],
    label: 'X1 alone, the call',
    group: 'Self-managed',
    map: '1.1.2.2, Section 5',
    recipe: `Owner · We self-manage · "${n.acme}" · 1 system · Other · properties · nothing billable, so the call.`,
    landing: 'call',
    build: () => {
      let s = go(selfOwner(n.acme), { pmsCount: 1 })
      s = pmsSystem(s, 'Other')
      return counts(s, 5, 500)
    },
  },
  {
    id: 'x2',
    needs: [],
    codes: ['X2'],
    label: 'X2, no system',
    group: 'Self-managed',
    map: '1.1.2.3',
    recipe: `Owner · We self-manage · "${n.acme}" · None · Yes, set up a call.`,
    landing: 'call',
    build: () => go(go(selfOwner(n.acme), { pmsCount: 0 }), { confirmNone: 'yes' }),
  },
  {
    id: 'r3-one',
    needs: ['single'],
    codes: ['R3'],
    label: 'R3, one system, admin known',
    group: 'Third-party manager',
    map: '1.2.2.1',
    recipe: `Owner · A third-party manager · "${n.single}" · properties. No system question.`,
    landing: 'checkout',
    build: () => finish(more(counts(manager(thirdOwner(), n.single), 3, 300), 'no')),
  },
  {
    id: 'r3-picked',
    needs: ['multi'],
    codes: ['R3'],
    label: 'R3, several systems, owner knows which',
    group: 'Third-party manager',
    map: '1.2.2.2.1',
    recipe: `Owner · A third-party manager · "${n.multi}" · pick ${n.sysA} · properties.`,
    landing: 'checkout',
    build: () => finish(more(counts(system(manager(thirdOwner(), n.multi), n.sysA), 3, 300), 'no')),
  },
  {
    id: 'r6',
    needs: ['multi'],
    codes: ['R6'],
    label: 'R6, several systems, owner does not know',
    group: 'Third-party manager',
    map: '1.2.2.2.2',
    recipe: `Owner · A third-party manager · "${n.multi}" · I don’t know · your contact there · properties.`,
    landing: 'checkout',
    build: () => finish(more(counts(contact(system(manager(thirdOwner(), n.multi), 'unknown'), CONTACT), 3, 300), 'no')),
  },
  {
    id: 'r4-flag',
    needs: ['flagged'],
    codes: ['R4'],
    label: 'R4, ticket flag',
    group: 'Third-party manager',
    map: '1.2.1',
    recipe: `Owner · A third-party manager · "${n.flagged}" · your regional or property manager · properties.`,
    landing: 'checkout',
    build: () => finish(more(counts(contact(manager(thirdOwner(), n.flagged), CONTACT), 6, 600), 'no')),
  },
  {
    id: 'r4-no-admin',
    needs: ['noAdmin'],
    codes: ['R4'],
    label: 'R4, no admin on the deal',
    group: 'Third-party manager',
    map: '1.2.1',
    recipe: `Owner · A third-party manager · "${n.noAdmin}" · your contact there · properties.`,
    landing: 'checkout',
    build: () => finish(more(counts(contact(manager(thirdOwner(), n.noAdmin), CONTACT), 2, 240), 'no')),
  },
  {
    id: 'r4-no-admin-two',
    needs: ['noAdminMulti'],
    codes: ['R4'],
    label: 'R4, no admin, two systems',
    group: 'Third-party manager',
    map: '1.2.1 before 1.2.2.2',
    recipe: `Owner · A third-party manager · "${n.noAdminMulti}" · your contact there · properties. The ticket check wins over the system count.`,
    landing: 'checkout',
    build: () => finish(more(counts(contact(manager(thirdOwner(), n.noAdminMulti), CONTACT), 2, 240), 'no')),
  },
  {
    id: 'a2',
    needs: [],
    codes: ['A2'],
    label: 'A2, new integration, admin known',
    group: 'Third-party manager',
    map: '1.2.3.1',
    recipe: `Owner · A third-party manager · "${n.fresh}" · Yardi · knows the admin: Yes · admin · properties.`,
    landing: 'checkout',
    build: () => finish(more(counts(admin(knowsAdmin(system(manager(thirdOwner(), n.fresh), 'Yardi'), 'yes'), MGR_ADMIN), 3, 300), 'no')),
  },
  {
    id: 'r5-unknown-system',
    needs: [],
    codes: ['R5'],
    label: 'R5, system unknown',
    group: 'Third-party manager',
    map: '1.2.3.2',
    recipe: `Owner · A third-party manager · "${n.fresh}" · I don’t know · introduce us to someone · properties.`,
    landing: 'checkout',
    build: () => finish(more(counts(contact(system(manager(thirdOwner(), n.fresh), 'unknown'), CONTACT), 3, 300), 'no')),
  },
  {
    id: 'r5-unknown-admin',
    needs: [],
    codes: ['R5'],
    label: 'R5, system known, admin unknown',
    group: 'Third-party manager',
    map: '1.2.3.2',
    recipe: `Owner · A third-party manager · "${n.fresh}" · RealPage · knows the admin: No · introduce us to someone · properties.`,
    landing: 'checkout',
    build: () => finish(more(counts(contact(knowsAdmin(system(manager(thirdOwner(), n.fresh), 'RealPage'), 'no'), CONTACT), 3, 300), 'no')),
  },
  {
    id: 'x1-manager',
    needs: [],
    codes: ['X1'],
    label: 'X1, manager on a system not ours',
    group: 'Third-party manager',
    map: '1.2.3.3, Section 5',
    recipe: `Owner · A third-party manager · "${n.fresh}" · Other · properties · the call.`,
    landing: 'call',
    build: () => more(counts(system(manager(thirdOwner(), n.fresh), 'Other'), 3, 300), 'no'),
  },
  {
    id: 'both',
    needs: ['ticket'],
    codes: ['R2', 'R4'],
    label: 'Both: own system, then a manager',
    group: 'Mixed orders',
    map: '1.3',
    recipe: `Owner · Both · "${n.acme}" · 1 system · Yardi, administrator · properties · "${n.ticket}" · contact · properties.`,
    landing: 'checkout',
    build: () => {
      let s = go(go(go(base, { role: 'owner' }), { managed: 'both' }), { company: n.acme })
      s = go(s, { pmsCount: 1 })
      s = pmsSystem(s, 'Yardi')
      s = pmsAdmin(s, ADMIN)
      s = counts(s, 2, 200)
      s = manager(s, n.ticket)
      s = contact(s, CONTACT)
      s = counts(s, 4, 400)
      return finish(more(s, 'no'))
    },
  },
  {
    id: 'both-x2',
    needs: ['single'],
    codes: ['X2', 'R3'],
    label: 'Both: no own system, manager goes ahead',
    group: 'Mixed orders',
    map: '1.3, Rule 9',
    recipe: `Owner · Both · "${n.acme}" · None · Yes · "${n.single}" · properties. X2 gets the call, R3 checks out.`,
    landing: 'checkout',
    build: () => {
      let s = go(go(go(base, { role: 'owner' }), { managed: 'both' }), { company: n.acme })
      s = go(go(s, { pmsCount: 0 }), { confirmNone: 'yes' })
      s = manager(s, n.single)
      s = counts(s, 3, 300)
      return finish(more(s, 'no'))
    },
  },
  {
    id: 'two-managers',
    needs: ['single', 'multi'],
    codes: ['R3', 'X1', 'R6'],
    label: 'Three managers, one offline',
    group: 'Mixed orders',
    map: '1.2, Rule 9',
    recipe: `Owner · A third-party manager · "${n.single}" · "${n.fresh}", Other · "${n.multi}", I don’t know. The Other row is not billed.`,
    landing: 'checkout',
    build: () => {
      let s = more(counts(manager(thirdOwner(), n.single), 2, 200), 'yes')
      s = more(counts(system(manager(s, n.fresh), 'Other'), 3, 300), 'yes')
      s = more(counts(contact(system(manager(s, n.multi), 'unknown'), CONTACT), 4, 400), 'no')
      return finish(s, 'da')
    },
  },
  {
    id: 'proptech',
    needs: ['single'],
    codes: ['R3', 'R5'],
    label: 'PropTech, two clients',
    group: 'Mixed orders',
    map: '3',
    recipe: `PropTech · client "${n.single}" · counts · another client "${n.fresh}", I don’t know · contact · counts · company and login.`,
    landing: 'checkout',
    build: () => {
      let s = more(counts(manager(go(base, { role: 'proptech' }), n.single), 10, 1000), 'yes')
      s = more(counts(contact(system(manager(s, n.fresh), 'unknown'), CONTACT), 5, 500), 'no')
      return go(go(s, { product: 'da' }), { you: BUYER, company: 'Acme PropTech' })
    },
  },
]
  return list.map(sc => {
    const lacking = sc.needs.filter(need => !c[need])
    return lacking.length ? { ...sc, missing: 'No company in the list with ' + lacking.map(need => NEED_LABEL[need]).join(', or with ') + '.' } : sc
  })
}

export const GROUPS: Group[] = ['Self-managed', 'Third-party manager', 'Mixed orders']
