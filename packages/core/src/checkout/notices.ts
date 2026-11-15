/**
 * Every outcome a shopper can be told about. A notice travels as a code (in a redirect), never
 * as free text, and each code has explicit copy in the message catalogues: there is no generic
 * "something went wrong" for a typed result.
 */
export const NOTICE_CODES = [
    // startCheckoutPayment reasons
    'RECONFIRMATION_REQUIRED',
    'SHIPPING_SERVICE_REMOVED',
    'SHIPPING_INPUT_CHANGED',
    'SHIPPING_UNAVAILABLE',
    'STOCK_UNAVAILABLE',
    'UNSUPPORTED_CURRENCY',
    'AMOUNT_INVALID',
    'ORDER_NOT_READY',
    'PAYMENT_METHOD_UNAVAILABLE',
    'ACCESS_GRANT_REQUIRED',
    'INVALID_INPUT',
    'IDEMPOTENCY_CONFLICT',
    'PAYMENT_IN_PROGRESS',
    // Storefront outcomes around payment start
    'ACCESS_GRANT_FAILED',
    'PAYMENT_START_UNCONFIRMED',
    'PAYMENT_REDIRECT_REFUSED',
    // Native cart and Order results
    'INSUFFICIENT_STOCK',
    'ORDER_LIMIT',
    'ORDER_CHANGE_REFUSED',
    'VARIANT_UNAVAILABLE',
    'EMAIL_CONFLICT',
    'ALREADY_SIGNED_IN',
    'GUEST_CHECKOUT_DISABLED',
    'INELIGIBLE_SHIPPING_METHOD',
    'TRANSITION_REFUSED',
    'NO_ACTIVE_ORDER',
    // Shipping destination and quotes
    'DESTINATION_REJECTED',
    'RATES_REFRESH_IN_PROGRESS',
    // Storefront input and transport
    'INVALID_FORM',
    'SERVICE_UNAVAILABLE',
] as const;

export type NoticeCode = (typeof NOTICE_CODES)[number];

export function parseNotice(value: unknown): NoticeCode | undefined {
    return typeof value === 'string' && (NOTICE_CODES as readonly string[]).includes(value)
        ? (value as NoticeCode)
        : undefined;
}

/** Maps a server reason to a notice. An unknown reason falls back to the caller's choice. */
export function noticeFromReason(reason: string | null | undefined, fallback: NoticeCode): NoticeCode {
    return parseNotice(reason) ?? fallback;
}
