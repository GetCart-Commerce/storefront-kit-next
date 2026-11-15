import { z } from 'zod';

/**
 * Editorial content. Commerce data (names, slugs, prices, stock, product descriptions) always
 * comes from Vendure and is never part of these types: a Section references a product or a
 * Collection by slug, and the storefront reads the current record from the Shop API.
 */

const link = z.object({ label: z.string().min(1), href: z.string().min(1) });

export const siteContentSchema = z.object({
    navigation: z.array(link).default([]),
    footer: z
        .object({ links: z.array(link).default([]), note: z.string().default('') })
        .default({ links: [], note: '' }),
    /** One line shown above the header, such as a shipping notice. */
    announcement: z.string().optional(),
    seo: z.object({
        /** `%s` is replaced by the page title. */
        titleTemplate: z.string().default('%s'),
        defaultTitle: z.string().min(1),
        description: z.string().default(''),
    }),
});

const heroSection = z.object({
    type: z.literal('hero'),
    heading: z.string().min(1),
    text: z.string().default(''),
    image: z.string().optional(),
    cta: link.optional(),
});

const productGridSection = z.object({
    type: z.literal('product-grid'),
    heading: z.string().default(''),
    /** Vendure Collection slug. Omit for the whole catalogue. */
    collectionSlug: z.string().optional(),
    take: z.number().int().min(1).max(24).default(8),
});

const richTextSection = z.object({
    type: z.literal('rich-text'),
    heading: z.string().default(''),
    /** Plain paragraphs. Developers add new Section types; there is no free-form page builder. */
    paragraphs: z.array(z.string()).min(1),
});

export const sectionSchema = z.discriminatedUnion('type', [heroSection, productGridSection, richTextSection]);

export const seoOverrideSchema = z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    image: z.string().optional(),
    canonical: z.string().optional(),
    noindex: z.boolean().optional(),
});

export const pageSchema = z.object({
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    title: z.string().min(1),
    seo: seoOverrideSchema.optional(),
    sections: z.array(sectionSchema),
});

export type SiteContent = z.infer<typeof siteContentSchema>;
export type Section = z.infer<typeof sectionSchema>;
export type Page = z.infer<typeof pageSchema>;
export type SeoOverride = z.infer<typeof seoOverrideSchema>;

export type SeoTarget = { kind: 'product' | 'collection' | 'page'; slug: string };

/**
 * The one interface editorial content sits behind. The built-in source (local content files) is
 * the default; a CMS adapter is a second implementation, switched on by configuration alone.
 * No commerce, checkout or design code imports an adapter.
 */
export interface ContentSource {
    readonly kind: string;
    site(): Promise<SiteContent>;
    /** Published content only, unless `draft` is set by an authenticated preview. */
    page(slug: string, options?: { draft?: boolean }): Promise<Page | null>;
    /** A Brand's SEO override for a record, or null. Empty fields fall back to Vendure values. */
    seoOverride(target: SeoTarget): Promise<SeoOverride | null>;
    /** What exists only with a CMS. */
    readonly capabilities: { preview: boolean; publishNotifications: boolean };
    /**
     * Request handlers a CMS adapter owns: scoped, expiring draft preview, and publication
     * notifications for cache refresh. The built-in source has none, so with no CMS configured
     * the storefront's preview and publication routes answer 404.
     */
    readonly handlers?: {
        preview?(request: Request): Promise<Response>;
        publication?(request: Request): Promise<Response>;
    };
}
