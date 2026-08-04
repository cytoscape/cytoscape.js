import * as util from '../../util/index.mjs';
import position, { type CollectionPosition } from './position.mjs';
import bounds, { type CollectionBounds } from './bounds.mjs';
import widthHeight, { type CollectionWidthHeight } from './width-height.mjs';
import edgePoints, { type CollectionEdgePoints } from './edge-points.mjs';

/**
 * All dimension/geometry methods contributed to the collection prototype,
 * assembled from the per-file mixins (mirrors the runtime assembly below).
 */
export interface CollectionDimensions extends
  CollectionPosition,
  CollectionBounds,
  CollectionWidthHeight,
  CollectionEdgePoints {}

let elesfn = util.assign( {}, position, bounds, widthHeight, edgePoints );

export default elesfn as CollectionDimensions;
