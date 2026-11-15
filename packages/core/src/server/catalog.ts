import { productDocument, searchProductsDocument } from '../shop/documents';
import type { ProductCard, ProductView } from '../types';
import type { StorefrontContext } from './context';
import { mapProduct, mapProductCard } from './mappers';

/** Catalogue reads are anonymous and cached per Channel. They never carry a shopper's session. */
const CATALOGUE_REVALIDATE_SECONDS = 60;
export const CATALOGUE_TAG = 'catalogue';

export async function listProducts(
    context: StorefrontContext,
    input: { take?: number; skip?: number; collectionSlug?: string | undefined } = {},
): Promise<ProductCard[]> {
    const data = await context.client.request(
        searchProductsDocument,
        {
            input: {
                groupByProduct: true,
                take: input.take ?? 24,
                skip: input.skip ?? 0,
                ...(input.collectionSlug ? { collectionSlug: input.collectionSlug } : {}),
            },
        },
        { revalidate: CATALOGUE_REVALIDATE_SECONDS, tags: [CATALOGUE_TAG] },
    );
    return data.search.items.map(mapProductCard);
}

/** Null when Vendure no longer offers the product: the storefront must then not offer it either. */
export async function getProduct(context: StorefrontContext, slug: string): Promise<ProductView | null> {
    const data = await context.client.request(
        productDocument,
        { slug },
        { revalidate: CATALOGUE_REVALIDATE_SECONDS, tags: [CATALOGUE_TAG] },
    );
    return data.product ? mapProduct(data.product) : null;
}
