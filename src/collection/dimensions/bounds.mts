import * as is from '../../is.mjs';
import { assignBoundingBox, expandBoundingBoxSides, clearBoundingBox, expandBoundingBox, makeBoundingBox, copyBoundingBox } from '../../math.mjs';
import {defaults, endsWith, getPrefixedProperty, hashIntsArray, memoize} from '../../util/index.mjs';
import { labelHalign, labelValign } from '../../style/align.mjs';
import type { BoundingBox, BoundingBox12, Position } from '../../types.mjs';
import type { Collection, SharedCollection, Element, BbCache } from '../eles-types.mjs';
import type { ParsedStyleProperty } from '../../style/parse.mjs';

/** Options controlling which sub-parts are included in a bounding box. */
export interface BoundingBoxOptions {
  includeNodes?: boolean;
  includeEdges?: boolean;
  includeLabels?: boolean;
  includeMainLabels?: boolean;
  includeSourceLabels?: boolean;
  includeTargetLabels?: boolean;
  includeOverlays?: boolean;
  includeUnderlays?: boolean;
  includeOutlines?: boolean;
  useCache?: boolean;
  // n.b. matches the original `incudeNodes` typo read in getKey()
  incudeNodes?: boolean;
}

/** Bounding-box methods contributed to the collection prototype. */
export interface CollectionBounds {
  renderedBoundingBox( this: SharedCollection, options?: BoundingBoxOptions ): BoundingBox;
  renderedBoundingbox( this: SharedCollection, options?: BoundingBoxOptions ): BoundingBox;
  /** @internal */
  dirtyCompoundBoundsCache( this: SharedCollection, silent?: boolean ): Collection;
  /** @internal */
  updateCompoundBounds( this: SharedCollection, force?: boolean ): Collection;
  boundingBox( this: SharedCollection, options?: BoundingBoxOptions ): BoundingBox;
  boundingbox( this: SharedCollection, options?: BoundingBoxOptions ): BoundingBox;
  bb( this: SharedCollection, options?: BoundingBoxOptions ): BoundingBox;
  /** @internal */
  dirtyBoundingBoxCache( this: SharedCollection ): Collection;
  /** @internal */
  boundingBoxAt( this: SharedCollection, fn: ( ( node: Element, i: number ) => Position ) | Position ): BoundingBox;
}

// helper to read a parsed style property
const pstyleOf = ( ele: Element, name: string ) => ele.pstyle( name ) as ParsedStyleProperty;

let elesfn = {} as CollectionBounds;
let fn = elesfn;

elesfn.renderedBoundingBox = function( this: Collection, options?: BoundingBoxOptions ): BoundingBox {
  let bb = this.boundingBox( options );
  let cy = this.cy();
  let zoom = cy.zoom();
  let pan = cy.pan();

  let x1 = bb.x1 * zoom + pan.x;
  let x2 = bb.x2 * zoom + pan.x;
  let y1 = bb.y1 * zoom + pan.y;
  let y2 = bb.y2 * zoom + pan.y;

  return {
    x1: x1,
    x2: x2,
    y1: y1,
    y2: y2,
    w: x2 - x1,
    h: y2 - y1
  };
};

elesfn.dirtyCompoundBoundsCache = function( this: Collection, silent = false ){
  let cy = this.cy();

  if( !cy.styleEnabled() || !cy.hasCompoundNodes() ){ return this; }

  this.forEachUp( ( ele: Element ) => {
    if( ele.isParent() ){
      let _p = ele._private;

      _p.compoundBoundsClean = false;
      _p.bbCache = null;

      if(!silent){
        ele.emitAndNotify('bounds');
      }
    }
  } );

  return this;
};

elesfn.updateCompoundBounds = function( this: Collection, force = false ){
  let cy = this.cy();

  // not possible to do on non-compound graphs or with the style disabled
  if( !cy.styleEnabled() || !cy.hasCompoundNodes() ){ return this; }

  // save cycles when batching -- but bounds will be stale (or not exist yet)
  if( !force && cy.batching() ){ return this; }

  function update( parent: Element ){
    if( !parent.isParent() ){ return; }

    let _p = parent._private;
    let children = parent.children();
    let includeLabels = pstyleOf( parent, 'compound-sizing-wrt-labels' ).value === 'include';

    let min = {
      width: {
        val: pstyleOf( parent, 'min-width' ).pfValue as number,
        left: pstyleOf( parent, 'min-width-bias-left' ),
        right: pstyleOf( parent, 'min-width-bias-right' )
      },
      height: {
        val: pstyleOf( parent, 'min-height' ).pfValue as number,
        top: pstyleOf( parent, 'min-height-bias-top' ),
        bottom: pstyleOf( parent, 'min-height-bias-bottom' )
      }
    };

    let bb = children.boundingBox( {
      includeLabels: includeLabels,
      includeOverlays: false,

      // updating the compound bounds happens outside of the regular
      // cache cycle (i.e. before fired events)
      useCache: false
    } ) as BoundingBox;
    let pos = _p.position;

    // if children take up zero area then keep position and fall back on stylesheet w/h
    if( bb.w === 0 || bb.h === 0 ){
      bb = {
        w: pstyleOf( parent, 'width' ).pfValue as number,
        h: pstyleOf( parent, 'height' ).pfValue as number
      } as BoundingBox;

      bb.x1 = pos.x - bb.w/2;
      bb.x2 = pos.x + bb.w/2;
      bb.y1 = pos.y - bb.h/2;
      bb.y2 = pos.y + bb.h/2;
    }

    function computeBiasValues( propDiff: number, propBias: number, propBiasComplement: number ){
      let biasDiff = 0;
      let biasComplementDiff = 0;
      let biasTotal = propBias + propBiasComplement;

      if( propDiff > 0 && biasTotal > 0 ){
        biasDiff = ( propBias / biasTotal ) * propDiff;
        biasComplementDiff = ( propBiasComplement / biasTotal ) * propDiff;
      }
      return {
        biasDiff: biasDiff,
        biasComplementDiff: biasComplementDiff
      };
    }

    function computePaddingValues( width: number, height: number, paddingObject: ParsedStyleProperty, relativeTo: unknown ) {
      let pfValue = paddingObject.pfValue as number;
      // Assuming percentage is number from 0 to 1
      if(paddingObject.units === '%') {
        switch(relativeTo) {
          case 'width':
            return width > 0 ? pfValue * width : 0;
          case 'height':
            return height > 0 ? pfValue * height : 0;
          case 'average':
            return ( width > 0 ) && ( height > 0 ) ? pfValue * ( width + height ) / 2 : 0;
          case 'min':
            return ( width > 0 ) && ( height > 0 ) ? ( ( width > height ) ? pfValue * height : pfValue * width ) : 0;
          case 'max':
            return ( width > 0 ) && ( height > 0 ) ? ( ( width > height ) ? pfValue * width : pfValue * height ) : 0;
          default:
            return 0;
        }
      } else if(paddingObject.units === 'px') {
        return pfValue;
      } else {
        return 0;
      }
    }

    let leftVal = min.width.left.value as number;
    if( min.width.left.units === 'px' && min.width.val > 0 ){
      leftVal = ( leftVal * 100 ) / min.width.val;
    }
    let rightVal = min.width.right.value as number;
    if( min.width.right.units === 'px' && min.width.val > 0 ){
      rightVal = ( rightVal * 100 ) / min.width.val;
    }

    let topVal = min.height.top.value as number;
    if( min.height.top.units === 'px' && min.height.val > 0 ){
      topVal = ( topVal * 100 ) / min.height.val;
    }

    let bottomVal = min.height.bottom.value as number;
    if( min.height.bottom.units === 'px' && min.height.val > 0 ){
      bottomVal = ( bottomVal * 100 ) / min.height.val;
    }

    let widthBiasDiffs = computeBiasValues( min.width.val - bb.w, leftVal, rightVal );
    let diffLeft = widthBiasDiffs.biasDiff;
    let diffRight = widthBiasDiffs.biasComplementDiff;

    let heightBiasDiffs = computeBiasValues( min.height.val - bb.h, topVal, bottomVal );
    let diffTop = heightBiasDiffs.biasDiff;
    let diffBottom = heightBiasDiffs.biasComplementDiff;

    _p.autoPadding = computePaddingValues( bb.w, bb.h, pstyleOf( parent, 'padding' ), pstyleOf( parent, 'padding-relative-to' ).value );

    _p.autoWidth = Math.max(bb.w, min.width.val);
    pos.x = (- diffLeft + bb.x1 + bb.x2 + diffRight) / 2;

    _p.autoHeight = Math.max(bb.h, min.height.val);
    pos.y = (- diffTop + bb.y1 + bb.y2 + diffBottom) / 2;
  }

  for( let i = 0; i < this.length; i++ ){
    let ele = this[i];
    let _p = ele._private;

    if( !_p.compoundBoundsClean || force ){
      update( ele );

      if( !cy.batching() ){
        _p.compoundBoundsClean = true;
      }
    }
  }

  return this;
};

let noninf = function( x: number ): number {
  if( x === Infinity || x === -Infinity ){
    return 0;
  }

  return x;
};

let updateBounds = function( b: BoundingBox, x1: number, y1: number, x2: number, y2: number ): void {
  // don't update with zero area boxes
  if( x2 - x1 === 0 || y2 - y1 === 0 ){ return; }

  // don't update with null dim
  if( x1 == null || y1 == null || x2 == null || y2 == null ){ return; }

  b.x1 = x1 < b.x1 ? x1 : b.x1;
  b.x2 = x2 > b.x2 ? x2 : b.x2;
  b.y1 = y1 < b.y1 ? y1 : b.y1;
  b.y2 = y2 > b.y2 ? y2 : b.y2;
  b.w = b.x2 - b.x1;
  b.h = b.y2 - b.y1;
};

let updateBoundsFromBox = function( b: BoundingBox, b2: BoundingBox12 | null | undefined ): BoundingBox | void {
  if( b2 == null ){ return b; }

  return updateBounds( b, b2.x1, b2.y1, b2.x2, b2.y2 );
};

let prefixedProperty = function( obj: Record<string, unknown>, field: string, prefix?: string | null ): unknown {
  return getPrefixedProperty( obj, field, prefix );
};

let updateBoundsFromArrow = function( bounds: BoundingBox, ele: Element, prefix: string ): void {
  if( ele.cy().headless() ){ return; }

  let _p = ele._private;
  let rstyle = _p.rstyle;
  let halfArW = ( rstyle.arrowWidth as number ) / 2;
  let arrowType = pstyleOf( ele, prefix + '-arrow-shape' ).value;
  let x;
  let y;

  if( arrowType !== 'none' ){
    if( prefix === 'source' ){
      x = rstyle.srcX as number;
      y = rstyle.srcY as number;
    } else if( prefix === 'target' ){
      x = rstyle.tgtX as number;
      y = rstyle.tgtY as number;
    } else {
      x = rstyle.midX as number;
      y = rstyle.midY as number;
    }

    // always store the individual arrow bounds
    let bbs = _p.arrowBounds = _p.arrowBounds || {};
    let bb = ( bbs[prefix] = bbs[prefix] || ({} as BbCache) ) as BbCache;
    bb.x1 = x - halfArW;
    bb.y1 = y - halfArW;
    bb.x2 = x + halfArW;
    bb.y2 = y + halfArW;
    bb.w = bb.x2 - bb.x1;
    bb.h = bb.y2 - bb.y1;
    expandBoundingBox(bb, 1);

    updateBounds( bounds, bb.x1, bb.y1, bb.x2, bb.y2 );
  }
};

let updateBoundsFromLabel = function( bounds: BoundingBox, ele: Element, prefix: string | null ): BoundingBox {
  if( ele.cy().headless() ){ return bounds; }

  let prefixDash;

  if( prefix ){
    prefixDash = prefix + '-';
  } else {
    prefixDash = '';
  }

  let _p = ele._private;
  let rstyle = _p.rstyle;
  let label = pstyleOf( ele, prefixDash + 'label' ).strValue;

  if( label ){
    let halign = pstyleOf( ele, 'text-halign' );
    let valign = pstyleOf( ele, 'text-valign' );
    let labelWidth = prefixedProperty( rstyle, 'labelWidth', prefix ) as number;
    let labelHeight = prefixedProperty( rstyle, 'labelHeight', prefix ) as number;
    let labelX = prefixedProperty( rstyle, 'labelX', prefix ) as number;
    let labelY = prefixedProperty( rstyle, 'labelY', prefix ) as number;
    let marginX = pstyleOf( ele, prefixDash + 'text-margin-x' ).pfValue as number;
    let marginY = pstyleOf( ele, prefixDash + 'text-margin-y' ).pfValue as number;
    let isEdge = ele.isEdge();
    let rotation = pstyleOf( ele, prefixDash + 'text-rotation' );
    let outlineWidth = pstyleOf( ele, 'text-outline-width' ).pfValue as number;
    let borderWidth = pstyleOf( ele, 'text-border-width' ).pfValue as number;
    let halfBorderWidth = borderWidth / 2;
    let padding = pstyleOf( ele, 'text-background-padding' ).pfValue as number;
    let marginOfError = 2; // expand to work around browser dimension inaccuracies

    let lh = labelHeight;
    let lw = labelWidth;
    let lw_2 = lw / 2;
    let lh_2 = lh / 2;
    let lx1: number, lx2: number, ly1: number, ly2: number;

    if( isEdge ){
      lx1 = labelX - lw_2;
      lx2 = labelX + lw_2;
      ly1 = labelY - lh_2;
      ly2 = labelY + lh_2;
    } else {
      switch( labelHalign( halign.value as string ) ){
        case 'left':
          lx1 = labelX - lw;
          lx2 = labelX;
          break;

        case 'center':
          lx1 = labelX - lw_2;
          lx2 = labelX + lw_2;
          break;

        case 'right':
          lx1 = labelX;
          lx2 = labelX + lw;
          break;
      }

      switch( labelValign( valign.value as string ) ){
        case 'top':
          ly1 = labelY - lh;
          ly2 = labelY;
          break;

        case 'center':
          ly1 = labelY - lh_2;
          ly2 = labelY + lh_2;
          break;

        case 'bottom':
          ly1 = labelY;
          ly2 = labelY + lh;
          break;
      }
    }

    // shift by margin and expand by outline and border
    let leftPad  = marginX - Math.max( outlineWidth, halfBorderWidth ) - padding - marginOfError;
    let rightPad = marginX + Math.max( outlineWidth, halfBorderWidth ) + padding + marginOfError;
    let topPad   = marginY - Math.max( outlineWidth, halfBorderWidth ) - padding - marginOfError;
    let botPad   = marginY + Math.max( outlineWidth, halfBorderWidth ) + padding + marginOfError;

    lx1! += leftPad;
    lx2! += rightPad;
    ly1! += topPad;
    ly2! += botPad;

    // always store the unrotated label bounds separately
    let bbPrefix = prefix || 'main';
    let bbs = _p.labelBounds;
    let bb = ( bbs[bbPrefix] = bbs[bbPrefix] || ({} as BbCache) ) as BbCache;
    bb.x1 = lx1!;
    bb.y1 = ly1!;
    bb.x2 = lx2!;
    bb.y2 = ly2!;
    bb.w = lx2! - lx1!;
    bb.h = ly2! - ly1!;
    bb.leftPad = leftPad;
    bb.rightPad = rightPad;
    bb.topPad = topPad;
    bb.botPad = botPad;

    let isAutorotate = ( isEdge && rotation.strValue === 'autorotate' );
    let isPfValue = ( rotation.pfValue != null && rotation.pfValue !== 0 );

    if( isAutorotate || isPfValue ){
      let theta = isAutorotate ? prefixedProperty( _p.rstyle, 'labelAngle', prefix ) as number : rotation.pfValue as number;
      let cos = Math.cos( theta );
      let sin = Math.sin( theta );

      // rotation point (default value for center-center)
      let xo = (lx1! + lx2!)/2;
      let yo = (ly1! + ly2!)/2;

      if( !isEdge ){
        switch( labelHalign( halign.value as string ) ){
          case 'left':
            xo = lx2!;
            break;

          case 'right':
            xo = lx1!;
            break;
        }

        switch( labelValign( valign.value as string ) ){
          case 'top':
            yo = ly2!;
            break;

          case 'bottom':
            yo = ly1!;
            break;
        }
      }

      let rotate = function( x: number, y: number ){
        x = x - xo;
        y = y - yo;

        return {
          x: x * cos - y * sin + xo,
          y: x * sin + y * cos + yo
        };
      };

      let px1y1 = rotate( lx1!, ly1! );
      let px1y2 = rotate( lx1!, ly2! );
      let px2y1 = rotate( lx2!, ly1! );
      let px2y2 = rotate( lx2!, ly2! );

      lx1 = Math.min( px1y1.x, px1y2.x, px2y1.x, px2y2.x );
      lx2 = Math.max( px1y1.x, px1y2.x, px2y1.x, px2y2.x );
      ly1 = Math.min( px1y1.y, px1y2.y, px2y1.y, px2y2.y );
      ly2 = Math.max( px1y1.y, px1y2.y, px2y1.y, px2y2.y );
    }

    let bbPrefixRot = bbPrefix + 'Rot';
    let bbRot = ( bbs[bbPrefixRot] = bbs[bbPrefixRot] || ({} as BbCache) ) as BbCache;
    bbRot.x1 = lx1!;
    bbRot.y1 = ly1!;
    bbRot.x2 = lx2!;
    bbRot.y2 = ly2!;
    bbRot.w = lx2! - lx1!;
    bbRot.h = ly2! - ly1!;

    updateBounds( bounds, lx1!, ly1!, lx2!, ly2! );
    updateBounds( _p.labelBounds.all as BoundingBox, lx1!, ly1!, lx2!, ly2! );
  }

  return bounds;
};

let updateBoundsFromOutline = function (bounds: BoundingBox, ele: Element): void {
  if (ele.cy().headless()) { return; }

  let outlineOpacity = pstyleOf( ele, 'outline-opacity' ).value as number;
  let outlineWidth = pstyleOf( ele, 'outline-width' ).value as number;
  let outlineOffset = pstyleOf( ele, 'outline-offset' ).value as number;
  let expansion = outlineWidth + outlineOffset;

  updateBoundsFromMiter( bounds, ele, outlineOpacity, expansion, 'outside', expansion/2 );
};

let updateBoundsFromMiter = function( bounds: BoundingBox, ele: Element, opacity: number, expansionSize: number, expansionPosition: string, useFallbackValue?: number ): void {
  if (opacity === 0 || expansionSize <= 0 || expansionPosition === 'inside') {
    return;
  }

  let cy = ele.cy();
  let r = cy.renderer() as unknown as MiterRenderer;
  let rshape = r.nodeShapes[r.getNodeShape(ele)];
  if (!rshape) { return; }
  let { x, y } = ele.position();
  let w = ele.width() as number;
  let h = ele.height() as number;

  if (rshape.hasMiterBounds) {
    if (expansionPosition === 'center') {
      expansionSize /= 2;
    }

    let mbb = rshape.miterBounds!(x, y, w, h, expansionSize);

    updateBoundsFromBox(bounds, mbb);
  } else if (useFallbackValue != null && useFallbackValue > 0) {
    expandBoundingBoxSides(bounds, [useFallbackValue, useFallbackValue, useFallbackValue, useFallbackValue]);
  }
};

let updateBoundsFromMiterBorder = function( bounds: BoundingBox, ele: Element ): void {
  if (ele.cy().headless()) { return; }

  let borderOpacity = pstyleOf( ele, 'border-opacity' ).value as number;
  let borderWidth = pstyleOf( ele, 'border-width' ).pfValue as number;
  let borderPosition = pstyleOf( ele, 'border-position' ).value as string;

  updateBoundsFromMiter(bounds, ele, borderOpacity, borderWidth, borderPosition);
};

// TODO(eles-types): the renderer's node-shape registry is not declared on
// CoreRendererAccess; type it locally until the renderer is converted.
interface MiterRenderer {
  nodeShapes: Record<string, { hasMiterBounds?: boolean; miterBounds?( x: number, y: number, w: number, h: number, expansion: number ): BoundingBox12 } | undefined>;
  getNodeShape( ele: Element ): string;
}

// get the bounding box of the elements (in raw model position)
let boundingBoxImpl = function( ele: Element, options: BoundingBoxOptions ): BoundingBox {
  let cy = ele._private.cy;
  let styleEnabled = cy.styleEnabled();
  let headless = cy.headless();

  let bounds = makeBoundingBox() as BoundingBox;

  let _p = ele._private;
  let isNode = ele.isNode();
  let isEdge = ele.isEdge();
  let ex1, ex2, ey1, ey2; // extrema of body / lines
  let x, y; // node pos
  let rstyle = _p.rstyle;
  let manualExpansion = isNode && styleEnabled ? pstyleOf( ele, 'bounds-expansion' ).pfValue as number[] : [0];

  // must use `display` prop only, as reading `compound.width()` causes recursion
  // (other factors like width values will be considered later in this function anyway)
  let isDisplayed = ( ele: SharedCollection ) => pstyleOf( ele as unknown as Element, 'display' ).value !== 'none';

  let displayed = (
    !styleEnabled
    || (
      isDisplayed(ele)

      // must take into account connected nodes b/c of implicit edge hiding on display:none node
      && ( !isEdge || ( isDisplayed(ele.source()) && isDisplayed(ele.target()) ) )
    )
  );

  if( displayed ){ // displayed suffices, since we will find zero area eles anyway
    let overlayOpacity;
    let overlayPadding = 0;

    if( styleEnabled && options.includeOverlays ){
      overlayOpacity = pstyleOf( ele, 'overlay-opacity' ).value as number;

      if( overlayOpacity !== 0 ){
        overlayPadding = pstyleOf( ele, 'overlay-padding' ).value as number;
      }
    }

    let underlayOpacity;
    let underlayPadding = 0;

    if( styleEnabled && options.includeUnderlays ){
      underlayOpacity = pstyleOf( ele, 'underlay-opacity' ).value as number;

      if( underlayOpacity !== 0 ){
        underlayPadding = pstyleOf( ele, 'underlay-padding' ).value as number;
      }
    }

    let padding = Math.max(overlayPadding, underlayPadding);

    let w;
    let wHalf = 0;

    if( styleEnabled ){
      w = pstyleOf( ele, 'width' ).pfValue as number;
      wHalf = w / 2;
    }

    if( isNode && options.includeNodes ){
      let pos = ele.position();
      x = pos.x;
      y = pos.y;
      let w = ele.outerWidth() as number;
      let halfW = w / 2;
      let h = ele.outerHeight() as number;
      let halfH = h / 2;

      // handle node dimensions
      /////////////////////////

      ex1 = x - halfW;
      ex2 = x + halfW;
      ey1 = y - halfH;
      ey2 = y + halfH;

      updateBounds( bounds, ex1, ey1, ex2, ey2 );

      if( styleEnabled ){
        updateBoundsFromOutline(bounds, ele)
      }

      if( styleEnabled && options.includeOutlines && !headless ){
        updateBoundsFromOutline( bounds, ele );
      }

      if (styleEnabled) {
        updateBoundsFromMiterBorder(bounds, ele);
      }
    } else if( isEdge && options.includeEdges ){

      if( styleEnabled && !headless ){
        let curveStyle = pstyleOf( ele, 'curve-style').strValue as string;


        // handle edge dimensions (rough box estimate)
        //////////////////////////////////////////////

        ex1 = Math.min( rstyle.srcX as number, rstyle.midX as number, rstyle.tgtX as number );
        ex2 = Math.max( rstyle.srcX as number, rstyle.midX as number, rstyle.tgtX as number );
        ey1 = Math.min( rstyle.srcY as number, rstyle.midY as number, rstyle.tgtY as number );
        ey2 = Math.max( rstyle.srcY as number, rstyle.midY as number, rstyle.tgtY as number );

        // take into account edge width
        ex1 -= wHalf;
        ex2 += wHalf;
        ey1 -= wHalf;
        ey2 += wHalf;

        updateBounds( bounds, ex1, ey1, ex2, ey2 );


        // precise edges
        ////////////////

        if( curveStyle === 'haystack' ){
          let hpts = rstyle.haystackPts as Position[];

          if( hpts && hpts.length === 2 ){
            ex1 = hpts[0].x;
            ey1 = hpts[0].y;
            ex2 = hpts[1].x;
            ey2 = hpts[1].y;

            if( ex1 > ex2 ){
              let temp = ex1;
              ex1 = ex2;
              ex2 = temp;
            }

            if( ey1 > ey2 ){
              let temp = ey1;
              ey1 = ey2;
              ey2 = temp;
            }

            updateBounds( bounds, ex1 - wHalf, ey1 - wHalf, ex2 + wHalf, ey2 + wHalf );
          }

        } else if(
          curveStyle === 'bezier' || curveStyle === 'unbundled-bezier'
          || endsWith(curveStyle, 'segments') || endsWith(curveStyle, 'taxi')
        ){
          let pts: Position[] | undefined;

          switch( curveStyle ){
            case 'bezier':
            case 'unbundled-bezier':
              pts = rstyle.bezierPts as Position[];
              break;
            case 'segments':
            case 'taxi':
            case 'round-segments':
            case 'round-taxi':
              pts = rstyle.linePts as Position[];
              break;
          }

          if( pts != null ){
            for( let j = 0; j < pts.length; j++ ){
              let pt = pts[ j ];

              ex1 = pt.x - wHalf;
              ex2 = pt.x + wHalf;
              ey1 = pt.y - wHalf;
              ey2 = pt.y + wHalf;

              updateBounds( bounds, ex1, ey1, ex2, ey2 );
            }
          }
        } // bezier-like or segment-like edge
      } else { // headless or style disabled

        // fallback on source and target positions
        //////////////////////////////////////////

        let n1 = ele.source();
        let n1pos = n1.position();

        let n2 = ele.target();
        let n2pos = n2.position();

        ex1 = n1pos.x;
        ex2 = n2pos.x;
        ey1 = n1pos.y;
        ey2 = n2pos.y;

        if( ex1 > ex2 ){
          let temp = ex1;
          ex1 = ex2;
          ex2 = temp;
        }

        if( ey1 > ey2 ){
          let temp = ey1;
          ey1 = ey2;
          ey2 = temp;
        }

        // take into account edge width
        ex1 -= wHalf;
        ex2 += wHalf;
        ey1 -= wHalf;
        ey2 += wHalf;

        updateBounds( bounds, ex1, ey1, ex2, ey2 );
      } // headless or style disabled

    } // edges

    // handle edge arrow size
    /////////////////////////

    if( styleEnabled && options.includeEdges && isEdge ){
      updateBoundsFromArrow( bounds, ele, 'mid-source' );
      updateBoundsFromArrow( bounds, ele, 'mid-target' );
      updateBoundsFromArrow( bounds, ele, 'source' );
      updateBoundsFromArrow( bounds, ele, 'target' );
    }

    // ghost
    ////////

    if( styleEnabled ){
      let ghost = pstyleOf( ele, 'ghost' ).value === 'yes';

      if( ghost ){
        let gx = pstyleOf( ele, 'ghost-offset-x' ).pfValue as number;
        let gy = pstyleOf( ele, 'ghost-offset-y' ).pfValue as number;

        updateBounds( bounds, bounds.x1 + gx, bounds.y1 + gy, bounds.x2 + gx, bounds.y2 + gy );
      }
    }

    // always store the body bounds separately from the labels
    let bbBody = ( _p.bodyBounds = _p.bodyBounds || ( {} as BoundingBox & Record<string, unknown> ) ) as BoundingBox;
    assignBoundingBox(bbBody, bounds);
    expandBoundingBoxSides(bbBody, manualExpansion);
    expandBoundingBox(bbBody, 1); // expand to work around browser dimension inaccuracies

    // overlay
    //////////

    if( styleEnabled ){
      ex1 = bounds.x1;
      ex2 = bounds.x2;
      ey1 = bounds.y1;
      ey2 = bounds.y2;

      updateBounds( bounds, ex1 - padding, ey1 - padding, ex2 + padding, ey2 + padding );
    }

    // always store the body bounds separately from the labels
    let bbOverlay = ( _p.overlayBounds = _p.overlayBounds || ( {} as BoundingBox & Record<string, unknown> ) ) as BoundingBox;
    assignBoundingBox(bbOverlay, bounds);
    expandBoundingBoxSides(bbOverlay, manualExpansion);
    expandBoundingBox(bbOverlay, 1); // expand to work around browser dimension inaccuracies

    // handle label dimensions
    //////////////////////////

    let bbLabels = _p.labelBounds = _p.labelBounds || {};

    if( bbLabels.all != null ){
      clearBoundingBox(bbLabels.all);
    } else {
      bbLabels.all = makeBoundingBox() as BoundingBox & Record<string, unknown>;
    }

    if( styleEnabled && options.includeLabels ){
      if( options.includeMainLabels ){
        updateBoundsFromLabel( bounds, ele, null );
      }

      if( isEdge ){
        if( options.includeSourceLabels ){
          updateBoundsFromLabel( bounds, ele, 'source' );
        }

        if( options.includeTargetLabels ){
          updateBoundsFromLabel( bounds, ele, 'target' );
        }
      }
    } // style enabled for labels
  } // if displayed


  bounds.x1 = noninf( bounds.x1 );
  bounds.y1 = noninf( bounds.y1 );
  bounds.x2 = noninf( bounds.x2 );
  bounds.y2 = noninf( bounds.y2 );
  bounds.w = noninf( bounds.x2 - bounds.x1 );
  bounds.h = noninf( bounds.y2 - bounds.y1 );

  if( bounds.w > 0 && bounds.h > 0 && displayed ){
    expandBoundingBoxSides( bounds, manualExpansion );

    // expand bounds by 1 because antialiasing can increase the visual/effective size by 1 on all sides
    expandBoundingBox( bounds, 1 );
  }

  return bounds;
};

let getKey = function( opts: BoundingBoxOptions ): number {
  let i = 0;
  let tf = ( val: unknown ) => (val ? 1 : 0) << i++;
  let key = 0;

  key += tf( opts.incudeNodes );
  key += tf( opts.includeEdges );
  key += tf( opts.includeLabels );
  key += tf( opts.includeMainLabels );
  key += tf( opts.includeSourceLabels );
  key += tf( opts.includeTargetLabels );
  key += tf( opts.includeOverlays );
  key += tf( opts.includeOutlines );

  return key;
};

let getBoundingBoxPosKey = ( ele: Element ): number | undefined => {
  let r = ( x: number ) => Math.round(x);

  if( ele.isEdge() ){
    let p1 = ele.source().position();
    let p2 = ele.target().position();

    return hashIntsArray([ r(p1.x), r(p1.y), r(p2.x), r(p2.y) ]);
  } else {
    let p = ele.position();

    return hashIntsArray([ r(p.x), r(p.y) ]);
  }
};

let cachedBoundingBoxImpl = function( ele: Element, opts: BoundingBoxOptions | null | undefined ): BoundingBox {
  let _p = ele._private;
  let bb: BoundingBox;
  let isEdge = ele.isEdge();
  let key = opts == null ? defBbOptsKey : getKey( opts );
  let usingDefOpts = key === defBbOptsKey;

  if( _p.bbCache == null ){
    bb = boundingBoxImpl( ele, defBbOpts );

    _p.bbCache = bb as BoundingBox & Record<string, unknown>;
    _p.bbCachePosKey = getBoundingBoxPosKey( ele );
  } else {
    bb = _p.bbCache;
  }

  // not using def opts => need to build up bb from combination of sub bbs
  if( !usingDefOpts ){
    let isNode = ele.isNode();

    bb = makeBoundingBox() as BoundingBox;

    if( (opts!.includeNodes && isNode) || (opts!.includeEdges && !isNode) ){
      if( opts!.includeOverlays ){
        updateBoundsFromBox(bb, _p.overlayBounds);
      } else {
        updateBoundsFromBox(bb, _p.bodyBounds);
      }
    }

    if( opts!.includeLabels ){
      if( opts!.includeMainLabels && (!isEdge || (opts!.includeSourceLabels && opts!.includeTargetLabels)) ){
        updateBoundsFromBox(bb, _p.labelBounds.all);
      } else {
        if( opts!.includeMainLabels ){
          updateBoundsFromBox(bb, _p.labelBounds.mainRot);
        }

        if( opts!.includeSourceLabels ){
          updateBoundsFromBox(bb, _p.labelBounds.sourceRot);
        }

        if( opts!.includeTargetLabels ){
          updateBoundsFromBox(bb, _p.labelBounds.targetRot);
        }
      }
    }

    bb.w = bb.x2 - bb.x1;
    bb.h = bb.y2 - bb.y1;
  }

  return bb;
};

let defBbOpts: BoundingBoxOptions = {
  includeNodes: true,
  includeEdges: true,
  includeLabels: true,
  includeMainLabels: true,
  includeSourceLabels: true,
  includeTargetLabels: true,
  includeOverlays: true,
  includeUnderlays: true,
  includeOutlines: true,
  useCache: true
};

const defBbOptsKey = getKey( defBbOpts );

const filledBbOpts = defaults( defBbOpts as Record<string, unknown> );

elesfn.boundingBox = function( this: Collection, options?: BoundingBoxOptions ): BoundingBox {
  let bounds: BoundingBox;

  let useCache = (options === undefined || options.useCache === undefined || options.useCache === true);

  let isDirty = memoize(( ele: Element ) => {
    let _p = ele._private;

    return _p.bbCache == null || _p.styleDirty || _p.bbCachePosKey !== getBoundingBoxPosKey(ele);
  }, ( ele: Element ) => ele.id() as string);

  // the main usecase is ele.boundingBox() for a single element with no/def options
  // specified s.t. the cache is used, so check for this case to make it faster by
  // avoiding the overhead of the rest of the function
  if (useCache && this.length === 1 && !isDirty(this[0])) {
    if (options === undefined) {
      options = defBbOpts;
    } else {
      options = filledBbOpts( options as Record<string, unknown> ) as BoundingBoxOptions;
    }

    bounds = cachedBoundingBoxImpl(this[0], options);
  } else {
    bounds = makeBoundingBox() as BoundingBox;

    options = options || defBbOpts;

    let opts = filledBbOpts(options as Record<string, unknown>) as BoundingBoxOptions;

    let eles = this; // eslint-disable-line @typescript-eslint/no-this-alias
    let cy = eles.cy();
    let styleEnabled = cy.styleEnabled();

    // cache the isDirty state for all eles, edges first since they depend on node state
    this.edges().forEach(isDirty);
    this.nodes().forEach(isDirty);

    if(styleEnabled) {
      this.recalculateRenderedStyle(useCache);
    }

    this.updateCompoundBounds(!useCache);

    for (let i = 0; i < eles.length; i++) {
      let ele = eles[i];

      if (isDirty(ele)) {
        ele.dirtyBoundingBoxCache();
      }

      updateBoundsFromBox(bounds, cachedBoundingBoxImpl(ele, opts));
    }
  }

  bounds.x1 = noninf( bounds.x1 );
  bounds.y1 = noninf( bounds.y1 );
  bounds.x2 = noninf( bounds.x2 );
  bounds.y2 = noninf( bounds.y2 );
  bounds.w = noninf( bounds.x2 - bounds.x1 );
  bounds.h = noninf( bounds.y2 - bounds.y1 );

  return bounds;
};

elesfn.dirtyBoundingBoxCache = function( this: Collection ){
  for( let i = 0; i < this.length; i++ ){
    let _p = this[i]._private;

    _p.bbCache = null;
    _p.bbCachePosKey = null;
    _p.bodyBounds = null;
    _p.overlayBounds = null;
    _p.labelBounds.all = null;
    _p.labelBounds.source = null;
    _p.labelBounds.target = null;
    _p.labelBounds.main = null;
    _p.labelBounds.sourceRot = null;
    _p.labelBounds.targetRot = null;
    _p.labelBounds.mainRot = null;
    _p.arrowBounds.source = null;
    _p.arrowBounds.target = null;
    _p.arrowBounds['mid-source'] = null;
    _p.arrowBounds['mid-target'] = null;
  }

  this.emitAndNotify('bounds');

  return this;
};

// private helper to get bounding box for custom node positions
// - good for perf in certain cases but currently requires dirtying the rendered style
// - would be better to not modify the nodes but the nodes are read directly everywhere in the renderer...
// - try to use for only things like discrete layouts where the node position would change anyway
elesfn.boundingBoxAt = function( this: Collection, fn: ( ( node: Element, i: number ) => Position ) | Position ): BoundingBox {
  let nodes = this.nodes();
  let cy = this.cy();
  let hasCompoundNodes = cy.hasCompoundNodes();
  let parents = cy.collection();

  if( hasCompoundNodes ){
    parents = nodes.filter(( node: Element ) => node.isParent());
    nodes = nodes.not(parents);
  }

  let posFn: ( node: Element, i: number ) => Position;
  if( is.plainObject( fn ) ){
    let obj = fn;

    posFn = function(){ return obj as Position; };
  } else {
    posFn = fn as ( node: Element, i: number ) => Position;
  }

  let storeOldPos = ( node: Element, i: number ) => node._private.bbAtOldPos = posFn(node, i);
  let getOldPos = ( node: Element ) => node._private.bbAtOldPos as Position;

  cy.startBatch();

  (
    nodes
    .forEach(storeOldPos)
    .silentPositions(posFn)
  );

  if( hasCompoundNodes ){
    parents.dirtyCompoundBoundsCache();
    parents.dirtyBoundingBoxCache();
    parents.updateCompoundBounds(true); // force update b/c we're inside a batch cycle
  }

  let bb = copyBoundingBox( this.boundingBox({ useCache: false }) );

  nodes.silentPositions(getOldPos);

  if( hasCompoundNodes ){
    parents.dirtyCompoundBoundsCache();
    parents.dirtyBoundingBoxCache();
    parents.updateCompoundBounds(true); // force update b/c we're inside a batch cycle
  }

  cy.endBatch();

  return bb;
};

fn.boundingbox = fn.bb = fn.boundingBox;
fn.renderedBoundingbox = fn.renderedBoundingBox;

export default elesfn as CollectionBounds;
