/** Address lookup behind the Look up button (map, C1; W14). Ticket 2 points this at GET /pricing/lookup; until
 * then the stub hands back the typed address and nothing else, so the buyer enters units and year built. */

export type Geocoded = {
  /** The address as the source knows it. */
  address: string
  units: number | null
  yearBuilt: number | null
}

export type AddressLookup = (query: string) => Promise<Geocoded | null>

export const stubLookup: AddressLookup = async query => {
  const q = query.trim()
  return q ? { address: q, units: null, yearBuilt: null } : null
}
