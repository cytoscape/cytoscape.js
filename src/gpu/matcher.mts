import { FLAG_CHILD, FLAG_PARENT, FLAG_SELECTED } from './contract.mjs';
import type { GroupName, Ref } from './contract.mjs';
import type { GraphStore } from './store/graph-store.mjs';
import { testCondition } from './style-scales.mjs';
import type { CompiledCondition } from './style-scales.mjs';

/*
The matcher IR: structured element queries over the columnar model.

v4 has no selector strings.  A query is a plain object of columnar
predicates — { group, selected, data } — compiled once into per-group
(mask, want) tests over the flags column plus data-sidecar condition
tests, the tests the whole-graph scan (GraphStore.scanRefsInto) answers
with no element handles.  Data conditions use the case-mapper vocabulary
(one of eq/ne/lt/lte/gt/gte/in per key; a bare value is `eq`) and its
semantics (a missing value fails every op, `ne` included).  Anything a
query can't express is a predicate function at the collection/event
layer (as in lodash), which pays the per-element handle cost instead.
Future richer matching (structural terms, class-like bitsets, ...)
extends this IR with more test kinds; frontends (chained builders,
serialized JSON queries) should compile to it rather than growing their
own matching.
*/

/** One data comparison; exactly one op per condition object. */
export interface GpuDataCondition {
  eq?: unknown;
  ne?: unknown;
  lt?: number;
  lte?: number;
  gt?: number;
  gte?: number;
  in?: ( string | number )[];
}

/** A structured element query; every present key must hold. */
export interface GpuQuery {
  /** restrict to one group */
  group?: GroupName;
  /** require the element (not) to be selected */
  selected?: boolean;
  /** structural (round 14.7, nodes only): has at least one child —
   * `parent: false` is v3's `:childless` */
  parent?: boolean;
  /** structural (round 14.7, nodes only): has a parent —
   * `child: false` is v3's `:orphan` */
  child?: boolean;
  /** data-sidecar conditions per key; a bare value means equality */
  data?: Record<string, GpuDataCondition | string | number | boolean | null>;
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
  /** data-sidecar conditions, all of which must hold (null: none) */
  data: CompiledCondition[] | null;
}

/** The flags test every live slot passes (whole-group scans). */
export const MATCH_ALL: FlagTest = { mask: 0, want: 0 };

const QUERY_KEYS: ReadonlySet<string> = new Set( [ 'group', 'selected', 'parent', 'child', 'data' ] );
const CONDITION_OPS: ReadonlySet<string> = new Set( [ 'eq', 'ne', 'lt', 'lte', 'gt', 'gte', 'in' ] );

const isBareValue = ( v: unknown ): boolean =>
  v == null || typeof v !== 'object';

/** Compile one query data entry into a condition (case-mapper rules). */
const compileDataCondition = ( key: string, spec: GpuDataCondition | string | number | boolean | null ): CompiledCondition => {
  if( isBareValue( spec ) ){
    return { key, op: 'eq', value: spec as string | number };
  }

  const cond = spec as GpuDataCondition;
  const ops = Object.keys( cond );

  for( const op of ops ){
    if( !CONDITION_OPS.has( op ) ){
      throw new Error( `Unknown data condition op '${op}' for key '${key}'; ` +
        `supported: ${[ ...CONDITION_OPS ].join( ', ' )}` );
    }
  }

  if( ops.length !== 1 ){
    throw new Error( `A data condition needs exactly one comparison ` +
      `(${[ ...CONDITION_OPS ].join( ', ' )}); got ${ops.length} for key '${key}'` );
  }

  const op = ops[ 0 ] as CompiledCondition['op'];
  const raw = cond[ op as keyof GpuDataCondition ];

  if( op === 'in' ){
    if( !Array.isArray( raw ) || raw.length === 0 ){
      throw new Error( `'in' needs a non-empty array of values for key '${key}'` );
    }

    return { key, op, value: raw as ( string | number )[] };
  }

  if( ( op === 'lt' || op === 'lte' || op === 'gt' || op === 'gte' ) && typeof raw !== 'number' ){
    throw new Error( `'${op}' needs a numeric value for key '${key}'` );
  }

  return { key, op, value: raw as string | number };
};

/**
 * Compile a query into per-group flags-column tests.  `restrict` narrows
 * the plan to one group (`cy.nodes(q)` / `eles.edges(q)`); a query group
 * contradicting it compiles to a match-nothing plan.  Unknown keys throw —
 * with no string language left, a typo'd key must fail loudly rather than
 * silently match everything.
 */
export const compileQuery = ( query: GpuQuery, restrict: GroupName | null = null ): FlagPlan => {
  // 29.3: a v3 selector string used to reach the key loop, where its
  // character indices read as keys and the error came back as
  // "Unknown query key '0'" — true, but not the thing that went wrong
  if( typeof query === 'string' ){
    throw new Error(
      `Queries take an object, not the selector string '${query}' — v4 has no ` +
      `selector language; use a query object like cy.nodes({ selected: true }), ` +
      `a predicate function, or cy.$id( id )` );
  }

  for( const key of Object.keys( query ) ){
    if( !QUERY_KEYS.has( key ) ){
      throw new Error( `Unknown query key '${key}'; supported keys: group, selected, parent, child, data` );
    }
  }

  const group = query.group ?? null;

  if( group != null && group !== 'nodes' && group !== 'edges' ){
    throw new Error( `Unknown query group '${String( group )}'; use 'nodes' or 'edges'` );
  }

  // boolean flag terms compose by OR-ing (mask, want) pairs
  let mask = 0;
  let want = 0;

  if( query.selected != null ){
    mask |= FLAG_SELECTED;
    want |= query.selected ? FLAG_SELECTED : 0;
  }

  if( query.parent != null ){
    mask |= FLAG_PARENT;
    want |= query.parent ? FLAG_PARENT : 0;
  }

  if( query.child != null ){
    mask |= FLAG_CHILD;
    want |= query.child ? FLAG_CHILD : 0;
  }

  const test: FlagTest = mask === 0 ? MATCH_ALL : { mask, want };

  // structural terms are node concepts (v3's :parent/:child/:childless/
  // :orphan never match edges): an explicitly-edges query throws, an
  // unrestricted one just never matches edges
  const structural = query.parent != null || query.child != null;

  if( structural && ( group === 'edges' || restrict === 'edges' ) ){
    throw new Error( `The 'parent'/'child' query keys apply to nodes only` );
  }

  const allows = ( g: GroupName ): boolean =>
    ( group == null || group === g ) && ( restrict == null || restrict === g )
    && !( structural && g === 'edges' );

  let data: CompiledCondition[] | null = null;

  if( query.data != null ){
    data = Object.keys( query.data ).map( key => compileDataCondition( key, query.data![ key ] ) );

    if( data.length === 0 ){ data = null; }
  }

  return {
    nodes: allows( 'nodes' ) ? test : null,
    edges: allows( 'edges' ) ? test : null,
    data
  };
};

/** Test one ref against a compiled plan (stale refs never match). */
export const planMatchesRef = ( store: GraphStore, ref: Ref, plan: FlagPlan ): boolean => {
  const test = ref.group === 'nodes' ? plan.nodes : plan.edges;

  if( test == null || !store.isCurrent( ref ) ){ return false; }

  const flags = ( store.column( ref.group === 'nodes' ? 'node.flags' : 'edge.flags' ) as Uint32Array )[ ref.slot ];

  if( ( flags & test.mask ) !== test.want ){ return false; }

  if( plan.data != null ){
    for( const cond of plan.data ){
      if( !testCondition( cond, store.data.get( ref.group, ref.slot, cond.key ) ) ){ return false; }
    }
  }

  return true;
};
