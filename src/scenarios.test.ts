import { describe, expect, it } from 'vitest'
import { current, showsNotice } from './flow'
import { rowList, totals, type RouteCode } from './model'
import { SCENARIOS } from './scenarios'

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
})
