import type { BrandDefinition } from '@getcart/storefront-core';

/**
 * Every Brand this release can serve. All of them are compiled into the one image; a deployment
 * picks its Brand with the `BRAND_ID` environment variable.
 *
 * To add a Brand: create `brands/<id>/brand.ts` and add one line here. See docs/new-brand.md.
 */
export const brands: Record<string, () => Promise<{ default: BrandDefinition }>> = {
    atelier: () => import('./atelier/brand'),
    kanvas: () => import('./kanvas/brand'),
};
