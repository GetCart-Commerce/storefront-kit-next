import { describe, expect, it } from 'vitest';

import {
    ConfigError,
    createLocalContentSource,
    defineBrand,
    deriveCheckoutStep,
    getMessages,
    NOTICE_CODES,
    parseEnv,
    parseNotice,
    resolveChannelToken,
    resolveContentSource,
    resolveSeo,
    themeToCss,
    type BrandDefinition,
} from '../src';
import { isSafeProviderUrl } from '../src/server';

const env = {
    BRAND_ID: 'atelier',
    VENDURE_SHOP_API_URL: 'http://localhost:3100/shop-api',
    VENDURE_CHANNEL_TOKEN: 'token-default',
    SITE_URL: 'http://localhost:3000',
};

describe('parseEnv', () => {
    it('accepts a Brand with no CMS as a complete configuration', () => {
        const parsed = parseEnv(env);
        expect(parsed).toMatchObject({
            brandId: 'atelier',
            cms: undefined,
            secureCookies: false,
            channelBindings: [],
        });
    });

    it('uses Secure cookies on an https site', () => {
        expect(parseEnv({ ...env, SITE_URL: 'https://atelier.example.com/' })).toMatchObject({
            siteUrl: 'https://atelier.example.com',
            secureCookies: true,
        });
    });

    it('reports every missing or placeholder value at once', () => {
        expect(() => parseEnv({ VENDURE_CHANNEL_TOKEN: 'replace-with-channel-token' })).toThrow(
            /BRAND_ID is required[\s\S]*VENDURE_SHOP_API_URL is required[\s\S]*placeholder[\s\S]*SITE_URL is required/,
        );
    });

    it('refuses plain http outside localhost and URLs with credentials', () => {
        expect(() => parseEnv({ ...env, VENDURE_SHOP_API_URL: 'http://api.example.com/shop-api' })).toThrow(
            ConfigError,
        );
        expect(() => parseEnv({ ...env, SITE_URL: 'https://user:pass@example.com' })).toThrow(ConfigError);
    });

    it('turns the CMS on only when all three values are present', () => {
        const cms = {
            CMS_URL: 'https://cms.example.com/',
            CMS_API_KEY: 'key',
            CMS_PREVIEW_SECRET: 'x'.repeat(32),
        };
        expect(parseEnv({ ...env, ...cms }).cms).toEqual({
            url: 'https://cms.example.com',
            apiKey: 'key',
            previewSecret: 'x'.repeat(32),
        });
        expect(() => parseEnv({ ...env, CMS_URL: cms.CMS_URL })).toThrow(/together/);
        expect(() => parseEnv({ ...env, ...cms, CMS_PREVIEW_SECRET: 'short' })).toThrow(/32 characters/);
    });
});

describe('resolveChannelToken', () => {
    const multi = parseEnv({
        ...env,
        VENDURE_CHANNEL_HOSTS: 'id.example.com=token-id, SG.example.com=token-sg',
    });

    it('lets only the request host choose, and only among configured Channels', () => {
        expect(resolveChannelToken(multi, 'id.example.com')).toBe('token-id');
        expect(resolveChannelToken(multi, 'sg.example.com:443')).toBe('token-sg');
        expect(resolveChannelToken(multi, 'evil.example.com')).toBe('token-default');
        expect(resolveChannelToken(multi, null)).toBe('token-default');
    });

    it('refuses a malformed binding list', () => {
        expect(() => parseEnv({ ...env, VENDURE_CHANNEL_HOSTS: 'id.example.com' })).toThrow(ConfigError);
    });
});

describe('content source', () => {
    const local = {
        site: { navigation: [{ label: 'Shop', href: '/products' }], seo: { defaultTitle: 'Atelier' } },
        pages: [
            {
                slug: 'home',
                title: 'Home',
                seo: { title: 'Welcome' },
                sections: [{ type: 'hero', heading: 'Hello' }],
            },
        ],
    };

    it('serves pages, navigation and SEO from local content with no CMS', async () => {
        const source = resolveContentSource({ env: { cms: undefined }, tier: 'pro', local });
        expect((await source.site()).navigation).toEqual([{ label: 'Shop', href: '/products' }]);
        expect((await source.page('home'))?.sections[0]).toMatchObject({
            type: 'hero',
            heading: 'Hello',
            text: '',
        });
        expect(await source.page('missing')).toBeNull();
        expect(await source.seoOverride({ kind: 'page', slug: 'home' })).toEqual({ title: 'Welcome' });
    });

    it('gives a Starter Brand site content but no composed pages', async () => {
        const source = resolveContentSource({ env: { cms: undefined }, tier: 'starter', local });
        expect((await source.site()).seo.defaultTitle).toBe('Atelier');
        expect(await source.page('home')).toBeNull();
    });

    it('uses the CMS adapter when a CMS is configured, with local content as its fallback', async () => {
        const cms = { url: 'https://cms.example.com', apiKey: 'key', previewSecret: 'x'.repeat(32) };
        const source = resolveContentSource({
            env: { cms },
            tier: 'pro',
            local,
            cmsAdapter: (config, fallback) => ({
                ...fallback,
                kind: `cms:${config.url}`,
                capabilities: { preview: true, publishNotifications: true },
            }),
        });
        expect(source.kind).toBe('cms:https://cms.example.com');
        expect(source.capabilities.preview).toBe(true);
        expect(() => resolveContentSource({ env: { cms }, tier: 'pro', local })).toThrow(
            /no CMS adapter installed/,
        );
    });

    it('rejects invalid local content and duplicate pages', () => {
        expect(() => createLocalContentSource({ site: {} })).toThrow();
        expect(() =>
            createLocalContentSource({ site: local.site, pages: [local.pages[0], local.pages[0]] }),
        ).toThrow(/twice/);
    });

    it('lets an SEO override win field by field and fall back to Vendure values', () => {
        const fallback = { title: 'Linen Shirt', description: 'From Vendure', image: 'vendure.jpg' };
        expect(resolveSeo(null, fallback)).toEqual({ ...fallback, canonical: undefined, noindex: false });
        expect(resolveSeo({ title: 'Summer linen', description: '  ' }, fallback)).toMatchObject({
            title: 'Summer linen',
            description: 'From Vendure',
            image: 'vendure.jpg',
        });
    });
});

describe('defineBrand', () => {
    const base: BrandDefinition = {
        id: 'atelier',
        name: 'Atelier',
        tier: 'starter',
        locale: 'id',
        logo: undefined,
        theme: {
            colors: {
                background: '#fff',
                foreground: '#111',
                muted: '#666',
                border: '#ddd',
                brand: '#0a5',
                brandForeground: '#fff',
            },
            radius: '0.5rem',
            fontSans: 'system-ui, sans-serif',
            fontDisplay: 'Georgia, serif',
        },
        content: { site: { seo: { defaultTitle: 'Atelier' } } },
    };
    const Component = () => null;

    it('renders theme tokens as CSS custom properties', () => {
        expect(themeToCss(defineBrand(base).theme)).toContain('--gc-brand:#0a5;');
    });

    it('lets only the Enterprise Tier replace components', () => {
        expect(() => defineBrand({ ...base, slots: { ProductPage: Component } })).toThrow(
            /starter Tier cannot replace components/,
        );
        expect(() => defineBrand({ ...base, tier: 'pro', slots: { ProductPage: Component } })).toThrow(
            ConfigError,
        );
        expect(
            defineBrand({ ...base, tier: 'enterprise', slots: { ProductPage: Component } }).slots
                ?.ProductPage,
        ).toBe(Component);
    });

    it('lets only Pro and Enterprise compose pages from Sections', () => {
        const pages = [{ slug: 'home', title: 'Home', sections: [] }];
        expect(() => defineBrand({ ...base, content: { ...base.content, pages } })).toThrow(
            /cannot compose pages/,
        );
        expect(defineBrand({ ...base, tier: 'pro', content: { ...base.content, pages } }).tier).toBe('pro');
    });

    it('refuses a token that could break out of the stylesheet', () => {
        const colors = { ...base.theme.colors, brand: 'red;} body{display:none' };
        expect(() => defineBrand({ ...base, theme: { ...base.theme, colors } })).toThrow(
            /not a safe CSS value/,
        );
    });
});

describe('checkout state', () => {
    const line = {
        id: '1',
        variantId: '11',
        productSlug: 's',
        name: 'n',
        sku: 's',
        quantity: 1,
        unitPriceWithTax: 1,
        linePriceWithTax: 1,
        image: undefined,
    };
    const contact = { firstName: 'A', lastName: 'B', emailAddress: 'a@b.test', phoneNumber: '0812345678' };
    const address = {
        fullName: 'A B',
        streetLine1: 'Jl. 1',
        streetLine2: '',
        city: 'Bandung',
        province: 'Jawa Barat',
        postalCode: '40115',
        countryCode: 'ID',
        phoneNumber: '0812345678',
    };
    const destination = {
        id: 'a',
        name: 'a',
        city: 'Bandung',
        province: 'Jawa Barat',
        postalCode: '40115',
        countryCode: 'ID',
    };
    const order = { state: 'AddingItems', lines: [line], contact, address, destination };

    it('derives each step from the Order alone', () => {
        const step = (patch: object = {}, extra: object = {}) =>
            deriveCheckoutStep({ order: { ...order, ...patch }, paymentStarted: false, ...extra });
        expect(deriveCheckoutStep({ order: undefined, paymentStarted: false })).toBe('empty');
        expect(step({ lines: [] })).toBe('empty');
        expect(step({ contact: undefined })).toBe('contact');
        expect(step({ address: undefined })).toBe('delivery');
        expect(step({ destination: undefined })).toBe('delivery');
        expect(step()).toBe('rates');
        expect(step({ state: 'ArrangingPayment' })).toBe('payment');
        expect(step({ state: 'PaymentSettled' })).toBe('in-progress');
        expect(step({ state: 'ArrangingPayment' }, { paymentStarted: true })).toBe('in-progress');
    });

    it('lets the shopper go back only while the cart is editable', () => {
        expect(deriveCheckoutStep({ order, paymentStarted: false, edit: 'contact' })).toBe('contact');
        expect(deriveCheckoutStep({ order, paymentStarted: false, edit: 'delivery' })).toBe('delivery');
        expect(
            deriveCheckoutStep({
                order: { ...order, state: 'ArrangingPayment' },
                paymentStarted: false,
                edit: 'contact',
            }),
        ).toBe('payment');
    });
});

describe('notices and copy', () => {
    it('has Indonesian and English copy for every notice', () => {
        for (const locale of ['id', 'en'] as const) {
            const notices = getMessages(locale).notices;
            for (const code of NOTICE_CODES) expect(notices[code], `${locale}:${code}`).toBeTruthy();
        }
    });

    it('accepts only known notice codes from a URL', () => {
        expect(parseNotice('RECONFIRMATION_REQUIRED')).toBe('RECONFIRMATION_REQUIRED');
        expect(parseNotice('<script>')).toBeUndefined();
        expect(parseNotice(['RECONFIRMATION_REQUIRED'])).toBeUndefined();
    });
});

describe('isSafeProviderUrl', () => {
    it('follows only https Provider pages, or localhost while the site itself is local', () => {
        expect(isSafeProviderUrl('https://app.sandbox.midtrans.com/snap/v4/redirection/abc', false)).toBe(
            true,
        );
        expect(isSafeProviderUrl('http://app.sandbox.midtrans.com/snap', false)).toBe(false);
        expect(isSafeProviderUrl('http://localhost:4100/pay/x', false)).toBe(false);
        expect(isSafeProviderUrl('http://localhost:4100/pay/x', true)).toBe(true);
        expect(isSafeProviderUrl('javascript:alert(1)', true)).toBe(false);
        expect(isSafeProviderUrl('https://user:pw@example.com', false)).toBe(false);
    });
});
