import { warn } from '../util/index.mjs';
import * as is from '../is.mjs';
import exprs from './expressions.mjs';
import newQuery from './new-query.mjs';
import Type from './type.mjs';
import type { Expr } from './expressions.mjs';
import type { Check, Query } from './type.mjs';
import type Selector from './index.mjs';

/**
 * Of all the expressions, find the first match in the remaining text.
 * @param {string} remaining The remaining text to parse
 * @returns The matched expression and the newly remaining text `{ expr, match, name, remaining }`
 */
const consumeExpr = ( remaining: string ) => {
  let expr: Expr | undefined;
  let match: RegExpMatchArray | undefined;
  let name: string | undefined;

  for( let j = 0; j < exprs.length; j++ ){
    let e = exprs[ j ];
    let n = e.name;

    let m = remaining.match( e.regexObj! ); // regexObj is compiled for every expr at module init

    if( m != null ){
      match = m;
      expr = e;
      name = n;

      let consumed = m[0];
      remaining = remaining.substring( consumed.length );

      break; // we've consumed one expr, so we can return now
    }
  }

  return {
    expr: expr,
    match: match,
    name: name,
    remaining: remaining
  };
};


/**
 * Consume all the leading whitespace
 * @param {string} remaining The text to consume
 * @returns The text with the leading whitespace removed
 */
const consumeWhitespace = ( remaining: string ): string => {
  let match = remaining.match( /^\s+/ );

  if( match ){
    let consumed = match[0];
    remaining = remaining.substring( consumed.length );
  }

  return remaining;
};

/**
 * Parse the string and store the parsed representation in the Selector.
 * @param {string} selector The selector string
 * @returns `true` if the selector was successfully parsed, `false` otherwise
 */
const parse = function( this: Selector, selector: string ): boolean {
  let self = this; // eslint-disable-line @typescript-eslint/no-this-alias -- preserve the original code verbatim

  let remaining = self.inputText = selector;

  let currentQuery = self[0] = newQuery();
  self.length = 1;

  remaining = consumeWhitespace( remaining ); // get rid of leading whitespace

  for( ;; ){
    let exprInfo = consumeExpr( remaining );

    if( exprInfo.expr == null ){
      warn( 'The selector `' + selector + '`is invalid' );
      return false;
    } else {
      let args = exprInfo.match!.slice( 1 ); // match is set whenever expr is set

      // let the token populate the selector object in currentQuery
      let ret = exprInfo.expr.populate( self, currentQuery, args );

      if( ret === false ){
        return false; // exit if population failed
      } else if( ret != null ){
        currentQuery = ret; // change the current query to be filled if the expr specifies
      }
    }

    remaining = exprInfo.remaining;

    // we're done when there's nothing left to parse
    if( remaining.match( /^\s*$/ ) ){
      break;
    }
  }

  let lastQ = self[self.length - 1];

  if( self.currentSubject != null ){
    lastQ.subject = self.currentSubject;
  }

  lastQ.edgeCount = self.edgeCount;
  lastQ.compoundCount = self.compoundCount;

  for( let i = 0; i < self.length; i++ ){
    let q = self[i];

    // in future, this could potentially be allowed if there were operator precedence and detection of invalid combinations
    if( q.compoundCount! > 0 && q.edgeCount! > 0 ){ // n.b. every top-level query has the counts set by this point
      warn( 'The selector `' + selector + '` is invalid because it uses both a compound selector and an edge selector' );
      return false;
    }

    if( q.edgeCount! > 1 ){
      warn( 'The selector `' + selector + '` is invalid because it uses multiple edge selectors' );
      return false;
    } else if( q.edgeCount === 1 ){
      warn( 'The selector `' + selector + '` is deprecated.  Edge selectors do not take effect on changes to source and target nodes after an edge is added, for performance reasons.  Use a class or data selector on edges instead, updating the class or data of an edge when your app detects a change in source or target nodes.' );
    }
  }

  return true; // success
};

/**
 * Get the selector represented as a string.  This value uses default formatting,
 * so things like spacing may differ from the input text passed to the constructor.
 * @returns {string} The selector string
 */
export const toString = function( this: Selector ): string {
  if( this.toStringCache != null ){
    return this.toStringCache;
  }

  let clean = function <T>( obj: T ): NonNullable<T> | '' {
    if( obj == null ){
      return '';
    } else {
      return obj;
    }
  };

  let cleanVal = function( val: string | number | undefined ): string | number {
    if( is.string( val ) ){
      return '"' + val + '"';
    } else {
      return clean( val );
    }
  };

  let space = ( val: string | number ) => {
    return ' ' + val + ' ';
  };

  // n.b. the assertions on check fields below are type-only: which fields a
  // check carries at runtime is guaranteed by its type (see `Check`)
  let checkToString = ( check: Check, subject: Query | null | undefined ): string | undefined => {
    let { type, value } = check;

    switch( type ){
      case Type.GROUP: {
        let group = clean( value as string );

        return group.substring( 0, group.length - 1 );
      }

      case Type.DATA_COMPARE: {
        let { field, operator } = check;

        return '[' + field + space( clean( operator ) ) + cleanVal( value as string | number ) + ']';
      }

      case Type.DATA_BOOL: {
        let { operator, field } = check;

        return '[' + clean( operator ) + field + ']';
      }

      case Type.DATA_EXIST: {
        let { field } = check;

        return '[' + field + ']';
      }

      case Type.META_COMPARE: {
        let { operator, field } = check;

        return '[[' + field + space( clean( operator ) ) + cleanVal( value as string | number ) + ']]';
      }

      case Type.STATE: {
        return value as string;
      }

      case Type.ID: {
        return '#' + value;
      }

      case Type.CLASS: {
        return '.' + value;
      }

      case Type.PARENT:
      case Type.CHILD: {
        return queryToString(check.parent!, subject) + space('>') + queryToString(check.child!, subject);
      }

      case Type.ANCESTOR:
      case Type.DESCENDANT: {
        return queryToString(check.ancestor!, subject) + ' ' + queryToString(check.descendant!, subject);
      }

      case Type.COMPOUND_SPLIT: {
        let lhs = queryToString(check.left!, subject);
        let sub = queryToString(check.subject!, subject);
        let rhs = queryToString(check.right!, subject);

        return lhs + (lhs.length > 0 ? ' ' : '') + sub + rhs;
      }

      case Type.TRUE: {
        return '';
      }
    }
  };

  let queryToString = ( query: Query, subject: Query | null | undefined ): string => {
    return query.checks.reduce((str, chk, i) => {
      return str + (subject === query && i === 0 ? '$' : '') + checkToString(chk, subject);
    }, '');
  };

  let str = '';

  for( let i = 0; i < this.length; i++ ){
    let query = this[ i ];

    str += queryToString( query, query.subject );

    if( this.length > 1 && i < this.length - 1 ){
      str += ', ';
    }
  }

  this.toStringCache = str;

  return str;
};

/** The methods that the parse mixin contributes to the Selector prototype */
export interface ParseMixin {
  parse( this: Selector, selector: string ): boolean;
  toString( this: Selector ): string;
}

export default { parse, toString };
