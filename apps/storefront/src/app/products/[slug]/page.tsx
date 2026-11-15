import { resolveSeo } from '@getcart/storefront-core';
import { loadProduct } from '@getcart/storefront-core/next';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getBrandRuntime, noticeParam, slot } from '../../../brand';

interface Props {
    params: Promise<{ slug: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
    const [{ content }, product] = await Promise.all([getBrandRuntime(), loadProduct(slug)]);
    if (!product) return {};
    // A CMS SEO override wins field by field; otherwise the values are Vendure's.
    const seo = resolveSeo(await content.seoOverride({ kind: 'product', slug }), {
        title: product.name,
        description: product.descriptionHtml
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 160),
        image: product.images[0],
    });
    return {
        title: seo.title,
        description: seo.description,
        ...(seo.canonical ? { alternates: { canonical: seo.canonical } } : {}),
        ...(seo.noindex ? { robots: { index: false } } : {}),
        ...(seo.image ? { openGraph: { images: [seo.image] } } : {}),
    };
}

export default async function Product({ params, searchParams }: Props) {
    const [{ slug }, query, { brand, info }] = await Promise.all([params, searchParams, getBrandRuntime()]);
    const product = await loadProduct(slug);
    // Vendure no longer offers it, so neither does the storefront.
    if (!product) notFound();
    const ProductPage = slot(brand, 'ProductPage');
    return <ProductPage brand={info} product={product} notice={noticeParam(query)} />;
}
