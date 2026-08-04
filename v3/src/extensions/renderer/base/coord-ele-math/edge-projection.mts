import * as math from '../../../../math.mjs';

import type { Renderer, Element, Collection, Position } from '../../renderer-types.mjs';
import type { ParsedStyleProperty } from '../../../../style/parse.mjs';

let BRp: Record<string, unknown> = {};

function pushBezierPts( r: Renderer, edge: Element, pts: number[] ){
  let qbezierAt = function( p1: number, p2: number, p3: number, t: number ){ return math.qbezierAt( p1, p2, p3, t ); };
  let _p = edge._private;
  let bpts = _p.rstyle.bezierPts as Position[];

  for( let i = 0; i < r.bezierProjPcts.length; i++ ){
    let p = r.bezierProjPcts[i];

    bpts.push( {
      x: qbezierAt( pts[0], pts[2], pts[4], p ),
      y: qbezierAt( pts[1], pts[3], pts[5], p )
    } );
  }
}

BRp.storeEdgeProjections = function( this: Renderer, edge: Element ){
  let _p = edge._private;
  // rscratch is a loose geometry bag of edge-type discriminants + numeric coords
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- rscratch geometry bag
  let rs = _p.rscratch as any;
  let et = rs.edgeType;

  // clear the cached points state
  _p.rstyle.bezierPts = null;
  _p.rstyle.linePts = null;
  _p.rstyle.haystackPts = null;

  if( et === 'multibezier' ||  et === 'bezier' ||  et === 'self' ||  et === 'compound' ){
    _p.rstyle.bezierPts = [];

    for( let i = 0; i + 5 < rs.allpts.length; i += 4 ){
      pushBezierPts( this, edge, rs.allpts.slice( i, i + 6 ) );
    }
  } else if(  et === 'segments' ){
    let lpts = _p.rstyle.linePts = [] as Position[];

    for( let i = 0; i + 1 < rs.allpts.length; i += 2 ){
      lpts.push( {
        x: rs.allpts[ i ],
        y: rs.allpts[ i + 1]
      } );
    }
  } else if( et === 'haystack' ){
    let hpts = rs.haystackPts;

    _p.rstyle.haystackPts = [
      { x: hpts[0], y: hpts[1] },
      { x: hpts[2], y: hpts[3] }
    ];
  }

  // these style props are always present at runtime for an edge
  let widthPstyle = edge.pstyle('width') as ParsedStyleProperty;
  let arrowScalePstyle = edge.pstyle( 'arrow-scale' ) as ParsedStyleProperty;

  _p.rstyle.arrowWidth = ( this.getArrowWidth( widthPstyle.pfValue, arrowScalePstyle.value ) as number )
    * ( this.arrowShapeWidth as number );
};

BRp.recalculateEdgeProjections = function( this: Renderer, edges: Collection ){
  this.findEdgeControlPoints( edges );
};

export default BRp;
