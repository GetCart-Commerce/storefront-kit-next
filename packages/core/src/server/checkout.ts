import { isIdempotencyKey, newIdempotencyKey } from '../checkout/idempotency';
import { noticeFromReason, type NoticeCode } from '../checkout/notices';
import { deriveCheckoutStep, normalizeQuoteStatus } from '../checkout/state';
import {
    activeOrderDocument,
    addItemDocument,
    adjustLineDocument,
    cartQuantityDocument,
    issueOrderAccessDocument,
    orderConfirmationDocument,
    paymentOptionsDocument,
    refreshRatesDocument,
    removeLineDocument,
    setCustomerDocument,
    setDestinationDocument,
    setShippingAddressDocument,
    setShippingMethodDocument,
    shippingAreasDocument,
    shippingOptionsDocument,
    startPaymentDocument,
    transitionOrderDocument,
} from '../shop/documents';
import type { CheckoutEditTarget, CheckoutView, OrderConfirmationView, OrderView, QuoteView } from '../types';
import {
    isSafeProviderUrl,
    noticeFromError,
    ok,
    refused,
    resultFromUnion,
    type ActionResult,
    type StorefrontContext,
} from './context';
import {
    clearPendingCheckout,
    clearSessionToken,
    getOrderAccessGrant,
    getPendingCheckout,
    getSessionToken,
    setOrderAccessGrant,
    setPendingCheckout,
} from './cookies';
import { mapArea, mapCourierService, mapOrder, mapPaymentOptions, mapPaymentStatus } from './mappers';

const personal = { session: true } as const;

// ── Cart ─────────────────────────────────────────────────────────────────────

/** The session's own active Order. A visitor without a session has none, so no call is made. */
export async function getActiveOrder(context: StorefrontContext): Promise<OrderView | undefined> {
    if (!getSessionToken(context.cookieContext)) return undefined;
    const data = await context.client.request(activeOrderDocument, {}, personal);
    return data.activeOrder ? mapOrder(data.activeOrder) : undefined;
}

export async function getCartQuantity(context: StorefrontContext): Promise<number> {
    if (!getSessionToken(context.cookieContext)) return 0;
    const data = await context.client.request(cartQuantityDocument, {}, personal);
    return data.activeOrder?.totalQuantity ?? 0;
}

export async function addToCart(
    context: StorefrontContext,
    input: { variantId: string; quantity: number },
): Promise<ActionResult> {
    try {
        const data = await context.client.request(addItemDocument, input, personal);
        return resultFromUnion(data.addItemToOrder);
    } catch (error) {
        return refused(noticeFromError(error, 'VARIANT_UNAVAILABLE'));
    }
}

export async function updateCartLine(
    context: StorefrontContext,
    input: { lineId: string; quantity: number },
): Promise<ActionResult> {
    try {
        if (input.quantity === 0) {
            const data = await context.client.request(removeLineDocument, { lineId: input.lineId }, personal);
            return resultFromUnion(data.removeOrderLine);
        }
        const data = await context.client.request(adjustLineDocument, input, personal);
        return resultFromUnion(data.adjustOrderLine);
    } catch (error) {
        return refused(noticeFromError(error));
    }
}

// ── Checkout view ────────────────────────────────────────────────────────────

const MIN_AREA_TERM = 3;

/**
 * The whole checkout as one typed view, derived from server state on every request. A design
 * renders the step it is given; it cannot be in a step the Order is not in.
 */
export async function getCheckout(
    context: StorefrontContext,
    input: { areaTerm?: string | undefined; edit?: CheckoutEditTarget | undefined } = {},
): Promise<CheckoutView> {
    const order = await getActiveOrder(context);
    const pending = getPendingCheckout(context.cookieContext);
    const paymentStarted = Boolean(order && pending?.started && pending.orderCode === order.code);
    const step = deriveCheckoutStep({ order, paymentStarted, edit: input.edit });

    if (!order || step === 'empty') return { step: 'empty' };
    if (step === 'in-progress') return { step: 'in-progress', orderCode: order.code };
    if (step === 'contact') return { step: 'contact', order };

    if (step === 'delivery') {
        const areaTerm = (input.areaTerm ?? '').trim().slice(0, 80);
        if (areaTerm.length < MIN_AREA_TERM) {
            return { step: 'delivery', order, areaTerm, areas: [], areaNotice: undefined };
        }
        const data = await context.client.request(shippingAreasDocument, { term: areaTerm }, personal);
        const result = data.checkoutShippingAreas;
        return {
            step: 'delivery',
            order,
            areaTerm,
            areas: result.success ? result.areas.map(mapArea) : [],
            areaNotice: result.success ? undefined : { message: result.message, retryable: result.retryable },
        };
    }

    if (step === 'rates') {
        const data = await context.client.request(shippingOptionsDocument, {}, personal);
        return { step: 'rates', order, quote: mapQuote(data, order) };
    }

    const data = await context.client.request(paymentOptionsDocument, {}, personal);
    return {
        step: 'payment',
        order,
        quoteId: data.checkoutShippingQuoteStatus.quoteId ?? undefined,
        paymentOptions: mapPaymentOptions(data.eligiblePaymentMethods),
    };
}

/** Each of the five quote states becomes its own view. None of them falls back to a free rate. */
function mapQuote(
    data: {
        checkoutShippingQuoteStatus: {
            status: string;
            quoteId: string | null;
            expiresAt: string | null;
            reason: string | null;
            message: string;
            retryable: boolean;
        };
        eligibleShippingMethods: Array<{ id: string; name: string; priceWithTax: number; metadata: unknown }>;
    },
    order: OrderView,
): QuoteView {
    const quote = data.checkoutShippingQuoteStatus;
    const status = normalizeQuoteStatus(quote.status);
    const unavailable: QuoteView = {
        status: 'unavailable',
        message: quote.message,
        reason: quote.reason ?? undefined,
        retryable: quote.retryable,
    };
    switch (status) {
        case 'not-ready':
            return { status, message: quote.message };
        case 'no-coverage':
            return { status, message: quote.message };
        case 'expired':
            return { status, message: quote.message };
        case 'unavailable':
            return unavailable;
        case 'available': {
            const services = data.eligibleShippingMethods.map(mapCourierService);
            // A current quote without an id or without any service cannot be confirmed or paid.
            if (!quote.quoteId) return unavailable;
            if (services.length === 0) return { status: 'no-coverage', message: quote.message };
            const selected = services.find(service => service.id === order.selectedShippingMethodId);
            return {
                status,
                quoteId: quote.quoteId,
                expiresAt: quote.expiresAt ?? undefined,
                services,
                selectedServiceId: selected?.id,
            };
        }
    }
}

// ── Checkout steps ───────────────────────────────────────────────────────────

export interface ContactInput {
    firstName: string;
    lastName: string;
    emailAddress: string;
    phoneNumber: string;
}

export async function setContact(context: StorefrontContext, input: ContactInput): Promise<ActionResult> {
    try {
        const data = await context.client.request(setCustomerDocument, { input }, personal);
        return resultFromUnion(data.setCustomerForOrder);
    } catch (error) {
        return refused(noticeFromError(error));
    }
}

export interface DeliveryInput {
    areaId: string;
    streetLine1: string;
    streetLine2: string;
}

/**
 * Saves the native shipping address from the chosen area, then binds the destination. The city,
 * province and postal code are taken from the area the Shop API returns for the shopper's search,
 * so the address and the area always agree; the server re-checks that agreement before binding.
 */
export async function setDelivery(
    context: StorefrontContext,
    input: DeliveryInput & { areaTerm: string },
): Promise<ActionResult> {
    try {
        const order = await getActiveOrder(context);
        if (!order?.contact) return refused('NO_ACTIVE_ORDER');

        const search = await context.client.request(
            shippingAreasDocument,
            { term: input.areaTerm },
            personal,
        );
        const area = search.checkoutShippingAreas.areas.find(candidate => candidate.id === input.areaId);
        if (!search.checkoutShippingAreas.success || !area) return refused('DESTINATION_REJECTED');

        const address = await context.client.request(
            setShippingAddressDocument,
            {
                input: {
                    fullName: `${order.contact.firstName} ${order.contact.lastName}`.trim(),
                    streetLine1: input.streetLine1,
                    streetLine2: input.streetLine2,
                    city: area.city,
                    province: area.province,
                    postalCode: area.postalCode,
                    countryCode: area.countryCode,
                    phoneNumber: order.contact.phoneNumber,
                },
            },
            personal,
        );
        const saved = resultFromUnion(address.setOrderShippingAddress);
        if (!saved.ok) return saved;

        const bound = await context.client.request(
            setDestinationDocument,
            { input: { areaId: area.id } },
            personal,
        );
        if (!bound.setCheckoutShippingDestination.success) {
            return refused(
                noticeFromReason(bound.setCheckoutShippingDestination.reason, 'DESTINATION_REJECTED'),
            );
        }
    } catch (error) {
        return refused(noticeFromError(error));
    }
    // A new destination needs new rates. The rates step shows whatever state this leaves.
    await refreshRates(context);
    return ok;
}

/** Explicitly obtains or reuses the quote for the current cart. The rates step shows the result. */
export async function refreshRates(context: StorefrontContext): Promise<ActionResult> {
    try {
        const data = await context.client.request(refreshRatesDocument, {}, personal);
        const reason = data.refreshCheckoutShippingRates.reason;
        if (reason === 'PAYMENT_IN_PROGRESS') return refused('PAYMENT_IN_PROGRESS');
        return ok;
    } catch (error) {
        return refused(noticeFromError(error));
    }
}

export async function selectCourierService(
    context: StorefrontContext,
    input: { shippingMethodId: string },
): Promise<ActionResult> {
    try {
        const data = await context.client.request(
            setShippingMethodDocument,
            { ids: [input.shippingMethodId] },
            personal,
        );
        return resultFromUnion(data.setOrderShippingMethod);
    } catch (error) {
        return refused(noticeFromError(error, 'INELIGIBLE_SHIPPING_METHOD'));
    }
}

/** Enters `ArrangingPayment`, where the server makes the payable final. */
export function continueToPayment(context: StorefrontContext): Promise<ActionResult> {
    return transition(context, 'ArrangingPayment');
}

/** Returns to `AddingItems` so the shopper can change the cart, address or Courier service. */
export function returnToCart(context: StorefrontContext): Promise<ActionResult> {
    return transition(context, 'AddingItems');
}

async function transition(context: StorefrontContext, state: string): Promise<ActionResult> {
    try {
        const data = await context.client.request(transitionOrderDocument, { state }, personal);
        // Null means there was no active Order to move.
        return data.transitionOrderToState
            ? resultFromUnion(data.transitionOrderToState)
            : refused('NO_ACTIVE_ORDER');
    } catch (error) {
        return refused(noticeFromError(error, 'TRANSITION_REFUSED'));
    }
}

// ── Payment ──────────────────────────────────────────────────────────────────

export interface StartPaymentInput {
    paymentMethodCode: string;
    /** Comparison values echoing what the shopper saw. The server never charges them. */
    confirmedTotal: number;
    confirmedQuoteId: string;
}

export type StartPaymentOutcome =
    /** Leave for the Provider's hosted page. */
    | { kind: 'provider'; url: string }
    /** An attempt exists. Its truth is on the Order page. */
    | { kind: 'order'; orderCode: string; notice?: NoticeCode }
    /** Nothing was started. Back to checkout with an explicit notice. */
    | { kind: 'checkout'; notice: NoticeCode };

/** Reasons after which the shopper must look again before paying; the next submit needs a new key. */
const NEW_KEY_REASONS = new Set(['RECONFIRMATION_REQUIRED', 'IDEMPOTENCY_CONFLICT']);

/**
 * Starts one hosted payment for the session's active Order.
 *
 * 1. One stable idempotency key per confirmation is saved before the call, so a double submit,
 *    a timeout or a crash retries with the same key and reaches the same attempt.
 * 2. The guest Order-access grant is issued and stored before leaving for the Provider. If that
 *    fails, payment is not started.
 * 3. Every typed result is handled. Nothing here marks an Order paid.
 */
export async function startPayment(
    context: StorefrontContext,
    input: StartPaymentInput,
): Promise<StartPaymentOutcome> {
    const { cookieContext } = context;
    let order: OrderView | undefined;
    try {
        order = await getActiveOrder(context);
    } catch (error) {
        return { kind: 'checkout', notice: noticeFromError(error) };
    }
    if (!order) return { kind: 'checkout', notice: 'NO_ACTIVE_ORDER' };
    if (order.state !== 'ArrangingPayment') return { kind: 'checkout', notice: 'ORDER_NOT_READY' };

    const existing = getPendingCheckout(cookieContext);
    const reuse = existing && existing.orderCode === order.code && isIdempotencyKey(existing.idempotencyKey);
    const idempotencyKey = reuse ? existing.idempotencyKey : newIdempotencyKey();
    if (!reuse) setPendingCheckout(cookieContext, { orderCode: order.code, idempotencyKey, started: false });

    try {
        const access = await context.client.request(issueOrderAccessDocument, {}, personal);
        const grant = access.issueCheckoutOrderAccess;
        if (!grant.token || grant.orderCode !== order.code)
            return { kind: 'checkout', notice: 'ACCESS_GRANT_FAILED' };
        setOrderAccessGrant(cookieContext, grant.orderCode, grant.token);
    } catch {
        return { kind: 'checkout', notice: 'ACCESS_GRANT_FAILED' };
    }

    let result;
    try {
        const data = await context.client.request(
            startPaymentDocument,
            { input: { ...input, idempotencyKey } },
            personal,
        );
        result = data.startCheckoutPayment;
    } catch (error) {
        // The request may or may not have been accepted. The key is kept, so pressing pay again
        // returns the saved attempt instead of creating a second one.
        const notice = noticeFromError(error, 'INVALID_INPUT');
        return {
            kind: 'checkout',
            notice: notice === 'SERVICE_UNAVAILABLE' ? 'PAYMENT_START_UNCONFIRMED' : notice,
        };
    }

    const markStarted = () =>
        setPendingCheckout(cookieContext, { orderCode: order.code, idempotencyKey, started: true });

    if (result.success) {
        markStarted();
        if (result.status === 'pending' && result.redirectUrl) {
            return isSafeProviderUrl(result.redirectUrl, context.localSite)
                ? { kind: 'provider', url: result.redirectUrl }
                : { kind: 'order', orderCode: order.code, notice: 'PAYMENT_REDIRECT_REFUSED' };
        }
        // `uncertain` or `failed`: the Order page tells the truth and polls while it can change.
        return { kind: 'order', orderCode: order.code };
    }

    if (result.reason === 'ATTEMPT_EXISTS') {
        markStarted();
        return { kind: 'order', orderCode: order.code };
    }
    if (result.reconfirmationRequired || NEW_KEY_REASONS.has(result.reason ?? '')) {
        clearPendingCheckout(cookieContext);
        return { kind: 'checkout', notice: noticeFromReason(result.reason, 'RECONFIRMATION_REQUIRED') };
    }
    // Refused before anything was saved, or retryable with the same key (SHIPPING_UNAVAILABLE).
    return { kind: 'checkout', notice: noticeFromReason(result.reason, 'ORDER_NOT_READY') };
}

// ── Protected confirmation ───────────────────────────────────────────────────

const ORDER_CODE = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * The Order and its payment status, as the Shop API reports them now. Access comes from the
 * guest grant in this browser's HttpOnly cookie (or the authenticated customer's session); an
 * Order code alone returns nothing. Reading never creates a charge.
 */
export async function getOrderConfirmation(
    context: StorefrontContext,
    code: string,
): Promise<OrderConfirmationView | undefined> {
    if (!ORDER_CODE.test(code)) return undefined;
    const accessGrant = getOrderAccessGrant(context.cookieContext, code) ?? null;
    const data = await context.client.request(orderConfirmationDocument, { code, accessGrant }, personal);
    if (!data.checkoutOrder) return undefined;
    return {
        order: mapOrder(data.checkoutOrder),
        payment: mapPaymentStatus(data.checkoutPaymentStatus, url =>
            isSafeProviderUrl(url, context.localSite),
        ),
    };
}

/** Where the hosted-payment return page sends the shopper. Nothing in the return URL is read. */
export function getReturnOrderCode(context: StorefrontContext): string | undefined {
    return getPendingCheckout(context.cookieContext)?.orderCode;
}

/**
 * Abandons this browser's cart session so the shopper can shop again after a payment that ended
 * without success. The earlier Order and its grant are untouched.
 */
export function startNewCart(context: StorefrontContext): void {
    clearSessionToken(context.cookieContext);
    clearPendingCheckout(context.cookieContext);
}
