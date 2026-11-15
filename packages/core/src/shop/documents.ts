import { graphql } from './graphql';

/**
 * Every Shop API operation the storefront sends.
 * Native operations stay native; the `checkout*` operations are enterprise's extensions.
 */

/**
 * Order fields that both the active Order and the protected `checkoutOrder` return.
 *
 * `checkoutShippingDestination` is not here: enterprise answers it only for the session's active
 * Order and refuses it (FORBIDDEN) through `checkoutOrder`, even with a valid grant. Seen on
 * 2026-11-15.
 */
export const orderFieldsFragment = graphql(`
    fragment OrderFields on Order @_unmask {
        id
        code
        state
        currencyCode
        totalQuantity
        subTotalWithTax
        shippingWithTax
        totalWithTax
        customer {
            firstName
            lastName
            emailAddress
            phoneNumber
        }
        shippingAddress {
            fullName
            streetLine1
            streetLine2
            city
            province
            postalCode
            countryCode
            phoneNumber
        }
        lines {
            id
            quantity
            unitPriceWithTax
            linePriceWithTax
            featuredAsset {
                preview
            }
            productVariant {
                id
                name
                sku
                product {
                    slug
                }
            }
        }
        discounts {
            description
            amountWithTax
        }
        surcharges {
            description
            sku
            priceWithTax
        }
        shippingLines {
            priceWithTax
            shippingMethod {
                id
                name
            }
        }
    }
`);

/** The session's active Order: the shared fields plus the bound destination area. */
export const orderFragment = graphql(
    `
        fragment CheckoutOrder on Order @_unmask {
            ...OrderFields
            checkoutShippingDestination {
                id
                name
                city
                province
                postalCode
                countryCode
            }
        }
    `,
    [orderFieldsFragment],
);

const errorFragment = graphql(`
    fragment ErrorFields on ErrorResult @_unmask {
        errorCode
        message
    }
`);

// ── Catalogue ────────────────────────────────────────────────────────────────

export const searchProductsDocument = graphql(`
    query SearchProducts($input: SearchInput!) {
        search(input: $input) {
            totalItems
            items {
                productId
                slug
                productName
                inStock
                currencyCode
                productAsset {
                    preview
                }
                priceWithTax {
                    __typename
                    ... on SinglePrice {
                        value
                    }
                    ... on PriceRange {
                        min
                        max
                    }
                }
            }
        }
    }
`);

export const productDocument = graphql(`
    query Product($slug: String!) {
        product(slug: $slug) {
            id
            slug
            name
            description
            featuredAsset {
                preview
            }
            assets {
                preview
            }
            variants {
                id
                name
                sku
                priceWithTax
                currencyCode
                stockLevel
                options {
                    name
                    group {
                        name
                    }
                }
            }
        }
    }
`);

// ── Cart (native) ────────────────────────────────────────────────────────────

export const activeOrderDocument = graphql(
    `
        query ActiveOrder {
            activeOrder {
                ...CheckoutOrder
            }
        }
    `,
    [orderFragment],
);

export const cartQuantityDocument = graphql(`
    query CartQuantity {
        activeOrder {
            id
            totalQuantity
        }
    }
`);

export const addItemDocument = graphql(
    `
        mutation AddItemToOrder($variantId: ID!, $quantity: Int!) {
            addItemToOrder(productVariantId: $variantId, quantity: $quantity) {
                __typename
                ... on Order {
                    id
                }
                ...ErrorFields
            }
        }
    `,
    [errorFragment],
);

export const adjustLineDocument = graphql(
    `
        mutation AdjustOrderLine($lineId: ID!, $quantity: Int!) {
            adjustOrderLine(orderLineId: $lineId, quantity: $quantity) {
                __typename
                ... on Order {
                    id
                }
                ...ErrorFields
            }
        }
    `,
    [errorFragment],
);

export const removeLineDocument = graphql(
    `
        mutation RemoveOrderLine($lineId: ID!) {
            removeOrderLine(orderLineId: $lineId) {
                __typename
                ... on Order {
                    id
                }
                ...ErrorFields
            }
        }
    `,
    [errorFragment],
);

// ── Contact and address (native) ─────────────────────────────────────────────

export const setCustomerDocument = graphql(
    `
        mutation SetCustomerForOrder($input: CreateCustomerInput!) {
            setCustomerForOrder(input: $input) {
                __typename
                ... on Order {
                    id
                }
                ...ErrorFields
            }
        }
    `,
    [errorFragment],
);

export const setShippingAddressDocument = graphql(
    `
        mutation SetOrderShippingAddress($input: CreateAddressInput!) {
            setOrderShippingAddress(input: $input) {
                __typename
                ... on Order {
                    id
                }
                ...ErrorFields
            }
        }
    `,
    [errorFragment],
);

// ── Shipping destination and quotes (enterprise) ─────────────────────────────

export const shippingAreasDocument = graphql(`
    query CheckoutShippingAreas($term: String!) {
        checkoutShippingAreas(term: $term) {
            success
            reason
            message
            retryable
            areas {
                id
                name
                city
                province
                postalCode
                countryCode
            }
        }
    }
`);

export const setDestinationDocument = graphql(`
    mutation SetCheckoutShippingDestination($input: SetCheckoutShippingDestinationInput!) {
        setCheckoutShippingDestination(input: $input) {
            success
            reason
            message
            retryable
        }
    }
`);

const quoteStatusFragment = graphql(`
    fragment QuoteStatus on CheckoutShippingQuoteStatus @_unmask {
        status
        quoteId
        expiresAt
        currencyCode
        reason
        message
        retryable
    }
`);

export const refreshRatesDocument = graphql(
    `
        mutation RefreshCheckoutShippingRates {
            refreshCheckoutShippingRates {
                ...QuoteStatus
            }
        }
    `,
    [quoteStatusFragment],
);

/** The quote state and, when it is current, the Courier services native shipping offers. */
export const shippingOptionsDocument = graphql(
    `
        query CheckoutShippingOptions {
            checkoutShippingQuoteStatus {
                ...QuoteStatus
            }
            eligibleShippingMethods {
                id
                name
                priceWithTax
                metadata
            }
        }
    `,
    [quoteStatusFragment],
);

export const setShippingMethodDocument = graphql(
    `
        mutation SetOrderShippingMethod($ids: [ID!]!) {
            setOrderShippingMethod(shippingMethodId: $ids) {
                __typename
                ... on Order {
                    id
                }
                ...ErrorFields
            }
        }
    `,
    [errorFragment],
);

export const transitionOrderDocument = graphql(
    `
        mutation TransitionOrderToState($state: String!) {
            transitionOrderToState(state: $state) {
                __typename
                ... on Order {
                    id
                    state
                }
                ... on OrderStateTransitionError {
                    transitionError
                }
                ...ErrorFields
            }
        }
    `,
    [errorFragment],
);

// ── Payment (enterprise) ─────────────────────────────────────────────────────

export const paymentOptionsDocument = graphql(
    `
        query CheckoutPaymentOptions {
            checkoutShippingQuoteStatus {
                ...QuoteStatus
            }
            eligiblePaymentMethods {
                code
                name
                isEligible
                checkoutHostedPayment {
                    hosted
                    providerName
                    environment
                }
            }
        }
    `,
    [quoteStatusFragment],
);

export const issueOrderAccessDocument = graphql(`
    mutation IssueCheckoutOrderAccess {
        issueCheckoutOrderAccess {
            token
            orderCode
            expiresAt
        }
    }
`);

export const startPaymentDocument = graphql(`
    mutation StartCheckoutPayment($input: StartCheckoutPaymentInput!) {
        startCheckoutPayment(input: $input) {
            success
            reason
            message
            retryable
            reconfirmationRequired
            orderCode
            status
            redirectUrl
        }
    }
`);

/**
 * The protected Order and its payment status. The grant travels in the POST body as a variable:
 * the Shop API refuses a grant in a GET request, and it never appears in a URL.
 */
export const orderConfirmationDocument = graphql(
    `
        query CheckoutOrderConfirmation($code: String!, $accessGrant: String) {
            checkoutOrder(code: $code, accessGrant: $accessGrant) {
                ...OrderFields
            }
            checkoutPaymentStatus(code: $code, accessGrant: $accessGrant) {
                status
                message
                continuationUrl
                verifiedAt
                amount
                currencyCode
                shippingServiceName
                reviewRequired
            }
        }
    `,
    [orderFieldsFragment],
);
