import { createPaymentUiRegistry, type PaymentUiProps } from '@getcart/storefront-core';
import { startPaymentAction } from '@getcart/storefront-core/next/actions';

import { Button } from './primitives';

/**
 * UI for a hosted payment: one confirm button that leaves for the Provider's page. The hidden
 * fields echo the total and quote the shopper is looking at; the server compares them and
 * decides the charge itself.
 */
export function HostedPaymentForm({ option, confirmedTotal, confirmedQuoteId, submitLabel }: PaymentUiProps) {
    return (
        <form action={startPaymentAction} data-testid="payment-form">
            <input type="hidden" name="paymentMethodCode" value={option.code} />
            <input type="hidden" name="confirmedTotal" value={confirmedTotal} />
            <input type="hidden" name="confirmedQuoteId" value={confirmedQuoteId} />
            <Button type="submit" className="w-full" data-testid="pay">
                {submitLabel}
            </Button>
        </form>
    );
}

/**
 * The Default design's Provider UI registry. A new payment kind registers its component here
 * (or in a Brand design's own registry); checkout code does not change.
 */
export const paymentUi = createPaymentUiRegistry({ hosted: HostedPaymentForm });
