import { describe, expect, it } from 'vitest';

import { formatMoney, isWholeUnitCurrency, MoneyFormatError } from '../src/money';

describe('formatMoney', () => {
    it('shows IDR as amount / 100 with zero decimals', () => {
        expect(formatMoney(15000000, 'IDR')).toBe('Rp150.000');
        expect(formatMoney(12345600, 'IDR')).toBe('Rp123.456');
        expect(formatMoney(100, 'IDR')).toBe('Rp1');
        expect(formatMoney(0, 'IDR')).toBe('Rp0');
    });

    it('groups IDR by the shopper locale without changing the value', () => {
        expect(formatMoney(15000000, 'IDR', 'en-US')).toBe('Rp150,000');
    });

    it('shows a negative amount (a discount row) with a leading minus', () => {
        expect(formatMoney(-1500000, 'IDR')).toBe('-Rp15.000');
    });

    it('displays an unrounded AddingItems total at the nearest rupiah, half up', () => {
        expect(formatMoney(14999949, 'IDR')).toBe('Rp149.999');
        expect(formatMoney(14999950, 'IDR')).toBe('Rp150.000');
        expect(formatMoney(14999951, 'IDR')).toBe('Rp150.000');
    });

    it('shows other currencies as amount / 100 with two decimals', () => {
        expect(formatMoney(1049, 'USD', 'en-US')).toBe('$10.49');
        expect(formatMoney(1000, 'USD', 'en-US')).toBe('$10.00');
        expect(formatMoney(250050, 'SGD', 'en-SG')).toBe('$2,500.50');
    });

    it('selects the rule by currency, never by locale', () => {
        expect(formatMoney(1049, 'USD', 'id-ID')).toContain('10,49');
        expect(isWholeUnitCurrency('IDR')).toBe(true);
        expect(isWholeUnitCurrency('USD')).toBe(false);
        expect(isWholeUnitCurrency('JPY')).toBe(false);
    });

    it('refuses amounts that are not safe integers', () => {
        expect(() => formatMoney(1500.5, 'IDR')).toThrow(MoneyFormatError);
        expect(() => formatMoney(Number.NaN, 'IDR')).toThrow(MoneyFormatError);
        expect(() => formatMoney(Number.MAX_SAFE_INTEGER + 1, 'IDR')).toThrow(MoneyFormatError);
    });

    it('refuses a missing or malformed currency code', () => {
        expect(() => formatMoney(100, '')).toThrow(MoneyFormatError);
        expect(() => formatMoney(100, 'idr')).toThrow(MoneyFormatError);
    });
});
