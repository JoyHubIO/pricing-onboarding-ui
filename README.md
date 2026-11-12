# Pricing page

The buyer-facing pricing flow from the Pricing Workflow Map v2: company and role, who manages the
properties, the properties themselves, product, contact details, price. The page reads the management
companies and the address lookup from the pricing API in `joyhub-integration`. The Pay now / Save quote /
Send invoice / Request call buttons are not wired yet.

```sh
npm install
npm run dev        # http://localhost:7123, calling the API named in .env.development
npm test           # vitest: model, flow, API client, upload parser, screens
npm run build      # type-check and bundle to dist/
```

Every push to `main` is built and published by `.github/workflows/pages.yml` to
https://joyhubio.github.io/pricing-onboarding-ui/ (GitHub Pages, source "GitHub Actions").

## The API

| Setting | Meaning |
| ------- | ------- |
| `VITE_SCALA_API_URL` | The pricing API host. Locally `http://localhost:7082`, the Scala API of the dev stack. |
| `VITE_API_URL` | Used instead when one host answers both APIs. |
| `VITE_TEST_ROUTES` | `on` shows the two developer panels on a production build; `off` hides them in development. |

The page calls `GET /pricing/managers` once, before the first screen, and `GET /pricing/lookup` from the
Look up button. Every route depends on the manager list, so while it is loading the page waits, and when it
cannot be loaded the page says so and offers "Try again". It never routes on an empty list.

The page only reads. The manager list is the API's mirror of the HubSpot Integrations pipeline, and that
portal is production: nothing in this repository, its tests or its developer panels creates or changes a
HubSpot record. The tests use the list in `src/test/fixtures/managers.ts`, which the page never loads.

## Walking every route

The **Test routes** panel on the left lists every route case in the map, grouped as self-managed,
third-party manager and mixed orders. It is a developer tool: shown by `npm run dev`, hidden on a
production build. Each case runs on a real company from the loaded list. `cast` in `src/scenarios.ts` is
the case finder: it picks, for each kind of company a case needs, the first one in the list.

| Kind | Facts | Cases that need it |
| ---- | ----- | ------------------ |
| single | one system, administrator known, no ticket flag | R1 one system, R3 |
| multi | several systems, administrator known, no ticket flag | R1 pick systems, R3 picked, R6 |
| site | as single, with a website | R1 by website |
| flagged | ticket flag set | R4 by flag |
| noAdmin | one system, no administrator on the deal | R4 by missing administrator |
| noAdminMulti | several systems, no administrator on the deal | R4, two systems |

A case whose kind has no company in HubSpot today is greyed out and says which kind is lacking. The cases
about a company we have never seen (R2, R5, A2, X1, X2) need no HubSpot record and always load. Clicking a
case fills the screens in with stand-in answers and lands on the price screen, or the call screen for an
all-offline order. It sends nothing. The panel also shows the codes of the order on screen as you walk it
by hand, and each case shows its recipe from "Start over" with the real company's name in it.

The **Status** panel on the right shows what has been entered so far and what the page made of it: the
company and each manager with the lookup result and its three facts (systems, admin on the deal, ticket
flag), the systems and administrators given, contacts, properties per row, the route of every row and
the order. Both panels toggle from the top bar.

`src/scenarios.test.ts` checks, on the fixture list, that every case lands where the map says.

Website override: on any company screen, type a listed company's website to match it whatever the name
says.

Uploads: `src/test/fixtures/properties.csv` and `properties.xlsx` are small files to try on a
properties screen (one row without a name is skipped and reported; one has unreadable units to fix
on screen).

Prices: Data Access with 20 properties is $1,000 a month (Pay now and Save quote); 21 is $1,050
(Send invoice appears).
