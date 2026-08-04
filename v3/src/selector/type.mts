/**
 * A check type enum-like object.  Uses integer values for fast match() lookup.
 * The ordering does not matter as long as the ints are unique.
 */
const Type = {
  /** E.g. node */
  GROUP: 0,

  /** A collection of elements */
  COLLECTION: 1,

  /** A filter(ele) function */
  FILTER: 2,

  /** E.g. [foo > 1] */
  DATA_COMPARE: 3,

  /** E.g. [foo] */
  DATA_EXIST: 4,

  /** E.g. [?foo] */
  DATA_BOOL: 5,

  /** E.g. [[degree > 2]] */
  META_COMPARE: 6,

  /** E.g. :selected */
  STATE: 7,

  /** E.g. #foo */
  ID: 8,

  /** E.g. .foo */
  CLASS: 9,

  /** E.g. #foo <-> #bar */
  UNDIRECTED_EDGE: 10,

  /** E.g. #foo -> #bar */
  DIRECTED_EDGE: 11,

  /** E.g. $#foo -> #bar */
  NODE_SOURCE: 12,

  /** E.g. #foo -> $#bar */
  NODE_TARGET: 13,

  /** E.g. $#foo <-> #bar */
  NODE_NEIGHBOR: 14,

  /** E.g. #foo > #bar */
  CHILD: 15,

  /** E.g. #foo #bar */
  DESCENDANT: 16,

  /** E.g. $#foo > #bar */
  PARENT: 17,

  /** E.g. $#foo #bar */
  ANCESTOR: 18,

  /** E.g. #foo > $bar > #baz */
  COMPOUND_SPLIT: 19,

  /** Always matches, useful placeholder for subject in `COMPOUND_SPLIT` */
  TRUE: 20
} as const;

/** The integer value of one of the `Type` check types */
export type QueryType = typeof Type[ keyof typeof Type ];

// -- Shared structural types for the selector module --
//
// The Element/Collection classes are not yet converted to TypeScript, so the
// interfaces below describe just the surface that selector matching uses.
// They can be replaced by the real types once src/collection is converted.

/** A filter(ele) function, as used by `Type.FILTER` checks */
export type FilterFn = ( ele: SelectorEle ) => boolean;

/**
 * Structural view of an element as used by selector matching.  N.b. selector
 * code relies on first-element semantics of collections (e.g. `ele.parent()`
 * is matched like an element), so this shape covers both.
 */
export interface SelectorEle {
  group(): string;
  id(): string;
  hasClass( className: string ): boolean;
  data( field: string ): unknown;
  collection(): SelectorCollection;

  // compound & edge traversal
  isNode(): boolean;
  source(): SelectorEle;
  target(): SelectorEle;
  parent(): SelectorEle;
  children(): SelectorCollection;
  ancestors(): SelectorCollection;
  descendants(): SelectorCollection;
  neighborhood(): SelectorCollection;
  outgoers(): SelectorCollection;
  incomers(): SelectorCollection;

  // state selector methods (see ./state.mts)
  selected(): boolean;
  selectable(): boolean;
  locked(): boolean;
  visible(): boolean;
  transparent(): boolean;
  grabbed(): boolean;
  removed(): boolean;
  grabbable(): boolean;
  animated(): boolean;
  active(): boolean;
  backgrounding(): boolean;
  isParent(): boolean;
  isChildless(): boolean;
  isChild(): boolean;
  isOrphan(): boolean;
  isLoop(): boolean;
  isSimple(): boolean;
}

/** Structural view of a collection of elements as used by the selector module */
export interface SelectorCollection {
  some( fn: ( ele: SelectorEle ) => boolean ): boolean;
  has( ele: SelectorEle ): boolean;
  getElementById( id: string ): SelectorEle;
  filter( fn: ( ele: SelectorEle ) => boolean ): SelectorCollection;
  collection(): SelectorCollection;
}

/**
 * A single check made against an ele to test for a match.  Only `type` is
 * always present; which other fields are set depends on the value of `type`
 * (see the `populate()` functions in ./expressions.mts and the `match[]`
 * functions in ./query-type-match.mts).
 */
export interface Check {
  /** The type enum (int) of the check */
  type: QueryType;

  /** Group, state, id, class, or data value -- or the collection/filter fn for `COLLECTION`/`FILTER` checks */
  value?: string | number | SelectorCollection | FilterFn;

  /** Data or metadata field name (`DATA_*`, `META_COMPARE`) */
  field?: string;

  /** Comparator or boolean operator (`DATA_COMPARE`, `DATA_BOOL`, `META_COMPARE`) */
  operator?: string;

  /** Edge source query (`DIRECTED_EDGE`, `NODE_SOURCE`, `NODE_TARGET`) */
  source?: Query;

  /** Edge target query (`DIRECTED_EDGE`, `NODE_SOURCE`, `NODE_TARGET`) */
  target?: Query;

  /** Endpoint queries (`UNDIRECTED_EDGE`); nulled when rewritten to `NODE_NEIGHBOR` */
  nodes?: Query[] | null;

  /** Subject node query (`NODE_NEIGHBOR`) */
  node?: Query;

  /** Neighbour query (`NODE_NEIGHBOR`) */
  neighbor?: Query;

  /** Compound queries (`CHILD`, `PARENT`) */
  parent?: Query;
  child?: Query;

  /** Compound queries (`DESCENDANT`, `ANCESTOR`) */
  ancestor?: Query;
  descendant?: Query;

  /** Compound split queries (`COMPOUND_SPLIT`) */
  left?: Query;
  right?: Query;
  subject?: Query;
}

/**
 * A query against which an ele may be matched; all `checks` must pass for the
 * query to match
 */
export interface Query {
  /** List of checks to make against an ele to test for a match */
  checks: Check[];

  /** The subject query, when a `$` subject selector applies */
  subject?: Query | null;

  /** Number of edge selectors in the query (set on top-level queries by the parser) */
  edgeCount?: number;

  /** Number of compound selectors in the query (set on top-level queries by the parser) */
  compoundCount?: number;
}

export default Type;
