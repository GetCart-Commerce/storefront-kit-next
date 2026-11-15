import { getMessages, type SlotProps } from '@getcart/storefront-core';
import { addToCartAction } from '@getcart/storefront-core/next/actions';
import { Money, Notice } from '@getcart/storefront-design';

/**
 * Kanvas's own product page: a Brand design filling the `ProductPage` Slot. The layout is
 * bespoke; the data is the core's `ProductView` and the form posts to the core's
 * `addToCartAction`, so stock rules, cart handling and checkout are the shared ones.
 */
export function KanvasProductPage({ brand, product, notice }: SlotProps['ProductPage']) {
    const messages = getMessages(brand.locale);
    return (
        <article className="mx-auto max-w-3xl" data-testid="kanvas-product-page">
            <p className="text-xs uppercase tracking-[0.3em] text-muted">Kanvas Studio · small run</p>
            <h1 className="mt-3 font-display text-5xl uppercase tracking-tight" data-testid="product-name">
                {product.name}
            </h1>
            <Notice code={notice} locale={brand.locale} />
            <div
                className="mt-6 border-l-4 border-brand pl-5 text-lg leading-relaxed"
                dangerouslySetInnerHTML={{ __html: product.descriptionHtml }}
            />
            <ul className="mt-10 divide-y divide-border border-y border-border">
                {product.variants.map(variant => (
                    <li key={variant.id} className="flex items-center justify-between gap-6 py-4">
                        <div>
                            <p className="font-medium">{variant.name}</p>
                            <p className="text-sm text-muted">
                                <Money
                                    amount={variant.priceWithTax}
                                    currencyCode={variant.currencyCode}
                                    locale={brand.locale}
                                />
                            </p>
                        </div>
                        {variant.purchasable ? (
                            <form action={addToCartAction}>
                                <input type="hidden" name="productSlug" value={product.slug} />
                                <input type="hidden" name="variantId" value={variant.id} />
                                <input type="hidden" name="quantity" value="1" />
                                <button
                                    type="submit"
                                    data-testid={`add-${variant.sku}`}
                                    className="min-h-11 border-2 border-foreground px-6 text-sm font-semibold uppercase tracking-widest hover:bg-foreground hover:text-background"
                                >
                                    {messages.product.addToCart}
                                </button>
                            </form>
                        ) : (
                            <span className="text-sm text-muted">{messages.product.outOfStock}</span>
                        )}
                    </li>
                ))}
            </ul>
        </article>
    );
}
