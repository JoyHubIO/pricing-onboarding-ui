/** The pricing API (joyhub-integration, `GET /pricing/...`): the management companies from the HubSpot
 * Integrations pipeline and the address lookup. The page only reads; nothing here writes to HubSpot. */
import { OURS, type ManagerInfo } from './data'
import type { AddressLookup, Geocoded } from './lookup'

/** The API host, without a trailing slash; '' when the page is built with none. */
export function apiBase(env: Record<string, string | undefined> = import.meta.env): string {
  return (env.VITE_SCALA_API_URL || env.VITE_API_URL || '').trim().replace(/\/+$/, '')
}

/** One entry of `GET /pricing/managers` (ManagerDto). */
export type ManagerDto = {
  name: string
  status: string
  website?: string | null
  systems: string[]
  hasAdmin: boolean
  ticket: boolean
}

/** What `GET /pricing/lookup` answers (LookupDto). */
export type LookupDto = {
  found: boolean
  address?: string | null
  units?: number | null
  yearBuilt?: number | null
  error?: string | null
}

/** A deal's PMS as one of ours, by its name whatever the case; null for "Unknown" or a system we do not connect. */
function ours(pms: string): string | null {
  const p = pms.trim().toLowerCase()
  return OURS.find(o => o.toLowerCase() === p) ?? null
}

/** The page's view of a manager. Only our PMSs count as its systems: a deal still named "Unknown", or on
 * another system, adds none, and a manager left with none is treated as having one (map, 1.2). */
export function toManagerInfo(m: ManagerDto): ManagerInfo {
  const systems = [...new Set(m.systems.map(ours).filter((x): x is string => x !== null))]
  return {
    name: m.name.trim(),
    website: (m.website ?? '').trim(),
    installed: m.status === 'installed' ? 1 : 0,
    systems,
    hasAdmin: m.hasAdmin,
    ticket: m.ticket,
  }
}

export class ApiError extends Error {}

async function getJson<T>(path: string, fetcher: typeof fetch, base: string): Promise<T> {
  if (!base) throw new ApiError('No API host is configured (VITE_SCALA_API_URL).')
  const res = await fetcher(base + path, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new ApiError('The API answered ' + res.status + ' for ' + path)
  return (await res.json()) as T
}

/** Every management company the lookup knows, nameless entries dropped. */
export async function fetchManagers(fetcher: typeof fetch = fetch, base: string = apiBase()): Promise<ManagerInfo[]> {
  const body = await getJson<{ managers: ManagerDto[] }>('/pricing/managers', fetcher, base)
  return body.managers.map(toManagerInfo).filter(m => m.name)
}

/** The Look up button's source. A provider that is off or found nothing answers null, so the buyer enters
 * the details; a request that fails rejects, and the screen says the lookup did not answer. */
export function apiLookup(fetcher: typeof fetch = fetch, base: string = apiBase()): AddressLookup {
  return async query => {
    const q = query.trim()
    if (!q) return null
    const body = await getJson<LookupDto>('/pricing/lookup?address=' + encodeURIComponent(q), fetcher, base)
    if (!body.found || !body.address) return null
    const found: Geocoded = { address: body.address, units: body.units ?? null, yearBuilt: body.yearBuilt ?? null }
    return found
  }
}
