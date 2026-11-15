'use server';

import { redirect } from 'next/navigation';

import type { NoticeCode } from '../checkout/notices';
import { routes } from '../routes';
import * as checkout from '../server/checkout';
import type { ActionResult } from '../server/context';
import { getContext } from './runtime';

/**
 * Server actions for the storefront's forms. Any design, default or Brand, posts its forms here
 * and gets the whole integration: validation, the Shop API call, cookie handling and the next
 * page. Each action ends in a redirect, so forms work without client JavaScript.
 *
 * Form values are untrusted. Amounts in a form are comparison values only: the server computes
 * every charge.
 */

function text(form: FormData, name: string, max = 200): string {
    const value = form.get(name);
    return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function integer(form: FormData, name: string): number | undefined {
    const value = text(form, name, 20);
    if (!/^\d{1,15}$/.test(value)) return undefined;
    return Number(value);
}

function withNotice(path: string, notice: NoticeCode | undefined): string {
    return notice ? `${path}?notice=${notice}` : path;
}

function finish(result: ActionResult, onSuccess: string, onFailure: string): never {
    redirect(result.ok ? onSuccess : withNotice(onFailure, result.notice));
}

// ── Cart ─────────────────────────────────────────────────────────────────────

export async function addToCartAction(form: FormData): Promise<void> {
    const variantId = text(form, 'variantId', 64);
    const quantity = integer(form, 'quantity') ?? 1;
    const returnTo = routes.product(text(form, 'productSlug', 200));
    if (!variantId || quantity < 1 || quantity > 99) redirect(withNotice(returnTo, 'INVALID_FORM'));
    const result = await checkout.addToCart(await getContext(), { variantId, quantity });
    finish(result, routes.cart, returnTo);
}

export async function updateCartLineAction(form: FormData): Promise<void> {
    const lineId = text(form, 'lineId', 64);
    const quantity = text(form, 'intent', 20) === 'remove' ? 0 : integer(form, 'quantity');
    if (!lineId || quantity === undefined || quantity > 99) redirect(withNotice(routes.cart, 'INVALID_FORM'));
    const result = await checkout.updateCartLine(await getContext(), { lineId, quantity });
    finish(result, routes.cart, routes.cart);
}

// ── Checkout ─────────────────────────────────────────────────────────────────

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Indonesian numbers: +62 or 0, then 8 to 13 digits. */
const PHONE = /^(?:\+62|62|0)\d{8,13}$/;

export async function setContactAction(form: FormData): Promise<void> {
    const input = {
        firstName: text(form, 'firstName', 80),
        lastName: text(form, 'lastName', 80),
        emailAddress: text(form, 'emailAddress', 160).toLowerCase(),
        phoneNumber: text(form, 'phoneNumber', 20).replace(/[\s-]/g, ''),
    };
    const editPath = `${routes.checkout}?edit=contact`;
    if (
        !input.firstName ||
        !input.lastName ||
        !EMAIL.test(input.emailAddress) ||
        !PHONE.test(input.phoneNumber)
    ) {
        redirect(`${editPath}&notice=INVALID_FORM`);
    }
    const result = await checkout.setContact(await getContext(), input);
    if (!result.ok) {
        redirect(`${editPath}&notice=${result.notice}`);
    }
    finish(result, routes.checkout, routes.checkout);
}

export async function setDeliveryAction(form: FormData): Promise<void> {
    const input = {
        areaId: text(form, 'areaId', 120),
        areaTerm: text(form, 'areaTerm', 80),
        streetLine1: text(form, 'streetLine1', 200),
        streetLine2: text(form, 'streetLine2', 200),
    };
    const back = `${routes.checkout}?edit=delivery&area=${encodeURIComponent(input.areaTerm)}`;
    if (!input.areaId || !input.areaTerm || input.streetLine1.length < 5)
        redirect(`${back}&notice=INVALID_FORM`);
    const result = await checkout.setDelivery(await getContext(), input);
    if (!result.ok) {
        redirect(`${back}&notice=${result.notice}`);
    }
    finish(result, routes.checkout, routes.checkout);
}

export async function refreshRatesAction(): Promise<void> {
    const result = await checkout.refreshRates(await getContext());
    finish(result, routes.checkout, routes.checkout);
}

export async function selectCourierServiceAction(form: FormData): Promise<void> {
    const shippingMethodId = text(form, 'shippingMethodId', 64);
    if (!shippingMethodId) redirect(withNotice(routes.checkout, 'INVALID_FORM'));
    const result = await checkout.selectCourierService(await getContext(), { shippingMethodId });
    finish(result, routes.checkout, routes.checkout);
}

export async function continueToPaymentAction(): Promise<void> {
    const result = await checkout.continueToPayment(await getContext());
    finish(result, routes.checkout, routes.checkout);
}

export async function returnToCartAction(): Promise<void> {
    const result = await checkout.returnToCart(await getContext());
    finish(result, routes.checkout, routes.checkout);
}

/**
 * Confirms the total the shopper saw and starts the hosted payment. `confirmedTotal` and
 * `confirmedQuoteId` are the values rendered on the confirmation page; the server compares them
 * with the Order and refuses a stale confirmation. They are never the charge.
 */
export async function startPaymentAction(form: FormData): Promise<void> {
    const paymentMethodCode = text(form, 'paymentMethodCode', 120);
    const confirmedTotal = integer(form, 'confirmedTotal');
    const confirmedQuoteId = text(form, 'confirmedQuoteId', 200);
    if (!paymentMethodCode || confirmedTotal === undefined || !confirmedQuoteId) {
        redirect(withNotice(routes.checkout, 'INVALID_FORM'));
    }
    const outcome = await checkout.startPayment(await getContext(), {
        paymentMethodCode,
        confirmedTotal,
        confirmedQuoteId,
    });
    switch (outcome.kind) {
        case 'provider':
            redirect(outcome.url);
        // eslint-disable-next-line no-fallthrough -- redirect() never returns
        case 'order':
            redirect(withNotice(routes.order(outcome.orderCode), outcome.notice));
        // eslint-disable-next-line no-fallthrough -- redirect() never returns
        case 'checkout':
            redirect(withNotice(routes.checkout, outcome.notice));
    }
}

/** Starts a fresh cart session after a payment that ended without success. */
export async function startNewCartAction(): Promise<void> {
    checkout.startNewCart(await getContext());
    redirect(routes.products);
}
