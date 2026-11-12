/** Constants for the v2 flow (Pricing Workflow Map v2). */

/** Our integrated PMSs (map, Rule 2). Any other PMS goes to the offline workflow X1. */
export const OURS = ['Yardi', 'RealPage', 'Entrata', 'ResMan']

/** One management company as read from the HubSpot Integrations pipeline (map, 1.2: three facts per manager).
 * The page loads the list from GET /pricing/managers (api.ts). */
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

/** Shown where a button is not wired up yet (checkout, call). */
export const PREVIEW_NOTE = 'Not available yet in this preview: payment, quotes, invoices and call requests are connected next.'

export const ADMIN_TIP = 'We send out a short intro to set up the connection. If you don’t know the admin’s contact, provide someone you do.'
export const PROPTECH_TIP = 'Prefer not to share your client’s contact? Enter your own.'
