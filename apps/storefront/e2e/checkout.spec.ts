import { expect, test, type Page } from '@playwright/test';

/**
 * The same checkout runs for every Brand on the same build. Only the product page differs: the
 * Starter Brand shows the Default design, the Enterprise Brand its own component.
 */

interface BrandMeta {
    brandId: 'atelier' | 'kanvas';
    fakeApi: string;
    channelToken: string;
}

const meta = () => test.info().project.metadata as BrandMeta;

test.beforeEach(async ({ request }) => {
    await request.post(`${meta().fakeApi}/__reset`);
});

async function addShirtToCart(page: Page) {
    await page.goto('/products');
    await page.getByTestId('product-card').filter({ hasText: 'Linen Shirt' }).click();
    await expect(page.getByTestId('product-name')).toHaveText('Linen Shirt');
    if (meta().brandId === 'kanvas') {
        // The Brand design fills the ProductPage Slot.
        await expect(page.getByTestId('kanvas-product-page')).toBeVisible();
        await page.getByTestId('add-LS-S').click();
    } else {
        await expect(page.getByTestId('kanvas-product-page')).toHaveCount(0);
        await page.getByTestId('variant-LS-S').check();
        await page.getByTestId('add-to-cart').click();
    }
    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.getByTestId('cart-quantity')).toHaveText('1');
}

async function reachRates(page: Page) {
    await addShirtToCart(page);
    await page.getByTestId('go-to-checkout').click();

    await expect(page.getByTestId('checkout-step-contact')).toBeVisible();
    await page.locator('[name=firstName]').fill('Sari');
    await page.locator('[name=lastName]').fill('Wijaya');
    await page.locator('[name=emailAddress]').fill('sari@example.test');
    await page.locator('[name=phoneNumber]').fill('081234567890');
    await page.getByTestId('contact-submit').click();

    await expect(page.getByTestId('checkout-step-delivery')).toBeVisible();
    await page.locator('[name=area]').fill('Bandung');
    await page.getByTestId('area-search').click();
    await expect(page.getByTestId('area-option')).toHaveCount(1);
    await page.locator('[name=streetLine1]').fill('Jl. Dago No. 10');
    await page.getByTestId('delivery-submit').click();

    await expect(page.getByTestId('checkout-step-rates')).toBeVisible();
}

async function reachPayment(page: Page) {
    await reachRates(page);
    await expect(page.getByTestId('summary-shipping')).not.toContainText('Rp');
    await page.getByTestId('select-service-JNE REG').click();
    await expect(page.getByTestId('service-selected')).toBeVisible();
    await expect(page.getByTestId('summary-shipping')).toHaveText(/Rp18[.,]000/);
    await page.getByTestId('continue-to-payment').click();
    await expect(page.getByTestId('checkout-step-payment')).toBeVisible();
    await expect(page.getByTestId('final-total')).toHaveText(/Rp268[.,]000/);
}

test('product list → product → cart → address → rates → pay → return → protected confirmation', async ({
    page,
    context,
}) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-brand', meta().brandId);

    await reachPayment(page);
    await expect(page.getByTestId('sandbox-note')).toBeVisible();
    await page.getByTestId('pay').click();

    // The Provider's hosted page (the fake stands in for Midtrans).
    await expect(page).toHaveURL(/\/pay\//);
    await expect(page.getByTestId('hosted-amount')).toHaveText('IDR 268000');
    await page.getByTestId('hosted-paid').click();

    // The return URL carries Provider query values; the storefront redirects without reading them.
    await expect(page).toHaveURL(/\/order\/[A-Z0-9]+$/);
    await expect(page.getByTestId('payment-status')).toHaveAttribute('data-payment-status', 'paid');
    await expect(page.getByTestId('summary-total')).toHaveText(/Rp268[.,]000/);
    await expect(page.getByTestId('payment-polling')).toHaveCount(0);

    // Secrets are HttpOnly cookies; nothing is in web storage or in the page.
    const cookies = await context.cookies();
    const secret = cookies.filter(
        cookie => cookie.name === 'gc_session' || cookie.name.startsWith('gc_order_'),
    );
    expect(secret).toHaveLength(2);
    for (const cookie of secret) {
        expect(cookie.httpOnly).toBe(true);
        expect(cookie.sameSite).toBe('Lax');
    }
    expect(cookies.find(cookie => cookie.name.startsWith('gc_order_'))?.path).toBe('/order');
    expect(await page.evaluate(() => window.localStorage.length + window.sessionStorage.length)).toBe(0);
    const html = await page.content();
    for (const cookie of secret) expect(html).not.toContain(cookie.value);

    // The confirmation is never stored by a shared cache.
    const response = await page.reload();
    expect(response?.headers()['cache-control']).toContain('no-store');

    // The paid Order is no longer the cart.
    await page.goto('/checkout');
    await expect(page.getByTestId('checkout-empty')).toBeVisible();
});

test('an Order code alone shows nothing, and a forged return cannot mark anything paid', async ({
    page,
    browser,
}) => {
    await reachPayment(page);
    await page.getByTestId('pay').click();
    await expect(page).toHaveURL(/\/pay\//);

    // The shopper comes back without paying, with a forged "success" query string.
    await page.goto('/checkout/return?order_id=x&status_code=200&transaction_status=settlement');
    await expect(page).toHaveURL(/\/order\/[A-Z0-9]+$/);
    await expect(page.getByTestId('payment-status')).toHaveAttribute('data-payment-status', 'pending');
    await expect(page.getByTestId('payment-polling')).toBeVisible();
    await expect(page.getByTestId('continue-payment')).toBeVisible();

    // The checkout page will not offer to pay again while an attempt exists.
    const orderUrl = page.url();
    await page.goto('/checkout');
    await expect(page).toHaveURL(orderUrl);

    // Another device with the Order URL but no grant sees "not found".
    const stranger = await browser.newContext();
    const other = await stranger.newPage();
    await other.goto(orderUrl);
    await expect(other.getByTestId('order-not-found')).toBeVisible();
    await stranger.close();

    // Once the server verifies the payment, the open page updates by polling alone.
    await page.goto(orderUrl);
    await page.getByTestId('continue-payment').click();
    await page.getByTestId('hosted-failed').click();
    await expect(page.getByTestId('payment-status')).toHaveAttribute('data-payment-status', 'failed');
    await expect(page.getByTestId('start-new-cart')).toBeVisible();
});

test('a changed total asks the shopper to confirm again before paying', async ({ page, request }) => {
    await reachPayment(page);
    await request.post(`${meta().fakeApi}/__scenario`, { data: { payment: 'reconfirm-once' } });
    await page.getByTestId('pay').click();

    await expect(page.getByTestId('notice')).toHaveAttribute('data-notice', 'RECONFIRMATION_REQUIRED');
    await expect(page.getByTestId('final-total')).toHaveText(/Rp270[.,]000/);
    await page.getByTestId('pay').click();
    await expect(page.getByTestId('hosted-amount')).toHaveText('IDR 270000');
});

for (const status of ['no-coverage', 'unavailable', 'expired'] as const) {
    test(`shipping quote state ${status} has its own message and no payable rate`, async ({
        page,
        request,
    }) => {
        await request.post(`${meta().fakeApi}/__scenario`, { data: { quote: status } });
        await reachRates(page);
        await expect(page.getByTestId('quote-state')).toHaveAttribute('data-quote-status', status);
        await expect(page.getByTestId('continue-to-payment')).toHaveCount(0);
        await expect(page.getByTestId('summary-shipping')).not.toContainText('Rp');

        if (status !== 'no-coverage') {
            await request.post(`${meta().fakeApi}/__scenario`, { data: { quote: 'available' } });
            await page.getByTestId('refresh-rates').click();
            await expect(page.getByTestId('courier-services')).toBeVisible();
        }
    });
}

test('runs with no CMS: content is local and the CMS routes do not exist', async ({ page, request }) => {
    const health = await (await request.get('/api/health')).json();
    expect(health).toMatchObject({ status: 'ok', brand: meta().brandId, contentSource: 'local', cms: false });
    expect((await request.get('/api/preview')).status()).toBe(404);
    expect((await request.post('/api/revalidate')).status()).toBe(404);

    await page.goto('/');
    if (meta().brandId === 'kanvas') {
        // Pro and Enterprise page composition works from local content.
        await expect(page.getByTestId('section-hero')).toContainText('Made in small runs');
        await expect(page.getByTestId('section-product-grid')).toBeVisible();
        expect((await request.get('/pages/story')).status()).toBe(200);
    } else {
        await expect(page.getByTestId('section-hero')).toHaveCount(0);
        await expect(page.getByTestId('product-card')).toHaveCount(2);
        expect((await request.get('/pages/story')).status()).toBe(404);
    }
});

test("every Shop API call carried this deployment's Channel token", async ({ page, request }) => {
    await reachRates(page);
    const requests = (await (await request.get(`${meta().fakeApi}/__requests`)).json()) as Array<{
        method: string;
        channelToken: string | null;
    }>;
    expect(requests.length).toBeGreaterThan(5);
    expect(requests.every(entry => entry.method === 'POST')).toBe(true);
    expect(new Set(requests.map(entry => entry.channelToken))).toEqual(new Set([meta().channelToken]));
});

test('a product Vendure does not offer is not found', async ({ request }) => {
    expect((await request.get('/products/discontinued')).status()).toBe(404);
});
