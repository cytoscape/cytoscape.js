import * as math from '../../../math.mjs';
import * as is from '../../../is.mjs';
import * as util from '../../../util/index.mjs';
import type { Renderer, Position } from '../renderer-types.mjs';

/* eslint-disable @typescript-eslint/no-explicit-any --
   arrow-shape impls are an open-ended, internal registry of canvas/math fns */

interface ArrowShape {
  name?: string;
  [key: string]: any;
}

let BRp: Record<string, any> = {};

BRp.arrowShapeWidth = 0.3;

BRp.registerArrowShapes = function( this: Renderer ){
  let arrowShapes: Record<string, ArrowShape> = this.arrowShapes = {};
  let renderer = this; // eslint-disable-line @typescript-eslint/no-this-alias

  // Contract for arrow shapes:
  // 0, 0 is arrow tip
  // (0, 1) is direction towards node
  // (1, 0) is right
  //
  // functional api:
  // collide: check x, y in shape
  // roughCollide: called before collide, no false negatives
  // draw: draw
  // spacing: dist(arrowTip, nodeBoundary)
  // gap: dist(edgeTip, nodeBoundary), edgeTip may != arrowTip

  let bbCollide = function( x: number, y: number, size: number, angle: number, translation: Position, edgeWidth?: number, padding?: number ){
    let x1 = translation.x - size / 2 - ( padding as number );
    let x2 = translation.x + size / 2 + ( padding as number );
    let y1 = translation.y - size / 2 - ( padding as number );
    let y2 = translation.y + size / 2 + ( padding as number );

    let inside = (x1 <= x && x <= x2) && (y1 <= y && y <= y2);

    return inside;
  };

  let transform = function( x: number, y: number, size: number, angle: number, translation: Position ): Position {
    let xRotated = x * Math.cos( angle ) - y * Math.sin( angle );
    let yRotated = x * Math.sin( angle ) + y * Math.cos( angle );

    let xScaled = xRotated * size;
    let yScaled = yRotated * size;

    let xTranslated = xScaled + translation.x;
    let yTranslated = yScaled + translation.y;

    return {
      x: xTranslated,
      y: yTranslated
    };
  };

  let transformPoints = function( pts: number[], size: number, angle: number, translation: Position ): Position[] {
    let retPts: Position[] = [];

    for( let i = 0; i < pts.length; i += 2 ){
      let x = pts[ i ];
      let y = pts[ i + 1];

      retPts.push( transform( x, y, size, angle, translation ) );
    }

    return retPts;
  };

  let pointsToArr = function( pts: Position[] ): number[] {
    let ret: number[] = [];

    for( let i = 0; i < pts.length; i++ ){
      let p = pts[ i ];

      ret.push( p.x, p.y );
    }

    return ret;
  };

  let standardGap = function( edge: any ): number {
    return ( edge.pstyle( 'width' ).pfValue as number ) * ( edge.pstyle( 'arrow-scale' ).pfValue as number ) * 2;
  };

  let defineArrowShape = function( name: string, defn: string | Record<string, any> ){
    if( is.string( defn ) ){
      defn = arrowShapes[ defn as string ];
    }

    arrowShapes[ name ] = util.extend( {
      name: name,

      points: [
        -0.15, -0.3,
        0.15, -0.3,
        0.15, 0.3,
        -0.15, 0.3
      ],

      collide: function( this: ArrowShape, x: number, y: number, size: number, angle: number, translation: Position, padding: number ){
        let points = pointsToArr( transformPoints( this.points, size + 2 * padding, angle, translation ) );
        let inside = math.pointInsidePolygonPoints( x, y, points );

        return inside;
      },

      roughCollide: bbCollide,

      draw: function( this: ArrowShape, context: any, size: number, angle: number, translation: Position ){
        let points = transformPoints( this.points, size, angle, translation );

        renderer.arrowShapeImpl( 'polygon' )( context, points );
      },

      spacing: function( edge: any ){
        return 0;
      },

      gap: standardGap
    }, defn );
  };

  defineArrowShape( 'none', {
    collide: util.falsify,

    roughCollide: util.falsify,

    draw: util.noop,

    spacing: util.zeroify,

    gap: util.zeroify
  } );

  defineArrowShape( 'triangle', {
    points: [
      -0.15, -0.3,
      0, 0,
      0.15, -0.3
    ]
  } );

  defineArrowShape( 'arrow', 'triangle' );

  defineArrowShape( 'triangle-backcurve', {
    points: arrowShapes[ 'triangle' ].points as number[],

    controlPoint: [ 0, -0.15 ],

    roughCollide: bbCollide,

    draw: function( this: ArrowShape, context: any, size: number, angle: number, translation: Position, edgeWidth?: number ){
      let ptsTrans = transformPoints( this.points, size, angle, translation );
      let ctrlPt = this.controlPoint;
      let ctrlPtTrans = transform( ctrlPt[0], ctrlPt[1], size, angle, translation );

      renderer.arrowShapeImpl( this.name )( context, ptsTrans, ctrlPtTrans );
    },

    gap: function( edge: any ){
      return standardGap(edge) * 0.8;
    }
  } );

  defineArrowShape( 'triangle-tee', {
    points: [
      0, 0,
      0.15, -0.3,
      -0.15, -0.3,
      0, 0
    ],

    pointsTee: [
      -0.15, -0.4,
      -0.15, -0.5,
      0.15, -0.5,
      0.15, -0.4
    ],

    collide: function( this: ArrowShape, x: number, y: number, size: number, angle: number, translation: Position, edgeWidth: number, padding: number ){
      let triPts = pointsToArr( transformPoints( this.points, size + 2 * padding, angle, translation ) );
      let teePts = pointsToArr( transformPoints( this.pointsTee, size + 2 * padding, angle, translation ) );

      let inside = math.pointInsidePolygonPoints( x, y, triPts ) || math.pointInsidePolygonPoints( x, y, teePts );

      return inside;
    },

    draw: function( this: ArrowShape, context: any, size: number, angle: number, translation: Position, edgeWidth?: number ){
      let triPts = transformPoints( this.points, size, angle, translation );
      let teePts = transformPoints( this.pointsTee, size, angle, translation );

      renderer.arrowShapeImpl( this.name )( context, triPts, teePts );
    }
  } );

  defineArrowShape( 'circle-triangle', {
    radius: 0.15,
    pointsTr: [0, -0.15, 0.15, -0.45, -0.15, -0.45, 0, -0.15],
    collide: function collide( this: ArrowShape, x: number, y: number, size: number, angle: number, translation: Position, edgeWidth: number, padding: number ) {
      let t = translation;
      let circleInside = Math.pow(t.x - x, 2) + Math.pow(t.y - y, 2) <= Math.pow((size + 2 * padding) * this.radius, 2);
      let triPts = pointsToArr(transformPoints(this.points, size + 2 * padding, angle, translation));
      return math.pointInsidePolygonPoints(x, y, triPts) || circleInside;
    },
    draw: function draw( this: ArrowShape, context: any, size: number, angle: number, translation: Position, edgeWidth?: number ) {
      let triPts = transformPoints(this.pointsTr, size, angle, translation);
      renderer.arrowShapeImpl(this.name)(context, triPts, translation.x, translation.y, this.radius * size);
    },
    spacing: function spacing( this: ArrowShape, edge: any ) {
      return renderer.getArrowWidth(edge.pstyle('width').pfValue, edge.pstyle('arrow-scale').value) * this.radius;
    }
  } );

  defineArrowShape( 'triangle-cross', {
    points: [
      0, 0,
      0.15, -0.3,
      -0.15, -0.3,
      0, 0
    ],

    baseCrossLinePts: [
      -0.15, -0.4,    // first half of the rectangle
      -0.15, -0.4,
      0.15, -0.4,    // second half of the rectangle
      0.15, -0.4
    ],

    crossLinePts: function( this: ArrowShape, size: number, edgeWidth: number ){
      // shift points so that the distance between the cross points matches edge width
      let p = this.baseCrossLinePts.slice();
      let shiftFactor = edgeWidth / size;
      let y0 = 3;
      let y1 = 5;

      p[y0] = p[y0] - shiftFactor;
      p[y1] = p[y1] - shiftFactor;

      return p;
    },

    collide: function( this: ArrowShape, x: number, y: number, size: number, angle: number, translation: Position, edgeWidth: number, padding: number ){
      let triPts = pointsToArr( transformPoints( this.points, size + 2 * padding, angle, translation ) );
      let teePts = pointsToArr( transformPoints( this.crossLinePts( size, edgeWidth ), size + 2 * padding, angle, translation ) );
      let inside = math.pointInsidePolygonPoints( x, y, triPts ) || math.pointInsidePolygonPoints( x, y, teePts );

      return inside;
    },

    draw: function( this: ArrowShape, context: any, size: number, angle: number, translation: Position, edgeWidth: number ){
      let triPts = transformPoints( this.points, size, angle, translation );
      let crossLinePts = transformPoints( this.crossLinePts( size, edgeWidth ), size, angle, translation );

      renderer.arrowShapeImpl( this.name )( context, triPts, crossLinePts );
    }
  } );

  defineArrowShape( 'vee', {
    points: [
      -0.15, -0.3,
      0, 0,
      0.15, -0.3,
      0, -0.15
    ],

    gap: function( edge: any ){
      return standardGap(edge) * 0.525;
    }
  } );

  defineArrowShape( 'circle', {
    radius: 0.15,

    collide: function( this: ArrowShape, x: number, y: number, size: number, angle: number, translation: Position, edgeWidth: number, padding: number ){
      let t = translation;
      let inside = ( Math.pow( t.x - x, 2 ) + Math.pow( t.y - y, 2 ) <= Math.pow( (size + 2 * padding) * this.radius, 2 ) );

      return inside;
    },

    draw: function( this: ArrowShape, context: any, size: number, angle: number, translation: Position, edgeWidth?: number ){
      renderer.arrowShapeImpl( this.name )( context, translation.x, translation.y, this.radius * size );
    },

    spacing: function( this: ArrowShape, edge: any ){
      return renderer.getArrowWidth( edge.pstyle( 'width' ).pfValue, edge.pstyle( 'arrow-scale' ).value )
        * this.radius;
    }
  } );

  defineArrowShape( 'tee', {
    points: [
      -0.15, 0,
      -0.15, -0.1,
      0.15, -0.1,
      0.15, 0
    ],

    spacing: function( edge: any ){
      return 1;
    },

    gap: function( edge: any ){
      return 1;
    }
  } );

  defineArrowShape( 'square', {
    points: [
      -0.15, 0.00,
      0.15, 0.00,
      0.15, -0.3,
      -0.15, -0.3
    ]
  } );

  defineArrowShape( 'diamond', {
    points: [
      -0.15, -0.15,
      0, -0.3,
      0.15, -0.15,
      0, 0
    ],

    gap: function( edge: any ){
      return ( edge.pstyle( 'width' ).pfValue as number ) * ( edge.pstyle( 'arrow-scale' ).value as number );
    }
  } );

  defineArrowShape( 'chevron', {
    points: [
      0, 0,
      -0.15, -0.15,
      -0.1, -0.2,
      0, -0.1,
      0.1, -0.2,
      0.15, -0.15
    ],

    gap: function( edge: any ){
      return 0.95 * ( edge.pstyle( 'width' ).pfValue as number ) * ( edge.pstyle( 'arrow-scale' ).value as number );
    }
  } );

};

export default BRp;
