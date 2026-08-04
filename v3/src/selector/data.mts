import * as is from '../is.mjs';
import type { SelectorEle } from './type.mjs';

// n.b. the type assertions in valCmp are type-only: the original JS relies on
// loose JS comparison/concatenation semantics for mixed or absent values, and
// that runtime behaviour is preserved exactly
export const valCmp = (fieldVal: unknown, operator: string, value: string | number): boolean => {
  let matches;
  let isFieldStr = is.string( fieldVal );
  let isFieldNum = is.number( fieldVal );
  let isValStr = is.string(value);
  let fieldStr: string | undefined, valStr: string | undefined;
  let caseInsensitive = false;
  let notExpr = false;
  let isIneqCmp = false;

  if( operator.indexOf( '!' ) >= 0 ){
    operator = operator.replace( '!', '' );
    notExpr = true;
  }

  if( operator.indexOf( '@' ) >= 0 ){
    operator = operator.replace( '@', '' );
    caseInsensitive = true;
  }

  if( isFieldStr || isValStr || caseInsensitive ){
    fieldStr = !isFieldStr && !isFieldNum ? '' : '' + ( fieldVal as string | number );
    valStr = '' + value;
  }

  // if we're doing a case insensitive comparison, then we're using a STRING comparison
  // even if we're comparing numbers
  if( caseInsensitive ){
    fieldVal = fieldStr = fieldStr!.toLowerCase();
    value = valStr = valStr!.toLowerCase();
  }

  switch( operator ){
  case '*=':
    matches = fieldStr!.indexOf( valStr! ) >= 0;
    break;
  case '$=':
    matches = fieldStr!.indexOf( valStr!, fieldStr!.length - valStr!.length ) >= 0;
    break;
  case '^=':
    matches = fieldStr!.indexOf( valStr! ) === 0;
    break;
  case '=':
    matches = fieldVal === value;
    break;
  case '>':
    isIneqCmp = true;
    matches = ( fieldVal as number ) > ( value as number );
    break;
  case '>=':
    isIneqCmp = true;
    matches = ( fieldVal as number ) >= ( value as number );
    break;
  case '<':
    isIneqCmp = true;
    matches = ( fieldVal as number ) < ( value as number );
    break;
  case '<=':
    isIneqCmp = true;
    matches = ( fieldVal as number ) <= ( value as number );
    break;
  default:
    matches = false;
    break;
  }

  // apply the not op, but null vals for inequalities should always stay non-matching
  if( notExpr && ( fieldVal != null || !isIneqCmp ) ){
    matches = !matches;
  }

  return matches;
};

export const boolCmp = (fieldVal: unknown, operator: string): boolean | undefined => {
  switch( operator ){
  case '?':
    return fieldVal ? true : false;
  case '!':
    return fieldVal ? false : true;
  case '^':
    return fieldVal === undefined;
  }
};

// n.b. the second arg has always been passed by the DATA_EXIST check and ignored here
export const existCmp = (fieldVal: unknown, _operator?: string): boolean => fieldVal !== undefined;

export const data = (ele: SelectorEle, field: string): unknown => ele.data(field);

// duck-typing cast: field is degree|indegree|outdegree per tokens.meta
export const meta = (ele: SelectorEle, field: string): unknown => ( ele as unknown as Record<string, () => unknown> )[field]();