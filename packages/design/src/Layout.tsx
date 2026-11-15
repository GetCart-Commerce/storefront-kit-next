import { getMessages, routes, type SlotProps } from '@getcart/storefront-core';
import Link from 'next/link';

export function Layout({ brand, site, cartQuantity, children }: SlotProps['Layout']) {
    const messages = getMessages(brand.locale);
    return (
        <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
            {site.announcement ? (
                <p className="bg-brand px-4 py-2 text-center text-xs text-brand-foreground">
                    {site.announcement}
                </p>
            ) : null}
            <header className="border-b border-border">
                <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-4">
                    <Link href={routes.home} className="font-display text-xl" data-testid="brand-name">
                        {brand.logo ? (
                            <img src={brand.logo.src} alt={brand.logo.alt} className="h-8 w-auto" />
                        ) : (
                            brand.name
                        )}
                    </Link>
                    <nav className="flex items-center gap-5 text-sm">
                        {site.navigation.map(item => (
                            <Link key={item.href} href={item.href} className="hover:text-brand">
                                {item.label}
                            </Link>
                        ))}
                        <Link href={routes.cart} className="hover:text-brand" data-testid="cart-link">
                            {messages.nav.cart} (<span data-testid="cart-quantity">{cartQuantity}</span>)
                        </Link>
                    </nav>
                </div>
            </header>
            <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">{children}</main>
            <footer className="border-t border-border">
                <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-sm text-muted">
                    <p>{site.footer.note || brand.name}</p>
                    <nav className="flex gap-5">
                        {site.footer.links.map(item => (
                            <Link key={item.href} href={item.href} className="hover:text-foreground">
                                {item.label}
                            </Link>
                        ))}
                    </nav>
                </div>
            </footer>
        </div>
    );
}
