import type { Collection, Element } from '../renderer-types.mjs';

const setGrabState = function( ele: Collection, grabbed: boolean ){
  let ele0 = ele[0] as Element | undefined;

  if( !ele0 || ele0._private.grabbed === grabbed ){
    return;
  }

  ele0._private.grabbed = grabbed;
  ele.updateStyle( false );
};

export const setGrabbed = function( ele: Collection ){
  setGrabState( ele, true );
};

export const setFreed = function( ele: Collection ){
  setGrabState( ele, false );
};
