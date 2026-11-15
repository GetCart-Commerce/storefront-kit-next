import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { buildSchema, graphql, GraphQLError, type GraphQLSchema } from 'graphql';

/**
 * An in-memory stand-in for the enterprise Shop API, for tests only.
 *
 * It executes real GraphQL against the committed schema snapshot, so a storefront document that
 * selects a field the enterprise schema does not have fails here. Its behaviour follows
 * the enterprise checkout contract, but it is a simplification: it proves how the storefront
 * handles each result, not that enterprise produces it. The real proof is a sandbox purchase
 * against a running enterprise Instance.
 */

const SCHEMA_PATH = fileURLToPath(new URL('../../../schema/shop-api.graphql', import.meta.url));

export interface FakeChannel {
    /** Where the fake hosted-payment page sends the shopper back. */
    returnUrl: string;
}

export interface FakeScenario {
    /** What `refreshCheckoutShippingRates` produces. */
    quote: 'available' | 'no-coverage' | 'unavailable' | 'expired';
    /** What `startCheckoutPayment` does on a valid request. */
    payment: 'pending' | 'uncertain' | 'reconfirm-once' | 'shipping-unavailable-once';
}

export interface FakeShopApiOptions {
    /** Public base URL of this fake, used to build hosted-payment page links. */
    baseUrl: string;
    /** Channel tokens this fake accepts. A request with any other token is refused. */
    channels: Record<string, FakeChannel>;
}

export interface RecordedRequest {
    method: string;
    path: string;
    channelToken: string | null;
    hasSession: boolean;
    operationName: string | null;
}

interface Variant {
    id: string;
    name: string;
    sku: string;
    priceWithTax: number;
    stock: number;
    options: Array<{ name: string; group: { name: string } }>;
}

interface Product {
    id: string;
    slug: string;
    name: string;
    description: string;
    variants: Variant[];
}

interface Area {
    id: string;
    name: string;
    city: string;
    province: string;
    postalCode: string;
    countryCode: string;
}

interface Line {
    id: string;
    variant: Variant;
    product: Product;
    quantity: number;
}

interface Attempt {
    reference: string;
    idempotencyKey: string;
    status: 'pending' | 'uncertain' | 'failed' | 'paid' | 'cancelled' | 'expired';
    amount: number;
    shippingServiceName: string;
    verifiedAt: string | null;
}

interface Order {
    id: string;
    code: string;
    channelToken: string;
    state: 'AddingItems' | 'ArrangingPayment' | 'PaymentSettled';
    lines: Line[];
    customer: { firstName: string; lastName: string; emailAddress: string; phoneNumber: string } | null;
    address: Record<string, string> | null;
    destination: Area | null;
    quote: { status: string; quoteId: string | null; expiresAt: string | null; message: string } | null;
    shippingMethodId: string | null;
    shippingPrices: Record<string, number>;
    attempt: Attempt | null;
}

const size = (name: string) => ({ name, group: { name: 'Size' } });

const PRODUCTS: Product[] = [
    {
        id: '1',
        slug: 'linen-shirt',
        name: 'Linen Shirt',
        description: '<p>A breathable linen shirt for warm days.</p>',
        variants: [
            {
                id: '11',
                name: 'Linen Shirt S',
                sku: 'LS-S',
                priceWithTax: 25000000,
                stock: 5,
                options: [size('S')],
            },
            {
                id: '12',
                name: 'Linen Shirt M',
                sku: 'LS-M',
                priceWithTax: 25000000,
                stock: 5,
                options: [size('M')],
            },
            {
                id: '13',
                name: 'Linen Shirt L',
                sku: 'LS-L',
                priceWithTax: 27500000,
                stock: 0,
                options: [size('L')],
            },
        ],
    },
    {
        id: '2',
        slug: 'batik-scarf',
        name: 'Batik Scarf',
        description: '<p>Hand-stamped batik scarf.</p>',
        variants: [
            { id: '21', name: 'Batik Scarf', sku: 'BS-1', priceWithTax: 12000000, stock: 2, options: [] },
        ],
    },
];

const AREAS: Area[] = [
    {
        id: 'area-bandung-coblong',
        name: 'Coblong, Bandung, Jawa Barat. 40115',
        city: 'Bandung',
        province: 'Jawa Barat',
        postalCode: '40115',
        countryCode: 'ID',
    },
    {
        id: 'area-jakarta-kebayoran',
        name: 'Kebayoran Baru, Jakarta Selatan, DKI Jakarta. 12250',
        city: 'Jakarta Selatan',
        province: 'DKI Jakarta',
        postalCode: '12250',
        countryCode: 'ID',
    },
];

const SHIPPING_METHODS = [
    { id: '101', code: 'gc-shipping-fake-jne-reg', name: 'JNE REG', duration: '2 - 3 days', price: 1800000 },
    {
        id: '102',
        code: 'gc-shipping-fake-sicepat-reg',
        name: 'SiCepat REG',
        duration: '1 - 2 days',
        price: 1500000,
    },
];

const PAYMENT_METHOD_CODE = 'gc-payment-fake';
const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{16,128}$/;

function nativeError(
    typename: string,
    errorCode: string,
    message: string,
    extra: Record<string, unknown> = {},
) {
    return { __typename: typename, errorCode, message, ...extra };
}

export function createFakeShopApi(options: FakeShopApiOptions) {
    const schema: GraphQLSchema = buildSchema(readFileSync(SCHEMA_PATH, 'utf8'));
    let sequence = 0;
    const next = () => String(++sequence);

    let sessions = new Map<string, { order: Order | null }>();
    let orders = new Map<string, Order>();
    let grants = new Map<string, string>();
    let usedKeys = new Map<string, string>();
    let requests: RecordedRequest[] = [];
    let scenario: FakeScenario = { quote: 'available', payment: 'pending' };

    function reset() {
        sessions = new Map();
        orders = new Map();
        grants = new Map();
        usedKeys = new Map();
        requests = [];
        scenario = { quote: 'available', payment: 'pending' };
    }

    function shippingPrice(order: Order): number {
        return order.shippingMethodId ? (order.shippingPrices[order.shippingMethodId] ?? 0) : 0;
    }

    function subTotal(order: Order): number {
        return order.lines.reduce((sum, line) => sum + line.variant.priceWithTax * line.quantity, 0);
    }

    function orderDto(order: Order) {
        const method = SHIPPING_METHODS.find(candidate => candidate.id === order.shippingMethodId);
        const address = order.address;
        return {
            __typename: 'Order',
            id: order.id,
            code: order.code,
            state: order.state,
            currencyCode: 'IDR',
            totalQuantity: order.lines.reduce((sum, line) => sum + line.quantity, 0),
            subTotalWithTax: subTotal(order),
            shippingWithTax: shippingPrice(order),
            totalWithTax: subTotal(order) + shippingPrice(order),
            customer: order.customer,
            shippingAddress: {
                fullName: address?.fullName ?? null,
                streetLine1: address?.streetLine1 ?? null,
                streetLine2: address?.streetLine2 ?? null,
                city: address?.city ?? null,
                province: address?.province ?? null,
                postalCode: address?.postalCode ?? null,
                countryCode: address?.countryCode ?? null,
                phoneNumber: address?.phoneNumber ?? null,
            },
            checkoutShippingDestination: order.destination,
            lines: order.lines.map(line => ({
                id: line.id,
                quantity: line.quantity,
                unitPriceWithTax: line.variant.priceWithTax,
                linePriceWithTax: line.variant.priceWithTax * line.quantity,
                featuredAsset: null,
                productVariant: {
                    id: line.variant.id,
                    name: line.variant.name,
                    sku: line.variant.sku,
                    product: { slug: line.product.slug },
                },
            })),
            discounts: [],
            // IDR Orders carry exactly one rounding row once the payable is final; here it is zero.
            surcharges:
                order.state === 'AddingItems'
                    ? []
                    : [{ description: 'Payable rounding', sku: 'GETCART-PAYABLE-ROUNDING', priceWithTax: 0 }],
            shippingLines: method
                ? [
                      {
                          priceWithTax: shippingPrice(order),
                          shippingMethod: { id: method.id, name: method.name },
                      },
                  ]
                : [],
        };
    }

    function invalidateShipping(order: Order) {
        order.quote = null;
        order.shippingMethodId = null;
    }

    function quoteDto(order: Order | null) {
        const quote = order?.quote;
        if (!quote) {
            return {
                status: 'not-ready',
                quoteId: null,
                expiresAt: null,
                currencyCode: null,
                reason: 'NOT_READY',
                message: 'No current shipping quote.',
                retryable: true,
            };
        }
        return {
            status: quote.status,
            quoteId: quote.quoteId,
            expiresAt: quote.expiresAt,
            currencyCode: 'IDR',
            reason: quote.status === 'available' ? null : quote.status.toUpperCase().replace('-', '_'),
            message: quote.message,
            retryable: quote.status === 'unavailable' || quote.status === 'expired',
        };
    }

    const unresolved = (order: Order) =>
        order.attempt?.status === 'pending' || order.attempt?.status === 'uncertain';

    function paymentResult(order: Order, fields: Record<string, unknown>) {
        return {
            success: false,
            reason: null,
            message: '',
            retryable: false,
            reconfirmationRequired: false,
            orderCode: order.code,
            attemptReference: order.attempt?.reference ?? null,
            status: order.attempt?.status ?? null,
            redirectUrl: null,
            redirectExpiresAt: null,
            totalWithTax: subTotal(order) + shippingPrice(order),
            currencyCode: 'IDR',
            quoteId: order.quote?.quoteId ?? null,
            ...fields,
        };
    }

    interface Ctx {
        channelToken: string;
        sessionToken: string | null;
        issuedToken: string | null;
    }

    function activeOrder(ctx: Ctx): Order | null {
        const order = ctx.sessionToken ? (sessions.get(ctx.sessionToken)?.order ?? null) : null;
        return order && order.channelToken === ctx.channelToken ? order : null;
    }

    function ensureOrder(ctx: Ctx): Order {
        if (!ctx.sessionToken || !sessions.has(ctx.sessionToken)) {
            ctx.sessionToken = randomBytes(24).toString('hex');
            ctx.issuedToken = ctx.sessionToken;
            sessions.set(ctx.sessionToken, { order: null });
        }
        const session = sessions.get(ctx.sessionToken)!;
        if (!session.order || session.order.channelToken !== ctx.channelToken) {
            const id = next();
            session.order = {
                id,
                code: `GC${id.padStart(6, '0')}${randomBytes(3).toString('hex').toUpperCase()}`,
                channelToken: ctx.channelToken,
                state: 'AddingItems',
                lines: [],
                customer: null,
                address: null,
                destination: null,
                quote: null,
                shippingMethodId: null,
                shippingPrices: {},
                attempt: null,
            };
            orders.set(session.order.code, session.order);
        }
        return session.order;
    }

    function findVariant(id: string) {
        for (const product of PRODUCTS) {
            const variant = product.variants.find(candidate => candidate.id === id);
            if (variant) return { product, variant };
        }
        return undefined;
    }

    function authorizedOrder(ctx: Ctx, code: string, accessGrant: string | null | undefined): Order | null {
        const order = orders.get(code);
        if (!order || order.channelToken !== ctx.channelToken) return null;
        return accessGrant && grants.get(accessGrant) === code ? order : null;
    }

    const modificationRefused = () =>
        nativeError(
            'OrderModificationError',
            'ORDER_MODIFICATION_ERROR',
            'The Order cannot be modified in its current state.',
        );

    const root = {
        // ── Catalogue ──
        search: ({ input }: { input: { take?: number; skip?: number } }) => {
            const items = PRODUCTS.map(product => {
                const prices = product.variants.map(variant => variant.priceWithTax);
                const min = Math.min(...prices);
                const max = Math.max(...prices);
                return {
                    productId: product.id,
                    slug: product.slug,
                    productName: product.name,
                    inStock: product.variants.some(variant => variant.stock > 0),
                    currencyCode: 'IDR',
                    productAsset: null,
                    priceWithTax:
                        min === max
                            ? { __typename: 'SinglePrice', value: min }
                            : { __typename: 'PriceRange', min, max },
                };
            });
            const skip = input.skip ?? 0;
            return {
                totalItems: items.length,
                items: items.slice(skip, skip + (input.take ?? items.length)),
            };
        },
        product: ({ slug }: { slug?: string }) => {
            const product = PRODUCTS.find(candidate => candidate.slug === slug);
            if (!product) return null;
            return {
                ...product,
                featuredAsset: null,
                assets: [],
                variants: product.variants.map(variant => ({
                    ...variant,
                    currencyCode: 'IDR',
                    stockLevel: variant.stock > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK',
                })),
            };
        },

        // ── Cart ──
        activeOrder: (_: unknown, ctx: Ctx) => {
            const order = activeOrder(ctx);
            return order ? orderDto(order) : null;
        },
        addItemToOrder: (
            { productVariantId, quantity }: { productVariantId: string; quantity: number },
            ctx: Ctx,
        ) => {
            const found = findVariant(productVariantId);
            if (!found)
                throw new GraphQLError('No ProductVariant with that id.', {
                    extensions: { code: 'ENTITY_NOT_FOUND' },
                });
            const order = ensureOrder(ctx);
            if (order.state !== 'AddingItems') return modificationRefused();
            const line = order.lines.find(candidate => candidate.variant.id === productVariantId);
            const wanted = (line?.quantity ?? 0) + quantity;
            if (wanted > found.variant.stock) {
                return nativeError(
                    'InsufficientStockError',
                    'INSUFFICIENT_STOCK_ERROR',
                    'Not enough stock.',
                    {
                        quantityAvailable: found.variant.stock,
                        order: orderDto(order),
                    },
                );
            }
            if (line) line.quantity = wanted;
            else order.lines.push({ id: next(), variant: found.variant, product: found.product, quantity });
            invalidateShipping(order);
            return orderDto(order);
        },
        adjustOrderLine: ({ orderLineId, quantity }: { orderLineId: string; quantity: number }, ctx: Ctx) => {
            const order = activeOrder(ctx);
            const line = order?.lines.find(candidate => candidate.id === orderLineId);
            if (!order || !line)
                throw new GraphQLError('No such OrderLine.', { extensions: { code: 'ENTITY_NOT_FOUND' } });
            if (order.state !== 'AddingItems') return modificationRefused();
            if (quantity > line.variant.stock) {
                return nativeError(
                    'InsufficientStockError',
                    'INSUFFICIENT_STOCK_ERROR',
                    'Not enough stock.',
                    {
                        quantityAvailable: line.variant.stock,
                        order: orderDto(order),
                    },
                );
            }
            line.quantity = quantity;
            invalidateShipping(order);
            return orderDto(order);
        },
        removeOrderLine: ({ orderLineId }: { orderLineId: string }, ctx: Ctx) => {
            const order = activeOrder(ctx);
            if (!order)
                throw new GraphQLError('No such OrderLine.', { extensions: { code: 'ENTITY_NOT_FOUND' } });
            if (order.state !== 'AddingItems') return modificationRefused();
            order.lines = order.lines.filter(line => line.id !== orderLineId);
            invalidateShipping(order);
            return orderDto(order);
        },

        // ── Contact and address ──
        setCustomerForOrder: ({ input }: { input: Order['customer'] & object }, ctx: Ctx) => {
            const order = activeOrder(ctx);
            if (!order) return nativeError('NoActiveOrderError', 'NO_ACTIVE_ORDER_ERROR', 'No active Order.');
            if (unresolved(order))
                throw new GraphQLError('A payment is in progress.', {
                    extensions: { code: 'ILLEGAL_OPERATION' },
                });
            order.customer = {
                firstName: input.firstName,
                lastName: input.lastName,
                emailAddress: input.emailAddress,
                phoneNumber: input.phoneNumber ?? '',
            };
            return orderDto(order);
        },
        setOrderShippingAddress: ({ input }: { input: Record<string, string> }, ctx: Ctx) => {
            const order = activeOrder(ctx);
            if (!order) return nativeError('NoActiveOrderError', 'NO_ACTIVE_ORDER_ERROR', 'No active Order.');
            if (unresolved(order))
                throw new GraphQLError('A payment is in progress.', {
                    extensions: { code: 'ILLEGAL_OPERATION' },
                });
            order.address = { ...input };
            // A native address edit clears the destination binding and everything quoted for it.
            order.destination = null;
            invalidateShipping(order);
            return orderDto(order);
        },

        // ── Shipping destination and quotes ──
        checkoutShippingAreas: ({ term }: { term: string }) => {
            const needle = term.trim().toLowerCase();
            if (needle.length < 3) {
                return {
                    success: false,
                    reason: 'TERM_TOO_SHORT',
                    message: 'Enter at least three characters.',
                    retryable: false,
                    areas: [],
                };
            }
            return {
                success: true,
                reason: null,
                message: '',
                retryable: false,
                areas: AREAS.filter(area => area.name.toLowerCase().includes(needle)),
            };
        },
        setCheckoutShippingDestination: ({ input }: { input: { areaId: string } }, ctx: Ctx) => {
            const order = activeOrder(ctx);
            const area = AREAS.find(candidate => candidate.id === input.areaId);
            const fail = (reason: string, message: string) => ({
                success: false,
                reason,
                message,
                retryable: false,
                connectionId: null,
                state: null,
                revision: null,
            });
            if (!order || order.state !== 'AddingItems')
                return fail('ORDER_NOT_EDITABLE', 'The Order cannot be changed.');
            if (!area) return fail('AREA_NOT_FOUND', 'Unknown area.');
            if (!order.address?.streetLine1 || !order.address.phoneNumber)
                return fail('ADDRESS_INCOMPLETE', 'The address is incomplete.');
            if (order.address.postalCode !== area.postalCode || order.address.city !== area.city) {
                return fail('AREA_MISMATCH', 'The address does not match the area.');
            }
            order.destination = area;
            invalidateShipping(order);
            return {
                success: true,
                reason: null,
                message: '',
                retryable: false,
                connectionId: null,
                state: null,
                revision: null,
            };
        },
        refreshCheckoutShippingRates: (_: unknown, ctx: Ctx) => {
            const order = activeOrder(ctx);
            if (!order || !order.destination) return quoteDto(null);
            if (unresolved(order))
                return {
                    ...quoteDto(order),
                    reason: 'PAYMENT_IN_PROGRESS',
                    message: 'A payment is in progress.',
                    retryable: false,
                };
            const messages: Record<FakeScenario['quote'], string> = {
                available: '',
                'no-coverage': 'No courier covers this destination.',
                unavailable: 'The shipping Provider could not be reached.',
                expired: 'The quote has expired.',
            };
            const available = scenario.quote === 'available';
            order.quote = {
                status: scenario.quote,
                quoteId: available ? `quote-${next()}` : null,
                expiresAt: available ? new Date(Date.now() + 5 * 60_000).toISOString() : null,
                message: messages[scenario.quote],
            };
            order.shippingPrices = Object.fromEntries(
                SHIPPING_METHODS.map(method => [method.id, method.price]),
            );
            if (!available) order.shippingMethodId = null;
            return quoteDto(order);
        },
        checkoutShippingQuoteStatus: (_: unknown, ctx: Ctx) => quoteDto(activeOrder(ctx)),
        eligibleShippingMethods: (_: unknown, ctx: Ctx) => {
            const order = activeOrder(ctx);
            if (order?.quote?.status !== 'available') return [];
            return SHIPPING_METHODS.map(method => {
                const price = order.shippingPrices[method.id] ?? method.price;
                return {
                    id: method.id,
                    code: method.code,
                    name: method.name,
                    description: '',
                    price,
                    priceWithTax: price,
                    metadata: {
                        // As in enterprise: the Provider's own label, the same for several couriers.
                        name: 'Reguler',
                        duration: method.duration,
                        quoteId: order.quote?.quoteId,
                        quotedShippingAmount: price,
                    },
                };
            });
        },
        setOrderShippingMethod: ({ shippingMethodId }: { shippingMethodId: string[] }, ctx: Ctx) => {
            const order = activeOrder(ctx);
            if (!order) return nativeError('NoActiveOrderError', 'NO_ACTIVE_ORDER_ERROR', 'No active Order.');
            if (order.state !== 'AddingItems') return modificationRefused();
            const method = SHIPPING_METHODS.find(candidate => candidate.id === shippingMethodId[0]);
            if (!method || order.quote?.status !== 'available') {
                return nativeError(
                    'IneligibleShippingMethodError',
                    'INELIGIBLE_SHIPPING_METHOD_ERROR',
                    'This shipping method is not eligible.',
                );
            }
            order.shippingMethodId = method.id;
            return orderDto(order);
        },
        transitionOrderToState: ({ state }: { state: string }, ctx: Ctx) => {
            const order = activeOrder(ctx);
            if (!order) return null;
            const refuse = (transitionError: string) =>
                nativeError(
                    'OrderStateTransitionError',
                    'ORDER_STATE_TRANSITION_ERROR',
                    'Cannot transition the Order.',
                    {
                        transitionError,
                        fromState: order.state,
                        toState: state,
                    },
                );
            if (state === 'ArrangingPayment') {
                if (order.state !== 'AddingItems') return refuse('The Order is not being edited.');
                if (!order.customer || order.lines.length === 0)
                    return refuse('The Order has no customer or no lines.');
                if (order.quote?.status !== 'available' || !order.shippingMethodId)
                    return refuse('A current shipping quote is required.');
                order.state = 'ArrangingPayment';
                return orderDto(order);
            }
            if (state === 'AddingItems') {
                if (unresolved(order)) return refuse('A payment is in progress.');
                if (order.state !== 'ArrangingPayment') return refuse('The Order is not arranging payment.');
                order.state = 'AddingItems';
                return orderDto(order);
            }
            return refuse('Unsupported state.');
        },

        // ── Payment ──
        eligiblePaymentMethods: (_: unknown, ctx: Ctx) => {
            if (!activeOrder(ctx)) return [];
            return [
                {
                    id: '201',
                    code: PAYMENT_METHOD_CODE,
                    name: 'Online payment',
                    description: '',
                    isEligible: true,
                    eligibilityMessage: null,
                    checkoutHostedPayment: { hosted: true, providerName: 'Midtrans', environment: 'test' },
                },
            ];
        },
        issueCheckoutOrderAccess: (_: unknown, ctx: Ctx) => {
            const order = activeOrder(ctx);
            if (!order)
                throw new GraphQLError('You are not currently authorized to perform this action', {
                    extensions: { code: 'FORBIDDEN' },
                });
            const token = randomBytes(32).toString('base64url');
            grants.set(token, order.code);
            return {
                token,
                orderCode: order.code,
                expiresAt: new Date(Date.now() + 30 * 24 * 3600_000).toISOString(),
            };
        },
        startCheckoutPayment: (
            {
                input,
            }: {
                input: {
                    paymentMethodCode: string;
                    idempotencyKey: string;
                    confirmedTotal: number;
                    confirmedQuoteId: string;
                };
            },
            ctx: Ctx,
        ) => {
            const order = activeOrder(ctx);
            if (!order)
                throw new GraphQLError('You are not currently authorized to perform this action', {
                    extensions: { code: 'FORBIDDEN' },
                });
            const refuse = (reason: string, extra: Record<string, unknown> = {}) =>
                paymentResult(order, { reason, message: reason, ...extra });
            if (!IDEMPOTENCY_KEY.test(input.idempotencyKey)) return refuse('INVALID_INPUT');
            if (![...grants.values()].includes(order.code)) return refuse('ACCESS_GRANT_REQUIRED');
            if (order.attempt) {
                if (order.attempt.idempotencyKey !== input.idempotencyKey) return refuse('ATTEMPT_EXISTS');
                const pending = order.attempt.status === 'pending';
                return paymentResult(order, {
                    success: true,
                    redirectUrl: pending ? `${options.baseUrl}/pay/${order.attempt.reference}` : null,
                });
            }
            const keyOwner = usedKeys.get(input.idempotencyKey);
            if (keyOwner && keyOwner !== order.code) return refuse('IDEMPOTENCY_CONFLICT');
            if (order.state !== 'ArrangingPayment') return refuse('ORDER_NOT_READY');
            if (input.paymentMethodCode !== PAYMENT_METHOD_CODE) return refuse('PAYMENT_METHOD_UNAVAILABLE');

            const total = subTotal(order) + shippingPrice(order);
            const stale = input.confirmedQuoteId !== order.quote?.quoteId || input.confirmedTotal !== total;
            if (stale || scenario.payment === 'reconfirm-once') {
                if (scenario.payment === 'reconfirm-once') {
                    // The fresh pre-payment quote came back dearer: correct the Order natively.
                    scenario.payment = 'pending';
                    if (order.shippingMethodId)
                        order.shippingPrices[order.shippingMethodId] = shippingPrice(order) + 200000;
                    order.quote = {
                        status: 'available',
                        quoteId: `quote-${next()}`,
                        expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
                        message: '',
                    };
                }
                usedKeys.set(input.idempotencyKey, order.code);
                return refuse('RECONFIRMATION_REQUIRED', { reconfirmationRequired: true });
            }
            if (scenario.payment === 'shipping-unavailable-once') {
                scenario.payment = 'pending';
                return refuse('SHIPPING_UNAVAILABLE', { retryable: true });
            }

            usedKeys.set(input.idempotencyKey, order.code);
            const method = SHIPPING_METHODS.find(candidate => candidate.id === order.shippingMethodId);
            order.attempt = {
                reference: `att-${next()}-${randomBytes(4).toString('hex')}`,
                idempotencyKey: input.idempotencyKey,
                status: scenario.payment === 'uncertain' ? 'uncertain' : 'pending',
                amount: total,
                shippingServiceName: method?.name ?? '',
                verifiedAt: null,
            };
            const pending = order.attempt.status === 'pending';
            return paymentResult(order, {
                success: true,
                redirectUrl: pending ? `${options.baseUrl}/pay/${order.attempt.reference}` : null,
            });
        },
        checkoutOrder: ({ code, accessGrant }: { code: string; accessGrant?: string | null }, ctx: Ctx) => {
            const order = authorizedOrder(ctx, code, accessGrant);
            if (!order) return null;
            return {
                ...orderDto(order),
                // As in enterprise: the destination area is answered only for the active Order.
                checkoutShippingDestination: () => {
                    throw new GraphQLError('You are not currently authorized to perform this action', {
                        extensions: { code: 'FORBIDDEN' },
                    });
                },
            };
        },
        checkoutPaymentStatus: (
            { code, accessGrant }: { code: string; accessGrant?: string | null },
            ctx: Ctx,
        ) => {
            const order = authorizedOrder(ctx, code, accessGrant);
            if (!order) return null;
            const attempt = order.attempt;
            return {
                orderCode: order.code,
                attemptReference: attempt?.reference ?? null,
                status: attempt?.status ?? 'not-started',
                message: attempt ? `Payment is ${attempt.status}.` : 'Payment has not been started.',
                continuationUrl:
                    attempt?.status === 'pending' ? `${options.baseUrl}/pay/${attempt.reference}` : null,
                continuationExpiresAt: null,
                verifiedAt: attempt?.verifiedAt ?? null,
                amount: attempt?.amount ?? null,
                currencyCode: attempt ? 'IDR' : null,
                shippingServiceName: attempt?.shippingServiceName ?? null,
                reviewRequired: false,
            };
        },
    };

    /** Stands in for the worker verifying current Provider state. The browser never does this. */
    function resolveAttempt(
        reference: string,
        status: 'paid' | 'failed' | 'expired' | 'cancelled',
    ): Order | undefined {
        const order = [...orders.values()].find(candidate => candidate.attempt?.reference === reference);
        if (!order?.attempt || !unresolved(order)) return order;
        order.attempt.status = status;
        order.attempt.verifiedAt = new Date().toISOString();
        if (status === 'paid') {
            order.state = 'PaymentSettled';
            for (const session of sessions.values()) if (session.order === order) session.order = null;
        }
        return order;
    }

    const html = (body: string) =>
        new Response(`<!doctype html><meta charset="utf-8"><title>Fake hosted payment</title>${body}`, {
            headers: { 'content-type': 'text/html; charset=utf-8' },
        });

    async function handle(request: Request): Promise<Response> {
        const url = new URL(request.url);
        const channelToken = request.headers.get('vendure-token');
        const bearer = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? null;

        if (url.pathname === '/health') return new Response('ok');
        if (url.pathname === '/__reset' && request.method === 'POST') {
            reset();
            return Response.json({ ok: true });
        }
        if (url.pathname === '/__scenario' && request.method === 'POST') {
            scenario = { ...scenario, ...((await request.json()) as Partial<FakeScenario>) };
            return Response.json(scenario);
        }
        if (url.pathname === '/__requests') return Response.json(requests);

        const pay = /^\/pay\/([^/]+)(?:\/(paid|failed|expired|cancelled))?$/.exec(url.pathname);
        if (pay) {
            const reference = pay[1]!;
            const order = [...orders.values()].find(candidate => candidate.attempt?.reference === reference);
            if (!order?.attempt) return new Response('Unknown payment', { status: 404 });
            const returnUrl = options.channels[order.channelToken]?.returnUrl ?? '/';
            if (pay[2] && request.method === 'POST') {
                resolveAttempt(reference, pay[2] as 'paid' | 'failed' | 'expired' | 'cancelled');
                // Like Midtrans, the return carries Provider query values. The storefront ignores them.
                return new Response(null, {
                    status: 303,
                    headers: {
                        location: `${returnUrl}?order_id=${reference}&status_code=200&transaction_status=settlement`,
                    },
                });
            }
            const button = (action: string, label: string) =>
                `<form method="post" action="/pay/${reference}/${action}"><button data-testid="hosted-${action}">${label}</button></form>`;
            return html(
                `<h1>Fake hosted payment page</h1><p data-testid="hosted-amount">IDR ${order.attempt.amount / 100}</p>` +
                    button('paid', 'Pay') +
                    button('failed', 'Decline') +
                    button('expired', 'Let it expire') +
                    `<p><a data-testid="hosted-leave" href="${returnUrl}">Return without paying</a></p>`,
            );
        }

        if (url.pathname !== '/shop-api') return new Response('Not found', { status: 404 });

        const record: RecordedRequest = {
            method: request.method,
            path: url.pathname + url.search,
            channelToken,
            hasSession: Boolean(bearer),
            operationName: null,
        };
        requests.push(record);
        // The storefront must only ever POST: a grant in a GET would end up in URLs and logs.
        if (request.method !== 'POST') return new Response('Use POST', { status: 405 });
        if (!channelToken || !options.channels[channelToken]) {
            return Response.json({
                errors: [
                    { message: 'No valid channel was specified', extensions: { code: 'CHANNEL_NOT_FOUND' } },
                ],
            });
        }

        const body = (await request.json()) as {
            query: string;
            variables?: Record<string, unknown>;
            operationName?: string;
        };
        record.operationName = /(?:query|mutation)\s+(\w+)/.exec(body.query)?.[1] ?? null;
        const ctx: Ctx = {
            channelToken,
            sessionToken: bearer && sessions.has(bearer) ? bearer : null,
            issuedToken: null,
        };
        const result = await graphql({
            schema,
            source: body.query,
            rootValue: root,
            contextValue: ctx,
            variableValues: body.variables ?? {},
        });

        const headers = new Headers({ 'content-type': 'application/json', 'cache-control': 'no-store' });
        if (ctx.issuedToken) headers.set('vendure-auth-token', ctx.issuedToken);
        return new Response(JSON.stringify(result), { headers });
    }

    return {
        handle,
        reset,
        /** A `fetch` that talks to this fake, for tests that inject the transport. */
        fetch: ((input: RequestInfo | URL, init?: RequestInit) =>
            handle(new Request(input, init))) as typeof fetch,
        setScenario: (patch: Partial<FakeScenario>) => void (scenario = { ...scenario, ...patch }),
        resolveAttempt,
        requests: () => requests,
        orders: () => [...orders.values()],
        fixtures: {
            products: PRODUCTS,
            areas: AREAS,
            shippingMethods: SHIPPING_METHODS,
            paymentMethodCode: PAYMENT_METHOD_CODE,
        },
    };
}

export type FakeShopApi = ReturnType<typeof createFakeShopApi>;
