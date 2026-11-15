import { getMessages, type Locale, type OrderView } from '@getcart/storefront-core';

import { Money, Panel } from './primitives';

/** Every row is an amount the Shop API returned. Nothing here is added up in the browser. */
export function OrderSummary({ order, locale }: { order: OrderView; locale: Locale }) {
    const messages = getMessages(locale);
    const money = (amount: number) => (
        <Money amount={amount} currencyCode={order.currencyCode} locale={locale} />
    );
    const adjustments = [...order.discounts, ...order.surcharges].filter(row => row.amount !== 0);
    return (
        <Panel className="space-y-4 text-sm">
            <h2 className="font-display text-lg">{messages.summary.heading}</h2>
            <ul className="space-y-2">
                {order.lines.map(line => (
                    <li key={line.id} className="flex justify-between gap-4">
                        <span>
                            {line.name} × {line.quantity}
                        </span>
                        {money(line.linePriceWithTax)}
                    </li>
                ))}
            </ul>
            <dl className="space-y-2 border-t border-border pt-4">
                <div className="flex justify-between gap-4">
                    <dt className="text-muted">{messages.summary.subtotal}</dt>
                    <dd data-testid="summary-subtotal">{money(order.subTotal)}</dd>
                </div>
                {adjustments.map((row, index) => (
                    <div key={index} className="flex justify-between gap-4">
                        <dt className="text-muted">{row.description}</dt>
                        <dd>{money(row.amount)}</dd>
                    </div>
                ))}
                <div className="flex justify-between gap-4">
                    <dt className="text-muted">
                        {messages.summary.shipping}
                        {order.courierServiceName ? ` · ${order.courierServiceName}` : ''}
                    </dt>
                    <dd data-testid="summary-shipping">
                        {order.courierServiceName ? (
                            money(order.shipping)
                        ) : (
                            <span className="text-muted">{messages.summary.shippingPending}</span>
                        )}
                    </dd>
                </div>
                <div className="flex justify-between gap-4 border-t border-border pt-3 text-base font-medium">
                    <dt>{order.totalFinal ? messages.summary.total : messages.summary.totalEstimated}</dt>
                    <dd data-testid="summary-total">{money(order.total)}</dd>
                </div>
            </dl>
            {order.totalFinal ? null : <p className="text-xs text-muted">{messages.summary.estimatedNote}</p>}
        </Panel>
    );
}
