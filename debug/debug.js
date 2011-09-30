$(function(){
				
	$.cytoscapeweb("quiet", false);
	$.cytoscapeweb("debugging", false);
	
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
					defaultValue: 5,
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
		data: {
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
		options.data.nodes.push({
			data: {
				id: "n" + i,
				weight: Math.random() * 100
			},
			position: { x: Math.random()*500, y: Math.random()*500 }
		});
	}
	
	for(var i = 0; i < numEdges; i++){
		options.data.edges.push({
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
	
});