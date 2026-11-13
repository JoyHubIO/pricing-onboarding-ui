// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { advance } from './flow'
import { initialState, newRow, type FlowState } from './model'
import { readFiles, restore, snapshot, toOrder } from './order'
import { MGRS } from './test/fixtures/managers'

/** An owner, self-managed on a company HubSpot does not hold, with an uploaded list on its first PMS. */
function uploaded(): FlowState {
  const blob = new File(['Property,Units\nA,100\nB,73\n'], 'list.csv', { type: 'text/csv' })
  return {
    ...initialState,
    managers: MGRS,
    role: 'owner',
    managed: 'self',
    company: ' Acme Holdings ',
    pmsCount: 1,
    pms: [{ system: 'Yardi', admin: { first: 'Sam', last: 'Admin', email: 'sam@acme-holdings.com' }, same: false }],
    rows: {
      pms0: {
        ...newRow('upload'),
        file: 'list.csv',
        blob,
        items: [
          { id: 1, name: 'A', addr: '1 Main St', units: 100, year: 1999 },
          { id: 2, name: 'B', addr: '', units: 73, year: 0 },
        ],
      },
    },
    product: 'bi',
    you: { first: 'Ann', last: 'Buyer', email: 'ann@acme-holdings.com' },
  }
}

describe('the order the page submits', () => {
  it('carries each route row with its person, its properties and its uploaded file', async () => {
    const s = uploaded()
    const order = toOrder(s, 'quote', await readFiles(s))
    expect(order).toMatchObject({ company: 'Acme Holdings', role: 'owner', managed: 'self', product: 'bi', properties: 2, units: 173, checkout: 'quote' })
    expect(order.rows).toHaveLength(1)
    const row = order.rows[0]
    expect(row).toMatchObject({ key: 'pms0', kind: 'pms', route: 'R2', billable: true, system: 'Yardi', party: 'Acme Holdings' })
    expect(row.person).toEqual({ first: 'Sam', last: 'Admin', email: 'sam@acme-holdings.com' })
    expect(row.properties).toMatchObject({ mode: 'upload', count: 2, units: 173, file: 'list.csv', fileType: 'text/csv' })
    expect(row.properties!.items).toEqual([
      { name: 'A', address: '1 Main St', units: 100, yearBuilt: 1999 },
      { name: 'B', address: null, units: 73, yearBuilt: null },
    ])
    expect(atob(row.properties!.fileData!)).toBe('Property,Units\nA,100\nB,73\n')
  })

  it('sends the company answer only when one was given', () => {
    const s = uploaded()
    expect(toOrder(s, 'pay')).toMatchObject({ confirmedCompanyId: null, createNewCompany: null })
    expect(toOrder(s, 'pay', {}, { confirmedCompanyId: 7 })).toMatchObject({ confirmedCompanyId: 7, createNewCompany: null })
    expect(toOrder(s, 'pay', {}, { createNewCompany: true })).toMatchObject({ confirmedCompanyId: null, createNewCompany: true })
  })

  it('a snapshot restores every answer on today’s manager list, without the file or the shown errors', () => {
    const s = advance(uploaded())
    const back = restore(JSON.parse(JSON.stringify(snapshot(s))), MGRS)!
    expect(back.managers).toBe(MGRS)
    expect(back.tried).toEqual({})
    expect(back.rows.pms0.blob).toBeNull()
    expect({ ...back, managers: [], tried: {}, rows: {} }).toEqual({ ...s, managers: [], tried: {}, rows: {} })
    expect(back.rows.pms0.items).toEqual(s.rows.pms0.items)
  })

  it('refuses a snapshot that is not page state', () => {
    for (const junk of [null, 'x', 3, {}, { stack: [] }, { stack: [{ id: 'start' }], mgrs: 1, pms: [], rows: {} }]) expect(restore(junk, MGRS)).toBeNull()
  })
})
