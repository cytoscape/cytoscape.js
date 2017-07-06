let is = require('../../is');

function getEasedValue( type, start, end, percent, easingFn ){
  if( percent === 1 ){
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

function ease( startProp, endProp, percent, easingFn, propSpec ){
  let type = propSpec != null ? propSpec.type : null;

  if( percent < 0 ){
    percent = 0;
  } else if( percent > 1 ){
    percent = 1;
  }

  let start, end;

  if( startProp.pfValue != null || startProp.value != null ){
    start = startProp.pfValue != null ? startProp.pfValue : startProp.value;
  } else {
    start = startProp;
  }

  if( endProp.pfValue != null || endProp.value != null ){
    end = endProp.pfValue != null ? endProp.pfValue : endProp.value;
  } else {
    end = endProp;
  }

  if( is.number( start ) && is.number( end ) ){
    return getEasedValue( type, start, end, percent, easingFn );

  } else if( is.array( start ) && is.array( end ) ){
    let easedArr = [];

    for( let i = 0; i < end.length; i++ ){
      let si = start[ i ];
      let ei = end[ i ];

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

module.exports = ease;
