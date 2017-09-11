let is = require('../../is');
let util = require('../../util');
let math = require('../../math');
let fn, elesfn;

fn = elesfn = {};

elesfn.renderedBoundingBox = function( options ){
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

elesfn.dirtyCompoundBoundsCache = function(){
  let cy = this.cy();

  if( !cy.styleEnabled() || !cy.hasCompoundNodes() ){ return this; }

  this.forEachUp( ele => {
    ele._private.compoundBoundsClean = false;

    if( ele.isParent() ){
      ele.emit('bounds');
    }
  } );

  return this;
};

elesfn.updateCompoundBounds = function(){
  let cy = this.cy();

  // save cycles for non compound graphs or when style disabled
  if( !cy.styleEnabled() || !cy.hasCompoundNodes() ){ return this; }

  // save cycles when batching -- but bounds will be stale (or not exist yet)
  if( cy.batching() ){ return this; }

  let updated = [];

  function update( parent ){
    if( !parent.isParent() ){ return; }

    let _p = parent._private;
    let children = parent.children();
    let includeLabels = parent.pstyle( 'compound-sizing-wrt-labels' ).value === 'include';

    let min = {
      width: {
        val: parent.pstyle( 'min-width' ).pfValue,
        left: parent.pstyle( 'min-width-bias-left' ),
        right: parent.pstyle( 'min-width-bias-right' )
      },
      height: {
        val: parent.pstyle( 'min-height' ).pfValue,
        top: parent.pstyle( 'min-height-bias-top' ),
        bottom: parent.pstyle( 'min-height-bias-bottom' )
      }
    };

    let bb = children.boundingBox( {
      includeLabels: includeLabels,
      includeOverlays: false,

      // updating the compound bounds happens outside of the regular
      // cache cycle (i.e. before fired events)
      useCache: false
    } );
    let pos = _p.position;

    // if children take up zero area then keep position and fall back on stylesheet w/h
    if( bb.w === 0 || bb.h === 0 ){
      bb = {
        w: parent.pstyle('width').pfValue,
        h: parent.pstyle('height').pfValue
      };

      bb.x1 = pos.x - bb.w/2;
      bb.x2 = pos.x + bb.w/2;
      bb.y1 = pos.y - bb.h/2;
      bb.y2 = pos.y + bb.h/2;
    }

    function computeBiasValues( propDiff, propBias, propBiasComplement ){
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

    function computePaddingValues( width, height, paddingObject, relativeTo ) {
      // Assuming percentage is number from 0 to 1
      if(paddingObject.units === '%') {
        switch(relativeTo) {
          case 'width':
            return width > 0 ? paddingObject.pfValue * width : 0;
          case 'height':
            return height > 0 ? paddingObject.pfValue * height : 0;
          case 'average':
            return ( width > 0 ) && ( height > 0 ) ? paddingObject.pfValue * ( width + height ) / 2 : 0;
          case 'min':
            return ( width > 0 ) && ( height > 0 ) ? ( ( width > height ) ? paddingObject.pfValue * height : paddingObject.pfValue * width ) : 0;
          case 'max':
            return ( width > 0 ) && ( height > 0 ) ? ( ( width > height ) ? paddingObject.pfValue * width : paddingObject.pfValue * height ) : 0;
          default:
            return 0;
        }
      } else if(paddingObject.units === 'px') {
        return paddingObject.pfValue;
      } else {
        return 0;
      }
    }

    let leftVal = min.width.left.value;
    if( min.width.left.units === 'px' && min.width.val > 0 ){
      leftVal = ( leftVal * 100 ) / min.width.val;
    }
    let rightVal = min.width.right.value;
    if( min.width.right.units === 'px' && min.width.val > 0 ){
      rightVal = ( rightVal * 100 ) / min.width.val;
    }

    let topVal = min.height.top.value;
    if( min.height.top.units === 'px' && min.height.val > 0 ){
      topVal = ( topVal * 100 ) / min.height.val;
    }

    let bottomVal = min.height.bottom.value;
    if( min.height.bottom.units === 'px' && min.height.val > 0 ){
      bottomVal = ( bottomVal * 100 ) / min.height.val;
    }

    let widthBiasDiffs = computeBiasValues( min.width.val - bb.w, leftVal, rightVal );
    let diffLeft = widthBiasDiffs.biasDiff;
    let diffRight = widthBiasDiffs.biasComplementDiff;

    let heightBiasDiffs = computeBiasValues( min.height.val - bb.h, topVal, bottomVal );
    let diffTop = heightBiasDiffs.biasDiff;
    let diffBottom = heightBiasDiffs.biasComplementDiff;

    _p.autoPadding = computePaddingValues( bb.w, bb.h, parent.pstyle( 'padding' ), parent.pstyle( 'padding-relative-to' ).value );

    _p.autoWidth = Math.max(bb.w, min.width.val);
    pos.x = (- diffLeft + bb.x1 + bb.x2 + diffRight) / 2;

    _p.autoHeight = Math.max(bb.h, min.height.val);
    pos.y = (- diffTop + bb.y1 + bb.y2 + diffBottom) / 2;

    updated.push( parent );
  }

  for( let i = 0; i < this.length; i++ ){
    let ele = this[i];
    let _p = ele._private;

    if( !_p.compoundBoundsClean ){
      update( ele );

      if( !cy._private.batchingStyle ){
        _p.compoundBoundsClean = true;
      }
    }
  }

  return this;
};

let noninf = function( x ){
  if( x === Infinity || x === -Infinity ){
    return 0;
  }

  return x;
};

let updateBounds = function( b, x1, y1, x2, y2 ){
  // don't update with zero area boxes
  if( x2 - x1 === 0 || y2 - y1 === 0 ){ return; }

  // don't update with null dim
  if( x1 == null || y1 == null || x2 == null || y2 == null ){ return; }

  b.x1 = x1 < b.x1 ? x1 : b.x1;
  b.x2 = x2 > b.x2 ? x2 : b.x2;
  b.y1 = y1 < b.y1 ? y1 : b.y1;
  b.y2 = y2 > b.y2 ? y2 : b.y2;
};

let updateBoundsFromBox = function( b, b2 ){
  return updateBounds( b, b2.x1, b2.y1, b2.x2, b2.y2 );
};

let prefixedProperty = function( obj, field, prefix ){
  return util.getPrefixedProperty( obj, field, prefix );
};

let updateBoundsFromArrow = function( bounds, ele, prefix ){
  if( ele.cy().headless() ){ return; }

  let _p = ele._private;
  let rstyle = _p.rstyle;
  let halfArW = rstyle.arrowWidth / 2;
  let arrowType = ele.pstyle( prefix + '-arrow-shape' ).value;
  let x;
  let y;

  if( arrowType !== 'none' ){
    if( prefix === 'source' ){
      x = rstyle.srcX;
      y = rstyle.srcY;
    } else if( prefix === 'target' ){
      x = rstyle.tgtX;
      y = rstyle.tgtY;
    } else {
      x = rstyle.midX;
      y = rstyle.midY;
    }

    updateBounds( bounds, x - halfArW, y - halfArW, x + halfArW, y + halfArW );
  }
};

let updateBoundsFromLabel = function( bounds, ele, prefix ){
  if( ele.cy().headless() ){ return; }

  let prefixDash;

  if( prefix ){
    prefixDash = prefix + '-';
  } else {
    prefixDash = '';
  }

  let _p = ele._private;
  let rstyle = _p.rstyle;
  let label = ele.pstyle( prefixDash + 'label' ).strValue;

  if( label ){
    let halign = ele.pstyle( 'text-halign' );
    let valign = ele.pstyle( 'text-valign' );
    let labelWidth = prefixedProperty( rstyle, 'labelWidth', prefix );
    let labelHeight = prefixedProperty( rstyle, 'labelHeight', prefix );
    let labelX = prefixedProperty( rstyle, 'labelX', prefix );
    let labelY = prefixedProperty( rstyle, 'labelY', prefix );
    let marginX = ele.pstyle( prefixDash + 'text-margin-x' ).pfValue;
    let marginY = ele.pstyle( prefixDash + 'text-margin-y' ).pfValue;
    let isEdge = ele.isEdge();
    let rotation = ele.pstyle( prefixDash + 'text-rotation' );
    let outlineWidth = ele.pstyle( 'text-outline-width' ).pfValue;
    let borderWidth = ele.pstyle( 'text-border-width' ).pfValue;
    let halfBorderWidth = borderWidth / 2;
    let padding = ele.pstyle( 'text-background-padding' ).pfValue;

    let lh = labelHeight + 2 * padding;
    let lw = labelWidth + 2 * padding;
    let lw_2 = lw / 2;
    let lh_2 = lh / 2;
    let lx1, lx2, ly1, ly2;

    if( isEdge ){
      lx1 = labelX - lw_2;
      lx2 = labelX + lw_2;
      ly1 = labelY - lh_2;
      ly2 = labelY + lh_2;
    } else {
      switch( halign.value ){
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

      switch( valign.value ){
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

    let isAutorotate = ( isEdge && rotation.strValue === 'autorotate' );
    let isPfValue = ( rotation.pfValue != null && rotation.pfValue !== 0 );

    if( isAutorotate || isPfValue ){
      let theta = isAutorotate ? prefixedProperty( _p.rstyle, 'labelAngle', prefix ) : rotation.pfValue;
      let cos = Math.cos( theta );
      let sin = Math.sin( theta );

      let rotate = function( x, y ){
        x = x - labelX;
        y = y - labelY;

        return {
          x: x * cos - y * sin + labelX,
          y: x * sin + y * cos + labelY
        };
      };

      let px1y1 = rotate( lx1, ly1 );
      let px1y2 = rotate( lx1, ly2 );
      let px2y1 = rotate( lx2, ly1 );
      let px2y2 = rotate( lx2, ly2 );

      lx1 = Math.min( px1y1.x, px1y2.x, px2y1.x, px2y2.x );
      lx2 = Math.max( px1y1.x, px1y2.x, px2y1.x, px2y2.x );
      ly1 = Math.min( px1y1.y, px1y2.y, px2y1.y, px2y2.y );
      ly2 = Math.max( px1y1.y, px1y2.y, px2y1.y, px2y2.y );
    }

    lx1 += marginX - Math.max( outlineWidth, halfBorderWidth );
    lx2 += marginX + Math.max( outlineWidth, halfBorderWidth );
    ly1 += marginY - Math.max( outlineWidth, halfBorderWidth );
    ly2 += marginY + Math.max( outlineWidth, halfBorderWidth );

    updateBounds( bounds, lx1, ly1, lx2, ly2 );
  }

  return bounds;
};

// get the bounding box of the elements (in raw model position)
let boundingBoxImpl = function( ele, options ){
  let cy = ele._private.cy;
  let styleEnabled = cy.styleEnabled();
  let headless = cy.headless();

  let bounds = {
    x1: Infinity,
    y1: Infinity,
    x2: -Infinity,
    y2: -Infinity
  };

  let _p = ele._private;
  let display = styleEnabled ? ele.pstyle( 'display' ).value : 'element';
  let isNode = ele.isNode();
  let isEdge = ele.isEdge();
  let ex1, ex2, ey1, ey2; // extrema of body / lines
  let x, y; // node pos
  let displayed = display !== 'none';

  if( displayed ){
    let overlayOpacity = 0;
    let overlayPadding = 0;

    if( styleEnabled && options.includeOverlays ){
      overlayOpacity = ele.pstyle( 'overlay-opacity' ).value;

      if( overlayOpacity !== 0 ){
        overlayPadding = ele.pstyle( 'overlay-padding' ).value;
      }
    }

    let w = 0;
    let wHalf = 0;

    if( styleEnabled ){
      w = ele.pstyle( 'width' ).pfValue;
      wHalf = w / 2;
    }

    if( isNode && options.includeNodes ){
      let pos = ele.position();
      x = pos.x;
      y = pos.y;
      let w = ele.outerWidth();
      let halfW = w / 2;
      let h = ele.outerHeight();
      let halfH = h / 2;

      // handle node dimensions
      /////////////////////////

      ex1 = x - halfW - overlayPadding;
      ex2 = x + halfW + overlayPadding;
      ey1 = y - halfH - overlayPadding;
      ey2 = y + halfH + overlayPadding;

      updateBounds( bounds, ex1, ey1, ex2, ey2 );

    } else if( isEdge && options.includeEdges ){
      let rstyle = _p.rstyle || {};

      // handle edge dimensions (rough box estimate)
      //////////////////////////////////////////////
      if( styleEnabled && !headless ){
        ex1 = Math.min( rstyle.srcX, rstyle.midX, rstyle.tgtX );
        ex2 = Math.max( rstyle.srcX, rstyle.midX, rstyle.tgtX );
        ey1 = Math.min( rstyle.srcY, rstyle.midY, rstyle.tgtY );
        ey2 = Math.max( rstyle.srcY, rstyle.midY, rstyle.tgtY );

        // take into account edge width
        ex1 -= wHalf;
        ex2 += wHalf;
        ey1 -= wHalf;
        ey2 += wHalf;

        updateBounds( bounds, ex1, ey1, ex2, ey2 );
      }

      // precise haystacks
      ////////////////////
      if( styleEnabled && !headless && ele.pstyle( 'curve-style' ).strValue === 'haystack' ){
        let hpts = rstyle.haystackPts || [];

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

      // handle points along edge
      ///////////////////////////
      } else {
        let pts = rstyle.bezierPts || rstyle.linePts || [];

        for( let j = 0; j < pts.length; j++ ){
          let pt = pts[ j ];

          ex1 = pt.x - wHalf;
          ex2 = pt.x + wHalf;
          ey1 = pt.y - wHalf;
          ey2 = pt.y + wHalf;

          updateBounds( bounds, ex1, ey1, ex2, ey2 );
        }

        // fallback on source and target positions
        //////////////////////////////////////////
        if( pts.length === 0 ){
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
        }
      }

    } // edges


    // handle edge arrow size
    /////////////////////////

    if( styleEnabled && options.includeEdges && isEdge ){
      updateBoundsFromArrow( bounds, ele, 'mid-source', options );
      updateBoundsFromArrow( bounds, ele, 'mid-target', options );
      updateBoundsFromArrow( bounds, ele, 'source', options );
      updateBoundsFromArrow( bounds, ele, 'target', options );
    }

    // ghost
    ////////

    if( styleEnabled ){
      let ghost = ele.pstyle('ghost').value === 'yes';

      if( ghost ){
        let gx = ele.pstyle('ghost-offset-x').pfValue;
        let gy = ele.pstyle('ghost-offset-y').pfValue;

        updateBounds( bounds, bounds.x1 + gx, bounds.y1 + gy, bounds.x2 + gx, bounds.y2 + gy );
      }
    }

    // overlay
    //////////

    if( styleEnabled ){

      ex1 = bounds.x1;
      ex2 = bounds.x2;
      ey1 = bounds.y1;
      ey2 = bounds.y2;

      updateBounds( bounds, ex1 - overlayPadding, ey1 - overlayPadding, ex2 + overlayPadding, ey2 + overlayPadding );
    }

    // handle label dimensions
    //////////////////////////

    if( styleEnabled && options.includeLabels ){
      updateBoundsFromLabel( bounds, ele, null, options );

      if( isEdge ){
        updateBoundsFromLabel( bounds, ele, 'source', options );
        updateBoundsFromLabel( bounds, ele, 'target', options );
      }
    } // style enabled for labels
  } // if displayed

  bounds.x1 = noninf( bounds.x1 );
  bounds.y1 = noninf( bounds.y1 );
  bounds.x2 = noninf( bounds.x2 );
  bounds.y2 = noninf( bounds.y2 );
  bounds.w = noninf( bounds.x2 - bounds.x1 );
  bounds.h = noninf( bounds.y2 - bounds.y1 );

  // expand bounds by 1 because antialiasing can increase the visual/effective size by 1 on all sides
  if( bounds.w > 0 && bounds.h > 0 && displayed ){
    math.expandBoundingBox( bounds, 1 );
  }

  return bounds;
};

let tf = function( val ){
  if( val ){
    return 't';
  } else {
    return 'f';
  }
};

let getKey = function( opts ){
  let key = '';

  key += tf( opts.incudeNodes );
  key += tf( opts.includeEdges );
  key += tf( opts.includeLabels );
  key += tf( opts.includeOverlays );

  return key;
};

let cachedBoundingBoxImpl = function( ele, opts ){
  let _p = ele._private;
  let bb;
  let headless = ele.cy().headless();
  let key = opts === defBbOpts ? defBbOptsKey : getKey( opts );

  if( !opts.useCache || headless || !_p.bbCache || !_p.bbCache[key] ){
    bb = boundingBoxImpl( ele, opts );

    if( !headless ){
      _p.bbCache = _p.bbCache || {};
      _p.bbCache[key] = bb;
    }
  } else {
    bb = _p.bbCache[key];
  }

  return bb;
};

let defBbOpts = {
  includeNodes: true,
  includeEdges: true,
  includeLabels: true,
  includeOverlays: true,
  useCache: true
};

let defBbOptsKey = getKey( defBbOpts );

function filledBbOpts( options ){
  return {
    includeNodes: util.default( options.includeNodes, defBbOpts.includeNodes ),
    includeEdges: util.default( options.includeEdges, defBbOpts.includeEdges ),
    includeLabels: util.default( options.includeLabels, defBbOpts.includeLabels ),
    includeOverlays: util.default( options.includeOverlays, defBbOpts.includeOverlays ),
    useCache: util.default( options.useCache, defBbOpts.useCache )
  };
}

elesfn.boundingBox = function( options ){
  // the main usecase is ele.boundingBox() for a single element with no/def options
  // specified s.t. the cache is used, so check for this case to make it faster by
  // avoiding the overhead of the rest of the function
  if( this.length === 1 && this[0]._private.bbCache && (options === undefined || options.useCache === undefined || options.useCache === true) ){
    if( options === undefined ){
      options = defBbOpts;
    } else {
      options = filledBbOpts( options );
    }

    return cachedBoundingBoxImpl( this[0], options );
  }

  let bounds = {
    x1: Infinity,
    y1: Infinity,
    x2: -Infinity,
    y2: -Infinity
  };

  options = options || util.staticEmptyObject();

  let opts = filledBbOpts( options );

  let eles = this;
  let cy = eles.cy();
  let styleEnabled = cy.styleEnabled();

  if( styleEnabled ){
    this.recalculateRenderedStyle( opts.useCache );
  }

  this.updateCompoundBounds();

  let updatedEdge = {}; // use to avoid duplicated edge updates

  for( let i = 0; i < eles.length; i++ ){
    let ele = eles[i];

    if( styleEnabled && ele.isEdge() && ele.pstyle('curve-style').strValue === 'bezier' && !updatedEdge[ ele.id() ] ){
      let edges = ele.parallelEdges();

      for( let j = 0; j < edges.length; j++ ){ // make all as updated
        updatedEdge[ edges[j].id() ] = true;
      }

      edges.recalculateRenderedStyle( opts.useCache ); // n.b. ele.parallelEdges() single is cached
    }

    updateBoundsFromBox( bounds, cachedBoundingBoxImpl( ele, opts ) );
  }

  bounds.x1 = noninf( bounds.x1 );
  bounds.y1 = noninf( bounds.y1 );
  bounds.x2 = noninf( bounds.x2 );
  bounds.y2 = noninf( bounds.y2 );
  bounds.w = noninf( bounds.x2 - bounds.x1 );
  bounds.h = noninf( bounds.y2 - bounds.y1 );

  return bounds;
};

// private helper to get bounding box for custom node positions
// - good for perf in certain cases but currently requires dirtying the rendered style
// - would be better to not modify the nodes but the nodes are read directly everywhere in the renderer...
// - try to use for only things like discrete layouts where the node position would change anyway
elesfn.boundingBoxAt = function( fn ){
  let nodes = this.nodes();

  if( is.plainObject( fn ) ){
    let obj = fn;

    fn = function(){ return obj; };
  }

  // save the current position and set the new one, per node
  for( let i = 0; i < nodes.length; i++ ){
    let n = nodes[i];
    let _p = n._private;
    let pos = _p.position;
    let newPos = fn.call( n, n, i );

    _p.bbAtOldPos = { x: pos.x, y: pos.y };

    if( newPos ){
      pos.x = newPos.x;
      pos.y = newPos.y;
    }
  }

  this.emit('dirty'); // let the renderer know we've manually dirtied rendered dim calcs

  nodes.dirtyCompoundBoundsCache().updateCompoundBounds();

  let bb = this.boundingBox({ useCache: false });

  // restore the original position, per node
  for( let i = 0; i < nodes.length; i++ ){
    let n = nodes[i];
    let _p = n._private;
    let pos = n._private.position;
    let old = _p.bbAtOldPos;

    pos.x = old.x;
    pos.y = old.y;
  }

  nodes.dirtyCompoundBoundsCache();

  this.emit('dirty'); // let the renderer know we've manually dirtied rendered dim calcs

  return bb;
};

fn.boundingbox = fn.boundingBox;
fn.renderedBoundingbox = fn.renderedBoundingBox;

module.exports = elesfn;
