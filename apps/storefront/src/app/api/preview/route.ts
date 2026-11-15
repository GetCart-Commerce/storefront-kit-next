import { getBrandRuntime } from '../../../brand';

export const dynamic = 'force-dynamic';

/** Draft preview exists only with a CMS. With none configured this route answers 404. */
async function handle(request: Request) {
    const { content } = await getBrandRuntime();
    return content.handlers?.preview?.(request) ?? new Response('Not found', { status: 404 });
}

export { handle as GET, handle as POST };
