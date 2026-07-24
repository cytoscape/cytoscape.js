import { FLAG_SELECTED } from './contract.mjs';
import type { GroupName, Ref } from './contract.mjs';
import type { GraphStore } from './store/graph-store.mjs';

/*
Mini selector language for the GPU prototype.  Supported grammar:

  selector := term (',' term)*
  term     := head? pseudo*
  head     := '*' | 'node' | 'edge' | '#' id
  pseudo   := ':selected' | ':unselected'

Anything else (classes, data attributes, traversal combinators, ...) throws.
*/

export interface SelectorTerm {
  group?: GroupName;
  id?: string;
  selected?: boolean;
}

export interface CompiledSelector {
  text: string;
  terms: SelectorTerm[];
}

const termRegex = /^(\*|node|edge|#[^\s:#,[\]]+)?((?::[a-zA-Z]+)*)$/;

const parseTerm = ( raw: string ): SelectorTerm => {
  const trimmed = raw.trim();
  const match = trimmed.match( termRegex );

  if( match == null || trimmed === '' ){
    throw new Error( `The selector '${raw.trim()}' is invalid or unsupported in the GPU prototype` );
  }

  const term: SelectorTerm = {};
  const head = match[1];

  if( head === 'node' ){
    term.group = 'nodes';
  } else if( head === 'edge' ){
    term.group = 'edges';
  } else if( head != null && head[0] === '#' ){
    term.id = head.substring( 1 );
  } // '*' and empty head match any group

  const pseudos = match[2];

  if( pseudos ){
    for( const pseudo of pseudos.split( ':' ).slice( 1 ) ){
      if( pseudo === 'selected' ){
        term.selected = true;
      } else if( pseudo === 'unselected' ){
        term.selected = false;
      } else {
        throw new Error( `The pseudo-class ':${pseudo}' is unsupported in the GPU prototype` );
      }
    }
  }

  return term;
};

export const parseSelector = ( text: string ): CompiledSelector => {
  const terms = text.split( ',' ).map( parseTerm );

  return { text, terms };
};

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

const MATCH_ALL: FlagTest = { mask: 0, want: 0 };

// Union of two tests over the same group.  Today the only flag a term can
// constrain is FLAG_SELECTED, so two differing tests always union to
// match-all; a multi-flag selector language would need a test list here.
const mergeTest = ( a: FlagTest | null, b: FlagTest ): FlagTest =>
  a == null || ( a.mask === b.mask && a.want === b.want ) ? b : MATCH_ALL;

/**
 * Compile a selector into per-group flags-column tests when every term is
 * expressible as (group, flag mask) — the columnar fast path behind
 * whole-graph selection: matching slots come from one scan over the flags
 * column, with no element handles and no per-element term matching.
 * Returns null when any term pins an `#id` (those resolve through the id
 * index, or fall back to per-element matching in mixed comma lists).
 */
export const compileFlagPlan = ( selector: CompiledSelector ): FlagPlan | null => {
  let nodes: FlagTest | null = null;
  let edges: FlagTest | null = null;

  for( const term of selector.terms ){
    if( term.id != null ){ return null; }

    const test: FlagTest = term.selected == null
      ? MATCH_ALL
      : { mask: FLAG_SELECTED, want: term.selected ? FLAG_SELECTED : 0 };

    if( term.group !== 'edges' ){ nodes = mergeTest( nodes, test ); }
    if( term.group !== 'nodes' ){ edges = mergeTest( edges, test ); }
  }

  return { nodes, edges };
};

export const matchesTerm = ( store: GraphStore, ref: Ref, term: SelectorTerm ): boolean => {
  if( term.group != null && ref.group !== term.group ){ return false; }

  if( term.id != null && store.idAt( ref.group, ref.slot ) !== term.id ){ return false; }

  if( term.selected != null ){
    const selected = store.hasFlag( ref.group, ref.slot, FLAG_SELECTED );

    if( selected !== term.selected ){ return false; }
  }

  return true;
};

export const matchesRef = ( store: GraphStore, ref: Ref, selector: CompiledSelector ): boolean => {
  if( !store.isCurrent( ref ) ){ return false; }

  return selector.terms.some( term => matchesTerm( store, ref, term ) );
};
