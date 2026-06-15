/*
The CoSE layout was written by Gerardo Huck.
https://www.linkedin.com/in/gerardohuck/

Based on the following article:
http://dl.acm.org/citation.cfm?id=1498047

Modifications tracked on Github.
*/

import * as util from '../../util/index.mjs';
import * as math from '../../math.mjs';
import * as is from '../../is.mjs';
import type { LayoutBase, LayoutOptionsBase, Core, Collection } from './layout-base.mjs';
import type { Element, SharedCollection } from '../../collection/eles-types.mjs';
import type { Position, BoundingBox } from '../../types.mjs';

/** Options for the CoSE layout (from the `defaults` object). */
export interface CoseLayoutOptions extends LayoutOptionsBase {
  animationThreshold?: number;
  refresh?: number;
  nodeDimensionsIncludeLabels?: boolean;
  randomize?: boolean;
  componentSpacing?: number;
  nodeRepulsion?: number | ( ( node: Element ) => number );
  nodeOverlap?: number;
  idealEdgeLength?: number | ( ( edge: Element ) => number );
  edgeElasticity?: number | ( ( edge: Element ) => number );
  nestingFactor?: number;
  gravity?: number;
  numIter?: number;
  initialTemp?: number;
  coolingFactor?: number;
  minTemp?: number;
  debug?: boolean;
  // populated by the constructor; the running layout instance
  layout?: CoseLayout;
}

/** A node struct in the layout model. */
interface CoseNode {
  isLocked: boolean;
  id: string;
  parentId: string | undefined;
  cmptId: number;
  children: string[];
  positionX: number;
  positionY: number;
  offsetX: number;
  offsetY: number;
  height: number;
  width: number;
  maxX: number | undefined;
  minX: number | undefined;
  maxY: number | undefined;
  minY: number | undefined;
  padLeft: number;
  padRight: number;
  padTop: number;
  padBottom: number;
  nodeRepulsion: number;
}

/** An edge struct in the layout model. */
interface CoseEdge {
  id: string;
  sourceId: string;
  targetId: string;
  idealLength: number;
  elasticity: number;
}

/**
 * A graph is the list of node ids belonging to one level of the compound
 * hierarchy. `separateComponents` augments per-component arrays with bounds.
 */
type CoseGraph = string[];

/** A component (group of nodes) annotated with a bounding box by `separateComponents`. */
interface CoseComponent extends Array<CoseNode> {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
  w: number;
  h: number;
}

/** The big bag of state threaded through the physics simulation. */
interface LayoutInfo {
  isCompound: boolean;
  layoutNodes: CoseNode[];
  idToIndex: { [id: string]: number };
  nodeSize: number;
  graphSet: CoseGraph[];
  indexToGraph: number[];
  layoutEdges: CoseEdge[];
  edgeSize: number;
  temperature: number;
  clientWidth: number;
  clientHeight: number;
  boundingBox: BoundingBox;
  ready?: boolean;
}

interface CoseLayout extends LayoutBase {
  options: CoseLayoutOptions;
  stopped?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- legacy worker handle, untyped
  thread?: any;
}

let DEBUG: boolean;

/**
 * @brief :  default layout options
 */
const defaults = {
  // Called on `layoutready`
  ready: function(){},

  // Called on `layoutstop`
  stop: function(){},

  // Whether to animate while running the layout
  // true : Animate continuously as the layout is running
  // false : Just show the end result
  // 'end' : Animate with the end result, from the initial positions to the end positions
  animate: true,

  // Easing of the animation for animate:'end'
  animationEasing: undefined,

  // The duration of the animation for animate:'end'
  animationDuration: undefined,

  // A function that determines whether the node should be animated
  // All nodes animated by default on animate enabled
  // Non-animated nodes are positioned immediately when the layout starts
  animateFilter: function ( node: Element, i: number ){ return true; },


  // The layout animates only after this many milliseconds for animate:true
  // (prevents flashing on fast runs)
  animationThreshold: 250,

  // Number of iterations between consecutive screen positions update
  refresh: 20,

  // Whether to fit the network view after when done
  fit: true,

  // Padding on fit
  padding: 30,

  // Constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
  boundingBox: undefined,

  // Excludes the label when calculating node bounding boxes for the layout algorithm
  nodeDimensionsIncludeLabels: false,

  // Randomize the initial positions of the nodes (true) or use existing positions (false)
  randomize: false,

  // Extra spacing between components in non-compound graphs
  componentSpacing: 40,

  // Node repulsion (non overlapping) multiplier
  nodeRepulsion: function( node: Element ){ return 2048; },

  // Node repulsion (overlapping) multiplier
  nodeOverlap: 4,

  // Ideal edge (non nested) length
  idealEdgeLength: function( edge: Element ){ return 32; },

  // Divisor to compute edge forces
  edgeElasticity: function( edge: Element ){ return 32; },

  // Nesting factor (multiplier) to compute ideal edge length for nested edges
  nestingFactor: 1.2,

  // Gravity force (constant)
  gravity: 1,

  // Maximum number of iterations to perform
  numIter: 1000,

  // Initial temperature (maximum node displacement)
  initialTemp: 1000,

  // Cooling factor (how the temperature is reduced between consecutive iterations
  coolingFactor: 0.99,

  // Lower temperature threshold (below this point the layout will end)
  minTemp: 1.0
};


/**
 * @brief       : constructor
 * @arg options : object containing layout options
 */
// eslint-disable-next-line @typescript-eslint/no-redeclare -- intentional declaration merging with the interface above
function CoseLayout( this: CoseLayout, options: CoseLayoutOptions ){
  this.options = util.extend( {}, defaults, options ) as CoseLayoutOptions;
  this.options.layout = this;

  // Exclude any edge that has a source or target node that is not in the set of passed-in nodes
  const nodes = this.options.eles.nodes();
  const edges = this.options.eles.edges();
  const notEdges = edges.filter(( e: Element ) => {
    const sourceId = e.source().data('id');
    const targetId = e.target().data('id');
    const hasSource = nodes.some(( n: Element ) => n.data('id') === sourceId);
    const hasTarget = nodes.some(( n: Element ) => n.data('id') === targetId);
    return !hasSource || !hasTarget;
  });
  this.options.eles = this.options.eles.not(notEdges);
}

/**
 * @brief : runs the layout
 */
CoseLayout.prototype.run = function( this: CoseLayout ){
  let options = this.options;
  let cy: Core = options.cy;
  let layout = this; // eslint-disable-line @typescript-eslint/no-this-alias

  layout.stopped = false;

  if( options.animate === true || options.animate === false ){
    // emit accepts an event-object payload at runtime; cast through the string param
    layout.emit( { type: 'layoutstart', layout: layout } as unknown as string );
  }

  // Set DEBUG - Global variable
  if( true === options.debug ){
    DEBUG = true;
  } else {
    DEBUG = false;
  }

  // Initialize layout info
  let layoutInfo = createLayoutInfo( cy, layout, options );

  // Show LayoutInfo contents if debugging
  if( DEBUG ){
    printLayoutInfo( layoutInfo );
  }

  // If required, randomize node positions
  if (options.randomize) {
    randomizePositions( layoutInfo, cy );
  }

  let startTime = util.performanceNow();

  let refresh = function(){
    refreshPositions( layoutInfo, cy, options );

    // Fit the graph if necessary
    if( true === options.fit ){
      ( cy as unknown as { fit( padding?: number ): void } ).fit( options.padding );
    }
  };

  let mainLoop = function( i: number ){
    if( layout.stopped || i >= options.numIter! ){
      // logDebug("Layout manually stopped. Stopping computation in step " + i);
      return false;
    }

    // Do one step in the phisical simulation
    step( layoutInfo, options, i );

    // Update temperature
    layoutInfo.temperature = layoutInfo.temperature * options.coolingFactor!;
    // logDebug("New temperature: " + layoutInfo.temperature);

    if( layoutInfo.temperature < options.minTemp! ){
      // logDebug("Temperature drop below minimum threshold. Stopping computation in step " + i);
      return false;
    }

    return true;
  };

  let done = function(){
    if( options.animate === true || options.animate === false ){
      refresh();

      // Layout has finished
      layout.one('layoutstop', options.stop!);
      layout.emit({ type: 'layoutstop', layout: layout } as unknown as string );
    } else {
      let nodes = options.eles.nodes();
      let getScaledPos = getScaleInBoundsFn(layoutInfo, options, nodes);

      nodes.layoutPositions(
        layout as unknown as Parameters<Collection['layoutPositions']>[0],
        options as unknown as Parameters<Collection['layoutPositions']>[1],
        getScaledPos
      );
    }
  };

  let i = 0;
  let loopRet = true;

  if( options.animate === true ){
    let frame = function(){
      let f = 0;

      while( loopRet && f < options.refresh! ){
        loopRet = mainLoop(i);

        i++;
        f++;
      }

      if( !loopRet ){ // it's done
        separateComponents( layoutInfo, options );
        done();
      } else {
        let now = util.performanceNow();

        if( now - startTime >= options.animationThreshold! ){
          refresh();
        }

        util.requestAnimationFrame(frame);
      }
    };

    frame();
  } else {
    while( loopRet ){
      loopRet = mainLoop(i);

      i++;
    }

    separateComponents( layoutInfo, options );
    done();
  }

  return this; // chaining
};


/**
 * @brief : called on continuous layouts to stop them before they finish
 */
CoseLayout.prototype.stop = function( this: CoseLayout ){
  this.stopped = true;

  if( this.thread ){
    this.thread.stop();
  }

  this.emit( 'layoutstop' );

  return this; // chaining
};

CoseLayout.prototype.destroy = function( this: CoseLayout ){
  if( this.thread ){
    this.thread.stop();
  }

  return this; // chaining
};


/**
 * @brief     : Creates an object which is contains all the data
 *              used in the layout process
 * @arg cy    : cytoscape.js object
 * @return    : layoutInfo object initialized
 */
let createLayoutInfo = function( cy: Core, layout: CoseLayout, options: CoseLayoutOptions ): LayoutInfo {
  // Shortcut
  let edges = options.eles.edges();
  let nodes = options.eles.nodes();
  let bb = math.makeBoundingBox( options.boundingBox ? options.boundingBox : {
    x1: 0, y1: 0, w: ( cy as unknown as { width(): number } ).width(), h: ( cy as unknown as { height(): number } ).height()
  } )!;

  let layoutInfo: LayoutInfo = {
    isCompound: cy.hasCompoundNodes(),
    layoutNodes: [],
    idToIndex: {},
    nodeSize: nodes.size(),
    graphSet: [],
    indexToGraph: [],
    layoutEdges: [],
    edgeSize: edges.size(),
    temperature: options.initialTemp!,
    clientWidth: bb.w,
    clientHeight: bb.h,
    boundingBox: bb
  };

  let components = options.eles.components();
  let id2cmptId: { [id: string]: number } = {};

  let i: number, j: number;

  for( i = 0; i < components.length; i++ ){
    let component = components[ i ];

    for( j = 0; j < component.length; j++ ){
      let node = component[ j ];

      id2cmptId[ node.id()! ] = i;
    }
  }

  // Iterate over all nodes, creating layout nodes
  for( i = 0; i < layoutInfo.nodeSize; i++ ){
    let n: Element = nodes[ i ];
    let nbb = n.layoutDimensions( options );

    let tempNode = {} as CoseNode;
    tempNode.isLocked   = !!n.locked();
    tempNode.id         = n.data( 'id' ) as string;
    tempNode.parentId   = n.data( 'parent' ) as string | undefined;
    tempNode.cmptId     = id2cmptId[ n.id()! ];
    tempNode.children   = [];
    tempNode.positionX  = n.position( 'x' ) as number;
    tempNode.positionY  = n.position( 'y' ) as number;
    tempNode.offsetX    = 0;
    tempNode.offsetY    = 0;
    tempNode.height     = nbb.w;
    tempNode.width      = nbb.h;
    tempNode.maxX       = tempNode.positionX + tempNode.width  / 2;
    tempNode.minX       = tempNode.positionX - tempNode.width  / 2;
    tempNode.maxY       = tempNode.positionY + tempNode.height / 2;
    tempNode.minY       = tempNode.positionY - tempNode.height / 2;
    tempNode.padLeft    = parseFloat( n.style( 'padding' ) as string );
    tempNode.padRight   = parseFloat( n.style( 'padding' ) as string );
    tempNode.padTop     = parseFloat( n.style( 'padding' ) as string );
    tempNode.padBottom  = parseFloat( n.style( 'padding' ) as string );

    // forces
    tempNode.nodeRepulsion = is.fn( options.nodeRepulsion ) ? ( options.nodeRepulsion as ( node: Element ) => number )(n) : ( options.nodeRepulsion as number );

    // Add new node
    layoutInfo.layoutNodes.push( tempNode );
    // Add entry to id-index map
    layoutInfo.idToIndex[ tempNode.id ] = i;
  }

  // Inline implementation of a queue, used for traversing the graph in BFS order
  let queue: string[] = [];
  let start = 0;   // Points to the start the queue
  let end   = -1;  // Points to the end of the queue

  let tempGraph: CoseGraph = [];

  // Second pass to add child information and
  // initialize queue for hierarchical traversal
  for( i = 0; i < layoutInfo.nodeSize; i++ ){
    let n = layoutInfo.layoutNodes[ i ];
    let p_id = n.parentId;
    // Check if node n has a parent node
    if( null != p_id ){
      // Add node Id to parent's list of children
      layoutInfo.layoutNodes[ layoutInfo.idToIndex[ p_id ] ].children.push( n.id );
    } else {
      // If a node doesn't have a parent, then it's in the root graph
      queue[ ++end ] = n.id;
      tempGraph.push( n.id );
    }
  }

  // Add root graph to graphSet
  layoutInfo.graphSet.push( tempGraph );

  // Traverse the graph, level by level,
  while( start <= end ){
    // Get the node to visit and remove it from queue
    let node_id  = queue[ start++ ];
    let node_ix  = layoutInfo.idToIndex[ node_id ];
    let node     = layoutInfo.layoutNodes[ node_ix ];
    let children = node.children;
    if( children.length > 0 ){
      // Add children nodes as a new graph to graph set
      layoutInfo.graphSet.push( children );
      // Add children to que queue to be visited
      for( i = 0; i < children.length; i++ ){
        queue[ ++end ] = children[ i ];
      }
    }
  }

  // Create indexToGraph map
  for( i = 0; i < layoutInfo.graphSet.length; i++ ){
    let graph = layoutInfo.graphSet[ i ];
    for( j = 0; j < graph.length; j++ ){
      let index = layoutInfo.idToIndex[ graph[ j ] ];
      layoutInfo.indexToGraph[ index ] = i;
    }
  }

  // Iterate over all edges, creating Layout Edges
  for( i = 0; i < layoutInfo.edgeSize; i++ ){
    let e = edges[ i ];
    let tempEdge = {} as CoseEdge;
    tempEdge.id       = e.data( 'id' ) as string;
    tempEdge.sourceId = e.data( 'source' ) as string;
    tempEdge.targetId = e.data( 'target' ) as string;

    // Compute ideal length
    let idealLength = is.fn( options.idealEdgeLength ) ? ( options.idealEdgeLength as ( edge: Element ) => number )(e) : ( options.idealEdgeLength as number );
    let elasticity = is.fn( options.edgeElasticity ) ? ( options.edgeElasticity as ( edge: Element ) => number )(e) : ( options.edgeElasticity as number );

    // Check if it's an inter graph edge
    let sourceIx    = layoutInfo.idToIndex[ tempEdge.sourceId ];
    let targetIx    = layoutInfo.idToIndex[ tempEdge.targetId ];
    let sourceGraph = layoutInfo.indexToGraph[ sourceIx ];
    let targetGraph = layoutInfo.indexToGraph[ targetIx ];

    if( sourceGraph != targetGraph ){
      // Find lowest common graph ancestor
      let lca = findLCA( tempEdge.sourceId, tempEdge.targetId, layoutInfo );

      // Compute sum of node depths, relative to lca graph
      let lcaGraph = layoutInfo.graphSet[ lca ];
      let depth    = 0;

      // Source depth
      let tempNode = layoutInfo.layoutNodes[ sourceIx ];
      while( -1 === lcaGraph.indexOf( tempNode.id ) ){
        tempNode = layoutInfo.layoutNodes[ layoutInfo.idToIndex[ tempNode.parentId! ] ];
        depth++;
      }

      // Target depth
      tempNode = layoutInfo.layoutNodes[ targetIx ];
      while( -1 === lcaGraph.indexOf( tempNode.id ) ){
        tempNode = layoutInfo.layoutNodes[ layoutInfo.idToIndex[ tempNode.parentId! ] ];
        depth++;
      }

      // logDebug('LCA of nodes ' + tempEdge.sourceId + ' and ' + tempEdge.targetId +
      //  ". Index: " + lca + " Contents: " + lcaGraph.toString() +
      //  ". Depth: " + depth);

      // Update idealLength
      idealLength *= depth * options.nestingFactor!;
    }

    tempEdge.idealLength = idealLength;
    tempEdge.elasticity = elasticity;

    layoutInfo.layoutEdges.push( tempEdge );
  }

  // Finally, return layoutInfo object
  return layoutInfo;
};


/**
 * @brief : This function finds the index of the lowest common
 *          graph ancestor between 2 nodes in the subtree
 *          (from the graph hierarchy induced tree) whose
 *          root is graphIx
 *
 * @arg node1: node1's ID
 * @arg node2: node2's ID
 * @arg layoutInfo: layoutInfo object
 *
 */
let findLCA = function( node1: string, node2: string, layoutInfo: LayoutInfo ): number {
  // Find their common ancester, starting from the root graph
  let res = findLCA_aux( node1, node2, 0, layoutInfo );
  if( 2 > res.count ){
    // If aux function couldn't find the common ancester,
    // then it is the root graph
    return 0;
  } else {
    return res.graph;
  }
};


/**
 * @brief          : Auxiliary function used for LCA computation
 *
 * @arg node1      : node1's ID
 * @arg node2      : node2's ID
 * @arg graphIx    : subgraph index
 * @arg layoutInfo : layoutInfo object
 *
 * @return         : object of the form {count: X, graph: Y}, where:
 *                   X is the number of ancestors (max: 2) found in
 *                   graphIx (and it's subgraphs),
 *                   Y is the graph index of the lowest graph containing
 *                   all X nodes
 */
let findLCA_aux = function( node1: string, node2: string, graphIx: number, layoutInfo: LayoutInfo ): { count: number; graph: number } {
  let graph = layoutInfo.graphSet[ graphIx ];
  // If both nodes belongs to graphIx
  if( -1 < graph.indexOf( node1 ) && -1 < graph.indexOf( node2 ) ){
    return {count: 2, graph: graphIx};
  }

  // Make recursive calls for all subgraphs
  let c = 0;
  for( let i = 0; i < graph.length; i++ ){
    let nodeId   = graph[ i ];
    let nodeIx   = layoutInfo.idToIndex[ nodeId ];
    let children = layoutInfo.layoutNodes[ nodeIx ].children;

    // If the node has no child, skip it
    if( 0 === children.length ){
      continue;
    }

    let childGraphIx = layoutInfo.indexToGraph[ layoutInfo.idToIndex[ children[0] ] ];
    let result = findLCA_aux( node1, node2, childGraphIx, layoutInfo );
    if( 0 === result.count ){
      // Neither node1 nor node2 are present in this subgraph
      continue;
    } else if( 1 === result.count ){
      // One of (node1, node2) is present in this subgraph
      c++;
      if( 2 === c ){
        // We've already found both nodes, no need to keep searching
        break;
      }
    } else {
      // Both nodes are present in this subgraph
      return result;
    }
  }

  return {count: c, graph: graphIx};
};


/**
 * @brief: printsLayoutInfo into js console
 *         Only used for debbuging
 */
// declared at module scope so it stays referenceable from run() regardless of
// the conditional assignment below (preserves the original var-hoisting behaviour)
let printLayoutInfo: ( layoutInfo: LayoutInfo ) => void;
if( process.env.NODE_ENV !== 'production' ){
  printLayoutInfo = function( layoutInfo: LayoutInfo ){
    /* eslint-disable */

    if( !DEBUG ){
      return;
    }
    console.debug( 'layoutNodes:' );
    for( var i = 0; i < layoutInfo.nodeSize; i++ ){
      var n = layoutInfo.layoutNodes[ i ];
      var s =
      '\nindex: '     + i +
      '\nId: '        + n.id +
      '\nChildren: '  + n.children.toString() +
      '\nparentId: '  + n.parentId  +
      '\npositionX: ' + n.positionX +
      '\npositionY: ' + n.positionY +
      '\nOffsetX: ' + n.offsetX +
      '\nOffsetY: ' + n.offsetY +
      '\npadLeft: ' + n.padLeft +
      '\npadRight: ' + n.padRight +
      '\npadTop: ' + n.padTop +
      '\npadBottom: ' + n.padBottom;

      console.debug( s );
    }

    console.debug( 'idToIndex' );
    for( var id in layoutInfo.idToIndex ){
      console.debug( 'Id: ' + id + '\nIndex: ' + layoutInfo.idToIndex[ id ] );
    }

    console.debug( 'Graph Set' );
    var set = layoutInfo.graphSet;
    for( var i = 0; i < set.length; i ++ ){
      console.debug( 'Set : ' + i + ': ' + set[ i ].toString() );
    }

    var s = 'IndexToGraph';
    for( var i = 0; i < layoutInfo.indexToGraph.length; i ++ ){
      s += '\nIndex : ' + i + ' Graph: ' + layoutInfo.indexToGraph[ i ];
    }
    console.debug( s );

    s = 'Layout Edges';
    for( var i = 0; i < layoutInfo.layoutEdges.length; i++ ){
      var e = layoutInfo.layoutEdges[ i ];
      s += '\nEdge Index: ' + i + ' ID: ' + e.id +
      ' SouceID: ' + e.sourceId + ' TargetId: ' + e.targetId +
      ' Ideal Length: ' + e.idealLength;
    }
    console.debug( s );

    s =  'nodeSize: ' + layoutInfo.nodeSize;
    s += '\nedgeSize: ' + layoutInfo.edgeSize;
    s += '\ntemperature: ' + layoutInfo.temperature;
    console.debug( s );

    return;
    /* eslint-enable */
  };
}

/**
 * @brief : Randomizes the position of all nodes
 */
let randomizePositions = function( layoutInfo: LayoutInfo, cy: Core ){
  let width     = layoutInfo.clientWidth;
  let height    = layoutInfo.clientHeight;

  for( let i = 0; i < layoutInfo.nodeSize; i++ ){
    let n = layoutInfo.layoutNodes[ i ];

    // No need to randomize compound nodes or locked nodes
    if( 0 === n.children.length && !n.isLocked ){
      n.positionX = Math.random() * width;
      n.positionY = Math.random() * height;
    }
  }
};

let getScaleInBoundsFn = function( layoutInfo: LayoutInfo, options: CoseLayoutOptions, nodes: SharedCollection ): ( ele: Element, i: number ) => Position {
  let bb = layoutInfo.boundingBox;
  let coseBB = { x1: Infinity, x2: -Infinity, y1: Infinity, y2: -Infinity, w: 0, h: 0 };

  if( options.boundingBox ){
    nodes.forEach( function( node: Element ){
      let lnode = layoutInfo.layoutNodes[ layoutInfo.idToIndex[ node.data( 'id' ) as string ] ];

      coseBB.x1 = Math.min( coseBB.x1, lnode.positionX );
      coseBB.x2 = Math.max( coseBB.x2, lnode.positionX );

      coseBB.y1 = Math.min( coseBB.y1, lnode.positionY );
      coseBB.y2 = Math.max( coseBB.y2, lnode.positionY );
    } );

    coseBB.w = coseBB.x2 - coseBB.x1;
    coseBB.h = coseBB.y2 - coseBB.y1;
  }

  return function( ele: Element, i: number ): Position {
    let lnode = layoutInfo.layoutNodes[ layoutInfo.idToIndex[ ele.data( 'id' ) as string ] ];

    if( options.boundingBox ){ // then add extra bounding box constraint
      // Handle single node case where coseBB.w or coseBB.h is 0
      let pctX = coseBB.w === 0 ? 0.5 : (lnode.positionX - coseBB.x1) / coseBB.w;
      let pctY = coseBB.h === 0 ? 0.5 : (lnode.positionY - coseBB.y1) / coseBB.h;

      return {
        x: bb.x1 + pctX * bb.w,
        y: bb.y1 + pctY * bb.h
      };
    } else {
      return {
        x: lnode.positionX,
        y: lnode.positionY
      };
    }
  };
};

/**
 * @brief          : Updates the positions of nodes in the network
 * @arg layoutInfo : LayoutInfo object
 * @arg cy         : Cytoscape object
 * @arg options    : Layout options
 */
let refreshPositions = function( this: unknown, layoutInfo: LayoutInfo, cy: Core, options: CoseLayoutOptions ){
  // var s = 'Refreshing positions';
  // logDebug(s);

  let layout = options.layout!;
  let nodes = options.eles.nodes();
  let getScaledPos = getScaleInBoundsFn(layoutInfo, options, nodes);

  nodes.positions(getScaledPos);

  // Trigger layoutReady only on first call
  if( true !== layoutInfo.ready ){
    // s = 'Triggering layoutready';
    // logDebug(s);
    layoutInfo.ready = true;
    layout.one( 'layoutready', options.ready! );
    // preserve original `this` payload (undefined at runtime here)
    layout.emit( { type: 'layoutready', layout: this } as unknown as string );
  }
};

/**
 * @brief : Logs a debug message in JS console, if DEBUG is ON
 */
// var logDebug = function(text) {
//   if (DEBUG) {
//     console.debug(text);
//   }
// };

/**
 * @brief          : Performs one iteration of the physical simulation
 * @arg layoutInfo : LayoutInfo object already initialized
 * @arg cy         : Cytoscape object
 * @arg options    : Layout options
 */
let step = function( layoutInfo: LayoutInfo, options: CoseLayoutOptions, step: number ){
  // var s = "\n\n###############################";
  // s += "\nSTEP: " + step;
  // s += "\n###############################\n";
  // logDebug(s);

  // Calculate node repulsions
  calculateNodeForces( layoutInfo, options );
  // Calculate edge forces
  calculateEdgeForces( layoutInfo, options );
  // Calculate gravity forces
  calculateGravityForces( layoutInfo, options );
  // Propagate forces from parent to child
  propagateForces( layoutInfo, options );
  // Update positions based on calculated forces
  updatePositions( layoutInfo, options );
};

/**
 * @brief : Computes the node repulsion forces
 */
let calculateNodeForces = function( layoutInfo: LayoutInfo, options: CoseLayoutOptions ){
  // Go through each of the graphs in graphSet
  // Nodes only repel each other if they belong to the same graph
  // var s = 'calculateNodeForces';
  // logDebug(s);
  for( let i = 0; i < layoutInfo.graphSet.length; i ++ ){
    let graph    = layoutInfo.graphSet[ i ];
    let numNodes = graph.length;

    // s = "Set: " + graph.toString();
    // logDebug(s);

    // Now get all the pairs of nodes
    // Only get each pair once, (A, B) = (B, A)
    for( let j = 0; j < numNodes; j++ ){
      let node1 = layoutInfo.layoutNodes[ layoutInfo.idToIndex[ graph[ j ] ] ];

      for( let k = j + 1; k < numNodes; k++ ){
        let node2 = layoutInfo.layoutNodes[ layoutInfo.idToIndex[ graph[ k ] ] ];

        nodeRepulsion( node1, node2, layoutInfo, options );
      }
    }
  }
};

let randomDistance = function( max: number ){
  return -max + 2 * max * Math.random();
};

/**
 * @brief : Compute the node repulsion forces between a pair of nodes
 */
let nodeRepulsion = function( node1: CoseNode, node2: CoseNode, layoutInfo: LayoutInfo, options: CoseLayoutOptions ){
  // var s = "Node repulsion. Node1: " + node1.id + " Node2: " + node2.id;

  let cmptId1 = node1.cmptId;
  let cmptId2 = node2.cmptId;

  if( cmptId1 !== cmptId2 && !layoutInfo.isCompound ){ return; }

  // Get direction of line connecting both node centers
  let directionX = node2.positionX - node1.positionX;
  let directionY = node2.positionY - node1.positionY;
  let maxRandDist = 1;
  // s += "\ndirectionX: " + directionX + ", directionY: " + directionY;

  // If both centers are the same, apply a random force
  if( 0 === directionX && 0 === directionY ){
    directionX = randomDistance( maxRandDist );
    directionY = randomDistance( maxRandDist );
  }

  let overlap = nodesOverlap( node1, node2, directionX, directionY );

  // forceX/forceY are computed in one branch and consumed below (original
  // relied on var-hoisting); declare them once at the top of the scope.
  let forceX: number, forceY: number;

  if( overlap > 0 ){
    // s += "\nNodes DO overlap.";
    // s += "\nOverlap: " + overlap;
    // If nodes overlap, repulsion force is proportional
    // to the overlap
    let force    = options.nodeOverlap! * overlap;

    // Compute the module and components of the force vector
    let distance = Math.sqrt( directionX * directionX + directionY * directionY );
    // s += "\nDistance: " + distance;
    forceX   = force * directionX / distance;
    forceY   = force * directionY / distance;

  } else {
    // s += "\nNodes do NOT overlap.";
    // If there's no overlap, force is inversely proportional
    // to squared distance

    // Get clipping points for both nodes
    let point1 = findClippingPoint( node1, directionX, directionY );
    let point2 = findClippingPoint( node2, -1 * directionX, -1 * directionY );

    // Use clipping points to compute distance
    let distanceX   = point2.x - point1.x;
    let distanceY   = point2.y - point1.y;
    let distanceSqr = distanceX * distanceX + distanceY * distanceY;
    let distance    = Math.sqrt( distanceSqr );
    // s += "\nDistance: " + distance;

    // Compute the module and components of the force vector
    let force  = ( node1.nodeRepulsion + node2.nodeRepulsion ) / distanceSqr;
    forceX = force * distanceX / distance;
    forceY = force * distanceY / distance;
  }

  // Apply force
  if( !node1.isLocked ){
    node1.offsetX -= forceX;
    node1.offsetY -= forceY;
  }

  if( !node2.isLocked ){
    node2.offsetX += forceX;
    node2.offsetY += forceY;
  }

  // s += "\nForceX: " + forceX + " ForceY: " + forceY;
  // logDebug(s);

  return;
};

/**
 * @brief  : Determines whether two nodes overlap or not
 * @return : Amount of overlapping (0 => no overlap)
 */
let nodesOverlap = function( node1: CoseNode, node2: CoseNode, dX: number, dY: number ){
  // overlapX/overlapY are assigned in one branch and used below; declare once
  let overlapX: number;
  let overlapY: number;

  if( dX > 0 ){
    overlapX = node1.maxX! - node2.minX!;
  } else {
    overlapX = node2.maxX! - node1.minX!;
  }

  if( dY > 0 ){
    overlapY = node1.maxY! - node2.minY!;
  } else {
    overlapY = node2.maxY! - node1.minY!;
  }

  if( overlapX >= 0 && overlapY >= 0 ){
    return Math.sqrt( overlapX * overlapX + overlapY * overlapY );
  } else {
    return 0;
  }
};

/**
 * @brief : Finds the point in which an edge (direction dX, dY) intersects
 *          the rectangular bounding box of it's source/target node
 */
let findClippingPoint = function( node: CoseNode, dX: number, dY: number ): Position {

  // Shorcuts
  let X = node.positionX;
  let Y = node.positionY;
  let H = node.height || 1;
  let W = node.width || 1;
  let dirSlope     = dY / dX;
  let nodeSlope    = H / W;

  // var s = 'Computing clipping point of node ' + node.id +
  //   " . Height:  " + H + ", Width: " + W +
  //   "\nDirection " + dX + ", " + dY;
  //
  // Compute intersection
  let res = {} as Position;

  // Case: Vertical direction (up)
  if( 0 === dX && 0 < dY ){
    res.x = X;
    // s += "\nUp direction";
    res.y = Y + H / 2;

    return res;
  }

  // Case: Vertical direction (down)
  if( 0 === dX && 0 > dY ){
    res.x = X;
    res.y = Y + H / 2;
    // s += "\nDown direction";

    return res;
  }

  // Case: Intersects the right border
  if( 0 < dX &&
  -1 * nodeSlope <= dirSlope &&
  dirSlope <= nodeSlope ){
    res.x = X + W / 2;
    res.y = Y + (W * dY / 2 / dX);
    // s += "\nRightborder";

    return res;
  }

  // Case: Intersects the left border
  if( 0 > dX &&
  -1 * nodeSlope <= dirSlope &&
  dirSlope <= nodeSlope ){
    res.x = X - W / 2;
    res.y = Y - (W * dY / 2 / dX);
    // s += "\nLeftborder";

    return res;
  }

  // Case: Intersects the top border
  if( 0 < dY &&
  ( dirSlope <= -1 * nodeSlope ||
    dirSlope >= nodeSlope ) ){
    res.x = X + (H * dX / 2 / dY);
    res.y = Y + H / 2;
    // s += "\nTop border";

    return res;
  }

  // Case: Intersects the bottom border
  if( 0 > dY &&
  ( dirSlope <= -1 * nodeSlope ||
    dirSlope >= nodeSlope ) ){
    res.x = X - (H * dX / 2 / dY);
    res.y = Y - H / 2;
    // s += "\nBottom border";

    return res;
  }

  // s += "\nClipping point found at " + res.x + ", " + res.y;
  // logDebug(s);
  return res;
};

/**
 * @brief : Calculates all edge forces
 */
let calculateEdgeForces = function( layoutInfo: LayoutInfo, options: CoseLayoutOptions ){
  // Iterate over all edges
  for( let i = 0; i < layoutInfo.edgeSize; i++ ){
    // Get edge, source & target nodes
    let edge     = layoutInfo.layoutEdges[ i ];
    let sourceIx = layoutInfo.idToIndex[ edge.sourceId ];
    let source   = layoutInfo.layoutNodes[ sourceIx ];
    let targetIx = layoutInfo.idToIndex[ edge.targetId ];
    let target   = layoutInfo.layoutNodes[ targetIx ];

    // Get direction of line connecting both node centers
    let directionX = target.positionX - source.positionX;
    let directionY = target.positionY - source.positionY;

    // If both centers are the same, do nothing.
    // A random force has already been applied as node repulsion
    if( 0 === directionX && 0 === directionY ){
      continue;
    }

    // Get clipping points for both nodes
    let point1 = findClippingPoint( source, directionX, directionY );
    let point2 = findClippingPoint( target, -1 * directionX, -1 * directionY );


    let lx = point2.x - point1.x;
    let ly = point2.y - point1.y;
    let l  = Math.sqrt( lx * lx + ly * ly );

    let force  = Math.pow( edge.idealLength - l, 2 ) / edge.elasticity;

    // forceX/forceY computed per branch, consumed below; declare once
    let forceX: number, forceY: number;

    if( 0 !== l ){
      forceX = force * lx / l;
      forceY = force * ly / l;
    } else {
      forceX = 0;
      forceY = 0;
    }

    // Add this force to target and source nodes
    if( !source.isLocked ){
      source.offsetX += forceX;
      source.offsetY += forceY;
    }

    if( !target.isLocked ){
      target.offsetX -= forceX;
      target.offsetY -= forceY;
    }

    // var s = 'Edge force between nodes ' + source.id + ' and ' + target.id;
    // s += "\nDistance: " + l + " Force: (" + forceX + ", " + forceY + ")";
    // logDebug(s);
  }
};

/**
 * @brief : Computes gravity forces for all nodes
 */
let calculateGravityForces = function( layoutInfo: LayoutInfo, options: CoseLayoutOptions ){
  if (options.gravity === 0) {
    return;
  }

  let distThreshold = 1;

  // var s = 'calculateGravityForces';
  // logDebug(s);
  for( let i = 0; i < layoutInfo.graphSet.length; i ++ ){
    let graph    = layoutInfo.graphSet[ i ];
    let numNodes = graph.length;

    // s = "Set: " + graph.toString();
    // logDebug(s);

    // Compute graph center; assigned per branch and consumed below
    let centerX: number, centerY: number;
    if( 0 === i ){
      centerX   = layoutInfo.clientHeight / 2;
      centerY   = layoutInfo.clientWidth  / 2;
    } else {
      // Get Parent node for this graph, and use its position as center
      let temp    = layoutInfo.layoutNodes[ layoutInfo.idToIndex[ graph[0] ] ];
      let parent  = layoutInfo.layoutNodes[ layoutInfo.idToIndex[ temp.parentId! ] ];
      centerX = parent.positionX;
      centerY = parent.positionY;
    }
    // s = "Center found at: " + centerX + ", " + centerY;
    // logDebug(s);

    // Apply force to all nodes in graph
    for( let j = 0; j < numNodes; j++ ){
      let node = layoutInfo.layoutNodes[ layoutInfo.idToIndex[ graph[ j ] ] ];
      // s = "Node: " + node.id;

      if( node.isLocked ){ continue; }

      let dx = centerX - node.positionX;
      let dy = centerY - node.positionY;
      let d  = Math.sqrt( dx * dx + dy * dy );
      if( d > distThreshold ){
        let fx = options.gravity! * dx / d;
        let fy = options.gravity! * dy / d;
        node.offsetX += fx;
        node.offsetY += fy;
        // s += ": Applied force: " + fx + ", " + fy;
      } else {
        // s += ": skypped since it's too close to center";
      }
      // logDebug(s);
    }
  }
};

/**
 * @brief          : This function propagates the existing offsets from
 *                   parent nodes to its descendents.
 * @arg layoutInfo : layoutInfo Object
 * @arg cy         : cytoscape Object
 * @arg options    : Layout options
 */
let propagateForces = function( layoutInfo: LayoutInfo, options: CoseLayoutOptions ){
  // Inline implementation of a queue, used for traversing the graph in BFS order
  let queue: string[] = [];
  let start = 0;   // Points to the start the queue
  let end   = -1;  // Points to the end of the queue

  // logDebug('propagateForces');

  // Start by visiting the nodes in the root graph
  // eslint-disable-next-line prefer-spread -- preserve original .apply spread of graphSet[0]
  queue.push.apply( queue, layoutInfo.graphSet[0] );
  end += layoutInfo.graphSet[0].length;

  // Traverse the graph, level by level,
  while( start <= end ){
    // Get the node to visit and remove it from queue
    let nodeId    = queue[ start++ ];
    let nodeIndex = layoutInfo.idToIndex[ nodeId ];
    let node      = layoutInfo.layoutNodes[ nodeIndex ];
    let children  = node.children;

    // We only need to process the node if it's compound
    if( 0 < children.length && !node.isLocked ){
      let offX = node.offsetX;
      let offY = node.offsetY;

      // var s = "Propagating offset from parent node : " + node.id +
      //   ". OffsetX: " + offX + ". OffsetY: " + offY;
      // s += "\n Children: " + children.toString();
      // logDebug(s);

      for( let i = 0; i < children.length; i++ ){
        let childNode = layoutInfo.layoutNodes[ layoutInfo.idToIndex[ children[ i ] ] ];
        // Propagate offset
        childNode.offsetX += offX;
        childNode.offsetY += offY;
        // Add children to queue to be visited
        queue[ ++end ] = children[ i ];
      }

      // Reset parent offsets
      node.offsetX = 0;
      node.offsetY = 0;
    }

  }
};

/**
 * @brief : Updates the layout model positions, based on
 *          the accumulated forces
 */
let updatePositions = function( layoutInfo: LayoutInfo, options: CoseLayoutOptions ){
  // var s = 'Updating positions';
  // logDebug(s);

  let i: number, n: CoseNode;

  // Reset boundaries for compound nodes
  for( i = 0; i < layoutInfo.nodeSize; i++ ){
    n = layoutInfo.layoutNodes[ i ];
    if( 0 < n.children.length ){
      // logDebug("Resetting boundaries of compound node: " + n.id);
      n.maxX = undefined;
      n.minX = undefined;
      n.maxY = undefined;
      n.minY = undefined;
    }
  }

  for( i = 0; i < layoutInfo.nodeSize; i++ ){
    n = layoutInfo.layoutNodes[ i ];
    if( 0 < n.children.length || n.isLocked ){
      // No need to set compound or locked node position
      // logDebug("Skipping position update of node: " + n.id);
      continue;
    }
    // s = "Node: " + n.id + " Previous position: (" +
    // n.positionX + ", " + n.positionY + ").";

    // Limit displacement in order to improve stability
    let tempForce = limitForce( n.offsetX, n.offsetY, layoutInfo.temperature );
    n.positionX += tempForce.x;
    n.positionY += tempForce.y;
    n.offsetX = 0;
    n.offsetY = 0;
    n.minX    = n.positionX - n.width;
    n.maxX    = n.positionX + n.width;
    n.minY    = n.positionY - n.height;
    n.maxY    = n.positionY + n.height;
    // s += " New Position: (" + n.positionX + ", " + n.positionY + ").";
    // logDebug(s);

    // Update ancestry boudaries
    updateAncestryBoundaries( n, layoutInfo );
  }

  // Update size, position of compund nodes
  for( i = 0; i < layoutInfo.nodeSize; i++ ){
    n = layoutInfo.layoutNodes[ i ];
    if( 0 < n.children.length && !n.isLocked ){
      n.positionX = (n.maxX! + n.minX!) / 2;
      n.positionY = (n.maxY! + n.minY!) / 2;
      n.width     = n.maxX! - n.minX!;
      n.height    = n.maxY! - n.minY!;
      // s = "Updating position, size of compound node " + n.id;
      // s += "\nPositionX: " + n.positionX + ", PositionY: " + n.positionY;
      // s += "\nWidth: " + n.width + ", Height: " + n.height;
      // logDebug(s);
    }
  }
};

/**
 * @brief : Limits a force (forceX, forceY) to be not
 *          greater (in modulo) than max.
 8          Preserves force direction.
  */
let limitForce = function( forceX: number, forceY: number, max: number ): Position {
  // var s = "Limiting force: (" + forceX + ", " + forceY + "). Max: " + max;
  let force = Math.sqrt( forceX * forceX + forceY * forceY );

  // res assigned per branch and returned below; declare once
  let res: Position;

  if( force > max ){
    res = {
      x: max * forceX / force,
      y: max * forceY / force
    };

  } else {
    res = {
      x: forceX,
      y: forceY
    };
  }

  // s += ".\nResult: (" + res.x + ", " + res.y + ")";
  // logDebug(s);

  return res;
};

/**
 * @brief : Function used for keeping track of compound node
 *          sizes, since they should bound all their subnodes.
 */
let updateAncestryBoundaries = function( node: CoseNode, layoutInfo: LayoutInfo ){
  // var s = "Propagating new position/size of node " + node.id;
  let parentId = node.parentId;
  if( null == parentId ){
    // If there's no parent, we are done
    // s += ". No parent node.";
    // logDebug(s);
    return;
  }

  // Get Parent Node
  let p = layoutInfo.layoutNodes[ layoutInfo.idToIndex[ parentId ] ];
  let flag = false;

  // MaxX
  if( null == p.maxX || node.maxX! + p.padRight > p.maxX ){
    p.maxX = node.maxX! + p.padRight;
    flag = true;
    // s += "\nNew maxX for parent node " + p.id + ": " + p.maxX;
  }

  // MinX
  if( null == p.minX || node.minX! - p.padLeft < p.minX ){
    p.minX = node.minX! - p.padLeft;
    flag = true;
    // s += "\nNew minX for parent node " + p.id + ": " + p.minX;
  }

  // MaxY
  if( null == p.maxY || node.maxY! + p.padBottom > p.maxY ){
    p.maxY = node.maxY! + p.padBottom;
    flag = true;
    // s += "\nNew maxY for parent node " + p.id + ": " + p.maxY;
  }

  // MinY
  if( null == p.minY || node.minY! - p.padTop < p.minY ){
    p.minY = node.minY! - p.padTop;
    flag = true;
    // s += "\nNew minY for parent node " + p.id + ": " + p.minY;
  }

  // If updated boundaries, propagate changes upward
  if( flag ){
    // logDebug(s);
    return updateAncestryBoundaries( p, layoutInfo );
  }

  // s += ". No changes in boundaries/position of parent node " + p.id;
  // logDebug(s);
  return;
};

let separateComponents = function( layoutInfo: LayoutInfo, options: CoseLayoutOptions ){
  let nodes = layoutInfo.layoutNodes;
  let components: CoseComponent[] = [];

  let i: number, j: number, c: CoseComponent, n: CoseNode;

  for( i = 0; i < nodes.length; i++ ){
    let node = nodes[ i ];
    let cid = node.cmptId;
    let component = components[ cid ] = components[ cid ] || ( [] as unknown as CoseComponent );

    component.push( node );
  }

  let totalA = 0;

  for( i = 0; i < components.length; i++ ){
    c = components[ i ];

    if( !c ){ continue; }

    c.x1 = Infinity;
    c.x2 = -Infinity;
    c.y1 = Infinity;
    c.y2 = -Infinity;

    for( j = 0; j < c.length; j++ ){
      n = c[ j ];

      c.x1 = Math.min( c.x1, n.positionX - n.width / 2 );
      c.x2 = Math.max( c.x2, n.positionX + n.width / 2 );
      c.y1 = Math.min( c.y1, n.positionY - n.height / 2 );
      c.y2 = Math.max( c.y2, n.positionY + n.height / 2 );
    }

    c.w = c.x2 - c.x1;
    c.h = c.y2 - c.y1;

    totalA += c.w * c.h;
  }

  components.sort( function( c1: CoseComponent, c2: CoseComponent ){
    return c2.w * c2.h - c1.w * c1.h;
  } );

  let x = 0;
  let y = 0;
  let usedW = 0;
  let rowH = 0;
  let maxRowW = Math.sqrt( totalA ) * layoutInfo.clientWidth / layoutInfo.clientHeight;

  for( i = 0; i < components.length; i++ ){
    c = components[ i ];

    if( !c ){ continue; }

    for( j = 0; j < c.length; j++ ){
      n = c[ j ];

      if( !n.isLocked ){
        n.positionX += (x - c.x1);
        n.positionY += (y - c.y1);
      }
    }

    x += c.w + options.componentSpacing!;
    usedW += c.w + options.componentSpacing!;
    rowH = Math.max( rowH, c.h );

    if( usedW > maxRowW ){
      y += rowH + options.componentSpacing!;
      x = 0;
      usedW = 0;
      rowH = 0;
    }
  }
};

export default CoseLayout as unknown as {
  new( options: CoseLayoutOptions ): CoseLayout;
  prototype: CoseLayout;
};
