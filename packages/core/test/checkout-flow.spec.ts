import { beforeEach, describe, expect, it } from 'vitest';

import { resolveContentSource } from '../src';
import {
    addToCart,
    continueToPayment,
    getCheckout,
    getOrderConfirmation,
    getPendingCheckout,
    getProduct,
    getReturnOrderCode,
    listProducts,
    refreshRates,
    returnToCart,
    selectCourierService,
    setContact,
    setDelivery,
    startNewCart,
    startPayment,
    updateCartLine,
} from '../src/server';
import type { CheckoutView } from '../src';
import { CHANNEL_TOKEN, createBrowser, createFake, type TestBrowser } from './helpers';

const contact = {
    firstName: 'Sari',
    lastName: 'Wijaya',
    emailAddress: 'sari@example.test',
    phoneNumber: '081234567890',
};
const delivery = {
    areaId: 'area-bandung-coblong',
    areaTerm: 'Bandung',
    streetLine1: 'Jl. Dago No. 10',
    streetLine2: '',
};

let fake = createFake();
let browser: TestBrowser;

beforeEach(() => {
    fake = createFake();
    browser = createBrowser(fake);
});

function expectStep<Step extends CheckoutView['step']>(view: CheckoutView, step: Step) {
    expect(view.step).toBe(step);
    return view as Extract<CheckoutView, { step: Step }>;
}

async function reachRates(target = browser) {
    expect(await addToCart(target.context, { variantId: '11', quantity: 1 })).toEqual({ ok: true });
    expect(await setContact(target.context, contact)).toEqual({ ok: true });
    expect(await setDelivery(target.context, delivery)).toEqual({ ok: true });
    return expectStep(await getCheckout(target.context), 'rates');
}

async function reachPayment(target = browser) {
    const rates = await reachRates(target);
    if (rates.quote.status !== 'available') throw new Error('expected an available quote');
    const service = rates.quote.services.find(option => option.name === 'JNE REG')!;
    expect(await selectCourierService(target.context, { shippingMethodId: service.id })).toEqual({
        ok: true,
    });
    expect(await continueToPayment(target.context)).toEqual({ ok: true });
    return expectStep(await getCheckout(target.context), 'payment');
}

async function pay(target = browser) {
    const payment = await reachPayment(target);
    const option = payment.paymentOptions[0]!;
    const outcome = await startPayment(target.context, {
        paymentMethodCode: option.code,
        confirmedTotal: payment.order.total,
        confirmedQuoteId: payment.quoteId!,
    });
    return { payment, outcome };
}

describe('checkout with no CMS configured', () => {
    it('completes product list → product → cart → address → rates → payment → confirmation', async () => {
        // A Brand without a CMS is complete: content resolves from local files alone.
        const content = resolveContentSource({
            env: { cms: undefined },
            tier: 'starter',
            local: { site: { seo: { defaultTitle: 'Test Brand' } } },
        });
        expect(content.kind).toBe('local');
        expect(content.capabilities).toEqual({ preview: false, publishNotifications: false });

        const products = await listProducts(browser.context);
        expect(products.map(product => product.slug)).toEqual(['linen-shirt', 'batik-scarf']);
        expect(products[0]).toMatchObject({ priceFrom: 25000000, priceTo: 27500000, currencyCode: 'IDR' });

        const product = await getProduct(browser.context, 'linen-shirt');
        expect(product?.variants.map(variant => variant.purchasable)).toEqual([true, true, false]);

        expect(expectStep(await getCheckout(browser.context), 'empty')).toEqual({ step: 'empty' });
        await addToCart(browser.context, { variantId: '11', quantity: 1 });
        expectStep(await getCheckout(browser.context), 'contact');

        await setContact(browser.context, contact);
        const search = expectStep(await getCheckout(browser.context, { areaTerm: 'Bandung' }), 'delivery');
        expect(search.areas.map(area => area.postalCode)).toEqual(['40115']);

        await setDelivery(browser.context, delivery);
        const rates = expectStep(await getCheckout(browser.context), 'rates');
        expect(rates.order.totalFinal).toBe(false);
        expect(rates.order.address).toMatchObject({ city: 'Bandung', postalCode: '40115' });
        if (rates.quote.status !== 'available') throw new Error('expected an available quote');
        expect(rates.quote.services).toEqual([
            { id: '101', name: 'JNE REG', duration: '2 - 3 days', priceWithTax: 1800000 },
            { id: '102', name: 'SiCepat REG', duration: '1 - 2 days', priceWithTax: 1500000 },
        ]);

        await selectCourierService(browser.context, { shippingMethodId: '101' });
        await continueToPayment(browser.context);
        const payment = expectStep(await getCheckout(browser.context), 'payment');
        // Displayed exactly as returned: Rp250,000 + Rp18,000, final in ArrangingPayment.
        expect(payment.order).toMatchObject({
            total: 26800000,
            shipping: 1800000,
            totalFinal: true,
            courierServiceName: 'JNE REG',
        });
        expect(payment.paymentOptions).toEqual([
            {
                code: 'gc-payment-fake',
                name: 'Online payment',
                kind: 'hosted',
                providerName: 'Midtrans',
                environment: 'test',
            },
        ]);

        const outcome = await startPayment(browser.context, {
            paymentMethodCode: payment.paymentOptions[0]!.code,
            confirmedTotal: payment.order.total,
            confirmedQuoteId: payment.quoteId!,
        });
        expect(outcome.kind).toBe('provider');

        // Back from the hosted page before anything is verified: pending, and polling.
        const code = getReturnOrderCode(browser.context)!;
        expect(code).toBe(payment.order.code);
        const pending = await getOrderConfirmation(browser.context, code);
        expect(pending?.payment).toMatchObject({ status: 'pending', poll: true, ended: false });
        expect(pending?.payment.continuationUrl).toContain('/pay/');

        // The worker verifies the payment. The browser did nothing to make this true.
        fake.resolveAttempt(fake.orders()[0]!.attempt!.reference, 'paid');
        const paid = await getOrderConfirmation(browser.context, code);
        expect(paid?.payment).toMatchObject({
            status: 'paid',
            poll: false,
            continuationUrl: undefined,
            amount: 26800000,
        });
        expect(paid?.order).toMatchObject({
            state: 'PaymentSettled',
            total: 26800000,
            courierServiceName: 'JNE REG',
        });
        expect(paid?.order.surcharges).toEqual([{ description: 'Payable rounding', amount: 0 }]);

        // The paid Order is no longer the active cart.
        expectStep(await getCheckout(browser.context), 'empty');
    });

    it('sends the Channel token on every call and only ever POSTs', async () => {
        await pay();
        const requests = fake.requests();
        expect(requests.length).toBeGreaterThan(10);
        expect(requests.every(request => request.channelToken === CHANNEL_TOKEN)).toBe(true);
        expect(requests.every(request => request.method === 'POST')).toBe(true);
        expect(requests.every(request => !request.path.includes('?'))).toBe(true);
    });

    it('refuses a Channel token the deployment was not configured with', async () => {
        const stranger = createBrowser(fake, 'another-brand-token');
        await expect(listProducts(stranger.context)).rejects.toThrow('No valid channel');
    });
});

describe('secrets stay on the server', () => {
    it('keeps the session and the grant in HttpOnly, Secure, SameSite cookies', async () => {
        await pay();
        const cookies = [...browser.jar.entries()];
        expect(cookies.map(([name]) => name.replace(/_[0-9a-f]{24}$/, '_<hash>')).sort()).toEqual([
            'gc_checkout',
            'gc_order_<hash>',
            'gc_session',
        ]);
        for (const [, cookie] of cookies) {
            expect(cookie.options).toMatchObject({ httpOnly: true, secure: true, sameSite: 'lax' });
        }
        const grant = cookies.find(([name]) => name.startsWith('gc_order_'))!;
        // Scoped to the confirmation path, and named without the Order code.
        expect(grant[1].options.path).toBe('/order');
        expect(grant[0]).not.toContain(fake.orders()[0]!.code);
    });

    it('returns no secret in any view', async () => {
        const { payment } = await pay();
        const grant = [...browser.jar.entries()].find(([name]) => name.startsWith('gc_order_'))![1].value;
        const session = browser.jar.get('gc_session')!.value;
        const confirmation = await getOrderConfirmation(browser.context, payment.order.code);
        const serialized = JSON.stringify([payment, confirmation, await getCheckout(browser.context)]);
        expect(serialized).not.toContain(grant);
        expect(serialized).not.toContain(session);
    });

    it('shows nothing for an Order code alone', async () => {
        const { payment } = await pay();
        const otherDevice = createBrowser(fake);
        expect(await getOrderConfirmation(otherDevice.context, payment.order.code)).toBeUndefined();
        expect(await getOrderConfirmation(browser.context, 'UNKNOWN')).toBeUndefined();
        expect(await getOrderConfirmation(browser.context, '../etc')).toBeUndefined();
    });
});

describe('idempotent payment start', () => {
    it('reuses one key for a repeated confirmation and reaches the same attempt', async () => {
        const { payment, outcome } = await pay();
        const firstKey = getPendingCheckout(browser.context.cookieContext)!.idempotencyKey;
        expect(firstKey).toMatch(/^[A-Za-z0-9_-]{16,128}$/);

        // A double click or a retry after a timeout. The cookie still marks the attempt started,
        // so the checkout page sends the shopper to the Order instead of offering to pay again.
        expectStep(await getCheckout(browser.context), 'in-progress');
        const again = await startPayment(browser.context, {
            paymentMethodCode: payment.paymentOptions[0]!.code,
            confirmedTotal: payment.order.total,
            confirmedQuoteId: payment.quoteId!,
        });
        expect(again).toEqual(outcome);
        expect(getPendingCheckout(browser.context.cookieContext)!.idempotencyKey).toBe(firstKey);
        expect(fake.orders().filter(order => order.attempt).length).toBe(1);
    });

    it('asks for reconfirmation with the new total, then uses a new key', async () => {
        const payment = await reachPayment();
        fake.setScenario({ payment: 'reconfirm-once' });
        const input = {
            paymentMethodCode: payment.paymentOptions[0]!.code,
            confirmedTotal: payment.order.total,
            confirmedQuoteId: payment.quoteId!,
        };

        expect(await startPayment(browser.context, input)).toEqual({
            kind: 'checkout',
            notice: 'RECONFIRMATION_REQUIRED',
        });
        expect(getPendingCheckout(browser.context.cookieContext)).toBeUndefined();
        expect(fake.orders()[0]!.attempt).toBeNull();

        // The shopper sees the corrected total and quote, and confirms those.
        const corrected = expectStep(await getCheckout(browser.context), 'payment');
        expect(corrected.order.total).toBe(27000000);
        expect(corrected.quoteId).not.toBe(payment.quoteId);

        // Confirming the stale values again is refused as well: the browser cannot push a total through.
        expect(await startPayment(browser.context, input)).toEqual({
            kind: 'checkout',
            notice: 'RECONFIRMATION_REQUIRED',
        });

        const outcome = await startPayment(browser.context, {
            ...input,
            confirmedTotal: corrected.order.total,
            confirmedQuoteId: corrected.quoteId!,
        });
        expect(outcome.kind).toBe('provider');
        expect(fake.orders()[0]!.attempt!.amount).toBe(27000000);
    });

    it('keeps the key when shipping is briefly unavailable, so the retry is the same request', async () => {
        const payment = await reachPayment();
        fake.setScenario({ payment: 'shipping-unavailable-once' });
        const input = {
            paymentMethodCode: payment.paymentOptions[0]!.code,
            confirmedTotal: payment.order.total,
            confirmedQuoteId: payment.quoteId!,
        };

        expect(await startPayment(browser.context, input)).toEqual({
            kind: 'checkout',
            notice: 'SHIPPING_UNAVAILABLE',
        });
        const key = getPendingCheckout(browser.context.cookieContext)!.idempotencyKey;
        expect((await startPayment(browser.context, input)).kind).toBe('provider');
        expect(fake.orders()[0]!.attempt!.idempotencyKey).toBe(key);
    });

    it('does not start payment for an Order that is not arranging payment', async () => {
        await reachRates();
        expect(
            await startPayment(browser.context, {
                paymentMethodCode: 'gc-payment-fake',
                confirmedTotal: 1,
                confirmedQuoteId: 'x',
            }),
        ).toEqual({
            kind: 'checkout',
            notice: 'ORDER_NOT_READY',
        });
        expect(browser.jar.has('gc_checkout')).toBe(false);
    });
});

describe('typed payment results', () => {
    it('shows an uncertain attempt as uncertain and keeps polling, with no link to pay again', async () => {
        fake.setScenario({ payment: 'uncertain' });
        const { payment, outcome } = await pay();
        expect(outcome).toEqual({ kind: 'order', orderCode: payment.order.code });
        const confirmation = await getOrderConfirmation(browser.context, payment.order.code);
        expect(confirmation?.payment).toMatchObject({
            status: 'uncertain',
            poll: true,
            ended: false,
            continuationUrl: undefined,
        });
    });

    it.each(['failed', 'expired', 'cancelled'] as const)(
        'shows a %s attempt as ended, never as paid',
        async status => {
            const { payment } = await pay();
            fake.resolveAttempt(fake.orders()[0]!.attempt!.reference, status);
            const confirmation = await getOrderConfirmation(browser.context, payment.order.code);
            expect(confirmation?.payment).toMatchObject({
                status,
                poll: false,
                ended: true,
                continuationUrl: undefined,
            });
            expect(confirmation?.order.state).toBe('ArrangingPayment');
        },
    );

    it('lets the shopper start a new cart after an ended attempt without losing the old Order', async () => {
        const { payment } = await pay();
        fake.resolveAttempt(fake.orders()[0]!.attempt!.reference, 'failed');
        startNewCart(browser.context);
        expectStep(await getCheckout(browser.context), 'empty');
        await addToCart(browser.context, { variantId: '21', quantity: 1 });
        const fresh = expectStep(await getCheckout(browser.context), 'contact');
        expect(fresh.order.code).not.toBe(payment.order.code);
        // The grant cookie is untouched, so the earlier Order is still readable.
        expect((await getOrderConfirmation(browser.context, payment.order.code))?.payment.status).toBe(
            'failed',
        );
    });

    it('refuses cart and address changes while a payment is unresolved', async () => {
        await pay();
        expect(await returnToCart(browser.context)).toEqual({ ok: false, notice: 'TRANSITION_REFUSED' });
        expect(await addToCart(browser.context, { variantId: '21', quantity: 1 })).toEqual({
            ok: false,
            notice: 'ORDER_CHANGE_REFUSED',
        });
        expect(await setContact(browser.context, contact)).toEqual({
            ok: false,
            notice: 'ORDER_CHANGE_REFUSED',
        });
    });
});

describe('typed shipping quote states', () => {
    it('shows not-ready until rates are requested for the bound destination', async () => {
        await addToCart(browser.context, { variantId: '11', quantity: 1 });
        await setContact(browser.context, contact);
        await setDelivery(browser.context, delivery);
        // Changing the cart invalidates the quote and the selection.
        await addToCart(browser.context, { variantId: '21', quantity: 1 });
        const rates = expectStep(await getCheckout(browser.context), 'rates');
        expect(rates.quote.status).toBe('not-ready');
        expect(await continueToPayment(browser.context)).toEqual({ ok: false, notice: 'TRANSITION_REFUSED' });
    });

    it.each(['no-coverage', 'expired', 'unavailable'] as const)(
        'shows %s as its own state with no payable rate',
        async status => {
            fake.setScenario({ quote: status });
            const rates = await reachRates();
            expect(rates.quote.status).toBe(status);
            expect(rates.order.shipping).toBe(0);
            expect(rates.order.courierServiceName).toBeUndefined();
            // Never a free rate: the Order cannot move on to payment.
            expect(await selectCourierService(browser.context, { shippingMethodId: '101' })).toEqual({
                ok: false,
                notice: 'INELIGIBLE_SHIPPING_METHOD',
            });
            expect(await continueToPayment(browser.context)).toEqual({
                ok: false,
                notice: 'TRANSITION_REFUSED',
            });
        },
    );

    it('recovers when a refresh succeeds', async () => {
        fake.setScenario({ quote: 'unavailable' });
        const failed = await reachRates();
        expect(failed.quote).toMatchObject({ status: 'unavailable', retryable: true });
        fake.setScenario({ quote: 'available' });
        expect(await refreshRates(browser.context)).toEqual({ ok: true });
        expect(expectStep(await getCheckout(browser.context), 'rates').quote.status).toBe('available');
    });
});

describe('native error unions', () => {
    it('reports insufficient stock, an unknown variant and a mismatched area explicitly', async () => {
        expect(await addToCart(browser.context, { variantId: '21', quantity: 3 })).toEqual({
            ok: false,
            notice: 'INSUFFICIENT_STOCK',
        });
        expect(await addToCart(browser.context, { variantId: '13', quantity: 1 })).toEqual({
            ok: false,
            notice: 'INSUFFICIENT_STOCK',
        });
        expect(await addToCart(browser.context, { variantId: 'missing', quantity: 1 })).toEqual({
            ok: false,
            notice: 'VARIANT_UNAVAILABLE',
        });

        await addToCart(browser.context, { variantId: '21', quantity: 1 });
        await setContact(browser.context, contact);
        expect(await setDelivery(browser.context, { ...delivery, areaId: 'area-jakarta-kebayoran' })).toEqual(
            { ok: false, notice: 'DESTINATION_REJECTED' },
        );
    });

    it('removes a line when its quantity is set to zero', async () => {
        await addToCart(browser.context, { variantId: '11', quantity: 2 });
        const order = expectStep(await getCheckout(browser.context), 'contact').order;
        expect(order.lines[0]).toMatchObject({ quantity: 2, linePriceWithTax: 50000000 });
        expect(await updateCartLine(browser.context, { lineId: order.lines[0]!.id, quantity: 0 })).toEqual({
            ok: true,
        });
        expectStep(await getCheckout(browser.context), 'empty');
    });
});
