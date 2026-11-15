import { defineConfig } from '@playwright/test';

/**
 * End-to-end tests. One build of the storefront is started twice, once per example Brand, against
 * the fake Shop API. No CMS variable is set anywhere, so a CMS can never become a hidden
 * requirement. Run `pnpm build` first.
 */
const FAKE_PORT = 4210;
const BRANDS = [
    { id: 'atelier', port: 3210, channelToken: 'atelier-channel-token' },
    { id: 'kanvas', port: 3211, channelToken: 'kanvas-channel-token' },
] as const;

export default defineConfig({
    testDir: './e2e',
    fullyParallel: false,
    workers: 1,
    forbidOnly: Boolean(process.env.CI),
    retries: 0,
    reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
    use: { trace: 'retain-on-failure' },
    projects: BRANDS.map(brand => ({
        name: brand.id,
        use: { baseURL: `http://localhost:${brand.port}` },
        metadata: {
            brandId: brand.id,
            fakeApi: `http://localhost:${FAKE_PORT}`,
            channelToken: brand.channelToken,
        },
    })),
    webServer: [
        {
            command: 'pnpm --filter @getcart/storefront-testing fake-api',
            url: `http://localhost:${FAKE_PORT}/health`,
            reuseExistingServer: false,
            env: {
                FAKE_SHOP_API_PORT: String(FAKE_PORT),
                FAKE_CHANNELS: BRANDS.map(
                    brand => `${brand.channelToken}=http://localhost:${brand.port}/checkout/return`,
                ).join(','),
            },
        },
        ...BRANDS.map(brand => ({
            command: `pnpm exec next start --port ${brand.port}`,
            url: `http://localhost:${brand.port}/api/health`,
            reuseExistingServer: false,
            env: {
                BRAND_ID: brand.id,
                VENDURE_SHOP_API_URL: `http://localhost:${FAKE_PORT}/shop-api`,
                VENDURE_CHANNEL_TOKEN: brand.channelToken,
                SITE_URL: `http://localhost:${brand.port}`,
                // Deliberately no CMS_* variables.
                CMS_URL: '',
                CMS_API_KEY: '',
                CMS_PREVIEW_SECRET: '',
            },
        })),
    ],
});
