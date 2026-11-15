# getcart-storefront

The shopper-facing site for every GetCart offering: one codebase, one image per release, deployed once per Brand.

- [docs/architecture.md](docs/architecture.md): layout and ground rules
- [GLOSSARY.md](GLOSSARY.md): the words this repo uses
- [docs/adr/0001-one-storefront-baseline.md](docs/adr/0001-one-storefront-baseline.md): why it is built this way
- [docs/new-brand.md](docs/new-brand.md): launch a new Brand

## Requirements

- Node 22.16 or later in the 22 line
- pnpm 10.24

## Set up

```bash
pnpm install
```

```bash
pnpm check
```

## Run against the fake Shop API

This needs nothing else running. It is the quickest way to see the storefront.

Start the fake API in one terminal. It listens on port 4100 and accepts the Channel token `local-token`:

```bash
pnpm --filter @getcart/storefront-testing fake-api
```

Create `apps/storefront/.env.local`:

```ini
BRAND_ID=atelier
VENDURE_SHOP_API_URL=http://localhost:4100/shop-api
VENDURE_CHANNEL_TOKEN=local-token
SITE_URL=http://localhost:3000
```

Start the storefront in another terminal:

```bash
pnpm dev
```

Open http://localhost:3000. Set `BRAND_ID=kanvas` and restart to see the Enterprise example Brand.

## Run against enterprise

This needs the GetCart enterprise backend, which is not public. Without it, use the fake Shop API above.

1. Start the enterprise backend locally. Its Shop API is `http://localhost:3100/shop-api`.
2. In enterprise's `.env`, set `MIDTRANS_RETURN_URL=http://localhost:3000/checkout/return` and restart it. No CORS origin is needed, because the browser never calls the Shop API.
3. In the enterprise dashboard, make sure the Brand's Channel has products, an Active shipping Connection and an Active payment Connection, and copy its Channel token.
4. Run the pending search index updates in the dashboard. Enterprise buffers them, and the product list reads the search index, so new products do not appear until this is done.
5. Copy [.env.example](.env.example) to `apps/storefront/.env.local` and fill in the Channel token.
6. Run `pnpm dev`.

A sandbox purchase was run against the enterprise backend on 2026-11-15, with Biteship and Midtrans sandbox Connections:

| Step                                                                            | Result                                          |
| ------------------------------------------------------------------------------- | ----------------------------------------------- |
| Product list, product page, cart, contact details                               | Works                                           |
| Area search, address, live Biteship rates, choosing a Courier service           | Works                                           |
| Confirmed total, starting the Midtrans payment, paying with a sandbox test card | Works                                           |
| Return page with forged query values                                            | Shows "Waiting for payment", marks nothing paid |
| Order page changing to "Payment received" by polling, with no reload            | Works, 269 seconds after opening                |
| The same Order URL in a browser without the grant                               | Shows "not found"                               |

## Test

| Command                           | What it covers                                                                                                              |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `pnpm test`                       | Money formatting, configuration, content source, checkout state, the full checkout flow with no CMS, and package boundaries |
| `pnpm build` then `pnpm test:e2e` | The built storefront in a browser, once per example Brand, with no CMS                                                      |

The first end-to-end run needs a browser:

```bash
pnpm --filter @getcart/storefront-app exec playwright install chromium
```

## Example Brands

Both run the same build and complete the same checkout.

| Brand     | Tier       | What it changes                                                            |
| --------- | ---------- | -------------------------------------------------------------------------- |
| `atelier` | Starter    | Theme tokens and site content only                                         |
| `kanvas`  | Enterprise | Theme tokens, a home page composed from Sections, and its own product page |

## Build the image

```bash
docker build -t getcart-storefront .
```

The image holds every Brand. A container chooses one with `BRAND_ID`. See [docs/new-brand.md](docs/new-brand.md).

## License

Licensed under the [Apache License 2.0](LICENSE). See [NOTICE](NOTICE) for copyright and trademark details.

This project is not affiliated with or endorsed by Vendure or Payload.
