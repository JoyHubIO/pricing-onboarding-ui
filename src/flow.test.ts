import { describe, expect, it } from 'vitest'
import { current, showsNotice } from './flow'
import { monthly, newPms, newRow, patchMgr, patchPms, rowList, totals, type FlowState } from './model'
import { at, counted, go, person, props, rowHere, start } from './test/walk'

const routes = (s: FlowState) => rowList(s).map(r => r.route)

/** Owner, self-managed, to the company screen. */
const selfOwner = () => go(go(start(), { role: 'owner' }), { managed: 'self' })
/** Owner, third-party, on the first manager screen. */
const thirdOwner = () => go(go(start(), { role: 'owner' }), { managed: 'third' })
/** Name the current manager and continue. */
const manager = (s: FlowState, name: string) => go(s, patchMgr(s, current(s).id === 'mgrName' ? (current(s) as { i: number }).i : 0, { name }))

describe('R1: the company is already integrated', () => {
  it('one system: no system questions, straight to the properties', () => {
    let s = go(selfOwner(), { company: 'Bozzuto' })
    expect(at(s)).toBe('props:own:0')
    s = props(s, 3, 300)
    expect(at(s)).toBe('product')
    s = go(s, { product: 'bi' })
    expect(at(s)).toBe('you')
    s = go(s, { you: person() })
    expect(at(s)).toBe('checkout')
    expect(routes(s)).toEqual(['R1'])
    expect(rowList(s)[0].system).toBe('Yardi')
    expect(monthly(s)).toBe(525)
  })
  it('several systems: the picker, one properties row per chosen system', () => {
    let s = go(selfOwner(), { company: 'Greystar' })
    expect(at(s)).toBe('ownSys')
    s = go(s) // nothing picked
    expect(at(s)).toBe('ownSys')
    expect(s.tried['ownSys']).toBe(true)
    s = go(s, { ownSys: ['Yardi', 'RealPage'] })
    expect(at(s)).toBe('props:own:0')
    s = props(s, 2, 200)
    expect(at(s)).toBe('props:own:1')
    s = props(s, 1, 100)
    expect(at(s)).toBe('product')
    expect(rowList(s).map(r => [r.route, r.system])).toEqual([
      ['R1', 'Yardi'],
      ['R1', 'RealPage'],
    ])
    expect(totals(s)).toEqual({ props: 3, units: 300, offProps: 0, offUnits: 0 })
  })
})

describe('R2: self-managed, no integration', () => {
  const toCount = () => {
    const s = go(selfOwner(), { company: 'Acme Holdings' })
    expect(at(s)).toBe('pmsCount')
    return s
  }
  it('one PMS: system, administrator, properties', () => {
    let s = go(toCount(), { pmsCount: 1, pms: [newPms()] })
    expect(at(s)).toBe('pmsSystem:0')
    s = go(s, patchPms(s, 0, { system: 'Yardi' }))
    expect(at(s)).toBe('pmsAdmin:0')
    s = go(s, patchPms(s, 0, { admin: person('admin') }))
    expect(at(s)).toBe('props:pms:0')
    s = props(s, 4, 400)
    expect(at(s)).toBe('product')
    expect(routes(s)).toEqual(['R2'])
    expect(rowList(s)[0].person?.email).toBe('admin@example.com')
  })
  it('two PMSs with "same administrator"', () => {
    let s = go(toCount(), { pmsCount: 2, pms: [newPms(), newPms()] })
    s = go(s, patchPms(s, 0, { system: 'Yardi' }))
    s = go(s, patchPms(s, 0, { admin: person('one') }))
    s = props(s, 1, 100)
    expect(at(s)).toBe('pmsSystem:1')
    s = go(s, patchPms(s, 1, { system: 'RealPage' }))
    expect(at(s)).toBe('pmsAdmin:1')
    s = go(s, patchPms(s, 1, { same: true, admin: { ...s.pms[0].admin } }))
    expect(at(s)).toBe('props:pms:1')
    s = props(s, 1, 100)
    expect(at(s)).toBe('product')
    expect(rowList(s).map(r => [r.route, r.system, r.person?.email])).toEqual([
      ['R2', 'Yardi', 'one@example.com'],
      ['R2', 'RealPage', 'one@example.com'],
    ])
  })
  it('two PMSs with different administrators', () => {
    let s = go(toCount(), { pmsCount: 2, pms: [newPms(), newPms()] })
    s = go(s, patchPms(s, 0, { system: 'Yardi' }))
    s = go(s, patchPms(s, 0, { admin: person('one') }))
    s = props(s, 1, 100)
    s = go(s, patchPms(s, 1, { system: 'Entrata' }))
    s = go(s, patchPms(s, 1, { admin: person('two') }))
    s = props(s, 1, 100)
    expect(rowList(s).map(r => r.person?.email)).toEqual(['one@example.com', 'two@example.com'])
  })
  it('an "Other" system is an X1 row: no administrator asked, listed, not billed', () => {
    let s = go(toCount(), { pmsCount: 2, pms: [newPms(), newPms()] })
    s = go(s, patchPms(s, 0, { system: 'Yardi' }))
    s = go(s, patchPms(s, 0, { admin: person() }))
    s = props(s, 2, 200)
    s = go(s, patchPms(s, 1, { system: 'Other' }))
    expect(at(s)).toBe('props:pms:1')
    s = props(s, 5, 500)
    expect(at(s)).toBe('product')
    expect(rowList(s).map(r => [r.route, r.billable])).toEqual([
      ['R2', true],
      ['X1', false],
    ])
    expect(totals(s)).toEqual({ props: 2, units: 200, offProps: 5, offUnits: 500 })
  })
  it('zero systems: confirm, Yes ends in the call', () => {
    let s = go(toCount(), { pmsCount: 0, pms: [] })
    expect(at(s)).toBe('confirmNone')
    s = go(s, { confirmNone: 'yes' })
    expect(at(s)).toBe('call')
    expect(routes(s)).toEqual(['X2'])
    expect(totals(s).props).toBe(0)
  })
  it('zero systems: No returns to the count', () => {
    let s = go(toCount(), { pmsCount: 0, pms: [] })
    s = go(s, { confirmNone: 'no' })
    expect(at(s)).toBe('pmsCount')
    expect(s.pmsCount).toBeNull()
  })
})

describe('third-party managers', () => {
  it('R3: integrated, one system, administrator known: nothing to ask', () => {
    let s = manager(thirdOwner(), 'Bozzuto')
    expect(at(s)).toBe('props:mgr:0')
    s = props(s, 2, 200)
    expect(at(s)).toBe('moreMgr:0')
    s = go(s, patchMgr(s, 0, { more: 'no' }))
    expect(at(s)).toBe('product')
    expect(rowList(s).map(r => [r.route, r.system, r.party])).toEqual([['R3', 'Yardi', 'Bozzuto']])
  })
  it('R4 by the ticket flag: the contact is asked up front', () => {
    let s = manager(thirdOwner(), 'Greystar')
    expect(at(s)).toBe('mgrContact:0:ticket')
    s = go(s, patchMgr(s, 0, { contact: person('rm') }))
    expect(at(s)).toBe('props:mgr:0')
    s = props(s, 1, 100)
    expect(rowList(s).map(r => [r.route, r.person?.email])).toEqual([['R4', 'rm@example.com']])
  })
  it('R4 by a missing administrator', () => {
    const s = manager(thirdOwner(), 'Cushman & Wakefield')
    expect(at(s)).toBe('mgrContact:0:ticket')
    expect(routes(s)).toEqual(['R4'])
  })
  it('several systems, the buyer knows which: R3 on that system', () => {
    let s = manager(thirdOwner(), 'Asset Living')
    expect(at(s)).toBe('mgrSys:0')
    s = go(s, patchMgr(s, 0, { sys: 'RealPage' }))
    expect(at(s)).toBe('props:mgr:0')
    expect(rowList(s).map(r => [r.route, r.system])).toEqual([['R3', 'RealPage']])
  })
  it('several systems, unknown: R6 asks the contact', () => {
    let s = manager(thirdOwner(), 'Asset Living')
    s = go(s, patchMgr(s, 0, { sys: 'unknown' }))
    expect(at(s)).toBe('mgrContact:0:which')
    s = go(s, patchMgr(s, 0, { contact: person('c') }))
    expect(at(s)).toBe('props:mgr:0')
    expect(rowList(s).map(r => [r.route, r.system, r.person?.email])).toEqual([['R6', '', 'c@example.com']])
  })
  it('not integrated, PMS and administrator known: A2', () => {
    let s = manager(thirdOwner(), 'Fresh Management')
    expect(at(s)).toBe('mgrSys:0')
    s = go(s, patchMgr(s, 0, { sys: 'Entrata' }))
    expect(at(s)).toBe('mgrKnowsAdmin:0')
    s = go(s, patchMgr(s, 0, { knowsAdmin: 'yes' }))
    expect(at(s)).toBe('mgrAdmin:0')
    s = go(s, patchMgr(s, 0, { admin: person('adm') }))
    expect(at(s)).toBe('props:mgr:0')
    expect(rowList(s).map(r => [r.route, r.system, r.person?.email])).toEqual([['A2', 'Entrata', 'adm@example.com']])
  })
  it('not integrated, administrator unknown: R5 with an introduction', () => {
    let s = manager(thirdOwner(), 'Fresh Management')
    s = go(s, patchMgr(s, 0, { sys: 'Entrata' }))
    s = go(s, patchMgr(s, 0, { knowsAdmin: 'no' }))
    expect(at(s)).toBe('mgrContact:0:intro')
    s = go(s, patchMgr(s, 0, { contact: person('intro') }))
    expect(rowList(s).map(r => [r.route, r.system])).toEqual([['R5', 'Entrata']])
  })
  it('not integrated, PMS unknown: R5 with an introduction, no administrator question', () => {
    let s = manager(thirdOwner(), 'Fresh Management')
    s = go(s, patchMgr(s, 0, { sys: 'unknown' }))
    expect(at(s)).toBe('mgrContact:0:intro')
    expect(routes(s)).toEqual(['R5'])
  })
  it('not integrated, "Other" PMS: X1, straight to the properties, not billed', () => {
    let s = manager(thirdOwner(), 'Fresh Management')
    s = go(s, patchMgr(s, 0, { sys: 'Other' }))
    expect(at(s)).toBe('props:mgr:0')
    s = props(s, 3, 300)
    s = go(s, patchMgr(s, 0, { more: 'no' }))
    expect(at(s)).toBe('call') // nothing billable: the whole order is a call
    expect(rowList(s).map(r => [r.route, r.billable])).toEqual([['X1', false]])
  })
})

describe('Both, Manager, PropTech', () => {
  it('Both: an X2 self part and a priced manager part, one plan', () => {
    let s = go(go(start(), { role: 'owner' }), { managed: 'both' })
    s = go(s, { company: 'Acme Holdings' })
    s = go(s, { pmsCount: 0, pms: [] })
    s = go(s, { confirmNone: 'yes' })
    expect(at(s)).toBe('mgrName:0')
    s = manager(s, 'Bozzuto')
    s = props(s, 2, 200)
    s = go(s, patchMgr(s, 0, { more: 'no' }))
    expect(at(s)).toBe('product')
    expect(rowList(s).map(r => [r.route, r.billable])).toEqual([
      ['X2', false],
      ['R3', true],
    ])
    expect(totals(s)).toEqual({ props: 2, units: 200, offProps: 0, offUnits: 0 })
  })
  it('Manager role takes the self-managed path without the "how managed" question', () => {
    let s = go(start(), { role: 'manager' })
    expect(at(s)).toBe('company')
    s = go(s, { company: 'Acme Holdings' })
    expect(at(s)).toBe('pmsCount')
  })
  it('PropTech: two clients, rows default to counts, company asked at the end', () => {
    let s = go(start(), { role: 'proptech' })
    expect(at(s)).toBe('mgrName:0')
    s = manager(s, 'Bozzuto')
    expect(at(s)).toBe('props:mgr:0')
    expect(s.rows['mgr0'].mode).toBe('count')
    s = props(s, 1, 100)
    s = go(s, patchMgr(s, 0, { more: 'yes' }))
    expect(at(s)).toBe('mgrName:1')
    s = manager(s, 'Greystar')
    expect(at(s)).toBe('mgrContact:1:ticket')
    s = go(s, patchMgr(s, 1, { contact: person('rm') }))
    s = props(s, 2, 200)
    s = go(s, patchMgr(s, 1, { more: 'no' }))
    s = go(s, { product: 'da' })
    expect(at(s)).toBe('you')
    s = go(s, { you: person() }) // company still missing
    expect(at(s)).toBe('you')
    s = go(s, { company: 'PropTech Co' })
    expect(at(s)).toBe('checkout')
    expect(routes(s)).toEqual(['R3', 'R4'])
    expect(monthly(s)).toBe(150)
  })
})

describe('properties (map, C1)', () => {
  it('a row needs at least one property; an upload needs units for every row', () => {
    let s = go(selfOwner(), { company: 'Bozzuto' })
    s = go(s) // empty list
    expect(at(s)).toBe('props:own:0')
    expect(s.tried['props:own:0']).toBe(true)
    const up = { ...newRow('upload'), file: 'list.csv', items: [{ id: 1, name: 'A', addr: '', units: 0, year: 0 }] }
    s = go(s, rowHere(s, up))
    expect(at(s)).toBe('props:own:0')
    s = go(s, rowHere(s, { ...up, items: [{ ...up.items[0], units: 10 }] }))
    expect(at(s)).toBe('product')
    expect(totals(s)).toEqual({ props: 1, units: 10, offProps: 0, offUnits: 0 })
  })
  it('an upload nothing could be read from falls back to typed counts', () => {
    let s = go(selfOwner(), { company: 'Bozzuto' })
    s = go(s, rowHere(s, { ...counted(3, 30), mode: 'upload', file: 'list.csv' }))
    expect(at(s)).toBe('product')
    expect(totals(s).units).toBe(30)
  })
})

describe('installation notice (map, **)', () => {
  it('shown on the screens that lead to R2–R6 and A2, not for R1 or X rows', () => {
    // R1
    let s = go(selfOwner(), { company: 'Bozzuto' })
    expect(showsNotice(s, current(s))).toBe(false)
    s = props(s, 1, 100)
    s = go(s, { product: 'bi' })
    s = go(s, { you: person() })
    expect(at(s)).toBe('checkout')
    expect(showsNotice(s, current(s))).toBe(false)
    // R2 and X1
    s = go(selfOwner(), { company: 'Acme Holdings' })
    s = go(s, { pmsCount: 2, pms: [newPms(), newPms()] })
    s = go(s, patchPms(s, 0, { system: 'Yardi' }))
    expect(at(s)).toBe('pmsAdmin:0')
    expect(showsNotice(s, current(s))).toBe(true)
    s = go(s, patchPms(s, 0, { admin: person() }))
    s = props(s, 1, 100)
    s = go(s, patchPms(s, 1, { system: 'Other' }))
    expect(at(s)).toBe('props:pms:1')
    expect(showsNotice(s, current(s))).toBe(false)
    s = props(s, 1, 100)
    s = go(s, { product: 'bi' })
    s = go(s, { you: person() })
    expect(at(s)).toBe('checkout')
    expect(showsNotice(s, current(s))).toBe(true)
    s = go(s, { checkout: 'pay' })
    expect(at(s)).toBe('pay')
    expect(showsNotice(s, current(s))).toBe(true)
    // R3: the properties screen itself
    s = manager(thirdOwner(), 'Bozzuto')
    expect(showsNotice(s, current(s))).toBe(true)
    // R4, R6, R5 contact screens; A2 admin screen
    expect(showsNotice(manager(thirdOwner(), 'Greystar'), { id: 'mgrContact', i: 0, why: 'ticket' })).toBe(true)
    expect(showsNotice(s, { id: 'mgrContact', i: 0, why: 'which' })).toBe(true)
    expect(showsNotice(s, { id: 'mgrContact', i: 0, why: 'intro' })).toBe(true)
    expect(showsNotice(s, { id: 'mgrAdmin', i: 0 })).toBe(true)
    // X1 manager row
    s = manager(thirdOwner(), 'Fresh Management')
    s = go(s, patchMgr(s, 0, { sys: 'Other' }))
    expect(at(s)).toBe('props:mgr:0')
    expect(showsNotice(s, current(s))).toBe(false)
  })
})

describe('the ends of this ticket', () => {
  it('Save quote and Send invoice stay on the price screen; Pay now opens the pay screen, which stops', () => {
    let s = go(selfOwner(), { company: 'Bozzuto' })
    s = props(s, 30, 3000)
    s = go(s, { product: 'bi' })
    s = go(s, { you: person() })
    expect(monthly(s)).toBe(5250)
    const quote = go(s, { checkout: 'quote' })
    expect(at(quote)).toBe('checkout')
    s = go(s, { checkout: 'pay' })
    expect(at(s)).toBe('pay')
    s = go(s)
    expect(at(s)).toBe('pay')
    expect(s.tried['pay']).toBe(true)
  })
})
