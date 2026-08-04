import * as math from '../../math.mjs';
import type { Position } from '../../types.mjs';
import type { Collection, SharedCollection } from '../eles-types.mjs';

// The renderer's edge-point geometry getters are internal renderer methods.
// They are typed locally (rather than on CoreRendererAccess) on purpose:
// CoreRendererAccess is reachable from the public d.ts via cy()/eles.renderer(),
// and these internal methods should not be exposed there. The renderer's real
// type lives in the higher-layer renderer extension, which collection code must
// not depend on. The casts below are guarded by isEdge()/takesUpSpace().
interface EdgePointRenderer {
  getControlPoints( ele: Collection ): Position[];
  getSegmentPoints( ele: Collection ): Position[];
  getSourceEndpoint( ele: Collection ): Position;
  getTargetEndpoint( ele: Collection ): Position;
  getEdgeMidpoint( ele: Collection ): Position;
}

const renderer = ( ele: Collection ) => ele.renderer() as unknown as EdgePointRenderer;

const ifEdge = <T,>( ele: Collection, getValue: ( ele: Collection ) => T ): T | undefined => {
  if( ele.isEdge() && ele.takesUpSpace() ){
    return getValue( ele );
  }
};

const ifEdgeRenderedPosition = ( ele: Collection, getPoint: ( ele: Collection ) => Position ): Position | undefined => {
  if( ele.isEdge() && ele.takesUpSpace() ){
    let cy = ele.cy();

    return math.modelToRenderedPosition( getPoint( ele ), cy.zoom(), cy.pan() );
  }
};

const ifEdgeRenderedPositions = ( ele: Collection, getPoints: ( ele: Collection ) => Position[] ): Position[] | undefined => {
  if( ele.isEdge() && ele.takesUpSpace() ){
    let cy = ele.cy();
    let pan = cy.pan();
    let zoom = cy.zoom();

    return getPoints( ele ).map( p => math.modelToRenderedPosition( p, zoom, pan ) );
  }
};

const controlPoints = ( ele: Collection ) => renderer( ele ).getControlPoints( ele );
const segmentPoints = ( ele: Collection ) => renderer( ele ).getSegmentPoints( ele );
const sourceEndpoint = ( ele: Collection ) => renderer( ele ).getSourceEndpoint( ele );
const targetEndpoint = ( ele: Collection ) => renderer( ele ).getTargetEndpoint( ele );
const midpoint = ( ele: Collection ) => renderer( ele ).getEdgeMidpoint( ele );

interface PtSpec {
  get: ( ele: Collection ) => Position | Position[];
  mult?: boolean;
}

const pts: Record<string, PtSpec> = {
  controlPoints: { get: controlPoints, mult: true },
  segmentPoints: { get: segmentPoints, mult: true },
  sourceEndpoint: { get: sourceEndpoint },
  targetEndpoint: { get: targetEndpoint },
  midpoint: { get: midpoint }
};

const renderedName = ( name: string ) => 'rendered' + name[0].toUpperCase() + name.substr(1);

/** Edge-point accessors contributed to the collection prototype. */
export interface CollectionEdgePoints {
  controlPoints( this: SharedCollection ): Position[] | undefined;
  renderedControlPoints( this: SharedCollection ): Position[] | undefined;
  segmentPoints( this: SharedCollection ): Position[] | undefined;
  renderedSegmentPoints( this: SharedCollection ): Position[] | undefined;
  sourceEndpoint( this: SharedCollection ): Position | undefined;
  renderedSourceEndpoint( this: SharedCollection ): Position | undefined;
  targetEndpoint( this: SharedCollection ): Position | undefined;
  renderedTargetEndpoint( this: SharedCollection ): Position | undefined;
  midpoint( this: SharedCollection ): Position | undefined;
  renderedMidpoint( this: SharedCollection ): Position | undefined;
}

type EdgePointFn = ( this: SharedCollection ) => Position | Position[] | undefined;

let elesfn = Object.keys( pts ).reduce( ( obj: Record<string, EdgePointFn>, name ) => {
  let spec = pts[ name ];
  let rName = renderedName( name );

  obj[ name ] = function( this: SharedCollection ){ return ifEdge( this as Collection, spec.get ); };

  if( spec.mult ){
    obj[ rName ] = function( this: SharedCollection ){ return ifEdgeRenderedPositions( this as Collection, spec.get as ( ele: Collection ) => Position[] ); };
  } else {
    obj[ rName ] = function( this: SharedCollection ){ return ifEdgeRenderedPosition( this as Collection, spec.get as ( ele: Collection ) => Position ); };
  }

  return obj;
}, {} );

export default elesfn as unknown as CollectionEdgePoints;
