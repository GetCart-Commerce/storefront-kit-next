import { getBrandRuntime } from '../../../brand';

export const dynamic = 'force-dynamic';

/** Publication notifications exist only with a CMS. With none configured this route answers 404. */
export async function POST(request: Request) {
    const { content } = await getBrandRuntime();
    return content.handlers?.publication?.(request) ?? new Response('Not found', { status: 404 });
}
