/** Address lookup behind the Look up button (map, C1; W14). The page uses `apiLookup` (api.ts), which asks
 * GET /pricing/lookup. Units and year built come back only when the provider has them, so the buyer always
 * confirms or enters both. */

export type Geocoded = {
  /** The address as the source knows it. */
  address: string
  units: number | null
  yearBuilt: number | null
}

/** Null = nothing found, the buyer enters the details. A rejection = the lookup did not answer. */
export type AddressLookup = (query: string) => Promise<Geocoded | null>

/** For screens drawn with no lookup wired, as in a test: hands back the typed address and nothing else. */
export const echoLookup: AddressLookup = async query => {
  const q = query.trim()
  return q ? { address: q, units: null, yearBuilt: null } : null
}
