import * as util from '../../../util/index.mjs';
import type { Renderer, Element } from '../renderer-types.mjs';

// img can be an HTMLImageElement/HTMLCanvasElement plus cached width/height fields
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- background images come from multiple DOM sources with extra cached fields
type ImageLike = any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- internal image-drawing mixin object assembled onto the renderer prototype
let CRp: any = {};

CRp.safeDrawImage = function( this: Renderer, context: CanvasRenderingContext2D, img: ImageLike, ix: number, iy: number, iw: number, ih: number, x: number, y: number, w: number, h: number ){
  // detect problematic cases for old browsers with bad images (cheaper than try-catch)
  if( iw <= 0 || ih <= 0 || w <= 0 || h <= 0 ){
    return;
  }

  try {
    context.drawImage( img, ix, iy, iw, ih, x, y, w, h );
  } catch (e) {
    util.warn(e as string);
  }
};

CRp.drawInscribedImage = function( this: Renderer, context: CanvasRenderingContext2D, img: ImageLike, node: Element, index: number, nodeOpacity: number ){
  let r = this; // eslint-disable-line @typescript-eslint/no-this-alias
  let pos = node.position();
  let nodeX = pos.x;
  let nodeY = pos.y;
  let styleObj = node.cy().style();
  // getIndexedStyle returns style values of varying type (string/number) per property
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- open-ended indexed style lookup
  let getIndexedStyle: ( ...args: any[] ) => any = ( styleObj as any ).getIndexedStyle.bind( styleObj );
  let fit = getIndexedStyle( node, 'background-fit', 'value', index );
  let repeat = getIndexedStyle( node, 'background-repeat', 'value', index );
  let nodeW = node.width() as number;
  let nodeH = node.height() as number;
  let paddingX2 = ( node.padding() as number ) * 2;
  let nodeTW = nodeW + ( getIndexedStyle( node, 'background-width-relative-to', 'value', index ) === 'inner' ? 0 : paddingX2 );
  let nodeTH = nodeH + ( getIndexedStyle( node, 'background-height-relative-to', 'value', index ) === 'inner' ? 0 : paddingX2 );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- rscratch is an open render-scratch bag (pathCache, ...)
  let rs = node._private.rscratch as any;
  let clip = getIndexedStyle( node, 'background-clip', 'value', index );
  let shouldClip = clip === 'node';
  let imgOpacity = getIndexedStyle( node, 'background-image-opacity', 'value', index ) * nodeOpacity;
  let smooth = getIndexedStyle( node, 'background-image-smoothing', 'value', index );
  // corner-radius value is either 'auto' or a number (pfValue); kept loose
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- value is string|number depending on branch
  let cornerRadius: any = node.pstyle('corner-radius')!.value;
  if (cornerRadius !== 'auto') cornerRadius = node.pstyle('corner-radius')!.pfValue;

  let imgW = img.width || img.cachedW;
  let imgH = img.height || img.cachedH;

  // workaround for broken browsers like ie
  if( null == imgW || null == imgH ){
    document.body.appendChild( img );  

    imgW = img.cachedW = img.width || img.offsetWidth;
    imgH = img.cachedH = img.height || img.offsetHeight;

    document.body.removeChild( img );  
  }

  let w = imgW;
  let h = imgH;

  if( getIndexedStyle( node, 'background-width', 'value', index ) !== 'auto' ){
    if( getIndexedStyle( node, 'background-width', 'units', index ) === '%' ){
      w = getIndexedStyle( node, 'background-width', 'pfValue', index ) * nodeTW;
    } else {
      w = getIndexedStyle( node, 'background-width', 'pfValue', index );
    }
  }

  if( getIndexedStyle( node, 'background-height', 'value', index ) !== 'auto' ){
    if( getIndexedStyle( node, 'background-height', 'units', index ) === '%' ){
      h = getIndexedStyle( node, 'background-height', 'pfValue', index ) * nodeTH;
    } else {
      h = getIndexedStyle( node, 'background-height', 'pfValue', index );
    }
  }

  if( w === 0 || h === 0 ){
    return; // no point in drawing empty image (and chrome is broken in this case)
  }

  if( fit === 'contain' ){
    let scale = Math.min( nodeTW / w, nodeTH / h );

    w *= scale;
    h *= scale;

  } else if( fit === 'cover' ){
    let scale = Math.max( nodeTW / w, nodeTH / h );

    w *= scale;
    h *= scale;
  }

  let x = (nodeX - nodeTW / 2); // left
  let posXUnits = getIndexedStyle( node, 'background-position-x', 'units', index );
  let posXPfVal = getIndexedStyle( node, 'background-position-x', 'pfValue', index );
  if( posXUnits === '%' ){
    x += (nodeTW - w) * posXPfVal;
  } else {
    x += posXPfVal;
  }

  let offXUnits = getIndexedStyle( node, 'background-offset-x', 'units', index );
  let offXPfVal = getIndexedStyle( node, 'background-offset-x', 'pfValue', index );
  if( offXUnits === '%' ){
    x += (nodeTW - w) * offXPfVal;
  } else {
    x += offXPfVal;
  }

  let y = (nodeY - nodeTH / 2); // top
  let posYUnits = getIndexedStyle( node, 'background-position-y', 'units', index );
  let posYPfVal = getIndexedStyle( node, 'background-position-y', 'pfValue', index );
  if( posYUnits === '%' ){
    y += (nodeTH - h) * posYPfVal;
  } else {
    y += posYPfVal;
  }

  let offYUnits = getIndexedStyle( node, 'background-offset-y', 'units', index );
  let offYPfVal = getIndexedStyle( node, 'background-offset-y', 'pfValue', index );
  if( offYUnits === '%' ){
    y += (nodeTH - h) * offYPfVal;
  } else {
    y += offYPfVal;
  }

  if( rs.pathCache ){
    x -= nodeX;
    y -= nodeY;

    nodeX = 0;
    nodeY = 0;
  }

  let gAlpha = context.globalAlpha;

  context.globalAlpha = imgOpacity;

  let smoothingEnabled = r.getImgSmoothing( context );
  let isSmoothingSwitched = false;

  if( smooth === 'no' && smoothingEnabled ){ 
    r.setImgSmoothing( context, false );
    isSmoothingSwitched = true;
  } else if( smooth === 'yes' && !smoothingEnabled ){
    r.setImgSmoothing( context, true );
    isSmoothingSwitched = true;
  }

  if( repeat === 'no-repeat' ){

    if( shouldClip ){
      context.save();

      if( rs.pathCache ){
        context.clip( rs.pathCache );
      } else {
        r.nodeShapes[ r.getNodeShape( node ) ].draw(
          context,
          nodeX, nodeY,
          nodeTW, nodeTH,
          cornerRadius, rs );

        context.clip();
      }
    }

    r.safeDrawImage( context, img, 0, 0, imgW, imgH, x, y, w, h );

    if( shouldClip ){
      context.restore();
    }
  } else {
    let pattern = context.createPattern( img, repeat );
    context.fillStyle = pattern!; // createPattern returns non-null for a valid loaded image

    r.nodeShapes[ r.getNodeShape( node ) ].draw(
        context,
        nodeX, nodeY,
        nodeTW, nodeTH, cornerRadius, rs);

    context.translate( x, y );
    context.fill();
    context.translate( -x, -y );
  }

  context.globalAlpha = gAlpha;

  if( isSmoothingSwitched ){ r.setImgSmoothing( context, smoothingEnabled ); }
};

export default CRp;
