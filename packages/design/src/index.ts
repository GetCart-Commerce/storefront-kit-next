import type { Slots } from '@getcart/storefront-core';

import { CartPage } from './CartPage';
import { ContentPage, HomePage, ProductListPage, ProductPage } from './catalog';
import { CheckoutPage } from './CheckoutPage';
import { Layout } from './Layout';
import { OrderPage } from './OrderPage';

/**
 * @getcart/storefront-design — the Default design. It is one consumer of the Storefront core:
 * it renders the core's view models and posts to the core's server actions, and holds no
 * commerce logic of its own. A Brand design replaces any of these Slots.
 */
export const defaultSlots: Slots = {
    Layout,
    HomePage,
    ProductListPage,
    ProductPage,
    CartPage,
    CheckoutPage,
    OrderPage,
    ContentPage,
};

// Pieces a Brand design may reuse inside its own components.
export { CartPage } from './CartPage';
export { ContentPage, HomePage, ProductGrid, ProductListPage, ProductPage, Sections } from './catalog';
export { CheckoutPage, createCheckoutPage } from './CheckoutPage';
export { Layout } from './Layout';
export { OrderPage } from './OrderPage';
export { OrderSummary } from './OrderSummary';
export { HostedPaymentForm, paymentUi } from './payment-ui';
export { Button, Field, Money, Notice, PageHeading, Panel } from './primitives';
