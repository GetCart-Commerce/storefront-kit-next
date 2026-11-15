import { createFakeShopApi, type FakeShopApi } from '@getcart/storefront-testing';

import { createShopClient, getSessionToken, setSessionToken } from '../src/server';
import type { CookieContext, CookieOptions, CookieStore, StorefrontContext } from '../src/server';

export const CHANNEL_TOKEN = 'test-channel-token';
export const FAKE_BASE_URL = 'http://localhost:4100';

export interface TestCookie {
    value: string;
    options: CookieOptions;
}

/** One browser: a cookie jar plus the context the Storefront core builds per request. */
export interface TestBrowser {
    context: StorefrontContext;
    jar: Map<string, TestCookie>;
}

export function createFake(): FakeShopApi {
    return createFakeShopApi({
        baseUrl: FAKE_BASE_URL,
        channels: { [CHANNEL_TOKEN]: { returnUrl: 'http://localhost:3000/checkout/return' } },
    });
}

export function createBrowser(fake: FakeShopApi, channelToken = CHANNEL_TOKEN): TestBrowser {
    const jar = new Map<string, TestCookie>();
    const cookies: CookieStore = {
        get: name => jar.get(name)?.value,
        set: (name, value, options) => void jar.set(name, { value, options }),
        delete: name => void jar.delete(name),
    };
    const cookieContext: CookieContext = { cookies, secure: true };
    const client = createShopClient({
        apiUrl: `${FAKE_BASE_URL}/shop-api`,
        channelToken,
        fetch: fake.fetch,
        getSessionToken: () => Promise.resolve(getSessionToken(cookieContext)),
        setSessionToken: token => Promise.resolve(setSessionToken(cookieContext, token)),
    });
    return { context: { client, cookieContext, localSite: true }, jar };
}
