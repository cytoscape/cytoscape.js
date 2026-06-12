/* global Path2D */

import * as util from '../../../util/index.mjs';
import {drawPreparedRoundCorner} from "../../../round.mjs";
import type { Renderer, Element } from '../renderer-types.mjs';

// Parsed style property as read by the renderer. The underlying value/pfValue
// shapes are property-dependent (numbers, colour tuples, strings, ...), so the
// read fields are typed loosely here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- parsed style values are property-dependent unions
type PStyle = { value: any; pfValue: any; strValue: string; units: string };

// Geometry/rendering scratch bag attached to an edge (`edge._private.rscratch`).
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- rscratch is an open-ended internal geometry cache
type RScratch = any;

// A 2-tuple of canvas position numbers (`{x, y}`).
interface XY { x: number; y: number; }

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- CRp is mixed into the renderer prototype
let CRp: { [key: string]: any } = {};

CRp.drawEdge = function( this: Renderer, context: CanvasRenderingContext2D, edge: Element, shiftToOriginWithBb: { x1: number; y1: number } | false | undefined, drawLabel = true, shouldDrawOverlay = true, shouldDrawOpacity = true ){
  let r = this; // eslint-disable-line @typescript-eslint/no-this-alias
  let rs: RScratch = edge._private.rscratch;

  if( shouldDrawOpacity && !edge.visible() ){ return; }

  // if bezier ctrl pts can not be calculated, then die
  if( rs.badLine || rs.allpts == null || isNaN(rs.allpts[0]) ){ // isNaN in case edge is impossible and browser bugs (e.g. safari)
    return;
  }

  let bb: { x1: number; y1: number } | undefined;
  if( shiftToOriginWithBb ){
    bb = shiftToOriginWithBb;

    context.translate( -bb.x1, -bb.y1 );
  }

  let opacity = shouldDrawOpacity ? (edge.pstyle('opacity') as PStyle).value : 1;
  let lineOpacity = shouldDrawOpacity ? (edge.pstyle('line-opacity') as PStyle).value : 1;

  let curveStyle = (edge.pstyle('curve-style') as PStyle).value;
  let lineStyle = (edge.pstyle('line-style') as PStyle).value;
  let edgeWidth = (edge.pstyle('width') as PStyle).pfValue;
  let lineCap = (edge.pstyle('line-cap') as PStyle).value;
  let lineOutlineWidth = (edge.pstyle('line-outline-width') as PStyle).value;
  let lineOutlineColor = (edge.pstyle('line-outline-color') as PStyle).value;

  let effectiveLineOpacity = opacity * lineOpacity;
  // separate arrow opacity would require arrow-opacity property
  let effectiveArrowOpacity = opacity * lineOpacity;

  let drawLine = ( strokeOpacity = effectiveLineOpacity) => {
    if (curveStyle === 'straight-triangle') {
      r.eleStrokeStyle( context, edge, strokeOpacity );
      r.drawEdgeTrianglePath(
        edge,
        context,
        rs.allpts
      );
    } else {
      context.lineWidth = edgeWidth;
      context.lineCap = lineCap;
  
      r.eleStrokeStyle( context, edge, strokeOpacity );
      r.drawEdgePath(
        edge,
        context,
        rs.allpts,
        lineStyle
      );
  
      context.lineCap = 'butt'; // reset for other drawing functions
    }
  };

  let drawLineOutline = ( strokeOpacity = effectiveLineOpacity) => {
    context.lineWidth = edgeWidth + lineOutlineWidth;
    context.lineCap = lineCap;

    if (lineOutlineWidth > 0) {
      r.colorStrokeStyle( context, lineOutlineColor[0], lineOutlineColor[1], lineOutlineColor[2], strokeOpacity );
    } else {
      // do not draw any lineOutline
      context.lineCap = 'butt'; // reset for other drawing functions
      return;
    }

    if (curveStyle === 'straight-triangle') {
      r.drawEdgeTrianglePath(
        edge,
        context,
        rs.allpts
      );
    } else { 
      r.drawEdgePath(
        edge,
        context,
        rs.allpts,
        lineStyle
      );
  
      context.lineCap = 'butt'; // reset for other drawing functions
    }
  };

  let drawOverlay = () => {
    if( !shouldDrawOverlay ){ return; }

    r.drawEdgeOverlay( context, edge );
  };

  let drawUnderlay = () => {
    if( !shouldDrawOverlay ){ return; }

    r.drawEdgeUnderlay( context, edge );
  };

  let drawArrows = ( arrowOpacity = effectiveArrowOpacity) => {
    r.drawArrowheads( context, edge, arrowOpacity );
  };

  let drawText = () => {
    r.drawElementText( context, edge, null, drawLabel );
  };

  context.lineJoin = 'round';

  let ghost = (edge.pstyle('ghost') as PStyle).value === 'yes';

  if( ghost ){
    let gx = (edge.pstyle('ghost-offset-x') as PStyle).pfValue;
    let gy = (edge.pstyle('ghost-offset-y') as PStyle).pfValue;
    let ghostOpacity = (edge.pstyle('ghost-opacity') as PStyle).value;
    let effectiveGhostOpacity = effectiveLineOpacity * ghostOpacity;

    context.translate( gx, gy );

    drawLine( effectiveGhostOpacity );
    drawArrows( effectiveGhostOpacity );

    context.translate( -gx, -gy );
  } else {
    drawLineOutline();
  }

  drawUnderlay();
  drawLine();
  drawArrows();
  drawOverlay();
  drawText();

  if( shiftToOriginWithBb ){
    context.translate( bb!.x1, bb!.y1 );
  }
};

const drawEdgeOverlayUnderlay = function( overlayOrUnderlay: string ) {
  if (!['overlay', 'underlay'].includes(overlayOrUnderlay)) {
    throw new Error('Invalid state');
  }

  return function( this: Renderer, context: CanvasRenderingContext2D, edge: Element ){
    if( !edge.visible() ){ return; }

    let opacity = (edge.pstyle(`${overlayOrUnderlay}-opacity`) as PStyle).value;

    if( opacity === 0 ){ return; }

    let r = this; // eslint-disable-line @typescript-eslint/no-this-alias
    let usePaths = r.usePaths();
    let rs: RScratch = edge._private.rscratch;

    let padding = (edge.pstyle(`${overlayOrUnderlay}-padding`) as PStyle).pfValue;
    let width = 2 * padding;
    let color = (edge.pstyle(`${overlayOrUnderlay}-color`) as PStyle).value;
  
    context.lineWidth = width;
  
    if( rs.edgeType === 'self' && !usePaths ){
      context.lineCap = 'butt';
    } else {
      context.lineCap = 'round';
    }
  
    r.colorStrokeStyle( context, color[0], color[1], color[2], opacity );
  
    r.drawEdgePath(
      edge,
      context,
      rs.allpts,
      'solid'
    );
  };
};

CRp.drawEdgeOverlay = drawEdgeOverlayUnderlay('overlay');

CRp.drawEdgeUnderlay = drawEdgeOverlayUnderlay('underlay');


CRp.drawEdgePath = function( this: Renderer, edge: Element, context: CanvasRenderingContext2D, pts: number[], type: string ){
  let rs: RScratch = edge._private.rscratch;
  let canvasCxt = context;
  // Path2D | CanvasRenderingContext2D when usePaths; both expose the drawing
  // calls used below, so type as the canvas context for assignment/use.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- path may be a Path2D used as a drawing target
  let path: any;
  let pathCacheHit = false;
  let usePaths = this.usePaths();
  let lineDashPattern = (edge.pstyle('line-dash-pattern') as PStyle).pfValue;
  let lineDashOffset = (edge.pstyle('line-dash-offset') as PStyle).pfValue;

  if( usePaths ){
    let pathCacheKey = pts.join( '$' );
    let keyMatches = rs.pathCacheKey && rs.pathCacheKey === pathCacheKey;

    if( keyMatches ){
      // when usePaths, drawing is redirected to a Path2D (same drawing calls)
      path = context = rs.pathCache as unknown as CanvasRenderingContext2D;
      pathCacheHit = true;
    } else {
      path = context = new Path2D() as unknown as CanvasRenderingContext2D;
      rs.pathCacheKey = pathCacheKey;
      rs.pathCache = path;
    }
  }

  if( canvasCxt.setLineDash ){ // for very outofdate browsers
    switch( type ){
      case 'dotted':
        canvasCxt.setLineDash( [ 1, 1 ] );
        break;

      case 'dashed':
        canvasCxt.setLineDash( lineDashPattern );
        canvasCxt.lineDashOffset = lineDashOffset;
        break;

      case 'solid':
        canvasCxt.setLineDash( [ ] );
        break;
    }
  }

  if( !pathCacheHit && !rs.badLine ){
    if( context.beginPath ){ context.beginPath(); }
    context.moveTo( pts[0], pts[1] );

    switch( rs.edgeType ){
      case 'bezier':
      case 'self':
      case 'compound':
      case 'multibezier':
        for( let i = 2; i + 3 < pts.length; i += 4 ){
          context.quadraticCurveTo( pts[ i ], pts[ i + 1], pts[ i + 2], pts[ i + 3] );
        }
        break;

      case 'straight':
      case 'haystack':
        for( let i = 2; i + 1 < pts.length; i += 2 ) {
          context.lineTo( pts[ i ], pts[ i + 1] );
        }
        break;
      case 'segments':
        if (rs.isRound) {
          for( let corner of rs.roundCorners ){
            drawPreparedRoundCorner(context, corner);
          }
          context.lineTo( pts[ pts.length - 2 ], pts[ pts.length - 1] );
        } else {
          for( let i = 2; i + 1 < pts.length; i += 2 ) {
            context.lineTo( pts[ i ], pts[ i + 1] );
          }
        }
        break;
    }
  }

  context = canvasCxt;
  if( usePaths ){
    context.stroke( path );
  } else {
    context.stroke();
  }

  // reset any line dashes
  if( context.setLineDash ){ // for very outofdate browsers
    context.setLineDash( [ ] );
  }

};


CRp.drawEdgeTrianglePath = function( this: Renderer, edge: Element, context: CanvasRenderingContext2D, pts: number[] ){
  // use line stroke style for triangle fill style
  context.fillStyle = context.strokeStyle;

  let edgeWidth = (edge.pstyle('width') as PStyle).pfValue;

  for( let i = 0; i + 1 < pts.length; i += 2 ){
    const vector = [ pts[ i + 2 ] - pts[ i ], pts[ i + 3 ] - pts[ i + 1 ] ];
    const length = Math.sqrt( vector[0] * vector[0] + vector[1] * vector[1] );
    const normal = [ vector[1] / length, -vector[0] / length ];
    const triangleHead = [ normal[0] * edgeWidth / 2, normal[1] * edgeWidth / 2 ];

    context.beginPath();
    context.moveTo( pts[ i ] - triangleHead[0], pts[ i + 1 ] - triangleHead[1] );
    context.lineTo( pts[ i ] + triangleHead[0], pts[ i + 1 ] + triangleHead[1] );
    context.lineTo( pts[ i + 2 ], pts[ i + 3 ] );
    context.closePath();
    context.fill();
  }
};

CRp.drawArrowheads = function( this: Renderer, context: CanvasRenderingContext2D, edge: Element, opacity: number ){
  let rs: RScratch = edge._private.rscratch;
  let isHaystack = rs.edgeType === 'haystack';

  if( !isHaystack ){
    this.drawArrowhead( context, edge, 'source', rs.arrowStartX, rs.arrowStartY, rs.srcArrowAngle, opacity );
  }

  this.drawArrowhead( context, edge, 'mid-target', rs.midX, rs.midY, rs.midtgtArrowAngle, opacity );

  this.drawArrowhead( context, edge, 'mid-source', rs.midX, rs.midY, rs.midsrcArrowAngle, opacity );

  if( !isHaystack ){
    this.drawArrowhead( context, edge, 'target', rs.arrowEndX, rs.arrowEndY, rs.tgtArrowAngle, opacity );
  }
};

CRp.drawArrowhead = function( this: Renderer, context: CanvasRenderingContext2D, edge: Element, prefix: string, x: number, y: number, angle: number, opacity: number | undefined ){
  if( isNaN( x ) || x == null || isNaN( y ) || y == null || isNaN( angle ) || angle == null ){ return; }

  let self = this; // eslint-disable-line @typescript-eslint/no-this-alias
  let arrowShape = (edge.pstyle( prefix + '-arrow-shape' ) as PStyle).value;
  if( arrowShape === 'none' ) { return; }

  let arrowClearFill = (edge.pstyle( prefix + '-arrow-fill' ) as PStyle).value === 'hollow' ? 'both' : 'filled';
  let arrowFill = (edge.pstyle( prefix + '-arrow-fill' ) as PStyle).value;
  let edgeWidth = (edge.pstyle( 'width' ) as PStyle).pfValue;

  let pArrowWidth = edge.pstyle( prefix + '-arrow-width' ) as PStyle;
  let arrowWidth = pArrowWidth.value === 'match-line' ? edgeWidth : pArrowWidth.pfValue;
  if (pArrowWidth.units === '%') arrowWidth *= edgeWidth;

  let edgeOpacity = (edge.pstyle( 'opacity' ) as PStyle).value;

  if( opacity === undefined ){
    opacity = edgeOpacity;
  }

  let gco = context.globalCompositeOperation;

  if( opacity !== 1 || arrowFill === 'hollow' ){ // then extra clear is needed
    context.globalCompositeOperation = 'destination-out';

    self.colorFillStyle( context, 255, 255, 255, 1 );
    self.colorStrokeStyle( context, 255, 255, 255, 1 );

    self.drawArrowShape( edge, context,
      arrowClearFill, edgeWidth, arrowShape, arrowWidth, x, y, angle
    );

    context.globalCompositeOperation = gco;
  } // otherwise, the opaque arrow clears it for free :)

  let color = (edge.pstyle( prefix + '-arrow-color' ) as PStyle).value;
  self.colorFillStyle( context, color[0], color[1], color[2], opacity );
  self.colorStrokeStyle( context, color[0], color[1], color[2], opacity );

  self.drawArrowShape( edge, context,
    arrowFill, edgeWidth, arrowShape, arrowWidth, x, y, angle
  );
};

CRp.drawArrowShape = function( this: Renderer, edge: Element, context: CanvasRenderingContext2D, fill: string, edgeWidth: number, shape: string, shapeWidth: number, x: number, y: number, angle: number ){
  let r = this; // eslint-disable-line @typescript-eslint/no-this-alias
  let usePaths = this.usePaths() && shape !== 'triangle-cross';
  let pathCacheHit = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- path may be a Path2D used as a drawing target
  let path: any;
  let canvasContext = context;
  let translation: XY = { x, y };
  let scale = (edge.pstyle( 'arrow-scale' ) as PStyle).value;
  let size = this.getArrowWidth( edgeWidth, scale );
  let shapeImpl = r.arrowShapes[ shape ];

  if( usePaths ){
    let cache = r.arrowPathCache = r.arrowPathCache || [];
    let key = util.hashString(shape);
    let cachedPath = cache[ key ];

    if( cachedPath != null ){
      path = context = cachedPath;
      pathCacheHit = true;
    } else {
      path = context = new Path2D() as unknown as CanvasRenderingContext2D;
      cache[ key ] = path;
    }
  }

  if( !pathCacheHit ){
    if( context.beginPath ){ context.beginPath(); }
    if( usePaths ){ // store in the path cache with values easily manipulated later
      shapeImpl.draw( context, 1, 0, { x: 0, y: 0 }, 1 );
    } else {
      shapeImpl.draw( context, size, angle, translation, edgeWidth );
    }
    if( context.closePath ){ context.closePath(); }
  }

  context = canvasContext;

  if( usePaths ){ // set transform to arrow position/orientation
    context.translate( x, y );
    context.rotate( angle );
    context.scale( size, size );
  }

  if( fill === 'filled' || fill === 'both' ){
    if( usePaths ){
      context.fill( path );
    } else {
      context.fill();
    }
  }

  if( fill === 'hollow' || fill === 'both' ){
    context.lineWidth = shapeWidth / (usePaths ? size : 1);
    context.lineJoin = 'miter';

    if( usePaths ){
      context.stroke( path );
    } else {
      context.stroke();
    }
  }

  if( usePaths ){ // reset transform by applying inverse
    context.scale( 1/size, 1/size );
    context.rotate( -angle );
    context.translate( -x, -y );
  }
};

export default CRp;
