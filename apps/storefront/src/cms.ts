import type { CmsAdapterFactory } from '@getcart/storefront-core';

/**
 * The CMS adapter this release ships. There is none yet: the Payload adapter is a later slice.
 * When it exists it is wired here and nowhere else, so no commerce, checkout or design code
 * ever imports it. A deployment turns it on by setting the CMS_* environment variables.
 */
export const cmsAdapter: CmsAdapterFactory | undefined = undefined;
