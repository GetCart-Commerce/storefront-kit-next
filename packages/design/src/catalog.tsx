import {
    getMessages,
    routes,
    type Locale,
    type ProductCard,
    type Section,
    type SlotProps,
} from '@getcart/storefront-core';
import { addToCartAction } from '@getcart/storefront-core/next/actions';
import Link from 'next/link';

import { Button, Money, Notice, PageHeading } from './primitives';

export function ProductGrid({ products, locale }: { products: ProductCard[]; locale: Locale }) {
    const messages = getMessages(locale);
    if (products.length === 0) return <p className="text-muted">{messages.product.empty}</p>;
    return (
        <ul className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {products.map(product => (
                <li key={product.productId}>
                    <Link
                        href={routes.product(product.slug)}
                        className="group block"
                        data-testid="product-card"
                    >
                        <div className="mb-3 aspect-[3/4] overflow-hidden rounded-brand bg-foreground/5">
                            {product.image ? (
                                <img
                                    src={product.image}
                                    alt=""
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                />
                            ) : null}
                        </div>
                        <p className="text-sm group-hover:text-brand">{product.name}</p>
                        <p className="text-sm text-muted">
                            {product.priceFrom !== product.priceTo ? `${messages.product.from} ` : ''}
                            <Money
                                amount={product.priceFrom}
                                currencyCode={product.currencyCode}
                                locale={locale}
                            />
                            {product.inStock ? '' : ` · ${messages.product.outOfStock}`}
                        </p>
                    </Link>
                </li>
            ))}
        </ul>
    );
}

/** Renders a page composed from Sections. Product data in a Section always comes from Vendure. */
export function Sections({
    sections,
    products,
    locale,
}: {
    sections: Section[];
    products: ProductCard[];
    locale: Locale;
}) {
    return (
        <div className="space-y-14">
            {sections.map((section, index) => {
                switch (section.type) {
                    case 'hero':
                        return (
                            <section
                                key={index}
                                className="rounded-brand bg-foreground/5 px-6 py-16 text-center"
                                data-testid="section-hero"
                            >
                                <h1 className="font-display text-4xl md:text-5xl">{section.heading}</h1>
                                {section.text ? (
                                    <p className="mx-auto mt-4 max-w-xl text-muted">{section.text}</p>
                                ) : null}
                                {section.cta ? (
                                    <Link
                                        href={section.cta.href}
                                        className="mt-8 inline-flex min-h-11 items-center rounded-brand bg-brand px-6 text-sm font-medium text-brand-foreground"
                                    >
                                        {section.cta.label}
                                    </Link>
                                ) : null}
                            </section>
                        );
                    case 'product-grid':
                        return (
                            <section key={index} data-testid="section-product-grid">
                                {section.heading ? (
                                    <h2 className="mb-6 font-display text-2xl">{section.heading}</h2>
                                ) : null}
                                <ProductGrid products={products.slice(0, section.take)} locale={locale} />
                            </section>
                        );
                    case 'rich-text':
                        return (
                            <section
                                key={index}
                                className="mx-auto max-w-2xl"
                                data-testid="section-rich-text"
                            >
                                {section.heading ? (
                                    <h2 className="mb-4 font-display text-2xl">{section.heading}</h2>
                                ) : null}
                                {section.paragraphs.map((paragraph, line) => (
                                    <p key={line} className="mb-4 leading-relaxed text-muted">
                                        {paragraph}
                                    </p>
                                ))}
                            </section>
                        );
                }
            })}
        </div>
    );
}

export function HomePage({ brand, site, page, products }: SlotProps['HomePage']) {
    if (page) return <Sections sections={page.sections} products={products} locale={brand.locale} />;
    return (
        <>
            <PageHeading>{site.seo.defaultTitle}</PageHeading>
            <ProductGrid products={products} locale={brand.locale} />
        </>
    );
}

export function ContentPage({ brand, page, products }: SlotProps['ContentPage']) {
    return <Sections sections={page.sections} products={products} locale={brand.locale} />;
}

export function ProductListPage({ brand, products }: SlotProps['ProductListPage']) {
    return (
        <>
            <PageHeading>{getMessages(brand.locale).nav.products}</PageHeading>
            <ProductGrid products={products} locale={brand.locale} />
        </>
    );
}

export function ProductPage({ brand, product, notice }: SlotProps['ProductPage']) {
    const messages = getMessages(brand.locale);
    const purchasable = product.variants.filter(variant => variant.purchasable);
    return (
        <div className="grid gap-10 md:grid-cols-2">
            <div className="aspect-[3/4] overflow-hidden rounded-brand bg-foreground/5">
                {product.images[0] ? (
                    <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover" />
                ) : null}
            </div>
            <div>
                <Notice code={notice} locale={brand.locale} />
                <h1 className="font-display text-3xl" data-testid="product-name">
                    {product.name}
                </h1>
                <div
                    className="mt-4 space-y-3 leading-relaxed text-muted"
                    // The description is rich text written by the Brand admin in Vendure.
                    dangerouslySetInnerHTML={{ __html: product.descriptionHtml }}
                />
                {purchasable.length === 0 ? (
                    <p className="mt-8 text-sm" data-testid="out-of-stock">
                        {messages.product.outOfStock}
                    </p>
                ) : (
                    <form action={addToCartAction} className="mt-8 space-y-5" data-testid="add-to-cart-form">
                        <input type="hidden" name="productSlug" value={product.slug} />
                        <input type="hidden" name="quantity" value="1" />
                        <fieldset className="space-y-2">
                            <legend className="mb-2 text-sm text-muted">{messages.product.variant}</legend>
                            {product.variants.map(variant => (
                                <label
                                    key={variant.id}
                                    className="flex items-center justify-between gap-4 rounded-brand border border-border px-4 py-3 text-sm has-[:checked]:border-brand has-[:disabled]:opacity-50"
                                >
                                    <span className="flex items-center gap-3">
                                        <input
                                            type="radio"
                                            name="variantId"
                                            value={variant.id}
                                            required
                                            disabled={!variant.purchasable}
                                            defaultChecked={variant.id === purchasable[0]?.id}
                                            data-testid={`variant-${variant.sku}`}
                                        />
                                        {variant.name}
                                        {variant.purchasable ? '' : ` · ${messages.product.outOfStock}`}
                                    </span>
                                    <Money
                                        amount={variant.priceWithTax}
                                        currencyCode={variant.currencyCode}
                                        locale={brand.locale}
                                    />
                                </label>
                            ))}
                        </fieldset>
                        <Button type="submit" data-testid="add-to-cart">
                            {messages.product.addToCart}
                        </Button>
                    </form>
                )}
            </div>
        </div>
    );
}
