import { defineBrand } from '@getcart/storefront-core';

import home from './content/pages/home.json';
import story from './content/pages/story.json';
import site from './content/site.json';
import { KanvasProductPage } from './design/ProductPage';

/**
 * Example Enterprise Brand: its own tokens, pages composed from Sections, and a Brand design
 * that replaces the product page. Cart, checkout and confirmation are the shared ones.
 */
export default defineBrand({
    id: 'kanvas',
    name: 'Kanvas Studio',
    tier: 'enterprise',
    locale: 'en',
    logo: undefined,
    theme: {
        colors: {
            background: '#ffffff',
            foreground: '#0b0b0b',
            muted: '#5f5f5f',
            border: '#d9d9d9',
            brand: '#1f3fd1',
            brandForeground: '#ffffff',
        },
        radius: '0px',
        fontSans: 'ui-sans-serif, system-ui, sans-serif',
        fontDisplay: 'ui-sans-serif, system-ui, sans-serif',
    },
    content: { site, pages: [home, story] },
    slots: { ProductPage: KanvasProductPage },
});
