import {
    formatMoney,
    getMessages,
    LOCALE_TAGS,
    type Locale,
    type NoticeCode,
} from '@getcart/storefront-core';
import type { ComponentProps, ReactNode } from 'react';

/** Shows an amount exactly as the Shop API returned it. */
export function Money({
    amount,
    currencyCode,
    locale,
}: {
    amount: number;
    currencyCode: string;
    locale: Locale;
}) {
    return <span className="tabular-nums">{formatMoney(amount, currencyCode, LOCALE_TAGS[locale])}</span>;
}

export function Notice({ code, locale }: { code: NoticeCode | undefined; locale: Locale }) {
    if (!code) return null;
    return (
        <p
            role="alert"
            data-testid="notice"
            data-notice={code}
            className="mb-6 rounded-brand border border-foreground/30 bg-foreground/5 px-4 py-3 text-sm"
        >
            {getMessages(locale).notices[code]}
        </p>
    );
}

export function Button({
    variant = 'primary',
    className = '',
    ...props
}: ComponentProps<'button'> & { variant?: 'primary' | 'secondary' }) {
    const styles =
        variant === 'primary'
            ? 'bg-brand text-brand-foreground hover:opacity-90'
            : 'border border-border bg-background text-foreground hover:bg-foreground/5';
    return (
        <button
            {...props}
            className={`inline-flex min-h-11 items-center justify-center rounded-brand px-5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
        />
    );
}

export function Field({ label, ...props }: ComponentProps<'input'> & { label: string }) {
    return (
        <label className="block text-sm">
            <span className="mb-1 block text-muted">{label}</span>
            <input
                {...props}
                className="min-h-11 w-full rounded-brand border border-border bg-background px-3 text-base text-foreground outline-none focus:border-brand"
            />
        </label>
    );
}

export function PageHeading({ children }: { children: ReactNode }) {
    return <h1 className="mb-8 font-display text-3xl">{children}</h1>;
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
    return <section className={`rounded-brand border border-border p-5 ${className}`}>{children}</section>;
}
