$(function(){
				
	$.cytoscapeweb("quiet", false);
	$.cytoscapeweb("debugging", false);
	
	var height = $("#cytoscapeweb").height();
	var width = $("#cytoscapeweb").width();
	
	var options = {
		selector: "#cytoscapeweb",
		renderer: {
			name: "svg"
		},
		layout: {
			name: "grid"
		},
		style: {
			edges: {
				width: {
					defaultValue: 1,
					continuousMapper: {
						attr: {
							name: "weight",
						},
						mapped: {
							min: 4,
							max: 1
						}
					}
				}
			},
			
			nodes: {
				labelText: {
					defaultValue: "",
					passthroughMapper: "id"
				},
				labelHalign: "middle",
				labelValign: "top",
				shape: "ellipse",
				size: {
					continuousMapper: {
						attr: {
							name: "weight",
						},
						mapped: {
							min: 10,
							max: 30
						}
					}
				}
			}
		},
		elements: {
			nodes: [
			], 
			
			edges: [
			]
		}
	};
	
	var numNodes = 10;
	var numEdges = 20;
	
	function randNodeId(){
		return "n" + Math.floor( Math.random() * numNodes );
	}
	
	for(var i = 0; i < numNodes; i++){
		options.elements.nodes.push({
			data: {
				id: "n" + i,
				weight: Math.random() * 100
			}
		});
	}
	
	for(var i = 0; i < numEdges; i++){
		options.elements.edges.push({
			data: {
				id: "e" + i,
				source: randNodeId(),
				target: randNodeId(),
				weight: Math.random() * 100
			}
		});
	}
	
	cy = $.cytoscapeweb(options);

	$("#layout-button").bind("click", function(){
		cy.layout({
			name: $("#layout-select").val()
		});
	});
	
	function number(group){
		var input = $("#" + group + "-number");
		var val = parseInt( input.val() );
		
		if( isNaN(val) ){
			return 0;
		}
		
		return val;
	}
	
	$("#add-elements-button").click(function(){
		var n = number("nodes");
		var e = number("edges");
		
		var nodes = [];
		for(var i = 0; i < n; i++){
			nodes.push({
				group: "nodes",
				data: { id: "n" + (i + numNodes), weight: Math.random() * 100 },
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
					weight: Math.random() * 100,
					source: nodeId(),
					target: nodeId()
				},
			});
		}
		numEdges += e;
		
		cy.add(edges);
	});
	
	$("#remove-elements-button").click(function(){
		var n = number("nodes");
		var e = number("edges");
		
		cy.nodes().slice(0, n).remove();
		cy.edges().slice(0, e).remove();
	});
	
});