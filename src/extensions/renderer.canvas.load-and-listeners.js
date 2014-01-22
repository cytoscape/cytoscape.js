;(function($$){

	var CanvasRenderer = $$('renderer', 'canvas');

	CanvasRenderer.prototype.registerBinding = function(target, event, handler, useCapture){
		this.bindings.push({
			target: target,
			event: event,
			handler: handler,
			useCapture: useCapture
		});

		target.addEventListener(event, handler, useCapture);
	};

	CanvasRenderer.prototype.load = function() {
		var r = this;

		// helper function to determine which child nodes and inner edges
		// of a compound node to be dragged as well as the grabbed and selected nodes
		var addDescendantsToDrag = function(node, addSelected, dragElements) {
			if (!addSelected)
			{
				var parents = node.parents();

				// do not process descendants for this node,
				// because those will be handled for the topmost selected parent
				for (var i=0; i < parents.size(); i++)
				{
				    if (parents[i]._private.selected)
				    {
					    return;
				    }
				}
			}

			var innerNodes = node.descendants();

			function hasNonAutoParent(ele){
				while( ele.parent().nonempty() && ele.parent().id() !== node.id() ){
					parent = ele.parent()[0];
					var pstyle = parent._private.style;

					if( pstyle.width.value !== 'auto' || pstyle.height.value !== 'auto' ){
						return true;
					}

					ele = ele.parent();
				}

				return false;
			}

			// TODO do not drag hidden children & children of hidden children?
			for (var i=0; i < innerNodes.size(); i++)
			{
				// if addSelected is true, then add node in any case,
				// if not, then add only non-selected nodes
				if ( (addSelected || !innerNodes[i]._private.selected) )
				{
					innerNodes[i]._private.rscratch.inDragLayer = true;
					//innerNodes[i].trigger(new $$.Event(e, {type: "grab"}));
					//innerNodes[i].trigger(event);
					dragElements.push(innerNodes[i]);

					for (var j=0; j < innerNodes[i]._private.edges.length; j++)
					{
						innerNodes[i]._private.edges[j]._private.rscratch.inDragLayer = true;
					}
				}
			}
		};

		// adds the given nodes, and its edges to the drag layer
		var addNodeToDrag = function(node, dragElements) {
			node._private.grabbed = true;
			node._private.rscratch.inDragLayer = true;

			dragElements.push(node);

			for (var i=0;i<node._private.edges.length;i++) {
				node._private.edges[i]._private.rscratch.inDragLayer = true;
			}

			//node.trigger(new $$.Event(e, {type: "grab"}));
		};

		// helper function to determine which ancestor nodes and edges should go
		// to the drag layer (or should be removed from drag layer).
		var updateAncestorsInDragLayer = function(node, inDragLayer) {
			// find top-level parent
			var parent = node;

			while (parent.parent().nonempty())
			{
				parent = parent.parent()[0];

				// var pstyle = parent._private.style;
				// if( pstyle.width.value !== 'auto' || pstyle.height.value !== 'auto' ){
				// 	parent = node;
				// 	break;
				// }
			}

			// no parent node: no node to add to the drag layer
			if (parent == node && inDragLayer)
			{
				return;
			}

			var nodes = parent.descendants().add(parent);

			for (var i=0; i < nodes.size(); i++)
			{

				nodes[i]._private.rscratch.inDragLayer = inDragLayer;

				// TODO when calling this function for a set of nodes, we visit same edges over and over again,
				// instead of adding edges for each node, it may be better to iterate all edges at once
				// or another solution is to find out the common ancestors and process only those nodes for edges
				for (var j=0; j<nodes[i]._private.edges.length; j++) {
					nodes[i]._private.edges[j]._private.rscratch.inDragLayer = inDragLayer;
				}
			}
		};

		CanvasRenderer.prototype.nodeIsDraggable = function(node) {
			if (node._private.style["opacity"].value != 0
				&& node._private.style["visibility"].value == "visible"
				&& node._private.style["display"].value == "element"
				&& !node._private.locked
				&& node._private.grabbable) {
	
				return true;
			}
			
			return false;
		}

		// auto resize
		r.registerBinding(window, "resize", function(e) { 
			r.data.canvasNeedsRedraw[CanvasRenderer.NODE] = true;
			r.matchCanvasSize( r.data.container );
			r.redraw();
		}, true);

		// stop right click menu from appearing on cy
		r.registerBinding(r.data.container, "contextmenu", function(e){
			e.preventDefault();
		});

		// Primary key
		r.registerBinding(r.data.container, "mousedown", function(e) { 
			e.preventDefault();
			r.hoverData.capture = true;
			r.hoverData.which = e.which;
			
			var cy = r.data.cy; var pos = r.projectIntoViewport(e.pageX, e.pageY);
			var select = r.data.select;
			var near = r.findNearestElement(pos[0], pos[1], true);
			var down = r.hoverData.down;
			var draggedElements = r.dragData.possibleDragElements;
			var grabEvent = new $$.Event(e, {
				type: "grab"
			});

			// Right click button
			if( e.which == 3 ){

				if( near ){
					near.activate();
					near.trigger( new $$.Event(e, {
						type: "cxttapstart", 
						cyPosition: { x: pos[0], y: pos[1] } 
					}) );

					r.hoverData.down = near;
					r.hoverData.downTime = (new Date()).getTime();
					r.hoverData.cxtDragged = false;
				}

			// Primary button
			} else if (e.which == 1) {
				
				if( near ){
					near.activate();
				}

				// Element dragging
				{
					// If something is under the cursor and it is draggable, prepare to grab it
					if (near != null && r.nodeIsDraggable(near)) {
						if (near._private.group == "nodes" && near._private.selected == false) {

							draggedElements = r.dragData.possibleDragElements = [ ];
							addNodeToDrag(near, draggedElements);
							near.trigger(grabEvent);

							// add descendant nodes only if the compound size is set to auto
							if (near._private.style["width"].value == "auto" ||
							    near._private.style["height"].value == "auto")
							{
								addDescendantsToDrag(near,
									true,
									draggedElements);
							}

							// also add nodes and edges related to the topmost ancestor
							updateAncestorsInDragLayer(near, true);
						}
								
						if (near._private.group == "nodes" && near._private.selected == true) {
							draggedElements = r.dragData.possibleDragElements = [  ];

							var triggeredGrab = false;
							var selectedNodes = cy.$('node:selected');
							for( var i = 0; i < selectedNodes.length; i++ ){
								//r.dragData.possibleDragElements.push( selectedNodes[i] );
								
								// Only add this selected node to drag if it is draggable, eg. has nonzero opacity
								if (r.nodeIsDraggable(selectedNodes[i]))
								{
									addNodeToDrag(selectedNodes[i], draggedElements);
									
									// only trigger for grabbed node once
									if( !triggeredGrab ){
										near.trigger(grabEvent);
										triggeredGrab = true;
									}

									if (selectedNodes[i]._private.style["width"].value == "auto" ||
										selectedNodes[i]._private.style["height"].value == "auto")
									{
										addDescendantsToDrag(selectedNodes[i],
											false,
											draggedElements);
									}

									// also add nodes and edges related to the topmost ancestor
									updateAncestorsInDragLayer(selectedNodes[i], true);
								}
							}
						}
						
						near
							.trigger(new $$.Event(e, {
								type: "mousedown",
								cyPosition: { x: pos[0], y: pos[1] }
							}))
							.trigger(new $$.Event(e, {
								type: "tapstart",
								cyPosition: { x: pos[0], y: pos[1] }
							}))
							.trigger(new $$.Event(e, {
								type: "vmousedown",
								cyPosition: { x: pos[0], y: pos[1] }
							}))
						;
						
						// r.data.canvasNeedsRedraw[CanvasRenderer.DRAG] = true; 
						// r.data.canvasNeedsRedraw[CanvasRenderer.NODE] = true; 
						
					} else if (near == null) {
						cy
							.trigger(new $$.Event(e, {
								type: "mousedown",
								cyPosition: { x: pos[0], y: pos[1] }
							}))
							.trigger(new $$.Event(e, {
								type: "tapstart",
								cyPosition: { x: pos[0], y: pos[1] }
							}))
							.trigger(new $$.Event(e, {
								type: "vmousedown",
								cyPosition: { x: pos[0], y: pos[1] }
							}))
						;
					}
					
					r.hoverData.down = near;
					r.hoverData.downTime = (new Date()).getTime();

				}
			
				// Selection box
				if ( near == null || near.isEdge() ) {
					select[4] = 1;
					var timeUntilActive = Math.max( 0, CanvasRenderer.panOrBoxSelectDelay - (+new Date - r.hoverData.downTime) );

					clearTimeout( r.bgActiveTimeout );
					r.bgActiveTimeout = setTimeout(function(){
						if( near ){
							near.unactivate();
						}

						r.data.bgActivePosistion = {
							x: pos[0],
							y: pos[1]
						};

						r.data.canvasNeedsRedraw[CanvasRenderer.SELECT_BOX] = true;
		

						r.redraw();
					}, timeUntilActive);
					
				}
			
			} 
			
			// Initialize selection box coordinates
			select[0] = select[2] = pos[0];
			select[1] = select[3] = pos[1];
			
			r.redraw();
			
		}, false);
		
		r.registerBinding(window, "mousemove", function(e) {
			var preventDefault = false;
			var capture = r.hoverData.capture;

			if (!capture) {
				
				var containerPageCoords = r.findContainerPageCoords();
				
				if (e.pageX > containerPageCoords[0] && e.pageX < containerPageCoords[0] + r.data.container.clientWidth
					&& e.pageY > containerPageCoords[1] && e.pageY < containerPageCoords[1] + r.data.container.clientHeight) {
					
				} else {
					return;
				}
			}

			var cy = r.data.cy;
			var pos = r.projectIntoViewport(e.pageX, e.pageY);
			var select = r.data.select;
			
			var near = r.findNearestElement(pos[0], pos[1], true);
			var last = r.hoverData.last;
			var down = r.hoverData.down;
			
			var disp = [pos[0] - select[2], pos[1] - select[3]];
			var nodes = r.getCachedNodes();
			var edges = r.getCachedEdges();
		
			var draggedElements = r.dragData.possibleDragElements;
		

			var shiftDown = e.shiftKey;
			

			preventDefault = true;

			// Mousemove event
			{
				if (near != null) {
					near
						.trigger(new $$.Event(e, {
							type: "mousemove",
							cyPosition: { x: pos[0], y: pos[1] }
						}))
						.trigger(new $$.Event(e, {
							type: "vmousemove",
							cyPosition: { x: pos[0], y: pos[1] }
						}))
						.trigger(new $$.Event(e, {
							type: "tapdrag",
							cyPosition: { x: pos[0], y: pos[1] }
						}))
					;
					
				} else if (near == null) {
					cy
						.trigger(new $$.Event(e, {
							type: "mousemove",
							cyPosition: { x: pos[0], y: pos[1] }
						}))
						.trigger(new $$.Event(e, {
							type: "vmousemove",
							cyPosition: { x: pos[0], y: pos[1] }
						}))
						.trigger(new $$.Event(e, {
							type: "tapdrag",
							cyPosition: { x: pos[0], y: pos[1] }
						}))
					;
				}

			}
			
			
			// trigger context drag if rmouse down
			if( r.hoverData.which === 3 ){
				var cxtEvt = new $$.Event(e, {
					type: "cxtdrag",
					cyPosition: { x: pos[0], y: pos[1] }
				});

				if( down ){
					down.trigger( cxtEvt );
				} else {
					cy.trigger( cxtEvt );
				}

				r.hoverData.cxtDragged = true;

			// Check if we are drag panning the entire graph
			} else if (r.hoverData.dragging) {
				preventDefault = true;

				if( cy.panningEnabled() && cy.userPanningEnabled() ){
					var deltaP = {x: disp[0] * cy.zoom(), y: disp[1] * cy.zoom()};

					cy.panBy( deltaP );
				}
				
				// Needs reproject due to pan changing viewport
				pos = r.projectIntoViewport(e.pageX, e.pageY);

			// Checks primary button down & out of time & mouse not moved much
			} else if (select[4] == 1 && (down == null || down.isEdge())
					&& ( !cy.boxSelectionEnabled() || +new Date - r.hoverData.downTime >= CanvasRenderer.panOrBoxSelectDelay )
					&& (Math.abs(select[3] - select[1]) + Math.abs(select[2] - select[0]) < 4)
					&& cy.panningEnabled() && cy.userPanningEnabled() ) {
				
				r.hoverData.dragging = true;
				select[4] = 0;

			} else {
				// deactivate bg on box selection
				if (cy.boxSelectionEnabled() && Math.pow(select[2] - select[0], 2) + Math.pow(select[3] - select[1], 2) > 7 && select[4]){
					clearTimeout( r.bgActiveTimeout );
					r.data.bgActivePosistion = undefined;
				}
				
				if( down && down.isEdge() && down.active() ){ down.unactivate(); }

				if (near != last) {
					
					if (last) {
						last.trigger( new $$.Event(e, {
							type: "mouseout",
							cyPosition: { x: pos[0], y: pos[1] }
						}) ); 
					}
					
					if (near) {
						near.trigger( new $$.Event(e, {
							type: "mouseover",
							cyPosition: { x: pos[0], y: pos[1] }
						}) ); 
					}
					
					r.hoverData.last = near;
				}
				
				if ( down && down.isNode() && r.nodeIsDraggable(down) ) {
					r.dragData.didDrag = true; // indicate that we actually did drag the node

					var toTrigger = [];
					for (var i=0; i<draggedElements.length; i++) {

						// Locked nodes not draggable, as well as non-visible nodes
						if (draggedElements[i]._private.group == "nodes"
							&& r.nodeIsDraggable(draggedElements[i])) {
							
							draggedElements[i]._private.position.x += disp[0];
							draggedElements[i]._private.position.y += disp[1];

							toTrigger.push( draggedElements[i] );
						}
					}
					
					(new $$.Collection(cy, toTrigger))
						.trigger("drag")
						.trigger("position")
					;

					if (select[2] == select[0] && select[3] == select[1]) {
						r.data.canvasNeedsRedraw[CanvasRenderer.NODE] = true;
					}
					
					r.data.canvasNeedsRedraw[CanvasRenderer.DRAG] = true;
				}
				
				if( cy.boxSelectionEnabled() ){
					r.data.canvasNeedsRedraw[CanvasRenderer.SELECT_BOX] = true;
				}

				// prevent the dragging from triggering text selection on the page
				preventDefault = true;
			}
			
			select[2] = pos[0]; select[3] = pos[1];
			
			r.redraw();
			
			if( preventDefault ){ 
				if(e.stopPropagation) e.stopPropagation();
    			if(e.preventDefault) e.preventDefault();
    			return false;
    		}
		}, false);
		
		r.registerBinding(window, "mouseup", function(e) {
			// console.log('--\nmouseup', e)

			var capture = r.hoverData.capture; if (!capture) { return; }; r.hoverData.capture = false;
		
			var cy = r.data.cy; var pos = r.projectIntoViewport(e.pageX, e.pageY); var select = r.data.select;
			var near = r.findNearestElement(pos[0], pos[1], true);
			var nodes = r.getCachedNodes(); var edges = r.getCachedEdges(); 
			var draggedElements = r.dragData.possibleDragElements; var down = r.hoverData.down;
			var shiftDown = e.shiftKey;
			
			r.data.bgActivePosistion = undefined; // not active bg now
			clearTimeout( r.bgActiveTimeout );

			if( down ){
				down.unactivate();
			}

			if( r.hoverData.which === 3 ){
				var cxtEvt = new $$.Event(e, {
					type: "cxttapend",
					cyPosition: { x: pos[0], y: pos[1] }
				});

				if( down ){
					down.trigger( cxtEvt );
				} else {
					cy.trigger( cxtEvt );
				}

				if( !r.hoverData.cxtDragged ){
					var cxtTap = new $$.Event(e, {
						type: "cxttap",
						cyPosition: { x: pos[0], y: pos[1] }
					});

					if( down ){
						down.trigger( cxtTap );
					} else {
						cy.trigger( cxtTap );
					}
				}

				r.hoverData.cxtDragged = false;
				r.hoverData.which = null;

			// if not right mouse
			} else {

				// Deselect all elements if nothing is currently under the mouse cursor and we aren't dragging something
				if ( (down == null) // not mousedown on node
					&& !r.dragData.didDrag // didn't move the node around
					&& !(Math.pow(select[2] - select[0], 2) + Math.pow(select[3] - select[1], 2) > 7 && select[4]) // not box selection
					&& !r.hoverData.dragging // not panning
				) {

					// console.log('unselect all from bg');

	//++clock+unselect
	//				var a = time();
					cy.$(':selected').unselect();
					
	//++clock+unselect
	//				console.log("unselect", time() - a);
					
					if (draggedElements.length > 0) {
						r.data.canvasNeedsRedraw[CanvasRenderer.NODE] = true;
					}
					
					r.dragData.possibleDragElements = draggedElements = [];
				}
			
				
				// Mouseup event
				{
					// console.log('trigger mouseup et al');

					if (near != null) {
						near
							.trigger(new $$.Event(e, {
								type: "mouseup",
								cyPosition: { x: pos[0], y: pos[1] }
							}))
							.trigger(new $$.Event(e, {
								type: "tapend",
								cyPosition: { x: pos[0], y: pos[1] }
							}))
							.trigger(new $$.Event(e, {
								type: "vmouseup",
								cyPosition: { x: pos[0], y: pos[1] }
							}))
						;
					} else if (near == null) {
						cy
							.trigger(new $$.Event(e, {
								type: "mouseup",
								cyPosition: { x: pos[0], y: pos[1] }
							}))
							.trigger(new $$.Event(e, {
								type: "tapend",
								cyPosition: { x: pos[0], y: pos[1] }
							}))
							.trigger(new $$.Event(e, {
								type: "vmouseup",
								cyPosition: { x: pos[0], y: pos[1] }
							}))
						;
					}
				}
				
				// Click event
				{
					// console.log('trigger click et al');

					if (Math.pow(select[2] - select[0], 2) + Math.pow(select[3] - select[1], 2) == 0) {
						if (near != null) {
							near
								.trigger( new $$.Event(e, {
									type: "click",
									cyPosition: { x: pos[0], y: pos[1] }
								}) )
								.trigger( new $$.Event(e, {
									type: "tap",
									cyPosition: { x: pos[0], y: pos[1] }
								}) )
								.trigger( new $$.Event(e, {
									type: "vclick",
									cyPosition: { x: pos[0], y: pos[1] }
								}) )
							;
						} else if (near == null) {
							cy
								.trigger( new $$.Event(e, {
									type: "click",
									cyPosition: { x: pos[0], y: pos[1] }
								}) )
								.trigger( new $$.Event(e, {
									type: "tap",
									cyPosition: { x: pos[0], y: pos[1] }
								}) )
								.trigger( new $$.Event(e, {
									type: "vclick",
									cyPosition: { x: pos[0], y: pos[1] }
								}) )
							;
						}
					}
				}

				// Single selection
				if (near == down && !r.dragData.didDrag) {
					if (near != null && near._private.selectable) {
						
						// console.log('single selection')

						if( cy.selectionType() === 'additive' ){
							if( near.selected() ){
							near.unselect();
							} else {
								near.select();
							}
						} else {
							if( !shiftDown ){
								cy.$(':selected').unselect();
							}

							near.select();
						}


						updateAncestorsInDragLayer(near, false);
						
						r.data.canvasNeedsRedraw[CanvasRenderer.NODE] = true; 
						
					}
				// Ungrab single drag
				} else if (near == down) {
					if (near != null && near._private.grabbed) {
						// console.log('ungrab single drag')

						var grabbedEles = cy.$(':grabbed');

						for(var i = 0; i < grabbedEles.length; i++){
							var ele = grabbedEles[i];

							ele._private.grabbed = false;
							
							var sEdges = ele._private.edges;
							for (var j=0;j<sEdges.length;j++) { sEdges[j]._private.rscratch.inDragLayer = false; }

							// for compound nodes, also remove related nodes and edges from the drag layer
							updateAncestorsInDragLayer(ele, false);
						}

						grabbedEles.trigger("free");
					}
				}
				
				if ( cy.boxSelectionEnabled() &&  Math.pow(select[2] - select[0], 2) + Math.pow(select[3] - select[1], 2) > 7 && select[4] ) {
					// console.log("box selection");
					
					var newlySelected = [];
					var box = r.getAllInBox(select[0], select[1], select[2], select[3]);
					// console.log(box);
					var event = new $$.Event(e, {type: "select"});
					for (var i=0;i<box.length;i++) { 
						if (box[i]._private.selectable) {
							draggedElements.push( box[i] ); 
							newlySelected.push( box[i] );
						}
					}

					var newlySelCol = new $$.Collection( cy, newlySelected );

					if( cy.selectionType() === "additive" ){
						newlySelCol.select();
					} else {
						if( !shiftDown ){
							cy.$(':selected').unselect();
						}

						newlySelCol.select();
					}
					
					if (box.length > 0) { 
						r.data.canvasNeedsRedraw[CanvasRenderer.NODE] = true; 
					}
				}
				
				// Cancel drag pan
				r.hoverData.dragging = false;
				
				if (!select[4]) {
					// console.log('free at end', draggedElements)
					
					for (var i=0;i<draggedElements.length;i++) {
						
						if (draggedElements[i]._private.group == "nodes") { 
							draggedElements[i]._private.rscratch.inDragLayer = false;
						  
							var sEdges = draggedElements[i]._private.edges;
							for (var j=0;j<sEdges.length;j++) { sEdges[j]._private.rscratch.inDragLayer = false; }

							// for compound nodes, also remove related nodes and edges from the drag layer
							updateAncestorsInDragLayer(draggedElements[i], false);
							
						} else if (draggedElements[i]._private.group == "edges") {
							draggedElements[i]._private.rscratch.inDragLayer = false;
						}
						
					}

					if( down){ down.trigger("free"); }

	//				draggedElements = r.dragData.possibleDragElements = [];
					r.data.canvasNeedsRedraw[CanvasRenderer.DRAG] = true; 
					r.data.canvasNeedsRedraw[CanvasRenderer.NODE] = true; 
				}
			
			} // else not right mouse

			select[4] = 0; r.hoverData.down = null;
			
			r.data.canvasNeedsRedraw[CanvasRenderer.SELECT_BOX] = true; 
			
//			console.log("mu", pos[0], pos[1]);
//			console.log("ss", select);
			
			r.dragData.didDrag = false;

			r.redraw();
			
		}, false);
		
		var wheelHandler = function(e) { 
			var cy = r.data.cy;
			var pos = r.projectIntoViewport(e.pageX, e.pageY);
			var rpos = [pos[0] * cy.zoom() + cy.pan().x,
			              pos[1] * cy.zoom() + cy.pan().y];
			
			if( cy.panningEnabled() && cy.userPanningEnabled() && cy.zoomingEnabled() && cy.userZoomingEnabled() ){
				e.preventDefault();
			
				var diff = e.wheelDeltaY / 1000 || e.wheelDelta / 1000 || e.detail / -32 || -e.deltaY / 500;

				cy.zoom({level: cy.zoom() * Math.pow(10, diff), renderedPosition: {x: rpos[0], y: rpos[1]}});
			}

		}
		
		// Functions to help with whether mouse wheel should trigger zooming
		// --
		r.registerBinding(r.data.container, "wheel", wheelHandler, true);

		r.registerBinding(r.data.container, "mousewheel", wheelHandler, true);
		
		r.registerBinding(r.data.container, "DOMMouseScroll", wheelHandler, true);

		r.registerBinding(r.data.container, "MozMousePixelScroll", function(e){
		}, false);
		
		// Functions to help with handling mouseout/mouseover on the Cytoscape container
					// Handle mouseout on Cytoscape container
		r.registerBinding(r.data.container, "mouseout", function(e) { 
			var pos = r.projectIntoViewport(e.pageX, e.pageY);

			r.data.cy.trigger(new $$.Event(e, {
				type: "mouseout",
				cyPosition: { x: pos[0], y: pos[1] }
			}));
		}, false);
		
		r.registerBinding(r.data.container, "mouseover", function(e) { 
			var pos = r.projectIntoViewport(e.pageX, e.pageY);

			r.data.cy.trigger(new $$.Event(e, {
				type: "mouseover",
				cyPosition: { x: pos[0], y: pos[1] }
			}));
		}, false);
		
		var f1x1, f1y1, f2x1, f2y1; // starting points for pinch-to-zoom
		var distance1; // initial distance between finger 1 and finger 2 for pinch-to-zoom
		var center1, modelCenter1; // center point on start pinch to zoom
		var offsetLeft, offsetTop;
		var containerWidth = r.data.container.clientWidth, containerHeight = r.data.container.clientHeight;
		var twoFingersStartInside;

		function distance(x1, y1, x2, y2){
			return Math.sqrt( (x2-x1)*(x2-x1) + (y2-y1)*(y2-y1) );
		}

		r.registerBinding(r.data.container, "touchstart", function(e) {

			clearTimeout( this.threeFingerSelectTimeout );

			if( e.target !== r.data.link ){
				e.preventDefault();
			}
		
			r.touchData.capture = true;
			r.data.bgActivePosistion = undefined;

			var cy = r.data.cy; 
			var nodes = r.getCachedNodes(); var edges = r.getCachedEdges();
			var now = r.touchData.now; var earlier = r.touchData.earlier;
			
			if (e.touches[0]) { var pos = r.projectIntoViewport(e.touches[0].pageX, e.touches[0].pageY); now[0] = pos[0]; now[1] = pos[1]; }
			if (e.touches[1]) { var pos = r.projectIntoViewport(e.touches[1].pageX, e.touches[1].pageY); now[2] = pos[0]; now[3] = pos[1]; }
			if (e.touches[2]) { var pos = r.projectIntoViewport(e.touches[2].pageX, e.touches[2].pageY); now[4] = pos[0]; now[5] = pos[1]; }
			
			// record starting points for pinch-to-zoom
			if( e.touches[1] ){

				// anything in the set of dragged eles should be released
				function release( eles ){
					for( var i = 0; i < eles.length; i++ ){
						eles[i]._private.grabbed = false;
						eles[i]._private.rscratch.inDragLayer = false;
						if( eles[i].active() ){ eles[i].unactivate(); }
					}
				}
				release(nodes);
				release(edges);

				var offsets = r.findContainerPageCoords();
				offsetTop = offsets[1];
				offsetLeft = offsets[0];

				f1x1 = e.touches[0].pageX - offsetLeft;
				f1y1 = e.touches[0].pageY - offsetTop;
				
				f2x1 = e.touches[1].pageX - offsetLeft;
				f2y1 = e.touches[1].pageY - offsetTop;

				twoFingersStartInside = 
					   0 <= f1x1 && f1x1 <= containerWidth
					&& 0 <= f2x1 && f2x1 <= containerWidth
					&& 0 <= f1y1 && f1y1 <= containerHeight
					&& 0 <= f2y1 && f2y1 <= containerHeight
				;

				var pan = cy.pan();
				var zoom = cy.zoom();

				distance1 = distance( f1x1, f1y1, f2x1, f2y1 );
				center1 = [ (f1x1 + f2x1)/2, (f1y1 + f2y1)/2 ];
				modelCenter1 = [ 
					(center1[0] - pan.x) / zoom,
					(center1[1] - pan.y) / zoom
				];

				// consider context tap
				if( distance1 < 100 ){

					var near1 = r.findNearestElement(now[0], now[1], true);
					var near2 = r.findNearestElement(now[2], now[3], true);

					//console.log(distance1)

					if( near1 && near1.isNode() ){
						near1.activate().trigger( new $$.Event(e, {
							type: "cxttapstart",
							cyPosition: { x: now[0], y: now[1] }
						}) );
						r.touchData.start = near1;
					
					} else if( near2 && near2.isNode() ){
						near2.activate().trigger( new $$.Event(e, {
							type: "cxttapstart",
							cyPosition: { x: now[0], y: now[1] }
						}) );
						r.touchData.start = near2;
					
					} else {
						cy.trigger( new $$.Event(e, {
							type: "cxttapstart",
							cyPosition: { x: now[0], y: now[1] }
						}) );
						r.touchData.start = null;
					} 

					if( r.touchData.start ){ r.touchData.start._private.grabbed = false; }
					r.touchData.cxt = true;
					r.touchData.cxtDragged = false;
					r.data.bgActivePosistion = undefined;

					//console.log('cxttapstart')

					r.redraw();
					return;
					
				}

				// console.log(center1);
				// console.log('touchstart ptz');
				// console.log(offsetLeft, offsetTop);
				// console.log(f1x1, f1y1);
				// console.log(f2x1, f2y1);
				// console.log(distance1);
				// console.log(center1);
			}

			// console.log('another tapstart')
			
			
			if (e.touches[2]) {
			
			} else if (e.touches[1]) {
				
			} else if (e.touches[0]) {
				var near = r.findNearestElement(now[0], now[1], true);

				if (near != null) {
					near.activate();

					r.touchData.start = near;
					
					if (near._private.group == "nodes" && r.nodeIsDraggable(near))
					{

						var draggedEles = r.dragData.touchDragEles = [];
						addNodeToDrag(near, draggedEles);
						near.trigger("grab");

						if( near.selected() ){
							// reset drag elements, since near will be added again
							draggedEles = r.dragData.touchDragEles = [];

							var selectedNodes = cy.$('node:selected');

							for( var k = 0; k < selectedNodes.length; k++ ){

								var selectedNode = selectedNodes[k];
								if (r.nodeIsDraggable(selectedNode)) {
									draggedEles.push( selectedNode );
									selectedNode._private.rscratch.inDragLayer = true;

									var sEdges = selectedNode._private.edges;
									for (var j=0; j<sEdges.length; j++) {
									  sEdges[j]._private.rscratch.inDragLayer = true;
									}

									if (selectedNode._private.style["width"].value == "auto" ||
									    selectedNode._private.style["height"].value == "auto")
									{
										addDescendantsToDrag(selectedNode,
											false,
											draggedEles);
									}

									// also add nodes and edges related to the topmost ancestor
									updateAncestorsInDragLayer(selectedNode, true);
								}
							}
						} else {
							//draggedEles.push( near );

							// add descendant nodes only if the compound size is set to auto
							if (near._private.style["width"].value == "auto" ||
							    near._private.style["height"].value == "auto")
							{
								addDescendantsToDrag(near,
									true,
									draggedEles);
							}

							// also add nodes and edges related to the topmost ancestor
							updateAncestorsInDragLayer(near, true);
						}
					}
					
					near
						.trigger(new $$.Event(e, {
							type: "touchstart",
							cyPosition: { x: now[0], y: now[1] }
						}))
						.trigger(new $$.Event(e, {
							type: "tapstart",
							cyPosition: { x: now[0], y: now[1] }
						}))
						.trigger(new $$.Event(e, {
							type: "vmousdown",
							cyPosition: { x: now[0], y: now[1] }
						}))
					;
				} if (near == null) {
					cy
						.trigger(new $$.Event(e, {
							type: "touchstart",
							cyPosition: { x: now[0], y: now[1] }
						}))
						.trigger(new $$.Event(e, {
							type: "tapstart",
							cyPosition: { x: now[0], y: now[1] }
						}))
						.trigger(new $$.Event(e, {
							type: "vmousedown",
							cyPosition: { x: now[0], y: now[1] }
						}))
					;

					r.data.bgActivePosistion = {
						x: pos[0],
						y: pos[1]
					};

					r.data.canvasNeedsRedraw[CanvasRenderer.SELECT_BOX] = true;

				}
				
				
				// Tap, taphold
				// -----
				
				for (var i=0;i<now.length;i++) {
					earlier[i] = now[i];
					r.touchData.startPosition[i] = now[i];
				};
				
				r.touchData.singleTouchMoved = false;
				r.touchData.singleTouchStartTime = +new Date;
				
				var tapHoldTimeout = setTimeout(function() {
					if (r.touchData.singleTouchMoved == false
							// This time double constraint prevents multiple quick taps
							// followed by a taphold triggering multiple taphold events
							&& (+new Date) - r.touchData.singleTouchStartTime > 250) {
						if (r.touchData.start) {
							r.touchData.start.trigger( new $$.Event(e, {
								type: "taphold",
								cyPosition: { x: now[0], y: now[1] }
							}) );
						} else {
							r.data.cy.trigger( new $$.Event(e, {
								type: "taphold",
								cyPosition: { x: now[0], y: now[1] }
							}) );

							cy.$(':selected').unselect();
						}

//						console.log("taphold");
					}
				}, 1000);
			}
			
			r.redraw();
			
		}, false);
		
// console.log = function(m){ $('#console').append('<div>'+m+'</div>'); };

		r.registerBinding(window, "touchmove", function(e) {
		
			var select = r.data.select;
			var capture = r.touchData.capture; //if (!capture) { return; }; 
			capture && e.preventDefault();
		
			var cy = r.data.cy; 
			var nodes = r.getCachedNodes(); var edges = r.getCachedEdges();
			var now = r.touchData.now; var earlier = r.touchData.earlier;
			
			if (e.touches[0]) { var pos = r.projectIntoViewport(e.touches[0].pageX, e.touches[0].pageY); now[0] = pos[0]; now[1] = pos[1]; }
			if (e.touches[1]) { var pos = r.projectIntoViewport(e.touches[1].pageX, e.touches[1].pageY); now[2] = pos[0]; now[3] = pos[1]; }
			if (e.touches[2]) { var pos = r.projectIntoViewport(e.touches[2].pageX, e.touches[2].pageY); now[4] = pos[0]; now[5] = pos[1]; }
			var disp = []; for (var j=0;j<now.length;j++) { disp[j] = now[j] - earlier[j]; }
			

			if( capture && r.touchData.cxt ){
				var f1x2 = e.touches[0].pageX - offsetLeft, f1y2 = e.touches[0].pageY - offsetTop;
				var f2x2 = e.touches[1].pageX - offsetLeft, f2y2 = e.touches[1].pageY - offsetTop;
				var distance2 = distance( f1x2, f1y2, f2x2, f2y2 );
				var factor = distance2 / distance1;

				//console.log(factor, distance2)

				// cancel ctx gestures if the distance b/t the fingers increases
				if( factor >= 1.5 || distance2 >= 150 ){
					r.touchData.cxt = false;
					if( r.touchData.start ){ r.touchData.start.unactivate(); r.touchData.start = null; }
					r.data.bgActivePosistion = undefined;
					r.data.canvasNeedsRedraw[CanvasRenderer.SELECT_BOX] = true;

					var cxtEvt = new $$.Event(e, {
						type: "cxttapend",
						cyPosition: { x: now[0], y: now[1] }
					});
					if( r.touchData.start ){
						r.touchData.start.trigger( cxtEvt );
					} else {
						cy.trigger( cxtEvt );
					}
				}

			}  

			if( capture && r.touchData.cxt ){
				var cxtEvt = new $$.Event(e, {
					type: "cxtdrag",
					cyPosition: { x: now[0], y: now[1] }
				});
				r.data.bgActivePosistion = undefined;
				r.data.canvasNeedsRedraw[CanvasRenderer.SELECT_BOX] = true;

				if( r.touchData.start ){
					r.touchData.start.trigger( cxtEvt );
				} else {
					cy.trigger( cxtEvt );
				}

				if( r.touchData.start ){ r.touchData.start._private.grabbed = false; }
				r.touchData.cxtDragged = true;

				//console.log('cxtdrag')

			} else if( capture && e.touches[2] && cy.boxSelectionEnabled() ){
				r.data.bgActivePosistion = undefined;
				clearTimeout( this.threeFingerSelectTimeout );
				this.lastThreeTouch = +new Date;

				r.data.canvasNeedsRedraw[CanvasRenderer.SELECT_BOX] = true;

				if( !select || select.length === 0 || select[0] === undefined ){
					select[0] = (now[0] + now[2] + now[4])/3;
					select[1] = (now[1] + now[3] + now[5])/3;
					select[2] = (now[0] + now[2] + now[4])/3 + 1;
					select[3] = (now[1] + now[3] + now[5])/3 + 1;
				} else {
					select[2] = (now[0] + now[2] + now[4])/3;
					select[3] = (now[1] + now[3] + now[5])/3;
				}

				select[4] = 1;

			} else if ( capture && e.touches[1] && cy.zoomingEnabled() && cy.panningEnabled() && cy.userZoomingEnabled() && cy.userPanningEnabled() ) { // two fingers => pinch to zoom
				r.data.bgActivePosistion = undefined;
				r.data.canvasNeedsRedraw[CanvasRenderer.SELECT_BOX] = true;

				// console.log('touchmove ptz');

				// (x2, y2) for fingers 1 and 2
				var f1x2 = e.touches[0].pageX - offsetLeft, f1y2 = e.touches[0].pageY - offsetTop;
				var f2x2 = e.touches[1].pageX - offsetLeft, f2y2 = e.touches[1].pageY - offsetTop;

				// console.log( f1x2, f1y2 )
				// console.log( f2x2, f2y2 )

				var distance2 = distance( f1x2, f1y2, f2x2, f2y2 );
				var factor = distance2 / distance1;

				// console.log(distance2)
				// console.log(factor)

				if( factor != 1 && twoFingersStartInside){

					// console.log(factor)
					// console.log(distance2 + ' / ' + distance1);
					// console.log('--');

					// delta finger1
					var df1x = f1x2 - f1x1;
					var df1y = f1y2 - f1y1;

					// delta finger 2
					var df2x = f2x2 - f2x1;
					var df2y = f2y2 - f2y1;

					// translation is the normalised vector of the two fingers movement
					// i.e. so pinching cancels out and moving together pans
					var tx = (df1x + df2x)/2;
					var ty = (df1y + df2y)/2;

					// adjust factor by the speed multiplier
					// var speed = 1.5;
					// if( factor > 1 ){
					// 	factor = (factor - 1) * speed + 1;
					// } else {
					// 	factor = 1 - (1 - factor) * speed;
					// }

					// now calculate the zoom
					var zoom1 = cy.zoom();
					var zoom2 = zoom1 * factor;
					var pan1 = cy.pan();

					// the model center point converted to the current rendered pos
					var ctrx = modelCenter1[0] * zoom1 + pan1.x;
					var ctry = modelCenter1[1] * zoom1 + pan1.y;

					var pan2 = {
						x: -zoom2/zoom1 * (ctrx - pan1.x - tx) + ctrx,
						y: -zoom2/zoom1 * (ctry - pan1.y - ty) + ctry
					};

					// console.log(pan2);
					// console.log(zoom2);

					cy._private.zoom = zoom2;
					cy._private.pan = pan2;
					cy
						.trigger('pan zoom')
						.notify('viewport')
					;

					distance1 = distance2;	
					f1x1 = f1x2;
					f1y1 = f1y2;
					f2x1 = f2x2;
					f2y1 = f2y2;

					r.pinching = true;
				}
				
				// Re-project
				if (e.touches[0]) { var pos = r.projectIntoViewport(e.touches[0].pageX, e.touches[0].pageY); now[0] = pos[0]; now[1] = pos[1]; }
				if (e.touches[1]) { var pos = r.projectIntoViewport(e.touches[1].pageX, e.touches[1].pageY); now[2] = pos[0]; now[3] = pos[1]; }
				if (e.touches[2]) { var pos = r.projectIntoViewport(e.touches[2].pageX, e.touches[2].pageY); now[4] = pos[0]; now[5] = pos[1]; }

			} else if (e.touches[0]) {
				var start = r.touchData.start;
				var last = r.touchData.last;
				
				if ( start != null && start._private.group == "nodes" && r.nodeIsDraggable(start)) {
					var draggedEles = r.dragData.touchDragEles;

					for( var k = 0; k < draggedEles.length; k++ ){
						var draggedEle = draggedEles[k];

						if( r.nodeIsDraggable(draggedEle) ){
							r.dragData.didDrag = true;

							draggedEle._private.position.x += disp[0];
							draggedEle._private.position.y += disp[1];
			
						}
					}

					( new $$.Collection(cy, draggedEles) )
						.trigger("drag")
						.trigger("position")
					;
					
					r.data.canvasNeedsRedraw[CanvasRenderer.DRAG] = true;

					if (r.touchData.startPosition[0] == earlier[0]
						&& r.touchData.startPosition[1] == earlier[1]) {
						
						r.data.canvasNeedsRedraw[CanvasRenderer.NODE] = true;
					}
					
				}
				
				// Touchmove event
				{
					if (start != null) {
						start.trigger( new $$.Event(e, {
							type: "touchmove",
							cyPosition: { x: now[0], y: now[1] }
						}) ); 

						start.trigger( new $$.Event(e, {
							type: "tapdrag",
							cyPosition: { x: now[0], y: now[1] }
						}) ); 

						start.trigger( new $$.Event(e, {
							type: "vmousemove",
							cyPosition: { x: now[0], y: now[1] }
						}) ); 
					}
					
					if (start == null) { 
						var near = r.findNearestElement(now[0], now[1], true);

						if (near != null) { 
							near.trigger( new $$.Event(e, {
								type: "touchmove",
								cyPosition: { x: now[0], y: now[1] }
							}) ); 

							near.trigger( new $$.Event(e, {
								type: "tapdrag",
								cyPosition: { x: now[0], y: now[1] }
							}) );

							near.trigger( new $$.Event(e, {
								type: "vmousemove",
								cyPosition: { x: now[0], y: now[1] }
							}) );
						}

						if (near == null) { 
							cy.trigger( new $$.Event(e, {
								type: "touchmove",
								cyPosition: { x: now[0], y: now[1] }
							}) ); 

							cy.trigger( new $$.Event(e, {
								type: "tapdrag",
								cyPosition: { x: now[0], y: now[1] }
							}) ); 

							cy.trigger( new $$.Event(e, {
								type: "vmousemove",
								cyPosition: { x: now[0], y: now[1] }
							}) ); 
						}
					}

					// if (near != last) {
					// 	if (last) { last.trigger(new $$.Event(e, {type: "touchout"})); }
					// 	if (near) { near.trigger(new $$.Event(e, {type: "touchover"})); }
					// }

					r.touchData.last = near;
				}
				
				// Check to cancel taphold
				for (var i=0;i<now.length;i++) {
					if (now[i] 
						&& r.touchData.startPosition[i]
						&& Math.abs(now[i] - r.touchData.startPosition[i]) > 4) {
						
						r.touchData.singleTouchMoved = true;
					}
				}
				
				if ( capture && (start == null || start.isEdge()) && cy.panningEnabled() && cy.userPanningEnabled() ) {
					if( start ){
						start.unactivate();

						if( !r.data.bgActivePosistion ){
							r.data.bgActivePosistion = {
								x: now[0],
								y: now[1]
							};
						}

						r.data.canvasNeedsRedraw[CanvasRenderer.SELECT_BOX] = true;
					}

					cy.panBy({x: disp[0] * cy.zoom(), y: disp[1] * cy.zoom()});
					r.swipePanning = true;
					
					// Re-project
					var pos = r.projectIntoViewport(e.touches[0].pageX, e.touches[0].pageY);
					now[0] = pos[0]; now[1] = pos[1];
				}
			}

			for (var j=0;j<now.length;j++) { earlier[j] = now[j]; };
			r.redraw();
			
		}, false);
		
		r.registerBinding(window, "touchend", function(e) {
			
			var capture = r.touchData.capture; if (!capture) { return; }; r.touchData.capture = false;
			e.preventDefault();
			var select = r.data.select;

			r.swipePanning = false;
			
			var cy = r.data.cy; 
			var nodes = r.getCachedNodes(); var edges = r.getCachedEdges();
			var now = r.touchData.now; var earlier = r.touchData.earlier;
			var start = r.touchData.start;

			if (e.touches[0]) { var pos = r.projectIntoViewport(e.touches[0].pageX, e.touches[0].pageY); now[0] = pos[0]; now[1] = pos[1]; }
			if (e.touches[1]) { var pos = r.projectIntoViewport(e.touches[1].pageX, e.touches[1].pageY); now[2] = pos[0]; now[3] = pos[1]; }
			if (e.touches[2]) { var pos = r.projectIntoViewport(e.touches[2].pageX, e.touches[2].pageY); now[4] = pos[0]; now[5] = pos[1]; }
			
			if( r.touchData.cxt ){
				ctxTapend = new $$.Event(e, {
					type: 'cxttapend',
					cyPosition: { x: now[0], y: now[1] }
				});

				if( start ){
					start.unactivate();
					start.trigger( ctxTapend );
				} else {
					cy.trigger( ctxTapend );
				}

				//console.log('cxttapend')

				if( !r.touchData.cxtDragged ){
					var ctxTap = new $$.Event(e, {
						type: 'cxttap',
						cyPosition: { x: now[0], y: now[1] }
					});

					if( start ){
						start.trigger( ctxTap );
					} else {
						cy.trigger( ctxTap );
					}

					//console.log('cxttap')
				}

				if( r.touchData.start ){ r.touchData.start._private.grabbed = false; }
				r.touchData.cxt = false;
				r.touchData.start = null;

				r.redraw();
				return;
			}

			var nowTime = +new Date;
			// no more box selection if we don't have three fingers
			if( !e.touches[2] && cy.boxSelectionEnabled() ){
				clearTimeout( this.threeFingerSelectTimeout );
				//this.threeFingerSelectTimeout = setTimeout(function(){
					var newlySelected = [];
					var box = r.getAllInBox(select[0], select[1], select[2], select[3]);

					select[0] = undefined;
					select[1] = undefined;
					select[2] = undefined;
					select[3] = undefined;
					select[4] = 0;

					r.data.canvasNeedsRedraw[CanvasRenderer.SELECT_BOX] = true;

					// console.log(box);
					var event = new $$.Event("select");
					for (var i=0;i<box.length;i++) { 
						if (box[i]._private.selectable) {
							newlySelected.push( box[i] );
						}
					}

					var newlySelCol = (new $$.Collection( cy, newlySelected ));

					if( cy.selectionType() === 'single' ){
						cy.$(':selected').unselect();
					}

					newlySelCol.select();
					
					if (box.length > 0) { 
						r.data.canvasNeedsRedraw[CanvasRenderer.NODE] = true; 
					}

				//}, 100);
			}

			if( !e.touches[1] ){
				r.pinching = false;
			}

			var updateStartStyle = false;

			if( start != null ){
				start._private.active = false;
				updateStartStyle = true;
				start.trigger("unactivate");
			}

			if (e.touches[2]) {
				r.data.bgActivePosistion = undefined;
				r.data.canvasNeedsRedraw[CanvasRenderer.SELECT_BOX] = true;
			} else if (e.touches[1]) {
				
			} else if (e.touches[0]) {
			
			// Last touch released
			} else if (!e.touches[0]) {
				
				r.data.bgActivePosistion = undefined;
				r.data.canvasNeedsRedraw[CanvasRenderer.SELECT_BOX] = true;

				if (start != null ) {

					if (start._private.grabbed == true) {
						start._private.grabbed = false;
						start.trigger("free");
						start._private.rscratch.inDragLayer = false;
					}
					
					var sEdges = start._private.edges;
					for (var j=0;j<sEdges.length;j++) { sEdges[j]._private.rscratch.inDragLayer = false; }
					updateAncestorsInDragLayer(start, false);
					
					if( start.selected() ){
						var selectedNodes = cy.$('node:selected');

						for( var k = 0; k < selectedNodes.length; k++ ){

							var selectedNode = selectedNodes[k];
							selectedNode._private.rscratch.inDragLayer = false;

							var sEdges = selectedNode._private.edges;
							for (var j=0; j<sEdges.length; j++) {
							  sEdges[j]._private.rscratch.inDragLayer = false;
							}

							updateAncestorsInDragLayer(selectedNode, false);
						}
					}

					r.data.canvasNeedsRedraw[CanvasRenderer.DRAG] = true; 
					r.data.canvasNeedsRedraw[CanvasRenderer.NODE] = true; 
					
					start
						.trigger(new $$.Event(e, {
							type: "touchend",
							cyPosition: { x: now[0], y: now[1] }
						}))
						.trigger(new $$.Event(e, {
							type: "tapend",
							cyPosition: { x: now[0], y: now[1] }
						}))
						.trigger(new $$.Event(e, {
							type: "vmouseup",
							cyPosition: { x: now[0], y: now[1] }
						}))
					;
					
					r.touchData.start = null;
					
				} else {
					var near = r.findNearestElement(now[0], now[1], true);
				
					if (near != null) { 
						near
							.trigger(new $$.Event(e, {
								type: "touchend",
								cyPosition: { x: now[0], y: now[1] }
							}))
							.trigger(new $$.Event(e, {
								type: "tapend",
								cyPosition: { x: now[0], y: now[1] }
							}))
							.trigger(new $$.Event(e, {
								type: "vmouseup",
								cyPosition: { x: now[0], y: now[1] }
							}))
						;
					}

					if (near == null) { 
						cy
							.trigger(new $$.Event(e, {
								type: "touchend",
								cyPosition: { x: now[0], y: now[1] }
							}))
							.trigger(new $$.Event(e, {
								type: "tapend",
								cyPosition: { x: now[0], y: now[1] }
							}))
							.trigger(new $$.Event(e, {
								type: "vmouseup",
								cyPosition: { x: now[0], y: now[1] }
							}))
						;
					}
				}
				
				// Prepare to select the currently touched node, only if it hasn't been dragged past a certain distance
				if (start != null 
						&& !r.dragData.didDrag // didn't drag nodes around
						&& start._private.selectable 
						&& (Math.sqrt(Math.pow(r.touchData.startPosition[0] - now[0], 2) + Math.pow(r.touchData.startPosition[1] - now[1], 2))) < 6) {

					if( cy.selectionType() === "single" ){
						cy.$(':selected').unselect();
						start.select();
					} else {
						if( start.selected() ){
							start.unselect();
						} else {
							start.select();
						}
					}

					updateStartStyle = true;

					
					r.data.canvasNeedsRedraw[CanvasRenderer.NODE] = true; 
				}
				
				// Tap event, roughly same as mouse click event for touch
				if (r.touchData.singleTouchMoved == false) {

					if (start) {
						start
							.trigger(new $$.Event(e, {
								type: "tap",
								cyPosition: { x: now[0], y: now[1] }
							}))
							.trigger(new $$.Event(e, {
								type: "vclick",
								cyPosition: { x: now[0], y: now[1] }
							}))
						;
					} else {
						cy
							.trigger(new $$.Event(e, {
								type: "tap",
								cyPosition: { x: now[0], y: now[1] }
							}))
							.trigger(new $$.Event(e, {
								type: "vclick",
								cyPosition: { x: now[0], y: now[1] }
							}))
						;
					}
					
//					console.log("tap");
				}
				
				r.touchData.singleTouchMoved = true;
			}
			
			for (var j=0;j<now.length;j++) { earlier[j] = now[j]; };

			r.dragData.didDrag = false; // reset for next mousedown

			if( updateStartStyle && start ){
				start.updateStyle(false);
			}

			r.redraw();
			
		}, false);
	};

})( cytoscape );