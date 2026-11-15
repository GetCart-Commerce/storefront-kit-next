import type { ComponentType } from 'react';

import type { PaymentKind, PaymentOption } from './types';

/**
 * Provider UI registry. Checkout never branches on a payment method code or a Provider id: it
 * asks this registry for the UI of a payment kind, and the kind comes from the capability the
 * Shop API reports. A new Provider with an existing kind needs no storefront change. A Provider
 * that needs its own UI (say, an embedded widget) gets a new kind and registers a component here.
 */
export interface PaymentUiProps {
    option: PaymentOption;
    /** Comparison values echoing what the shopper saw. Never the charge amount. */
    confirmedTotal: number;
    confirmedQuoteId: string;
    /** Localized label for the submit control, e.g. "Pay with Midtrans". */
    submitLabel: string;
}

export type PaymentUi = ComponentType<PaymentUiProps>;

export interface PaymentUiRegistry {
    register(kind: PaymentKind, component: PaymentUi): void;
    resolve(kind: PaymentKind): PaymentUi | undefined;
}

export function createPaymentUiRegistry(
    initial?: Partial<Record<PaymentKind, PaymentUi>>,
): PaymentUiRegistry {
    const components = new Map<PaymentKind, PaymentUi>(
        Object.entries(initial ?? {}) as Array<[PaymentKind, PaymentUi]>,
    );
    return {
        register: (kind, component) => void components.set(kind, component),
        resolve: kind => components.get(kind),
    };
}
