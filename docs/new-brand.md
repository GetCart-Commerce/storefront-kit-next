# Launch a new Brand

For Operators. A new Brand is configuration plus one deployment. No integration work is involved: payments, shipping, checkout and Order confirmation are already in the image.

## Before you start

In the enterprise dashboard, the Brand needs:

- a Channel with products, prices in IDR and stock;
- an Active shipping Connection and an Active payment Connection;
- its pending search index updates run, after any product change. The product list reads the search index, and enterprise buffers index updates until an Operator runs them;
- its Channel token.

The name a shopper sees for a Courier service is the name set on the shipping Connection (for example "JNE REG"), so give each service a name that includes the courier.

## 1. Add the Brand to this repo

Create `brands/<id>/` (lower-case letters, digits and dashes). Copy `brands/atelier/` for a Starter Brand.

```text
brands/<id>/
  brand.ts              Tier, locale, name, logo, theme tokens
  content/site.json     navigation, footer, announcement, SEO defaults
  content/pages/*.json  Pro and Enterprise only: pages composed from Sections
  design/               Enterprise only: components that fill Slots
```

Then add one line to `brands/index.ts`:

```ts
<id>: () => import('./<id>/brand'),
```

What each Tier may set:

|                                                 | Starter | Pro | Enterprise |
| ----------------------------------------------- | ------- | --- | ---------- |
| Theme tokens, logo, name, locale                | yes     | yes | yes        |
| Site content (navigation, footer, SEO defaults) | yes     | yes | yes        |
| Pages composed from Sections                    | no      | yes | yes        |
| Brand design that fills Slots                   | no      | no  | yes        |

`pnpm check` fails if a Brand uses something its Tier does not include.

## 2. Release

Merge the change and tag a release. CI builds one image; every Brand runs that same image.

## 3. Deploy on Coolify

Create one application from the release image and set these environment variables:

| Variable                | Value                                                                    |
| ----------------------- | ------------------------------------------------------------------------ |
| `BRAND_ID`              | the directory name from step 1                                           |
| `VENDURE_SHOP_API_URL`  | the Instance's Shop API, for example `https://api.example.com/shop-api`  |
| `VENDURE_CHANNEL_TOKEN` | the Brand's Channel token                                                |
| `SITE_URL`              | the storefront's public origin, for example `https://brand.example.com`  |
| `VENDURE_CHANNEL_HOSTS` | optional: `host=token,host=token` for further Channels of the same Brand |

Leave `CMS_URL`, `CMS_API_KEY` and `CMS_PREVIEW_SECRET` unset for a Brand without a CMS. Set all three only when the Brand has one and the release includes the CMS adapter.

Point the health check at `/api/health`. It answers `{"status":"ok","brand":"<id>",…}` when the configuration is valid, and names what is wrong when it is not.

## 4. Tell enterprise where to return shoppers

The payment return URL is `<SITE_URL>/checkout/return`. It is set on the enterprise Instance as `MIDTRANS_RETURN_URL`, and the payment Connection cannot be activated without it.

Enterprise accepts one return URL per Instance today. A second Brand on the same Instance cannot have its own until enterprise changes that.

No CORS origin is needed: the browser never calls the Shop API.

## 5. Check the launch

1. Open `/api/health` and confirm the Brand and Tier.
2. Add a product to the cart and complete a sandbox purchase.
3. Confirm the Order page shows the payment as received, and that the same URL in a private window shows "not found".

## Upgrade a Brand

Deploy the next release image. Brand code does not edit the Storefront core, so there is nothing to merge.
