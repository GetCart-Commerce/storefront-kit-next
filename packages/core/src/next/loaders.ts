import 'server-only';

import { cache } from 'react';

import type { BrandDefinition } from '../brand';
import { resolveContentSource, type CmsAdapterFactory } from '../content/source';
import type { ContentSource } from '../content/types';
import * as catalog from '../server/catalog';
import * as checkout from '../server/checkout';
import type {
    CheckoutEditTarget,
    CheckoutView,
    OrderConfirmationView,
    OrderView,
    ProductCard,
    ProductView,
} from '../types';
import { getContext, getEnv } from './runtime';

/**
 * Loaders for routes. A page calls a loader, then renders whichever component fills its Slot.
 * Loaders that read a shopper's session make the route dynamic, so it is never cached.
 */

export const loadProducts = cache(
    async (input: { take?: number; collectionSlug?: string | undefined } = {}): Promise<ProductCard[]> =>
        catalog.listProducts(await getContext(), input),
);

export const loadProduct = cache(async (slug: string): Promise<ProductView | null> =>
    catalog.getProduct(await getContext(), slug),
);

export const loadCart = cache(async (): Promise<OrderView | undefined> =>
    checkout.getActiveOrder(await getContext()),
);

export const loadCartQuantity = cache(async (): Promise<number> =>
    checkout.getCartQuantity(await getContext()),
);

export async function loadCheckout(input: {
    areaTerm?: string | undefined;
    edit?: CheckoutEditTarget | undefined;
}): Promise<CheckoutView> {
    return checkout.getCheckout(await getContext(), input);
}

export async function loadOrderConfirmation(code: string): Promise<OrderConfirmationView | undefined> {
    return checkout.getOrderConfirmation(await getContext(), code);
}

/** The Order this browser was paying for, for the hosted-payment return page. */
export async function loadReturnOrderCode(): Promise<string | undefined> {
    return checkout.getReturnOrderCode(await getContext());
}

const sources = new WeakMap<BrandDefinition, ContentSource>();

/**
 * The Brand's content source: local content by default, a CMS when one is configured. The app
 * passes the CMS adapter (if this release ships one), so nothing in the core imports it.
 */
export function getContentSource(brand: BrandDefinition, cmsAdapter?: CmsAdapterFactory): ContentSource {
    let source = sources.get(brand);
    if (!source) {
        source = resolveContentSource({ env: getEnv(), tier: brand.tier, local: brand.content, cmsAdapter });
        sources.set(brand, source);
    }
    return source;
}
