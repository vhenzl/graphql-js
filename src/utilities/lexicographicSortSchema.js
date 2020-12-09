import objectValues from '../polyfills/objectValues';

import type { ObjMap } from '../jsutils/ObjMap';
import inspect from '../jsutils/inspect';
import invariant from '../jsutils/invariant';
import keyValMap from '../jsutils/keyValMap';

import type {
  GraphQLType,
  GraphQLNamedType,
  GraphQLFieldConfigMap,
  GraphQLFieldConfigArgumentMap,
  GraphQLInputFieldConfigMap,
} from '../type/definition';
import { GraphQLSchema } from '../type/schema';
import { GraphQLDirective } from '../type/directives';
import { isIntrospectionType } from '../type/introspection';
import {
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLEnumType,
  GraphQLInputObjectType,
  isListType,
  isNonNullType,
  isScalarType,
  isObjectType,
  isInterfaceType,
  isUnionType,
  isEnumType,
  isInputObjectType,
} from '../type/definition';

type CompareOptions = {|
  locales?: string | Array<string>,
  options?: Intl$CollatorOptions,
|};

/**
 * Sort GraphQLSchema.
 *
 * This function returns a sorted copy of the given GraphQLSchema.
 */
export function lexicographicSortSchema(
  schema: GraphQLSchema,
  compareOptions?: CompareOptions,
): GraphQLSchema {
  const schemaConfig = schema.toConfig();
  const typeMap = keyValMap(
    sortByName(schemaConfig.types, compareOptions),
    (type) => type.name,
    sortNamedType,
  );

  return new GraphQLSchema({
    ...schemaConfig,
    types: objectValues(typeMap),
    directives: sortByName(schemaConfig.directives, compareOptions).map(
      sortDirective,
    ),
    query: replaceMaybeType(schemaConfig.query),
    mutation: replaceMaybeType(schemaConfig.mutation),
    subscription: replaceMaybeType(schemaConfig.subscription),
  });

  function replaceType<T: GraphQLType>(type: T): T {
    if (isListType(type)) {
      // $FlowFixMe[incompatible-return]
      return new GraphQLList(replaceType(type.ofType));
    } else if (isNonNullType(type)) {
      // $FlowFixMe[incompatible-return]
      return new GraphQLNonNull(replaceType(type.ofType));
    }
    return replaceNamedType(type);
  }

  function replaceNamedType<T: GraphQLNamedType>(type: T): T {
    return ((typeMap[type.name]: any): T);
  }

  function replaceMaybeType<T: ?GraphQLNamedType>(maybeType: T): T {
    return maybeType && replaceNamedType(maybeType);
  }

  function sortDirective(directive: GraphQLDirective) {
    const config = directive.toConfig();
    return new GraphQLDirective({
      ...config,
      locations: sortBy(config.locations, (x) => x, compareOptions),
      args: sortArgs(config.args),
    });
  }

  function sortArgs(args: GraphQLFieldConfigArgumentMap) {
    return sortObjMap(
      args,
      (arg) => ({
        ...arg,
        type: replaceType(arg.type),
      }),
      compareOptions,
    );
  }

  function sortFields(fieldsMap: GraphQLFieldConfigMap<mixed, mixed>) {
    return sortObjMap(
      fieldsMap,
      (field) => ({
        ...field,
        type: replaceType(field.type),
        args: sortArgs(field.args),
      }),
      compareOptions,
    );
  }

  function sortInputFields(fieldsMap: GraphQLInputFieldConfigMap) {
    return sortObjMap(
      fieldsMap,
      (field) => ({
        ...field,
        type: replaceType(field.type),
      }),
      compareOptions,
    );
  }

  function sortTypes<T: GraphQLNamedType>(arr: $ReadOnlyArray<T>): Array<T> {
    return sortByName(arr, compareOptions).map(replaceNamedType);
  }

  function sortNamedType<T: GraphQLNamedType>(type: T) {
    if (isScalarType(type) || isIntrospectionType(type)) {
      return type;
    }
    if (isObjectType(type)) {
      const config = type.toConfig();
      return new GraphQLObjectType({
        ...config,
        interfaces: () => sortTypes(config.interfaces),
        fields: () => sortFields(config.fields),
      });
    }
    if (isInterfaceType(type)) {
      const config = type.toConfig();
      return new GraphQLInterfaceType({
        ...config,
        interfaces: () => sortTypes(config.interfaces),
        fields: () => sortFields(config.fields),
      });
    }
    if (isUnionType(type)) {
      const config = type.toConfig();
      return new GraphQLUnionType({
        ...config,
        types: () => sortTypes(config.types),
      });
    }
    if (isEnumType(type)) {
      const config = type.toConfig();
      return new GraphQLEnumType({
        ...config,
        values: sortObjMap(config.values, undefined, compareOptions),
      });
    }
    // istanbul ignore else (See: 'https://github.com/graphql/graphql-js/issues/2618')
    if (isInputObjectType(type)) {
      const config = type.toConfig();
      return new GraphQLInputObjectType({
        ...config,
        fields: () => sortInputFields(config.fields),
      });
    }

    // istanbul ignore next (Not reachable. All possible types have been considered)
    invariant(false, 'Unexpected type: ' + inspect((type: empty)));
  }
}

function sortObjMap<T, R>(
  map: ObjMap<T>,
  sortValueFn?: (T) => R,
  compareOptions?: CompareOptions,
): ObjMap<R> {
  const sortedMap = Object.create(null);
  const sortedKeys = sortBy(Object.keys(map), (x) => x, compareOptions);
  for (const key of sortedKeys) {
    const value = map[key];
    sortedMap[key] = sortValueFn ? sortValueFn(value) : value;
  }
  return sortedMap;
}

function sortByName<T: { +name: string, ... }>(
  array: $ReadOnlyArray<T>,
  compareOptions?: CompareOptions,
): Array<T> {
  return sortBy(array, (obj) => obj.name, compareOptions);
}

function sortBy<T>(
  array: $ReadOnlyArray<T>,
  mapToKey: (T) => string,
  compareOptions?: CompareOptions,
): Array<T> {
  return array.slice().sort((obj1, obj2) => {
    const key1 = mapToKey(obj1);
    const key2 = mapToKey(obj2);
    return key1.localeCompare(
      key2,
      compareOptions?.locales,
      compareOptions?.options,
    );
  });
}
