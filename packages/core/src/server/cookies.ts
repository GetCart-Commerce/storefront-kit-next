import { createHash } from 'node:crypto';

import { isIdempotencyKey } from '../checkout/idempotency';
import { routes } from '../routes';

/**
 * Server-side secrets held in cookies. Every cookie here is HttpOnly, SameSite=Lax and, on an
 * https site, Secure. None of these values is ever returned to a component, put in a URL,
 * written to `localStorage` or logged.
 */

export interface CookieOptions {
    httpOnly: true;
    secure: boolean;
    sameSite: 'lax';
    path: string;
    maxAge: number;
}

/** The framework's cookie jar. Next.js supplies it through `@getcart/storefront-core/next`. */
export interface CookieStore {
    get(name: string): string | undefined;
    set(name: string, value: string, options: CookieOptions): void;
    delete(name: string, options: Pick<CookieOptions, 'path'>): void;
}

const SESSION_COOKIE = 'gc_session';
const PENDING_COOKIE = 'gc_checkout';
const GRANT_COOKIE_PREFIX = 'gc_order_';

const DAY = 24 * 60 * 60;
/** Vendure sessions last a year of inactivity by default; the cookie is renewed when reissued. */
const SESSION_MAX_AGE = 30 * DAY;
/** Matches the grant's server-side lifetime (ORDER_ACCESS_GRANT_LIFETIME_MS, 30 days). */
const GRANT_MAX_AGE = 30 * DAY;
const PENDING_MAX_AGE = 2 * DAY;

export interface CookieContext {
    cookies: CookieStore;
    secure: boolean;
}

function options(context: CookieContext, path: string, maxAge: number): CookieOptions {
    return { httpOnly: true, secure: context.secure, sameSite: 'lax', path, maxAge };
}

// ── Shopper session ──────────────────────────────────────────────────────────

export function getSessionToken(context: CookieContext): string | undefined {
    return context.cookies.get(SESSION_COOKIE) || undefined;
}

export function setSessionToken(context: CookieContext, token: string): void {
    context.cookies.set(SESSION_COOKIE, token, options(context, '/', SESSION_MAX_AGE));
}

export function clearSessionToken(context: CookieContext): void {
    context.cookies.delete(SESSION_COOKIE, { path: '/' });
}

// ── Guest Order-access grants ────────────────────────────────────────────────

/** The cookie name reveals neither the Order code nor the grant. */
function grantCookieName(orderCode: string): string {
    return GRANT_COOKIE_PREFIX + createHash('sha256').update(orderCode).digest('hex').slice(0, 24);
}

/**
 * Stores the grant from `issueCheckoutOrderAccess`. The cookie is scoped to the Order
 * confirmation path, so no other page of the storefront ever receives it.
 */
export function setOrderAccessGrant(context: CookieContext, orderCode: string, token: string): void {
    context.cookies.set(grantCookieName(orderCode), token, options(context, routes.orderBase, GRANT_MAX_AGE));
}

export function getOrderAccessGrant(context: CookieContext, orderCode: string): string | undefined {
    return context.cookies.get(grantCookieName(orderCode)) || undefined;
}

// ── Pending checkout ─────────────────────────────────────────────────────────

/**
 * What this browser is in the middle of paying. It holds no secret: an Order code alone opens
 * nothing. It exists so that a retry reuses the same idempotency key, and so that the return
 * page knows which Order to show without trusting anything in the return URL.
 */
export interface PendingCheckout {
    orderCode: string;
    idempotencyKey: string;
    /** True once `startCheckoutPayment` reported an attempt for this Order. */
    started: boolean;
}

export function getPendingCheckout(context: CookieContext): PendingCheckout | undefined {
    const raw = context.cookies.get(PENDING_COOKIE);
    if (!raw) return undefined;
    try {
        const value = JSON.parse(raw) as Partial<PendingCheckout>;
        if (
            typeof value.orderCode === 'string' &&
            /^[A-Za-z0-9_-]{1,64}$/.test(value.orderCode) &&
            isIdempotencyKey(value.idempotencyKey) &&
            typeof value.started === 'boolean'
        ) {
            return {
                orderCode: value.orderCode,
                idempotencyKey: value.idempotencyKey,
                started: value.started,
            };
        }
    } catch {
        // A cookie this build cannot read is treated as absent.
    }
    return undefined;
}

export function setPendingCheckout(context: CookieContext, pending: PendingCheckout): void {
    context.cookies.set(PENDING_COOKIE, JSON.stringify(pending), options(context, '/', PENDING_MAX_AGE));
}

export function clearPendingCheckout(context: CookieContext): void {
    context.cookies.delete(PENDING_COOKIE, { path: '/' });
}
