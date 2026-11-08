# Pricing page

The buyer-facing pricing flow from the Pricing Workflow Map v2: company and role, who manages the
properties, the properties themselves, product, contact details, price. This ticket's build is a
static page: a built-in manager list stands in for the managers endpoint, the address lookup is a
stub, and the Pay now / Save quote / Send invoice / Request call buttons are wired in later tickets.

```sh
npm install
npm run dev        # http://localhost:7123
npm test           # vitest: model, flow, upload parser, screens
npm run build      # type-check and bundle to dist/
```

Every push to `main` is built and published by `.github/workflows/pages.yml` to
https://joyhubio.github.io/Pricing-Onboarding-Demo-UI/ (GitHub Pages, source "GitHub Actions").

## Walking every route

The **Test routes** panel on the left lists every route case in the map, grouped as self-managed,
third-party manager and mixed orders. Clicking a case loads it with stand-in answers and lands on the
price screen (or the call screen for an all-offline order), with the routes listed under "What happens
after payment". The panel also shows the codes of the order on screen as you walk it by hand. The cases
are the `SCENARIOS` constant in `src/scenarios.ts`, each built by walking the real flow, and
`src/scenarios.test.ts` checks that every one lands where the map says. The panel is demo tooling for
this stub build; a page on live manager data hides it.

The **Status** panel on the right shows what has been entered so far and what the page made of it: the
company and each manager with the lookup result and its three facts (systems, admin on the deal, ticket
flag), the systems and administrators given, contacts, properties per row, the route of every row and
the order. Both panels toggle from the top bar.

To walk a case by hand, follow its recipe from "Start over". The company names come from the built-in
list in `src/data.ts` (five characters bring suggestions):

| Route | Role, answers | Company |
| ----- | ------------- | ------- |
| R1, one system | Manager | Bozzuto |
| R1, pick systems | Manager | Mill Creek (RealPage and Entrata) |
| R1 by website | Owner, self-manage, any name with website `livebh.com` | BH |
| R2 | Owner, self-manage, any unknown company | Acme Holdings, then 1 or 2 systems |
| X1 among R2 | as R2 with 2 systems, the second "Other" | |
| X2 | Owner, self-manage, unknown company, None, Yes | |
| R3 | Owner, third-party | Bozzuto |
| R4 by flag | Owner, third-party | Greystar |
| R4 by missing administrator | Owner, third-party | Cushman & Wakefield (one system), Mark Taylor Residential (two) |
| R3 / R6 | Owner, third-party, pick a system or "I don't know" | Asset Living |
| A2 / R5 / X1 | Owner, third-party, an unknown company, then the PMS and administrator questions | Fresh Management |
| Both | Owner, Both: the self part, then the managers | |
| PropTech | PropTech, one client per loop | |

Website override: on any company screen, type a website such as `livebh.com` to match BH whatever
the name says.

Uploads: `src/test/fixtures/properties.csv` and `properties.xlsx` are small files to try on a
properties screen (one row without a name is skipped and reported; one has unreadable units to fix
on screen).

Prices: Data Access with 20 properties is $1,000 a month (Pay now and Save quote); 21 is $1,050
(Send invoice appears).
