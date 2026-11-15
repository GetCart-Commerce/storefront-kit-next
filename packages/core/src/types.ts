/**
 * View models the Storefront core hands to a design. They carry only what the Shop API returned:
 * every amount is the server's integer in hundredths, to be shown with `formatMoney` next to
 * `currencyCode`. A design never derives a price, a total or a status from them.
 */

export interface ProductCard {
    productId: string;
    slug: string;
    name: string;
    image: string | undefined;
    /** Lowest and highest variant price, tax included. Equal for a single price. */
    priceFrom: number;
    priceTo: number;
    currencyCode: string;
    inStock: boolean;
}

export interface ProductVariantView {
    id: string;
    name: string;
    sku: string;
    priceWithTax: number;
    currencyCode: string;
    /** False when Vendure reports the variant out of stock. Never offer it for purchase. */
    purchasable: boolean;
    options: Array<{ group: string; name: string }>;
}

export interface ProductView {
    id: string;
    slug: string;
    name: string;
    /** Product description from Vendure (rich text HTML written by the Brand admin). */
    descriptionHtml: string;
    images: string[];
    variants: ProductVariantView[];
}

export interface OrderLineView {
    id: string;
    variantId: string;
    productSlug: string;
    name: string;
    sku: string;
    quantity: number;
    unitPriceWithTax: number;
    linePriceWithTax: number;
    image: string | undefined;
}

export interface OrderAdjustmentView {
    description: string;
    /** Signed amount as returned: discounts and a downward rounding row are negative. */
    amount: number;
}

export interface ContactView {
    firstName: string;
    lastName: string;
    emailAddress: string;
    phoneNumber: string;
}

export interface AddressView {
    fullName: string;
    streetLine1: string;
    streetLine2: string;
    city: string;
    province: string;
    postalCode: string;
    countryCode: string;
    phoneNumber: string;
}

export interface ShippingAreaView {
    id: string;
    name: string;
    city: string;
    province: string;
    postalCode: string;
    countryCode: string;
}

export interface OrderView {
    code: string;
    state: string;
    currencyCode: string;
    /**
     * True once the Order is in `ArrangingPayment` or later. Before that `total` is an estimate:
     * it is unrounded and has no rounding row.
     */
    totalFinal: boolean;
    totalQuantity: number;
    lines: OrderLineView[];
    subTotal: number;
    discounts: OrderAdjustmentView[];
    /** Includes the payable-rounding row when the server added one. */
    surcharges: OrderAdjustmentView[];
    shipping: number;
    /** Name of the selected Courier service, when one is selected. */
    courierServiceName: string | undefined;
    /** Native ShippingMethod id of the current selection. */
    selectedShippingMethodId: string | undefined;
    total: number;
    contact: ContactView | undefined;
    address: AddressView | undefined;
    destination: ShippingAreaView | undefined;
}

/** One Courier service offered for the current quote, from native `eligibleShippingMethods`. */
export interface CourierServiceOption {
    /** Native ShippingMethod id, passed back to select it. */
    id: string;
    name: string;
    duration: string | undefined;
    priceWithTax: number;
}

export type QuoteView =
    | { status: 'not-ready'; message: string }
    | {
          status: 'available';
          quoteId: string;
          expiresAt: string | undefined;
          services: CourierServiceOption[];
          selectedServiceId: string | undefined;
      }
    | { status: 'no-coverage'; message: string }
    | { status: 'expired'; message: string }
    | { status: 'unavailable'; message: string; reason: string | undefined; retryable: boolean };

/**
 * How a payment method is paid. `hosted` comes from `PaymentMethodQuote.checkoutHostedPayment`,
 * never from a method code or a Provider id. New kinds are added here when the enterprise
 * contract exposes a new capability, and a design registers UI for them in the Provider UI
 * registry.
 */
export type PaymentKind = 'hosted';

export interface PaymentOption {
    code: string;
    name: string;
    kind: PaymentKind;
    providerName: string;
    /** `test` for a sandbox Connection. Shown so nobody mistakes a sandbox payment for a real one. */
    environment: string;
}

export type CheckoutEditTarget = 'contact' | 'delivery';

export type CheckoutView =
    | { step: 'empty' }
    | { step: 'contact'; order: OrderView }
    | {
          step: 'delivery';
          order: OrderView;
          areaTerm: string;
          areas: ShippingAreaView[];
          /** Set when the area search failed or was refused. */
          areaNotice: { message: string; retryable: boolean } | undefined;
      }
    | { step: 'rates'; order: OrderView; quote: QuoteView }
    | {
          step: 'payment';
          order: OrderView;
          /** The shipping quote the shopper is confirming. Echoed back as `confirmedQuoteId`. */
          quoteId: string | undefined;
          paymentOptions: PaymentOption[];
      }
    /** A payment attempt already exists for this Order. Its truth is on the Order page. */
    | { step: 'in-progress'; orderCode: string };

export type PaymentStatus =
    | 'not-started'
    | 'pending'
    | 'uncertain'
    | 'failed'
    | 'paid'
    | 'cancelled'
    | 'expired'
    /** The API returned a status this build does not know. Shown as "being checked", never as paid. */
    | 'unknown';

export interface PaymentStatusView {
    status: PaymentStatus;
    /** Sanitized server message, as a fallback when the design has no copy for the status. */
    message: string;
    /** Provider page to continue an unfinished payment. Present only while pending. */
    continuationUrl: string | undefined;
    verifiedAt: string | undefined;
    amount: number | undefined;
    currencyCode: string | undefined;
    shippingServiceName: string | undefined;
    /** A verified result is held for review. Tell the shopper not to pay again. */
    reviewRequired: boolean;
    /** True while the outcome can still change on its own: keep polling. */
    poll: boolean;
    /** True when this attempt has ended without payment and the Order cannot be paid again. */
    ended: boolean;
}

export interface OrderConfirmationView {
    order: OrderView;
    payment: PaymentStatusView;
}
