/**
 * The one switch for what differs between GetCart offerings. Every Tier runs the same build; a
 * Tier only decides which Extension points a Brand may use.
 */
export const TIERS = ['starter', 'pro', 'enterprise'] as const;
export type Tier = (typeof TIERS)[number];

export interface TierFeatures {
    /** Compose pages from Sections, from local content or a CMS. */
    sections: boolean;
    /** Replace Default design components and pages through Slots. */
    brandDesign: boolean;
}

const FEATURES: Record<Tier, TierFeatures> = {
    starter: { sections: false, brandDesign: false },
    pro: { sections: true, brandDesign: false },
    enterprise: { sections: true, brandDesign: true },
};

export function tierFeatures(tier: Tier): TierFeatures {
    return FEATURES[tier];
}

export function isTier(value: unknown): value is Tier {
    return typeof value === 'string' && (TIERS as readonly string[]).includes(value);
}
