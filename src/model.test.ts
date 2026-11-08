import { describe, expect, it } from 'vitest'
import { FREE, MGRS, PRODUCT_TIP } from './data'
import { biPrice, checkoutOptions, daPrice, emailErr, lookup, money, suggest } from './model'

describe('company lookup (map, Rule 13)', () => {
  it('suggests nothing under five characters, matches from five', () => {
    expect(suggest(MGRS, 'Bozz')).toEqual([])
    expect(suggest(MGRS, 'Bozzu').map(m => m.name)).toEqual(['Bozzuto'])
    expect(suggest(MGRS, '  bozzu ').map(m => m.name)).toEqual(['Bozzuto'])
  })
  it('matches a typed website before the name, whatever the name says', () => {
    expect(lookup(MGRS, 'Some Other Name', 'https://www.livebh.com/about')?.name).toBe('BH')
    expect(lookup(MGRS, '', 'LIVEBH.COM')?.name).toBe('BH')
  })
  it('still offers a name match when the website differs', () => {
    expect(lookup(MGRS, 'Bozzuto', 'not-their-site.com')?.name).toBe('Bozzuto')
    expect(suggest(MGRS, 'Bozzuto').map(m => m.name)).toContain('Bozzuto')
  })
  it('matches a name exactly, not a prefix, and nothing when unknown', () => {
    expect(lookup(MGRS, 'bozzuto', '')?.name).toBe('Bozzuto')
    expect(lookup(MGRS, 'Bozz', '')).toBeNull()
    expect(lookup(MGRS, 'Acme Holdings', 'acme-holdings.com')).toBeNull()
  })
})

describe('prices (map, Rule 5)', () => {
  it('Business Intelligence per unit, incremental tiers', () => {
    expect(biPrice(0)).toBe(0)
    expect(biPrice(1)).toBe(1.75)
    expect(biPrice(3000)).toBe(5250)
    expect(biPrice(3001)).toBe(5251.5)
    expect(biPrice(5000)).toBe(8250)
    expect(biPrice(5001)).toBe(8251.25)
    expect(biPrice(10000)).toBe(14500)
    expect(biPrice(10001)).toBe(14500.75)
    expect(biPrice(15000)).toBe(18250) // the map's example
    expect(biPrice(15001)).toBe(18250.5)
    expect(biPrice(20000)).toBe(20750)
    expect(biPrice(20001)).toBe(20750.25)
    expect(biPrice(25000)).toBe(22000) // the map's example
  })
  it('Data Access per property, minimum one', () => {
    expect(daPrice(0)).toBe(50)
    expect(daPrice(1)).toBe(50)
    expect(daPrice(100)).toBe(5000)
    expect(daPrice(101)).toBe(5025)
    expect(daPrice(150)).toBe(6250) // the map's example
  })
  it('formats money', () => {
    expect(money(525)).toBe('$525')
    expect(money(5251.5)).toBe('$5,251.50')
  })
  it('the product text says BI includes Data Access', () => {
    expect(PRODUCT_TIP).toMatch(/includes all of the features of Data Access/)
  })
})

describe('checkout options (map, C4)', () => {
  it('offers Send invoice only above $1,000 a month', () => {
    expect(checkoutOptions(1000)).toEqual(['pay', 'quote'])
    expect(checkoutOptions(1050)).toEqual(['pay', 'quote', 'invoice'])
  })
})

describe('the buyer’s email (map, C3)', () => {
  it('malformed', () => {
    expect(emailErr('bob', true)).toBe('Enter a valid email address.')
    expect(emailErr('bob@acme', true)).toBe('Enter a valid email address.')
    expect(emailErr('', true)).toBe('Required')
  })
  it('personal domains refused for the buyer, allowed for other people', () => {
    for (const d of FREE) expect(emailErr('bob@' + d, true)).toBe('Please use a work email, not a personal address.')
    expect(emailErr('Bob@Gmail.com', true)).toBe('Please use a work email, not a personal address.')
    expect(emailErr('bob@gmail.com')).toBe('')
  })
  it('work email', () => {
    expect(emailErr('bob@acme-holdings.com', true)).toBe('')
  })
})
