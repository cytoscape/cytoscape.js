const setGrabState = function( ele, grabbed ){
  let element = ele[0];

  if( !element || element._private.grabbed === grabbed ){
    return;
  }

  element._private.grabbed = grabbed;
  ele.updateStyle( false );
};

export const setGrabbed = function( ele ){
  setGrabState( ele, true );
};

export const setFreed = function( ele ){
  setGrabState( ele, false );
};
