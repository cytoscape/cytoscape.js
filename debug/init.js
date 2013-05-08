$(function(){
				
	var height, width;
	
	var defaultSty = window.defaultSty = cytoscape.stylesheet()
			.selector("node")
				.css({
					"content": "data(id)",
					"border-width": 3,
					"background-color": "#DDD",
					"border-color": "#555"
				})
			.selector("$node > node") // compound (parent) nodes
				.css({"textValign": "bottom",
					"font-weight": "bold",
					"font-style": "italic",
					"background-color": "#B7E1ED",
					"padding-left": 10,
					"padding-right": 20,
					"padding-top": 5,
					"padding-bottom": 30
				})
			.selector("edge")
				.css({
					"width": "mapData(weight, 0, 100, 1, 4)",
					"target-arrow-shape": "triangle",
					"source-arrow-shape": "circle"
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
			.selector(".ui-cytoscape-edgehandles-target, node.ui-cytoscape-edgehandles-preview")
				.css({
					"background-color": "#5CC2ED"
				})
			.selector("edge.ui-cytoscape-edgehandles-preview")
				.css({
					"line-color": "#5CC2ED",
					"source-arrow-color": "#5CC2ED",
					"target-arrow-color": "#5CC2ED"
				})
			.selector("node.ui-cytoscape-edgehandles-preview, node.intermediate")
				.css({
					"shape": "rectangle",
					"width": 15,
					"height": 15
				});
	
	window.options = {
		renderer: {
			name: "canvas"
		},
		layout: {
			name: "grid"
		},
		style: defaultSty,
		
		elements: {
			nodes: [
			], 
			
			edges: [
			]
		},
		ready: function(){
			console.log('cy ready');

			window.cy = this;
			window.$$ = cytoscape;
		}
	};
	
	var cliques = 2;
	var numNodes = 32;
	var numEdges = 64;
	
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
	var $container2 = $("#cytoscape2");
	
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
				console.log("start(%o)", sourceNode);
			},
			complete: function( sourceNode, targetNodes, added ){
				console.log("complete(%o, %o, %o)", sourceNode, targetNodes, added);
			},
			stop: function( sourceNode ){
				console.log("stop(%o)", sourceNode);
			}
		});

		$container.cxtmenu({
			selector: 'node',
			commands: [
				{
					content: 'Connect',
					select: function(){
						$('#cytoscape').cytoscapeEdgehandles('start', this.id());
					}
				},

				{
					content: 'Delete',
					select: function(){
						this.remove();
					}
				}

			]
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


//		$container2.cy(options);


		// compound graph in the second instance
		$container2.cy({
				elements: {
				   nodes: [{ data: { id: 'n8', parent: 'n4' } },
					   { data: { id: 'n9', parent: 'n4' } },
					   { data: { id: 'n4', parent: 'n1' } },
					   { data: { id: 'n5', parent: 'n1', shape: 'triangle' } },
					   { data: { id: 'n1' } },
				       { data: { id: 'n2' } },
				       { data: { id: 'node6', parent: 'n2' } },
				       { data: { id: 'n7', parent: 'n2', shape: 'square' } },
					   { data: { id: 'n3', parent: 'non-auto', shape: 'rectangle' } },
					   { data: { id: 'non-auto'}}],
				   edges: [ { data: { id: 'e1', source: 'n1', target: 'n3' } },
				       { data: { id: 'e2', source: 'n3', target: 'n7' } },
				       { data: { id: 'e3', source: 'node6', target: 'n7' } },
				       { data: { id: 'e4', source: 'node6', target: 'n9' } },
				       { data: { id: 'e5', source: 'n8', target: 'n9' } },
				       { data: { id: 'e6', source: 'n5', target: 'n8' } },
				       { data: { id: 'e7', source: 'n2', target: 'n4' } }]
				},
				style: defaultSty,

				ready: function(){
				   window.cy2 = this;
				   cy2.on("click", "node", function(evt){
				       var node = this;
				       console.log("%o", node);
				   });

				   // set random size & shape for one of the parents
				   var nonAutoParent = cy2.getElementById('non-auto');
				   nonAutoParent.css({width: 80, height: 50, shape: 'triangle'});
				}
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

		$("#compound-remove-selected-button").click(function(){
			cy2.elements(":selected").remove();
		});

		$("#compound-hide-selected-button").click(function(){
			cy2.elements(":selected").hide();
		});

		$("#compound-show-all-button").click(function(){
			cy2.elements().show();
		});

		var numChildren = 0;

		$("#add-child-button").click(function(){

			var parentId = $("#parent-node").val();
			var nodes = [];

			nodes.push({group: "nodes",
				           data: {id: "c" + numChildren, parent: parentId},
				           position: {x: Math.random() * width, y: Math.random() * height}});

			numChildren++;

			cy2.add(nodes);
		});

		$("#set-random-style").click(function(){

			var nodes = cy2.elements("node:selected");

			for (var i=0; i < nodes.size(); i++)
			{
				var shapes = ["triangle", "rectangle", "ellipse", "pentagon"];

				// pick a random shape and dimensions
				nodes[i].css({"width": Math.round(Math.random() * 50 + 1),
					"height": Math.round(Math.random() * 50 + 1),
					"shape": shapes[Math.floor(Math.random() * 4)]});
			}

		});
	});
	


	
});