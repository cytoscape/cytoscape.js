export const extend: typeof Object.assign = Object.assign != null ? Object.assign.bind( Object ) : function( tgt: Record<string, unknown> ){
  // eslint-disable-next-line prefer-rest-params -- kept as `arguments` to preserve the original runtime exactly
  let args = arguments;

  for( let i = 1; i < args.length; i++ ){
    let obj = args[ i ];

    if( obj == null ){ continue; }

    let keys = Object.keys( obj );

    for( let j = 0; j < keys.length; j++ ){
      let k = keys[j];

      tgt[ k ] = obj[ k ];
    }
  }

  return tgt;
};
