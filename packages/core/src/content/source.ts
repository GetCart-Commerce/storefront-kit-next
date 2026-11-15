import { ConfigError, type CmsConfig, type StorefrontEnv } from '../config';
import type { Tier } from '../tier';
import { tierFeatures } from '../tier';
import {
    pageSchema,
    siteContentSchema,
    type ContentSource,
    type Page,
    type SeoOverride,
    type SeoTarget,
    type SiteContent,
} from './types';

export interface LocalContent {
    /** Parsed `content/site.json`. */
    site: unknown;
    /** Parsed `content/pages/*.json`. */
    pages?: unknown[];
    /** SEO overrides keyed by `product:<slug>`, `collection:<slug>` or `page:<slug>`. */
    seo?: Record<string, SeoOverride>;
}

/**
 * The built-in content source. A Brand without a CMS is complete with this alone: navigation,
 * banners, pages and SEO come from the Brand's local content files plus Vendure data.
 */
export function createLocalContentSource(content: LocalContent): ContentSource {
    const site: SiteContent = siteContentSchema.parse(content.site);
    const pages = new Map<string, Page>();
    for (const raw of content.pages ?? []) {
        const page = pageSchema.parse(raw);
        if (pages.has(page.slug))
            throw new ConfigError(`Local content defines the page "${page.slug}" twice.`);
        pages.set(page.slug, page);
    }
    const seo = content.seo ?? {};
    return {
        kind: 'local',
        capabilities: { preview: false, publishNotifications: false },
        site: () => Promise.resolve(site),
        page: slug => Promise.resolve(pages.get(slug) ?? null),
        seoOverride: (target: SeoTarget) =>
            Promise.resolve(seo[`${target.kind}:${target.slug}`] ?? pages.get(target.slug)?.seo ?? null),
    };
}

/** Builds a CMS-backed source. Registered by the app, so nothing else imports an adapter. */
export type CmsAdapterFactory = (config: CmsConfig, fallback: ContentSource) => ContentSource;

export interface ContentSourceOptions {
    env: Pick<StorefrontEnv, 'cms'>;
    tier: Tier;
    local: LocalContent;
    /** Present only when a CMS adapter is installed in the app. */
    cmsAdapter?: CmsAdapterFactory | undefined;
}

/**
 * Chooses the content source from configuration. With no CMS configured the built-in source is
 * used and nothing else changes. With a CMS configured, its content takes precedence and local
 * content is the fallback.
 */
export function resolveContentSource({ env, tier, local, cmsAdapter }: ContentSourceOptions): ContentSource {
    const builtIn = createLocalContentSource(local);
    let source = builtIn;
    if (env.cms) {
        if (!cmsAdapter) {
            throw new ConfigError(
                'CMS_URL is set but this release has no CMS adapter installed. Remove the CMS_* variables or deploy a release that includes the adapter.',
            );
        }
        source = cmsAdapter(env.cms, builtIn);
    }
    return tierFeatures(tier).sections ? source : withoutSections(source);
}

/** A Tier without Sections still gets site content and SEO, but no composed pages. */
function withoutSections(source: ContentSource): ContentSource {
    return {
        kind: source.kind,
        capabilities: source.capabilities,
        ...(source.handlers ? { handlers: source.handlers } : {}),
        site: () => source.site(),
        seoOverride: target => source.seoOverride(target),
        page: () => Promise.resolve(null),
    };
}

export interface ResolvedSeo {
    title: string;
    description: string;
    image: string | undefined;
    canonical: string | undefined;
    noindex: boolean;
}

/** An override wins field by field; an empty or missing field falls back to the Vendure value. */
export function resolveSeo(
    override: SeoOverride | null | undefined,
    fallback: { title: string; description?: string; image?: string | undefined },
): ResolvedSeo {
    const pick = (value: string | undefined) => (value && value.trim() ? value : undefined);
    return {
        title: pick(override?.title) ?? fallback.title,
        description: pick(override?.description) ?? fallback.description ?? '',
        image: pick(override?.image) ?? fallback.image,
        canonical: pick(override?.canonical),
        noindex: override?.noindex ?? false,
    };
}
