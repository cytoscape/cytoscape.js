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
				targetArrowShape: "triangle",
				sourceArrowShape: "circle",
				width: {
					defaultValue: 1,
					continuousMapper: {
						attr: {
							name: "weight",
						},
						mapped: {
							min: 1,
							max: 4
						}
					}
				}
			},
			
			nodes: {
				labelText: {
					defaultValue: "",
					passthroughMapper: "id"
				},
				shape: "ellipse",
				height: {
					continuousMapper: {
						attr: {
							name: "weight",
						},
						mapped: {
							min: 10,
							max: 30
						}
					}
				},
				width: {
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
	
	var numNodes = 4;
	var numEdges = 10;
	
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
	
	$("#zoom-pan-button").click(function(){
		cy.zoom(1);
		cy.pan({ x: 0, y: 0 });
	});
	
	$("#fit-button").click(function(){
		cy.fit();
	});
	
	$("#fit-selected-button").click(function(){
		cy.fit( cy.elements(":selected") );
	});
	
	$("#center-selected-button").click(function(){
		cy.center( cy.elements(":selected") );
	});
	
	$("#remove-selected-button").click(function(){
		cy.remove( cy.elements(":selected") );
	});
	
	function displayElementData(element, position){
		var content = $('<div></div>');
		var data = element.data();
		
		$.each(data, function(name, value){
			content.append('<p><em>' + name + '</em> = ' + value + '</p>');
		});
		
		$("body").commandtip({
			paper: false,
			position: {
				x: position.x,
				y: position.y
			},
			content: content
		});
	}
	
	cy.nodes().live("click", function(e){
		if( e.metaKey ){
			displayElementData(this, {
				x: $("#cytoscapeweb").offset().left + this.renderedPosition("x") + parseFloat( $("#cytoscapeweb").css("border-left-width") ),
				y: $("#cytoscapeweb").offset().top + this.renderedPosition("y") + this.renderedDimensions("height")/2
			});
		}
	});
	
	cy.edges().live("click", function(e){
		if( e.metaKey ){
			displayElementData(this, {
				x: e.clientX,
				y: e.clientY
			});
		}
	});
	
	cy.bind("zoom", function(){
		$(".ui-tooltip").hide();
	});
	
	function selectFromFilter(){
		var selector = $("#filter-selector").val();
		var toSelect = cy.elements(selector);
		
		toSelect.select();
		cy.elements().not(toSelect).unselect();
	}
	$("#filter-button").click(function(){
		selectFromFilter();
	});
	
	$("#filter-selector").bind("keydown", function(e){
		if( e.which == 13 ){
			selectFromFilter();
		}
	});
	
	$("#bind-button").click(function(){
		var action = $("#bind-type-select").val();
		var event = $("#bind-event-select").val();
		var selector = $("#bind-selector").val();
		
		$.gritter.add({
			title: 'Binding applied',
			text: action + ' on `' + selector + '` for ' + event,
			sticky: false,
			time: 1000
		});	
		
		var callback = function(){
			$.gritter.add({
				title: 'Event triggered for ' + this.data("id"),
				text: action + ' on `' + selector + '` for ' + event,
				sticky: false,
				time: 1000
			});
		};
		
		if( action == "unbind" || action == "die" ){
			callback = undefined;
		}
		
		cy.elements(selector)[action](event, callback);
	});
	
});