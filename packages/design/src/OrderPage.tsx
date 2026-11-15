import { getMessages, routes, type SlotProps } from '@getcart/storefront-core';
import { startNewCartAction } from '@getcart/storefront-core/next/actions';
import Link from 'next/link';

import { OrderSummary } from './OrderSummary';
import { PaymentStatusPoller } from './PaymentStatusPoller';
import { Button, PageHeading, Panel } from './primitives';

export function OrderPage({ brand, confirmation }: SlotProps['OrderPage']) {
    const messages = getMessages(brand.locale);
    const copy = messages.order;
    if (!confirmation) {
        return (
            <>
                <PageHeading>{copy.title}</PageHeading>
                <p className="mb-6 text-muted" data-testid="order-not-found">
                    {copy.notFound}
                </p>
                <Link href={routes.products} className="underline">
                    {messages.cart.continueShopping}
                </Link>
            </>
        );
    }
    const { order, payment } = confirmation;
    return (
        <>
            <PageHeading>{copy.title}</PageHeading>
            <div className="grid gap-10 md:grid-cols-[1fr_22rem]">
                <div className="space-y-6">
                    <Panel className="space-y-3">
                        <p className="text-sm text-muted">
                            {copy.code}: <span data-testid="order-code">{order.code}</span>
                        </p>
                        <h2
                            className="font-display text-2xl"
                            data-testid="payment-status"
                            data-payment-status={payment.status}
                        >
                            {copy.status[payment.status]}
                        </h2>
                        <p>{payment.reviewRequired ? copy.reviewRequired : copy.detail[payment.status]}</p>
                        {payment.continuationUrl ? (
                            <a
                                href={payment.continuationUrl}
                                data-testid="continue-payment"
                                className="inline-flex min-h-11 items-center rounded-brand bg-brand px-5 text-sm font-medium text-brand-foreground"
                            >
                                {copy.continuePayment}
                            </a>
                        ) : null}
                        {payment.poll ? <PaymentStatusPoller label={copy.checking} /> : null}
                        {payment.ended ? (
                            <form action={startNewCartAction}>
                                <Button type="submit" variant="secondary" data-testid="start-new-cart">
                                    {copy.newCart}
                                </Button>
                            </form>
                        ) : null}
                    </Panel>
                    {order.address ? (
                        <Panel className="space-y-2 text-sm">
                            <h3 className="text-muted">{copy.deliverTo}</h3>
                            <p>{order.address.fullName}</p>
                            <p>
                                {order.address.streetLine1}, {order.address.city}, {order.address.province}{' '}
                                {order.address.postalCode}
                            </p>
                            {order.courierServiceName ? (
                                <p>
                                    {copy.courierService}: {order.courierServiceName}
                                </p>
                            ) : null}
                            {payment.status === 'paid' ? (
                                <p className="text-muted">{copy.shippingNote}</p>
                            ) : null}
                        </Panel>
                    ) : null}
                </div>
                <aside>
                    <OrderSummary order={order} locale={brand.locale} />
                </aside>
            </div>
        </>
    );
}
