import { GraphQLSchema } from '../type/schema';

export interface CompareOptions {
  locales?: string | Array<string>;
  options?: Intl.CollatorOptions;
}

/**
 * Sort GraphQLSchema.
 *
 * This function returns a sorted copy of the given GraphQLSchema.
 */
export function lexicographicSortSchema(
  schema: GraphQLSchema,
  compareOptions?: CompareOptions,
): GraphQLSchema;
