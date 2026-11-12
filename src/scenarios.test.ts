import { describe, expect, it } from 'vitest'
import { current, showsNotice } from './flow'
import { rowList, totals, type RouteCode } from './model'
import { cast, companies, scenarios } from './scenarios'
import { MGRS } from './test/fixtures/managers'

const SCENARIOS = scenarios(MGRS)

const ALL: RouteCode[] = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'A2', 'X1', 'X2']

describe('the test scenarios', () => {
  it('cover every route code', () => {
    const seen = new Set(SCENARIOS.flatMap(sc => sc.codes))
    expect(ALL.filter(c => !seen.has(c))).toEqual([])
  })

  it('have unique ids', () => {
    expect(new Set(SCENARIOS.map(sc => sc.id)).size).toBe(SCENARIOS.length)
  })

  for (const sc of SCENARIOS) {
    it(sc.label + ' lands on the ' + sc.landing + ' screen with ' + sc.codes.join(', '), () => {
      const s = sc.build()
      expect(current(s).id).toBe(sc.landing)
      expect(rowList(s).map(r => r.route)).toEqual(sc.codes)
      // Every row with a properties screen was given properties; X2 has none to give (map, 1.1.2.3).
      const t = totals(s)
      expect(t.props + t.offProps > 0).toBe(sc.codes.some(c => c !== 'X2'))
      // X rows are the unbilled ones (map, Rule 9).
      for (const r of rowList(s)) expect(r.billable).toBe(!r.route.startsWith('X'))
      // The notice on the price screen goes with an automated installation, never with R1 or X rows alone (map, "**").
      if (sc.landing === 'checkout') {
        const auto = sc.codes.some(c => !['R1', 'X1', 'X2'].includes(c))
        expect(showsNotice(s, current(s))).toBe(auto)
      }
    })
  }

  it('name the person we will write to on every route that asks for one', () => {
    for (const sc of SCENARIOS) {
      for (const r of rowList(sc.build())) {
        const asks = ['R2', 'R4', 'R5', 'R6', 'A2'].includes(r.route)
        expect(!!(r.person && r.person.email), sc.id + ' ' + r.key).toBe(asks)
      }
    }
  })

  it('load on companies the list holds, and none is missing one', () => {
    expect(SCENARIOS.filter(sc => sc.missing).map(sc => sc.id)).toEqual([])
    const c = cast(MGRS)
    expect([c.single?.name, c.multi?.name, c.flagged?.name, c.noAdmin?.name, c.noAdminMulti?.name]).toEqual([
      'Bozzuto',
      'Asset Living',
      'Greystar',
      'Cushman & Wakefield',
      'Mark Taylor Residential',
    ])
    expect(companies(MGRS).flagged.map(m => m.name)).toEqual(['Greystar', 'RPM'])
  })

  it('say which kind of company is lacking, and keep the cases that need none', () => {
    const plain = MGRS.filter(m => m.systems.length <= 1 && m.hasAdmin && !m.ticket)
    const cases = scenarios(plain)
    const missing = cases.filter(sc => sc.missing).map(sc => sc.id)
    expect(missing).toEqual(['r1-pick', 'r3-picked', 'r6', 'r4-flag', 'r4-no-admin', 'r4-no-admin-two', 'both', 'two-managers'])
    expect(cases.find(sc => sc.id === 'r4-flag')?.missing).toMatch(/ticket flag set/)
    // With no list at all, the cases about a company we have never seen still load.
    const none = scenarios([])
    expect(none.filter(sc => !sc.missing).map(sc => sc.id)).toEqual(['r2', 'r2-same-admin', 'x1-self', 'x1-only', 'x2', 'a2', 'r5-unknown-system', 'r5-unknown-admin', 'x1-manager'])
    for (const sc of none.filter(x => !x.missing)) expect(sc.build().managers).toEqual([])
  })

  it('never take a listed company for the unknown one', () => {
    const listed = [...MGRS, { ...MGRS[0], name: 'Fresh Management' }, { ...MGRS[0], name: 'Acme Holdings' }]
    const a2 = scenarios(listed).find(sc => sc.id === 'a2')!
    expect(rowList(a2.build()).map(r => [r.route, r.party])).toEqual([['A2', 'Fresh Management Test']])
  })
})
