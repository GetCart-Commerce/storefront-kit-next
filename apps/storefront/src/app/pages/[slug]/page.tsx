import { resolveSeo } from '@getcart/storefront-core';
import { loadProducts } from '@getcart/storefront-core/next';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getBrandRuntime, slot } from '../../../brand';

interface Props {
    params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const [{ slug }, { content }] = await Promise.all([params, getBrandRuntime()]);
    const page = await content.page(slug);
    if (!page) return {};
    const seo = resolveSeo(await content.seoOverride({ kind: 'page', slug }), { title: page.title });
    return {
        title: seo.title,
        description: seo.description,
        ...(seo.noindex ? { robots: { index: false } } : {}),
    };
}

export default async function Content({ params }: Props) {
    const [{ slug }, { brand, info, content }] = await Promise.all([params, getBrandRuntime()]);
    const page = await content.page(slug);
    if (!page) notFound();
    const needsProducts = page.sections.some(section => section.type === 'product-grid');
    const ContentPage = slot(brand, 'ContentPage');
    return (
        <ContentPage
            brand={info}
            page={page}
            products={needsProducts ? await loadProducts({ take: 24 }) : []}
        />
    );
}
