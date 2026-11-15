import { getMessages, routes } from '@getcart/storefront-core';
import { loadCheckout } from '@getcart/storefront-core/next';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { firstParam, getBrandRuntime, noticeParam, slot } from '../../brand';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
    const { info } = await getBrandRuntime();
    return { title: getMessages(info.locale).checkout.title, robots: { index: false } };
}

export default async function Checkout({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const [query, { brand, info }] = await Promise.all([searchParams, getBrandRuntime()]);
    const edit = firstParam(query, 'edit');
    const checkout = await loadCheckout({
        areaTerm: firstParam(query, 'area'),
        edit: edit === 'contact' || edit === 'delivery' ? edit : undefined,
    });
    // A payment already exists for this Order. Its truth is on the Order page.
    if (checkout.step === 'in-progress') redirect(routes.order(checkout.orderCode));
    const CheckoutPage = slot(brand, 'CheckoutPage');
    return <CheckoutPage brand={info} checkout={checkout} notice={noticeParam(query)} />;
}
