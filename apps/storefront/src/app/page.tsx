import { resolveSeo } from '@getcart/storefront-core';
import { loadProducts } from '@getcart/storefront-core/next';
import type { Metadata } from 'next';

import { getBrandRuntime, slot } from '../brand';

export async function generateMetadata(): Promise<Metadata> {
    const { content } = await getBrandRuntime();
    const [site, override] = await Promise.all([
        content.site(),
        content.seoOverride({ kind: 'page', slug: 'home' }),
    ]);
    const seo = resolveSeo(override, { title: site.seo.defaultTitle, description: site.seo.description });
    return { title: { absolute: seo.title }, description: seo.description };
}

export default async function Home() {
    const { brand, info, content } = await getBrandRuntime();
    const [site, page, products] = await Promise.all([
        content.site(),
        content.page('home'),
        loadProducts({ take: 8 }),
    ]);
    const HomePage = slot(brand, 'HomePage');
    return <HomePage brand={info} site={site} page={page} products={products} />;
}
