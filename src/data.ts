/** Constants for the v2 flow (Pricing Workflow Map v2). */

/** Our integrated PMSs (map, Rule 2). Any other PMS goes to the offline workflow X1. */
export const OURS = ['Yardi', 'RealPage', 'Entrata', 'ResMan']

/** One management company as read from the HubSpot Integrations pipeline (map, 1.2: three facts per manager). */
export type ManagerInfo = {
  name: string
  /** Website, when known; the lookup matches it before the name (map, Rule 13). */
  website: string
  /** 1 = installed (Completed), 0 = integration in progress. */
  installed: 0 | 1
  /** The PMSs it is integrated on, one per deal (<Manager> - <PMS>). Empty = unknown, treated as one. */
  systems: string[]
  /** The deal's primary contact is a system administrator we work with directly. */
  hasAdmin: boolean
  /** Flagged to keep a ticket process: requests go through the client's regional or property manager (R4). */
  ticket: boolean
}

/** Sample facts for the built-in list, so every route can be walked before the managers endpoint exists
 * (ticket 2 replaces the whole list with the HubSpot mirror). Names are the integration pipeline's; the
 * systems, websites and flags below are stand-in values, not HubSpot's, chosen so that every combination
 * of the three facts (system count, admin, ticket flag) has a company; scenarios.ts walks each one.
 * Unlisted managers: one system, administrator known, no ticket flag. */
const FACTS: Record<string, Partial<Pick<ManagerInfo, 'website' | 'systems' | 'hasAdmin' | 'ticket'>>> = {
  Greystar: { website: 'greystar.com', systems: ['Yardi', 'RealPage'], ticket: true },
  RPM: { website: 'rpmliving.com', systems: ['Yardi'], ticket: true },
  'Asset Living': { website: 'assetliving.com', systems: ['Yardi', 'RealPage', 'Entrata'] },
  Bozzuto: { website: 'bozzuto.com', systems: ['Yardi'] },
  'Cushman & Wakefield': { website: 'cushmanwakefield.com', systems: ['Yardi'], hasAdmin: false },
  BH: { website: 'livebh.com', systems: ['RealPage'] },
  'Mill Creek': { website: 'millcreekplaces.com', systems: ['RealPage', 'Entrata'] },
  'Mark Taylor Residential': { website: 'mark-taylor.com', systems: ['Yardi', 'RealPage'], hasAdmin: false },
  'FirstService Residential': { website: 'fsresidential.com', systems: ['Yardi'] },
  'Bell Partners': { website: 'bellpartnersinc.com', systems: ['Entrata'], hasAdmin: false },
  Kettler: { website: 'kettler.com', systems: ['ResMan'] },
}

/** The page's built-in list, the stand-in for GET /pricing/managers until ticket 2. */
const NAMES: [string, 0 | 1][] = [
  ['Greystar', 1],
  ['Asset Living', 1],
  ['Bozzuto', 1],
  ['Cushman & Wakefield', 1],
  ['RPM', 1],
  ['BH', 1],
  ['United Apartment Group', 1],
  ['Crescent / Bryten', 1],
  ['Bryten Real Estate Partners', 1],
  ['Mark Taylor Residential', 1],
  ['JPM', 1],
  ['REMM Group', 1],
  ['The Michaels Organization', 1],
  ['BNY Mellon', 1],
  ['M3 Equities', 1],
  ['Vest', 1],
  ['Mashcole Property Management', 1],
  ['Meritus', 1],
  ['Blanton Turner', 1],
  ['Better Housing Coalition', 1],
  ['FirstService Residential', 1],
  ['Urban American', 1],
  ['Crown', 1],
  ['JM Corcoran & Company', 1],
  ['Sail', 1],
  ['Mill Creek', 1],
  ['Shiplake', 1],
  ['J Street', 1],
  ['The Tipton Group', 1],
  ['Crawford Hoying', 1],
  ['One Wall Communities', 1],
  ['Woodward Management', 1],
  ['Premier Properties', 1],
  ['The Domain Company', 1],
  ['Elmington', 1],
  ['Passco Companies', 1],
  ['Sentral', 1],
  ['RKW Residential', 1],
  ['The Dermot Company', 1],
  ['Rise Residential', 1],
  ['Savoy Equity', 1],
  ['Stonemark Management', 1],
  ['StoneCreek Communities', 1],
  ['Moss & Company', 1],
  ['StuartCo', 1],
  ['PeakMade Real Estate', 1],
  ['Valiant Residential', 1],
  ['Marquette', 1],
  ['Olympus Property', 1],
  ['Palomar Properties', 1],
  ['Hill Street Realty', 1],
  ['First Communities', 1],
  ['Lone Star Capital', 1],
  ['Cedar St', 1],
  ['Income Property Specialists', 1],
  ['Fortress Technology Solutions', 1],
  ['Calibrate Property Management', 1],
  ['IMGRE', 1],
  ['Fairfield Residential', 1],
  ['Living Residential', 1],
  ['Kaplan Multifamily', 1],
  ['Kairoi Residential', 1],
  ['Magnolia Property Company', 1],
  ['Dayrise', 1],
  ['Cardinal Group', 1],
  ['Bridge Property Management', 1],
  ['Bridger Land Group', 1],
  ['Boraie Development', 1],
  ['Radco', 1],
  ['Kenco', 1],
  ['Tecton', 1],
  ['Avanti Residential', 1],
  ['Bell Partners', 1],
  ['RangeWater Real Estate', 1],
  ['Realty Operations Group', 1],
  ['29th Street Communities', 1],
  ['EMBREY', 1],
  ['Hawthorne Residential', 1],
  ['Kettler', 1],
  ['ZRS', 1],
  ['Village Green', 1],
  ['Milhaus', 1],
  ['Griffis Blessing', 1],
  ['FPI', 1],
  ['Cornerstone Apartments', 1],
  ['Affinity Property Management', 1],
  ['Four Star Realty', 1],
  ['Places Management', 0],
  ['BRC Real Estate', 0],
  ['New Earth', 0],
  ['PRI', 0],
  ['Starlight Capital', 0],
  ['First Pointe', 0],
]

export const MGRS: ManagerInfo[] = NAMES.map(([name, installed]) => ({
  name,
  website: '',
  installed,
  systems: ['Yardi'],
  hasAdmin: true,
  ticket: false,
  ...FACTS[name],
}))

/** Personal email domains refused for the buyer's own address (map, C3). */
export const FREE = [
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'ymail.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'aol.com',
  'icloud.com',
  'me.com',
  'proton.me',
  'protonmail.com',
]

/** Business Intelligence, per unit per month, incremental tiers (map, Rule 5): [units in the tier, rate]. */
export const BI_TIERS: [number, number][] = [
  [3000, 1.75],
  [2000, 1.5],
  [5000, 1.25],
  [5000, 0.75],
  [5000, 0.5],
  [Infinity, 0.25],
]

/** Data Access, per property per month: $50 for the first 100, $25 after, minimum one property (map, Rule 5). */
export const DA_FIRST = 100
export const DA_RATE_1 = 50
export const DA_RATE_2 = 25

/** Above this monthly total (all-inclusive, before fees) "Send invoice" is offered too (map, Rule 12 / C4). */
export const INVOICE_THRESHOLD = 1000

/** Contract wording shown before paying (map, Rule 10). */
export const REFUND_TERMS = 'We reserve the right to hold the first month’s payment and will provide refunds based upon time spent.'

/** Installation notice (map, "**"): one string, shown on every screen that leads to R2–R6. Placeholder until the
 * HubSpot owner's text arrives; drop the final wording in here (AL 4). */
export const INSTALL_NOTICE =
  'When you pay, an automated installation starts: we send a short introduction to the person named here to set up the connection.'

/** Product hover text, approved 21 Oct (map, C2). */
export const PRODUCT_TIP =
  'Data Access provides users access to our MCP to query their data, to store property data in their data warehouse, and ETL services for standardizing one or more properties from multiple systems. Business Intelligence is our enterprise reporting and portfolio management platform, and it includes all of the features of Data Access.'

/** Shown where a button is wired up in a later ticket (checkout, call). */
export const PREVIEW_NOTE = 'Not available yet in this preview: payment, quotes, invoices and call requests are connected next.'

export const ADMIN_TIP = 'We send out a short intro to set up the connection. If you don’t know the admin’s contact, provide someone you do.'
export const PROPTECH_TIP = 'Prefer not to share your client’s contact? Enter your own.'
