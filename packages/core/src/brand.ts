import type { ComponentType, ReactNode } from 'react';

import { ConfigError } from './config';
import type { LocalContent } from './content/source';
import type { Page, SiteContent } from './content/types';
import type { Locale } from './i18n';
import type { NoticeCode } from './checkout/notices';
import { isTier, tierFeatures, type Tier } from './tier';
import type { CheckoutView, OrderConfirmationView, OrderView, ProductCard, ProductView } from './types';

/** Theme tokens. A Starter Brand changes these and its logo, and nothing else. */
export interface ThemeTokens {
    colors: {
        background: string;
        foreground: string;
        muted: string;
        border: string;
        brand: string;
        brandForeground: string;
    };
    /** Corner radius of buttons, inputs and cards, e.g. `0px` or `0.5rem`. */
    radius: string;
    fontSans: string;
    fontDisplay: string;
}

/**
 * Slots: the named places where a Brand design replaces a Default design component. Each Slot
 * receives view models from the Storefront core and uses the core's server actions, so a
 * replacement never copies commerce or checkout logic.
 */
export interface SlotProps {
    Layout: { brand: BrandInfo; site: SiteContent; cartQuantity: number; children: ReactNode };
    HomePage: { brand: BrandInfo; site: SiteContent; page: Page | null; products: ProductCard[] };
    ProductListPage: { brand: BrandInfo; products: ProductCard[] };
    ProductPage: { brand: BrandInfo; product: ProductView; notice: NoticeCode | undefined };
    CartPage: { brand: BrandInfo; order: OrderView | undefined; notice: NoticeCode | undefined };
    CheckoutPage: { brand: BrandInfo; checkout: CheckoutView; notice: NoticeCode | undefined };
    OrderPage: { brand: BrandInfo; confirmation: OrderConfirmationView | undefined };
    ContentPage: { brand: BrandInfo; page: Page; products: ProductCard[] };
}

export type SlotName = keyof SlotProps;
export type Slots = { [Name in SlotName]: ComponentType<SlotProps[Name]> };

/** What a design needs to know about the Brand it renders. */
export interface BrandInfo {
    id: string;
    name: string;
    tier: Tier;
    locale: Locale;
    logo: { src: string; alt: string } | undefined;
}

export interface BrandDefinition extends BrandInfo {
    theme: ThemeTokens;
    /** Local content files. Used as the content source, or as the fallback behind a CMS. */
    content: LocalContent;
    /** Brand design: replacements for Default design components. Enterprise Tier only. */
    slots?: Partial<Slots>;
}

/** A token value is copied into a stylesheet, so it may not close the rule or open a new one. */
const SAFE_TOKEN = /^[^;{}<>\\]{1,200}$/;

export function defineBrand(definition: BrandDefinition): BrandDefinition {
    const problems: string[] = [];
    if (!/^[a-z][a-z0-9-]*$/.test(definition.id))
        problems.push('id must be lower-case letters, digits and dashes');
    if (!isTier(definition.tier)) problems.push(`tier "${String(definition.tier)}" is not a known Tier`);
    const tokens: Array<[string, string]> = [
        ...Object.entries(definition.theme.colors).map(([name, value]): [string, string] => [
            `colors.${name}`,
            value,
        ]),
        ['radius', definition.theme.radius],
        ['fontSans', definition.theme.fontSans],
        ['fontDisplay', definition.theme.fontDisplay],
    ];
    for (const [name, value] of tokens) {
        if (!SAFE_TOKEN.test(value)) problems.push(`theme.${name} is not a safe CSS value`);
    }
    if (isTier(definition.tier)) {
        const features = tierFeatures(definition.tier);
        const slots = Object.keys(definition.slots ?? {});
        if (slots.length > 0 && !features.brandDesign) {
            problems.push(`the ${definition.tier} Tier cannot replace components (${slots.join(', ')})`);
        }
        if ((definition.content.pages?.length ?? 0) > 0 && !features.sections) {
            problems.push(`the ${definition.tier} Tier cannot compose pages from Sections`);
        }
    }
    if (problems.length > 0) {
        throw new ConfigError(`Brand "${definition.id}" is invalid:\n- ${problems.join('\n- ')}`);
    }
    return definition;
}

/** The Brand's tokens as CSS custom properties, read by the Default design and any Brand design. */
export function themeToCss(theme: ThemeTokens): string {
    const { colors } = theme;
    return [
        ':root{',
        `--gc-background:${colors.background};`,
        `--gc-foreground:${colors.foreground};`,
        `--gc-muted:${colors.muted};`,
        `--gc-border:${colors.border};`,
        `--gc-brand:${colors.brand};`,
        `--gc-brand-foreground:${colors.brandForeground};`,
        `--gc-radius:${theme.radius};`,
        `--gc-font-sans:${theme.fontSans};`,
        `--gc-font-display:${theme.fontDisplay};`,
        '}',
    ].join('');
}

export function toBrandInfo(brand: BrandDefinition): BrandInfo {
    return { id: brand.id, name: brand.name, tier: brand.tier, locale: brand.locale, logo: brand.logo };
}

/** Resolves a Slot: the Brand design's component when it has one, otherwise the Default design's. */
export function resolveSlot<Name extends SlotName>(
    brand: BrandDefinition,
    defaults: Slots,
    name: Name,
): ComponentType<SlotProps[Name]> {
    return (brand.slots?.[name] as ComponentType<SlotProps[Name]> | undefined) ?? defaults[name];
}
