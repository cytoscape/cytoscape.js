export const arrowPrefixes = [ 'source', 'mid-source', 'target', 'mid-target' ];

// The per-arrow `<pos>-arrow-scale` properties default to the `inherit` enum rather than
// to a number, so that "never set" is distinguishable from "set to 1".  (A numeric default
// would not be: the style parser caches parsed props by value, so a sheet value equal to
// the default is the very same object as the default and is skipped when the style is
// applied -- it never reaches the element's style, and would read back as unset.)
export const getArrowScale = function( edge, prefix ){
  if( prefix != null ){
    let prefixed = edge.pstyle( prefix + '-arrow-scale' );

    if( prefixed != null && prefixed.value !== 'inherit' ){
      return prefixed.value;
    }
  }

  return edge.pstyle( 'arrow-scale' ).value;
};

// For the places that need a single scale covering every arrow on the edge (bounds
// padding, control-point correction) the largest of the four is the safe one.
export const getMaxArrowScale = function( edge ){
  let max = edge.pstyle( 'arrow-scale' ).value;

  for( let i = 0; i < arrowPrefixes.length; i++ ){
    let scale = getArrowScale( edge, arrowPrefixes[ i ] );

    if( scale > max ){ max = scale; }
  }

  return max;
};
