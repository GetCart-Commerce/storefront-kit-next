import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const designBoundary = {
    patterns: [
        {
            regex: '^@getcart/storefront-core/(?!next/actions$).+',
            message:
                'A design uses only "@getcart/storefront-core" and "@getcart/storefront-core/next/actions": it receives data as Slot props and posts forms to the core\'s server actions. Ask for a new export instead of reaching into the core.',
        },
        {
            group: ['next/headers', 'server-only', 'graphql', 'gql.tada'],
            message: 'A design never reads cookies or talks to the Shop API.',
        },
    ],
};

export default tseslint.config(
    {
        ignores: [
            '**/node_modules/**',
            '**/.next/**',
            '**/next-env.d.ts',
            '**/graphql-env.d.ts',
            '**/playwright-report/**',
            '**/test-results/**',
        ],
    },
    js.configs.recommended,
    ...tseslint.configs.strict,
    {
        rules: {
            '@typescript-eslint/no-non-null-assertion': 'off',
            '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
        },
    },
    {
        files: ['packages/design/**', 'brands/**'],
        rules: { 'no-restricted-imports': ['error', designBoundary] },
    },
    {
        files: ['packages/core/src/**'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            group: [
                                '@getcart/storefront-design',
                                '@getcart/storefront-design/*',
                                '@getcart/storefront-brands',
                                '@getcart/storefront-testing',
                            ],
                            message:
                                'The Storefront core is design-free and imports no Brand or CMS adapter.',
                        },
                    ],
                },
            ],
        },
    },
    {
        files: ['scripts/**'],
        languageOptions: { globals: { process: 'readonly', console: 'readonly' } },
    },
);
