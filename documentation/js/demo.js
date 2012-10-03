$(function(){

	var nodeCount = 10;
	var edgeCount = 12;
	
	var demoNodes = [];
	var demoEdges = [];
	
	for (var i = 0; i < nodeCount; i++) {
		demoNodes.push({
			data: {
				id: "n" + i,
				weight: Math.round( Math.random() * 100 )
			}
		});
	}
	
	for (var i = 0; i < nodeCount; i++) {
		demoEdges.push({
			data: {
				id: "e" + (i * 2),
				source: "n" + ((i + 1) >= nodeCount ? i + 1 - nodeCount : i + 1),
				target: "n" + i,
				weight: 30
			}
		});
		
		if (i % 2 == 0) {
			demoEdges.push({
				data: {
					id: "e" + (i * 2 + 1),
					source: "n" + i,
					target: "n" + ((i + 3) >= nodeCount ? i + 3 - nodeCount : i + 3),
					weight: 20
				}
			});
		}
	}
	
  $('#demo').cytoscape({
    elements: { // TODO specify some elements like http://cytoscapeweb.cytoscape.org/demos/simple
      nodes: demoNodes,
      edges: demoEdges
    },

	// TODO specify a nice style like http://cytoscapeweb.cytoscape.org/demos/simple
    style: cytoscape.stylesheet()
      .selector("node")
		.css({
			"content": "data(id)",
			"text-halign": "center",
//			"text-outline-width": 0.2,
//			"text-outline-color": "#00A"
			"border-width": 2,
			"background-color": "#AAA",
			"cursor": "pointer",
		})
	.selector("edge")
		.css({
			//"content": "data(id)",
			"line-color": "#777",
			"visibiliy": "invisible",
			"source-arrow-shape": "circle",
			"source-arrow-color": "#000",
			"target-arrow-shape": "triangle",
			"target-arrow-color": "#000",
			"cursor": "pointer",
			"width": "mapData(weight, 0, 100, 1, 3)",
		})
	.selector(":selected")
		.css({
			"background-color": "#777",
			"line-color": "#000",
			"source-arrow-color": "#000",
			"target-arrow-color": "#000"
		})
    ,

    ready: function(){
      window.cy = this; // for debugging
      
      	var nodeCount = cy.nodes().length;
      	for (var i = 0; i < nodeCount; i++) {
      		
      		var center = [cy.container().clientWidth / 2, cy.container().clientHeight / 2];
      		
      		var angle = i / nodeCount * Math.PI * 2;
//      	console.log(angle);
      		var radius = 
      			Math.min(cy.container().clientWidth, cy.container().clientHeight) / 2 * 0.6;
//      	console.log(radius);
      		
      		var nodePos = [Math.cos(angle) * radius + center[0], Math.sin(angle) * radius + center[1]]
//  		console.log(nodePos);
      		cy.nodes()[i].position({x: nodePos[0], y : nodePos[1]});
    	}
    }
    
    
		
  });
  
  
  
});