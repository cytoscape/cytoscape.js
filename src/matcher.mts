import { CONDITION_FLAGS } from './contract.mjs';
import type { GroupName, Ref } from './contract.mjs';
import type { GraphStore } from './store/graph-store.mjs';
import {
  STATE_CONDITIONS,
  STATE_NAMES,
  testCondition,
} from './style-scales.mjs';
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
export interface DataCondition {
  eq?: unknown;
  ne?: unknown;
  lt?: number;
  lte?: number;
  gt?: number;
  gte?: number;
  in?: (string | number)[];
}

/**
 * A structured element query; every present key must hold.
 *
 * The state keys are the ones a `case` mapper's `when` takes, from the
 * same table (`STATE_CONDITIONS` in style-scales.mts) — so anything you
 * can style on, you can query for.  Each is a boolean, which is how v3's
 * paired selectors collapse: `{ selected: false }` is `:unselected`,
 * `{ grabbed: false }` is `:free`, `{ parent: false }` is `:childless`.
 */
export interface Query {
  /** restrict to one group */
  group?: GroupName;
  /** require the element (not) to be selected */
  selected?: boolean;
  /** whether the element may be selected by the user */
  selectable?: boolean;
  /** whether the element is locked in place */
  locked?: boolean;
  /** whether the user is dragging the element */
  grabbed?: boolean;
  /** whether the element may be dragged */
  grabbable?: boolean;
  /** whether the element is under an active press */
  active?: boolean;
  /** whether the pointer is over the element */
  hovered?: boolean;
  /** structural (round 14.7, nodes only): has at least one child */
  parent?: boolean;
  /** structural (nodes only): has no children — v3's `:childless`, and
   * exactly `{ parent: false }` */
  childless?: boolean;
  /** structural (round 14.7, nodes only): has a parent */
  child?: boolean;
  /** structural (nodes only): has no parent — v3's `:orphan`, and
   * exactly `{ child: false }` */
  orphan?: boolean;
  /** data-sidecar conditions per key; a bare value means equality */
  data?: Record<string, DataCondition | string | number | boolean | null>;
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

const QUERY_KEYS: ReadonlySet<string> = new Set([
  'group',
  'data',
  ...STATE_NAMES,
]);
const CONDITION_OPS: ReadonlySet<string> = new Set([
  'eq',
  'ne',
  'lt',
  'lte',
  'gt',
  'gte',
  'in',
]);

const isBareValue = (v: unknown): boolean => v == null || typeof v !== 'object';

/** Compile one query data entry into a condition (case-mapper rules). */
const compileDataCondition = (
  key: string,
  spec: DataCondition | string | number | boolean | null,
): CompiledCondition => {
  if (isBareValue(spec)) {
    return { key, op: 'eq', value: spec as string | number };
  }

  const cond = spec as DataCondition;
  const ops = Object.keys(cond);

  for (const op of ops) {
    if (!CONDITION_OPS.has(op)) {
      throw new Error(
        `Unknown data condition op '${op}' for key '${key}'; ` +
          `supported: ${[...CONDITION_OPS].join(', ')}`,
      );
    }
  }

  if (ops.length !== 1) {
    throw new Error(
      `A data condition needs exactly one comparison ` +
        `(${[...CONDITION_OPS].join(', ')}); got ${ops.length} for key '${key}'`,
    );
  }

  const op = ops[0] as CompiledCondition['op'];
  const raw = cond[op as keyof DataCondition];

  if (op === 'in') {
    if (!Array.isArray(raw) || raw.length === 0) {
      throw new Error(
        `'in' needs a non-empty array of values for key '${key}'`,
      );
    }

    return { key, op, value: raw as (string | number)[] };
  }

  if (
    (op === 'lt' || op === 'lte' || op === 'gt' || op === 'gte') &&
    typeof raw !== 'number'
  ) {
    throw new Error(`'${op}' needs a numeric value for key '${key}'`);
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
export const compileQuery = (
  query: Query,
  restrict: GroupName | null = null,
): FlagPlan => {
  // 29.3: a v3 selector string used to reach the key loop, where its
  // character indices read as keys and the error came back as
  // "Unknown query key '0'" — true, but not the thing that went wrong
  if (typeof query === 'string') {
    throw new Error(
      `Queries take an object, not the selector string '${query}' — v4 has no ` +
        `selector language; use a query object like cy.nodes({ selected: true }), ` +
        `a predicate function, or cy.$id( id )`,
    );
  }

  for (const key of Object.keys(query)) {
    if (!QUERY_KEYS.has(key)) {
      throw new Error(
        `Unknown query key '${key}'; supported keys: ${[...QUERY_KEYS].join(', ')}`,
      );
    }
  }

  const group = query.group ?? null;

  if (group != null && group !== 'nodes' && group !== 'edges') {
    throw new Error(
      `Unknown query group '${String(group)}'; use 'nodes' or 'edges'`,
    );
  }

  // boolean flag terms compose by OR-ing (mask, want) pairs.  Driven by
  // the style engine's state table, so a state that can be styled can be
  // queried — the two used to be separate lists and the query one was
  // three entries shorter than the styling one.
  let mask = 0;
  let want = 0;
  let structural = false;
  const structuralNames: string[] = [];

  for (const name of STATE_NAMES) {
    const asked = query[name];

    if (asked == null) {
      continue;
    }

    const state = STATE_CONDITIONS[name];
    const bit = CONDITION_FLAGS[state.key];
    const on = state.negate ? !asked : asked;

    mask |= bit;
    want |= on ? bit : 0;

    if (state.nodesOnly) {
      structural = true;
      structuralNames.push(name);
    }
  }

  const test: FlagTest = mask === 0 ? MATCH_ALL : { mask, want };

  // structural terms are node concepts (v3's :parent/:child/:childless/
  // :orphan never match edges): an explicitly-edges query throws, an
  // unrestricted one just never matches edges
  if (structural && (group === 'edges' || restrict === 'edges')) {
    throw new Error(
      `The '${structuralNames.join("'/'")}' query key${structuralNames.length > 1 ? 's apply' : ' applies'} to nodes only`,
    );
  }

  const allows = (g: GroupName): boolean =>
    (group == null || group === g) &&
    (restrict == null || restrict === g) &&
    !(structural && g === 'edges');

  let data: CompiledCondition[] | null = null;

  if (query.data != null) {
    data = Object.keys(query.data).map((key) =>
      compileDataCondition(key, query.data![key]),
    );

    if (data.length === 0) {
      data = null;
    }
  }

  return {
    nodes: allows('nodes') ? test : null,
    edges: allows('edges') ? test : null,
    data,
  };
};

/** Test one ref against a compiled plan (stale refs never match). */
export const planMatchesRef = (
  store: GraphStore,
  ref: Ref,
  plan: FlagPlan,
): boolean => {
  const test = ref.group === 'nodes' ? plan.nodes : plan.edges;

  if (test == null || !store.isCurrent(ref)) {
    return false;
  }

  const flags = (
    store.column(
      ref.group === 'nodes' ? 'node.flags' : 'edge.flags',
    ) as Uint32Array
  )[ref.slot];

  if ((flags & test.mask) !== test.want) {
    return false;
  }

  if (plan.data != null) {
    for (const cond of plan.data) {
      if (!testCondition(cond, store.data.get(ref.group, ref.slot, cond.key))) {
        return false;
      }
    }
  }

  return true;
};
