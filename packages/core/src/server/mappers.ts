import { hasPaymentEnded, normalizePaymentStatus, shouldPollPayment } from '../checkout/state';
import type { orderFieldsFragment, orderFragment } from '../shop/documents';
import type { ResultOf } from '../shop/graphql';
import type {
    CourierServiceOption,
    OrderView,
    PaymentOption,
    PaymentStatusView,
    ProductCard,
    ProductView,
    ShippingAreaView,
} from '../types';

/** These mappers only rename and narrow. They never add, subtract or round an amount. */

/** The destination area is present only on the session's active Order. */
type ApiOrder = ResultOf<typeof orderFieldsFragment> &
    Partial<Pick<ResultOf<typeof orderFragment>, 'checkoutShippingDestination'>>;

const FINAL_TOTAL_STATES_EXCLUDED = new Set(['Created', 'Draft', 'AddingItems']);

export function mapOrder(order: ApiOrder): OrderView {
    const customer = order.customer;
    const address = order.shippingAddress;
    const destination = order.checkoutShippingDestination;
    const shippingLine = order.shippingLines[0];
    return {
        code: order.code,
        state: order.state,
        currencyCode: order.currencyCode,
        totalFinal: !FINAL_TOTAL_STATES_EXCLUDED.has(order.state),
        totalQuantity: order.totalQuantity,
        lines: order.lines.map(line => ({
            id: line.id,
            variantId: line.productVariant.id,
            productSlug: line.productVariant.product.slug,
            name: line.productVariant.name,
            sku: line.productVariant.sku,
            quantity: line.quantity,
            unitPriceWithTax: line.unitPriceWithTax,
            linePriceWithTax: line.linePriceWithTax,
            image: line.featuredAsset?.preview,
        })),
        subTotal: order.subTotalWithTax,
        discounts: order.discounts.map(discount => ({
            description: discount.description,
            amount: discount.amountWithTax,
        })),
        surcharges: order.surcharges.map(surcharge => ({
            description: surcharge.description,
            amount: surcharge.priceWithTax,
        })),
        shipping: order.shippingWithTax,
        courierServiceName: shippingLine?.shippingMethod.name,
        selectedShippingMethodId: shippingLine?.shippingMethod.id,
        total: order.totalWithTax,
        contact: customer
            ? {
                  firstName: customer.firstName,
                  lastName: customer.lastName,
                  emailAddress: customer.emailAddress,
                  phoneNumber: customer.phoneNumber ?? '',
              }
            : undefined,
        address:
            address && address.streetLine1
                ? {
                      fullName: address.fullName ?? '',
                      streetLine1: address.streetLine1,
                      streetLine2: address.streetLine2 ?? '',
                      city: address.city ?? '',
                      province: address.province ?? '',
                      postalCode: address.postalCode ?? '',
                      countryCode: address.countryCode ?? '',
                      phoneNumber: address.phoneNumber ?? '',
                  }
                : undefined,
        destination: destination ? mapArea(destination) : undefined,
    };
}

export function mapArea(area: ShippingAreaView): ShippingAreaView {
    return {
        id: area.id,
        name: area.name,
        city: area.city,
        province: area.province,
        postalCode: area.postalCode,
        countryCode: area.countryCode,
    };
}

type ApiSearchItem = {
    productId: string;
    slug: string;
    productName: string;
    inStock: boolean;
    currencyCode: string;
    productAsset: { preview: string } | null;
    priceWithTax:
        { __typename: 'SinglePrice'; value: number } | { __typename: 'PriceRange'; min: number; max: number };
};

export function mapProductCard(item: ApiSearchItem): ProductCard {
    const price = item.priceWithTax;
    return {
        productId: item.productId,
        slug: item.slug,
        name: item.productName,
        image: item.productAsset?.preview,
        priceFrom: price.__typename === 'SinglePrice' ? price.value : price.min,
        priceTo: price.__typename === 'SinglePrice' ? price.value : price.max,
        currencyCode: item.currencyCode,
        inStock: item.inStock,
    };
}

type ApiProduct = {
    id: string;
    slug: string;
    name: string;
    description: string;
    featuredAsset: { preview: string } | null;
    assets: Array<{ preview: string }>;
    variants: Array<{
        id: string;
        name: string;
        sku: string;
        priceWithTax: number;
        currencyCode: string;
        stockLevel: string;
        options: Array<{ name: string; group: { name: string } }>;
    }>;
};

export function mapProduct(product: ApiProduct): ProductView {
    const images = [product.featuredAsset?.preview, ...product.assets.map(asset => asset.preview)].filter(
        (value): value is string => Boolean(value),
    );
    return {
        id: product.id,
        slug: product.slug,
        name: product.name,
        descriptionHtml: product.description,
        images: [...new Set(images)],
        variants: product.variants.map(variant => ({
            id: variant.id,
            name: variant.name,
            sku: variant.sku,
            priceWithTax: variant.priceWithTax,
            currencyCode: variant.currencyCode,
            // Vendure's default stock display strategy reports OUT_OF_STOCK, LOW_STOCK or IN_STOCK.
            purchasable: variant.stockLevel !== 'OUT_OF_STOCK',
            options: variant.options.map(option => ({ group: option.group.name, name: option.name })),
        })),
    };
}

/**
 * `metadata` is the safe service snapshot the shipping calculator attached to the quote.
 *
 * The name shown is the native method's name, which the Operator set on the Connection ("JNE REG").
 * `metadata.name` is the Provider's own service label; against Biteship's sandbox it is "Reguler"
 * for several couriers, so it cannot tell two Courier services apart.
 */
export function mapCourierService(method: {
    id: string;
    name: string;
    priceWithTax: number;
    metadata: unknown;
}): CourierServiceOption {
    const metadata = (method.metadata ?? {}) as { duration?: unknown };
    return {
        id: method.id,
        name: method.name,
        duration: typeof metadata.duration === 'string' && metadata.duration ? metadata.duration : undefined,
        priceWithTax: method.priceWithTax,
    };
}

/**
 * Branches on the capability the Shop API reports, never on a method code or a Provider id.
 * A method without a capability this build can pay with is not offered.
 */
export function mapPaymentOptions(
    methods: Array<{
        code: string;
        name: string;
        isEligible: boolean;
        checkoutHostedPayment: { hosted: boolean; providerName: string; environment: string } | null;
    }>,
): PaymentOption[] {
    const options: PaymentOption[] = [];
    for (const method of methods) {
        const hosted = method.checkoutHostedPayment;
        if (method.isEligible && hosted?.hosted) {
            options.push({
                code: method.code,
                name: method.name,
                kind: 'hosted',
                providerName: hosted.providerName,
                environment: hosted.environment,
            });
        }
    }
    return options;
}

export function mapPaymentStatus(
    payment: {
        status: string;
        message: string;
        continuationUrl: string | null;
        verifiedAt: string | null;
        amount: number | null;
        currencyCode: string | null;
        shippingServiceName: string | null;
        reviewRequired: boolean;
    } | null,
    isSafeUrl: (url: string) => boolean,
): PaymentStatusView {
    if (!payment) {
        return {
            status: 'not-started',
            message: '',
            continuationUrl: undefined,
            verifiedAt: undefined,
            amount: undefined,
            currencyCode: undefined,
            shippingServiceName: undefined,
            reviewRequired: false,
            poll: false,
            ended: false,
        };
    }
    const status = normalizePaymentStatus(payment.status);
    const continuationUrl =
        status === 'pending' &&
        !payment.reviewRequired &&
        payment.continuationUrl &&
        isSafeUrl(payment.continuationUrl)
            ? payment.continuationUrl
            : undefined;
    return {
        status,
        message: payment.message,
        continuationUrl,
        verifiedAt: payment.verifiedAt ?? undefined,
        amount: payment.amount ?? undefined,
        currencyCode: payment.currencyCode ?? undefined,
        shippingServiceName: payment.shippingServiceName ?? undefined,
        reviewRequired: payment.reviewRequired,
        poll: shouldPollPayment(status, payment.reviewRequired),
        ended: hasPaymentEnded(status),
    };
}
