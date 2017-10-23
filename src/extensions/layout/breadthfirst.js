let util = require( '../../util' );
let math = require( '../../math' );
let is = require( '../../is' );

let defaults = {
  fit: true, // whether to fit the viewport to the graph
  directed: false, // whether the tree is directed downwards (or edges can point in any direction if false)
  padding: 30, // padding on fit
  circle: false, // put depths in concentric circles if true, put depths top down if false
  spacingFactor: 1.75, // positive spacing factor, larger => more space between nodes (N.B. n/a if causes overlap)
  boundingBox: undefined, // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
  avoidOverlap: true, // prevents node overlap, may overflow boundingBox if not enough space
  nodeDimensionsIncludeLabels: false, // Excludes the label when calculating node bounding boxes for the layout algorithm
  roots: undefined, // the roots of the trees
  maximalAdjustments: 0, // how many times to try to position the nodes in a maximal way (i.e. no backtracking)
  animate: false, // whether to transition the node positions
  animationDuration: 500, // duration of animation in ms if enabled
  animationEasing: undefined, // easing of animation if enabled,
  animateFilter: function ( node, i ){ return true; }, // a function that determines whether the node should be animated.  All nodes animated by default on animate enabled.  Non-animated nodes are positioned immediately when the layout starts
  ready: undefined, // callback on layoutready
  stop: undefined, // callback on layoutstop
  transform: function (node, position ){ return position; } // transform a given node position. Useful for changing flow direction in discrete layouts
};

function BreadthFirstLayout( options ){
  this.options = util.extend( {}, defaults, options );
}

BreadthFirstLayout.prototype.run = function(){
  let params = this.options;
  let options = params;

  let cy = params.cy;
  let eles = options.eles;
  let nodes = eles.nodes().not( ':parent' );
  let graph = eles;

  let bb = math.makeBoundingBox( options.boundingBox ? options.boundingBox : {
    x1: 0, y1: 0, w: cy.width(), h: cy.height()
  } );

  let roots;
  if( is.elementOrCollection( options.roots ) ){
    roots = options.roots;
  } else if( is.array( options.roots ) ){
    let rootsArray = [];

    for( let i = 0; i < options.roots.length; i++ ){
      let id = options.roots[ i ];
      let ele = cy.getElementById( id );
      rootsArray.push( ele );
    }

    roots = cy.collection( rootsArray );
  } else if( is.string( options.roots ) ){
    roots = cy.$( options.roots );

  } else {
    if( options.directed ){
      roots = nodes.roots();
    } else {
      let components = [];
      let unhandledNodes = nodes;

      while( unhandledNodes.length > 0 ){
        let currComp = cy.collection();

        eles.bfs( {
          roots: unhandledNodes[0],
          visit: function( node, edge, pNode, i, depth ){
            currComp = currComp.add( node );
          },
          directed: false
        } );

        unhandledNodes = unhandledNodes.not( currComp );
        components.push( currComp );
      }

      roots = cy.collection();
      for( let i = 0; i < components.length; i++ ){
        let comp = components[ i ];
        let maxDegree = comp.maxDegree( false );
        let compRoots = comp.filter( function( ele ){
          return ele.degree( false ) === maxDegree;
        } );

        roots = roots.add( compRoots );
      }

    }
  }


  let depths = [];
  let foundByBfs = {};
  let id2depth = {};
  let prevNode = {};
  let prevEdge = {};
  let successors = {};

  // find the depths of the nodes
  graph.bfs( {
    roots: roots,
    directed: options.directed,
    visit: function( node, edge, pNode, i, depth ){
      let ele = node[0];
      let id = ele.id();

      if( !depths[ depth ] ){
        depths[ depth ] = [];
      }

      depths[ depth ].push( ele );
      foundByBfs[ id ] = true;
      id2depth[ id ] = depth;
      prevNode[ id ] = pNode;
      prevEdge[ id ] = edge;

      if( pNode ){
        let prevId = pNode.id();
        let succ = successors[ prevId ] = successors[ prevId ] || [];

        succ.push( node );
      }
    }
  } );

  // check for nodes not found by bfs
  let orphanNodes = [];
  for( let i = 0; i < nodes.length; i++ ){
    let ele = nodes[ i ];

    if( foundByBfs[ ele.id() ] ){
      continue;
    } else {
      orphanNodes.push( ele );
    }
  }

  // assign orphan nodes a depth from their neighborhood
  let maxChecks = orphanNodes.length * 3;
  let checks = 0;
  while( orphanNodes.length !== 0 && checks < maxChecks ){
    let node = orphanNodes.shift();
    let neighbors = node.neighborhood().nodes();
    let assignedDepth = false;

    for( let i = 0; i < neighbors.length; i++ ){
      let depth = id2depth[ neighbors[ i ].id() ];

      if( depth !== undefined ){
        depths[ depth ].push( node );
        assignedDepth = true;
        break;
      }
    }

    if( !assignedDepth ){
      orphanNodes.push( node );
    }

    checks++;
  }

  // assign orphan nodes that are still left to the depth of their subgraph
  while( orphanNodes.length !== 0 ){
    let node = orphanNodes.shift();
    //let subgraph = graph.bfs( node ).path;
    let assignedDepth = false;

    // for( let i = 0; i < subgraph.length; i++ ){
    //   let depth = id2depth[ subgraph[i].id() ];

    //   if( depth !== undefined ){
    //     depths[depth].push( node );
    //     assignedDepth = true;
    //     break;
    //   }
    // }

    if( !assignedDepth ){ // worst case if the graph really isn't tree friendly, then just dump it in 0
      if( depths.length === 0 ){
        depths.push( [] );
      }

      depths[0].push( node );
    }
  }

  // assign the nodes a depth and index
  let assignDepthsToEles = function(){
    for( let i = 0; i < depths.length; i++ ){
      let eles = depths[ i ];

      for( let j = 0; j < eles.length; j++ ){
        let ele = eles[ j ];

        if( ele == null ){
          eles.splice( j, 1 );
          j--;
          continue;
        }

        ele._private.scratch.breadthfirst = {
          depth: i,
          index: j
        };
      }
    }
  };
  assignDepthsToEles();


  let intersectsDepth = function( node ){ // returns true if has edges pointing in from a higher depth
    let edges = node.connectedEdges( function( ele ){
      return ele.data( 'target' ) === node.id();
    } );
    let thisInfo = node._private.scratch.breadthfirst;
    let highestDepthOfOther = 0;
    let highestOther;
    for( let i = 0; i < edges.length; i++ ){
      let edge = edges[ i ];
      let otherNode = edge.source()[0];
      let otherInfo = otherNode._private.scratch.breadthfirst;

      if( thisInfo.depth <= otherInfo.depth && highestDepthOfOther < otherInfo.depth ){
        highestDepthOfOther = otherInfo.depth;
        highestOther = otherNode;
      }
    }

    return highestOther;
  };

  // make maximal if so set by adjusting depths
  for( let adj = 0; adj < options.maximalAdjustments; adj++ ){

    let nDepths = depths.length;
    let elesToMove = [];
    for( let i = 0; i < nDepths; i++ ){
      let depth = depths[ i ];

      let nDepth = depth.length;
      for( let j = 0; j < nDepth; j++ ){
        let ele = depth[ j ];
        let info = ele._private.scratch.breadthfirst;
        let intEle = intersectsDepth( ele );

        if( intEle ){
          info.intEle = intEle;
          elesToMove.push( ele );
        }
      }
    }

    for( let i = 0; i < elesToMove.length; i++ ){
      let ele = elesToMove[ i ];
      let info = ele._private.scratch.breadthfirst;
      let intEle = info.intEle;
      let intInfo = intEle._private.scratch.breadthfirst;

      depths[ info.depth ][ info.index ] = null; // remove from old depth & index (create hole to be cleaned)

      // add to end of new depth
      let newDepth = intInfo.depth + 1;
      while( newDepth > depths.length - 1 ){
        depths.push( [] );
      }
      depths[ newDepth ].push( ele );

      info.depth = newDepth;
      info.index = depths[ newDepth ].length - 1;
    }

    assignDepthsToEles();
  }

  // find min distance we need to leave between nodes
  let minDistance = 0;
  if( options.avoidOverlap ){
    for( let i = 0; i < nodes.length; i++ ){
      let n = nodes[ i ];
      let nbb = n.layoutDimensions( options );
      let w = nbb.w;
      let h = nbb.h;

      minDistance = Math.max( minDistance, w, h );
    }
  }

  // get the weighted percent for an element based on its connectivity to other levels
  let cachedWeightedPercent = {};
  let getWeightedPercent = function( ele ){
    if( cachedWeightedPercent[ ele.id() ] ){
      return cachedWeightedPercent[ ele.id() ];
    }

    let eleDepth = ele._private.scratch.breadthfirst.depth;
    let neighbors = ele.neighborhood().nodes().not( ':parent' ).intersection(nodes);
    let percent = 0;
    let samples = 0;

    for( let i = 0; i < neighbors.length; i++ ){
      let neighbor = neighbors[ i ];
      let bf = neighbor._private.scratch.breadthfirst;
      let index = bf.index;
      let depth = bf.depth;
      let nDepth = depths[ depth ].length;

      if( eleDepth > depth || eleDepth === 0 ){ // only get influenced by elements above
        percent += index / nDepth;
        samples++;
      }
    }

    samples = Math.max( 1, samples );
    percent = percent / samples;

    if( samples === 0 ){ // so lone nodes have a "don't care" state in sorting
      percent = undefined;
    }

    cachedWeightedPercent[ ele.id() ] = percent;
    return percent;
  };


  // rearrange the indices in each depth level based on connectivity

  let sortFn = function( a, b ){
    let apct = getWeightedPercent( a );
    let bpct = getWeightedPercent( b );

    return apct - bpct;
  };

  for( let times = 0; times < 3; times++ ){ // do it a few times b/c the depths are dynamic and we want a more stable result

    for( let i = 0; i < depths.length; i++ ){
      depths[ i ] = depths[ i ].sort( sortFn );
    }
    assignDepthsToEles(); // and update

  }

  let biggestDepthSize = 0;
  for( let i = 0; i < depths.length; i++ ){
    biggestDepthSize = Math.max( depths[ i ].length, biggestDepthSize );
  }

  let center = {
    x: bb.x1 + bb.w / 2,
    y: bb.x1 + bb.h / 2
  };

  let getPosition = function( ele, isBottomDepth ){
    let info = ele._private.scratch.breadthfirst;
    let depth = info.depth;
    let index = info.index;
    let depthSize = depths[ depth ].length;

    let distanceX = Math.max( bb.w / (depthSize + 1), minDistance );
    let distanceY = Math.max( bb.h / (depths.length + 1), minDistance );
    let radiusStepSize = Math.min( bb.w / 2 / depths.length, bb.h / 2 / depths.length );
    radiusStepSize = Math.max( radiusStepSize, minDistance );

    if( !options.circle ){

      let epos = {
        x: center.x + (index + 1 - (depthSize + 1) / 2) * distanceX,
        y: (depth + 1) * distanceY
      };

      if( isBottomDepth ){
        return epos;
      }

      // let succs = successors[ ele.id() ];
      // if( succs ){
      //   epos.x = 0;
      //
      //   for( let i = 0 ; i < succs.length; i++ ){
      //     let spos = pos[ succs[i].id() ];
      //
      //     epos.x += spos.x;
      //   }
      //
      //   epos.x /= succs.length;
      // } else {
      //   //debugger;
      // }

      return epos;

    } else {
      if( options.circle ){
        let radius = radiusStepSize * depth + radiusStepSize - (depths.length > 0 && depths[0].length <= 3 ? radiusStepSize / 2 : 0);
        let theta = 2 * Math.PI / depths[ depth ].length * index;

        if( depth === 0 && depths[0].length === 1 ){
          radius = 1;
        }

        return {
          x: center.x + radius * Math.cos( theta ),
          y: center.y + radius * Math.sin( theta )
        };

      } else {
        return {
          x: center.x + (index + 1 - (depthSize + 1) / 2) * distanceX,
          y: (depth + 1) * distanceY
        };
      }
    }

  };

  // get positions in reverse depth order
  let pos = {};
  for( let i = depths.length - 1; i >= 0; i-- ){
    let depth = depths[ i ];

    for( let j = 0; j < depth.length; j++ ){
      let node = depth[ j ];

      pos[ node.id() ] = getPosition( node, i === depths.length - 1 );
    }
  }

  nodes.layoutPositions( this, options, function( node ){
    return pos[ node.id() ];
  } );

  return this; // chaining
};

module.exports = BreadthFirstLayout;
