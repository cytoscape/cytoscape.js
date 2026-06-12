import type { Query } from './type.mjs';

/**
 * Make a new query object
 *
 * @prop type {Type} The type enum (int) of the query
 * @prop checks List of checks to make against an ele to test for a match
 */
let newQuery = function(): Query {
  return {
    checks: []
  };
};

export default newQuery;
