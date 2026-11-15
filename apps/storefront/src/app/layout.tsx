import './globals.css';

import { themeToCss } from '@getcart/storefront-core';
import { getEnv, loadCartQuantity } from '@getcart/storefront-core/next';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { getBrandRuntime, slot } from '../brand';

/**
 * Every route renders at request time. The build has no Brand: the Brand, its Channel and its
 * theme are read from the environment when a request arrives, which is what lets one image
 * serve every Brand.
 */
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
    const { content } = await getBrandRuntime();
    const { seo } = await content.site();
    return {
        metadataBase: new URL(getEnv().siteUrl),
        title: { default: seo.defaultTitle, template: seo.titleTemplate },
        description: seo.description,
    };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
    const { brand, info, content } = await getBrandRuntime();
    const [site, cartQuantity] = await Promise.all([content.site(), loadCartQuantity().catch(() => 0)]);
    const Layout = slot(brand, 'Layout');
    return (
        <html lang={info.locale} data-brand={info.id} data-tier={info.tier}>
            <head>
                <style dangerouslySetInnerHTML={{ __html: themeToCss(brand.theme) }} />
            </head>
            <body>
                <Layout brand={info} site={site} cartQuantity={cartQuantity}>
                    {children}
                </Layout>
            </body>
        </html>
    );
}
