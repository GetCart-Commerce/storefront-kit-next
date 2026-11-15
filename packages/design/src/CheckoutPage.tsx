import {
    canContinueToPayment,
    fill,
    getMessages,
    routes,
    type CheckoutView,
    type Locale,
    type Messages,
    type PaymentUiRegistry,
    type SlotProps,
} from '@getcart/storefront-core';
import {
    continueToPaymentAction,
    refreshRatesAction,
    returnToCartAction,
    selectCourierServiceAction,
    setContactAction,
    setDeliveryAction,
} from '@getcart/storefront-core/next/actions';
import Link from 'next/link';

import { OrderSummary } from './OrderSummary';
import { paymentUi as defaultPaymentUi } from './payment-ui';
import { Button, Field, Money, Notice, PageHeading, Panel } from './primitives';

type Step<Name extends CheckoutView['step']> = Extract<CheckoutView, { step: Name }>;

const STEP_ORDER = ['contact', 'delivery', 'rates', 'payment'] as const;

function Steps({ current, messages }: { current: CheckoutView['step']; messages: Messages }) {
    return (
        <ol className="mb-8 flex flex-wrap gap-x-6 gap-y-2 text-sm" data-testid="checkout-steps">
            {STEP_ORDER.map((step, index) => (
                <li
                    key={step}
                    aria-current={step === current ? 'step' : undefined}
                    className={step === current ? 'font-medium text-brand' : 'text-muted'}
                >
                    {index + 1}. {messages.checkout.steps[step]}
                </li>
            ))}
        </ol>
    );
}

function ContactStep({ view, messages }: { view: Step<'contact'>; messages: Messages }) {
    const copy = messages.checkout.contact;
    const contact = view.order.contact;
    return (
        <form action={setContactAction} className="space-y-4" data-testid="contact-form">
            <h2 className="font-display text-xl">{copy.heading}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
                <Field
                    label={copy.firstName}
                    name="firstName"
                    autoComplete="given-name"
                    required
                    defaultValue={contact?.firstName}
                />
                <Field
                    label={copy.lastName}
                    name="lastName"
                    autoComplete="family-name"
                    required
                    defaultValue={contact?.lastName}
                />
            </div>
            <Field
                label={copy.email}
                name="emailAddress"
                type="email"
                autoComplete="email"
                required
                defaultValue={contact?.emailAddress}
            />
            <Field
                label={copy.phone}
                name="phoneNumber"
                type="tel"
                autoComplete="tel"
                required
                defaultValue={contact?.phoneNumber}
            />
            <Button type="submit" data-testid="contact-submit">
                {copy.submit}
            </Button>
        </form>
    );
}

function DeliveryStep({ view, messages }: { view: Step<'delivery'>; messages: Messages }) {
    const copy = messages.checkout.delivery;
    const searched = view.areaTerm.length >= 3;
    return (
        <div className="space-y-6">
            <h2 className="font-display text-xl">{copy.heading}</h2>
            {/* A GET form: the search term is not personal data, and the result is rendered by the server. */}
            <form
                method="get"
                action={routes.checkout}
                className="flex items-end gap-3"
                data-testid="area-search-form"
            >
                <input type="hidden" name="edit" value="delivery" />
                <div className="flex-1">
                    <Field
                        label={copy.searchLabel}
                        name="area"
                        placeholder={copy.searchHint}
                        minLength={3}
                        required
                        defaultValue={view.areaTerm}
                    />
                </div>
                <Button type="submit" variant="secondary" data-testid="area-search">
                    {copy.search}
                </Button>
            </form>
            {view.areaNotice ? (
                <p role="alert" className="text-sm" data-testid="area-notice">
                    {view.areaNotice.message}
                </p>
            ) : null}
            {searched && !view.areaNotice && view.areas.length === 0 ? (
                <p className="text-sm text-muted" data-testid="area-empty">
                    {copy.noResults}
                </p>
            ) : null}
            {view.areas.length > 0 ? (
                <form action={setDeliveryAction} className="space-y-4" data-testid="delivery-form">
                    <input type="hidden" name="areaTerm" value={view.areaTerm} />
                    <fieldset className="space-y-2">
                        <legend className="mb-2 text-sm text-muted">{copy.area}</legend>
                        {view.areas.map((area, index) => (
                            <label
                                key={area.id}
                                className="flex items-center gap-3 rounded-brand border border-border px-4 py-3 text-sm has-[:checked]:border-brand"
                            >
                                <input
                                    type="radio"
                                    name="areaId"
                                    value={area.id}
                                    required
                                    defaultChecked={index === 0}
                                    data-testid="area-option"
                                />
                                {area.name}
                            </label>
                        ))}
                    </fieldset>
                    <Field
                        label={copy.street}
                        name="streetLine1"
                        autoComplete="address-line1"
                        required
                        minLength={5}
                        defaultValue={view.order.address?.streetLine1}
                    />
                    <Field
                        label={copy.streetOptional}
                        name="streetLine2"
                        autoComplete="address-line2"
                        defaultValue={view.order.address?.streetLine2}
                    />
                    <Button type="submit" data-testid="delivery-submit">
                        {copy.submit}
                    </Button>
                </form>
            ) : null}
        </div>
    );
}

function RatesStep({ view, messages, locale }: { view: Step<'rates'>; messages: Messages; locale: Locale }) {
    const copy = messages.checkout.rates;
    const quoteCopy = messages.checkout.quote;
    const { quote, order } = view;

    // One explicit branch per quote state. None of them shows a price that the server did not quote.
    let body;
    switch (quote.status) {
        case 'available':
            body = (
                <ul className="space-y-3" data-testid="courier-services">
                    {quote.services.map(service => {
                        const selected = service.id === quote.selectedServiceId;
                        return (
                            <li
                                key={service.id}
                                className={`flex flex-wrap items-center justify-between gap-4 rounded-brand border px-4 py-3 ${selected ? 'border-brand' : 'border-border'}`}
                            >
                                <div>
                                    <p className="font-medium">{service.name}</p>
                                    {service.duration ? (
                                        <p className="text-sm text-muted">{service.duration}</p>
                                    ) : null}
                                </div>
                                <div className="flex items-center gap-4">
                                    <Money
                                        amount={service.priceWithTax}
                                        currencyCode={order.currencyCode}
                                        locale={locale}
                                    />
                                    {selected ? (
                                        <span className="text-sm text-brand" data-testid="service-selected">
                                            {copy.selected}
                                        </span>
                                    ) : (
                                        <form action={selectCourierServiceAction}>
                                            <input type="hidden" name="shippingMethodId" value={service.id} />
                                            <Button
                                                type="submit"
                                                variant="secondary"
                                                data-testid={`select-service-${service.name}`}
                                            >
                                                {copy.select}
                                            </Button>
                                        </form>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            );
            break;
        case 'not-ready':
            body = (
                <QuoteMessage status={quote.status} text={quoteCopy.notReady} refreshLabel={copy.refresh} />
            );
            break;
        case 'no-coverage':
            body = <QuoteMessage status={quote.status} text={quoteCopy.noCoverage} />;
            break;
        case 'expired':
            body = (
                <QuoteMessage status={quote.status} text={quoteCopy.expired} refreshLabel={copy.refresh} />
            );
            break;
        case 'unavailable':
            body = quote.retryable ? (
                <QuoteMessage
                    status={quote.status}
                    text={quoteCopy.unavailableRetry}
                    refreshLabel={copy.refresh}
                />
            ) : (
                <QuoteMessage status={quote.status} text={quoteCopy.unavailable} />
            );
            break;
    }

    return (
        <div className="space-y-6">
            <h2 className="font-display text-xl">{copy.heading}</h2>
            {body}
            {canContinueToPayment(quote) ? (
                <form action={continueToPaymentAction}>
                    <Button type="submit" data-testid="continue-to-payment">
                        {copy.continue}
                    </Button>
                </form>
            ) : quote.status === 'available' ? (
                <p className="text-sm text-muted">{copy.chooseFirst}</p>
            ) : null}
        </div>
    );
}

function QuoteMessage({
    status,
    text,
    refreshLabel,
}: {
    status: string;
    text: string;
    refreshLabel?: string;
}) {
    return (
        <Panel className="space-y-4">
            <p role="status" data-testid="quote-state" data-quote-status={status}>
                {text}
            </p>
            {refreshLabel ? (
                <form action={refreshRatesAction}>
                    <Button type="submit" variant="secondary" data-testid="refresh-rates">
                        {refreshLabel}
                    </Button>
                </form>
            ) : null}
        </Panel>
    );
}

function PaymentStep({
    view,
    messages,
    locale,
    registry,
}: {
    view: Step<'payment'>;
    messages: Messages;
    locale: Locale;
    registry: PaymentUiRegistry;
}) {
    const copy = messages.checkout.payment;
    const { order, quoteId } = view;
    const payable = quoteId ? view.paymentOptions.filter(option => registry.resolve(option.kind)) : [];
    return (
        <div className="space-y-6">
            <h2 className="font-display text-xl">{copy.heading}</h2>
            <Panel className="flex items-center justify-between gap-4">
                <span>{copy.finalTotal}</span>
                <strong className="text-xl" data-testid="final-total">
                    <Money amount={order.total} currencyCode={order.currencyCode} locale={locale} />
                </strong>
            </Panel>
            {payable.length === 0 ? (
                <p role="alert" data-testid="no-payment-method">
                    {copy.none}
                </p>
            ) : (
                payable.map(option => {
                    const PaymentUi = registry.resolve(option.kind)!;
                    return (
                        <div key={option.code} className="space-y-2">
                            {option.environment === 'test' ? (
                                <p className="text-sm text-muted" data-testid="sandbox-note">
                                    {copy.sandbox}
                                </p>
                            ) : null}
                            <PaymentUi
                                option={option}
                                confirmedTotal={order.total}
                                confirmedQuoteId={quoteId!}
                                submitLabel={fill(copy.payWith, { provider: option.providerName })}
                            />
                            <p className="text-sm text-muted">
                                {fill(copy.redirectNote, { provider: option.providerName })}
                            </p>
                        </div>
                    );
                })
            )}
            <form action={returnToCartAction}>
                <Button type="submit" variant="secondary" data-testid="change-order">
                    {copy.backToCart}
                </Button>
            </form>
        </div>
    );
}

function Review({
    view,
    messages,
}: {
    view: Step<'delivery'> | Step<'rates'> | Step<'payment'>;
    messages: Messages;
}) {
    const { contact, address } = view.order;
    const editable = view.step !== 'payment';
    const change = (target: string) =>
        editable ? (
            <Link
                href={`${routes.checkout}?edit=${target}`}
                className="text-brand underline"
                data-testid={`edit-${target}`}
            >
                {messages.checkout.edit}
            </Link>
        ) : null;
    return (
        <Panel className="space-y-3 text-sm">
            {contact ? (
                <div className="flex justify-between gap-4">
                    <p>
                        {contact.firstName} {contact.lastName} · {contact.emailAddress} ·{' '}
                        {contact.phoneNumber}
                    </p>
                    {change('contact')}
                </div>
            ) : null}
            {address && view.step !== 'delivery' ? (
                <div className="flex justify-between gap-4 border-t border-border pt-3">
                    <p data-testid="review-address">
                        {address.streetLine1}, {address.city}, {address.province} {address.postalCode}
                    </p>
                    {change('delivery')}
                </div>
            ) : null}
        </Panel>
    );
}

export function createCheckoutPage(registry: PaymentUiRegistry) {
    return function CheckoutPage({ brand, checkout, notice }: SlotProps['CheckoutPage']) {
        const messages = getMessages(brand.locale);
        const locale = brand.locale;
        if (checkout.step === 'empty' || checkout.step === 'in-progress') {
            return (
                <>
                    <PageHeading>{messages.checkout.title}</PageHeading>
                    <Notice code={notice} locale={locale} />
                    <p className="mb-6 text-muted" data-testid="checkout-empty">
                        {messages.checkout.empty}
                    </p>
                    <Link href={routes.products} className="underline">
                        {messages.cart.continueShopping}
                    </Link>
                </>
            );
        }
        return (
            <>
                <PageHeading>{messages.checkout.title}</PageHeading>
                <Steps current={checkout.step} messages={messages} />
                <Notice code={notice} locale={locale} />
                <div
                    className="grid gap-10 md:grid-cols-[1fr_22rem]"
                    data-testid={`checkout-step-${checkout.step}`}
                >
                    <div className="space-y-6">
                        {checkout.step === 'contact' ? null : <Review view={checkout} messages={messages} />}
                        {checkout.step === 'contact' ? (
                            <ContactStep view={checkout} messages={messages} />
                        ) : null}
                        {checkout.step === 'delivery' ? (
                            <DeliveryStep view={checkout} messages={messages} />
                        ) : null}
                        {checkout.step === 'rates' ? (
                            <RatesStep view={checkout} messages={messages} locale={locale} />
                        ) : null}
                        {checkout.step === 'payment' ? (
                            <PaymentStep
                                view={checkout}
                                messages={messages}
                                locale={locale}
                                registry={registry}
                            />
                        ) : null}
                    </div>
                    <aside>
                        <OrderSummary order={checkout.order} locale={locale} />
                    </aside>
                </div>
            </>
        );
    };
}

export const CheckoutPage = createCheckoutPage(defaultPaymentUi);
