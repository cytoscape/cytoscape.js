import type { Renderer, Element, Collection, SharedCollection, Position } from '../../renderer-types.mjs';

// The shared `Element` type leaves the style/dimension mixin surface
// loosely typed (pstyle() may be null with an `unknown` value; width()
// may be undefined). In renderer code these always resolve, so we view
// elements through a narrowed local contract. Internal only.
/* eslint-disable @typescript-eslint/no-explicit-any -- parsed style values are polymorphic */
interface PStyle { value: any; pfValue: any; strValue: string }
/* eslint-enable @typescript-eslint/no-explicit-any */
type REle = Omit<Element, 'pstyle' | 'width' | 'height' | 'position'> & {
  pstyle( prop: string ): PStyle;
  width(): number;
  height(): number;
  position(): Position;
};

let BRp: Record<string, unknown> = {};

BRp.registerCalculationListeners = function( this: Renderer ){
  let cy = this.cy;
  let elesToUpdate = cy.collection();
  let r = this; // eslint-disable-line @typescript-eslint/no-this-alias

  let enqueue = function( eles: SharedCollection, dirtyStyleCaches = true ){
    elesToUpdate.merge( eles );

    if( dirtyStyleCaches ){
      for( let i = 0; i < eles.length; i++ ){
        let ele = eles[i];
        let _p = ele._private;
        let rstyle = _p.rstyle;

        rstyle.clean = false;
        rstyle.cleanConnected = false;
      }
    }
  };

  r.binder( cy )
    .on('bounds.* dirty.*', function onDirtyBounds( e: { target: Element } ){
      let ele = e.target;

      enqueue( ele );
    })

    .on('style.* background.*', function onDirtyStyle( e: { target: Element } ){
      let ele = e.target;

      enqueue( ele, false );
    })
  ;

  let updateEleCalcs = function( willDraw: boolean ){
    if( willDraw ){
      let fns = r.onUpdateEleCalcsFns;

      // because we need to have up-to-date style (e.g. stylesheet mappers)
      // before calculating rendered style (and pstyle might not be called yet)
      elesToUpdate.cleanStyle();

      for( let i = 0; i < elesToUpdate.length; i++ ){
        let ele = elesToUpdate[i];
        let rstyle = ele._private.rstyle;

        if( ele.isNode() && !rstyle.cleanConnected ){
          enqueue( ele.connectedEdges() );

          rstyle.cleanConnected = true;
        }
      }

      if( fns ){ for( let i = 0; i < fns.length; i++ ){
        let fn = fns[i];

        fn( willDraw, elesToUpdate );
      } }

      r.recalculateRenderedStyle( elesToUpdate );

      elesToUpdate = cy.collection();
    }
  };

  r.flushRenderedStyleQueue = function(){
    updateEleCalcs(true);
  };

  r.beforeRender( updateEleCalcs, r.beforeRenderPriorities.eleCalcs );
};

BRp.onUpdateEleCalcs = function( this: Renderer, fn: ( willDraw: boolean, eles: Element ) => void ){
  let fns = this.onUpdateEleCalcsFns = this.onUpdateEleCalcsFns || [];

  fns.push( fn );
};

BRp.recalculateRenderedStyle = function( this: Renderer, eles: Collection, useCache?: boolean ){
  let isCleanConnected = ( ele: Element ) => ele._private.rstyle.cleanConnected;

  if (eles.length === 0) { return; }

  let edges: Element[] = [];
  let nodes: REle[] = [];

  // the renderer can't be used for calcs when destroyed, e.g. ele.boundingBox()
  if( this.destroyed ){ return; }

  // use cache by default for perf
  if( useCache === undefined ){ useCache = true; }

  for( let i = 0; i < eles.length; i++ ){
    let ele = eles[ i ];
    let _p = ele._private;
    let rstyle = _p.rstyle;

    // an edge may be implicitly dirty b/c of one of its connected nodes
    // (and a request for recalc may come in between frames)
    if( ele.isEdge() && (!isCleanConnected(ele.source()[0]) || !isCleanConnected(ele.target()[0])) ){
      rstyle.clean = false;
    }

    if (ele.isEdge() && ele.isBundledBezier()) {
      if (ele.parallelEdges().some(( ele: Element ) => !ele._private.rstyle.clean && ele.isBundledBezier())) {
        rstyle.clean = false;
      }
    }

    // only update if dirty and in graph
    if( (useCache && rstyle.clean) || ele.removed() ){ continue; }

    // only update if not display: none
    if( ( ele as REle ).pstyle('display').value === 'none' ){ continue; }

    if( _p.group === 'nodes' ){
      nodes.push( ele as REle );
    } else { // edges
      edges.push( ele );
    }

    rstyle.clean = true;
  }

  // update node data from projections
  for( let i = 0; i < nodes.length; i++ ){
    let ele = nodes[i];
    let _p = ele._private;
    let rstyle = _p.rstyle;
    let pos = ele.position();

    this.recalculateNodeLabelProjection( ele );

    rstyle.nodeX = pos.x;
    rstyle.nodeY = pos.y;
    rstyle.nodeW = ele.pstyle( 'width' ).pfValue;
    rstyle.nodeH = ele.pstyle( 'height' ).pfValue;
  }

  this.recalculateEdgeProjections( edges );

  // update edge data from projections
  for( let i = 0; i < edges.length; i++ ){
    let ele = edges[ i ];
    let _p = ele._private;
    let rstyle = _p.rstyle;
    let rs = _p.rscratch;

    // update rstyle positions
    rstyle.srcX = rs.arrowStartX;
    rstyle.srcY = rs.arrowStartY;
    rstyle.tgtX = rs.arrowEndX;
    rstyle.tgtY = rs.arrowEndY;
    rstyle.midX = rs.midX;
    rstyle.midY = rs.midY;
    rstyle.labelAngle = rs.labelAngle;
    rstyle.sourceLabelAngle = rs.sourceLabelAngle;
    rstyle.targetLabelAngle = rs.targetLabelAngle;
  }
};

export default BRp;
