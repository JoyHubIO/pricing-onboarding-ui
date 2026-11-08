import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseCsv, parseXlsx, toProperties } from './upload'

const fixture = (name: string) => readFileSync(new URL('./test/fixtures/' + name, import.meta.url))
/** The file's own bytes: a small Buffer sits in a shared pool, so `.buffer` alone is the pool. */
const bytes = (b: Buffer): ArrayBuffer => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer

describe('CSV', () => {
  it('quotes, escaped quotes, CRLF, trailing line', () => {
    expect(parseCsv('a,b\r\n"x, y","he said ""hi"""\n1,2')).toEqual([
      ['a', 'b'],
      ['x, y', 'he said "hi"'],
      ['1', '2'],
    ])
    expect(parseCsv('﻿a,b\n')).toEqual([['a', 'b']])
  })
  it('the fixture: header mapped, bad row reported, thousands separator read, unreadable units kept as 0', () => {
    const p = toProperties(parseCsv(fixture('properties.csv').toString('utf8')))
    expect(p.items).toEqual([
      { name: 'The Grove', addr: '12 Main St, Austin, TX', units: 240, year: 1998 },
      { name: 'Riverside Lofts', addr: '88 River Rd', units: 1200, year: 2010 },
      { name: 'Hill & Dale', addr: '', units: 0, year: 1975 },
    ])
    expect(p.problems).toEqual([{ line: 3, text: 'no property name' }])
  })
})

describe('XLSX', () => {
  it('reads the first sheet: shared strings, rich text, inline strings, numbers, blank rows', async () => {
    const rows = await parseXlsx(bytes(fixture('properties.xlsx')))
    expect(rows[0]).toEqual(['Property', 'Address', 'Units', 'Year Built'])
    expect(rows[1]).toEqual(['The Grove', '12 Main St, Austin TX', '240', '1998'])
    expect(rows[3][0]).toBe('Riverside Lofts')
    expect(rows[5][0]).toBe('Hill & Dale')
    const p = toProperties(rows)
    expect(p.items).toEqual([
      { name: 'The Grove', addr: '12 Main St, Austin TX', units: 240, year: 1998 },
      { name: 'Riverside Lofts', addr: '', units: 0, year: 2010 },
      { name: 'Hill & Dale', addr: '', units: 56, year: 1975 },
    ])
    expect(p.problems).toEqual([{ line: 3, text: 'no property name' }])
  })
  it('refuses something that is not a zip', async () => {
    await expect(parseXlsx(new Uint8Array(40).buffer)).rejects.toThrow('not a zip file')
  })
})

describe('rows to properties', () => {
  it('without a recognised header the columns are name, address, units, year', () => {
    const p = toProperties([
      ['Oak Court', '1 Oak St', '12', '1990'],
      ['', '', '', ''],
      ['Pine Court', '', '8', 'unknown'],
    ])
    expect(p.items).toEqual([
      { name: 'Oak Court', addr: '1 Oak St', units: 12, year: 1990 },
      { name: 'Pine Court', addr: '', units: 8, year: 0 },
    ])
    expect(p.problems).toEqual([])
  })
  it('header variants', () => {
    const p = toProperties([
      ['Community Name', 'Total Units', 'Yr Built', 'Street'],
      ['A', '10', '2001', '1 Main'],
    ])
    expect(p.items).toEqual([{ name: 'A', addr: '1 Main', units: 10, year: 2001 }])
  })
  it('an out-of-range year is left for the buyer', () => {
    expect(toProperties([['Name', 'Units', 'Year'], ['A', '3', '19']]).items[0].year).toBe(0)
  })
})
