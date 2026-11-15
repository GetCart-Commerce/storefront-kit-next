// Refreshes schema/shop-api.graphql by introspecting a running enterprise Shop API, then
// regenerates the GraphQL types. Introspection is on only in enterprise's development mode.
//
//   pnpm gql:schema                       (http://localhost:3100/shop-api)
//   VENDURE_SHOP_API_URL=… pnpm gql:schema
import { spawnSync } from 'node:child_process';

const url = process.env.VENDURE_SHOP_API_URL ?? 'http://localhost:3100/shop-api';
const cli = 'node_modules/gql.tada/bin/cli.js';

for (const args of [['generate-schema', url, '--output', 'schema/shop-api.graphql'], ['generate-output']]) {
    const result = spawnSync(process.execPath, [cli, ...args], { stdio: 'inherit' });
    if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log(`Schema refreshed from ${url}. Review the diff, run "pnpm check", and update schema/README.md.`);
