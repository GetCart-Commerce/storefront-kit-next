import { defineBrand } from '@getcart/storefront-core';

import site from './content/site.json';

/**
 * Example Starter Brand: theme tokens, a name and local site content. Nothing else. It runs the
 * Default design and the full checkout unchanged.
 */
export default defineBrand({
    id: 'atelier',
    name: 'Atelier Senja',
    tier: 'starter',
    locale: 'id',
    logo: undefined,
    theme: {
        colors: {
            background: '#fbf7f2',
            foreground: '#2b2118',
            muted: '#7a6a5c',
            border: '#e4d9cc',
            brand: '#b4532a',
            brandForeground: '#ffffff',
        },
        radius: '0.75rem',
        fontSans: 'ui-sans-serif, system-ui, sans-serif',
        fontDisplay: 'ui-serif, Georgia, serif',
    },
    content: { site },
});
