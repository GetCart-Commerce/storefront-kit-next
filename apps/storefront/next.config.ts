import path from 'node:path';

import type { NextConfig } from 'next';

const noStore = [{ key: 'Cache-Control', value: 'private, no-store' }];

const config: NextConfig = {
    // One image for every Brand: nothing Brand-specific is read at build time.
    output: 'standalone',
    outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
    transpilePackages: [
        '@getcart/storefront-core',
        '@getcart/storefront-design',
        '@getcart/storefront-brands',
    ],
    poweredByHeader: false,
    async headers() {
        return [
            {
                source: '/:path*',
                headers: [
                    { key: 'X-Content-Type-Options', value: 'nosniff' },
                    { key: 'X-Frame-Options', value: 'DENY' },
                    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                ],
            },
            // Pages that show a shopper's cart or Order are never stored by a shared cache.
            { source: '/cart', headers: noStore },
            { source: '/checkout/:path*', headers: noStore },
            { source: '/checkout', headers: noStore },
            { source: '/order/:path*', headers: noStore },
        ];
    },
};

export default config;
