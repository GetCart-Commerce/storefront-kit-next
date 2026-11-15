import { createServer } from 'node:http';

import { createFakeShopApi, type FakeChannel } from './fake-shop-api';

/**
 * Runs the fake Shop API over HTTP for end-to-end tests:
 *
 *   FAKE_SHOP_API_PORT=4100 FAKE_CHANNELS="token-a=http://localhost:3000/checkout/return" tsx src/serve.ts
 */
const port = Number(process.env.FAKE_SHOP_API_PORT ?? 4100);
const baseUrl = `http://localhost:${port}`;

/** Local development default: one Channel that returns to a storefront on port 3000. */
const DEFAULT_CHANNELS = 'local-token=http://localhost:3000/checkout/return';

const channels: Record<string, FakeChannel> = {};
for (const entry of (process.env.FAKE_CHANNELS ?? DEFAULT_CHANNELS).split(',').filter(Boolean)) {
    const separator = entry.indexOf('=');
    channels[entry.slice(0, separator)] = { returnUrl: entry.slice(separator + 1) };
}
if (Object.keys(channels).length === 0) throw new Error('Set FAKE_CHANNELS="channel-token=return-url,…".');

const api = createFakeShopApi({ baseUrl, channels });

createServer((incoming, outgoing) => {
    const chunks: Buffer[] = [];
    incoming.on('data', (chunk: Buffer) => chunks.push(chunk));
    incoming.on('end', () => {
        const headers = new Headers();
        for (const [name, value] of Object.entries(incoming.headers)) {
            if (typeof value === 'string') headers.set(name, value);
        }
        const method = incoming.method ?? 'GET';
        const request = new Request(new URL(incoming.url ?? '/', baseUrl), {
            method,
            headers,
            ...(method === 'GET' || method === 'HEAD' ? {} : { body: Buffer.concat(chunks) }),
        });
        api.handle(request).then(
            async response => {
                outgoing.writeHead(response.status, Object.fromEntries(response.headers));
                outgoing.end(Buffer.from(await response.arrayBuffer()));
            },
            (error: unknown) => {
                outgoing.writeHead(500);
                outgoing.end(String(error));
            },
        );
    });
}).listen(port, () => console.log(`Fake Shop API listening on ${baseUrl}/shop-api`));
