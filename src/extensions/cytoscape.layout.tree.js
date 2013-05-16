;(function($$){
    
    var defaults = {
        fit: true, // whether to fit the viewport to the graph
        ready: undefined, // callback on layoutready
        stop: undefined, // callback on layoutstop
        directed: true, // whether the tree is directed downwards (or edges can point in any direction if false)
        padding: 30 // padding on fit
    };
    
    function TreeLayout( options ){
        this.options = $$.util.extend({}, defaults, options);
    }
    
    TreeLayout.prototype.run = function(){
        var params = this.options;
        var options = params;
        
        var cy = params.cy;
        var nodes = cy.nodes();
        var edges = cy.edges();
        var container = cy.container();
        
        var width = container.clientWidth;
        var height = container.clientHeight;

        var roots = nodes.roots();
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
                depths[0].push( node );
            }
        }

        // assign the nodes a depth and index
        for( var i = 0; i < depths.length; i++ ){
            var eles = depths[i];

            for( var j = 0; j < eles.length; j++ ){
                var ele = eles[j];

                ele._private.scratch.treeLayout = {
                    depth: i,
                    index: j
                };
            }
        }

        // find min distance we need to leave between nodes
        var minDistance = 0;
        for( var i = 0; i < nodes.length; i++ ){
            var w = nodes[i].outerWidth();
            var h = nodes[i].outerHeight();
            
            minDistance = Math.max(minDistance, w, h);
        }

        nodes.positions(function(){
            var ele = this[0];
            var info = ele._private.scratch.treeLayout;
            var depth = info.depth;
            var index = info.index;
            var distanceX = width / (depths[depth].length + 1);
            var distanceY = height / (depths.length + 1);

            return {
                x: (index + 1) * distanceX,
                y: (depth + 1) * distanceY
            };
        });
        
        if( params.fit ){
            cy.fit( options.padding );
        } 
        
        cy.one("layoutready", params.ready);
        cy.trigger("layoutready");
        
        cy.one("layoutstop", params.stop);
        cy.trigger("layoutstop");
    };

    TreeLayout.prototype.stop = function(){
        // not a continuous layout
    };
    
    $$("layout", "tree", TreeLayout);
    
})( cytoscape );
