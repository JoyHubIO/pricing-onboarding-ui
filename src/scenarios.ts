/** Test scenarios: one per route case in the map (Pricing Workflow Map v2, Sections 1 and 2),
 * each built by walking the real flow with stand-in answers. The routes panel lists them and loads one in a
 * click; the tests check that every one lands where the map says. Demo data only: the names come from the
 * built-in list in data.ts, so the panel is for the stub build, not for a page on live HubSpot data. */
import { advance, current } from './flow'
import { initialState, newRow, patchMgr, patchPms, rowKey, type FlowState, type Person, type RouteCode } from './model'

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
  build: () => FlowState
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

const selfOwner = (company: string): FlowState => go(go(go(initialState, { role: 'owner' }), { managed: 'self' }), { company })
const thirdOwner = (): FlowState => go(go(initialState, { role: 'owner' }), { managed: 'third' })

/* ---------- the cases ---------- */

export const SCENARIOS: Scenario[] = [
  {
    id: 'r1-one',
    codes: ['R1'],
    label: 'R1, one system',
    group: 'Self-managed',
    map: '1.1.1',
    recipe: 'Owner · We self-manage · Company "Bozzuto" · properties.',
    landing: 'checkout',
    build: () => finish(counts(selfOwner('Bozzuto'), 3, 300)),
  },
  {
    id: 'r1-pick',
    codes: ['R1', 'R1'],
    label: 'R1, pick the systems',
    group: 'Self-managed',
    map: '1.1.1, Rule 2a',
    recipe: 'Manager · Company "Mill Creek" · pick RealPage and Entrata · properties for each.',
    landing: 'checkout',
    build: () => {
      let s = go(go(initialState, { role: 'manager' }), { company: 'Mill Creek' })
      s = go(s, { ownSys: ['RealPage', 'Entrata'] })
      s = counts(s, 2, 200)
      s = counts(s, 1, 100)
      return finish(s)
    },
  },
  {
    id: 'r1-website',
    codes: ['R1'],
    label: 'R1, matched by website',
    group: 'Self-managed',
    map: 'Rule 13',
    recipe: 'Owner · We self-manage · Company "B H Management", website "livebh.com" · properties.',
    landing: 'checkout',
    build: () => finish(counts(go(go(go(initialState, { role: 'owner' }), { managed: 'self' }), { company: 'B H Management', companyUrl: 'livebh.com' }), 2, 180)),
  },
  {
    id: 'r2',
    codes: ['R2'],
    label: 'R2, one of our systems',
    group: 'Self-managed',
    map: '1.1.2.1',
    recipe: 'Owner · We self-manage · Company "Acme Holdings" · 1 system · Yardi · administrator · properties.',
    landing: 'checkout',
    build: () => {
      let s = go(selfOwner('Acme Holdings'), { pmsCount: 1 })
      s = pmsSystem(s, 'Yardi')
      s = pmsAdmin(s, ADMIN)
      return finish(counts(s, 4, 400))
    },
  },
  {
    id: 'r2-same-admin',
    codes: ['R2', 'R2'],
    label: 'R2, two systems, same administrator',
    group: 'Self-managed',
    map: '1.1.2.1',
    recipe: 'Owner · We self-manage · "Acme Holdings" · 2 systems · Yardi, administrator · RealPage, "same administrator".',
    landing: 'checkout',
    build: () => {
      let s = go(selfOwner('Acme Holdings'), { pmsCount: 2 })
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
    codes: ['R2', 'X1'],
    label: 'X1 beside R2, a system not ours',
    group: 'Self-managed',
    map: '1.1.2.2, Rule 9',
    recipe: 'Owner · We self-manage · "Acme Holdings" · 2 systems · Yardi, administrator · Other · the Other row is not billed.',
    landing: 'checkout',
    build: () => {
      let s = go(selfOwner('Acme Holdings'), { pmsCount: 2 })
      s = pmsSystem(s, 'Yardi')
      s = pmsAdmin(s, ADMIN_2)
      s = counts(s, 2, 200)
      s = pmsSystem(s, 'Other')
      return finish(counts(s, 5, 500))
    },
  },
  {
    id: 'x1-only',
    codes: ['X1'],
    label: 'X1 alone, the call',
    group: 'Self-managed',
    map: '1.1.2.2, Section 5',
    recipe: 'Owner · We self-manage · "Acme Holdings" · 1 system · Other · properties · nothing billable, so the call.',
    landing: 'call',
    build: () => {
      let s = go(selfOwner('Acme Holdings'), { pmsCount: 1 })
      s = pmsSystem(s, 'Other')
      return counts(s, 5, 500)
    },
  },
  {
    id: 'x2',
    codes: ['X2'],
    label: 'X2, no system',
    group: 'Self-managed',
    map: '1.1.2.3',
    recipe: 'Owner · We self-manage · "Acme Holdings" · None · Yes, set up a call.',
    landing: 'call',
    build: () => go(go(selfOwner('Acme Holdings'), { pmsCount: 0 }), { confirmNone: 'yes' }),
  },
  {
    id: 'r3-one',
    codes: ['R3'],
    label: 'R3, one system, admin known',
    group: 'Third-party manager',
    map: '1.2.2.1',
    recipe: 'Owner · A third-party manager · "Bozzuto" · properties. No system question.',
    landing: 'checkout',
    build: () => finish(more(counts(manager(thirdOwner(), 'Bozzuto'), 3, 300), 'no')),
  },
  {
    id: 'r3-picked',
    codes: ['R3'],
    label: 'R3, several systems, owner knows which',
    group: 'Third-party manager',
    map: '1.2.2.2.1',
    recipe: 'Owner · A third-party manager · "Asset Living" · pick Yardi · properties.',
    landing: 'checkout',
    build: () => finish(more(counts(system(manager(thirdOwner(), 'Asset Living'), 'Yardi'), 3, 300), 'no')),
  },
  {
    id: 'r6',
    codes: ['R6'],
    label: 'R6, several systems, owner does not know',
    group: 'Third-party manager',
    map: '1.2.2.2.2',
    recipe: 'Owner · A third-party manager · "Asset Living" · I don’t know · your contact there · properties.',
    landing: 'checkout',
    build: () => finish(more(counts(contact(system(manager(thirdOwner(), 'Asset Living'), 'unknown'), CONTACT), 3, 300), 'no')),
  },
  {
    id: 'r4-flag',
    codes: ['R4'],
    label: 'R4, ticket flag',
    group: 'Third-party manager',
    map: '1.2.1',
    recipe: 'Owner · A third-party manager · "Greystar" · your regional or property manager · properties.',
    landing: 'checkout',
    build: () => finish(more(counts(contact(manager(thirdOwner(), 'Greystar'), CONTACT), 6, 600), 'no')),
  },
  {
    id: 'r4-no-admin',
    codes: ['R4'],
    label: 'R4, no admin on the deal',
    group: 'Third-party manager',
    map: '1.2.1',
    recipe: 'Owner · A third-party manager · "Cushman & Wakefield" · your contact there · properties.',
    landing: 'checkout',
    build: () => finish(more(counts(contact(manager(thirdOwner(), 'Cushman & Wakefield'), CONTACT), 2, 240), 'no')),
  },
  {
    id: 'r4-no-admin-two',
    codes: ['R4'],
    label: 'R4, no admin, two systems',
    group: 'Third-party manager',
    map: '1.2.1 before 1.2.2.2',
    recipe: 'Owner · A third-party manager · "Mark Taylor Residential" · your contact there · properties. The ticket check wins over the system count.',
    landing: 'checkout',
    build: () => finish(more(counts(contact(manager(thirdOwner(), 'Mark Taylor Residential'), CONTACT), 2, 240), 'no')),
  },
  {
    id: 'a2',
    codes: ['A2'],
    label: 'A2, new integration, admin known',
    group: 'Third-party manager',
    map: '1.2.3.1',
    recipe: 'Owner · A third-party manager · "Fresh Management" · Yardi · knows the admin: Yes · admin · properties.',
    landing: 'checkout',
    build: () => finish(more(counts(admin(knowsAdmin(system(manager(thirdOwner(), 'Fresh Management'), 'Yardi'), 'yes'), MGR_ADMIN), 3, 300), 'no')),
  },
  {
    id: 'r5-unknown-system',
    codes: ['R5'],
    label: 'R5, system unknown',
    group: 'Third-party manager',
    map: '1.2.3.2',
    recipe: 'Owner · A third-party manager · "Fresh Management" · I don’t know · introduce us to someone · properties.',
    landing: 'checkout',
    build: () => finish(more(counts(contact(system(manager(thirdOwner(), 'Fresh Management'), 'unknown'), CONTACT), 3, 300), 'no')),
  },
  {
    id: 'r5-unknown-admin',
    codes: ['R5'],
    label: 'R5, system known, admin unknown',
    group: 'Third-party manager',
    map: '1.2.3.2',
    recipe: 'Owner · A third-party manager · "Fresh Management" · RealPage · knows the admin: No · introduce us to someone · properties.',
    landing: 'checkout',
    build: () => finish(more(counts(contact(knowsAdmin(system(manager(thirdOwner(), 'Fresh Management'), 'RealPage'), 'no'), CONTACT), 3, 300), 'no')),
  },
  {
    id: 'x1-manager',
    codes: ['X1'],
    label: 'X1, manager on a system not ours',
    group: 'Third-party manager',
    map: '1.2.3.3, Section 5',
    recipe: 'Owner · A third-party manager · "Fresh Management" · Other · properties · the call.',
    landing: 'call',
    build: () => more(counts(system(manager(thirdOwner(), 'Fresh Management'), 'Other'), 3, 300), 'no'),
  },
  {
    id: 'both',
    codes: ['R2', 'R4'],
    label: 'Both: own system, then a manager',
    group: 'Mixed orders',
    map: '1.3',
    recipe: 'Owner · Both · "Acme Holdings" · 1 system · Yardi, administrator · properties · "Greystar" · contact · properties.',
    landing: 'checkout',
    build: () => {
      let s = go(go(go(initialState, { role: 'owner' }), { managed: 'both' }), { company: 'Acme Holdings' })
      s = go(s, { pmsCount: 1 })
      s = pmsSystem(s, 'Yardi')
      s = pmsAdmin(s, ADMIN)
      s = counts(s, 2, 200)
      s = manager(s, 'Greystar')
      s = contact(s, CONTACT)
      s = counts(s, 4, 400)
      return finish(more(s, 'no'))
    },
  },
  {
    id: 'both-x2',
    codes: ['X2', 'R3'],
    label: 'Both: no own system, manager goes ahead',
    group: 'Mixed orders',
    map: '1.3, Rule 9',
    recipe: 'Owner · Both · "Acme Holdings" · None · Yes · "Bozzuto" · properties. X2 gets the call, R3 checks out.',
    landing: 'checkout',
    build: () => {
      let s = go(go(go(initialState, { role: 'owner' }), { managed: 'both' }), { company: 'Acme Holdings' })
      s = go(go(s, { pmsCount: 0 }), { confirmNone: 'yes' })
      s = manager(s, 'Bozzuto')
      s = counts(s, 3, 300)
      return finish(more(s, 'no'))
    },
  },
  {
    id: 'two-managers',
    codes: ['R3', 'X1', 'R6'],
    label: 'Three managers, one offline',
    group: 'Mixed orders',
    map: '1.2, Rule 9',
    recipe: 'Owner · A third-party manager · "Bozzuto" · "Fresh Management", Other · "Asset Living", I don’t know. The Other row is not billed.',
    landing: 'checkout',
    build: () => {
      let s = more(counts(manager(thirdOwner(), 'Bozzuto'), 2, 200), 'yes')
      s = more(counts(system(manager(s, 'Fresh Management'), 'Other'), 3, 300), 'yes')
      s = more(counts(contact(system(manager(s, 'Asset Living'), 'unknown'), CONTACT), 4, 400), 'no')
      return finish(s, 'da')
    },
  },
  {
    id: 'proptech',
    codes: ['R3', 'R5'],
    label: 'PropTech, two clients',
    group: 'Mixed orders',
    map: '3',
    recipe: 'PropTech · client "Bozzuto" · counts · another client "Fresh Management", I don’t know · contact · counts · company and login.',
    landing: 'checkout',
    build: () => {
      let s = more(counts(manager(go(initialState, { role: 'proptech' }), 'Bozzuto'), 10, 1000), 'yes')
      s = more(counts(contact(system(manager(s, 'Fresh Management'), 'unknown'), CONTACT), 5, 500), 'no')
      return go(go(s, { product: 'da' }), { you: BUYER, company: 'Acme PropTech' })
    },
  },
]

export const GROUPS: Group[] = ['Self-managed', 'Third-party manager', 'Mixed orders']

export function scenario(id: string): Scenario | undefined {
  return SCENARIOS.find(x => x.id === id)
}
