import { initGraphQLTada } from 'gql.tada';

import type { introspection } from './graphql-env.d.ts';

/**
 * Typed GraphQL against the committed enterprise Shop API schema (`schema/shop-api.graphql`).
 * A document that selects a field the schema does not have fails type checking.
 */
export const graphql = initGraphQLTada<{
    introspection: introspection;
    scalars: {
        ID: string;
        /** Integer in hundredths of the currency. Display only, via `formatMoney`. */
        Money: number;
        DateTime: string;
        JSON: unknown;
    };
}>();

export type { ResultOf, TadaDocumentNode, VariablesOf } from 'gql.tada';
