import { getMessages } from '@getcart/storefront-core';
import { loadOrderConfirmation } from '@getcart/storefront-core/next';
import type { Metadata } from 'next';

import { getBrandRuntime, slot } from '../../../brand';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
    const { info } = await getBrandRuntime();
    return { title: getMessages(info.locale).order.title, robots: { index: false, follow: false } };
}

/**
 * Protected Order confirmation. Access comes from the guest grant in this browser's HttpOnly
 * cookie; an Order code alone shows the same "not found" as an unknown code.
 */
export default async function Order({ params }: { params: Promise<{ code: string }> }) {
    const [{ code }, { brand, info }] = await Promise.all([params, getBrandRuntime()]);
    const confirmation = await loadOrderConfirmation(code);
    const OrderPage = slot(brand, 'OrderPage');
    return <OrderPage brand={info} confirmation={confirmation} />;
}
