import { print } from 'graphql';

import type { TadaDocumentNode } from '../shop/graphql';

const CHANNEL_TOKEN_HEADER = 'vendure-token';
const AUTH_TOKEN_HEADER = 'vendure-auth-token';

export class ShopApiError extends Error {
    constructor(
        message: string,
        readonly code?: string,
    ) {
        super(message);
    }
}

export interface ShopClientOptions {
    apiUrl: string;
    /** The Channel this request is bound to. Chosen by deployment configuration only. */
    channelToken: string;
    /** Reads the shopper's session token from server-side storage. */
    getSessionToken: () => Promise<string | undefined>;
    /** Stores a session token the Shop API issued. Called from server actions. */
    setSessionToken: (token: string) => Promise<void>;
    fetch?: typeof fetch;
    timeoutMs?: number;
}

export interface RequestOptions {
    /**
     * Sends the shopper's session. Such a response is personal: it is never cached.
     * Without it the request is anonymous and may be cached per Channel.
     */
    session?: boolean;
    /** Cache an anonymous catalogue read for this many seconds. Ignored when `session` is set. */
    revalidate?: number;
    tags?: string[];
}

export interface ShopClient {
    request<TResult, TVariables>(
        document: TadaDocumentNode<TResult, TVariables>,
        variables: TVariables,
        options?: RequestOptions,
    ): Promise<TResult>;
}

interface GraphQLResponse<T> {
    data?: T | null;
    errors?: Array<{ message: string; extensions?: { code?: string } }>;
}

/**
 * Server-only Shop API transport. Every call is a POST and carries the `vendure-token` Channel
 * header. Session tokens travel as bearer tokens between this server and the Shop API and are
 * never sent to the browser as anything but an HttpOnly cookie.
 *
 * Verified against https://docs.vendure.io/current/framework/storefront/connect-api and
 * enterprise's `tokenMethod: ['bearer', 'cookie']`.
 */
export function createShopClient(options: ShopClientOptions): ShopClient {
    const doFetch = options.fetch ?? fetch;
    const timeoutMs = options.timeoutMs ?? 20_000;

    return {
        async request(document, variables, requestOptions = {}) {
            const headers: Record<string, string> = {
                'content-type': 'application/json',
                [CHANNEL_TOKEN_HEADER]: options.channelToken,
            };
            const personal = requestOptions.session === true;
            if (personal) {
                const token = await options.getSessionToken();
                if (token) headers.authorization = `Bearer ${token}`;
            }

            const cache: RequestInit & { next?: { revalidate: number; tags?: string[] } } =
                personal || requestOptions.revalidate === undefined
                    ? { cache: 'no-store' }
                    : {
                          next: {
                              revalidate: requestOptions.revalidate,
                              ...(requestOptions.tags ? { tags: requestOptions.tags } : {}),
                          },
                      };

            let response: Response;
            try {
                response = await doFetch(options.apiUrl, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ query: print(document), variables: variables ?? {} }),
                    signal: AbortSignal.timeout(timeoutMs),
                    ...cache,
                });
            } catch {
                // The cause can name the URL and headers. Report only that the call did not complete.
                throw new ShopApiError('The Shop API could not be reached.', 'NETWORK');
            }
            if (!response.ok) throw new ShopApiError(`The Shop API responded ${response.status}.`, 'HTTP');

            let body: GraphQLResponse<unknown>;
            try {
                body = (await response.json()) as GraphQLResponse<unknown>;
            } catch {
                throw new ShopApiError('The Shop API returned an unreadable response.', 'MALFORMED');
            }
            if (body.errors?.length) {
                const first = body.errors[0];
                throw new ShopApiError(
                    first?.message ?? 'The Shop API returned an error.',
                    first?.extensions?.code,
                );
            }
            if (body.data === undefined || body.data === null) {
                throw new ShopApiError('The Shop API returned no data.', 'MALFORMED');
            }

            if (personal) {
                const issued = response.headers.get(AUTH_TOKEN_HEADER);
                if (issued) await options.setSessionToken(issued);
            }
            return body.data as never;
        },
    };
}
