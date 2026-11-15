/**
 * The storefront's URLs. Routes belong to the shared layer: a Brand design replaces what a page
 * looks like, never where it lives, so every Brand keeps the same checkout and return URLs.
 */
export const routes = {
    home: '/',
    products: '/products',
    product: (slug: string) => `/products/${encodeURIComponent(slug)}`,
    cart: '/cart',
    checkout: '/checkout',
    /** The hosted-payment return URL. Navigation only: it never changes payment state. */
    checkoutReturn: '/checkout/return',
    /** Also the cookie path of guest Order-access grants. */
    orderBase: '/order',
    order: (code: string) => `/order/${encodeURIComponent(code)}`,
    page: (slug: string) => `/pages/${encodeURIComponent(slug)}`,
} as const;
