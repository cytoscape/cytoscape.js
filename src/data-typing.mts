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

**Why the test is on the instance's shapes, not the collection's.**  A
`Collection<NodeData, EdgeData, Data>` narrows `Data` to one group
(`cy.nodes()` is `Collection<N, E, N>`) and must still widen to the mixed
`Collection<N, E>` — a helper written against the mixed type has to take
a node collection.  TypeScript measures a class's type parameters for
variance, and a parameter that appears in a conditional type's *check*
position measures invariant, so `IsUntyped<Data>` anywhere in the class
would make that widening an error.  The collection's members therefore
ask `IfTyped<NodeData, EdgeData, …>` — which never varies between a
narrow and a wide collection of one instance — and use `Data` only in
plain positions (`keyof Data`, `Data[K]`, `Partial<Data>`), which measure
covariant.  Measured in round 140: with the check on `Data`, `const m:
Collection<N, E> = cy.nodes()` failed through every `data()` overload.

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
 * The default `EdgeData` given the `NodeData`: untyped when the nodes are
 * (no generic at all), and a free-form record when only the nodes were
 * typed — so `cytoscape<MyNode>()` types its nodes and leaves its edges'
 * keys open, rather than an untyped edge shape turning the whole instance
 * untyped (see {@link IfTyped}).
 */
export type DefaultEdgeData<NodeData> =
  IsUntyped<NodeData> extends true ? Untyped : Record<string, unknown>;

/**
 * `T` for a typed instance, `U` (the pre-140 type) for an untyped one.
 * The test is on the instance's shapes — both of them, so an instance
 * whose `NodeData` is `any` is untyped whatever its `EdgeData`.
 */
export type IfTyped<NodeData, EdgeData, T, U> =
  IsUntyped<NodeData | EdgeData> extends true ? U : T;

/** The first-class keys every element answers, synthesized on read. */
export type FirstClassKey = 'id' | 'source' | 'target' | 'parent';

/**
 * The keys a field reference in a sheet or a query may name: the shape's
 * string keys (either shape's, for a union) plus the first-class ones.
 * Untyped: any string.  Used by the declarative forms only, which are not
 * narrowed per collection, so testing `Data` itself is safe here.
 */
export type DataKey<Data> =
  IsUntyped<Data> extends true
    ? string
    : (Data extends unknown ? keyof Data & string : never) | FirstClassKey;
