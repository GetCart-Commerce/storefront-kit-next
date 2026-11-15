---
status: accepted
---

# One storefront baseline: a design-free core, Slots for design, one image for every Brand

Decided on 2026-11-10: build from scratch rather than adapt a Vendure storefront starter. The eleven decisions below were accepted together, and each is open to revision. Terms follow [GLOSSARY.md](../../GLOSSARY.md).

getcart-storefront is the only GetCart storefront codebase. Every Tier, from a Starter Brand to an Enterprise Brand with a bespoke design, runs the same Storefront core at the same version. The split that makes this possible is: the core owns every commerce decision, a design owns only markup, and a Brand changes the storefront only through Extension points.

## Decisions

1. **Framework.** Next.js 16 App Router, React 19, server actions, Tailwind 4. Every Shop API call runs on the server with a bearer session token kept in an HttpOnly cookie. Every route renders at request time (`dynamic = 'force-dynamic'` on the root layout), because one image cannot pre-render a Brand it does not know at build time. Catalogue reads are cached per Channel for 60 seconds.
2. **Start point.** Built from scratch. Vendure's starters ([Storefront Starters](https://docs.vendure.io/current/framework/storefront/storefront-starters)) are templates customized by editing them, which is the fork-per-Brand model this repo rules out, and their checkout is native Vendure rather than enterprise's contract. `storefront-fashion` was read for its patterns (server-only transport, cookie handling) and none of its commerce layer was copied.
3. **Per-Brand configuration.** Environment variables carry what differs per deployment or is secret: `BRAND_ID`, `VENDURE_SHOP_API_URL`, `VENDURE_CHANNEL_TOKEN`, optional `VENDURE_CHANNEL_HOSTS`, `SITE_URL` and the optional `CMS_*` values. Everything else lives in `brands/<id>/`: Tier, locale, theme tokens, logo, local content and any Brand design.
4. **Multiple Channels.** One default Channel token per deployment. Further Channels of the same Brand are bound to exact request hosts in `VENDURE_CHANNEL_HOSTS`; an unknown host gets the default. Nothing a shopper sends can choose a Channel. Regional policy is decided by the backend.
5. **Shopper language.** Indonesian and English catalogues ship in the core. A Brand picks one locale per deployment; there is no language switcher yet.
6. **Content source.** One `ContentSource` interface (site content, pages, SEO overrides, optional preview and publication handlers). The built-in source reads `brands/<id>/content/` and is the default. A CMS adapter is wired in one file, `apps/storefront/src/cms.ts`, and switched on by the `CMS_*` variables. The Payload adapter is not built: the CMS repository does not exist to test against.
7. **Customer accounts.** Guest checkout only. Sessions already use bearer tokens, so sign-in is additive.
8. **Repository shape.** A pnpm workspace: `packages/core` (Storefront core), `packages/design` (Default design), `packages/testing` (fake Shop API), `apps/storefront` (routes) and `brands/` (one directory per Brand).
9. **Customization per Tier.** Starter: theme tokens, logo and site content. Pro: adds pages composed from Sections. Enterprise: adds a Brand design that fills Slots. `defineBrand` refuses a Brand that uses an Extension point its Tier does not include.
10. **Terms.** Tier, Storefront core, Default design, Brand design, Extension point, Slot, Section, Content source and Provider UI registry, as defined in the glossary. "Package" is avoided for the offering because it means an npm package here.
11. **Deploy model.** One image per release for every Brand. All Brands are compiled into it and a container picks its Brand with `BRAND_ID`.

## Why upgrades stay a version bump

- A design may import only `@getcart/storefront-core` and `@getcart/storefront-core/next/actions`. A lint rule and `test/boundaries.spec.ts` fail the build otherwise.
- The core imports no design, no Brand and no CMS adapter.
- Brand code lives beside the core in this repo, so a core change that breaks a Brand design fails CI before release, and every Brand ships at the same version.

## Consequences

- **A token or logo change needs a release**, because Brand configuration is compiled in. Reading Brand configuration from a mounted directory was considered and deferred until a Brand needs it.
- **Every Brand's design code is in every image**, and one Brand's broken code fails CI for all. This is accepted for the single version it guarantees.
- **No route is statically generated.** Pages are fast through the per-Channel data cache, not through pre-rendering.
- **The CI checkout runs against a fake Shop API**, not enterprise. The fake executes GraphQL against the committed enterprise schema, so documents are validated, but its behaviour is a simplification. On 2026-11-15 one sandbox purchase was completed from the storefront against the enterprise backend with Biteship and Midtrans sandbox Connections, from the product list to the protected Order page showing the payment as received.

## Considered options

- **Adapt a Vendure starter.** Faster for one Brand; rejected for the reasons in decision 2.
- **A build per Brand.** Allows static generation and a smaller image; rejected because it multiplies release artefacts and lets Brands drift apart in version.
- **A separate repository per Enterprise Brand, consuming published core packages.** Keeps Brand code private to the Brand; deferred until a Brand requires it. The package boundaries above are what would make it possible.
- **A single app with internal folders instead of a workspace.** Less setup; rejected because package `exports` are what make the core's public surface enforceable.
