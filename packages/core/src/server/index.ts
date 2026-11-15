/**
 * Server-only half of the Storefront core: Shop API transport, session and grant cookies, and
 * the cart, checkout and confirmation operations. Framework-free; `../next` binds it to Next.js.
 */
export { createShopClient, ShopApiError } from './shop-client';
export type { RequestOptions, ShopClient, ShopClientOptions } from './shop-client';
export {
    clearPendingCheckout,
    clearSessionToken,
    getOrderAccessGrant,
    getPendingCheckout,
    getSessionToken,
    setOrderAccessGrant,
    setPendingCheckout,
    setSessionToken,
} from './cookies';
export type { CookieContext, CookieOptions, CookieStore, PendingCheckout } from './cookies';
export { isSafeProviderUrl } from './context';
export type { ActionResult, StorefrontContext } from './context';
export { CATALOGUE_TAG, getProduct, listProducts } from './catalog';
export {
    addToCart,
    continueToPayment,
    getActiveOrder,
    getCartQuantity,
    getCheckout,
    getOrderConfirmation,
    getReturnOrderCode,
    refreshRates,
    returnToCart,
    selectCourierService,
    setContact,
    setDelivery,
    startNewCart,
    startPayment,
    updateCartLine,
} from './checkout';
export type { ContactInput, DeliveryInput, StartPaymentInput, StartPaymentOutcome } from './checkout';
export { isIdempotencyKey, newIdempotencyKey } from '../checkout/idempotency';
