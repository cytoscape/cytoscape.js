;(function($$){
    
    var defaults = {
        fit: true, // whether to fit the viewport to the graph
        ready: undefined, // callback on layoutready
        stop: undefined, // callback on layoutstop
        rStepSize: 10, // the step size for increasing the radius if the nodes don't fit on screen
        padding: 30, // the padding on fit
        startAngle: 3/2 * Math.PI, // the position of the first node
        counterclockwise: false // whether the layout should go counterclockwise (true) or clockwise (false)
    };
    
    function CircleLayout( options ){
        this.options = $$.util.extend({}, defaults, options);
    }
    
    CircleLayout.prototype.run = function(){
        var params = this.options;
        var options = params;
        
        var cy = params.cy;
        var nodes = cy.nodes();
        var edges = cy.edges();
        var container = cy.container();
        
        var width = container.clientWidth;
        var height = container.clientHeight;

        var center = {
            x: width/2,
            y: height/2
        };

        var padding = 50;
        
        var theta = options.startAngle;
        var dTheta = 2 * Math.PI / nodes.length;
        var maxNodeSize = 0;

        for( var i = 0; i < nodes.length; i++ ){
            var node = nodes[i];

            maxNodeSize = Math.max( node.outerWidth(), node.outerHeight() );
        }

        var r = width/2 - maxNodeSize;

        function distanceBetweenNodes(){
            var t1 = 0;
            var t2 = dTheta;

            var p1 = {
                x: center.x + r * Math.cos(t1),
                y: center.y + r * Math.sin(t1)
            };

            var p2 = {
                x: center.x + r * Math.cos(t2),
                y: center.y + r * Math.sin(t2)
            }; 

            var dist = Math.sqrt( (p2.x - p1.x)*(p2.x - p1.x) + (p2.y - p1.y)*(p2.y - p1.y) );

            return dist;
        }

        while( distanceBetweenNodes() < maxNodeSize ){
            r += options.rStepSize;
        }


        var i = 0;
        nodes.positions(function(){
            var node = this;
            var rx = r * Math.cos( theta );
            var ry = r * Math.sin( theta );
            var pos = {
                x: center.x + rx,
                y: center.y + ry
            };

            i++;
            theta = options.counterclockwise ? theta - dTheta : theta + dTheta;
            return pos;
        });
        
        if( params.fit ){
            cy.fit( options.padding );
        } 
        
        cy.one("layoutready", params.ready);
        cy.trigger("layoutready");
        
        cy.one("layoutstop", params.stop);
        cy.trigger("layoutstop");
    };

    CircleLayout.prototype.stop = function(){
        // not a continuous layout
    };
    
    $$("layout", "circle", CircleLayout);
    
})( cytoscape );
