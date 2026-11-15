import { getMessages } from '@getcart/storefront-core';
import { loadProducts } from '@getcart/storefront-core/next';
import type { Metadata } from 'next';

import { getBrandRuntime, slot } from '../../brand';

export async function generateMetadata(): Promise<Metadata> {
    const { info } = await getBrandRuntime();
    return { title: getMessages(info.locale).nav.products };
}

export default async function Products() {
    const { brand, info } = await getBrandRuntime();
    const ProductListPage = slot(brand, 'ProductListPage');
    return <ProductListPage brand={info} products={await loadProducts({ take: 24 })} />;
}
