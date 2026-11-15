import { getEnv } from '@getcart/storefront-core/next';

import { getBrandRuntime } from '../../../brand';

export const dynamic = 'force-dynamic';

/** Liveness and configuration check for the deployment. It reveals no secret. */
export async function GET() {
    try {
        const { info, content } = await getBrandRuntime();
        return Response.json({
            status: 'ok',
            brand: info.id,
            tier: info.tier,
            contentSource: content.kind,
            cms: Boolean(getEnv().cms),
        });
    } catch (error) {
        return Response.json(
            { status: 'error', message: error instanceof Error ? error.message : 'Invalid configuration' },
            { status: 500 },
        );
    }
}
