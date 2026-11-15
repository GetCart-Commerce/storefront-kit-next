import { routes } from '@getcart/storefront-core';
import { loadReturnOrderCode } from '@getcart/storefront-core/next';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/**
 * The hosted-payment return URL (enterprise `MIDTRANS_RETURN_URL`). It is navigation only.
 *
 * Nothing in the return URL is read: the Provider's `order_id`, `status_code` and
 * `transaction_status` query values are ignored, because a browser can forge them. The Order to
 * show comes from this browser's own HttpOnly cookie, and its payment state comes from the Shop
 * API on the Order page.
 */
export default async function CheckoutReturn() {
    const orderCode = await loadReturnOrderCode();
    redirect(orderCode ? routes.order(orderCode) : routes.cart);
}
