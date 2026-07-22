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

const matchesTerm = ( store: GraphStore, ref: Ref, term: SelectorTerm ): boolean => {
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
