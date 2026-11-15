# getcart-storefront

The shopper-facing site for every GetCart offering: one codebase, one image per release, deployed once per Brand. Brands differ through configuration, content and Brand designs, never through edits to the Storefront core.

## Language

Terms marked _(enterprise)_ come from the GetCart enterprise backend and mean exactly what they mean there. The rest are this repo's own.

### Companies, Brands and Channels _(enterprise)_

**Company**:
A business that contracts GetCart and owns one or more Brands.
_Avoid_: Tenant, client, customer, account, organization

**Brand**:
A label a Company sells under, with its own identity and one or more Channels. Each Brand has exactly one storefront deployment.
_Avoid_: Tenant, seller, store, label, shop

**Instance**:
One running deployment of the GetCart enterprise backend with its own database. One Instance may serve several Brands, so several storefront deployments.
_Avoid_: Server, environment, stack

**Channel**:
A Vendure sales channel inside an Instance, with its own products, prices and storefront access. A storefront deployment is bound to its Brand's Channel token or tokens by configuration.
_Avoid_: Store, shop

### People _(enterprise)_

**Brand admin**:
A Company's own staff member who works in the dashboard and, when the Brand has one, the CMS.
_Avoid_: Tenant, merchant, store owner

**Operator**:
A GetCart team member who runs Instances and releases, and launches a Brand's storefront.
_Avoid_: Admin, support, ops

**Developer**:
A GetCart engineer who builds the Storefront core, the Default design and Brand designs.
_Avoid_: Engineer, maintainer

**Shopper**:
A person browsing or buying on a Brand's storefront, as a guest or a signed-in customer.
_Avoid_: User, visitor, client

### Integrations _(enterprise)_

**Provider**:
One third-party service within an Integration domain, such as Midtrans or Biteship. The storefront never branches on a Provider's identity.
_Avoid_: Vendor, gateway, integration

**Connection**:
One Brand's configured account with one Provider. Connections live in enterprise; the storefront holds no Provider credential.
_Avoid_: Integration, account, credential, setup

**Courier service**:
One delivery option from a shipping Provider that a Brand offers at checkout, such as JNE REG.
_Avoid_: Shipping method, courier, service level

**CMS**:
A Brand's system for managing storefront editorial content and SEO overrides, separate from its commerce catalogue. Optional: a Brand without one is complete.
_Avoid_: Provider, Connection, commerce catalogue

### Offerings

**Tier**:
What GetCart sold a Brand: `starter`, `pro` or `enterprise`. A Tier decides which Extension points the Brand may use. Every Tier runs the same build.
_Avoid_: Package (it means an npm package here), plan, edition

### Code ownership

**Storefront core**:
The design-free shared layer every Brand runs: the Shop API client, session and grant handling, money formatting, checkout state, the content source and server actions (`packages/core`).
_Avoid_: Base, platform, common, commerce layer

**Default design**:
The visual layer a Brand gets without writing any code (`packages/design`). It is one consumer of the Storefront core and holds no commerce logic.
_Avoid_: Theme, template, UI kit

**Brand design**:
Components written for one Brand that replace parts of the Default design (`brands/<id>/design`). Enterprise Tier only.
_Avoid_: Fork, custom theme, override, customization

**Extension point**:
A named place where the Storefront core lets a Brand change the storefront: theme tokens, local content, Slots and the Provider UI registry. Anything a Brand cannot do through one is a request to add one, never a reason to edit the core.
_Avoid_: Hook, seam, override

**Slot**:
An Extension point for one component or page, with typed props from the Storefront core. A Brand design fills a Slot; otherwise the Default design does.
_Avoid_: Override, plug, region

**Theme tokens**:
The colours, corner radius and fonts a Brand sets in its configuration, applied at runtime as CSS custom properties.
_Avoid_: Theme (alone), skin, styles

**Section**:
One block of a composed page, such as a hero or a product grid. Brand admins arrange approved Sections; Developers add new Section types.
_Avoid_: Block, widget, component

**Content source**:
The one interface editorial content sits behind. The built-in source reads a Brand's local content files; a CMS adapter is a second implementation, switched on by configuration.
_Avoid_: CMS client, content API

**Provider UI registry**:
The Extension point that maps a payment kind, as reported by the Shop API, to the component that pays it. A Provider that needs its own UI registers one here.
_Avoid_: Payment plugin, gateway component

### Checkout

**Notice**:
An outcome the shopper is told about, carried as a code with explicit copy in both languages. Every typed result of the Shop API maps to one.
_Avoid_: Error, toast, flash message

**Order-access grant**:
The 30-day bearer secret from `issueCheckoutOrderAccess` that lets a guest read one Order. It lives only in an HttpOnly cookie scoped to `/order`.
_Avoid_: Order token, order link, magic link
