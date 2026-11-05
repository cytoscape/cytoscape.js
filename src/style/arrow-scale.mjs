export const arrowPrefixes = [ 'source', 'mid-source', 'target', 'mid-target' ];

// per-arrow `<pos>-arrow-scale` properties default to the `inherit` enum rather than
// to a number, so that "never set" is distinguishable from "set to 1"
export const getArrowScale = function( edge, prefix ){
  if( prefix != null ){
    let prefixed = edge.pstyle( prefix + '-arrow-scale' );

    if( prefixed != null && prefixed.value !== 'inherit' ){
      return prefixed.value;
    }
  }

  return edge.pstyle( 'arrow-scale' ).value;
};
