import type { NoticeCode } from '../checkout/notices';
import type { CookieContext } from './cookies';
import { ShopApiError, type ShopClient } from './shop-client';

/** What every server-side operation needs: the Channel-bound client and the cookie jar. */
export interface StorefrontContext {
    client: ShopClient;
    cookieContext: CookieContext;
    /** True when this deployment itself runs on localhost (local development and tests). */
    localSite: boolean;
}

export type ActionResult = { ok: true } | { ok: false; notice: NoticeCode };

export const ok: ActionResult = { ok: true };
export const refused = (notice: NoticeCode): ActionResult => ({ ok: false, notice });

const TRANSPORT_CODES = new Set(['NETWORK', 'HTTP', 'MALFORMED']);

/** A transport failure is "try again"; a GraphQL refusal means the server would not change the Order. */
export function noticeFromError(error: unknown, refusal: NoticeCode = 'ORDER_CHANGE_REFUSED'): NoticeCode {
    if (error instanceof ShopApiError && error.code && !TRANSPORT_CODES.has(error.code)) return refusal;
    if (error instanceof ShopApiError) return 'SERVICE_UNAVAILABLE';
    throw error;
}

const NATIVE_ERROR_NOTICES: Record<string, NoticeCode> = {
    INSUFFICIENT_STOCK_ERROR: 'INSUFFICIENT_STOCK',
    ORDER_LIMIT_ERROR: 'ORDER_LIMIT',
    NEGATIVE_QUANTITY_ERROR: 'INVALID_FORM',
    ORDER_MODIFICATION_ERROR: 'ORDER_CHANGE_REFUSED',
    ORDER_INTERCEPTOR_ERROR: 'ORDER_CHANGE_REFUSED',
    EMAIL_ADDRESS_CONFLICT_ERROR: 'EMAIL_CONFLICT',
    ALREADY_LOGGED_IN_ERROR: 'ALREADY_SIGNED_IN',
    GUEST_CHECKOUT_ERROR: 'GUEST_CHECKOUT_DISABLED',
    NO_ACTIVE_ORDER_ERROR: 'NO_ACTIVE_ORDER',
    INELIGIBLE_SHIPPING_METHOD_ERROR: 'INELIGIBLE_SHIPPING_METHOD',
    ORDER_STATE_TRANSITION_ERROR: 'TRANSITION_REFUSED',
};

/**
 * Native mutations return error unions with HTTP 200. Every one is checked: an `Order` is
 * success, anything else maps to its own notice.
 */
export function resultFromUnion(result: { __typename?: string; errorCode?: string | null }): ActionResult {
    if (result.__typename === 'Order') return ok;
    return refused(NATIVE_ERROR_NOTICES[result.errorCode ?? ''] ?? 'ORDER_CHANGE_REFUSED');
}

/**
 * A Provider page the shopper may be sent to: https only. Plain http is accepted only for a
 * localhost Provider page while the storefront itself runs on localhost.
 */
export function isSafeProviderUrl(url: string, localSite: boolean): boolean {
    try {
        const parsed = new URL(url);
        if (parsed.username || parsed.password) return false;
        if (parsed.protocol === 'https:') return true;
        return (
            localSite && parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname)
        );
    } catch {
        return false;
    }
}
