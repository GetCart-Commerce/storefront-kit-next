# Shop API schema snapshot

`shop-api.graphql` is the enterprise Shop API schema this storefront is typed against. Every
GraphQL document in `packages/core/src/shop/documents.ts` is checked against it, and the fake Shop
API used in tests executes against it.

|                 |                                                                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Source          | GetCart enterprise backend, 2026-11-09                                                                                                 |
| Vendure         | 3.8.1                                                                                                                                  |
| How it was made | From enterprise's compiled `vendure-config` with Vendure's `getFinalVendureSchema` (`apiType: 'shop'`, SDL output), without a database |

## Refreshing it

With enterprise running locally in development mode:

```bash
pnpm gql:schema
```

This introspects `http://localhost:3100/shop-api`, rewrites the snapshot and regenerates
`packages/core/src/shop/graphql-env.d.ts`. Review the diff, run `pnpm check`, and update the table
above. Production Instances disable introspection, so refresh from a development Instance.

CI runs `pnpm gql:check`, which fails when the generated types do not match the snapshot.
