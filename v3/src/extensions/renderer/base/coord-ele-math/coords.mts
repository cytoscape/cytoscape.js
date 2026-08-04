import * as math from '../../../../math.mjs';
import * as util from '../../../../util/index.mjs';
import type { Renderer, Element, Position } from '../../renderer-types.mjs';

interface Pt { x: number; y: number }

// The shared `Element` type leaves the style/dimension mixin surface
// loosely typed (pstyle() may be null with an `unknown` value; width()
// etc. may be undefined). In renderer code these always resolve, so we
// view elements through a narrowed local contract. Internal only.
/* eslint-disable @typescript-eslint/no-explicit-any -- parsed style values are polymorphic */
interface PStyle { value: any; pfValue: any; strValue: string; units?: string | ( string | undefined )[] }
/* eslint-enable @typescript-eslint/no-explicit-any */
type REle = Omit<Element, 'pstyle' | 'width' | 'height' | 'outerWidth' | 'outerHeight' | 'position'> & {
  pstyle( prop: string ): PStyle;
  width(): number;
  height(): number;
  outerWidth(): number;
  outerHeight(): number;
  position(): Position;
};

let BRp: Record<string, unknown> = {};

// Project mouse
BRp.projectIntoViewport = function( this: Renderer, clientX: number, clientY: number ){
  let cy = this.cy;
  let offsets = this.findContainerClientCoords();
  let offsetLeft = offsets[0];
  let offsetTop = offsets[1];
  let scale = offsets[4];
  let pan = cy.pan();
  let zoom = cy.zoom();

  let x = ( (clientX - offsetLeft)/scale - pan.x ) / zoom;
  let y = ( (clientY - offsetTop)/scale - pan.y ) / zoom;

  return [ x, y ];
};

BRp.findContainerClientCoords = function( this: Renderer ){
  if( this.containerBB ){
    return this.containerBB;
  }

  let container = this.container!; // renderer always has a container by the time coords are queried
  let rect = container.getBoundingClientRect();
  let style = this.cy.window()!.getComputedStyle( container );
  let styleValue = function( name: string ){ return parseFloat( style.getPropertyValue( name ) ); };

  let padding = {
    left: styleValue('padding-left'),
    right: styleValue('padding-right'),
    top: styleValue('padding-top'),
    bottom: styleValue('padding-bottom')
  };

  let border = {
    left: styleValue('border-left-width'),
    right: styleValue('border-right-width'),
    top: styleValue('border-top-width'),
    bottom: styleValue('border-bottom-width')
  };

  let clientWidth = container.clientWidth;
  let clientHeight = container.clientHeight;

  let paddingHor =  padding.left + padding.right;
  let paddingVer = padding.top + padding.bottom;

  let borderHor = border.left + border.right;

  let scale = rect.width / ( clientWidth + borderHor );

  let unscaledW = clientWidth - paddingHor;
  let unscaledH = clientHeight - paddingVer;

  let left = rect.left + padding.left + border.left;
  let top = rect.top + padding.top + border.top;

  return ( this.containerBB = [
    left,
    top,
    unscaledW,
    unscaledH,
    scale
  ] );
};

BRp.invalidateContainerClientCoordsCache = function( this: Renderer ){
  this.containerBB = null;
};

BRp.findNearestElement = function( this: Renderer, x: number, y: number, interactiveElementsOnly: boolean, isTouch: boolean ){
  return this.findNearestElements( x, y, interactiveElementsOnly, isTouch )[0];
};

BRp.findNearestElements = function( this: Renderer, x: number, y: number, interactiveElementsOnly: boolean, isTouch: boolean ){
  let self = this; // eslint-disable-line @typescript-eslint/no-this-alias
  let r = this; // eslint-disable-line @typescript-eslint/no-this-alias
  let eles = r.getCachedZSortedEles();
  let near: REle[] = []; // 1 node max, 1 edge max
  let zoom = r.cy.zoom();
  let hasCompounds = r.cy.hasCompoundNodes();
  let edgeThreshold = (isTouch ? 24 : 8) / zoom;
  let nodeThreshold = (isTouch ? 8 : 2) / zoom;
  let labelThreshold = (isTouch ? 8 : 2) / zoom;
  let minSqDist = Infinity;
  let nearEdge: REle | undefined;
  let nearNode: REle | undefined;

  if( interactiveElementsOnly ){
    eles = eles.interactive;
  }

  function addEle( ele: REle, sqDist?: number ){
    if( ele.isNode() ){
      if( nearNode ){
        return; // can't replace node
      } else {
        nearNode = ele;
        near.push( ele );
      }
    }

    if( ele.isEdge() && ( sqDist == null || sqDist < minSqDist ) ){
      if( nearEdge ){ // then replace existing edge
        // can replace only if same z-index
        if(
          nearEdge.pstyle('z-compound-depth').value === ele.pstyle('z-compound-depth').value
          && nearEdge.pstyle('z-compound-depth').value === ele.pstyle('z-compound-depth').value
        ){
          for( let i = 0; i < near.length; i++ ){
            if( near[i].isEdge() ){
              near[i] = ele;
              nearEdge = ele;
              minSqDist = sqDist != null ? sqDist : minSqDist;
              break;
            }
          }
        }
      } else {
        near.push( ele );
        nearEdge = ele;
        minSqDist = sqDist != null ? sqDist : minSqDist;
      }
    }
  }

  function checkNode( node: REle ){
    let width = node.outerWidth() + 2 * nodeThreshold;
    let height = node.outerHeight() + 2 * nodeThreshold;
    let hw = width / 2;
    let hh = height / 2;
    let pos = node.position();
    let cornerRadius = node.pstyle('corner-radius').value === 'auto' ? 'auto' : node.pstyle('corner-radius').pfValue;
    let rs = node._private.rscratch;

    if(
      pos.x - hw <= x && x <= pos.x + hw // bb check x
        &&
      pos.y - hh <= y && y <= pos.y + hh // bb check y
    ){
      let shape = r.nodeShapes[ self.getNodeShape( node ) ];

      if(
        shape.checkPoint( x, y, 0, width, height, pos.x, pos.y, cornerRadius, rs )
      ){
        addEle( node, 0 );
        return true;
      }

    }
  }

  function checkEdge( edge: REle ){
    let _p = edge._private;

    let rs = _p.rscratch;
    let styleWidth = edge.pstyle( 'width' ).pfValue;
    let scale = edge.pstyle( 'arrow-scale' ).value;
    let width = styleWidth / 2 + edgeThreshold; // more like a distance radius from centre
    let widthSq = width * width;
    let width2 = width * 2;
    var src = _p.source; // eslint-disable-line no-var
    var tgt = _p.target; // eslint-disable-line no-var
    let sqDist;

    if( rs.edgeType === 'segments' || rs.edgeType === 'straight' || rs.edgeType === 'haystack' ){
      var pts: number[] = rs.allpts as number[]; // eslint-disable-line no-var

      for( let i = 0; i + 3 < pts.length; i += 2 ){
        if(
          (math.inLineVicinity( x, y, pts[ i ], pts[ i + 1], pts[ i + 2], pts[ i + 3], width2 ))
            &&
          widthSq > ( sqDist = math.sqdistToFiniteLine( x, y, pts[ i ], pts[ i + 1], pts[ i + 2], pts[ i + 3] ) )
        ){
          addEle( edge, sqDist );
          return true;
        }
      }

    } else if( rs.edgeType === 'bezier' || rs.edgeType === 'multibezier' || rs.edgeType === 'self' || rs.edgeType === 'compound' ){
      var pts = rs.allpts as number[]; // eslint-disable-line no-var, @typescript-eslint/no-redeclare
      for( let i = 0; i + 5 < ( rs.allpts as number[] ).length; i += 4 ){
        if(
          (math.inBezierVicinity( x, y, pts[ i ], pts[ i + 1], pts[ i + 2], pts[ i + 3], pts[ i + 4], pts[ i + 5], width2 ))
            &&
          (widthSq > (sqDist = math.sqdistToQuadraticBezier( x, y, pts[ i ], pts[ i + 1], pts[ i + 2], pts[ i + 3], pts[ i + 4], pts[ i + 5] )) )
        ){
          addEle( edge, sqDist );
          return true;
        }
      }
    }

    // if we're close to the edge but didn't hit it, maybe we hit its arrows

    var src = src || _p.source; // eslint-disable-line no-var, @typescript-eslint/no-redeclare
    var tgt = tgt || _p.target; // eslint-disable-line no-var, @typescript-eslint/no-redeclare

    let arSize = self.getArrowWidth( styleWidth, scale );

    let arrows = [
      { name: 'source', x: rs.arrowStartX, y: rs.arrowStartY, angle: rs.srcArrowAngle },
      { name: 'target', x: rs.arrowEndX, y: rs.arrowEndY, angle: rs.tgtArrowAngle },
      { name: 'mid-source', x: rs.midX, y: rs.midY, angle: rs.midsrcArrowAngle },
      { name: 'mid-target', x: rs.midX, y: rs.midY, angle: rs.midtgtArrowAngle }
    ];

    for( let i = 0; i < arrows.length; i++ ){
      let ar = arrows[ i ];
      let shape = r.arrowShapes[ edge.pstyle( ar.name + '-arrow-shape' ).value ];
      let edgeWidth = edge.pstyle('width').pfValue;
      if(
        shape.roughCollide( x, y, arSize, ar.angle, { x: ar.x, y: ar.y }, edgeWidth, edgeThreshold )
         &&
        shape.collide( x, y, arSize, ar.angle, { x: ar.x, y: ar.y }, edgeWidth, edgeThreshold )
      ){
        addEle( edge );
        return true;
      }
    }

    // for compound graphs, hitting edge may actually want a connected node instead (b/c edge may have greater z-index precedence)
    if( hasCompounds && near.length > 0 ){
      checkNode( src as REle );
      checkNode( tgt as REle );
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- prefixed rscratch values are polymorphic (numbers, angles, ...)
  function preprop( obj: Record<string, unknown>, name: string, pre?: string ): any {
    return util.getPrefixedProperty( obj, name, pre );
  }

  function checkLabel( ele: REle, prefix?: string ){
    let _p = ele._private;
    let th = labelThreshold;

    let prefixDash;
    if( prefix ){
      prefixDash = prefix + '-';
    } else {
      prefixDash = '';
    }

    ( ele as Element ).boundingBox();
    let bb = _p.labelBounds[prefix || 'main']!; // populated by the boundingBox() call above

    let text = ele.pstyle( prefixDash + 'label' ).value;
    let eventsEnabled = ele.pstyle( 'text-events' ).strValue === 'yes';

    if( !eventsEnabled || !text ){ return; }

    let lx = preprop( _p.rscratch, 'labelX', prefix );
    let ly = preprop( _p.rscratch, 'labelY', prefix );

    let theta = preprop( _p.rscratch, 'labelAngle', prefix );

    let ox = ele.pstyle(prefixDash + 'text-margin-x').pfValue;
    let oy = ele.pstyle(prefixDash + 'text-margin-y').pfValue;

    let lx1 = bb.x1 - th - ox; // (-ox, -oy) as bb already includes margin
    let lx2 = bb.x2 + th - ox; // and rotation is about (lx, ly)
    let ly1 = bb.y1 - th - oy;
    let ly2 = bb.y2 + th - oy;

    if( theta ){
      let cos = Math.cos( theta );
      let sin = Math.sin( theta );

      let rotate = function( x: number, y: number ){
        x = x - lx;
        y = y - ly;

        return {
          x: x * cos - y * sin + lx,
          y: x * sin + y * cos + ly
        };
      };

      let px1y1 = rotate( lx1, ly1 );
      let px1y2 = rotate( lx1, ly2 );
      let px2y1 = rotate( lx2, ly1 );
      let px2y2 = rotate( lx2, ly2 );

      let points = [ // with the margin added after the rotation is applied
        px1y1.x + ox, px1y1.y + oy,
        px2y1.x + ox, px2y1.y + oy,
        px2y2.x + ox, px2y2.y + oy,
        px1y2.x + ox, px1y2.y + oy
      ];

      if( math.pointInsidePolygonPoints( x, y, points ) ){
        addEle( ele );
        return true;
      }
    } else { // do a cheaper bb check
      if( math.inBoundingBox( bb, x, y ) ){
        addEle( ele );
        return true;
      }
    }

  }

  for( let i = eles.length - 1; i >= 0; i-- ){ // reverse order for precedence
    let ele = eles[ i ];

    if( ele.isNode() ){
      checkNode( ele ) || checkLabel( ele ); // eslint-disable-line @typescript-eslint/no-unused-expressions

    } else { // then edge
      checkEdge( ele ) || checkLabel( ele ) || checkLabel( ele, 'source' ) || checkLabel( ele, 'target' ); // eslint-disable-line @typescript-eslint/no-unused-expressions
    }
  }

  return near;
};

// 'Give me everything from this box'
BRp.getAllInBox = function( this: Renderer, x1: number, y1: number, x2: number, y2: number ){
  let eles = this.getCachedZSortedEles().interactive;
  let zoom = this.cy.zoom();
  let labelThreshold = 2 / zoom;
  let box: REle[] = [];

  let x1c = Math.min( x1, x2 );
  let x2c = Math.max( x1, x2 );
  let y1c = Math.min( y1, y2 );
  let y2c = Math.max( y1, y2 );

  x1 = x1c;
  x2 = x2c;
  y1 = y1c;
  y2 = y2c;

  let boxBb = math.makeBoundingBox( {
    x1: x1, y1: y1,
    x2: x2, y2: y2
  } )!; // always defined: a concrete bb is passed
  let selectionBox = [
    { x: boxBb.x1, y: boxBb.y1 },
    { x: boxBb.x2, y: boxBb.y1 },
    { x: boxBb.x2, y: boxBb.y2 },
    { x: boxBb.x1, y: boxBb.y2 },
  ];
  let boxEdges = [
    [selectionBox[0], selectionBox[1]],
    [selectionBox[1], selectionBox[2]],
    [selectionBox[2], selectionBox[3]],
    [selectionBox[3], selectionBox[0]]
  ];


  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- prefixed rscratch values are polymorphic (numbers, angles, ...)
  function preprop( obj: Record<string, unknown>, name: string, pre?: string ): any {
    return util.getPrefixedProperty(obj, name, pre);
  }

  function getRotatedLabelBox( ele: REle, prefix?: string ): Pt[] | null {
    let _p = ele._private;
    let th = labelThreshold;

    let prefixDash = prefix ? prefix + '-' : '';
    ( ele as Element ).boundingBox();
    let bb = _p.labelBounds[prefix || 'main'];

    // If the bounding box is not available, return null.
    // This indicates that the label box cannot be calculated, which is consistent
    // with the expected behavior of this function. Returning null allows the caller
    // to handle the absence of a bounding box explicitly.
    if (!bb) {
      return null;
    }

    let lx = preprop(_p.rscratch, 'labelX', prefix);
    let ly = preprop(_p.rscratch, 'labelY', prefix);
    let theta = preprop(_p.rscratch, 'labelAngle', prefix);

    let ox = ele.pstyle(prefixDash + 'text-margin-x').pfValue;
    let oy = ele.pstyle(prefixDash + 'text-margin-y').pfValue;

    let lx1 = bb.x1 - th - ox;
    let lx2 = bb.x2 + th - ox;
    let ly1 = bb.y1 - th - oy;
    let ly2 = bb.y2 + th - oy;

    if (theta) {
      let cos = Math.cos(theta);
      let sin = Math.sin(theta);

      let rotate = function ( x: number, y: number ) {
        x = x - lx;
        y = y - ly;
        return {
          x: x * cos - y * sin + lx,
          y: x * sin + y * cos + ly,
        };
      };

      return [rotate(lx1, ly1), rotate(lx2, ly1), rotate(lx2, ly2), rotate(lx1, ly2)];
    } else {
      return [
        { x: lx1, y: ly1 },
        { x: lx2, y: ly1 },
        { x: lx2, y: ly2 },
        { x: lx1, y: ly2 },
      ];
    }
  }

  function doLinesIntersect( p1: Pt, p2: Pt, q1: Pt, q2: Pt ) {
    function ccw( a: Pt, b: Pt, c: Pt ) {
      return (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
    }
    return ccw(p1, q1, q2) !== ccw(p2, q1, q2) && ccw(p1, p2, q1) !== ccw(p1, p2, q2);
  }

  for( let e = 0; e < eles.length; e++ ){
    let ele = eles[e];

    if( ele.isNode() ){
      let node = ele;
      let textEvents = node.pstyle('text-events').strValue === 'yes';
      let nodeBoxSelectMode = node.pstyle('box-selection').strValue;
      let labelBoxSelectEnabled = node.pstyle('box-select-labels').strValue === 'yes';

      if ( nodeBoxSelectMode === 'none' ) {
        continue;
      }
      let includeLabels = (nodeBoxSelectMode === 'overlap' || labelBoxSelectEnabled) && textEvents;
      let nodeBb = node.boundingBox({
        includeNodes: true,
        includeEdges: false,
        includeLabels,
      });

      if ( nodeBoxSelectMode === 'contain' ) {
        let selected = false;

        if (labelBoxSelectEnabled && textEvents) {
          const rotatedLabelBox = getRotatedLabelBox(node);
          if (rotatedLabelBox && math.satPolygonIntersection(rotatedLabelBox, selectionBox)) {
            box.push(node);
            selected = true;
          }
        }

        if (!selected && math.boundingBoxInBoundingBox(boxBb, nodeBb)) {
          box.push(node);
        }
      } else if ( nodeBoxSelectMode === 'overlap' ) {
        if (math.boundingBoxesIntersect(boxBb, nodeBb)) {
          const nodeBodyBb = node.boundingBox({
            includeNodes: true,
            includeEdges: true,
            includeLabels: false,
            includeMainLabels: false,
            includeSourceLabels: false,
            includeTargetLabels: false
          });

          const nodeBodyCorners = [
            { x: nodeBodyBb.x1, y: nodeBodyBb.y1 },
            { x: nodeBodyBb.x2, y: nodeBodyBb.y1 },
            { x: nodeBodyBb.x2, y: nodeBodyBb.y2 },
            { x: nodeBodyBb.x1, y: nodeBodyBb.y2 },
          ];

          // if node body intersects, no need to check label
          if (math.satPolygonIntersection(nodeBodyCorners, selectionBox)) {
            box.push(node);
          } else {
            // only check label if node body didn't intersect
            const rotatedLabelBox = getRotatedLabelBox(node);
            if (rotatedLabelBox && math.satPolygonIntersection(rotatedLabelBox, selectionBox)) {
              box.push(node);
            }
          }
        }
      }
    } else {
      let edge = ele;
      let _p = edge._private;
      let rs = _p.rscratch;
      let edgeBoxSelectMode = edge.pstyle('box-selection').strValue;

      if ( edgeBoxSelectMode === 'none' ) {
        continue;
      }

      if ( edgeBoxSelectMode === 'contain' ) {
        if( rs.startX != null && rs.startY != null && !math.inBoundingBox( boxBb, rs.startX, rs.startY ) ){ continue; }
        if( rs.endX != null && rs.endY != null && !math.inBoundingBox( boxBb, rs.endX, rs.endY ) ){ continue; }

        if( rs.edgeType === 'bezier' || rs.edgeType === 'multibezier' || rs.edgeType === 'self' || rs.edgeType === 'compound' || rs.edgeType === 'segments' || rs.edgeType === 'haystack' ){

          let pts = _p.rstyle.bezierPts || _p.rstyle.linePts || _p.rstyle.haystackPts;
          let allInside = true;

          for( let i = 0; i < pts.length; i++ ){
            if( !math.pointInBoundingBox( boxBb, pts[ i ] ) ){
              allInside = false;
              break;
            }
          }

          if( allInside ){
            box.push( edge );
          }

        } else if( rs.edgeType === 'straight' ){
          box.push( edge );
        }
      } else if ( edgeBoxSelectMode === 'overlap' ) {
        let selected = false;

        // Check: either endpoint inside box
        if (
          rs.startX != null && rs.startY != null &&
          rs.endX != null && rs.endY != null &&
          (math.inBoundingBox(boxBb, rs.startX, rs.startY) || math.inBoundingBox(boxBb, rs.endX, rs.endY))
        ) {
          box.push(edge);
          selected = true;
        }

        // Haystack fallback (only check if not already selected)
        else if (!selected && rs.edgeType === 'haystack') {
          const haystackPts = _p.rstyle.haystackPts;
          for (let i = 0; i < haystackPts.length; i++) {
            if (math.pointInBoundingBox(boxBb, haystackPts[i])) {
              box.push(edge);
              selected = true;
              break;
            }
          }
        }

        // Segment intersection check (only if not already selected)
        if (!selected) {
          let pts: Pt[] = _p.rstyle.bezierPts || _p.rstyle.linePts || _p.rstyle.haystackPts;

          // straight edges
          if ((!pts || pts.length < 2) && rs.edgeType === 'straight') {
            if (rs.startX != null && rs.startY != null && rs.endX != null && rs.endY != null) {
              pts = [
                { x: rs.startX, y: rs.startY },
                { x: rs.endX, y: rs.endY }
              ];
            }
          }
          if (!pts || pts.length < 2) continue;

          for (let i = 0; i < pts.length - 1; i++) {
            let segStart = pts[i];
            let segEnd = pts[i + 1];

            for (let b = 0; b < boxEdges.length; b++) {
              let [boxStart, boxEnd] = boxEdges[b];

              if (doLinesIntersect(segStart, segEnd, boxStart, boxEnd)) {
                box.push(edge);
                selected = true;
                break;
              }
            }

            if (selected) break;
          }
        }
      }
    }
  }

  return box;
};

export default BRp;
