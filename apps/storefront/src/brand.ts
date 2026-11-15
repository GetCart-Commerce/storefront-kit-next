import 'server-only';

import { brands } from '@getcart/storefront-brands';
import {
    ConfigError,
    parseNotice,
    resolveSlot,
    toBrandInfo,
    type BrandDefinition,
    type BrandInfo,
    type ContentSource,
    type NoticeCode,
    type SlotName,
} from '@getcart/storefront-core';
import { getContentSource, getEnv } from '@getcart/storefront-core/next';
import { defaultSlots } from '@getcart/storefront-design';

import { cmsAdapter } from './cms';

let loading: Promise<BrandDefinition> | undefined;

/** The Brand this deployment serves, chosen by `BRAND_ID`. Never by a shopper or a URL. */
export function getBrand(): Promise<BrandDefinition> {
    loading ??= (async () => {
        const { brandId } = getEnv();
        const load = brands[brandId];
        if (!load) {
            throw new ConfigError(
                `BRAND_ID "${brandId}" is not a Brand in this release. Known Brands: ${Object.keys(brands).join(', ')}.`,
            );
        }
        return (await load()).default;
    })();
    return loading;
}

export interface BrandRuntime {
    brand: BrandDefinition;
    info: BrandInfo;
    content: ContentSource;
}

export async function getBrandRuntime(): Promise<BrandRuntime> {
    const brand = await getBrand();
    return { brand, info: toBrandInfo(brand), content: getContentSource(brand, cmsAdapter) };
}

/** The component for a Slot: the Brand design's when it has one, otherwise the Default design's. */
export function slot<Name extends SlotName>(brand: BrandDefinition, name: Name) {
    return resolveSlot(brand, defaultSlots, name);
}

type SearchParams = Record<string, string | string[] | undefined>;

export function firstParam(params: SearchParams, name: string): string | undefined {
    const value = params[name];
    return typeof value === 'string' ? value : undefined;
}

/** Only known notice codes are read from a URL. */
export function noticeParam(params: SearchParams): NoticeCode | undefined {
    return parseNotice(firstParam(params, 'notice'));
}
