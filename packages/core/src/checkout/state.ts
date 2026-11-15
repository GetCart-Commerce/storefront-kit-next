import type { CheckoutEditTarget, OrderView, PaymentStatus, QuoteView } from '../types';

/**
 * The checkout step is derived from server state on every request. No design stores a step, so
 * no design can skip one or show a step the Order is not in.
 */
export type CheckoutStep = 'empty' | 'contact' | 'delivery' | 'rates' | 'payment' | 'in-progress';

export interface CheckoutStepInput {
    order: Pick<OrderView, 'state' | 'lines' | 'contact' | 'address' | 'destination'> | undefined;
    /** True when this browser already started a payment for this Order. */
    paymentStarted: boolean;
    /** The shopper asked to go back to an earlier step. Honoured only while the cart is editable. */
    edit?: CheckoutEditTarget | undefined;
}

export function deriveCheckoutStep({ order, paymentStarted, edit }: CheckoutStepInput): CheckoutStep {
    if (!order || order.lines.length === 0) return 'empty';
    if (paymentStarted) return 'in-progress';
    if (order.state === 'ArrangingPayment') return 'payment';
    // Any other state than AddingItems means the Order has left the editable cart.
    if (order.state !== 'AddingItems') return 'in-progress';
    if (edit === 'contact' || !isContactComplete(order.contact)) return 'contact';
    if (edit === 'delivery' || !isAddressComplete(order.address) || !order.destination) return 'delivery';
    return 'rates';
}

function isContactComplete(contact: OrderView['contact']): boolean {
    return Boolean(contact?.emailAddress && contact.firstName && contact.lastName && contact.phoneNumber);
}

function isAddressComplete(address: OrderView['address']): boolean {
    return Boolean(
        address?.fullName &&
        address.streetLine1 &&
        address.city &&
        address.province &&
        address.postalCode &&
        address.phoneNumber,
    );
}

const QUOTE_STATUSES = ['not-ready', 'available', 'no-coverage', 'expired', 'unavailable'] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

/** A status this build does not know is treated as unavailable: never as a usable quote. */
export function normalizeQuoteStatus(status: string): QuoteStatus {
    return (QUOTE_STATUSES as readonly string[]).includes(status) ? (status as QuoteStatus) : 'unavailable';
}

/** The shopper may continue to payment only with a current quote and a selected Courier service. */
export function canContinueToPayment(quote: QuoteView): boolean {
    return (
        quote.status === 'available' &&
        quote.selectedServiceId !== undefined &&
        quote.services.some(service => service.id === quote.selectedServiceId)
    );
}

const PAYMENT_STATUSES = [
    'not-started',
    'pending',
    'uncertain',
    'failed',
    'paid',
    'cancelled',
    'expired',
] as const;

export function normalizePaymentStatus(status: string): PaymentStatus {
    return (PAYMENT_STATUSES as readonly string[]).includes(status) ? (status as PaymentStatus) : 'unknown';
}

/** Poll while the outcome can still change without the shopper doing anything. */
export function shouldPollPayment(status: PaymentStatus, reviewRequired: boolean): boolean {
    if (reviewRequired) return false;
    return status === 'pending' || status === 'uncertain' || status === 'unknown';
}

/** The attempt ended without payment. The Order cannot be paid again (no restart policy yet). */
export function hasPaymentEnded(status: PaymentStatus): boolean {
    return status === 'failed' || status === 'cancelled' || status === 'expired';
}
