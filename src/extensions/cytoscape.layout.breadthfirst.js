;(function($$){
    
    var defaults = {
        fit: true, // whether to fit the viewport to the graph
        ready: undefined, // callback on layoutready
        stop: undefined, // callback on layoutstop
        directed: true, // whether the tree is directed downwards (or edges can point in any direction if false)
        padding: 30, // padding on fit
        circle: false, // put depths in concentric circles if true, put depths top down if false
        roots: undefined // the roots of the trees
    };
    
    function BreadthFirstLayout( options ){
        this.options = $$.util.extend({}, defaults, options);
    }
    
    BreadthFirstLayout.prototype.run = function(){
        var params = this.options;
        var options = params;
        
        var cy = params.cy;
        var nodes = cy.nodes();
        var edges = cy.edges();
        var container = cy.container();
        
        var width = container.clientWidth;
        var height = container.clientHeight;

        var roots;
        if( $$.is.elementOrCollection(options.roots) ){
            roots = options.roots;
        } else if( $$.is.array(options.roots) ){
            var rootsArray = [];

            for( var i = 0; i < options.roots.length; i++ ){
                var id = options.roots[i];
                var ele = cy.getElementById( id );
                roots.push( ele );
            }

            roots = new $$.Collection( cy, rootsArray );
        } else {
            roots = nodes.roots();
        }


        var depths = [];
        var foundByBfs = {};
        var id2depth = {};

        // find the depths of the nodes
        roots.bfs(function(i, depth){
            var ele = this[0];

            if( !depths[depth] ){
                depths[depth] = [];
            }

            depths[depth].push( ele );
            foundByBfs[ ele.id() ] = true;
            id2depth[ ele.id() ] = depth;
        }, options.directed);

        // check for nodes not found by bfs
        var orphanNodes = [];
        for( var i = 0; i < nodes.length; i++ ){
            var ele = nodes[i];

            if( foundByBfs[ ele.id() ] ){
                continue;
            } else {
                orphanNodes.push( ele );
            }
        }

        // assign orphan nodes a depth from their neighborhood
        var maxChecks = orphanNodes.length * 3;
        var checks = 0;
        while( orphanNodes.length !== 0 && checks < maxChecks ){
            var node = orphanNodes.shift();
            var neighbors = node.neighborhood().nodes();
            var assignedDepth = false;

            for( var i = 0; i < neighbors.length; i++ ){
                var depth = id2depth[ neighbors[i].id() ];

                if( depth !== undefined ){
                    depths[depth].push( node );
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
            var node = orphanNodes.shift();
            var subgraph = node.bfs();
            var assignedDepth = false;

            for( var i = 0; i < subgraph.length; i++ ){
                var depth = id2depth[ subgraph[i].id() ];

                if( depth !== undefined ){
                    depths[depth].push( node );
                    assignedDepth = true;
                    break;
                }
            }

            if( !assignedDepth ){ // worst case if the graph really isn't tree friendly, then just dump it in 0
                if( depths.length === 0 ){
                    depths.push([]);
                }
                
                depths[0].push( node );
            }
        }

        // assign the nodes a depth and index
        function assignDepthsToEles(){
            for( var i = 0; i < depths.length; i++ ){
                var eles = depths[i];

                for( var j = 0; j < eles.length; j++ ){
                    var ele = eles[j];

                    ele._private.scratch.BreadthFirstLayout = {
                        depth: i,
                        index: j
                    };
                }
            }
        }
        assignDepthsToEles();

        // find min distance we need to leave between nodes
        var minDistance = 0;
        for( var i = 0; i < nodes.length; i++ ){
            var w = nodes[i].outerWidth();
            var h = nodes[i].outerHeight();
            
            minDistance = Math.max(minDistance, w, h);
        }
        minDistance *= 1.75; // just to have some nice spacing

        // get the weighted percent for an element based on its connectivity to other levels
        var cachedWeightedPercent = {};
        function getWeightedPercent( ele ){
            if( cachedWeightedPercent[ ele.id() ] ){
                return cachedWeightedPercent[ ele.id() ];
            }

            var eleDepth = ele._private.scratch.BreadthFirstLayout.depth;
            var neighbors = ele.neighborhood().nodes();
            var percent = 0;
            var samples = 0;

            for( var i = 0; i < neighbors.length; i++ ){
                var neighbor = neighbors[i];
                var nEdges = neighbor.edgesWith( ele );
                var index = neighbor._private.scratch.BreadthFirstLayout.index;
                var depth = neighbor._private.scratch.BreadthFirstLayout.depth;
                var nDepth = depths[depth].length;

                if( eleDepth > depth || eleDepth === 0 ){ // only get influenced by elements above
                    percent += index / nDepth;
                    samples++;
                }
            }

            samples = Math.max(1, samples);
            percent = percent / samples;

            if( samples === 0 ){ // so lone nodes have a "don't care" state in sorting
                percent = undefined;
            }

            cachedWeightedPercent[ ele.id() ] = percent;
            return percent;
        }

        // rearrange the indices in each depth level based on connectivity
        for( var times = 0; times < 3; times++ ){ // do it a few times b/c the depths are dynamic and we want a more stable result

            for( var i = 0; i < depths.length; i++ ){
                var depth = i;
                var newDepths = [];

                depths[i] = depths[i].sort(function(a, b){
                    var apct = getWeightedPercent( a );
                    var bpct = getWeightedPercent( b );


                    return apct - bpct;
                });
            }
            assignDepthsToEles(); // and update

        }

        var center = {
            x: width/2,
            y: height/2
        };
        nodes.positions(function(){
            var ele = this[0];
            var info = ele._private.scratch.BreadthFirstLayout;
            var depth = info.depth;
            var index = info.index;

            var distanceX = Math.max( width / (depths[depth].length + 1), minDistance );
            var distanceY = Math.max( height / (depths.length + 1), minDistance );
            var radiusStepSize = Math.min( width / 2 / depths.length, height / 2 / depths.length );
            radiusStepSize = Math.max( radiusStepSize, minDistance );

            if( options.circle ){
                var radius = radiusStepSize * depth + radiusStepSize - (depths.length > 0 && depths[0].length <= 3 ? radiusStepSize/2 : 0);
                var theta = 2 * Math.PI / depths[depth].length * index;

                if( depth === 0 && depths[0].length === 1 ){
                    radius = 1;
                }

                return {
                    x: center.x + radius * Math.cos(theta),
                    y: center.y + radius * Math.sin(theta)
                };

            } else {
                return {
                    x: (index + 1) * distanceX,
                    y: (depth + 1) * distanceY
                };
            }
            
        });
        
        if( params.fit ){
            cy.fit( options.padding );
        } 
        
        cy.one("layoutready", params.ready);
        cy.trigger("layoutready");
        
        cy.one("layoutstop", params.stop);
        cy.trigger("layoutstop");
    };

    BreadthFirstLayout.prototype.stop = function(){
        // not a continuous layout
    };
    
    $$("layout", "breadthfirst", BreadthFirstLayout);
    
})( cytoscape );
