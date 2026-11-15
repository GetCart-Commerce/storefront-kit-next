'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Re-reads the Order page from the server while a payment is pending or uncertain. The browser
 * only asks; the status always comes from `checkoutPaymentStatus`.
 */
export function PaymentStatusPoller({ label, intervalMs = 4000 }: { label: string; intervalMs?: number }) {
    const router = useRouter();
    useEffect(() => {
        const timer = setInterval(() => router.refresh(), intervalMs);
        return () => clearInterval(timer);
    }, [router, intervalMs]);
    return (
        <p className="text-sm text-muted" aria-live="polite" data-testid="payment-polling">
            {label}
        </p>
    );
}
