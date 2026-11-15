import 'server-only';

import { cookies, headers } from 'next/headers';

import { parseEnv, resolveChannelToken, type StorefrontEnv } from '../config';
import type { StorefrontContext } from '../server/context';
import { getSessionToken, setSessionToken, type CookieContext, type CookieStore } from '../server/cookies';
import { createShopClient } from '../server/shop-client';

let cachedEnv: StorefrontEnv | undefined;

/** Deployment configuration, validated once per process. An invalid configuration fails loudly. */
export function getEnv(): StorefrontEnv {
    cachedEnv ??= parseEnv(process.env);
    return cachedEnv;
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Builds the per-request context: the Shop API client bound to this deployment's Channel, and
 * the request's cookie jar.
 */
export async function getContext(): Promise<StorefrontContext> {
    const env = getEnv();
    const [cookieJar, requestHeaders] = await Promise.all([cookies(), headers()]);

    const store: CookieStore = {
        get: name => cookieJar.get(name)?.value,
        set: (name, value, options) => {
            try {
                cookieJar.set(name, value, options);
            } catch {
                // Cookies can be written only from a server action or a route handler. Every write
                // in the Storefront core happens in one; a write during rendering is dropped.
            }
        },
        delete: (name, options) => {
            try {
                cookieJar.set(name, '', {
                    httpOnly: true,
                    secure: env.secureCookies,
                    sameSite: 'lax',
                    path: options.path,
                    maxAge: 0,
                });
            } catch {
                // See above.
            }
        },
    };
    const cookieContext: CookieContext = { cookies: store, secure: env.secureCookies };

    const client = createShopClient({
        apiUrl: env.shopApiUrl,
        channelToken: resolveChannelToken(env, requestHeaders.get('host')),
        getSessionToken: () => Promise.resolve(getSessionToken(cookieContext)),
        setSessionToken: token => Promise.resolve(setSessionToken(cookieContext, token)),
    });

    return { client, cookieContext, localSite: LOCAL_HOSTS.has(new URL(env.siteUrl).hostname) };
}
