import { describe, expect, it } from 'vitest'
import { ApiError, apiBase, apiLookup, fetchManagers, toManagerInfo } from './api'

const answer = (body: unknown, status = 200) =>
  (async () => ({ ok: status >= 200 && status < 300, status, json: async () => body })) as unknown as typeof fetch

/** A fetch that records the URLs it was asked for. */
function recording(body: unknown) {
  const urls: string[] = []
  const fetcher = (async (url: string) => {
    urls.push(url)
    return { ok: true, status: 200, json: async () => body }
  }) as unknown as typeof fetch
  return { urls, fetcher }
}

describe('the API host', () => {
  it('prefers the Scala host, falls back to the single host, and drops a trailing slash', () => {
    expect(apiBase({ VITE_SCALA_API_URL: 'http://localhost:7082/', VITE_API_URL: 'http://localhost:7080' })).toBe('http://localhost:7082')
    expect(apiBase({ VITE_API_URL: 'https://api.example.com' })).toBe('https://api.example.com')
    expect(apiBase({})).toBe('')
  })
})

describe('managers from the API', () => {
  it('map onto the three facts the page routes on', () => {
    expect(toManagerInfo({ name: ' Two System Co ', status: 'installed', website: 'twosystem.example', systems: ['RealPage', 'Yardi'], hasAdmin: true, ticket: false })).toEqual({
      name: 'Two System Co',
      website: 'twosystem.example',
      installed: 1,
      systems: ['RealPage', 'Yardi'],
      hasAdmin: true,
      ticket: false,
    })
    expect(toManagerInfo({ name: 'Newbie Co', status: 'in_progress', website: null, systems: [], hasAdmin: false, ticket: true })).toMatchObject({
      website: '',
      installed: 0,
      systems: [],
      hasAdmin: false,
      ticket: true,
    })
  })

  it('count only our PMSs as systems, whatever the case, once each', () => {
    const m = toManagerInfo({ name: 'Mixed Co', status: 'installed', systems: ['yardi', 'Unknown', 'AppFolio', 'YARDI', 'Entrata'], hasAdmin: true, ticket: false })
    expect(m.systems).toEqual(['Yardi', 'Entrata'])
  })

  it('are read from /pricing/managers, nameless entries dropped', async () => {
    const { urls, fetcher } = recording({
      managers: [
        { name: 'One Co', status: 'installed', systems: ['Yardi'], hasAdmin: true, ticket: false },
        { name: '  ', status: 'installed', systems: [], hasAdmin: true, ticket: false },
      ],
    })
    const got = await fetchManagers(fetcher, 'http://api.test')
    expect(urls).toEqual(['http://api.test/pricing/managers'])
    expect(got.map(m => m.name)).toEqual(['One Co'])
  })

  it('fail loudly with no host or a bad answer, so the page never routes on an empty list', async () => {
    await expect(fetchManagers(answer({}), '')).rejects.toBeInstanceOf(ApiError)
    await expect(fetchManagers(answer({}, 503), 'http://api.test')).rejects.toThrow(/503/)
  })
})

describe('the address lookup', () => {
  it('asks /pricing/lookup and hands back what was found', async () => {
    const { urls, fetcher } = recording({ found: true, address: '1 Main St, Denver, CO 80203', units: null, yearBuilt: 1998 })
    const got = await apiLookup(fetcher, 'http://api.test')(' 1 main st & 2nd ')
    expect(urls).toEqual(['http://api.test/pricing/lookup?address=1%20main%20st%20%26%202nd'])
    expect(got).toEqual({ address: '1 Main St, Denver, CO 80203', units: null, yearBuilt: 1998 })
  })

  it('answers null when nothing was found or the provider is off, and asks nothing for an empty address', async () => {
    expect(await apiLookup(answer({ found: false, error: 'no_match' }), 'http://api.test')('x')).toBeNull()
    expect(await apiLookup(answer({ found: false, error: 'lookup_unavailable' }), 'http://api.test')('x')).toBeNull()
    const { urls, fetcher } = recording({})
    expect(await apiLookup(fetcher, 'http://api.test')('   ')).toBeNull()
    expect(urls).toEqual([])
  })

  it('rejects when the request fails, which the screen reports', async () => {
    await expect(apiLookup(answer({}, 500), 'http://api.test')('x')).rejects.toBeInstanceOf(ApiError)
  })
})
