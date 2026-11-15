import { z } from 'zod';

/**
 * Deployment configuration, read from environment variables at runtime. One image serves every
 * Brand: nothing here is baked in at build time, and none of it reaches a client bundle.
 */

export class ConfigError extends Error {}

export interface ChannelBinding {
    /** Lower-case request host, without port. */
    host: string;
    token: string;
}

export interface CmsConfig {
    url: string;
    apiKey: string;
    previewSecret: string;
}

export interface StorefrontEnv {
    brandId: string;
    shopApiUrl: string;
    /** Used when the request host has no binding of its own. */
    defaultChannelToken: string;
    channelBindings: ChannelBinding[];
    /** Public origin of this deployment, without a trailing slash. */
    siteUrl: string;
    /** Cookies are `Secure` whenever the site is served over https. */
    secureCookies: boolean;
    /** Present only when the Brand has a CMS. Absence is a complete, supported configuration. */
    cms: CmsConfig | undefined;
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

const placeholder = (value: string) => value.startsWith('replace-with-');

const required = (name: string) =>
    z
        .string({ error: `${name} is required.` })
        .trim()
        .min(1, `${name} is required.`)
        .refine(value => !placeholder(value), `${name} still holds its placeholder value.`);

const optional = z
    .string()
    .trim()
    .optional()
    .transform(value => (value ? value : undefined));

function httpUrl(name: string) {
    return required(name).refine(value => {
        try {
            const url = new URL(value);
            if (url.username || url.password) return false;
            return url.protocol === 'https:' || (url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname));
        } catch {
            return false;
        }
    }, `${name} must be an https URL (http is allowed for localhost only) without credentials.`);
}

const schema = z.object({
    BRAND_ID: required('BRAND_ID').regex(
        /^[a-z][a-z0-9-]*$/,
        'BRAND_ID must be lower-case letters, digits and dashes.',
    ),
    VENDURE_SHOP_API_URL: httpUrl('VENDURE_SHOP_API_URL'),
    VENDURE_CHANNEL_TOKEN: required('VENDURE_CHANNEL_TOKEN'),
    VENDURE_CHANNEL_HOSTS: optional,
    SITE_URL: httpUrl('SITE_URL'),
    CMS_URL: optional,
    CMS_API_KEY: optional,
    CMS_PREVIEW_SECRET: optional,
});

/** Parses `host=token,host=token`. Hosts are matched exactly; there are no wildcards. */
function parseChannelHosts(value: string | undefined): ChannelBinding[] {
    if (!value) return [];
    return value.split(',').map(entry => {
        const [host, token, ...rest] = entry.split('=').map(part => part.trim());
        if (!host || !token || rest.length > 0) {
            throw new ConfigError(
                'VENDURE_CHANNEL_HOSTS must look like "id.example.com=token-a,sg.example.com=token-b".',
            );
        }
        return { host: host.toLowerCase(), token };
    });
}

function parseCms(values: z.infer<typeof schema>): CmsConfig | undefined {
    const { CMS_URL: url, CMS_API_KEY: apiKey, CMS_PREVIEW_SECRET: previewSecret } = values;
    if (!url && !apiKey && !previewSecret) return undefined;
    if (!url || !apiKey || !previewSecret) {
        throw new ConfigError('Set CMS_URL, CMS_API_KEY and CMS_PREVIEW_SECRET together, or none of them.');
    }
    if (previewSecret.length < 32)
        throw new ConfigError('CMS_PREVIEW_SECRET must contain at least 32 characters.');
    return { url: url.replace(/\/+$/, ''), apiKey, previewSecret };
}

export function parseEnv(env: Record<string, string | undefined>): StorefrontEnv {
    const result = schema.safeParse(env);
    if (!result.success) {
        const problems = result.error.issues.map(issue => issue.message);
        throw new ConfigError(
            `Storefront configuration is invalid:\n- ${[...new Set(problems)].join('\n- ')}`,
        );
    }
    const values = result.data;
    const siteUrl = values.SITE_URL.replace(/\/+$/, '');
    return {
        brandId: values.BRAND_ID,
        shopApiUrl: values.VENDURE_SHOP_API_URL,
        defaultChannelToken: values.VENDURE_CHANNEL_TOKEN,
        channelBindings: parseChannelHosts(values.VENDURE_CHANNEL_HOSTS),
        siteUrl,
        secureCookies: new URL(siteUrl).protocol === 'https:',
        cms: parseCms(values),
    };
}

/**
 * Picks the Channel for a request. Only the request host can select a Channel, and only among
 * the tokens this deployment was configured with. A shopper, a URL parameter or a form field
 * never chooses it.
 */
export function resolveChannelToken(env: StorefrontEnv, requestHost: string | null | undefined): string {
    const host = (requestHost ?? '').toLowerCase().replace(/:\d+$/, '');
    return env.channelBindings.find(binding => binding.host === host)?.token ?? env.defaultChannelToken;
}
