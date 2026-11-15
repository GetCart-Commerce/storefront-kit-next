# Architecture

How getcart-storefront is laid out and the rules its tests enforce. Terms are defined in [GLOSSARY.md](../GLOSSARY.md). Decisions are in [adr/](adr/).

## Where things live

```text
packages/core/      Storefront core: Shop API client, sessions and grants, money, checkout state,
                    content source, Brand and Tier model, shopper copy, server actions
packages/design/    Default design: components that render core view models
packages/testing/   Fake Shop API for tests (executes against schema/shop-api.graphql)
apps/storefront/    Next.js routes: call a core loader, render the component in a Slot
brands/<id>/        One Brand: brand.ts, content/, and for Enterprise a design/
schema/             Enterprise Shop API schema snapshot the code is typed against
```

The core has three entry points:

| Import                                     | Contains                                        | Who may import it     |
| ------------------------------------------ | ----------------------------------------------- | --------------------- |
| `@getcart/storefront-core`                 | Types, money, checkout state, copy, Brand model | Anything              |
| `@getcart/storefront-core/next/actions`    | Server actions for forms                        | Designs and routes    |
| `@getcart/storefront-core/next`, `/server` | Loaders, transport, cookies                     | Routes and tests only |

## Ground rules

These are not negotiable. Each one has a test.

- **One Brand, one deployment, its own Channels.** `BRAND_ID` and the Channel token come from the environment. Every Shop API call sends the `vendure-token` header. A shopper or a URL never chooses the Brand or the Channel.
- **The server is the money authority.** Never compute a charge, total, discount, shipping price or rounding in the storefront. Display what the Shop API returned with `formatMoney`, next to its `currencyCode`. `confirmedTotal` and `confirmedQuoteId` are comparison values that echo what the shopper saw.
- **The browser never marks anything paid.** `/checkout/return` reads nothing from its URL and only redirects. Payment state comes from `checkoutPaymentStatus` and `checkoutOrder`, and the Order page polls while it is `pending` or `uncertain`.
- **Secrets stay on the server.** Session tokens and Order-access grants live in HttpOnly, SameSite=Lax cookies (Secure on https). They never reach a component, a URL, `localStorage` or a log. Grants are sent only in a POST body.
- **Every typed result has its own UI.** The five quote states, each payment result and each native error union map to a Notice or a view with explicit copy in Indonesian and English. Do not add a generic error.
- **One stable idempotency key per payment confirmation.** It is saved before the call and reused on retry. A new key is used only after the shopper has been shown a new total.
- **The CMS is optional.** A Brand with no CMS configured is complete. No commerce, checkout or design code imports a CMS adapter; it is wired only in `apps/storefront/src/cms.ts`.
- **The core is design-free, and designs hold no logic.** A design imports only `@getcart/storefront-core` and `@getcart/storefront-core/next/actions`. If a design needs something the core does not export, add the export. Do not reach into the core and do not copy its logic.
- **Brands change the storefront only through Extension points:** theme tokens, local content, Slots and the Provider UI registry. Never edit the core for one Brand.
- **Never branch on a Provider id or a payment method code.** Branch on the capability the Shop API reports (`PaymentMethodQuote.checkoutHostedPayment`). A Provider that needs its own UI gets a new payment kind in the Provider UI registry.
- **One Tier switch.** What differs between Tiers is decided by `tierFeatures`, on the same build.

## Working here

```bash
pnpm check       # types, lint, format, unit tests
pnpm build
pnpm test:e2e    # both example Brands, no CMS, against the fake Shop API
```

- After changing a GraphQL document, run `pnpm gql:types`. After enterprise's schema changes, run `pnpm gql:schema` (see [schema/README.md](../schema/README.md)).
- When you add a Shop API result the shopper can see, add its Notice code and copy in both languages. A test fails if either is missing.
- The fake Shop API is a simplification of enterprise. A passing end-to-end run proves the storefront's handling, not the contract.
