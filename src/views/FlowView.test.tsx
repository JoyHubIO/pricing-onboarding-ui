// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import App from '../App'
import { INSTALL_NOTICE, PREVIEW_NOTE, REFUND_TERMS } from '../data'
import { MGRS } from '../test/fixtures/managers'

beforeAll(() => {
  window.scrollTo = () => {}
})
afterEach(cleanup)

/** The screen, without the test routes panel (whose recipes also say "Owner" and name the companies). */
const stage = () => within(screen.getByRole('main'))
const click = (name: string | RegExp) => fireEvent.click(stage().getByRole('button', { name }))
/** A button in the top bar or the panel. */
const clickBar = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))
// A label's text grows by its error message once shown, so a string label matches by its start.
const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(typeof label === 'string' ? new RegExp('^' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) : label), { target: { value } })
const next = () => click(/^Continue$/)

const loadManagers = async () => MGRS
/** The page once its manager list has loaded. */
async function show() {
  render(<App loadManagers={loadManagers} tools />)
  // The panel's recipes also say "Owner", so the first screen's button is looked for on the stage.
  await waitFor(() => stage().getByRole('button', { name: /Owner/ }))
}

/** Owner, self-managed, company typed, on the properties screen. */
async function toProperties(company: string) {
  await show()
  click(/Owner/)
  click(/We self-manage/)
  type(/^Company$/, company)
  next()
}

/** Counts on the current properties screen. */
function counts(props: number, units: number) {
  click(/Property and unit count/)
  type('Property count', String(props))
  type(/^Units$/, String(units))
  next()
}

function who(email: string) {
  type('First name', 'Ann')
  type('Last name', 'Buyer')
  type('Work email', email)
  next()
}

describe('the page', () => {
  it('R1 to a price; the email errors keep Continue clickable; two checkout options at $1,000', async () => {
    await toProperties('Bozzuto')
    expect(screen.getByRole('heading').textContent).toMatch(/on Yardi/)
    expect(screen.queryByText(INSTALL_NOTICE)).toBeNull()
    counts(20, 2000)
    click(/Data Access/)
    expect(screen.getByRole('heading').textContent).toMatch(/send your login/)
    who('ann@gmail.com')
    expect(screen.getByText('Please use a work email, not a personal address.')).toBeTruthy()
    expect((screen.getByRole('button', { name: /^Continue$/ }) as HTMLButtonElement).disabled).toBe(false)
    type('Work email', 'ann@acme')
    expect(screen.getByText('Enter a valid email address.')).toBeTruthy()
    type('Work email', 'ann@acme.com')
    next()
    expect(screen.getByRole('heading').textContent).toBe('$1,000 / month')
    expect(screen.getByRole('button', { name: /Pay now/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Save quote/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Send invoice/ })).toBeNull()
    expect(within(screen.getByText('What happens after payment').parentElement!).getByText('R1')).toBeTruthy()
    // Save quote is inert in this ticket
    click(/Save quote/)
    expect(screen.getByText(PREVIEW_NOTE)).toBeTruthy()
    // Pay now shows the refund terms and stops
    click(/Pay now/)
    expect(screen.getByRole('heading').textContent).toBe('Pay $1,000')
    expect(screen.getByText(new RegExp(REFUND_TERMS.slice(0, 30)))).toBeTruthy()
  })

  it('three checkout options at $1,050, and the notice on an R2 administrator screen', async () => {
    await toProperties('Acme Holdings')
    expect(screen.getByRole('heading').textContent).toMatch(/How many property management systems/)
    click(/^1$/)
    click(/^Yardi$/)
    expect(screen.getByRole('heading').textContent).toMatch(/Yardi administrator/)
    expect(screen.getByText(INSTALL_NOTICE)).toBeTruthy()
    type('First name', 'Sam')
    type('Last name', 'Admin')
    type(/^Email$/, 'sam@acme-holdings.com')
    next()
    counts(21, 2100)
    click(/Data Access/)
    who('ann@acme-holdings.com')
    expect(screen.getByRole('heading').textContent).toBe('$1,050 / month')
    expect(screen.getByRole('button', { name: /Send invoice/ })).toBeTruthy()
    const routes = screen.getByText('What happens after payment').parentElement!
    expect(within(routes).getByText('R2')).toBeTruthy()
    expect(within(routes).getByText(/sam@acme-holdings.com/)).toBeTruthy()
  })

  it('company suggestions appear from five characters and a pick fills the website', async () => {
    await show()
    click(/Owner/)
    click(/A third-party manager/)
    type(/Management company/, 'Grey')
    expect(stage().queryByRole('button', { name: /Greystar/ })).toBeNull()
    type(/Management company/, 'Greys')
    click(/Greystar/)
    expect((screen.getByLabelText(/Company website/) as HTMLInputElement).value).toBe('greystar.com')
    next()
    expect(screen.getByRole('heading').textContent).toMatch(/regional or property manager/)
    expect(screen.getByText(INSTALL_NOTICE)).toBeTruthy()
  })

  it('the test routes panel loads a case and hides on request', async () => {
    await show()
    const panel = screen.getByRole('complementary', { name: 'Test routes' })
    expect(within(panel).getByText('no routes yet')).toBeTruthy()
    fireEvent.click(within(panel).getByRole('button', { name: /R4, ticket flag/ }))
    expect(screen.getByRole('heading').textContent).toBe('$1,050 / month')
    const routes = screen.getByText('What happens after payment').parentElement!
    expect(within(routes).getByText('R4')).toBeTruthy()
    expect(within(routes).getByText(/Greystar/)).toBeTruthy()
    expect(within(routes).getByText(/lee.regional@manager.example/)).toBeTruthy()
    expect(within(panel).getByText('R4', { selector: '.side-codes' })).toBeTruthy()
    expect(within(panel).getByRole('button', { name: /R4, ticket flag/ }).getAttribute('aria-pressed')).toBe('true')
    // Changing the order by hand drops the highlight; the live codes follow the order.
    fireEvent.click(within(panel).getByRole('button', { name: /Both: own system/ }))
    expect(within(panel).getByText('R2 · R4', { selector: '.side-codes' })).toBeTruthy()
    clickBar(/Hide test routes/)
    expect(screen.queryByRole('complementary', { name: 'Test routes' })).toBeNull()
    clickBar(/^Test routes$/)
    expect(screen.getByRole('complementary', { name: 'Test routes' })).toBeTruthy()
    clickBar(/Start over/)
    expect(within(screen.getByRole('complementary', { name: 'Test routes' })).getByText('no routes yet')).toBeTruthy()
  })

  it('the status panel follows the answers: lookup facts, systems, routes', async () => {
    await show()
    const status = () => within(screen.getByRole('complementary', { name: 'Entered so far' }))
    expect(status().getByText('not chosen yet')).toBeTruthy()
    click(/Owner/)
    click(/We self-manage/)
    type(/^Company$/, 'Greystar')
    expect(status().getByText(/Found: Greystar/)).toBeTruthy()
    expect(status().getByText('Integrated on Yardi, RealPage (2 deals)')).toBeTruthy()
    expect(status().getByText('Flagged: keep a ticket process')).toBeTruthy()
    type(/^Company$/, 'Acme Holdings')
    expect(status().getByText(/Not in the integration list/)).toBeTruthy()
    next()
    click(/^1$/)
    click(/^Yardi$/)
    expect(status().getByText('Yardi · one of ours → R2')).toBeTruthy()
    type('First name', 'Sam')
    type('Last name', 'Admin')
    type(/^Email$/, 'sam@acme-holdings.com')
    expect(status().getByText('Sam Admin <sam@acme-holdings.com>')).toBeTruthy()
    next()
    counts(5, 500)
    expect(status().getByText('5 properties · 500 units · counts')).toBeTruthy()
    expect(status().getByText('R2', { selector: '.status-route .code' })).toBeTruthy()
    clickBar(/Hide status/)
    expect(screen.queryByRole('complementary', { name: 'Entered so far' })).toBeNull()
    clickBar(/^Status$/)
    expect(screen.getByRole('complementary', { name: 'Entered so far' })).toBeTruthy()
  })

  it('an uploaded CSV becomes rows the buyer can fix', async () => {
    await toProperties('Bozzuto')
    const csv = 'Property,Units,Year\nThe Grove,240,1998\nHill House,n/a,1975\n'
    const file = new File([csv], 'list.csv', { type: 'text/csv' })
    fireEvent.change(screen.getByTestId('upload'), { target: { files: [file] } })
    await screen.findByText(/2 properties read from the file/)
    expect(screen.getByText('list.csv')).toBeTruthy()
    next()
    expect(screen.getByText('Enter the units for every property.')).toBeTruthy()
    type('Units for Hill House', '60')
    expect(stage().getByText(/2 properties · 300 units/)).toBeTruthy()
    next()
    expect(screen.getByRole('heading').textContent).toBe('What do you need?')
  })

  it('waits for the manager list, and offers a retry when it cannot be loaded', async () => {
    let calls = 0
    const flaky = async () => {
      calls += 1
      if (calls === 1) throw new Error('down')
      return MGRS
    }
    render(<App loadManagers={flaky} tools />)
    expect(screen.getByRole('status').textContent).toBe('Loading…')
    expect((await screen.findByRole('alert')).textContent).toMatch(/can’t load pricing/)
    expect(screen.queryByRole('button', { name: /Owner/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => stage().getByRole('button', { name: /Owner/ }))
  })

  it('hides the developer panels when they are off', async () => {
    render(<App loadManagers={loadManagers} tools={false} />)
    await waitFor(() => stage().getByRole('button', { name: /Owner/ }))
    expect(screen.queryByRole('complementary', { name: 'Test routes' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Test routes' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Status' })).toBeNull()
  })
})
