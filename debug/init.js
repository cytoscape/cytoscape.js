$(function(){
				
	var height, width;
	
	window.options = {
		renderer: {
			name: "svg",
			dragToSelect: true,
			dragToPan: true
		},
		layout: {
			name: "grid"
		},
		style: $.cytoscape.stylesheet()
			.selector("node")
				.css({
					"content": "data(id)"
				})
			.selector(":selected")
				.css({
					"background-color": "#000",
					"line-color": "#000",
					"source-arrow-color": "#000",
					"target-arrow-color": "#000"
				})
			.selector(".ui-cytoscape-edgehandles-source")
				.css({
					"border-color": "#5CC2ED",
					"border-width": 3
				})
			.selector(".ui-cytoscape-edgehandles-preview, .ui-cytoscape-edgehandles-target")
				.css({
					"background-color": "#5CC2ED",
					"line-color": "#5CC2ED"
				})
		,
		elements: {
			nodes: [
			], 
			
			edges: [
			]
		},
		ready: function(cy){
			window.cy = cy;
			window.$$ = $.cytoscape;
		}
	};
	
	var cliques = 2;
	var numNodes = 16;
	var numEdges = 32;
	
	function randNodeId( clique ){
		var min = numNodes * clique / cliques;
		var max = numNodes * (clique + 1) / cliques - (cliques == 1 ? 0 : 1);
		var rand = Math.floor( Math.random() * (max - min) + min );
		var id = "n" + rand;

		return id;
	}
	
	for(var i = 0; i < numNodes; i++){
		options.elements.nodes.push({
			data: {
				id: "n" + i,
				weight: Math.round( Math.random() * 100 )
			}
		});
	}
	
	var j = 0;
	for(var clique = 0; clique < cliques; clique++){
		for(var i = 0; i < numEdges/cliques; i++){
			var srcId = randNodeId( clique );
			var tgtId = randNodeId( clique );

			options.elements.edges.push({
				data: {
					id: "e" + (j++),
					source: srcId,
					target: tgtId,
					weight: Math.round( Math.random() * 100 )
				}
			});
		}
	}
	
	var $container = $("#cytoscape");
	
	$container.cy(options).cy(function(){
		
		height = $container.height();
		width = $container.width();
		
		$container.cytoscapePanzoom();
		
		$container.cytoscapeEdgehandles({
			lineType: "straight",
			preview: true,
			handleSize: 12,
			handleColor: "#5CC2ED",
			edgeType: function(){
				return $("#add-edge-type-select").val();
			},
			nodeParams: function(){
				return {
					classes: "intermediate"
				};
			},
			start: function( sourceNode ){
//				console.log("start(%o)", sourceNode);
			},
			complete: function( sourceNode, targetNodes, added ){
//				console.log("complete(%o, %o, %o)", sourceNode, targetNodes, added);
			},
			stop: function( sourceNode ){
//				console.log("stop(%o)", sourceNode);
			}
		});
		
		function number(group){
			var input = $("#" + group + "-number");
			var val = parseInt( input.val() );
			
			if( isNaN(val) ){
				return 0;
			}
			
			return val;
		}
		
		function time(callback){
			var start = new Date();
			callback();
			var end = new Date();
			
			$("#add-remove-time").html( (end - start) + " ms" );
		}
		
		$("#add-elements-button").click(function(){
			var n = number("nodes");
			var e = number("edges");
			
			var nodes = [];
			for(var i = 0; i < n; i++){
				nodes.push({
					group: "nodes",
					data: { id: "n" + (i + numNodes), weight: Math.round( Math.random() * 100 ) },
					position: { x: Math.random() * width, y: Math.random() * height }
				});
			}
			numNodes += n;
			
			cy.add(nodes);
			
			var nodesCollection = cy.nodes();
			function nodeId(){
				var index = Math.round((nodesCollection.size() - 1) * Math.random());
				return nodesCollection.eq(index).data("id");
			}
			
			var edges = [];
			for(var i = 0; i < e; i++){
				edges.push({
					group: "edges",
					data: {
						id: "e" + (i + numEdges), 
						weight: Math.round( Math.random() * 100 ),
						source: nodeId(),
						target: nodeId()
					}
				});
			}
			numEdges += e;
			
			time(function(){
				cy.add(edges);
			});
		});
		
		$("#remove-elements-button").click(function(){
			var n = number("nodes");
			var e = number("edges");
			
			time(function(){
				cy.nodes().slice(0, n).remove();
				cy.edges().slice(0, e).remove();
			});
			

		});
		
		$("#remove-selected-button").click(function(){
			cy.elements(":selected").remove();
		});
	});
	
	
});