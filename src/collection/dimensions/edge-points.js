import * as math from '../../math';

const ifEdge = (ele, getValue) => {
  if( ele.isEdge() ){
    return getValue( ele );
  }
};

const ifEdgeRenderedPosition = (ele, getPoint) => {
  if( ele.isEdge() ){
    let cy = ele.cy();

    return math.modelToRenderedPosition( getPoint( ele ), cy.zoom(), cy.pan() );
  }
};

const ifEdgeRenderedPositions = (ele, getPoints) => {
  if( ele.isEdge() ){
    let cy = ele.cy();
    let pan = cy.pan();
    let zoom = cy.zoom();

    return getPoints( ele ).map( p => math.modelToRenderedPosition( p, zoom, pan ) );
  }
};

const controlPoints = ele => ele.renderer().getControlPoints( ele );
const segmentPoints = ele => ele.renderer().getSegmentPoints( ele );
const sourceEndpoint = ele => ele.renderer().getSourceEndpoint( ele );
const targetEndpoint = ele => ele.renderer().getTargetEndpoint( ele );
const midpoint = ele => ele.renderer().getEdgeMidpoint( ele );

const pts = {

     /**
 * @typedef {object} edge_controlPoints
 * @property {object} NULL
 * @property {object} NULL
 */

  /**
 * Get an array of control point positions for a [`curve-style: bezier`](#style/bezier-edges) or [`curve-style: unbundled-bezier`](#style/unbundled-bezier-edges) edge.
 * @memberof edge
 * @path Collection/Edge points
 * @sub_functions edge.controlPoints|edge.renderedControlPoints
 * @param {...edge_controlPoints} val - Get the control points in [model co-ordinates](#notation/position). | Get the control points in [rendered co-ordinates](#notation/position).
 * @methodName edge.controlPoints
 */
  controlPoints: { get: controlPoints, mult: true },

       /**
 * @typedef {object} edge_segmentPoints
 * @property {object} NULL
 * @property {object} NULL
 */

  /**
 * Get an array of segment point positions (i.e. bend points) for a [`curve-style: segments`](#style/segments-edges) edge.
 * @memberof edge
 * @path Collection/Edge points
 * @sub_functions edge.segmentPoints|edge.renderedSegmentPoints
 * @param {...edge_segmentPoints} val - Get the segment points in [model co-ordinates](#notation/position). | Get the segment points in [rendered co-ordinates](#notation/position).
 * @methodName edge.segmentPoints
 */
  segmentPoints: { get: segmentPoints, mult: true },

  /**
 * @typedef {object} edge_sourceEndpoint
 * @property {object} NULL
 * @property {object} NULL
 */

  /**
 * Get the position of where the edge ends, towards the source node.
 * @memberof edge
 * @path Collection/Edge points
 * @sub_functions edge.sourceEndpoint|edge.renderedSourceEndpoint
 * @param {...edge_sourceEndpoint} val - Get the source endpoint in [model co-ordinates](#notation/position). | Get the target endpoint in [rendered co-ordinates](#notation/position).
 * @methodName edge.sourceEndpoint
 */
  sourceEndpoint: { get: sourceEndpoint },

  /**
 * @typedef {object} edge_targetEndpoint
 * @property {object} NULL
 * @property {object} NULL
 */

  /**
 * Get the position of where the edge ends, towards the target node.
 * @memberof edge
 * @path Collection/Edge points
 * @sub_functions edge.targetEndpoint|edge.renderedTargetEndpoint
 * @param {...edge_targetEndpoint} val - Get the target endpoint in [model co-ordinates](#notation/position). | Get the target endpoint in [rendered co-ordinates](#notation/position).
 * @methodName edge.targetEndpoint
 */
  targetEndpoint: { get: targetEndpoint },

  /**
 * @typedef {object} edge_midpoint
 * @property {object} NULL
 * @property {object} NULL
 */

  /**
 * Get the position of the midpoint of the edge.
 * @memberof edge
 * @path Collection/Edge points
 * @sub_functions edge.midpoint|edge.renderedMidpoint
 * @param {...edge_midpoint} val - Get the midpoint in [model co-ordinates](#notation/position). | Get the midpoint in [rendered co-ordinates](#notation/position).
 * @methodName edge.midpoint
 */
  midpoint: { get: midpoint }
};

const renderedName = name => 'rendered' + name[0].toUpperCase() + name.substr(1);

export default Object.keys( pts ).reduce( ( obj, name ) => {
  let spec = pts[ name ];
  let rName = renderedName( name );

  obj[ name ] = function(){ return ifEdge( this, spec.get ); };

  if( spec.mult ){
    obj[ rName ] = function(){ return ifEdgeRenderedPositions( this, spec.get ); };
  } else {
    obj[ rName ] = function(){ return ifEdgeRenderedPosition( this, spec.get ); };
  }

  return obj;
}, {} );
