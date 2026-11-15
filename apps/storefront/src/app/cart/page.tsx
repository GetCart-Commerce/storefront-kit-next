import { getMessages } from '@getcart/storefront-core';
import { loadCart } from '@getcart/storefront-core/next';
import type { Metadata } from 'next';

import { getBrandRuntime, noticeParam, slot } from '../../brand';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
    const { info } = await getBrandRuntime();
    return { title: getMessages(info.locale).cart.title, robots: { index: false } };
}

export default async function Cart({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const [query, { brand, info }, order] = await Promise.all([searchParams, getBrandRuntime(), loadCart()]);
    const CartPage = slot(brand, 'CartPage');
    return <CartPage brand={info} order={order} notice={noticeParam(query)} />;
}
