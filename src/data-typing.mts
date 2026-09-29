/*
Typed element data (round 140, PLAN.md item 45): the helper types that
let `cytoscape<NodeData, EdgeData>( … )` flow an application's data shapes
through `data()`, the collections, the events, the add/patch/load/clone
payloads and the stylesheet's field references.

**The untyped rule.**  Every type parameter defaults to `any`, and `any`
here means "no generic was given": each helper below maps it back to
exactly the type that position had before round 140 (`unknown` for a read,
`string` for a key, `Record<string, unknown>` for a patch).  So a program
that never names a generic sees today's types, and the plain spellings
`Core` and `Collection` *are* the untyped instantiations — a typed value
is assignable to them, and every internal helper that takes or returns a
bare `Collection` keeps working unchanged.

Types only; nothing here exists at run time.
*/

/**
 * The default of every data type parameter: "no generic was given".  It
 * is `any` so that the untyped instantiations (`Core`, `Collection`) and
 * the typed ones assign to each other both ways — the store's internals
 * build bare collections and hand them out through typed signatures —
 * and the helpers below turn it back into each position's pre-140 type,
 * so no untyped read ever surfaces as `any`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the untyped sentinel, see above
export type Untyped = any;

/**
 * True when `T` is `any` — the untyped default (a generic was not given).
 * `0 extends 1 & T` holds for `any` alone.
 */
export type IsUntyped<T> = 0 extends 1 & T ? true : false;

/**
 * What `data()` reads as a whole object: the application's shape, or
 * `unknown` untyped (today's return).
 */
export type DataOf<D> = IsUntyped<D> extends true ? unknown : D;

/**
 * The keys a field reference may name: the shape's string keys plus the
 * first-class `'id'` (and, for edges, `'source'`/`'target'`; for nodes
 * `'parent'` — synthesized on read).  Untyped: any string.
 */
export type DataKey<D> =
  IsUntyped<D> extends true
    ? string
    : (D extends unknown ? keyof D & string : never) | FirstClassKey;

/** The first-class keys every element answers, synthesized on read. */
export type FirstClassKey = 'id' | 'source' | 'target' | 'parent';

/**
 * The value `data( key )` reads for key `K`: the shape's field type (a
 * union across a mixed collection's shapes), `string` for the first-class
 * `'id'`, and `unknown` untyped.  A read can always miss — an empty
 * collection or a stale handle answers `undefined` — so the field type
 * is widened with it, as today's `unknown` already was.
 */
export type DataValue<D, K> =
  IsUntyped<D> extends true
    ? unknown
    : K extends FirstClassKey
      ? string | undefined
      :
          | (D extends unknown ? (K extends keyof D ? D[K] : never) : never)
          | undefined;

/**
 * A `data( patch )` write: some of the shape's fields, or any record of
 * keys untyped (today's parameter).
 */
export type DataPatch<D> =
  IsUntyped<D> extends true ? Record<string, unknown> : Partial<D>;
