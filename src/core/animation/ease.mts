import * as is from '../../is.mjs';
import type { EasingFn } from './easings.mjs';

/** Numeric constraints/flags on a style property's value type. */
interface EaseType {
  roundValue?: boolean;
  color?: unknown;
  min?: number;
  max?: number;
  units?: string;
}

/** A style property spec carrying its value `type`. */
interface EaseSpec {
  type: EaseType;
}

/**
 * A property value to interpolate: either a raw number/array (positions) or a
 * parsed style property object carrying `value`/`pfValue`.
 */
interface EaseProp {
  pfValue?: number | number[];
  value?: number | number[];
}

type EaseInput = number | number[] | EaseProp;

function getEasedValue( type: EaseType | null, start: number, end: number, percent: number, easingFn: EasingFn ): number {
  if( percent === 1 ){
    return end;
  }

  if( start === end ){
    return end;
  }

  let val = easingFn( start, end, percent );

  if( type == null ){
    return val;
  }

  if( type.roundValue || type.color ){
    val = Math.round( val );
  }

  if( type.min !== undefined ){
    val = Math.max( val, type.min );
  }

  if( type.max !== undefined ){
    val = Math.min( val, type.max );
  }

  return val;
}

function getValue( prop: EaseInput, spec: EaseSpec | null | undefined ): number | number[] {
  let p = prop as EaseProp;

  if( p.pfValue != null || p.value != null ){
    if( p.pfValue != null && (spec == null || spec.type.units !== '%') ){
      return p.pfValue;
    } else {
      return p.value as number | number[];
    }
  } else {
    return prop as number | number[];
  }
}

function ease( startProp: EaseInput, endProp: EaseInput, percent: number, easingFn: EasingFn, propSpec?: EaseSpec | null ): number | number[] | undefined {
  let type = propSpec != null ? propSpec.type : null;

  if( percent < 0 ){
    percent = 0;
  } else if( percent > 1 ){
    percent = 1;
  }

  let start = getValue( startProp, propSpec );
  let end = getValue( endProp, propSpec );

  if( is.number( start ) && is.number( end ) ){
    return getEasedValue( type, start, end, percent, easingFn );

  } else if( is.array( start ) && is.array( end ) ){
    let easedArr: number[] = [];

    for( let i = 0; i < end.length; i++ ){
      let si = start[ i ] as number;
      let ei = end[ i ] as number;

      if( si != null && ei != null ){
        let val = getEasedValue( type, si, ei, percent, easingFn );

        easedArr.push( val );
      } else {
        easedArr.push( ei );
      }
    }

    return easedArr;
  }

  return undefined;
}

export default ease;
