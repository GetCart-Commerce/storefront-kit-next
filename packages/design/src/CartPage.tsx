import { getMessages, routes, type SlotProps } from '@getcart/storefront-core';
import { updateCartLineAction } from '@getcart/storefront-core/next/actions';
import Link from 'next/link';

import { OrderSummary } from './OrderSummary';
import { Button, Money, Notice, PageHeading } from './primitives';

export function CartPage({ brand, order, notice }: SlotProps['CartPage']) {
    const messages = getMessages(brand.locale);
    const locale = brand.locale;
    if (!order || order.lines.length === 0) {
        return (
            <>
                <PageHeading>{messages.cart.title}</PageHeading>
                <Notice code={notice} locale={locale} />
                <p className="mb-6 text-muted" data-testid="cart-empty">
                    {messages.cart.empty}
                </p>
                <Link href={routes.products} className="underline">
                    {messages.cart.continueShopping}
                </Link>
            </>
        );
    }
    return (
        <>
            <PageHeading>{messages.cart.title}</PageHeading>
            <Notice code={notice} locale={locale} />
            <div className="grid gap-10 md:grid-cols-[1fr_22rem]">
                <ul className="divide-y divide-border border-y border-border">
                    {order.lines.map(line => (
                        <li
                            key={line.id}
                            className="flex flex-wrap items-center justify-between gap-4 py-4"
                            data-testid="cart-line"
                        >
                            <div>
                                <Link href={routes.product(line.productSlug)} className="hover:text-brand">
                                    {line.name}
                                </Link>
                                <p className="text-sm text-muted">
                                    <Money
                                        amount={line.unitPriceWithTax}
                                        currencyCode={order.currencyCode}
                                        locale={locale}
                                    />
                                </p>
                            </div>
                            <form action={updateCartLineAction} className="flex items-center gap-2">
                                <input type="hidden" name="lineId" value={line.id} />
                                <label className="sr-only" htmlFor={`quantity-${line.id}`}>
                                    {messages.cart.quantity}
                                </label>
                                <input
                                    id={`quantity-${line.id}`}
                                    name="quantity"
                                    type="number"
                                    min={1}
                                    max={99}
                                    defaultValue={line.quantity}
                                    className="min-h-11 w-20 rounded-brand border border-border bg-background px-3"
                                />
                                <Button type="submit" variant="secondary" name="intent" value="update">
                                    {messages.cart.update}
                                </Button>
                                <Button
                                    type="submit"
                                    variant="secondary"
                                    name="intent"
                                    value="remove"
                                    data-testid="remove-line"
                                >
                                    {messages.cart.remove}
                                </Button>
                            </form>
                        </li>
                    ))}
                </ul>
                <aside className="space-y-4">
                    <OrderSummary order={order} locale={locale} />
                    <Link
                        href={routes.checkout}
                        data-testid="go-to-checkout"
                        className="flex min-h-11 items-center justify-center rounded-brand bg-brand px-5 text-sm font-medium text-brand-foreground"
                    >
                        {messages.cart.checkout}
                    </Link>
                </aside>
            </div>
        </>
    );
}
