/**
 * Money display. The Shop API is the money authority: every amount is an integer in hundredths
 * of its currency (Rp150,000 is 15000000) and is read next to its `currencyCode`. This module
 * only formats. It never adds, discounts or rounds a charge.
 */

/** Only IDR is a whole-unit currency. The rule follows the amount's currency, never the locale. */
const WHOLE_UNIT_CURRENCIES = new Set(['IDR']);

export function isWholeUnitCurrency(currencyCode: string): boolean {
    return WHOLE_UNIT_CURRENCIES.has(currencyCode);
}

export class MoneyFormatError extends Error {}

/**
 * Formats an API amount for display.
 *
 * - IDR: amount ÷ 100 with zero decimals, e.g. `Rp150.000`.
 * - Every other currency: amount ÷ 100 with two decimals.
 *
 * In `AddingItems` an IDR total may still carry a fraction of a rupiah (the payable is final only
 * in `ArrangingPayment`). Zero-decimal display then shows the nearest rupiah, half up, which is
 * the same rule the server applies to the payable.
 */
export function formatMoney(amount: number, currencyCode: string, locale = 'id-ID'): string {
    if (!Number.isSafeInteger(amount)) {
        throw new MoneyFormatError(
            `Money amount must be a safe integer in hundredths, got ${String(amount)}.`,
        );
    }
    if (!/^[A-Z]{3}$/.test(currencyCode)) {
        throw new MoneyFormatError(`Unknown currency code "${currencyCode}".`);
    }
    const sign = amount < 0 ? '-' : '';
    const major = Math.abs(amount) / 100;
    if (isWholeUnitCurrency(currencyCode)) {
        const digits = new Intl.NumberFormat(locale, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
            roundingMode: 'halfExpand',
        }).format(major);
        return `${sign}Rp${digits}`;
    }
    const formatted = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currencyCode,
        currencyDisplay: 'narrowSymbol',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(major);
    return `${sign}${formatted}`;
}
