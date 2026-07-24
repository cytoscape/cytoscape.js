import { FLAG_SELECTED } from './contract.mjs';
import type { GroupName, Ref } from './contract.mjs';
import type { GraphStore } from './store/graph-store.mjs';

/*
The matcher IR: structured element queries over the columnar model.

v4 has no selector strings.  A query is a plain object of columnar
predicates — { group, selected } today — compiled once into per-group
(mask, want) tests over the flags column, the same tests the whole-graph
scan (GraphStore.scanRefsInto) answers with no element handles.  Anything
a query can't express is a predicate function at the collection/event
layer (as in lodash), which pays the per-element handle cost instead.
A future richer query language (data predicates over the sidecar
columns, class-like bitsets, ...) would extend this IR with more test
kinds; frontends (chained builders, serialized JSON queries) should
compile to it rather than growing their own matching.
*/

/** A structured element query; every present key must hold. */
export interface GpuQuery {
  /** restrict to one group */
  group?: GroupName;
  /** require the element (not) to be selected */
  selected?: boolean;
}

/** A flags-column test: a slot matches when (flags & mask) === want. */
export interface FlagTest {
  mask: number;
  want: number;
}

/** Per-group flag tests; a null group matches nothing in that group. */
export interface FlagPlan {
  nodes: FlagTest | null;
  edges: FlagTest | null;
}

/** The flags test every live slot passes (whole-group scans). */
export const MATCH_ALL: FlagTest = { mask: 0, want: 0 };

const QUERY_KEYS: ReadonlySet<string> = new Set( [ 'group', 'selected' ] );

/**
 * Compile a query into per-group flags-column tests.  `restrict` narrows
 * the plan to one group (`cy.nodes(q)` / `eles.edges(q)`); a query group
 * contradicting it compiles to a match-nothing plan.  Unknown keys throw —
 * with no string language left, a typo'd key must fail loudly rather than
 * silently match everything.
 */
export const compileQuery = ( query: GpuQuery, restrict: GroupName | null = null ): FlagPlan => {
  for( const key of Object.keys( query ) ){
    if( !QUERY_KEYS.has( key ) ){
      throw new Error( `Unknown query key '${key}'; supported keys: group, selected` );
    }
  }

  const group = query.group ?? null;

  if( group != null && group !== 'nodes' && group !== 'edges' ){
    throw new Error( `Unknown query group '${String( group )}'; use 'nodes' or 'edges'` );
  }

  const test: FlagTest = query.selected == null
    ? MATCH_ALL
    : { mask: FLAG_SELECTED, want: query.selected ? FLAG_SELECTED : 0 };

  const allows = ( g: GroupName ): boolean =>
    ( group == null || group === g ) && ( restrict == null || restrict === g );

  return {
    nodes: allows( 'nodes' ) ? test : null,
    edges: allows( 'edges' ) ? test : null
  };
};

/** Test one ref against a compiled plan (stale refs never match). */
export const planMatchesRef = ( store: GraphStore, ref: Ref, plan: FlagPlan ): boolean => {
  const test = ref.group === 'nodes' ? plan.nodes : plan.edges;

  if( test == null || !store.isCurrent( ref ) ){ return false; }

  const flags = ( store.column( ref.group === 'nodes' ? 'node.flags' : 'edge.flags' ) as Uint32Array )[ ref.slot ];

  return ( flags & test.mask ) === test.want;
};
