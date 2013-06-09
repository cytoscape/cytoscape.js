(function($$) {

	var isTouch = ('ontouchstart' in window) || window.DocumentTouch && document instanceof DocumentTouch;
	var time = function() { return Date.now(); } ; 
	var arrowShapes = {}; var nodeShapes = {}; 
	var rendFunc = CanvasRenderer.prototype;
	var panOrBoxSelectDelay = 400;

	// Canvas layer constants
	var CANVAS_LAYERS = 5, SELECT_BOX = 0, DRAG = 2, OVERLAY = 3, NODE = 4, BUFFER_COUNT = 2;
	
	function CanvasRenderer(options) {
		
		this.options = options;

		this.data = {
				
			select: [undefined, undefined, undefined, undefined, 0], // Coordinates for selection box, plus enabled flag 
			renderer: this, cy: options.cy, container: options.cy.container(),
			
			canvases: new Array(CANVAS_LAYERS),
			canvasRedrawReason: new Array(CANVAS_LAYERS),
			canvasNeedsRedraw: new Array(CANVAS_LAYERS),
			
			bufferCanvases: new Array(BUFFER_COUNT)

		};
		
		//--Pointer-related data
		this.hoverData = {down: null, last: null, 
				downTime: null, triggerMode: null, 
				dragging: false, 
				initialPan: [null, null], capture: false};
		
		this.timeoutData = {panTimeout: null};
		
		this.dragData = {possibleDragElements: []};
		
		this.touchData = {start: null, capture: false,
				// These 3 fields related to tap, taphold events
				startPosition: [null, null, null, null, null, null],
				singleTouchStartTime: null,
				singleTouchMoved: true,
				
				
				now: [null, null, null, null, null, null], 
				earlier: [null, null, null, null, null, null] };
		//--
		
		//--Wheel-related data 
		this.zoomData = {freeToZoom: false, lastPointerX: null};
		//--
		
		this.redraws = 0;

		this.bindings = [];
		
		this.init();
		
		for (var i = 0; i < CANVAS_LAYERS; i++) {
			this.data.canvases[i] = document.createElement("canvas");
			this.data.canvases[i].style.position = "absolute";
			this.data.canvases[i].setAttribute("data-id", "layer" + i);
			this.data.canvases[i].style.zIndex = String(CANVAS_LAYERS - i);
			this.data.container.appendChild(this.data.canvases[i]);
			
			this.data.canvasRedrawReason[i] = new Array();
			this.data.canvasNeedsRedraw[i] = false;
		}

		this.data.canvases[NODE].setAttribute("data-id", "layer" + NODE + '-node');
		this.data.canvases[SELECT_BOX].setAttribute("data-id", "layer" + SELECT_BOX + '-selectbox');
		this.data.canvases[DRAG].setAttribute("data-id", "layer" + DRAG + '-drag');
		this.data.canvases[OVERLAY].setAttribute("data-id", "layer" + OVERLAY + '-overlay');
		
		for (var i = 0; i < BUFFER_COUNT; i++) {
			this.data.bufferCanvases[i] = document.createElement("canvas");
			this.data.bufferCanvases[i].style.position = "absolute";
			this.data.bufferCanvases[i].setAttribute("data-id", "buffer" + i);
			this.data.bufferCanvases[i].style.zIndex = String(-i - 1);
			this.data.bufferCanvases[i].style.visibility = "visible";
			this.data.container.appendChild(this.data.bufferCanvases[i]);
		}

		var overlay = document.createElement('div');
		this.data.container.appendChild( overlay );
		this.data.overlay = overlay;
		overlay.style.position = 'absolute';
		overlay.style.zIndex = 1000;

		if( options.showOverlay ){

			var link = document.createElement('a');
			overlay.appendChild( link );
			this.data.link = link;

			link.innerHTML = 'cytoscape.js';
			link.style.font = '14px helvetica';
			link.style.position = 'absolute';
			link.style.right = 0;
			link.style.bottom = 0;
			link.style.padding = '1px 3px';
			link.style.paddingLeft = '5px';
			link.style.paddingTop = '5px';
			link.style.opacity = 0;
			link.style['-webkit-tap-highlight-color'] = 'transparent';
			link.style.background = 'red';

			link.href = 'http://cytoscape.github.io/cytoscape.js/';
			link.target = '_blank';

		}

		this.hideEdgesOnViewport = options.hideEdgesOnViewport;

		this.load();
	}

	CanvasRenderer.prototype.notify = function(params) {
		if ( params.type == "destroy" ){
			this.destroy();
			return;

		} else if (params.type == "add"
			|| params.type == "remove"
			|| params.type == "load"
		) {
			
			this.updateNodesCache();
			this.updateEdgesCache();
		}

		if (params.type == "viewport") {
			this.data.canvasNeedsRedraw[SELECT_BOX] = true;
			this.data.canvasRedrawReason[SELECT_BOX].push("viewchange");
		}
		
		this.data.canvasNeedsRedraw[DRAG] = true; this.data.canvasRedrawReason[DRAG].push("notify");
		this.data.canvasNeedsRedraw[NODE] = true; this.data.canvasRedrawReason[NODE].push("notify");

		this.redraws++;
		this.redraw();
	};

	CanvasRenderer.prototype.registerBinding = function(target, event, handler, useCapture){
		this.bindings.push({
			target: target,
			event: event,
			handler: handler,
			useCapture: useCapture
		});

		target.addEventListener(event, handler, useCapture);
	};

	CanvasRenderer.prototype.destroy = function(){
		this.destroyed = true;

		for( var i = 0; i < this.bindings.length; i++ ){
			var binding = this.bindings[i];
			var b = binding;

			b.target.removeEventListener(b.event, b.handler, b.useCapture);
		}
	};
	
	
	CanvasRenderer.prototype.png = function(){
		var data = this.data;

		// Rasterize the layers, but only if container has nonzero size
		if (this.data.container.clientHeight > 0
				&& this.data.container.clientWidth > 0) {
			
			context = data.bufferCanvases[1].getContext("2d");
			context.globalCompositeOperation = "copy";
			context.drawImage(data.canvases[4], 0, 0);
			context.globalCompositeOperation = "source-over";
			context.drawImage(data.canvases[2], 0, 0);
			context.drawImage(data.canvases[0], 0, 0);
			
			context = data.bufferCanvases[0].getContext("2d");
			context.globalCompositeOperation = "copy";
			context.drawImage(data.bufferCanvases[1], 0, 0);
		}

		var canvas = this.data.bufferCanvases[0];

		return canvas.toDataURL("image/png");
	};

	// @O Initialization functions
	{
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
				&& !node._private.locked
				&& node._private.grabbable) {
	
				return true;
			}
			
			return false;
		}

		// auto resize
		r.registerBinding(window, "resize", function(e) { 
			r.data.canvasNeedsRedraw[NODE] = true;
			r.data.canvasNeedsRedraw[OVERLAY] = true;
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
			var grabEvent = new $$.Event(e, {type: "grab"});

			// Right click button
			if( e.which == 3 ){

				if( near ){
					near.activate();
					near.trigger( new $$.Event(e, {type: "cxttapstart"}) );

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
							.trigger(new $$.Event(e, {type: "mousedown"}))
							.trigger(new $$.Event(e, {type: "tapstart"}))
							.trigger(new $$.Event(e, {type: "vmousedown"}))
						;
						
						// r.data.canvasNeedsRedraw[DRAG] = true; r.data.canvasRedrawReason[DRAG].push("Single node moved to drag layer"); 
						// r.data.canvasNeedsRedraw[NODE] = true; r.data.canvasRedrawReason[NODE].push("Single node moved to drag layer");
						
					} else if (near == null) {
						cy
							.trigger(new $$.Event(e, {type: "mousedown"}))
							.trigger(new $$.Event(e, {type: "tapstart"}))
							.trigger(new $$.Event(e, {type: "vmousedown"}))
						;
					}
					
					r.hoverData.down = near;
					r.hoverData.downTime = (new Date()).getTime();

				}
			
				// Selection box
				if ( near == null || near.isEdge() ) {
					select[4] = 1;
					var timeUntilActive = Math.max( 0, panOrBoxSelectDelay - (+new Date - r.hoverData.downTime) );

					clearTimeout( r.bgActiveTimeout );
					r.bgActiveTimeout = setTimeout(function(){
						if( near ){
							near.unactivate();
						}

						r.data.bgActivePosistion = {
							x: pos[0],
							y: pos[1]
						};

						r.data.canvasNeedsRedraw[SELECT_BOX] = true;
						r.data.canvasRedrawReason[SELECT_BOX].push("bgactive");

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
				var event = new $$.Event(e, {type: "mousemove"});
				
				if (near != null) {
					near.trigger(event);
					
				} else if (near == null) {
					cy.trigger(event);
				}

			}
			
			
			// trigger context drag if rmouse down
			if( r.hoverData.which === 3 ){
				var cxtEvt = new $$.Event(e, {type: "cxtdrag"});

				if( down ){
					down.trigger( cxtEvt );
				} else {
					cy.trigger( cxtEvt );
				}

				r.hoverData.cxtDragged = true;

			// Check if we are drag panning the entire graph
			} else if (r.hoverData.dragging) {
				preventDefault = true;

				if( cy.panningEnabled() ){
					var deltaP = {x: disp[0] * cy.zoom(), y: disp[1] * cy.zoom()};

					cy.panBy( deltaP );
				}
				
				// Needs reproject due to pan changing viewport
				pos = r.projectIntoViewport(e.pageX, e.pageY);

			// Checks primary button down & out of time & mouse not moved much
			} else if (select[4] == 1 && (down == null || down.isEdge())
					&& ( !cy.boxSelectionEnabled() || +new Date - r.hoverData.downTime >= panOrBoxSelectDelay )
					&& (Math.abs(select[3] - select[1]) + Math.abs(select[2] - select[0]) < 4)
					&& cy.panningEnabled() ) {
				
				r.hoverData.dragging = true;
				select[4] = 0;

			} else {
				// deactivate bg on box selection
				if (cy.boxSelectionEnabled() && Math.pow(select[2] - select[0], 2) + Math.pow(select[3] - select[1], 2) > 7 && select[4]){
					clearTimeout( r.bgActiveTimeout );
				}
				
				if( down && down.isEdge() && down.active() ){ down.unactivate(); }

				if (near != last) {
					
					if (last) { last.trigger(new $$.Event(e, {type: "mouseout"})); }
					if (near) { near.trigger(new $$.Event(e, {type: "mouseover"})); }
					
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
						.trigger( new $$.Event(e, {type: "drag"}) )
						.trigger( new $$.Event(e, {type: "position"}) )
					;

					if (select[2] == select[0] && select[3] == select[1]) {
						r.data.canvasNeedsRedraw[NODE] = true;
						r.data.canvasRedrawReason[NODE].push("Node(s) and edge(s) moved to drag layer");
					}
					
					r.data.canvasNeedsRedraw[DRAG] = true;
					r.data.canvasRedrawReason[DRAG].push("Nodes dragged");
				}
				
				if( cy.boxSelectionEnabled() ){
					r.data.canvasNeedsRedraw[SELECT_BOX] = true;
					r.data.canvasRedrawReason[SELECT_BOX].push("Mouse moved, redraw selection box");
				}

				// prevent the dragging from triggering text selection on the page
				preventDefault = true;
			}
			
			select[2] = pos[0]; select[3] = pos[1];
			
			r.redraw();
			
			if( preventDefault ){ 
				if(e.stopPropagation) e.stopPropagation();
    			if(e.preventDefault) e.preventDefault();
   				e.cancelBubble=true;
    			e.returnValue=false;
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
				var cxtEvt = new $$.Event(e, {type: "cxttapend"});

				if( down ){
					down.trigger( cxtEvt );
				} else {
					cy.trigger( cxtEvt );
				}

				if( !r.hoverData.cxtDragged ){
					var cxtTap = new $$.Event(e, {type: "cxttap"});

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
						r.data.canvasNeedsRedraw[NODE] = true; r.data.canvasRedrawReason[NODE].push("De-select");
					}
					
					r.dragData.possibleDragElements = draggedElements = [];
				}
				
				// Click event
				{
					// console.log('trigger click et al');

					if (Math.pow(select[2] - select[0], 2) + Math.pow(select[3] - select[1], 2) == 0) {
						if (near != null) {
							near
								.trigger( new $$.Event(e, {type: "click"}) )
								.trigger( new $$.Event(e, {type: "tap"}) )
								.trigger( new $$.Event(e, {type: "vclick"}) )
							;
						} else if (near == null) {
							cy
								.trigger( new $$.Event(e, {type: "click"}) )
								.trigger( new $$.Event(e, {type: "tap"}) )
								.trigger( new $$.Event(e, {type: "vclick"}) )
							;
						}
					}
				}
				
				// Mouseup event
				{
					// console.log('trigger mouseup et al');

					if (near != null) {
						near
							.trigger(new $$.Event(e, {type: "mouseup"}))
							.trigger(new $$.Event(e, {type: "tapend"}))
							.trigger(new $$.Event(e, {type: "vmouseup"}))
						;
					} else if (near == null) {
						cy
							.trigger(new $$.Event(e, {type: "mouseup"}))
							.trigger(new $$.Event(e, {type: "tapend"}))
							.trigger(new $$.Event(e, {type: "vmouseup"}))
						;
					}
				}
				
				// Single selection
				if (near == down && !r.dragData.didDrag) {
					if (near != null && near._private.selectable) {
						
						// console.log('single selection')

						if( !shiftDown ){
							cy.$(':selected').unselect();
						}

						if( near.selected() ){
							near.unselect();
						} else {
							near.select();
						}

						updateAncestorsInDragLayer(near, false);
						
						r.data.canvasNeedsRedraw[NODE] = true; r.data.canvasRedrawReason[NODE].push("sglslct");
						
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

						var freeEvent = new $$.Event(e, {type: "free"});
						grabbedEles.trigger(freeEvent);
					}
				}
				
				if ( cy.boxSelectionEnabled() &&  Math.pow(select[2] - select[0], 2) + Math.pow(select[3] - select[1], 2) > 7 && select[4] ) {
					// console.log("box selection");
					
					if( !shiftDown ){
						cy.$(':selected').unselect();
					}

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

					(new $$.Collection( cy, newlySelected )).select();
					
					if (box.length > 0) { 
						r.data.canvasNeedsRedraw[NODE] = true; r.data.canvasRedrawReason[NODE].push("Selection");
					}
				}
				
				// Cancel drag pan
				r.hoverData.dragging = false;
				
				if (!select[4]) {
					// console.log('free at end', draggedElements)
					var freeEvent = new $$.Event(e, {type: "free"}); 
					
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

					if( down){ down.trigger(freeEvent); }

	//				draggedElements = r.dragData.possibleDragElements = [];
					r.data.canvasNeedsRedraw[DRAG] = true; r.data.canvasRedrawReason[DRAG].push("Node/nodes back from drag");
					r.data.canvasNeedsRedraw[NODE] = true; r.data.canvasRedrawReason[NODE].push("Node/nodes back from drag");
				}
			
			} // else not right mouse

			select[4] = 0; r.hoverData.down = null;
			
			r.data.canvasNeedsRedraw[SELECT_BOX] = true; r.data.canvasRedrawReason[SELECT_BOX].push("Mouse up, selection box gone");
			
//			console.log("mu", pos[0], pos[1]);
//			console.log("ss", select);
			
			r.dragData.didDrag = false;

			r.redraw();
			
		}, false);
		
		var wheelHandler = function(e) {
			var cy = r.data.cy; var pos = r.projectIntoViewport(e.pageX, e.pageY);
			
			var unpos = [pos[0] * cy.zoom() + cy.pan().x,
			              pos[1] * cy.zoom() + cy.pan().y];
			
			if (r.zoomData.freeToZoom) {
				e.preventDefault();
				
				var diff = e.wheelDeltaY / 1000 || e.detail / -32;
				
				if( cy.panningEnabled() && cy.zoomingEnabled() ){
					cy.zoom({level: cy.zoom() * Math.pow(10, diff), position: {x: unpos[0], y: unpos[1]}});
				}

				r.data.wheel = true;
				clearTimeout(r.data.wheelTimeout);
				r.data.wheelTimeout = setTimeout(function(){
					r.data.wheel = false;
					r.data.canvasNeedsRedraw[NODE] = true;
					r.redraw();
				}, 100);
			}

		}
		
		// Functions to help with whether mouse wheel should trigger zooming
		// --
		r.registerBinding(r.data.container, "mousewheel", wheelHandler, true);
		r.registerBinding(r.data.container, "DOMMouseScroll", wheelHandler, true);
		r.registerBinding(r.data.container, "MozMousePixelScroll", function(e){
			if (r.zoomData.freeToZoom) {
				e.preventDefault();
			}
		}, false);
		
		r.registerBinding(r.data.container, "mousemove", function(e) { 
			if (r.zoomData.lastPointerX && r.zoomData.lastPointerX != e.pageX && !r.zoomData.freeToZoom) 
				{ r.zoomData.freeToZoom = true; } r.zoomData.lastPointerX = e.pageX; 
		}, false);
		
		r.registerBinding(r.data.container, "mouseout", function(e) { 
			r.zoomData.freeToZoom = false; r.zoomData.lastPointerX = null 
		}, false);
		// --
		
		// Functions to help with handling mouseout/mouseover on the Cytoscape container
					// Handle mouseout on Cytoscape container
		r.registerBinding(r.data.container, "mouseout", function(e) { 
			r.data.cy.trigger(new $$.Event(e, {type: "mouseout"}));
		}, false);
		
		r.registerBinding(r.data.container, "mouseover", function(e) { 
			r.data.cy.trigger(new $$.Event(e, {type: "mouseover"}));
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
					var cxtEvt = new $$.Event(e, {type: "cxttapstart"});

					//console.log(distance1)

					if( near1 && near1.isNode() ){
						near1.activate().trigger( cxtEvt );
						r.touchData.start = near1;
					
					} else if( near2 && near2.isNode() ){
						near2.activate().trigger( cxtEvt );
						r.touchData.start = near2;
					
					} else {
						cy.trigger( cxtEvt );
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
						near.trigger(new $$.Event(e, {type: "grab"}));

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
						.trigger(new $$.Event(e, {type: "touchstart"}))
						.trigger(new $$.Event(e, {type: "tapstart"}))
						.trigger(new $$.Event(e, {type: "vmousdown"}))
					;
				} if (near == null) {
					cy
						.trigger(new $$.Event(e, {type: "touchstart"}))
						.trigger(new $$.Event(e, {type: "tapstart"}))
						.trigger(new $$.Event(e, {type: "vmousedown"}))
					;

					r.data.bgActivePosistion = {
						x: pos[0],
						y: pos[1]
					};

					r.data.canvasNeedsRedraw[SELECT_BOX] = true;
					r.data.canvasRedrawReason[SELECT_BOX].push("bgactive");

				}
				
				
				// Tap, taphold
				// -----
				
				for (var i=0;i<now.length;i++) {
					earlier[i] = now[i];
					r.touchData.startPosition[i] = now[i];
				};
				
				r.touchData.singleTouchMoved = false;
				r.touchData.singleTouchStartTime = time();
				
				var tapHoldTimeout = setTimeout(function() {
					if (r.touchData.singleTouchMoved == false
							// This time double constraint prevents multiple quick taps
							// followed by a taphold triggering multiple taphold events
							&& time() - r.touchData.singleTouchStartTime > 250) {
						if (r.touchData.start) {
							r.touchData.start.trigger(new $$.Event(e, {type: "taphold"}));
						} else {
							r.data.cy.trigger(new $$.Event(e, {type: "taphold"}));

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
					r.data.canvasNeedsRedraw[SELECT_BOX] = true;

					var cxtEvt = new $$.Event(e, {type: "cxttapend"});
					if( r.touchData.start ){
						r.touchData.start.trigger( cxtEvt );
					} else {
						cy.trigger( cxtEvt );
					}
				}

			}  

			if( capture && r.touchData.cxt ){
				var cxtEvt = new $$.Event(e, {type: "cxtdrag"});
				r.data.bgActivePosistion = undefined;
				r.data.canvasNeedsRedraw[SELECT_BOX] = true;

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

				r.data.canvasNeedsRedraw[SELECT_BOX] = true;
				r.data.canvasRedrawReason[SELECT_BOX].push("Touch moved, redraw selection box");

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

			} else if ( capture && e.touches[1] && cy.zoomingEnabled() && cy.panningEnabled() ) { // two fingers => pinch to zoom
				r.data.bgActivePosistion = undefined;
				r.data.canvasNeedsRedraw[SELECT_BOX] = true;

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
						.trigger( new $$.Event(e, {type: "drag"}) )
						.trigger( new $$.Event(e, {type: "position"}) )
					;
					
					r.data.canvasNeedsRedraw[DRAG] = true;
					r.data.canvasRedrawReason[DRAG].push("touchdrag node");

					if (r.touchData.startPosition[0] == earlier[0]
						&& r.touchData.startPosition[1] == earlier[1]) {
						
						r.data.canvasNeedsRedraw[NODE] = true;
						r.data.canvasRedrawReason[NODE].push("node drag started");
					}
					
				}
				
				// Touchmove event
				{
					if (start != null) { start.trigger(new $$.Event(e, {type: "touchmove"})); }
					
					if (start == null) { 
						var near = r.findNearestElement(now[0], now[1], true);
						if (near != null) { near.trigger(new $$.Event(e, {type: "touchmove"})); }
						if (near == null) {   cy.trigger(new $$.Event(e, {type: "touchmove"})); }
					}

					if (near != last) {
						if (last) { last.trigger(new $$.Event(e, {type: "touchout"})); }
						if (near) { near.trigger(new $$.Event(e, {type: "touchover"})); }
					}

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
				
				if ( capture && (start == null || start.isEdge()) && cy.panningEnabled() ) {
					if( start ){
						start.unactivate();

						if( !r.data.bgActivePosistion ){
							r.data.bgActivePosistion = {
								x: now[0],
								y: now[1]
							};
						}

						r.data.canvasNeedsRedraw[SELECT_BOX] = true;
						r.data.canvasRedrawReason[SELECT_BOX].push("bgactive");
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
				ctxTapend = new $$.Event(e, { type: 'cxttapend' });

				if( start ){
					start.unactivate();
					start.trigger( ctxTapend );
				} else {
					cy.trigger( ctxTapend );
				}

				//console.log('cxttapend')

				if( !r.touchData.cxtDragged ){
					var ctxTap = new $$.Event(e, { type: 'cxttap' });

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
				this.threeFingerSelectTimeout = setTimeout(function(){
					var newlySelected = [];
					var box = r.getAllInBox(select[0], select[1], select[2], select[3]);

					select[0] = undefined;
					select[1] = undefined;
					select[2] = undefined;
					select[3] = undefined;
					select[4] = 0;

					r.data.canvasNeedsRedraw[SELECT_BOX] = true;
					r.data.canvasRedrawReason[SELECT_BOX].push("Touch moved, redraw selection box");

					// console.log(box);
					var event = new $$.Event(e, {type: "select"});
					for (var i=0;i<box.length;i++) { 
						if (box[i]._private.selectable) {
							newlySelected.push( box[i] );
						}
					}

					(new $$.Collection( cy, newlySelected )).select();
					
					if (box.length > 0) { 
						r.data.canvasNeedsRedraw[NODE] = true; r.data.canvasRedrawReason[NODE].push("Selection");
					}

				}, 100);
			}

			if( !e.touches[1] ){
				r.pinching = false;
			}

			var updateStartStyle = false;

			if( start != null ){
				start._private.active = false;
				updateStartStyle = true;
				start.trigger( new $$.Event(e, {type: "unactivate"}) );
			}

			if (e.touches[2]) {
				r.data.bgActivePosistion = undefined;
			} else if (e.touches[1]) {
				
			} else if (e.touches[0]) {
			
			// Last touch released
			} else if (!e.touches[0]) {
				
				r.data.bgActivePosistion = undefined;

				if (start != null ) {

					if (start._private.grabbed == true) {
						start._private.grabbed = false;
						start.trigger(new $$.Event(e, {type: "free"}));
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

					r.data.canvasNeedsRedraw[DRAG] = true; r.data.canvasRedrawReason[DRAG].push("touchdrag node end");
					r.data.canvasNeedsRedraw[NODE] = true; r.data.canvasRedrawReason[NODE].push("touchdrag node end");
					
					start
						.trigger(new $$.Event(e, {type: "touchend"}))
						.trigger(new $$.Event(e, {type: "tapend"}))
						.trigger(new $$.Event(e, {type: "vmouseup"}))
					;
					
					r.touchData.start = null;
					
				} else {
					var near = r.findNearestElement(now[0], now[1], true);
				
					if (near != null) { 
						near
							.trigger(new $$.Event(e, {type: "touchend"}))
							.trigger(new $$.Event(e, {type: "tapend"}))
							.trigger(new $$.Event(e, {type: "vmouseup"}))
						;
					}

					if (near == null) { 
						cy
							.trigger(new $$.Event(e, {type: "touchend"}))
							.trigger(new $$.Event(e, {type: "tapend"}))
							.trigger(new $$.Event(e, {type: "vmouseup"}))
						;
					}
				}
				
				// Prepare to select the currently touched node, only if it hasn't been dragged past a certain distance
				if (start != null 
						&& !r.dragData.didDrag // didn't drag nodes around
						&& start._private.selectable 
						&& (Math.sqrt(Math.pow(r.touchData.startPosition[0] - now[0], 2) + Math.pow(r.touchData.startPosition[1] - now[1], 2))) < 6) {

					if( start.selected() ){
						start._private.selected = false;
						start.trigger( new $$.Event(e, {type: "unselect"}) );
					} else {
						start._private.selected = true;
						start.trigger( new $$.Event(e, {type: "select"}) );
					}

					updateStartStyle = true;

					
					r.data.canvasNeedsRedraw[NODE] = true; r.data.canvasRedrawReason[NODE].push("sglslct");
				}
				
				// Tap event, roughly same as mouse click event for touch
				if (r.touchData.singleTouchMoved == false) {

					if (start) {
						start
							.trigger(new $$.Event(e, {type: "tap"}))
							.trigger(new $$.Event(e, {type: "vclick"}))
						;
					} else {
						cy
							.trigger(new $$.Event(e, {type: "tap"}))
							.trigger(new $$.Event(e, {type: "vclick"}))
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
	
	CanvasRenderer.prototype.init = function() { };
	}
	
	// @O Caching functions
	{
	CanvasRenderer.prototype.getCachedNodes = function() {
		var data = this.data; var cy = this.data.cy;
		
		if (data.cache == undefined) {
			data.cache = {};
		}
		
		if (data.cache.cachedNodes == undefined) {
			data.cache.cachedNodes = cy.nodes();
		}
		
		return data.cache.cachedNodes;
	}
	
	CanvasRenderer.prototype.updateNodesCache = function() {
		var data = this.data; var cy = this.data.cy;
		
		if (data.cache == undefined) {
			data.cache = {};
		}
		
		data.cache.cachedNodes = cy.nodes();
	}
	
	CanvasRenderer.prototype.getCachedEdges = function() {
		var data = this.data; var cy = this.data.cy;
		
		if (data.cache == undefined) {
			data.cache = {};
		}
		
		if (data.cache.cachedEdges == undefined) {
			data.cache.cachedEdges = cy.edges();
		}
		
		return data.cache.cachedEdges;
	}
	
	CanvasRenderer.prototype.updateEdgesCache = function() {
		var data = this.data; var cy = this.data.cy;
		
		if (data.cache == undefined) {
			data.cache = {};
		}
		
		data.cache.cachedEdges = cy.edges();
	}
	}
	
	// @O High-level collision application functions

	// Project mouse
	CanvasRenderer.prototype.projectIntoViewport = function(pageX, pageY) {
		
		n = this.data.container;
		
		// Stop checking scroll past the level of the DOM tree containing document.body. At this point, scroll values do not have the same impact on pageX/pageY.
		var stopCheckingScroll = false;
		
		var offsets = this.findContainerPageCoords();
		var offsetLeft = offsets[0];
		var offsetTop = offsets[1];
		
//		console.log("calce");
		
		// By here, offsetLeft and offsetTop represent the "pageX/pageY" of the top-left corner of the div. So, do subtraction to find relative position.
		x = pageX - offsetLeft; y = pageY - offsetTop;
		
		x -= this.data.cy.pan().x; y -= this.data.cy.pan().y; x /= this.data.cy.zoom(); y /= this.data.cy.zoom();
		return [x, y];
	}
	
	CanvasRenderer.prototype.findContainerPageCoords = function() {
		var x, y; var offsetLeft = 0; var offsetTop = 0; var n; n = this.data.container;
		
		// Stop checking scroll past the level of the DOM tree containing document.body. At this point, scroll values do not have the same impact on pageX/pageY.
		var stopCheckingScroll = false;
		
		while (n != null) {
			var style = window.getComputedStyle(n); 
			if( style.getPropertyValue('position').toLowerCase() === 'fixed' ){
				offsetLeft = n.offsetLeft + window.scrollX;
				offsetTop = n.offsetTop + window.scrollY;
				n = null; // don't want to check any more parents after position:fixed
			

			} else if (typeof(n.offsetLeft) == "number") {
				// The idea is to add offsetLeft/offsetTop, subtract scrollLeft/scrollTop, ignoring scroll values for elements in DOM tree levels 2 and higher.
				offsetLeft += n.offsetLeft; offsetTop += n.offsetTop;
				
				if (n == document.body || n == document.header) { stopCheckingScroll = true; }
				if (!stopCheckingScroll) { offsetLeft -= n.scrollLeft; offsetTop -= n.scrollTop; }
			}

			if( n ){ n = n.offsetParent };
		}
		
		// By here, offsetLeft and offsetTop represent the "pageX/pageY" of the top-left corner of the div.
		return [offsetLeft, offsetTop];
	}
	
	// Find nearest element
	CanvasRenderer.prototype.findNearestElement = function(x, y, visibleElementsOnly) {
		var data = this.data; var nodes = this.getCachedNodes(); var edges = this.getCachedEdges(); var near = [];
		
		var zoom = this.data.cy.zoom();
		var edgeThreshold = (isTouch ? 256 : 32) / zoom;
		var nodeThreshold = (isTouch ? 16 : 0) /  zoom;
		
		// Check nodes
		for (var i = 0; i < nodes.length; i++) {
			if (nodeShapes[this.getNodeShape(nodes[i])].checkPointRough(x, y,
					nodes[i]._private.style["border-width"].value,
					//nodes[i]._private.style["width"].value, nodes[i]._private.style["height"].value,
					this.getNodeWidth(nodes[i]) + nodeThreshold, this.getNodeHeight(nodes[i]) + nodeThreshold,
					nodes[i]._private.position.x, nodes[i]._private.position.y)
				&&
				nodeShapes[this.getNodeShape(nodes[i])].checkPoint(x, y,
					nodes[i]._private.style["border-width"].value,
					//nodes[i]._private.style["width"].value / 2, nodes[i]._private.style["height"].value / 2,
					(this.getNodeWidth(nodes[i]) + nodeThreshold) / 2, (this.getNodeHeight(nodes[i]) + nodeThreshold) / 2,
					nodes[i]._private.position.x, nodes[i]._private.position.y)) {
				
				if (visibleElementsOnly) {
					if (nodes[i]._private.style["opacity"].value != 0
						&& nodes[i]._private.style["visibility"].value == "visible") {
						
						near.push(nodes[i]);	
					}
				} else {
					near.push(nodes[i]);
				}
			}
		}
		
		// Check edges
		var addCurrentEdge;
		for (var i = 0; i < edges.length; i++) {
			var edge = edges[i];
			var rs = edge._private.rscratch;

			addCurrentEdge = false;

			if (rs.edgeType == "self") {
				if ((this.inBezierVicinity(x, y,
						rs.startX,
						rs.startY,
						rs.cp2ax,
						rs.cp2ay,
						rs.selfEdgeMidX,
						rs.selfEdgeMidY,
						Math.pow(edge._private.style["width"].value/2, 2))
							&&
					(Math.pow(edges[i]._private.style["width"].value/2, 2) + edgeThreshold > 
						this.sqDistanceToQuadraticBezier(x, y,
							rs.startX,
							rs.startY,
							rs.cp2ax,
							rs.cp2ay,
							rs.selfEdgeMidX,
							rs.selfEdgeMidY)))
					||
					(this.inBezierVicinity(x, y,
						rs.selfEdgeMidX,
						rs.selfEdgeMidY,
						rs.cp2cx,
						rs.cp2cy,
						rs.endX,
						rs.endY,
						Math.pow(edges[i]._private.style["width"].value/2, 2))
							&&
					(Math.pow(edges[i]._private.style["width"].value/2, 2) + edgeThreshold > 
						this.sqDistanceToQuadraticBezier(x, y,
							rs.selfEdgeMidX,
							rs.selfEdgeMidY,
							rs.cp2cx,
							rs.cp2cy,
							rs.endX,
							rs.endY))))
					 { addCurrentEdge = true; }
			
			} else if (rs.edgeType == "straight") {
				if (this.inLineVicinity(x, y, rs.startX, rs.startY, rs.endX, rs.endY, edges[i]._private.style["width"].value * 2)
						&&
					Math.pow(edges[i]._private.style["width"].value / 2, 2) + edgeThreshold >
					this.sqDistanceToFiniteLine(x, y,
						rs.startX,
						rs.startY,
						rs.endX,
						rs.endY))
					{ addCurrentEdge = true; }
			
			} else if (rs.edgeType == "bezier") {
				if (this.inBezierVicinity(x, y,
					rs.startX,
					rs.startY,
					rs.cp2x,
					rs.cp2y,
					rs.endX,
					rs.endY,
					Math.pow(edges[i]._private.style["width"].value / 2, 2))
						&&
					(Math.pow(edges[i]._private.style["width"].value / 2 , 2) + edgeThreshold >
						this.sqDistanceToQuadraticBezier(x, y,
							rs.startX,
							rs.startY,
							rs.cp2x,
							rs.cp2y,
							rs.endX,
							rs.endY)))
					{ addCurrentEdge = true; }
			}
			
			if (!near.length || near[near.length - 1] != edges[i]) {
				if ((arrowShapes[edges[i]._private.style["source-arrow-shape"].value].roughCollide(x, y,
						edges[i]._private.rscratch.arrowStartX, edges[i]._private.rscratch.arrowStartY,
						this.getArrowWidth(edges[i]._private.style["width"].value),
						this.getArrowHeight(edges[i]._private.style["width"].value),
						[edges[i]._private.rscratch.arrowStartX - edges[i].source()[0]._private.position.x,
							edges[i]._private.rscratch.arrowStartY - edges[i].source()[0]._private.position.y], 0)
						&&
					arrowShapes[edges[i]._private.style["source-arrow-shape"].value].collide(x, y,
						edges[i]._private.rscratch.arrowStartX, edges[i]._private.rscratch.arrowStartY,
						this.getArrowWidth(edges[i]._private.style["width"].value),
						this.getArrowHeight(edges[i]._private.style["width"].value),
						[edges[i]._private.rscratch.arrowStartX - edges[i].source()[0]._private.position.x,
							edges[i]._private.rscratch.arrowStartY - edges[i].source()[0]._private.position.y], 0))
					||
					(arrowShapes[edges[i]._private.style["target-arrow-shape"].value].roughCollide(x, y,
						edges[i]._private.rscratch.arrowEndX, edges[i]._private.rscratch.arrowEndY,
						this.getArrowWidth(edges[i]._private.style["width"].value),
						this.getArrowHeight(edges[i]._private.style["width"].value),
						[edges[i]._private.rscratch.arrowEndX - edges[i].target()[0]._private.position.x,
							edges[i]._private.rscratch.arrowEndY - edges[i].target()[0]._private.position.y], 0)
						&&
					arrowShapes[edges[i]._private.style["target-arrow-shape"].value].collide(x, y,
						edges[i]._private.rscratch.arrowEndX, edges[i]._private.rscratch.arrowEndY,
						this.getArrowWidth(edges[i]._private.style["width"].value),
						this.getArrowHeight(edges[i]._private.style["width"].value),
						[edges[i]._private.rscratch.arrowEndX - edges[i].target()[0]._private.position.x,
							edges[i]._private.rscratch.arrowEndY - edges[i].target()[0]._private.position.y], 0)))
					{ addCurrentEdge = true; }
			}
			
			if (addCurrentEdge) {
				if (visibleElementsOnly) {
					// For edges, make sure the edge is visible/has nonzero opacity,
					// then also make sure both source and target nodes are visible/have
					// nonzero opacity
					var source = data.cy.getElementById(edges[i]._private.data.source)
					var target = data.cy.getElementById(edges[i]._private.data.target)
					
					if (edges[i]._private.style["opacity"].value != 0
						&& edges[i]._private.style["visibility"].value == "visible"
						&& source._private.style["opacity"].value != 0
						&& source._private.style["visibility"].value == "visible"
						&& target._private.style["opacity"].value != 0
						&& target._private.style["visibility"].value == "visible") {
						
						near.push(edges[i]);	
					}
				} else {
					near.push(edges[i]);
				}
			}
		} 
		
		near.sort( zOrderSort );
		
		if (near.length > 0) { return near[ near.length - 1 ]; } else { return null; }
	}
	
	// "Give me everything from this box"
	CanvasRenderer.prototype.getAllInBox = function(x1, y1, x2, y2) {
		var data = this.data; var nodes = this.getCachedNodes(); var edges = this.getCachedEdges(); var box = [];
		
		var x1c = Math.min(x1, x2); var x2c = Math.max(x1, x2); var y1c = Math.min(y1, y2); var y2c = Math.max(y1, y2); x1 = x1c; x2 = x2c; y1 = y1c; y2 = y2c; var heur;
		
		for (var i=0;i<nodes.length;i++) {
			if (nodeShapes[this.getNodeShape(nodes[i])].intersectBox(x1, y1, x2, y2,
				//nodes[i]._private.style["width"].value, nodes[i]._private.style["height"].value,
				this.getNodeWidth(nodes[i]), this.getNodeHeight(nodes[i]),
				nodes[i]._private.position.x, nodes[i]._private.position.y, nodes[i]._private.style["border-width"].value / 2))
			{ box.push(nodes[i]); }
		}
		
		for (var i=0;i<edges.length;i++) {
			if (edges[i]._private.rscratch.edgeType == "self") {
				if ((heur = this.boxInBezierVicinity(x1, y1, x2, y2,
						edges[i]._private.rscratch.startX, edges[i]._private.rscratch.startY,
						edges[i]._private.rscratch.cp2ax, edges[i]._private.rscratch.cp2ay,
						edges[i]._private.rscratch.endX, edges[i]._private.rscratch.endY, edges[i]._private.style["width"].value))
							&&
						(heur == 2 || (heur == 1 && this.checkBezierInBox(x1, y1, x2, y2,
							edges[i]._private.rscratch.startX, edges[i]._private.rscratch.startY,
							edges[i]._private.rscratch.cp2ax, edges[i]._private.rscratch.cp2ay,
							edges[i]._private.rscratch.endX, edges[i]._private.rscratch.endY, edges[i]._private.style["width"].value)))
								||
					(heur = this.boxInBezierVicinity(x1, y1, x2, y2,
						edges[i]._private.rscratch.startX, edges[i]._private.rscratch.startY,
						edges[i]._private.rscratch.cp2cx, edges[i]._private.rscratch.cp2cy,
						edges[i]._private.rscratch.endX, edges[i]._private.rscratch.endY, edges[i]._private.style["width"].value))
							&&
						(heur == 2 || (heur == 1 && this.checkBezierInBox(x1, y1, x2, y2,
							edges[i]._private.rscratch.startX, edges[i]._private.rscratch.startY,
							edges[i]._private.rscratch.cp2cx, edges[i]._private.rscratch.cp2cy,
							edges[i]._private.rscratch.endX, edges[i]._private.rscratch.endY, edges[i]._private.style["width"].value)))
					)
				{ box.push(edges[i]); }
			}
			
			if (edges[i]._private.rscratch.edgeType == "bezier" &&
				(heur = this.boxInBezierVicinity(x1, y1, x2, y2,
						edges[i]._private.rscratch.startX, edges[i]._private.rscratch.startY,
						edges[i]._private.rscratch.cp2x, edges[i]._private.rscratch.cp2y,
						edges[i]._private.rscratch.endX, edges[i]._private.rscratch.endY, edges[i]._private.style["width"].value))
							&&
						(heur == 2 || (heur == 1 && this.checkBezierInBox(x1, y1, x2, y2,
							edges[i]._private.rscratch.startX, edges[i]._private.rscratch.startY,
							edges[i]._private.rscratch.cp2x, edges[i]._private.rscratch.cp2y,
							edges[i]._private.rscratch.endX, edges[i]._private.rscratch.endY, edges[i]._private.style["width"].value))))
				{ box.push(edges[i]); }
		
			if (edges[i]._private.rscratch.edgeType == "straight" &&
				(heur = this.boxInBezierVicinity(x1, y1, x2, y2,
						edges[i]._private.rscratch.startX, edges[i]._private.rscratch.startY,
						edges[i]._private.rscratch.startX * 0.5 + edges[i]._private.rscratch.endX * 0.5, 
						edges[i]._private.rscratch.startY * 0.5 + edges[i]._private.rscratch.endY * 0.5, 
						edges[i]._private.rscratch.endX, edges[i]._private.rscratch.endY, edges[i]._private.style["width"].value))
							&& /* console.log("test", heur) == undefined && */
						(heur == 2 || (heur == 1 && this.checkStraightEdgeInBox(x1, y1, x2, y2,
							edges[i]._private.rscratch.startX, edges[i]._private.rscratch.startY,
							edges[i]._private.rscratch.endX, edges[i]._private.rscratch.endY, edges[i]._private.style["width"].value))))
				{ box.push(edges[i]); }
			
		}
		
		return box;
	}

	/**
	 * Updates bounds of all compounds in the given element list.
	 * Assuming the nodes are sorted top down, i.e. a parent node
	 * always has a lower index than its all children.
	 *
	 * @param elements  set of elements containing both nodes and edges
	 */
	CanvasRenderer.prototype.updateAllCompounds = function(elements)
	{
		// traverse in reverse order, since rendering is top-down,
		// but we need to calculate bounds bottom-up
		for(var i = elements.length - 1; i >= 0; i--)
		{
			if (elements[i].isNode() &&
			    (elements[i]._private.style["width"].value == "auto" ||
			     elements[i]._private.style["height"].value == "auto") &&
			    elements[i].children().length > 0)
			{
				var node = elements[i];
				var bounds = this.calcCompoundBounds(node);

				//console.log("%s : %o", node._private.data.id, bounds);
				node._private.position.x = bounds.x;
				node._private.position.y = bounds.y;
				node._private.autoWidth = bounds.width;
				node._private.autoHeight = bounds.height;
			}
		}

	};

	/**
	 * Calculates rectangular bounds of a given compound node.
	 * If the node is hidden, or none of its children is visible,
	 * then instead of calculating the bounds, returns the last
	 * calculated value.
	 *
	 * @param node  a node with children (compound node)
	 * @return {{x: number, y: number, width: number, height: number}}
	 */
	CanvasRenderer.prototype.calcCompoundBounds = function(node)
	{
		// TODO assuming rectangular compounds, we may add support for other shapes in the future

		// this selection doesn't work if parent is invisible
		//var children = node.children(":visible").not(":removed");

		// consider only not removed children
		var children = node.descendants().not(":removed");

		// TODO instead of last calculated width & height define a default compound node size?
		// last calculated bounds
		var bounds = {x: node._private.position.x,
			y: node._private.position.y,
			width: node._private.autoWidth,
			height: node._private.autoHeight};

		// check node visibility
		if (node._private.style["visibility"].value != "visible")
		{
			// do not calculate bounds for invisible compounds,
			// just return last calculated values
			return bounds;
		}

		var visibleChildren = [];

		// find out visible children
		for (var i=0; i < children.size(); i++)
		{
			if (children[i]._private.style["visibility"].value == "visible")
			{
				visibleChildren.push(children[i]);
			}
		}

		if (visibleChildren.length == 0)
		{
			// no visible children, just return last calculated values
			return bounds;
		}

		// process only visible children
		children = visibleChildren;

		// find the leftmost, rightmost, topmost, and bottommost child node positions
		var leftBorder = this.borderValue(children, "left");
		var rightBorder = this.borderValue(children, "right");
		var topBorder = this.borderValue(children, "top");
		var bottomBorder = this.borderValue(children, "bottom");

		// take padding values into account in addition to border values
		var padding = this.getNodePadding(node);
		var x = (leftBorder - padding.left + rightBorder + padding.right) / 2;
		var y = (topBorder - padding.top + bottomBorder + padding.bottom) / 2;
		var width = (rightBorder - leftBorder) + padding.left + padding.right;
		var height = (bottomBorder - topBorder) + padding.top + padding.bottom;

		// it is not possible to use the function boundingBox() before
		// actually rendering the graph
//		var bBox = children.boundingBox();
//
//		var x = (bBox.x1 + bBox.x2) / 2;
//		var y = (bBox.y1 + bBox.y2) / 2;
//		var width = bBox.width;
//		var height = bBox.height;

		bounds = {x: x,
			y: y,
			width: width,
			height: height};

		return bounds;
	};

	/**
	 * Calculates the leftmost, rightmost, topmost or bottommost point for the given
	 * set of nodes. If the type parameter is "left" (or "right"), then the min (or
	 * the max) x-coordinate value will be returned. If the type is "top" (or "bottom")
	 * then the min (or the max) y-coordinate value will be returned.
	 *
	 * This function is designed to help determining the bounds (bounding box) of
	 * compound nodes.
	 *
	 * @param nodes         set of nodes
	 * @param type          "left", "right", "top", "bottom"
	 * @return {number}     border value for the specified type
	 */
	CanvasRenderer.prototype.borderValue = function(nodes, type)
	{
		var nodeVals, labelVals;
		var minValue = 1/0, maxValue = -1/0;
		var r = this;

		// helper function to determine node position and dimensions
		var calcNodePosAndDim = function(node) {
			var values = {};

			values.x = node._private.position.x;
			values.y = node._private.position.y;
			//values.width = r.getNodeWidth(node);
			//values.height = r.getNodeHeight(node);
			values.width = node.outerWidth();
			values.height = node.outerHeight();

			return values;
		};

		// helper function to determine label width
		var getLabelWidth = function(node)
		{
			var text = String(node._private.style["content"].value);
			var textTransform = node._private.style["text-transform"].value;

			if (textTransform == "none") {
			} else if (textTransform == "uppercase") {
				text = text.toUpperCase();
			} else if (textTransform == "lowercase") {
				text = text.toLowerCase();
			}

			// TODO width doesn't measure correctly without actually rendering
			var context = r.data.canvases[4].getContext("2d");
			return context.measureText(text).width;
		};

		// helper function to determine label position and dimensions
		var calcLabelPosAndDim = function(node) {

			var values = {};
			var nodeWidth = r.getNodeWidth(node);
			var nodeHeight = r.getNodeHeight(node);


			values.height = node._private.style["font-size"].value;

			// TODO ignoring label width for now, it may be a good idea to do so,
			// since longer label texts may increase the node size unnecessarily
			//values.width = getLabelWidth(node);
			values.width = values.height;

			var textHalign = node._private.style["text-halign"].strValue;

			if (textHalign == "left") {
				values.x = node._private.position.x - nodeWidth / 2;
				values.left = values.x - values.width;
				values.right = values.x;
			} else if (textHalign == "right") {
				values.x = node._private.position.x + nodeWidth / 2;
				values.left = values.x;
				values.right = values.x + values.width;
			} else { //if (textHalign == "center")
				values.x = node._private.position.x;
				values.left = values.x - values.width / 2;
				values.right = values.x + values.width / 2;
			}

			var textValign = node._private.style["text-valign"].strValue;

			if (textValign == "top") {
				values.y = node._private.position.y - nodeHeight / 2;
				values.top = values.y - values.height;
				values.bottom = values.y;
			} else if (textValign == "bottom") {
				values.y = node._private.position.y + nodeHeight / 2;
				values.top = values.y;
				values.bottom = values.y + values.height;
			} else { // if (textValign == "middle" || textValign == "center")
				values.y = node._private.position.y;
				values.top = values.y - values.height / 2;
				values.bottom = values.y + values.height / 2;
			}

			return values;
		};



		// find out border values by iterating given nodes

		for (i = 0; i < nodes.length; i++)
		{
			nodeVals = calcNodePosAndDim(nodes[i]);
			labelVals = calcLabelPosAndDim(nodes[i]);

			if (type == "left")
			{
				var leftBorder = Math.min(nodeVals.x - nodeVals.width / 2,
					labelVals.left);

				if (leftBorder < minValue)
				{
					minValue = leftBorder;
				}
			}
			else if (type == "right")
			{
				var rightBorder = Math.max(nodeVals.x + nodeVals.width / 2,
					labelVals.right);

				if (rightBorder > maxValue)
				{
					maxValue = rightBorder;
				}
			}
			else if (type == "top")
			{
				var topBorder = Math.min(nodeVals.y - nodeVals.height / 2,
					labelVals.top);

				if (topBorder < minValue)
				{
					minValue = topBorder;
				}
			}
			else if (type == "bottom")
			{
				var bottomBorder = Math.max(nodeVals.y + nodeVals.height / 2,
					labelVals.bottom);

				if (bottomBorder > maxValue)
				{
					maxValue = bottomBorder;
				}
			}
		}

		// return the border value according to the type

		if ((type == "left") || (type == "top"))
		{
			return minValue;
		}
		else
		{
			return maxValue;
		}
	};

	/**
	 * Returns the width of the given node. If the width is set to auto,
	 * returns the value of the autoWidth field.
	 *
	 * @param node          a node
	 * @return {number}     width of the node
	 */
	CanvasRenderer.prototype.getNodeWidth = function(node)
	{
		if (node._private.style["width"].value == "auto" ||
		    node._private.style["height"].value == "auto")
		{
			return node._private.autoWidth;
		}
		else
		{
			return node._private.style["width"].value;
		}
	};

	/**
	 * Returns the height of the given node. If the height is set to auto,
	 * returns the value of the autoHeight field.
	 *
	 * @param node          a node
	 * @return {number}     width of the node
	 */
	CanvasRenderer.prototype.getNodeHeight = function(node)
	{
		if (node._private.style["width"].value == "auto" ||
		    node._private.style["height"].value == "auto")
		{
			return node._private.autoHeight;
		}
		else
		{
			return node._private.style["height"].value;
		}
	};

	/**
	 * Returns the shape of the given node. If the height or width of the given node
	 * is set to auto, the node is considered to be a compound.
	 *
	 * @param node          a node
	 * @return {String}     shape of the node
	 */
	CanvasRenderer.prototype.getNodeShape = function(node)
	{
		// TODO only allow rectangle for a compound node?
//		if (node._private.style["width"].value == "auto" ||
//		    node._private.style["height"].value == "auto")
//		{
//			return "rectangle";
//		}

		var shape = node._private.style["shape"].value;

		if( node.isParent() ){
			if( shape === 'rectangle' || shape === 'roundrectangle' ){
				return shape;
			} else {
				return 'rectangle';
			}
		}

		return shape;
	};

	CanvasRenderer.prototype.getNodePadding = function(node)
	{
		var left = node._private.style["padding-left"].value;
		var right = node._private.style["padding-right"].value;
		var top = node._private.style["padding-top"].value;
		var bottom = node._private.style["padding-bottom"].value;

		if (isNaN(left))
		{
			left = 0;
		}

		if (isNaN(right))
		{
			right = 0;
		}

		if (isNaN(top))
		{
			top = 0;
		}

		if (isNaN(bottom))
		{
			bottom = 0;
		}

		return {left : left,
			right : right,
			top : top,
			bottom : bottom};
	};

	// @O Keyboard functions
	{
	}
	
	// @O Drawing functions
	{
	
	// Resize canvas
	CanvasRenderer.prototype.matchCanvasSize = function(container) {
		var data = this.data; var width = container.clientWidth; var height = container.clientHeight;
		
		var canvas, canvasWidth = width, canvasHeight = height;

		if ('devicePixelRatio' in window) {
			canvasWidth *= devicePixelRatio;
			canvasHeight *= devicePixelRatio;
		}

		for (var i = 0; i < CANVAS_LAYERS; i++) {

			canvas = data.canvases[i];
			
			if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
				
				canvas.width = canvasWidth;
				canvas.height = canvasHeight;

				canvas.style.width = width + 'px';
				canvas.style.height = height + 'px';
			}
		}
		
		for (var i = 0; i < BUFFER_COUNT; i++) {
			
			canvas = data.bufferCanvases[i];
			
			if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
				
				canvas.width = canvasWidth;
				canvas.height = canvasHeight;
			}
		}

		this.data.overlay.style.width = width + 'px';
		this.data.overlay.style.height = height + 'px';
	}


	// helper function for the sort operation
	var elementDepth = function(ele) {
		if (ele._private.group == "nodes")
		{
			return ele.parents().size();
		}
		else if (ele._private.group == "edges")
		{
			return Math.max(ele.source()[0].parents().size(),
			                ele.target()[0].parents().size());
		}
		else
		{
			return 0;
		}
	};


	CanvasRenderer.prototype.getCachedZSortedEles = function(){
		var lastNodes = this.lastZOrderCachedNodes;
		var lastEdges = this.lastZOrderCachedEdges;
		var nodes = this.getCachedNodes();
		var edges = this.getCachedEdges();
		var eles = [];

		if( !lastNodes || !lastEdges || lastNodes !== nodes || lastEdges !== edges ){ 
			//console.time('cachezorder')
			
			for( var i = 0; i < nodes.length; i++ ){
				eles.push( nodes[i] );
			}

			for( var i = 0; i < edges.length; i++ ){
				eles.push( edges[i] );
			}

			eles.sort( zOrderSort );
			this.cachedZSortedEles = eles;
			//console.log('make cache')

			//console.timeEnd('cachezorder')
		} else {
			eles = this.cachedZSortedEles;
			//console.log('read cache')
		}

		this.lastZOrderCachedNodes = nodes;
		this.lastZOrderCachedEdges = edges;

		return eles;
	};


	var zOrderSort = function(a, b) {
		var result = a._private.style["z-index"].value
			- b._private.style["z-index"].value;

		var depthA = 0;
		var depthB = 0;

		// no need to calculate element depth if there is no compound node
		if ( a.cy().hasCompoundNodes() )
		{
			depthA = elementDepth(a);
			depthB = elementDepth(b);
		}

		// if both elements has same depth,
		// then edges should be drawn first
		if (depthA - depthB === 0)
		{
			// "a" is a node, it should be drawn later
			if (a._private.group === "nodes"
				&& b._private.group === "edges")
			{
				return 1;
			}
			
			// "a" is an edge, it should be drawn first
			else if (a._private.group === "edges"
				&& b._private.group === "nodes")
			{
				return -1;
			}

			// both nodes or both edges
			else
			{
				if( result === 0 ){ // same z-index => compare indices in the core (order added to graph w/ last on top)
					return a._private.index - b._private.index;
				} else {
					return result;
				}
			}
		}

		// elements on different level
		else
		{
			// deeper element should be drawn later
			return depthA - depthB;
		}

		// return zero if z-index values are not the same
		return 0;
	};

	// Redraw frame
	CanvasRenderer.prototype.redraw = function( forcedContext, drawAll ) {
		var r = this;
		
		if( this.averageRedrawTime === undefined ){ this.averageRedrawTime = 0; }

		var minRedrawLimit = 1000/60; // people can't see much better than 60fps
		var maxRedrawLimit = 1000; // don't cap max b/c it's more important to be responsive than smooth

		var redrawLimit = this.averageRedrawTime; // estimate the ideal redraw limit based on how fast we can draw

		redrawLimit = Math.max(minRedrawLimit, redrawLimit);
		redrawLimit = Math.min(redrawLimit, maxRedrawLimit);

		//console.log('--\nideal: %i; effective: %i', this.averageRedrawTime, redrawLimit);

		if( this.lastDrawTime === undefined ){ this.lastDrawTime = 0; }

		var nowTime = +new Date;
		var timeElapsed = nowTime - this.lastDrawTime;
		var callAfterLimit = timeElapsed >= redrawLimit;

		if( !forcedContext ){
			if( !callAfterLimit ){
				clearTimeout( this.redrawTimeout );
				this.redrawTimeout = setTimeout(function(){
					r.redraw();
				}, redrawLimit);

				return;
			}

			this.lastDrawTime = nowTime;
		}


		// start on thread ready
		setTimeout(function(){

		var startTime = nowTime;

		var looperMax = 100;
		//console.log('-- redraw --')

		// console.time('init'); for( var looper = 0; looper <= looperMax; looper++ ){
		
		var cy = r.data.cy; var data = r.data; 
		var nodes = r.getCachedNodes(); var edges = r.getCachedEdges();
		r.matchCanvasSize(data.container);

		var zoom = cy.zoom();
		var effectiveZoom = zoom;
		var pan = cy.pan();
		var effectivePan = {
			x: pan.x,
			y: pan.y
		};

		if( 'devicePixelRatio' in window ){
			effectiveZoom *= devicePixelRatio;
			effectivePan.x *= devicePixelRatio;
			effectivePan.y *= devicePixelRatio;
		}
		
		var elements = [];
		for( var i = 0; i < nodes.length; i++ ){
			elements.push( nodes[i] );
		}
		for( var i = 0; i < edges.length; i++ ){
			elements.push( edges[i] );
		}

		// } console.timeEnd('init')

	

		if (data.canvasNeedsRedraw[DRAG] || data.canvasNeedsRedraw[NODE] || drawAll) {
			//NB : VERY EXPENSIVE
			//console.time('edgectlpts'); for( var looper = 0; looper <= looperMax; looper++ ){

			if( r.hideEdgesOnViewport && (r.pinching || r.hoverData.dragging || r.data.wheel || r.swipePanning) ){ 
			} else {
				r.findEdgeControlPoints(edges);
			}

			//} console.timeEnd('edgectlpts')

		

			// console.time('sort'); for( var looper = 0; looper <= looperMax; looper++ ){
			var elements = r.getCachedZSortedEles();
			// } console.timeEnd('sort')

			// console.time('updatecompounds'); for( var looper = 0; looper <= looperMax; looper++ ){
			// no need to update graph if there is no compound node
			if ( cy.hasCompoundNodes() )
			{
				r.updateAllCompounds(elements);
			}
			// } console.timeEnd('updatecompounds')
		}
		
		var elesInDragLayer;
		var elesNotInDragLayer;
		var element;


		// console.time('drawing'); for( var looper = 0; looper <= looperMax; looper++ ){
		if (data.canvasNeedsRedraw[NODE] || drawAll) {
			// console.log("redrawing node layer", data.canvasRedrawReason[NODE]);
		  
		  	if( !elesInDragLayer || !elesNotInDragLayer ){
				elesInDragLayer = [];
				elesNotInDragLayer = [];

				for (var index = 0; index < elements.length; index++) {
					element = elements[index];

					if ( element._private.rscratch.inDragLayer ) {
						elesInDragLayer.push( element );
					} else {
						elesNotInDragLayer.push( element );
					}
				}
			}	

			var context = forcedContext || data.canvases[NODE].getContext("2d");

			context.setTransform(1, 0, 0, 1, 0, 0);
			context.clearRect(0, 0, context.canvas.width, context.canvas.height);
			
			if( !drawAll ){
				context.translate(effectivePan.x, effectivePan.y);
				context.scale(effectiveZoom, effectiveZoom);
			} 
			
			for (var index = 0; index < elesNotInDragLayer.length; index++) {
				element = elesNotInDragLayer[index];
				
				if (element._private.group == "nodes") {
					r.drawNode(context, element);
					
				} else if (element._private.group == "edges") {
					r.drawEdge(context, element);
				}
			}
			
			for (var index = 0; index < elesNotInDragLayer.length; index++) {
				element = elesNotInDragLayer[index];
				
				if (element._private.group == "nodes") {
					r.drawNodeText(context, element);
				} else if (element._private.group == "edges") {
					r.drawEdgeText(context, element);
				}

				// draw the overlay
				if (element._private.group == "nodes") {
					r.drawNode(context, element, true);
				} else if (element._private.group == "edges") {
					r.drawEdge(context, element, true);
				}
			}
			
			if( !drawAll ){
				data.canvasNeedsRedraw[NODE] = false; data.canvasRedrawReason[NODE] = [];
			}
		}
		
		if (data.canvasNeedsRedraw[DRAG] || drawAll) {
			// console.log("redrawing drag layer", data.canvasRedrawReason[DRAG]);
		  
			if( !elesInDragLayer || !elesNotInDragLayer ){
				elesInDragLayer = [];
				elesNotInDragLayer = [];

				for (var index = 0; index < elements.length; index++) {
					element = elements[index];

					if ( element._private.rscratch.inDragLayer ) {
						elesInDragLayer.push( element );
					} else {
						elesNotInDragLayer.push( element );
					}
				}
			}

			var context = forcedContext || data.canvases[DRAG].getContext("2d");
			
			if( !drawAll ){
				context.setTransform(1, 0, 0, 1, 0, 0);
				context.clearRect(0, 0, context.canvas.width, context.canvas.height);
				
				context.translate(effectivePan.x, effectivePan.y);
				context.scale(effectiveZoom, effectiveZoom);
			}
			
			var element;

			for (var index = 0; index < elesInDragLayer.length; index++) {
				element = elesInDragLayer[index];
				
				if (element._private.group == "nodes") {
					r.drawNode(context, element);
				} else if (element._private.group == "edges") {
					r.drawEdge(context, element);
				}
			}
			
			for (var index = 0; index < elesInDragLayer.length; index++) {
				element = elesInDragLayer[index];
				
				if (element._private.group == "nodes") {
					r.drawNodeText(context, element);
				} else if (element._private.group == "edges") {
					r.drawEdgeText(context, element);
				}

				// draw the overlay
				if (element._private.group == "nodes") {
					r.drawNode(context, element, true);
				} else if (element._private.group == "edges") {
					r.drawEdge(context, element, true);
				}
			}
			
			if( !drawAll ){
				data.canvasNeedsRedraw[DRAG] = false; data.canvasRedrawReason[DRAG] = [];
			}
		}
		
		if (data.canvasNeedsRedraw[SELECT_BOX]) {
			// console.log("redrawing selection box", data.canvasRedrawReason[SELECT_BOX]);
		  
			var context = forcedContext || data.canvases[SELECT_BOX].getContext("2d");
			
			if( !drawAll ){
				context.setTransform(1, 0, 0, 1, 0, 0);
				context.clearRect(0, 0, context.canvas.width, context.canvas.height);
			
				context.translate(effectivePan.x, effectivePan.y);
				context.scale(effectiveZoom, effectiveZoom);		
			}	
			
			var coreStyle = cy.style()._private.coreStyle;

			if (data.select[4] == 1) {
				var zoom = data.cy.zoom();
				var borderWidth = coreStyle["selection-box-border-width"].value / zoom;
				
				context.lineWidth = borderWidth;
				context.fillStyle = "rgba(" 
					+ coreStyle["selection-box-color"].value[0] + ","
					+ coreStyle["selection-box-color"].value[1] + ","
					+ coreStyle["selection-box-color"].value[2] + ","
					+ coreStyle["selection-box-opacity"].value + ")";
				
				context.fillRect(
					data.select[0],
					data.select[1],
					data.select[2] - data.select[0],
					data.select[3] - data.select[1]);
				
				if (borderWidth > 0) {
					context.strokeStyle = "rgba(" 
						+ coreStyle["selection-box-border-color"].value[0] + ","
						+ coreStyle["selection-box-border-color"].value[1] + ","
						+ coreStyle["selection-box-border-color"].value[2] + ","
						+ coreStyle["selection-box-opacity"].value + ")";
					
					context.strokeRect(
						data.select[0],
						data.select[1],
						data.select[2] - data.select[0],
						data.select[3] - data.select[1]);
				}
			}

			if( data.bgActivePosistion ){
				var zoom = data.cy.zoom();
				var pos = data.bgActivePosistion;

				context.fillStyle = "rgba(" 
					+ coreStyle["active-bg-color"].value[0] + ","
					+ coreStyle["active-bg-color"].value[1] + ","
					+ coreStyle["active-bg-color"].value[2] + ","
					+ coreStyle["active-bg-opacity"].value + ")";

				context.beginPath();
				context.arc(pos.x, pos.y, coreStyle["active-bg-size"].pxValue / zoom, 0, 2 * Math.PI); 
				context.fill();
			}
			
			if( !drawAll ){
				data.canvasNeedsRedraw[SELECT_BOX] = false; data.canvasRedrawReason[SELECT_BOX] = [];
			}
		}

		if( r.options.showOverlay ){
			var context = data.canvases[OVERLAY].getContext("2d");

			context.lineJoin = 'round';
			context.font = '14px helvetica';
			context.strokeStyle = '#fff';
			context.lineWidth = '4';
			context.fillStyle = '#666';
			context.textAlign = 'right';

			var text = 'cytoscape.js';
			
			var w = context.canvas.width;
			var h = context.canvas.height;
			var p = 4;
			var tw = context.measureText(text).width;
			var th = 14; 

			context.clearRect(0, 0, w, h);
			context.strokeText(text, w - p, h - p);
			context.fillText(text, w - p, h - p);

			data.overlayDrawn = true;
		}

		// } console.timeEnd('drawing')

		var endTime = +new Date;

		if( r.averageRedrawTime === undefined ){
			r.averageRedrawTime = endTime - startTime;
		}

		// use a weighted average with a bias from the previous average so we don't spike so easily
		r.averageRedrawTime = r.averageRedrawTime/2 + (endTime - startTime)/2;
		//console.log('actual: %i, average: %i', endTime - startTime, this.averageRedrawTime);


		// end on thread ready
		}, 0);
	};
	
	var imageCache = {};
	
	// Discard after 5 min. of disuse
	var IMAGE_KEEP_TIME = 30 * 300; // 300frames@30fps, or. 5min
	
	CanvasRenderer.prototype.getCachedImage = function(url, onLoadRedraw) {

		if (imageCache[url] && imageCache[url].image) {

			// Reset image discard timer
			imageCache[url].keepTime = IMAGE_KEEP_TIME; 
			return imageCache[url].image;
		}
		
		var imageContainer = imageCache[url];
		
		if (imageContainer == undefined) { 
			imageCache[url] = new Object();
			imageCache[url].image = new Image();
			imageCache[url].image.onload = onLoadRedraw;
			
			imageCache[url].image.src = url;
			
			// Initialize image discard timer
			imageCache[url].keepTime = IMAGE_KEEP_TIME;
			
			imageContainer = imageCache[url];
		}
		
		return imageContainer.image;
	}
	
	// Attempt to replace the image object with a canvas buffer to solve zooming problem
	CanvasRenderer.prototype.swapCachedImage = function(url) {
		if (imageCache[url]) {
			
			if (imageCache[url].image
					&& imageCache[url].image.complete) {
				
				var image = imageCache[url].image;
				
				var buffer = document.createElement("canvas");
				buffer.width = image.width;
				buffer.height = image.height;
				
				buffer.getContext("2d").drawImage(image,
						0, 0
					);
				
				imageCache[url].image = buffer;
				imageCache[url].swappedWithCanvas = true;
				
				return buffer;
			} else {
				return null;
			} 
		} else {
			return null;
		}
	}
	
	CanvasRenderer.prototype.updateImageCaches = function() {
		
		for (var url in imageCache) {
			if (imageCache[url].keepTime <= 0) {
				
				if (imageCache[url].image != undefined) {
					imageCache[url].image.src = undefined;
					imageCache[url].image = undefined;
				}
				
				imageCache[url] = undefined;
			} else {
				imageCache[url] -= 1;
			}
		}
	}
	
	CanvasRenderer.prototype.drawImage = function(context, x, y, widthScale, heightScale, rotationCW, image) {
		
		image.widthScale = 0.5;
		image.heightScale = 0.5;
		
		image.rotate = rotationCW;
		
		var finalWidth; var finalHeight;
		
		canvas.drawImage(image, x, y);
	}
	
	// Draw edge
	CanvasRenderer.prototype.drawEdge = function(context, edge, drawOverlayInstead) {

		if( this.hideEdgesOnViewport && (this.dragData.didDrag || this.pinching || this.hoverData.dragging || this.data.wheel || this.swipePanning) ){ return; } // save cycles on pinching

		var startNode, endNode;

		startNode = edge.source()[0];
		endNode = edge.target()[0];
		
		if (edge._private.style["visibility"].value != "visible"
			|| startNode._private.style["visibility"].value != "visible"
			|| endNode._private.style["visibility"].value != "visible") {
			return;
		}
		
		var overlayPadding = edge._private.style["overlay-padding"].value;
		var overlayOpacity = edge._private.style["overlay-opacity"].value;
		var overlayColor = edge._private.style["overlay-color"].value;

		// Edge color & opacity
		if( drawOverlayInstead ){
			context.strokeStyle = "rgba( " + overlayColor[0] + ", " + overlayColor[1] + ", " + overlayColor[2] + ", " + overlayOpacity + " )";
			context.lineCap = "round";

			if( edge._private.rscratch.edgeType == "self"){
				context.lineCap = "butt";
			}

		} else {
			context.strokeStyle = "rgba(" 
				+ edge._private.style["line-color"].value[0] + ","
				+ edge._private.style["line-color"].value[1] + ","
				+ edge._private.style["line-color"].value[2] + ","
				+ edge._private.style.opacity.value + ")";
		}

		// Edge line width
		if (edge._private.style["width"].value <= 0) {
			return;
		}
		
		var edgeWidth = edge._private.style["width"].value + (drawOverlayInstead ? 2 * overlayPadding : 0);
		var lineStyle = drawOverlayInstead ? "solid" : edge._private.style["line-style"].value;
		context.lineWidth = edgeWidth;
		
		this.findEndpoints(edge);
		
		if (edge._private.rscratch.edgeType == "self") {
					
			var details = edge._private.rscratch;
			this.drawStyledEdge(edge, context, [details.startX, details.startY, details.cp2ax,
				details.cp2ay, details.selfEdgeMidX, details.selfEdgeMidY],
				lineStyle,
				edgeWidth);
			
			this.drawStyledEdge(edge, context, [details.selfEdgeMidX, details.selfEdgeMidY,
				details.cp2cx, details.cp2cy, details.endX, details.endY],
				lineStyle,
				edgeWidth);
			
		} else if (edge._private.rscratch.edgeType == "straight") {
			
			var nodeDirectionX = endNode._private.position.x - startNode._private.position.x;
			var nodeDirectionY = endNode._private.position.y - startNode._private.position.y;
			
			var edgeDirectionX = edge._private.rscratch.endX - edge._private.rscratch.startX;
			var edgeDirectionY = edge._private.rscratch.endY - edge._private.rscratch.startY;
			
			if (nodeDirectionX * edgeDirectionX
				+ nodeDirectionY * edgeDirectionY < 0) {
				
				edge._private.rscratch.straightEdgeTooShort = true;	
			} else {
				
				var details = edge._private.rscratch;
				this.drawStyledEdge(edge, context, [details.startX, details.startY,
				                              details.endX, details.endY],
				                              lineStyle,
				                              edgeWidth);
				
				edge._private.rscratch.straightEdgeTooShort = false;	
			}	
		} else {
			
			var details = edge._private.rscratch;
			this.drawStyledEdge(edge, context, [details.startX, details.startY,
				details.cp2x, details.cp2y, details.endX, details.endY],
				lineStyle,
				edgeWidth);
			
		}
		
		if (edge._private.rscratch.noArrowPlacement !== true
				&& edge._private.rscratch.startX !== undefined) {
			this.drawArrowheads(context, edge, drawOverlayInstead);
		}

	}
	
	var _genPoints = function(pt, spacing, even) {
		
		var approxLen = Math.sqrt(Math.pow(pt[4] - pt[0], 2) + Math.pow(pt[5] - pt[1], 2));
		approxLen += Math.sqrt(Math.pow((pt[4] + pt[0]) / 2 - pt[2], 2) + Math.pow((pt[5] + pt[1]) / 2 - pt[3], 2));

		var pts = Math.ceil(approxLen / spacing); var inc = approxLen / spacing;
		var pz;
		
		if (pts > 0) {
			pz = new Array(pts * 2);
		} else {
			return null;
		}
		
		for (var i = 0; i < pts; i++) {
			var cur = i / pts;
			pz[i * 2] = pt[0] * (1 - cur) * (1 - cur) + 2 * (pt[2]) * (1 - cur) * cur + pt[4] * (cur) * (cur);
			pz[i * 2 + 1] = pt[1] * (1 - cur) * (1 - cur) + 2 * (pt[3]) * (1 - cur) * cur + pt[5] * (cur) * (cur);
		}
		
		return pz;
	}
	
	var _genStraightLinePoints = function(pt, spacing, even) {
		
		var approxLen = Math.sqrt(Math.pow(pt[2] - pt[0], 2) + Math.pow(pt[3] - pt[1], 2));
		
		var pts = Math.ceil(approxLen / spacing);
		var pz;
		
		if (pts > 0) {
			pz = new Array(pts * 2);
		} else {
			return null;
		}
		
		var lineOffset = [pt[2] - pt[0], pt[3] - pt[1]];
		for (var i = 0; i < pts; i++) {
			var cur = i / pts;
			pz[i * 2] = lineOffset[0] * cur + pt[0];
			pz[i * 2 + 1] = lineOffset[1] * cur + pt[1];
		}
		
		return pz;
	}
	
	var _genEvenOddpts = function(pt, evenspac, oddspac) {
		
		pt1 = _genpts(pt, evenspac);
		pt2 = _genpts(pt, oddspac);
	}
	
	CanvasRenderer.prototype.createBuffer = function(w, h) {
		var buffer = document.createElement("canvas");
		buffer.width = w;
		buffer.height = h;
		
		return [buffer, buffer.getContext("2d")];
	}
	
	/*
	CanvasRenderer.prototype.
	
	CanvasRenderer.prototype.drawStraightEdge = function(context, x1, y1, x2, y2, type, width) {
		
		if (type == "solid") {
			context.beginPath();
			context.moveTo(
				edge._private.rscratch.startX,
				edge._private.rscratch.startY);
	
			
			context.stroke();
		} else if (type == "dotted") {
			var pt = _genStraightLinePoints([x1, y1, x2, y2], 10, false);
			
			
		} else if (type == "dashed") {
			var pt = _genStraightLinePoints([x1, y1, x2, y2], 10, false);
		}
		
	}
	*/
	
	CanvasRenderer.prototype.drawStyledEdge = function(
			edge, context, pts, type, width) {
		
		// 3 points given -> assume Bezier
		// 2 -> assume straight
		
		var cy = this.data.cy;
		var zoom = cy.zoom();
		
		// Adjusted edge width for dotted
//		width = Math.max(width * 1.6, 3.4) * zoom;

		//		console.log("w", width);
		
		// from http://en.wikipedia.org/wiki/Bézier_curve#Quadratic_curves
		function qbezierAt(p0, p1, p2, t){
			return (1 - t)*(1 - t)*p0 + 2*(1 - t)*t*p1 + t*t*p2;
		}

		if( edge._private.rstyle.bezierPts === undefined ){
			edge._private.rstyle.bezierPts = [];
		}

		var nBpts = edge._private.rstyle.bezierPts.length;
		if( edge.isLoop() ){
			if( nBpts >= 12 ){
				edge._private.rstyle.bezierPts = [];
			} else {
				// append to current array
			}
		} else {
			edge._private.rstyle.bezierPts = [];
		}

		var bpts = edge._private.rstyle.bezierPts;

		if( pts.length === 6 ){
			bpts.push({
				x: qbezierAt( pts[0], pts[2], pts[4], 0.05 ),
				y: qbezierAt( pts[1], pts[3], pts[5], 0.05 )
			});

			bpts.push({
				x: qbezierAt( pts[0], pts[2], pts[4], 0.25 ),
				y: qbezierAt( pts[1], pts[3], pts[5], 0.25 )
			});

			bpts.push({
				x: qbezierAt( pts[0], pts[2], pts[4], 0.35 ),
				y: qbezierAt( pts[1], pts[3], pts[5], 0.35 )
			});

			bpts.push({
				x: qbezierAt( pts[0], pts[2], pts[4], 0.65 ),
				y: qbezierAt( pts[1], pts[3], pts[5], 0.65 )
			});

			bpts.push({
				x: qbezierAt( pts[0], pts[2], pts[4], 0.75 ),
				y: qbezierAt( pts[1], pts[3], pts[5], 0.75 )
			});

			bpts.push({
				x: qbezierAt( pts[0], pts[2], pts[4], 0.95 ),
				y: qbezierAt( pts[1], pts[3], pts[5], 0.95 )
			});
		}

		if (type == "solid") {
			
			context.beginPath();
			context.moveTo(pts[0], pts[1]);
			if (pts.length == 3 * 2) {
				context.quadraticCurveTo(pts[2], pts[3], pts[4], pts[5]);
			} else {
				context.lineTo(pts[2], pts[3]);
			}
//			context.closePath();
			context.stroke();
			
		} else if (type == "dotted") {
			
			var pt;
			if (pts.length == 3 * 2) {
				pt = _genPoints(pts, 16, true);
			} else {
				pt = _genStraightLinePoints(pts, 16, true);
			}
			
			if (!pt) { return; }
			
			var dotRadius = Math.max(width * 1.6, 3.4) * zoom;
			var bufW = dotRadius * 2, bufH = dotRadius * 2;
			bufW = Math.max(bufW, 1);
			bufH = Math.max(bufH, 1);
			
			var buffer = this.createBuffer(bufW, bufH);
			
			var context2 = buffer[1];
//			console.log(buffer);
//			console.log(bufW, bufH);
			
			// Draw on buffer
			context2.setTransform(1, 0, 0, 1, 0, 0);
			context2.clearRect(0, 0, bufW, bufH);
			
			context2.fillStyle = context.strokeStyle;
			context2.beginPath();
			context2.arc(bufW/2, bufH/2, dotRadius * 0.5, 0, Math.PI * 2, false);
			context2.fill();
			
			// Now use buffer
			context.beginPath();
			//context.save();
			
			for (var i=0; i<pt.length/2; i++) {
				
//				context.beginPath();
//				context.arc(pt[i*2], pt[i*2+1], width * 0.5, 0, Math.PI * 2, false);
//				context.fill();
				
				context.drawImage(
						buffer[0],
						pt[i*2] - bufW/2 / zoom,
						pt[i*2+1] - bufH/2 / zoom,
						bufW / zoom,
						bufH / zoom);
			}
			
			//context.restore();
			
		} else if (type == "dashed") {
			var pt;
			if (pts.length == 3 * 2) {
				pt = _genPoints(pts, 14, true);
			} else {
				pt = _genStraightLinePoints(pts, 14, true);
			}
			if (!pt) { return; }
			
//			var dashSize = Math.max(width * 1.6, 3.4);
//			dashSize = Math.min(dashSize)
			
			//var bufW = width * 2 * zoom, bufH = width * 2.5 * zoom;
			var bufW = width * 2 * zoom
			var bufH = 7.8 * zoom;
			bufW = Math.max(bufW, 1);
			bufH = Math.max(bufH, 1);
			
			var buffer = this.createBuffer(bufW, bufH);
			var context2 = buffer[1];

			// Draw on buffer
			context2.setTransform(1, 0, 0, 1, 0, 0);
			context2.clearRect(0, 0, bufW, bufH);
			
			if (context.strokeStyle) {
				context2.strokeStyle = context.strokeStyle;
			}
			
			context2.lineWidth = width * cy.zoom();
			
	//		context2.fillStyle = context.strokeStyle;
			
			context2.beginPath();
			context2.moveTo(bufW / 2, bufH * 0.2);
			context2.lineTo(bufW / 2,  bufH * 0.8);
			
	//		context2.arc(bufH, dotRadius, dotRadius * 0.5, 0, Math.PI * 2, false);
			
	//		context2.fill();
			context2.stroke();
			
			//context.save();
			
			// document.body.appendChild(buffer[0]);
			
			var quadraticBezierVaryingTangent = false;
			var rotateVector, angle;
			
			// Straight line; constant tangent angle
			if (pts.length == 2 * 2) {
				rotateVector = [pts[2] - pts[0], pts[3] - pt[1]];
				
				angle = Math.acos((rotateVector[0] * 0 + rotateVector[1] * -1) / Math.sqrt(rotateVector[0] * rotateVector[0] 
						+ rotateVector[1] * rotateVector[1]));
	
				if (rotateVector[0] < 0) {
					angle = -angle + 2 * Math.PI;
				}
			} else if (pts.length == 3 * 2) {
				quadraticBezierVaryingTangent = true;
			}
			
			for (var i=0; i<pt.length/2; i++) {
				
				var p = i / (Math.max(pt.length/2 - 1, 1));
			
				// Quadratic bezier; varying tangent
				// So, use derivative of quadratic Bezier function to find tangents
				if (quadraticBezierVaryingTangent) {
					rotateVector = [2 * (1-p) * (pts[2] - pts[0]) 
					                	+ 2 * p * (pts[4] - pts[2]),
					                    2 * (1-p) * (pts[3] - pts[1]) 
					                    + 2 * p * (pts[5] - pts[3])];
	
					angle = Math.acos((rotateVector[0] * 0 + rotateVector[1] * -1) / Math.sqrt(rotateVector[0] * rotateVector[0] 
								+ rotateVector[1] * rotateVector[1]));
	
					if (rotateVector[0] < 0) {
						angle = -angle + 2 * Math.PI;
					}
				}
				
				context.translate(pt[i*2], pt[i*2+1]);
				
				context.rotate(angle);
				context.translate(-bufW/2 / zoom, -bufH/2 / zoom);
				
				context.drawImage(
						buffer[0],
						0,
						0,
						bufW / zoom,
						bufH / zoom);
				
				context.translate(bufW/2 / zoom, bufH/2 / zoom);
				context.rotate(-angle);
				
				context.translate(-pt[i*2], -pt[i*2+1]);
				
			}
			
			
			//context.restore();
		} else {
			this.drawStyledEdge(edge, context, pts, "solid", width);
		}
		
	};
	
	// Draw edge text
	CanvasRenderer.prototype.drawEdgeText = function(context, edge) {
	
		if( this.hideEdgesOnViewport && (this.dragData.didDrag || this.pinching || this.hoverData.dragging || this.data.wheel || this.swipePanning) ){ return; } // save cycles on pinching
	
		if (edge._private.style["visibility"].value != "visible") {
			return;
		}

		var computedSize = edge._private.style["font-size"].pxValue * edge.cy().zoom();
		var minSize = edge._private.style["min-zoomed-font-size"].pxValue;

		if( computedSize < minSize ){
			return;
		}
	
		// Calculate text draw position
		
		context.textAlign = "center";
		context.textBaseline = "middle";
		
		var textX, textY;	
		var edgeCenterX, edgeCenterY;
		
		if (edge._private.rscratch.edgeType == "self") {
			edgeCenterX = edge._private.rscratch.selfEdgeMidX;
			edgeCenterY = edge._private.rscratch.selfEdgeMidY;
		} else if (edge._private.rscratch.edgeType == "straight") {
			edgeCenterX = (edge._private.rscratch.startX
				+ edge._private.rscratch.endX) / 2;
			edgeCenterY = (edge._private.rscratch.startY
				+ edge._private.rscratch.endY) / 2;
		} else if (edge._private.rscratch.edgeType == "bezier") {
			edgeCenterX = 0.25 * edge._private.rscratch.startX
				+ 2 * 0.5 * 0.5 * edge._private.rscratch.cp2x
				+ (0.5 * 0.5) * edge._private.rscratch.endX;
			edgeCenterY = Math.pow(1 - 0.5, 2) * edge._private.rscratch.startY
				+ 2 * (1 - 0.5) * 0.5 * edge._private.rscratch.cp2y
				+ (0.5 * 0.5) * edge._private.rscratch.endY;
		}
		
		textX = edgeCenterX;
		textY = edgeCenterY;

		// add center point to style so bounding box calculations can use it
		var rstyle = edge._private.rstyle;
		rstyle.labelX = textX;
		rstyle.labelY = textY;
		
		this.drawText(context, edge, textX, textY);
	};
	
	// Draw node
	CanvasRenderer.prototype.drawNode = function(context, node, drawOverlayInstead) {

		var nodeWidth, nodeHeight;
		
		if ( node._private.style["visibility"].value != "visible" ) {
			return;
		}

		var parentOpacity = 1;
		var parents = node.parents();
		for( var i = 0; i < parents.length; i++ ){
			var parent = parents[i];
			var opacity = parent._private.style.opacity.value;

			parentOpacity = opacity * parentOpacity;

			if( opacity === 0 ){
				return;
			}
		}
		
		nodeWidth = this.getNodeWidth(node);
		nodeHeight = this.getNodeHeight(node);

		if( drawOverlayInstead === undefined || !drawOverlayInstead ){

			// Node color & opacity
			context.fillStyle = "rgba(" 
				+ node._private.style["background-color"].value[0] + ","
				+ node._private.style["background-color"].value[1] + ","
				+ node._private.style["background-color"].value[2] + ","
				+ (node._private.style["background-opacity"].value 
				* node._private.style["opacity"].value * parentOpacity) + ")";
			
			// Node border color & opacity
			context.strokeStyle = "rgba(" 
				+ node._private.style["border-color"].value[0] + ","
				+ node._private.style["border-color"].value[1] + ","
				+ node._private.style["border-color"].value[2] + ","
				+ (node._private.style["border-opacity"].value * node._private.style["opacity"].value * parentOpacity) + ")";
			
			
			{
				//var image = this.getCachedImage("url");
				
				var url = node._private.style["background-image"].value[2] ||
					node._private.style["background-image"].value[1];
				
				if (url != undefined) {
					
					var r = this;
					var image = this.getCachedImage(url,
							
							function() {
								
	//							console.log(e);
								r.data.canvasNeedsRedraw[NODE] = true;
								r.data.canvasRedrawReason[NODE].push("image finished load");
								r.data.canvasNeedsRedraw[DRAG] = true;
								r.data.canvasRedrawReason[DRAG].push("image finished load");
								
								// Replace Image object with Canvas to solve zooming too far
								// into image graphical errors (Jan 10 2013)
								r.swapCachedImage(url);
								
								r.redraw();
							}
					);
					
					if (image.complete == false) {

						nodeShapes[r.getNodeShape(node)].drawPath(
							context,
							node._private.position.x,
							node._private.position.y,
						    nodeWidth, nodeHeight);
							//node._private.style["width"].value,
							//node._private.style["height"].value);
						
						context.stroke();
						context.fillStyle = "#555555";
						context.fill();
						
					} else {
						//context.clip
						this.drawInscribedImage(context, image, node);
					}
					
				} else {

					// Draw node
					nodeShapes[this.getNodeShape(node)].draw(
						context,
						node._private.position.x,
						node._private.position.y,
						nodeWidth,
						nodeHeight); //node._private.data.weight / 5.0
				}
				
			}
			
			// Border width, draw border
			context.lineWidth = node._private.style["border-width"].pxValue;
			if (node._private.style["border-width"].value > 0) {
				context.stroke();
			}
			

		// draw the overlay
		} else {

			var overlayPadding = node._private.style["overlay-padding"].value;
			var overlayOpacity = node._private.style["overlay-opacity"].value;
			var overlayColor = node._private.style["overlay-color"].value;
			if( overlayOpacity > 0 ){
				context.fillStyle = "rgba( " + overlayColor[0] + ", " + overlayColor[1] + ", " + overlayColor[2] + ", " + overlayOpacity + " )";

				nodeShapes[this.getNodeShape(node)].draw(
					context,
					node._private.position.x,
					node._private.position.y,
					nodeWidth + overlayPadding * 2,
					nodeHeight + overlayPadding * 2
				);
			}
		}

	};
	
	CanvasRenderer.prototype.drawInscribedImage = function(context, img, node) {
		var r = this;
//		console.log(this.data);
		var zoom = this.data.cy._private.zoom;
		
		var nodeX = node._private.position.x;
		var nodeY = node._private.position.y;

		//var nodeWidth = node._private.style["width"].value;
		//var nodeHeight = node._private.style["height"].value;
		var nodeWidth = this.getNodeWidth(node);
		var nodeHeight = this.getNodeHeight(node);
		
		context.save();
		
		nodeShapes[r.getNodeShape(node)].drawPath(
				context,
				nodeX, nodeY, 
				nodeWidth, nodeHeight);
		
		context.clip();
		
//		context.setTransform(1, 0, 0, 1, 0, 0);
		
		var imgDim = [img.width, img.height];
		context.drawImage(img, 
				nodeX - imgDim[0] / 2,
				nodeY - imgDim[1] / 2,
				imgDim[0],
				imgDim[1]);
		
		context.restore();
		context.stroke();
		
	};
	
	// Draw node text
	CanvasRenderer.prototype.drawNodeText = function(context, node) {
		
		if (node._private.style["visibility"].value != "visible") {
			return;
		}

		var computedSize = node._private.style["font-size"].pxValue * node.cy().zoom();
		var minSize = node._private.style["min-zoomed-font-size"].pxValue;

		if( computedSize < minSize ){
			return;
		}
	
		var textX, textY;

		//var nodeWidth = node._private.style["width"].value;
		//var nodeHeight = node._private.style["height"].value;
		var nodeWidth = this.getNodeWidth(node);
		var nodeHeight = this.getNodeHeight(node);
	
		// Find text position
		var textHalign = node._private.style["text-halign"].strValue;
		if (textHalign == "left") {
			// Align right boundary of text with left boundary of node
			context.textAlign = "right";
			textX = node._private.position.x - nodeWidth / 2;
		} else if (textHalign == "right") {
			// Align left boundary of text with right boundary of node
			context.textAlign = "left";
			textX = node._private.position.x + nodeWidth / 2;
		} else if (textHalign == "center") {
			context.textAlign = "center";
			textX = node._private.position.x;
		} else {
			// Same as center
			context.textAlign = "center";
			textX = node._private.position.x;
		}
		
		var textValign = node._private.style["text-valign"].strValue;
		if (textValign == "top") {
			context.textBaseline = "bottom";
			textY = node._private.position.y - nodeHeight / 2;
		} else if (textValign == "bottom") {
			context.textBaseline = "top";
			textY = node._private.position.y + nodeHeight / 2;
		} else if (textValign == "middle" || textValign == "center") {
			context.textBaseline = "middle";
			textY = node._private.position.y;
		} else {
			// same as center
			context.textBaseline = "middle";
			textY = node._private.position.y;
		}
		
		this.drawText(context, node, textX, textY);
	};
	
	// Draw text
	CanvasRenderer.prototype.drawText = function(context, element, textX, textY) {
	
		var parentOpacity = 1;
		var parents = element.parents();
		for( var i = 0; i < parents.length; i++ ){
			var parent = parents[i];
			var opacity = parent._private.style.opacity.value;

			parentOpacity = opacity * parentOpacity;

			if( opacity === 0 ){
				return;
			}
		}

		// Font style
		var labelStyle = element._private.style["font-style"].strValue;
		var labelSize = element._private.style["font-size"].value + "px";
		var labelFamily = element._private.style["font-family"].strValue;
		var labelVariant = element._private.style["font-variant"].strValue;
		var labelWeight = element._private.style["font-weight"].strValue;
		
		context.font = labelStyle + " " + labelWeight + " "
			+ labelSize + " " + labelFamily;
		
		var text = String(element._private.style["content"].value);
		var textTransform = element._private.style["text-transform"].value;
		
		if (textTransform == "none") {
		} else if (textTransform == "uppercase") {
			text = text.toUpperCase();
		} else if (textTransform == "lowercase") {
			text = text.toLowerCase();
		}
		
		// Calculate text draw position based on text alignment
		
		// so text outlines aren't jagged
		context.lineJoin = 'round';

		context.fillStyle = "rgba(" 
			+ element._private.style["color"].value[0] + ","
			+ element._private.style["color"].value[1] + ","
			+ element._private.style["color"].value[2] + ","
			+ (element._private.style["text-opacity"].value
			* element._private.style["opacity"].value * parentOpacity) + ")";
		
		context.strokeStyle = "rgba(" 
			+ element._private.style["text-outline-color"].value[0] + ","
			+ element._private.style["text-outline-color"].value[1] + ","
			+ element._private.style["text-outline-color"].value[2] + ","
			+ (element._private.style["text-opacity"].value
			* element._private.style["opacity"].value * parentOpacity) + ")";
		
		if (text != undefined) {
			var lineWidth = 2  * element._private.style["text-outline-width"].value; // *2 b/c the stroke is drawn centred on the middle
			if (lineWidth > 0) {
				context.lineWidth = lineWidth;
				context.strokeText(text, textX, textY);
			}

			// Thanks sysord@github for the isNaN checks!
			if (isNaN(textX)) { textX = 0; }
			if (isNaN(textY)) { textY = 0; }

			context.fillText("" + text, textX, textY);

			// record the text's width for use in bounding box calc
			element._private.rstyle.labelWidth = context.measureText( text ).width;
		}
	};

	CanvasRenderer.prototype.drawBackground = function(context, color1, color2, 
			startPosition, endPosition) {
	
		
	}
	
	// @O Edge calculation functions
	{
	
	// Find edge control points
	CanvasRenderer.prototype.findEdgeControlPoints = function(edges) {
		var hashTable = {}; var cy = this.data.cy;
		var pairIds = [];
		
		var pairId;
		for (var i = 0; i < edges.length; i++) {
			pairId = edges[i]._private.data.source > edges[i]._private.data.target ?
				edges[i]._private.data.target + '-' + edges[i]._private.data.source :
				edges[i]._private.data.source + '-' + edges[i]._private.data.target ;

			if (hashTable[pairId] == undefined) {
				hashTable[pairId] = [];
			}
			
			hashTable[pairId].push( edges[i] );
			pairIds.push( pairId );
		}
		var src, tgt;
		
		// Nested for loop is OK; total number of iterations for both loops = edgeCount	
		for (var p = 0; p < pairIds.length; p++) {
			pairId = pairIds[p];
		
			src = cy.getElementById( hashTable[pairId][0]._private.data.source );
			tgt = cy.getElementById( hashTable[pairId][0]._private.data.target );

			var midPointX = (src._private.position.x + tgt._private.position.x) / 2;
			var midPointY = (src._private.position.y + tgt._private.position.y) / 2;
			
			var displacementX, displacementY;
			
			if (hashTable[pairId].length > 1) {
				displacementX = tgt._private.position.y - src._private.position.y;
				displacementY = src._private.position.x - tgt._private.position.x;
				
				var displacementLength = Math.sqrt(displacementX * displacementX
					+ displacementY * displacementY);
				
				displacementX /= displacementLength;
				displacementY /= displacementLength;
			}
			
			var edge;
			
			for (var i = 0; i < hashTable[pairId].length; i++) {
				edge = hashTable[pairId][i];
				
				var edgeIndex1 = edge._private.rscratch.lastEdgeIndex;
				var edgeIndex2 = i;

				var numEdges1 = edge._private.rscratch.lastNumEdges;
				var numEdges2 = hashTable[pairId].length;

				var srcX1 = edge._private.rscratch.lastSrcCtlPtX;
				var srcX2 = src._private.position.x;
				var srcY1 = edge._private.rscratch.lastSrcCtlPtY;
				var srcY2 = src._private.position.y;
				var srcW1 = edge._private.rscratch.lastSrcCtlPtW;
				var srcW2 = src.outerWidth();
				var srcH1 = edge._private.rscratch.lastSrcCtlPtH;
				var srcH2 = src.outerHeight();

				var tgtX1 = edge._private.rscratch.lastTgtCtlPtX;
				var tgtX2 = tgt._private.position.x;
				var tgtY1 = edge._private.rscratch.lastTgtCtlPtY;
				var tgtY2 = tgt._private.position.y;
				var tgtW1 = edge._private.rscratch.lastTgtCtlPtW;
				var tgtW2 = tgt.outerWidth();
				var tgtH1 = edge._private.rscratch.lastTgtCtlPtH;
				var tgtH2 = tgt.outerHeight();

				if( srcX1 === srcX2 && srcY1 === srcY2 && srcW1 === srcW2 && srcH1 === srcH2
				&&  tgtX1 === tgtX2 && tgtY1 === tgtY2 && tgtW1 === tgtW2 && tgtH1 === tgtH2
				&&  edgeIndex1 === edgeIndex2 && numEdges1 === numEdges2 ){
					// console.log('edge ctrl pt cache HIT')
					continue; // then the control points haven't changed and we can skip calculating them
				} else {
					var rs = edge._private.rscratch;

					rs.lastSrcCtlPtX = srcX2;
					rs.lastSrcCtlPtY = srcY2;
					rs.lastSrcCtlPtW = srcW2;
					rs.lastSrcCtlPtH = srcH2;
					rs.lastTgtCtlPtX = tgtX2;
					rs.lastTgtCtlPtY = tgtY2;
					rs.lastTgtCtlPtW = tgtW2;
					rs.lastTgtCtlPtH = tgtH2;
					rs.lastEdgeIndex = edgeIndex2;
					rs.lastNumEdges = numEdges2;
					// console.log('edge ctrl pt cache MISS')
				}

				// Self-edge
				if (src._private.data.id == tgt._private.data.id) {
					var stepSize = edge._private.style["control-point-step-size"].pxValue;
						
					edge._private.rscratch.edgeType = "self";
					
					// New -- fix for large nodes
					edge._private.rscratch.cp2ax = src._private.position.x;
					edge._private.rscratch.cp2ay = src._private.position.y
						- (1 + Math.pow(this.getNodeHeight(src), 1.12) / 100) * stepSize * (i / 3 + 1);
					
					edge._private.rscratch.cp2cx = src._private.position.x
						- (1 + Math.pow(this.getNodeWidth(src), 1.12) / 100) * stepSize * (i / 3 + 1);
					edge._private.rscratch.cp2cy = src._private.position.y;
					
					edge._private.rscratch.selfEdgeMidX =
						(edge._private.rscratch.cp2ax + edge._private.rscratch.cp2cx) / 2.0;
				
					edge._private.rscratch.selfEdgeMidY =
						(edge._private.rscratch.cp2ay + edge._private.rscratch.cp2cy) / 2.0;
					
				// Straight edge
				} else if (hashTable[pairId].length % 2 == 1
					&& i == Math.floor(hashTable[pairId].length / 2)) {
					
					edge._private.rscratch.edgeType = "straight";
					
				// Bezier edge
				} else {
					var stepSize = edge._private.style["control-point-step-size"].value;
					var distanceFromMidpoint = (0.5 - hashTable[pairId].length / 2 + i) * stepSize;
					
					edge._private.rscratch.edgeType = "bezier";
					
					edge._private.rscratch.cp2x = midPointX
						+ displacementX * distanceFromMidpoint;
					edge._private.rscratch.cp2y = midPointY
						+ displacementY * distanceFromMidpoint;
					
					// console.log(edge, midPointX, displacementX, distanceFromMidpoint);
				}
			}
		}
		
		return hashTable;
	}

	CanvasRenderer.prototype.findEndpoints = function(edge) {
		var intersect;

		var source = edge.source()[0];
		var target = edge.target()[0];
		
//		var sourceRadius = Math.max(edge.source()[0]._private.style["width"].value,
//			edge.source()[0]._private.style["height"].value);

		var sourceRadius = Math.max(this.getNodeWidth(source),
			this.getNodeHeight(source));
		
//		var targetRadius = Math.max(edge.target()[0]._private.style["width"].value,
//			edge.target()[0]._private.style["height"].value);

		var targetRadius = Math.max(this.getNodeWidth(target),
			this.getNodeHeight(target));

		sourceRadius = 0;
		targetRadius /= 2;
		
		var start = [edge.source().position().x, edge.source().position().y];
		var end = [edge.target().position().x, edge.target().position().y];
		
		if (edge._private.rscratch.edgeType == "self") {
			
			var cp = [edge._private.rscratch.cp2cx, edge._private.rscratch.cp2cy];
			
			intersect = nodeShapes[this.getNodeShape(target)].intersectLine(
				target._private.position.x,
				target._private.position.y,
				//target._private.style["width"].value,
				//target._private.style["height"].value,
				this.getNodeWidth(target),
				this.getNodeHeight(target),
				cp[0], //halfPointX,
				cp[1], //halfPointY
				target._private.style["border-width"].value / 2
			);
			
			var arrowEnd = this.shortenIntersection(intersect, cp,
				arrowShapes[edge._private.style["target-arrow-shape"].value].spacing(edge));
			var edgeEnd = this.shortenIntersection(intersect, cp,
				arrowShapes[edge._private.style["target-arrow-shape"].value].gap(edge));
			
			edge._private.rscratch.endX = edgeEnd[0];
			edge._private.rscratch.endY = edgeEnd[1];
			
			edge._private.rscratch.arrowEndX = arrowEnd[0];
			edge._private.rscratch.arrowEndY = arrowEnd[1];
			
			var cp = [edge._private.rscratch.cp2ax, edge._private.rscratch.cp2ay];

			intersect = nodeShapes[this.getNodeShape(source)].intersectLine(
				source._private.position.x,
				source._private.position.y,
				//source._private.style["width"].value,
				//source._private.style["height"].value,
				this.getNodeWidth(source),
				this.getNodeHeight(source),
				cp[0], //halfPointX,
				cp[1], //halfPointY
				source._private.style["border-width"].value / 2
			);
			
			var arrowStart = this.shortenIntersection(intersect, cp,
				arrowShapes[edge._private.style["source-arrow-shape"].value].spacing(edge));
			var edgeStart = this.shortenIntersection(intersect, cp,
				arrowShapes[edge._private.style["source-arrow-shape"].value].gap(edge));
			
			edge._private.rscratch.startX = edgeStart[0];
			edge._private.rscratch.startY = edgeStart[1];
			
			edge._private.rscratch.arrowStartX = arrowStart[0];
			edge._private.rscratch.arrowStartY = arrowStart[1];
			
		} else if (edge._private.rscratch.edgeType == "straight") {
		
			intersect = nodeShapes[this.getNodeShape(target)].intersectLine(
				target._private.position.x,
				target._private.position.y,
				//target._private.style["width"].value,
				//target._private.style["height"].value,
				this.getNodeWidth(target),
				this.getNodeHeight(target),
				source.position().x,
				source.position().y,
				target._private.style["border-width"].value / 2);
				
			if (intersect.length == 0) {
				edge._private.rscratch.noArrowPlacement = true;
	//			return;
			} else {
				edge._private.rscratch.noArrowPlacement = false;
			}
			
			var arrowEnd = this.shortenIntersection(intersect,
				[source.position().x, source.position().y],
				arrowShapes[edge._private.style["target-arrow-shape"].value].spacing(edge));
			var edgeEnd = this.shortenIntersection(intersect,
				[source.position().x, source.position().y],
				arrowShapes[edge._private.style["target-arrow-shape"].value].gap(edge));

			edge._private.rscratch.endX = edgeEnd[0];
			edge._private.rscratch.endY = edgeEnd[1];
			
			edge._private.rscratch.arrowEndX = arrowEnd[0];
			edge._private.rscratch.arrowEndY = arrowEnd[1];
		
			intersect = nodeShapes[this.getNodeShape(source)].intersectLine(
				source._private.position.x,
				source._private.position.y,
				//source._private.style["width"].value,
				//source._private.style["height"].value,
				this.getNodeWidth(source),
				this.getNodeHeight(source),
				target.position().x,
				target.position().y,
				source._private.style["border-width"].value / 2);
			
			if (intersect.length == 0) {
				edge._private.rscratch.noArrowPlacement = true;
	//			return;
			} else {
				edge._private.rscratch.noArrowPlacement = false;
			}
			
			/*
			console.log("1: "
				+ arrowShapes[edge._private.style["source-arrow-shape"].value],
					edge._private.style["source-arrow-shape"].value);
			*/
			var arrowStart = this.shortenIntersection(intersect,
				[target.position().x, target.position().y],
				arrowShapes[edge._private.style["source-arrow-shape"].value].spacing(edge));
			var edgeStart = this.shortenIntersection(intersect,
				[target.position().x, target.position().y],
				arrowShapes[edge._private.style["source-arrow-shape"].value].gap(edge));

			edge._private.rscratch.startX = edgeStart[0];
			edge._private.rscratch.startY = edgeStart[1];
			
			edge._private.rscratch.arrowStartX = arrowStart[0];
			edge._private.rscratch.arrowStartY = arrowStart[1];
						
		} else if (edge._private.rscratch.edgeType == "bezier") {
			
			var cp = [edge._private.rscratch.cp2x, edge._private.rscratch.cp2y];
			
			// Point at middle of Bezier
			var halfPointX = start[0] * 0.25 + end[0] * 0.25 + cp[0] * 0.5;
			var halfPointY = start[1] * 0.25 + end[1] * 0.25 + cp[1] * 0.5;
			
			intersect = nodeShapes[
				this.getNodeShape(target)].intersectLine(
				target._private.position.x,
				target._private.position.y,
				//target._private.style["width"].value,
				//target._private.style["height"].value,
				this.getNodeWidth(target),
				this.getNodeHeight(target),
				cp[0], //halfPointX,
				cp[1], //halfPointY
				target._private.style["border-width"].value / 2
			);
			
			/*
			console.log("2: "
				+ arrowShapes[edge._private.style["source-arrow-shape"].value],
					edge._private.style["source-arrow-shape"].value);
			*/
			var arrowEnd = this.shortenIntersection(intersect, cp,
				arrowShapes[edge._private.style["target-arrow-shape"].value].spacing(edge));
			var edgeEnd = this.shortenIntersection(intersect, cp,
				arrowShapes[edge._private.style["target-arrow-shape"].value].gap(edge));
			
			edge._private.rscratch.endX = edgeEnd[0];
			edge._private.rscratch.endY = edgeEnd[1];
			
			edge._private.rscratch.arrowEndX = arrowEnd[0];
			edge._private.rscratch.arrowEndY = arrowEnd[1];
			
			intersect = nodeShapes[
				this.getNodeShape(source)].intersectLine(
				source._private.position.x,
				source._private.position.y,
				//source._private.style["width"].value,
				//source._private.style["height"].value,
				this.getNodeWidth(source),
				this.getNodeHeight(source),
				cp[0], //halfPointX,
				cp[1], //halfPointY
				source._private.style["border-width"].value / 2
			);
			
			var arrowStart = this.shortenIntersection(intersect, cp,
				arrowShapes[edge._private.style["source-arrow-shape"].value].spacing(edge));
			var edgeStart = this.shortenIntersection(intersect, cp,
				arrowShapes[edge._private.style["source-arrow-shape"].value].gap(edge));
			
			edge._private.rscratch.startX = edgeStart[0];
			edge._private.rscratch.startY = edgeStart[1];
			
			edge._private.rscratch.arrowStartX = arrowStart[0];
			edge._private.rscratch.arrowStartY = arrowStart[1];
			
		} else if (edge._private.rscratch.isArcEdge) {
			return;
		}
	}

	}

	// @O Graph traversal functions
	{
	
	// Find adjacent edges
	CanvasRenderer.prototype.findEdges = function(nodeSet) {
		
		var edges = this.getCachedEdges();
		
		var hashTable = {};
		var adjacentEdges = [];
		
		for (var i = 0; i < nodeSet.length; i++) {
			hashTable[nodeSet[i]._private.data.id] = nodeSet[i];
		}
		
		for (var i = 0; i < edges.length; i++) {
			if (hashTable[edges[i]._private.data.source]
				|| hashTable[edges[i]._private.data.target]) {
				
				adjacentEdges.push(edges[i]);
			}
		}
		
		return adjacentEdges;
	}
	
	}
	
	// @O Intersection functions
	{
	CanvasRenderer.prototype.intersectLineEllipse = function(
		x, y, centerX, centerY, ellipseWradius, ellipseHradius) {
		
		var dispX = centerX - x;
		var dispY = centerY - y;
		
		dispX /= ellipseWradius;
		dispY /= ellipseHradius;
		
		var len = Math.sqrt(dispX * dispX + dispY * dispY);
		
		var newLength = len - 1;
		
		if (newLength < 0) {
			return [];
		}
		
		var lenProportion = newLength / len;
		
		return [(centerX - x) * lenProportion + x, (centerY - y) * lenProportion + y];
	}
	
	CanvasRenderer.prototype.findCircleNearPoint = function(centerX, centerY, 
		radius, farX, farY) {
		
		var displacementX = farX - centerX;
		var displacementY = farY - centerY;
		var distance = Math.sqrt(displacementX * displacementX 
			+ displacementY * displacementY);
		
		var unitDisplacementX = displacementX / distance;
		var unitDisplacementY = displacementY / distance;
		
		return [centerX + unitDisplacementX * radius, 
			centerY + unitDisplacementY * radius];
	}
	
	CanvasRenderer.prototype.findMaxSqDistanceToOrigin = function(points) {
		var maxSqDistance = 0.000001;
		var sqDistance;
		
		for (var i = 0; i < points.length / 2; i++) {
			
			sqDistance = points[i * 2] * points[i * 2] 
				+ points[i * 2 + 1] * points[i * 2 + 1];
			
			if (sqDistance > maxSqDistance) {
				maxSqDistance = sqDistance;
			}
		}
		
		return maxSqDistance;
	}
	
	CanvasRenderer.prototype.finiteLinesIntersect = function(
		x1, y1, x2, y2, x3, y3, x4, y4, infiniteLines) {
		
		var ua_t = (x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3);
		var ub_t = (x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3);
		var u_b = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);

		if (u_b != 0) {
			var ua = ua_t / u_b;
			var ub = ub_t / u_b;
			
			if (0 <= ua && ua <= 1 && 0 <= ub && ub <= 1) {	
				return [x1 + ua * (x2 - x1), y1 + ua * (y2 - y1)];
				
			} else {
				if (!infiniteLines) {
					return [];
				} else {
					return [x1 + ua * (x2 - x1), y1 + ua * (y2 - y1)];
				}
			}
		} else {
			if (ua_t == 0 || ub_t == 0) {

				// Parallel, coincident lines. Check if overlap

				// Check endpoint of second line
				if ([x1, x2, x4].sort()[1] == x4) {
					return [x4, y4];
				}
				
				// Check start point of second line
				if ([x1, x2, x3].sort()[1] == x3) {
					return [x3, y3];
				}
				
				// Endpoint of first line
				if ([x3, x4, x2].sort()[1] == x2) {
					return [x2, y2];
				}
				
				return [];
			} else {
			
				// Parallel, non-coincident
				return [];
			}
		}
	}
	
	CanvasRenderer.prototype.boxIntersectEllipse = function(
		x1, y1, x2, y2, padding, width, height, centerX, centerY) {
		
		if (x2 < x1) {
			var oldX1 = x1;
			x1 = x2;
			x2 = oldX1;
		}
		
		if (y2 < y1) {
			var oldY1 = y1;
			y1 = y2;
			y2 = oldY1;
		}
		
		// 4 ortho extreme points
		var west = [centerX - width / 2 - padding, centerY];
		var east = [centerX + width / 2 + padding, centerY];
		var north = [centerX, centerY - height / 2 - padding];
		var south = [centerX, centerY + height / 2 + padding];
		
		// out of bounds: return false
		if (x2 < west[0]) {
			return false;
		}
		
		if (x1 > east[0]) {
			return false;
		}
		
		if (y1 > south[1]) {
			return false;
		}
		
		if (y2 < north[1]) {
			return false;
		}
		
		// 1 of 4 ortho extreme points in box: return true
		if (x1 <= east[0] && east[0] <= x2
				&& y1 <= east[1] && east[1] <= y2) {
			return true;
		}
		
		if (x1 <= west[0] && west[0] <= x2
				&& y1 <= west[1] && west[1] <= y2) {
			return true;
		}
		
		if (x1 <= north[0] && north[0] <= x2
				&& y1 <= north[1] && north[1] <= y2) {
			return true;
		}
		
		if (x1 <= south[0] && south[0] <= x2
				&& y1 <= south[1] && south[1] <= y2) {
			return true;
		}
		
		// box corner in ellipse: return true		
		x1 = (x1 - centerX) / (width / 2 + padding);
		x2 = (x2 - centerX) / (width / 2 + padding);
		
		y1 = (y1 - centerY) / (height / 2 + padding);
		y2 = (y2 - centerY) / (height / 2 + padding);
		
		if (x1 * x1 + y1 * y1 <= 1) {
			return true;
		}
		
		if (x2 * x2 + y1 * y1 <= 1) {
			return true;
		}
		
		if (x2 * x2 + y2 * y2 <= 1) {
			return true;
		}
		
		if (x1 * x1 + y2 * y2 <= 1) {
			return true;
		}
		
		return false;
	}
	
	CanvasRenderer.prototype.boxIntersectPolygon = function(
		x1, y1, x2, y2, basePoints, width, height, centerX, centerY, direction, padding) {
		
//		console.log(arguments);
		
		if (x2 < x1) {
			var oldX1 = x1;
			x1 = x2;
			x2 = oldX1;
		}
		
		if (y2 < y1) {
			var oldY1 = y1;
			y1 = y2;
			y2 = oldY1;
		}
		
		var transformedPoints = new Array(basePoints.length)
		
		// Gives negative of angle
		var angle = Math.asin(direction[1] / (Math.sqrt(direction[0] * direction[0] 
			+ direction[1] * direction[1])));
		
		if (direction[0] < 0) {
			angle = angle + Math.PI / 2;
		} else {
			angle = -angle - Math.PI / 2;
		}
		
		var cos = Math.cos(-angle);
		var sin = Math.sin(-angle);
		
		for (var i = 0; i < transformedPoints.length / 2; i++) {
			transformedPoints[i * 2] = 
				width / 2 * (basePoints[i * 2] * cos
					- basePoints[i * 2 + 1] * sin);
			
			transformedPoints[i * 2 + 1] = 
				height / 2 * (basePoints[i * 2 + 1] * cos 
					+ basePoints[i * 2] * sin);
			
			transformedPoints[i * 2] += centerX;
			transformedPoints[i * 2 + 1] += centerY;
		}
		
		// Assume transformedPoints.length > 0, and check if intersection is possible
		var minTransformedX = transformedPoints[0];
		var maxTransformedX = transformedPoints[0];
		var minTransformedY = transformedPoints[1];
		var maxTransformedY = transformedPoints[1];
		
		for (var i = 1; i < transformedPoints.length / 2; i++) {
			if (transformedPoints[i * 2] > maxTransformedX) {
				maxTransformedX = transformedPoints[i * 2];
			}
			
			if (transformedPoints[i * 2] < minTransformedX) {
				minTransformedX = transformedPoints[i * 2];
			}
			
			if (transformedPoints[i * 2 + 1] > maxTransformedY) {
				maxTransformedY = transformedPoints[i * 2 + 1];
			}
			
			if (transformedPoints[i * 2 + 1] < minTransformedY) {
				minTransformedY = transformedPoints[i * 2 + 1];
			}
		}
		
		if (x2 < minTransformedX - padding) {
			return false;
		}
		
		if (x1 > maxTransformedX + padding) {
			return false;
		}
		
		if (y2 < minTransformedY - padding) {
			return false;
		}
		
		if (y1 > maxTransformedY + padding) {
			return false;
		}
		
		// Continue checking with padding-corrected points
		var points;
		
		if (padding > 0) {
			var expandedLineSet = renderer.expandPolygon(
				transformedPoints,
				-padding);
			
			points = renderer.joinLines(expandedLineSet);
		} else {
			points = transformedPoints;
		}
		
		// Check if a point is in box
		for (var i = 0; i < transformedPoints.length / 2; i++) {
			if (x1 <= transformedPoints[i * 2]
					&& transformedPoints[i * 2] <= x2) {
				
				if (y1 <= transformedPoints[i * 2 + 1]
						&& transformedPoints[i * 2 + 1] <= y2) {
					
					return true;
				}
			}
		}
		
		
		// Check for intersections with the selection box
		for (var i = 0; i < points.length / 2; i++) {
			
			var currentX = points[i * 2];
			var currentY = points[i * 2 + 1];
			var nextX;
			var nextY;
			
			if (i < points.length / 2 - 1) {
				nextX = points[(i + 1) * 2];
				nextY = points[(i + 1) * 2 + 1]
			} else {
				nextX = points[0];
				nextY = points[1];
			}
			
			// Intersection with top of selection box
			if (renderer.finiteLinesIntersect(currentX, currentY, nextX, nextY, x1, y1, x2, y1, false).length > 0) {
				return true;
			}
			
			// Intersection with bottom of selection box
			if (renderer.finiteLinesIntersect(currentX, currentY, nextX, nextY, x1, y2, x2, y2, false).length > 0) {
				return true;
			}
			
			// Intersection with left side of selection box
			if (renderer.finiteLinesIntersect(currentX, currentY, nextX, nextY, x1, y1, x1, y2, false).length > 0) {
				return true;
			}
			
			// Intersection with right side of selection box
			if (renderer.finiteLinesIntersect(currentX, currentY, nextX, nextY, x2, y1, x2, y2, false).length > 0) {
				return true;
			}
		}

		/*
		// Check if box corner in the polygon
		if (renderer.pointInsidePolygon(
			x1, y1, points, 0, 0, 1, 1, 0, direction)) {
			
			return true;
		} else if (renderer.pointInsidePolygon(
			x1, y2, points, 0, 0, 1, 1, 0, direction)) {
			
			return true;
		} else if (renderer.pointInsidePolygon(
			x2, y2, points, 0, 0, 1, 1, 0, direction)) {
			 
			return true; 
		} else if (renderer.pointInsidePolygon(
			x2, y1, points, 0, 0, 1, 1, 0, direction)) {
			
			return true;
		}
		*/
		return false;
	}
	
	CanvasRenderer.prototype.polygonIntersectLine = function(
		x, y, basePoints, centerX, centerY, width, height, padding) {
		
		var intersections = [];
		var intersection;
		
		var transformedPoints = new Array(basePoints.length);
		
		for (var i = 0; i < transformedPoints.length / 2; i++) {
			transformedPoints[i * 2] = basePoints[i * 2] * width + centerX;
			transformedPoints[i * 2 + 1] = basePoints[i * 2 + 1] * height + centerY;
		}
		
		var points;
		
		if (padding > 0) {
			var expandedLineSet = renderer.expandPolygon(
				transformedPoints,
				-padding);
			
			points = renderer.joinLines(expandedLineSet);
		} else {
			points = transformedPoints;
		}
		// var points = transformedPoints;
		
		var currentX, currentY, nextX, nextY;
		
		for (var i = 0; i < points.length / 2; i++) {
		
			currentX = points[i * 2];
			currentY = points[i * 2 + 1];

			if (i < points.length / 2 - 1) {
				nextX = points[(i + 1) * 2]; 
				nextY = points[(i + 1) * 2 + 1];
			} else {
				nextX = points[0]; 
				nextY = points[1];
			}
			
			intersection = this.finiteLinesIntersect(
				x, y, centerX, centerY,
				currentX, currentY,
				nextX, nextY);
			
			if (intersection.length != 0) {
				intersections.push(intersection[0], intersection[1]);
			}
		}
		
		return intersections;
	}
	
	CanvasRenderer.prototype.shortenIntersection = function(
		intersection, offset, amount) {
		
		var disp = [intersection[0] - offset[0], intersection[1] - offset[1]];
		
		var length = Math.sqrt(disp[0] * disp[0] + disp[1] * disp[1]);
		
		var lenRatio = (length - amount) / length;
		
		if (lenRatio < 0) {
			return [];
		} else {
			return [offset[0] + lenRatio * disp[0], offset[1] + lenRatio * disp[1]];
		}
	}
	}
	
	// @O Arrow shapes
	{
	// Contract for arrow shapes:
	{
	// 0, 0 is arrow tip
	// (0, 1) is direction towards node
	// (1, 0) is right
	//
	// functional api:
	// collide: check x, y in shape
	// roughCollide: called before collide, no false negatives
	// draw: draw
	// spacing: dist(arrowTip, nodeBoundary)
	// gap: dist(edgeTip, nodeBoundary), edgeTip may != arrowTip
	}
	
	// Declarations
	{
	arrowShapes["arrow"] = {
		_points: [
			-0.15, -0.3,
			0, 0,
			0.15, -0.3
		],
		collide: function(x, y, centerX, centerY, width, height, direction, padding) {
			var points = arrowShapes["arrow"]._points;
			
//			console.log("collide(): " + direction);
			
			return rendFunc.pointInsidePolygon(
				x, y, points, centerX, centerY, width, height, direction, padding);
		},
		roughCollide: function(x, y, centerX, centerY, width, height, direction, padding) {
			if (typeof(arrowShapes["arrow"]._farthestPointSqDistance) == "undefined") {
				arrowShapes["arrow"]._farthestPointSqDistance = 
					rendFunc.findMaxSqDistanceToOrigin(arrowShapes["arrow"]._points);
			}
		
			return rendFunc.checkInBoundingCircle(
				x, y, arrowShapes["arrow"]._farthestPointSqDistance,
				0, width, height, centerX, centerY);
		},
		draw: function(context) {
			var points = arrowShapes["arrow"]._points;
		
			for (var i = 0; i < points.length / 2; i++) {
				context.lineTo(points[i * 2], points[i * 2 + 1]);
			}
		},
		spacing: function(edge) {
			return 0;
		},
		gap: function(edge) {
			return edge._private.style["width"].value * 2;
		}
	}
	
	arrowShapes["triangle"] = arrowShapes["arrow"];
	
	arrowShapes["none"] = {
		collide: function(x, y, centerX, centerY, width, height, direction, padding) {
			return false;
		},
		roughCollide: function(x, y, centerX, centerY, width, height, direction, padding) {
			return false;
		},
		draw: function(context) {
		},
		spacing: function(edge) {
			return 0;
		},
		gap: function(edge) {
			return 0;
		}
	}
	
	arrowShapes["circle"] = {
		_baseRadius: 0.15,
		
		collide: function(x, y, centerX, centerY, width, height, direction, padding) {
			// Transform x, y to get non-rotated ellipse
			
			if (width != height) {
				// This gives negative of the angle
				var angle = Math.asin(direction[1] / 
					(Math.sqrt(direction[0] * direction[0] 
						+ direction[1] * direction[1])));
			
				var cos = Math.cos(-angle);
				var sin = Math.sin(-angle);
				
				var rotatedPoint = 
					[x * cos - y * sin,
						y * cos + x * sin];
				
				var aspectRatio = (height + padding) / (width + padding);
				y /= aspectRatio;
				centerY /= aspectRatio;
				
				return (Math.pow(centerX - x, 2) 
					+ Math.pow(centerY - y, 2) <= Math.pow((width + padding)
						* arrowShapes["circle"]._baseRadius, 2));
			} else {
				return (Math.pow(centerX - x, 2) 
					+ Math.pow(centerY - y, 2) <= Math.pow((width + padding)
						* arrowShapes["circle"]._baseRadius, 2));
			}
		},
		roughCollide: function(x, y, centerX, centerY, width, height, direction, padding) {
			return true;
		},
		draw: function(context) {
			context.arc(0, 0, arrowShapes["circle"]._baseRadius, 0, Math.PI * 2, false);
		},
		spacing: function(edge) {
			return rendFunc.getArrowWidth(edge._private.style["width"].value)
				* arrowShapes["circle"]._baseRadius;
		},
		gap: function(edge) {
			return edge._private.style["width"].value * 2;
		}
	}
	
	arrowShapes["inhibitor"] = {
		_points: [
			-0.25, 0,
			-0.25, -0.1,
			0.25, -0.1,
			0.25, 0
		],
		collide: function(x, y, centerX, centerY, width, height, direction, padding) {
			var points = arrowShapes["inhibitor"]._points;
			
			return rendFunc.pointInsidePolygon(
				x, y, points, centerX, centerY, width, height, direction, padding);
		},
		roughCollide: function(x, y, centerX, centerY, width, height, direction, padding) {
			if (typeof(arrowShapes["inhibitor"]._farthestPointSqDistance) == "undefined") {
				arrowShapes["inhibitor"]._farthestPointSqDistance = 
					rendFunc.findMaxSqDistanceToOrigin(arrowShapes["inhibitor"]._points);
			}
		
			return rendFunc.checkInBoundingCircle(
				x, y, arrowShapes["inhibitor"]._farthestPointSqDistance,
				0, width, height, centerX, centerY);
		},
		draw: function(context) {
			var points = arrowShapes["inhibitor"]._points;
			
			for (var i = 0; i < points.length / 2; i++) {
				context.lineTo(points[i * 2], points[i * 2 + 1]);
			}
		},
		spacing: function(edge) {
			return 4;
		},
		gap: function(edge) {
			return 4;
		}
	}
	
	arrowShapes["square"] = {
		_points: [
			-0.12, 0.00,
			0.12, 0.00,
			0.12, -0.24,
			-0.12, -0.24
		],
		collide: function(x, y, centerX, centerY, width, height, direction, padding) {
			var points = arrowShapes["square"]._points;
			
			return rendFunc.pointInsidePolygon(
				x, y, points, centerX, centerY, width, height, direction, padding);
		},
		roughCollide: function(x, y, centerX, centerY, width, height, direction, padding) {
			if (typeof(arrowShapes["square"]._farthestPointSqDistance) == "undefined") {
				arrowShapes["square"]._farthestPointSqDistance = 
					rendFunc.findMaxSqDistanceToOrigin(arrowShapes["square"]._points);
			}
		
			return rendFunc.checkInBoundingCircle(
				x, y, arrowShapes["square"]._farthestPointSqDistance,
				0, width, height, centerX, centerY);
		},
		draw: function(context) {
			var points = arrowShapes["square"]._points;
		
			for (var i = 0; i < points.length / 2; i++) {
				context.lineTo(points[i * 2], points[i * 2 + 1]);
			}
		},
		spacing: function(edge) {
			return 0;
		},
		gap: function(edge) {
			return edge._private.style["width"].value * 2;
		}
	}
	
	arrowShapes["diamond"] = {
		_points: [
			-0.14, -0.14,
			0, -0.28,
			0.14, -0.14,
			0, 0
		],
		collide: function(x, y, centerX, centerY, width, height, direction, padding) {
			var points = arrowShapes["diamond"]._points;
					
			return rendFunc.pointInsidePolygon(
				x, y, points, centerX, centerY, width, height, direction, padding);
		},
		roughCollide: function(x, y, centerX, centerY, width, height, direction, padding) {
			if (typeof(arrowShapes["diamond"]._farthestPointSqDistance) == "undefined") {
				arrowShapes["diamond"]._farthestPointSqDistance = 
					rendFunc.findMaxSqDistanceToOrigin(arrowShapes["diamond"]._points);
			}
				
			return rendFunc.checkInBoundingCircle(
				x, y, arrowShapes["diamond"]._farthestPointSqDistance,
				0, width, height, centerX, centerY);
		},
		draw: function(context) {
//			context.translate(0, 0.16);
			context.lineTo(-0.14, -0.14);
			context.lineTo(0, -0.28);
			context.lineTo(0.14, -0.14);
			context.lineTo(0, 0.0);
		},
		spacing: function(edge) {
			return 0;
		},
		gap: function(edge) {
			return edge._private.style["width"].value * 2;
		}
	}
	
	arrowShapes["tee"] = arrowShapes["inhibitor"];
	}
	
	// @O Arrow shape sizing (w + l)
	{
	
	CanvasRenderer.prototype.getArrowWidth = function(edgeWidth) {
		return Math.max(Math.pow(edgeWidth * 13.37, 0.9), 29);
	}
	
	CanvasRenderer.prototype.getArrowHeight = function(edgeWidth) {
		return Math.max(Math.pow(edgeWidth * 13.37, 0.9), 29);
	}
	
	}
	
	// @O Arrow shape drawing
	
	// Draw arrowheads on edge
	CanvasRenderer.prototype.drawArrowheads = function(context, edge, drawOverlayInstead) {
		if( drawOverlayInstead ){ return; } // don't do anything for overlays 

		// Displacement gives direction for arrowhead orientation
		var dispX, dispY;

		var startX = edge._private.rscratch.arrowStartX;
		var startY = edge._private.rscratch.arrowStartY;
		
		dispX = startX - edge.source().position().x;
		dispY = startY - edge.source().position().y;
		
		//this.context.strokeStyle = "rgba("
		context.fillStyle = "rgba("
			+ edge._private.style["source-arrow-color"].value[0] + ","
			+ edge._private.style["source-arrow-color"].value[1] + ","
			+ edge._private.style["source-arrow-color"].value[2] + ","
			+ edge._private.style.opacity.value + ")";
		
		context.lineWidth = edge._private.style["width"].value;
		
		this.drawArrowShape(context, edge._private.style["source-arrow-shape"].value, 
			startX, startY, dispX, dispY);
		
		var endX = edge._private.rscratch.arrowEndX;
		var endY = edge._private.rscratch.arrowEndY;
		
		dispX = endX - edge.target().position().x;
		dispY = endY - edge.target().position().y;
		
		//this.context.strokeStyle = "rgba("
		context.fillStyle = "rgba("
			+ edge._private.style["target-arrow-color"].value[0] + ","
			+ edge._private.style["target-arrow-color"].value[1] + ","
			+ edge._private.style["target-arrow-color"].value[2] + ","
			+ edge._private.style.opacity.value + ")";
		
		context.lineWidth = edge._private.style["width"].value;
		
		this.drawArrowShape(context, edge._private.style["target-arrow-shape"].value,
			endX, endY, dispX, dispY);
	}
	
	// Draw arrowshape
	CanvasRenderer.prototype.drawArrowShape = function(context, shape, x, y, dispX, dispY) {
	
		// Negative of the angle
		var angle = Math.asin(dispY / (Math.sqrt(dispX * dispX + dispY * dispY)));
	
		if (dispX < 0) {
			//context.strokeStyle = "AA99AA";
			angle = angle + Math.PI / 2;
		} else {
			//context.strokeStyle = "AAAA99";
			angle = - (Math.PI / 2 + angle);
		}
		
		//context.save();
		context.translate(x, y);
		
		context.moveTo(0, 0);
		context.rotate(-angle);
		
		var size = this.getArrowWidth(context.lineWidth);
		/// size = 100;
		context.scale(size, size);
		
		context.beginPath();
		
		arrowShapes[shape].draw(context);
		
		context.closePath();
		
//		context.stroke();
		context.fill();

		context.scale(1/size, 1/size);
		context.rotate(angle);
		context.translate(-x, -y);
		//context.restore();
	}

	}
	
	// @O Node shapes
	{
	
	// Generate polygon points
	var generateUnitNgonPoints = function(sides, rotationRadians) {
		
		var increment = 1.0 / sides * 2 * Math.PI;
		var startAngle = sides % 2 == 0 ? 
			Math.PI / 2.0 + increment / 2.0 : Math.PI / 2.0;
//		console.log(nodeShapes["square"]);
		startAngle += rotationRadians;
		
		var points = new Array(sides * 2);
		
		var currentAngle;
		for (var i = 0; i < sides; i++) {
			currentAngle = i * increment + startAngle;
			
			points[2 * i] = Math.cos(currentAngle);// * (1 + i/2);
			points[2 * i + 1] = Math.sin(-currentAngle);//  * (1 + i/2);
		}
		
		// The above generates points for a polygon inscribed in a radius 1 circle.
		// Stretch so that the maximum of the height and width becomes 2 so the resulting
		// scaled shape appears to be inscribed inside a rectangle with the given
		// width and height. The maximum of the width and height is used to preserve
		// the shape's aspect ratio.
		
		// Stretch width
		var maxAbsX = 0
		var maxAbsY = 0;
		for (var i = 0; i < points.length / 2; i++) {
			if (Math.abs(points[2 * i] > maxAbsX)) {
				maxAbsX = Math.abs(points[2 * i]);
			}
			
			if (Math.abs(points[2 * i + 1] > maxAbsY)) {
				maxAbsY = Math.abs(points[2 * i + 1]);
			}
		}
		
		var minScaleLimit = 0.0005;
		
		// Use the larger dimension to do the scale, in order to preserve the shape's
		// aspect ratio
		var maxDimension = Math.max(maxAbsX, maxAbsY);
		
		for (var i = 0; i < points.length / 2; i++) {
			if (maxDimension > minScaleLimit) {
				points[2 * i] *= (1 / maxDimension);
				points[2 * i + 1] *= (1 / maxDimension);
			}
		}
		
		return points;
	}
	
	// Node shape declarations
	
	// Contract for node shapes:
	{
	// Node shape contract:
	//
	// draw: draw
	// intersectLine: report intersection from x, y, to node center
	// checkPointRough: heuristic check x, y in node, no false negatives
	// checkPoint: check x, y in node
	}
	
	// Declarations
	{
	
	var renderer = rendFunc;	
	
	nodeShapes["ellipse"] = {
		draw: function(context, centerX, centerY, width, height) {
			nodeShapes["ellipse"].drawPath(context, centerX, centerY, width, height);
			context.fill();
			
//			console.log("drawing ellipse");
//			console.log(arguments);
		},
		
		drawPath: function(context, centerX, centerY, width, height) {
			
			//context.save();
			
			context.beginPath();
			context.translate(centerX, centerY);
			context.scale(width / 2, height / 2);
			// At origin, radius 1, 0 to 2pi
			context.arc(0, 0, 1, 0, Math.PI * 2 * 0.999, false); // *0.999 b/c chrome rendering bug on full circle
			context.closePath();

			context.scale(2/width, 2/height);
			context.translate(-centerX, -centerY);
			//context.restore();
			
//			console.log("drawing ellipse");
//			console.log(arguments);
			
		},
		
		intersectLine: function(nodeX, nodeY, width, height, x, y, padding) {
			var intersect = rendFunc.intersectLineEllipse(
				x, y,
				nodeX,
				nodeY,
				width / 2 + padding,
				height / 2 + padding);
			
			return intersect;
		},
		
		intersectBox: function(
			x1, y1, x2, y2, width, height, centerX, centerY, padding) {
			
			return CanvasRenderer.prototype.boxIntersectEllipse(
				x1, y1, x2, y2, padding, width, height, centerX, centerY);
		},
		
		checkPointRough: function(
			x, y, padding, width, height, centerX, centerY) {
		
			return true;
		},
		
		checkPoint: function(
			x, y, padding, width, height, centerX, centerY) {
			
//			console.log(arguments);
			
			x -= centerX;
			y -= centerY;
			
			x /= (width + padding);
			y /= (height + padding);
			
			return (Math.pow(x, 2) + Math.pow(y, 2) <= 1);
		}
	}
	
	nodeShapes["triangle"] = {
		points: generateUnitNgonPoints(3, 0),
		
		draw: function(context, centerX, centerY, width, height) {
			renderer.drawPolygon(context,
				centerX, centerY,
				width, height,
				nodeShapes["triangle"].points);
		},
		
		drawPath: function(context, centerX, centerY, width, height) {
			renderer.drawPolygonPath(context,
				centerX, centerY,
				width, height,
				nodeShapes["triangle"].points);
		},
		
		intersectLine: function(nodeX, nodeY, width, height, x, y, padding) {
			return renderer.polygonIntersectLine(
				x, y,
				nodeShapes["triangle"].points,
				nodeX,
				nodeY,
				width / 2, height / 2,
				padding);
		
			/*
			polygonIntersectLine(x, y, basePoints, centerX, centerY, 
				width, height, padding);
			*/
			
			
			/*
			return renderer.polygonIntersectLine(
				node, width, height,
				x, y, nodeShapes["triangle"].points);
			*/
		},
		
		intersectBox: function(
			x1, y1, x2, y2, width, height, centerX, centerY, padding) {
			
			var points = nodeShapes["triangle"].points;
			
			return renderer.boxIntersectPolygon(
				x1, y1, x2, y2,
				points, width, height, centerX, centerY, [0, -1], padding);
		},
		
		checkPointRough: function(
			x, y, padding, width, height, centerX, centerY) {
		
			return renderer.checkInBoundingBox(
				x, y, nodeShapes["triangle"].points, // Triangle?
					padding, width, height, centerX, centerY);
		},
		
		checkPoint: function(
			x, y, padding, width, height, centerX, centerY) {
			
			return renderer.pointInsidePolygon(
				x, y, nodeShapes["triangle"].points,
				centerX, centerY, width, height,
				[0, -1], padding);
		}
	}
	
	nodeShapes["square"] = {
		points: generateUnitNgonPoints(4, 0),
		
		draw: function(context, centerX, centerY, width, height) {
			renderer.drawPolygon(context,
				centerX, centerY,
				width, height,
				nodeShapes["square"].points);
		},
		
		drawPath: function(context, centerX, centerY, width, height) {
			renderer.drawPolygonPath(context,
				centerX, centerY,
				width, height,
				nodeShapes["square"].points);
		},
		
		intersectLine: function(nodeX, nodeY, width, height, x, y, padding) {
			return renderer.polygonIntersectLine(
					x, y,
					nodeShapes["square"].points,
					nodeX,
					nodeY,
					width / 2, height / 2,
					padding);
		},
		
		intersectBox: function(
			x1, y1, x2, y2,
			width, height, centerX, 
			centerY, padding) {
			
			var points = nodeShapes["square"].points;
			
			return renderer.boxIntersectPolygon(
				x1, y1, x2, y2,
				points, width, height, centerX, 
				centerY, [0, -1], padding);
		},
		
		checkPointRough: function(
			x, y, padding, width, height,
			centerX, centerY) {
		
			return renderer.checkInBoundingBox(
				x, y, nodeShapes["square"].points, 
					padding, width, height, centerX, centerY);
		},
		
		checkPoint: function(
			x, y, padding, width, height, centerX, centerY) {
			
			return renderer.pointInsidePolygon(x, y, nodeShapes["square"].points,
				centerX, centerY, width, height, [0, -1], padding);
		}
	}
	
	nodeShapes["rectangle"] = nodeShapes["square"];
	
	nodeShapes["octogon"] = {};
	
	nodeShapes["roundrectangle"] = nodeShapes["square"];
	
	nodeShapes["roundrectangle2"] = {
		roundness: 4.99,
		
		draw: function(node, width, height) {
			if (width <= roundness * 2) {
				return;
			}
		
			renderer.drawPolygon(node._private.position.x,
				node._private.position.y, width, height, nodeSapes["roundrectangle2"].points);
		},

		intersectLine: function(node, width, height, x, y) {
			return renderer.findPolygonIntersection(
				node, width, height, x, y, nodeShapes["square"].points);
		},
		
		// TODO: Treat rectangle as sharp-cornered for now. This is a not-large approximation.
		intersectBox: function(x1, y1, x2, y2, width, height, centerX, centerY, padding) {
			var points = nodeShapes["square"].points;
			
			/*
			return renderer.boxIntersectPolygon(
				x1, y1, x2, y2,
				points, 
			*/
		}	
	}
	
	/*
	function PolygonNodeShape(points) {
		this.points = points;
		
		this.draw = function(context, node, width, height) {
			renderer.drawPolygon(context,
					node._private.position.x,
					node._private.position.y,
					width, height, nodeShapes["pentagon"].points);
		};
		
		this.drawPath = 
	}
	*/
	
	nodeShapes["pentagon"] = {
		points: generateUnitNgonPoints(5, 0),
		
		draw: function(context, centerX, centerY, width, height) {
			renderer.drawPolygon(context,
				centerX, centerY,
				width, height, nodeShapes["pentagon"].points);
		},
		
		drawPath: function(context, centerX, centerY, width, height) {
			renderer.drawPolygonPath(context,
				centerX, centerY,
				width, height, nodeShapes["pentagon"].points);
		},
		
		intersectLine: function(nodeX, nodeY, width, height, x, y, padding) {
			return renderer.polygonIntersectLine(
				x, y,
				nodeShapes["pentagon"].points,
				nodeX,
				nodeY,
				width / 2, height / 2,
				padding);
		},
		
		intersectBox: function(
			x1, y1, x2, y2, width, height, centerX, centerY, padding) {
			
			var points = nodeShapes["pentagon"].points;
			
			return renderer.boxIntersectPolygon(
				x1, y1, x2, y2,
				points, width, height, centerX, centerY, [0, -1], padding);
		},
		
		checkPointRough: function(
			x, y, padding, width, height, centerX, centerY) {
		
			return renderer.checkInBoundingBox(
				x, y, nodeShapes["pentagon"].points, 
					padding, width, height, centerX, centerY);
		},
		
		checkPoint: function(
			x, y, padding, width, height, centerX, centerY) {
			
			return renderer.pointInsidePolygon(x, y, nodeShapes["pentagon"].points,
				centerX, centerY, width, height, [0, -1], padding);
		}
	}
	
	nodeShapes["hexagon"] = {
		points: generateUnitNgonPoints(6, 0),
		
		draw: function(context, centerX, centerY, width, height) {
			renderer.drawPolygon(context,
				centerX, centerY,
				width, height,
				nodeShapes["hexagon"].points);
		},
		
		drawPath: function(context, centerX, centerY, width, height) {
			renderer.drawPolygonPath(context,
				centerX, centerY,
				width, height,
				nodeShapes["hexagon"].points);
		},
		
		intersectLine: function(nodeX, nodeY, width, height, x, y, padding) {
			return renderer.polygonIntersectLine(
				x, y,
				nodeShapes["hexagon"].points,
				nodeX,
				nodeY,
				width / 2, height / 2,
				padding);
		},
		
		intersectBox: function(
				x1, y1, x2, y2, width, height, centerX, centerY, padding) {
				
			var points = nodeShapes["hexagon"].points;
			
			return renderer.boxIntersectPolygon(
				x1, y1, x2, y2,
				points, width, height, centerX, centerY, [0, -1], padding);
		},
		
		checkPointRough: function(
			x, y, padding, width, height, centerX, centerY) {
		
			return renderer.checkInBoundingBox(
				x, y, nodeShapes["hexagon"].points, 
					padding, width, height, centerX, centerY);
		},
		
		checkPoint: function(
			x, y, padding, width, height, centerX, centerY) {
			
			return renderer.pointInsidePolygon(x, y, nodeShapes["hexagon"].points,
				centerX, centerY, width, height, [0, -1], padding);
		}
	}
	
	nodeShapes["heptagon"] = {
		points: generateUnitNgonPoints(7, 0),
		
		draw: function(context, centerX, centerY, width, height) {
			renderer.drawPolygon(context,
				centerX, centerY,
				width, height,
				nodeShapes["heptagon"].points);
		},
		
		drawPath: function(context, centerX, centerY, width, height) {
			renderer.drawPolygonPath(context,
				centerX, centerY,
				width, height,
				nodeShapes["heptagon"].points);
		},
		
		intersectLine: function(nodeX, nodeY, width, height, x, y, padding) {
			return renderer.polygonIntersectLine(
				x, y,
				nodeShapes["heptagon"].points,
				nodeX,
				nodeY,
				width / 2, height / 2,
				padding);
		},
		
		intersectBox: function(
				x1, y1, x2, y2, width, height, centerX, centerY, padding) {
			
			var points = nodeShapes["heptagon"].points;
			
			return renderer.boxIntersectPolygon(
				x1, y1, x2, y2,
				points, width, height, centerX, centerY, [0, -1], padding);
		},
		
		checkPointRough: function(
			x, y, padding, width, height, centerX, centerY) {
		
			return renderer.checkInBoundingBox(
				x, y, nodeShapes["heptagon"].points, 
					padding, width, height, centerX, centerY);
		},
		
		checkPoint: function(
			x, y, padding, width, height, centerX, centerY) {
			
			return renderer.pointInsidePolygon(x, y, nodeShapes["heptagon"].points,
				centerX, centerY, width, height, [0, -1], padding);
		}
	}
	
	nodeShapes["octagon"] = {
		points: generateUnitNgonPoints(8, 0),
		
		draw: function(context, centerX, centerY, width, height) {
			renderer.drawPolygon(context,
				centerX, centerY,
				width, height,
				nodeShapes["octagon"].points);
		},
		
		drawPath: function(context, centerX, centerY, width, height) {
			renderer.drawPolygonPath(context,
				centerX, centerY,
				width, height,
				nodeShapes["octagon"].points);
		},
		
		intersectLine: function(nodeX, nodeY, width, height, x, y, padding) {
			return renderer.polygonIntersectLine(
				x, y,
				nodeShapes["octagon"].points,
				nodeX,
				nodeY,
				width / 2, height / 2,
				padding);
		},
		
		intersectBox: function(
				x1, y1, x2, y2, width, height, centerX, centerY, padding) {
			
			var points = nodeShapes["octagon"].points;
			
			return renderer.boxIntersectPolygon(
					x1, y1, x2, y2,
					points, width, height, centerX, centerY, [0, -1], padding);
		},
		
		checkPointRough: function(
			x, y, padding, width, height, centerX, centerY) {
		
			return renderer.checkInBoundingBox(
				x, y, nodeShapes["octagon"].points, 
					padding, width, height, centerX, centerY);
		},
		
		checkPoint: function(
			x, y, padding, width, height, centerX, centerY) {
			
			return renderer.pointInsidePolygon(x, y, nodeShapes["octagon"].points,
				centerX, centerY, width, height, [0, -1], padding);
		}
	};
	
	var star5Points = new Array(20);
	{
		var outerPoints = generateUnitNgonPoints(5, 0);
		var innerPoints = generateUnitNgonPoints(5, Math.PI / 5);
		
//		console.log(outerPoints);
//		console.log(innerPoints);
		
		// Outer radius is 1; inner radius of star is smaller
		var innerRadius = 0.5 * (3 - Math.sqrt(5));
		innerRadius *= 1.57;
		
		for (var i=0;i<innerPoints.length/2;i++) {
			innerPoints[i*2] *= innerRadius;
			innerPoints[i*2+1] *= innerRadius;
		}
		
		for (var i=0;i<20/4;i++) {
			star5Points[i*4] = outerPoints[i*2];
			star5Points[i*4+1] = outerPoints[i*2+1];
			
			star5Points[i*4+2] = innerPoints[i*2];
			star5Points[i*4+3] = innerPoints[i*2+1];
		}
		
//		console.log(star5Points);
	}
	
	nodeShapes["star5"] = {
		points: star5Points,
		
		draw: function(context, centerX, centerY, width, height) {
			renderer.drawPolygon(context,
				centerX, centerY,
				width, height,
				nodeShapes["star5"].points);
		},
		
		drawPath: function(context, centerX, centerY, width, height) {
			renderer.drawPolygonPath(context,
				centerX, centerY,
				width, height,
				nodeShapes["star5"].points);
		},
		
		intersectLine: function(nodeX, nodeY, width, height, x, y, padding) {
			return renderer.polygonIntersectLine(
				x, y,
				nodeShapes["star5"].points,
				nodeX,
				nodeY,
				width / 2, height / 2,
				padding);
		},
		
		intersectBox: function(
				x1, y1, x2, y2, width, height, centerX, centerY, padding) {
			
			var points = nodeShapes["star5"].points;
			
			return renderer.boxIntersectPolygon(
					x1, y1, x2, y2,
					points, width, height, centerX, centerY, [0, -1], padding);
		},
		
		checkPointRough: function(
			x, y, padding, width, height, centerX, centerY) {
		
			return renderer.checkInBoundingBox(
				x, y, nodeShapes["star5"].points, 
					padding, width, height, centerX, centerY);
		},
		
		checkPoint: function(
			x, y, padding, width, height, centerX, centerY) {
			
			return renderer.pointInsidePolygon(x, y, nodeShapes["star5"].points,
				centerX, centerY, width, height, [0, -1], padding);
		}
	};
	
	}

	}
	
	// @O Polygon calculations
	{
	CanvasRenderer.prototype.expandPolygon = function(points, pad) {
		
		var expandedLineSet = new Array(points.length * 2);
		
		var currentPointX, currentPointY, nextPointX, nextPointY;
		
		for (var i = 0; i < points.length / 2; i++) {
			currentPointX = points[i * 2];
			currentPointY = points[i * 2 + 1];
			
			if (i < points.length / 2 - 1) {
				nextPointX = points[(i + 1) * 2];
				nextPointY = points[(i + 1) * 2 + 1];
			} else {
				nextPointX = points[0];
				nextPointY = points[1];
			}
			
			// Current line: [currentPointX, currentPointY] to [nextPointX, nextPointY]
			
			// Assume CCW polygon winding
			
			var offsetX = (nextPointY - currentPointY);
			var offsetY = -(nextPointX - currentPointX);
			
			// Normalize
			var offsetLength = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
			var normalizedOffsetX = offsetX / offsetLength;
			var normalizedOffsetY = offsetY / offsetLength;
			
			expandedLineSet[i * 4] = currentPointX + normalizedOffsetX * pad;
			expandedLineSet[i * 4 + 1] = currentPointY + normalizedOffsetY * pad;
			expandedLineSet[i * 4 + 2] = nextPointX + normalizedOffsetX * pad;
			expandedLineSet[i * 4 + 3] = nextPointY + normalizedOffsetY * pad;
		}
		
		return expandedLineSet;
	}
	
	CanvasRenderer.prototype.joinLines = function(lineSet) {
		
		var vertices = new Array(lineSet.length / 2);
		
		var currentLineStartX, currentLineStartY, currentLineEndX, currentLineEndY;
		var nextLineStartX, nextLineStartY, nextLineEndX, nextLineEndY;
		
		for (var i = 0; i < lineSet.length / 4; i++) {
			currentLineStartX = lineSet[i * 4];
			currentLineStartY = lineSet[i * 4 + 1];
			currentLineEndX = lineSet[i * 4 + 2];
			currentLineEndY = lineSet[i * 4 + 3];
			
			if (i < lineSet.length / 4 - 1) {
				nextLineStartX = lineSet[(i + 1) * 4];
				nextLineStartY = lineSet[(i + 1) * 4 + 1];
				nextLineEndX = lineSet[(i + 1) * 4 + 2];
				nextLineEndY = lineSet[(i + 1) * 4 + 3];
			} else {
				nextLineStartX = lineSet[0];
				nextLineStartY = lineSet[1];
				nextLineEndX = lineSet[2];
				nextLineEndY = lineSet[3];
			}
			
			var intersection = this.finiteLinesIntersect(
				currentLineStartX, currentLineStartY,
				currentLineEndX, currentLineEndY,
				nextLineStartX, nextLineStartY,
				nextLineEndX, nextLineEndY,
				true);
			
			vertices[i * 2] = intersection[0];
			vertices[i * 2 + 1] = intersection[1];
		}
		
		return vertices;
	}
	
	CanvasRenderer.prototype.pointInsidePolygon = function(
		x, y, basePoints, centerX, centerY, width, height, direction, padding) {

		//var direction = arguments[6];
		var transformedPoints = new Array(basePoints.length)

		// Gives negative angle
		var angle = Math.asin(direction[1] / (Math.sqrt(direction[0] * direction[0] 
			+ direction[1] * direction[1])));
		
		if (direction[0] < 0) {
			angle = angle + Math.PI / 2;
		} else {
			angle = -angle - Math.PI / 2;
		}
				
		var cos = Math.cos(-angle);
		var sin = Math.sin(-angle);
		
//		console.log("base: " + basePoints);
		for (var i = 0; i < transformedPoints.length / 2; i++) {
			transformedPoints[i * 2] = 
				width * (basePoints[i * 2] * cos
					- basePoints[i * 2 + 1] * sin);
			
			transformedPoints[i * 2 + 1] = 
				height * (basePoints[i * 2 + 1] * cos 
					+ basePoints[i * 2] * sin);

			transformedPoints[i * 2] += centerX;
			transformedPoints[i * 2 + 1] += centerY;
		}
		
		var points;
		
		if (padding > 0) {
			var expandedLineSet = renderer.expandPolygon(
				transformedPoints,
				-padding);
			
			points = renderer.joinLines(expandedLineSet);
		} else {
			points = transformedPoints;
		}
		
		var x1, y1, x2, y2;
		var y3;
		
		// Intersect with vertical line through (x, y)
		var up = 0;
		var down = 0;
		for (var i = 0; i < points.length / 2; i++) {
			
			x1 = points[i * 2];
			y1 = points[i * 2 + 1];
			
			if (i + 1 < points.length / 2) {
				x2 = points[(i + 1) * 2];
				y2 = points[(i + 1) * 2 + 1];
			} else {
				x2 = points[(i + 1 - points.length / 2) * 2];
				y2 = points[(i + 1 - points.length / 2) * 2 + 1];
			}
			
//*			console.log("line from (" + x1 + ", " + y1 + ") to (" + x2 + ", " + y2 + ")");

//&			console.log(x1, x, x2);

			if (x1 == x && x2 == x) {
				
			} else if ((x1 >= x && x >= x2)
				|| (x1 <= x && x <= x2)) {
				
				y3 = (x - x1) / (x2 - x1) * (y2 - y1) + y1;
				
				if (y3 > y) {
					up++;
				}
				
				if (y3 < y) {
					down++;
				}
				
//*				console.log(y3, y);
				
			} else {
//*				console.log("22");
				continue;
			}
			
		}
		
//*		console.log("up: " + up + ", down: " + down);
		
		if (up % 2 == 0) {
			return false;
		} else {
			return true;
		}
	}
	}
	
	// @O Polygon drawing
	CanvasRenderer.prototype.drawPolygonPath = function(
		context, x, y, width, height, points) {

		//context.save();
		

		context.translate(x, y);
		context.scale(width / 2, height / 2);

		context.beginPath();

		context.moveTo(points[0], points[1]);

		for (var i = 1; i < points.length / 2; i++) {
			context.lineTo(points[i * 2], points[i * 2 + 1]);
		}
		
		context.closePath();
		
		context.scale(2/width, 2/height);
		context.translate(-x, -y);
		// context.restore();
	}
	
	CanvasRenderer.prototype.drawPolygon = function(
		context, x, y, width, height, points) {

		// Draw path
		this.drawPolygonPath(context, x, y, width, height, points);
		
		// Fill path
		context.fill();
	}
	
	// @O Approximate collision functions
	CanvasRenderer.prototype.checkInBoundingCircle = function(
		x, y, farthestPointSqDistance, padding, width, height, centerX, centerY) {
		
		x = (x - centerX) / (width + padding);
		y = (y - centerY) / (height + padding);
		
		return (x * x + y * y) <= farthestPointSqDistance;
	}
	
	CanvasRenderer.prototype.checkInBoundingBox = function(
		x, y, points, padding, width, height, centerX, centerY) {
		
		// Assumes width, height >= 0, points.length > 0
		
		var minX = points[0], minY = points[1];
		var maxX = points[0], maxY = points[1];
		
		for (var i = 1; i < points.length / 2; i++) {
			
			if (points[i * 2] < minX) {
				minX = points[i * 2];
			} else if (points[i * 2] > maxX) {
				maxX = points[i * 2];
			}
			
			if (points[i * 2 + 1] < minY) {
				minY = points[i * 2 + 1];
			} else if (points[i * 2 + 1] > maxY) {
				maxY = points[i * 2 + 1];
			}
		}
		
		x -= centerX;
		y -= centerY;
		
		x /= width;
		y /= height;
		
		if (x < minX) {
			return false;
		} else if (x > maxX) {
			return false;
		}
		
		if (y < minY) {
			return false;
		} else if (y > maxY) {
			return false;
		}
		
		return true;
	}
	
	// @O Straight/bezier edge approximate collision, precise collision, and distance calculation functions
	{
	CanvasRenderer.prototype.boxInBezierVicinity = function(
		x1box, y1box, x2box, y2box, x1, y1, x2, y2, x3, y3, tolerance) {
		
		// Return values:
		// 0 - curve is not in box
		// 1 - curve may be in box; needs precise check
		// 2 - curve is in box
		
		// midpoint
		var midX = 0.25 * x1 + 0.5 * x2 + 0.25 * x3;
		var midY = 0.25 * y1 + 0.5 * y2 + 0.25 * y3;

		var boxMinX = Math.min(x1box, x2box) - tolerance;
		var boxMinY = Math.min(y1box, y2box) - tolerance;
		var boxMaxX = Math.max(x1box, x2box) + tolerance;
		var boxMaxY = Math.max(y1box, y2box) + tolerance;
		
		if (x1 >= boxMinX && x1 <= boxMaxX && y1 >= boxMinY && y1 <= boxMaxY) { // (x1, y1) in box
			return 1;
		} else if (x3 >= boxMinX && x3 <= boxMaxX && y3 >= boxMinY && y3 <= boxMaxY) { // (x3, y3) in box
			return 1;
		} else if (midX >= boxMinX && midX <= boxMaxX && midY >= boxMinY && midY <= boxMaxY) { // (midX, midY) in box
			return 1;
		} else if (x2 >= boxMinX && x2 <= boxMaxX && y2 >= boxMinY && y2 <= boxMaxY) { // ctrl pt in box
			return 1;
		}
		
		var curveMinX = Math.min(x1, midX, x3);
		var curveMinY = Math.min(y1, midY, y3);
		var curveMaxX = Math.max(x1, midX, x3);
		var curveMaxY = Math.max(y1, midY, y3);
		
		/*
		console.log(curveMinX + ", " + curveMinY + ", " + curveMaxX 
			+ ", " + curveMaxY);
		if (curveMinX == undefined) {
			console.log("undefined curveMinX: " + x1 + ", " + x2 + ", " + x3);
		}
		*/
		
		if (curveMinX > boxMaxX
			|| curveMaxX < boxMinX
			|| curveMinY > boxMaxY
			|| curveMaxY < boxMinY) {
			
			return 0;	
		}
		
		return 1;
	}

	CanvasRenderer.prototype.checkBezierInBox = function(
		x1box, y1box, x2box, y2box, x1, y1, x2, y2, x3, y3, tolerance) {


		function qbezierAt(p0, p1, p2, t){
			return (1 - t)*(1 - t)*p0 + 2*(1 - t)*t*p1 + t*t*p2;
		}

		function sampleInBox(t){
			var x = qbezierAt(x1, x2, x3, t);
			var y = qbezierAt(y1, y2, y3, t);

			return x1box <= x && x <= x2box
				&& y1box <= y && y <= y2box
			;
		}

		for( var t = 0; t <= 1; t += 0.25 ){
			if( !sampleInBox(t) ){
				return false;
			}
		}

		return true;
	};
	
	CanvasRenderer.prototype.checkStraightEdgeInBox = function(
		x1box, y1box, x2box, y2box, x1, y1, x2, y2, tolerance) {

		return x1box <= x1 && x1 <= x2box
			&& x1box <= x2 && x2 <= x2box
			&& y1box <= y1 && y1 <= y2box
			&& y1box <= y2 && y2 <= y2box
		;
	};

	CanvasRenderer.prototype.checkStraightEdgeCrossesBox = function(
		x1box, y1box, x2box, y2box, x1, y1, x2, y2, tolerance) {
		
	 //console.log(arguments);
		
		var boxMinX = Math.min(x1box, x2box) - tolerance;
		var boxMinY = Math.min(y1box, y2box) - tolerance;
		var boxMaxX = Math.max(x1box, x2box) + tolerance;
		var boxMaxY = Math.max(y1box, y2box) + tolerance;
		
		// Check left + right bounds
		var aX = x2 - x1;
		var bX = x1;
		var yValue;
		
		// Top and bottom
		var aY = y2 - y1;
		var bY = y1;
		var xValue;
		
		if (Math.abs(aX) < 0.0001) {
			return (x1 >= boxMinX && x1 <= boxMaxX
				&& Math.min(y1, y2) <= boxMinY
				&& Math.max(y1, y2) >= boxMaxY);	
		}
		
		var tLeft = (boxMinX - bX) / aX;
		if (tLeft > 0 && tLeft <= 1) {
			yValue = aY * tLeft + bY;
			if (yValue >= boxMinY && yValue <= boxMaxY) {
				return true;
			} 
		}
		
		var tRight = (boxMaxX - bX) / aX;
		if (tRight > 0 && tRight <= 1) {
			yValue = aY * tRight + bY;
			if (yValue >= boxMinY && yValue <= boxMaxY) {
				return true;
			} 
		}
		
		var tTop = (boxMinY - bY) / aY;
		if (tTop > 0 && tTop <= 1) {
			xValue = aX * tTop + bX;
			if (xValue >= boxMinX && xValue <= boxMaxX) {
				return true;
			} 
		}
		
		var tBottom = (boxMaxY - bY) / aY;
		if (tBottom > 0 && tBottom <= 1) {
			xValue = aX * tBottom + bX;
			if (xValue >= boxMinX && xValue <= boxMaxX) {
				return true;
			} 
		}
		
		return false;
	}
	
	CanvasRenderer.prototype.checkBezierCrossesBox = function(
		x1box, y1box, x2box, y2box, x1, y1, x2, y2, x3, y3, tolerance) {
		
		var boxMinX = Math.min(x1box, x2box) - tolerance;
		var boxMinY = Math.min(y1box, y2box) - tolerance;
		var boxMaxX = Math.max(x1box, x2box) + tolerance;
		var boxMaxY = Math.max(y1box, y2box) + tolerance;
		
		if (x1 >= boxMinX && x1 <= boxMaxX && y1 >= boxMinY && y1 <= boxMaxY) {
			return true;
		} else if (x3 >= boxMinX && x3 <= boxMaxX && y3 >= boxMinY && y3 <= boxMaxY) {
			return true;
		}
		
		var aX = x1 - 2 * x2 + x3;
		var bX = -2 * x1 + 2 * x2;
		var cX = x1;

		var xIntervals = [];
		
		if (Math.abs(aX) < 0.0001) {
			var leftParam = (boxMinX - x1) / bX;
			var rightParam = (boxMaxX - x1) / bX;
			
			xIntervals.push(leftParam, rightParam);
		} else {
			// Find when x coordinate of the curve crosses the left side of the box
			var discriminantX1 = bX * bX - 4 * aX * (cX - boxMinX);
			var tX1, tX2;
			if (discriminantX1 > 0) {
				var sqrt = Math.sqrt(discriminantX1);
				tX1 = (-bX + sqrt) / (2 * aX);
				tX2 = (-bX - sqrt) / (2 * aX);
				
				xIntervals.push(tX1, tX2);
			}
			
			var discriminantX2 = bX * bX - 4 * aX * (cX - boxMaxX);
			var tX3, tX4;
			if (discriminantX2 > 0) {
				var sqrt = Math.sqrt(discriminantX2);
				tX3 = (-bX + sqrt) / (2 * aX);
				tX4 = (-bX - sqrt) / (2 * aX);
				
				xIntervals.push(tX3, tX4);
			}
		}
		
		xIntervals.sort(function(a, b) { return a - b; });
		
		var aY = y1 - 2 * y2 + y3;
		var bY = -2 * y1 + 2 * y2;
		var cY = y1;
		
		var yIntervals = [];
		
		if (Math.abs(aY) < 0.0001) {
			var topParam = (boxMinY - y1) / bY;
			var bottomParam = (boxMaxY - y1) / bY;
			
			yIntervals.push(topParam, bottomParam);
		} else {
			var discriminantY1 = bY * bY - 4 * aY * (cY - boxMinY);
			
			var tY1, tY2;
			if (discriminantY1 > 0) {
				var sqrt = Math.sqrt(discriminantY1);
				tY1 = (-bY + sqrt) / (2 * aY);
				tY2 = (-bY - sqrt) / (2 * aY);
				
				yIntervals.push(tY1, tY2);
			}
	
			var discriminantY2 = bY * bY - 4 * aY * (cY - boxMaxY);
			
			var tY3, tY4;
			if (discriminantY2 > 0) {
				var sqrt = Math.sqrt(discriminantY2);
				tY3 = (-bY + sqrt) / (2 * aY);
				tY4 = (-bY - sqrt) / (2 * aY);
				
				yIntervals.push(tY3, tY4);
			}
		}
				
		yIntervals.sort(function(a, b) { return a - b; });

		for (var index = 0; index < xIntervals.length; index += 2) {
			for (var yIndex = 1; yIndex < yIntervals.length; yIndex += 2) {
				
				// Check if there exists values for the Bezier curve
				// parameter between 0 and 1 where both the curve's
				// x and y coordinates are within the bounds specified by the box
				if (xIntervals[index] < yIntervals[yIndex]
					&& yIntervals[yIndex] >= 0.0
					&& xIntervals[index] <= 1.0
					&& xIntervals[index + 1] > yIntervals[yIndex - 1]
					&& yIntervals[yIndex - 1] <= 1.0
					&& xIntervals[index + 1] >= 0.0) {
					
					return true;
				}
			}
		}
		
		return false;
	}
	
	CanvasRenderer.prototype.inLineVicinity = function(x, y, lx1, ly1, lx2, ly2, tolerance){
		var t = tolerance;

		var x1 = Math.min(lx1, lx2);
		var x2 = Math.max(lx1, lx2);
		var y1 = Math.min(ly1, ly2);
		var y2 = Math.max(ly1, ly2);

		return x1 - t <= x && x <= x2 + t
			&& y1 - t <= y && y <= y2 + t;
	};

	CanvasRenderer.prototype.inBezierVicinity = function(
		x, y, x1, y1, x2, y2, x3, y3, toleranceSquared) {
		
		// Middle point occurs when t = 0.5, this is when the Bezier
		// is closest to (x2, y2)
		var middlePointX = 0.25 * x1 + 0.5 * x2 + 0.25 * x3;
		var middlePointY = 0.25 * y1 + 0.5 * y2 + 0.25 * y3;

		// a rough bounding box of the bezier curve
		var bb = {
			x1: Math.min( x1, x3, middlePointX ),
			x2: Math.max( x1, x3, middlePointX ),
			y1: Math.min( y1, y3, middlePointY ),
			y2: Math.max( y1, y3, middlePointY )
		};

		// if outside the rough bounding box for the bezier, then it can't be a hit
		if( x < bb.x1 || x > bb.x2 || y < bb.y1 || y > bb.y2 ){
			// console.log('bezier out of rough bb')
			return false;
		} else {
			// console.log('do more expensive check');
		}
		
		var displacementX, displacementY, offsetX, offsetY;
		var dotProduct, dotSquared, hypSquared;
		var outside = function(x, y, startX, startY, endX, endY,
				toleranceSquared, counterClockwise) {

			dotProduct = (endY - startY) * (x - startX) + (startX - endX) * (y - startY);
			dotSquared = dotProduct * dotProduct;
			sideSquared = (endY - startY) * (endY - startY) 
				+ (startX - endX) * (startX - endX);

			if (counterClockwise) {
				if (dotProduct > 0) {
					return false;
				}
			} else {
				if (dotProduct < 0) {
					return false;
				}
			}
			
			return (dotSquared / sideSquared > toleranceSquared);
		};
		
		// Used to check if the test polygon winding is clockwise or counterclockwise
		var testPointX = (middlePointX + x2) / 2.0;
		var testPointY = (middlePointY + y2) / 2.0;
		
		var counterClockwise = true;
		
		// The test point is always inside
		if (outside(testPointX, testPointY, x1, y1, x2, y2, 0, counterClockwise)) {
			counterClockwise = !counterClockwise;
		}
		
		/*
		return (!outside(x, y, x1, y1, x2, y2, toleranceSquared, counterClockwise)
			&& !outside(x, y, x2, y2, x3, y3, toleranceSquared, counterClockwise)
			&& !outside(x, y, x3, y3, middlePointX, middlePointY, toleranceSquared,
				counterClockwise)
			&& !outside(x, y, middlePointX, middlePointY, x1, y1, toleranceSquared,
				counterClockwise)
		);
		*/
		
		return (!outside(x, y, x1, y1, x2, y2, toleranceSquared, counterClockwise)
			&& !outside(x, y, x2, y2, x3, y3, toleranceSquared, counterClockwise)
			&& !outside(x, y, x3, y3, x1, y1, toleranceSquared,
				counterClockwise)
		);
	}
	
	CanvasRenderer.prototype.solveCubic = function(a, b, c, d, result) {
		
		// Solves a cubic function, returns root in form [r1, i1, r2, i2, r3, i3], where
		// r is the real component, i is the imaginary component

		// An implementation of the Cardano method from the year 1545
		// http://en.wikipedia.org/wiki/Cubic_function#The_nature_of_the_roots

		b /= a;
		c /= a;
		d /= a;
		
		var discriminant, q, r, dum1, s, t, term1, r13;

		q = (3.0 * c - (b * b)) / 9.0;
		r = -(27.0 * d) + b * (9.0 * c - 2.0 * (b * b));
		r /= 54.0;
		
		discriminant = q * q * q + r * r;
		result[1] = 0;
		term1 = (b / 3.0);
		
		if (discriminant > 0) {
			s = r + Math.sqrt(discriminant);
			s = ((s < 0) ? -Math.pow(-s, (1.0 / 3.0)) : Math.pow(s, (1.0 / 3.0)));
			t = r - Math.sqrt(discriminant);
			t = ((t < 0) ? -Math.pow(-t, (1.0 / 3.0)) : Math.pow(t, (1.0 / 3.0)));
			result[0] = -term1 + s + t;
			term1 += (s + t) / 2.0;
			result[4] = result[2] = -term1;
			term1 = Math.sqrt(3.0) * (-t + s) / 2;
			result[3] = term1;
			result[5] = -term1;
			return;
		}
		
		result[5] = result[3] = 0;
		
		if (discriminant == 0) {
			r13 = ((r < 0) ? -Math.pow(-r, (1.0 / 3.0)) : Math.pow(r, (1.0 / 3.0)));
			result[0] = -term1 + 2.0 * r13;
			result[4] = result[2] = -(r13 + term1);
			return;
		}
		
		q = -q;
		dum1 = q * q * q;
		dum1 = Math.acos(r / Math.sqrt(dum1));
		r13 = 2.0 * Math.sqrt(q);
		result[0] = -term1 + r13 * Math.cos(dum1 / 3.0);
		result[2] = -term1 + r13 * Math.cos((dum1 + 2.0 * Math.PI) / 3.0);
		result[4] = -term1 + r13 * Math.cos((dum1 + 4.0 * Math.PI) / 3.0);
		
		return;
	}

	CanvasRenderer.prototype.sqDistanceToQuadraticBezier = function(
		x, y, x1, y1, x2, y2, x3, y3) {
		
		// Find minimum distance by using the minimum of the distance 
		// function between the given point and the curve
		
		// This gives the coefficients of the resulting cubic equation
		// whose roots tell us where a possible minimum is
		// (Coefficients are divided by 4)
		
		var a = 1.0 * x1*x1 - 4*x1*x2 + 2*x1*x3 + 4*x2*x2 - 4*x2*x3 + x3*x3
			+ y1*y1 - 4*y1*y2 + 2*y1*y3 + 4*y2*y2 - 4*y2*y3 + y3*y3;
		
		var b = 1.0 * 9*x1*x2 - 3*x1*x1 - 3*x1*x3 - 6*x2*x2 + 3*x2*x3
			+ 9*y1*y2 - 3*y1*y1 - 3*y1*y3 - 6*y2*y2 + 3*y2*y3;
		
		var c = 1.0 * 3*x1*x1 - 6*x1*x2 + x1*x3 - x1*x + 2*x2*x2 + 2*x2*x - x3*x
			+ 3*y1*y1 - 6*y1*y2 + y1*y3 - y1*y + 2*y2*y2 + 2*y2*y - y3*y;
			
		var d = 1.0 * x1*x2 - x1*x1 + x1*x - x2*x
			+ y1*y2 - y1*y1 + y1*y - y2*y;
		
		debug("coefficients: " + a / a + ", " + b / a + ", " + c / a + ", " + d / a);
		
		var roots = [];
		
		// Use the cubic solving algorithm
		this.solveCubic(a, b, c, d, roots);
		
		var zeroThreshold = 0.0000001;
		
		var params = [];
		
		for (var index = 0; index < 6; index += 2) {
			if (Math.abs(roots[index + 1]) < zeroThreshold
					&& roots[index] >= 0
					&& roots[index] <= 1.0) {
				params.push(roots[index]);
			}
		}
		
		params.push(1.0);
		params.push(0.0);
		
		var minDistanceSquared = -1;
		var closestParam;
		
		var curX, curY, distSquared;
		for (var i = 0; i < params.length; i++) {
			curX = Math.pow(1.0 - params[i], 2.0) * x1
				+ 2.0 * (1 - params[i]) * params[i] * x2
				+ params[i] * params[i] * x3;
				
			curY = Math.pow(1 - params[i], 2.0) * y1
				+ 2 * (1.0 - params[i]) * params[i] * y2
				+ params[i] * params[i] * y3;
				
			distSquared = Math.pow(curX - x, 2) + Math.pow(curY - y, 2);
			debug("distance for param " + params[i] + ": " + Math.sqrt(distSquared));
			if (minDistanceSquared >= 0) {
				if (distSquared < minDistanceSquared) {
					minDistanceSquared = distSquared;
					closestParam = params[i];
				}
			} else {
				minDistanceSquared = distSquared;
				closestParam = params[i];
			}
		}
		
		/*
		debugStats.clickX = x;
		debugStats.clickY = y;
		
		debugStats.closestX = Math.pow(1.0 - closestParam, 2.0) * x1
				+ 2.0 * (1.0 - closestParam) * closestParam * x2
				+ closestParam * closestParam * x3;
				
		debugStats.closestY = Math.pow(1.0 - closestParam, 2.0) * y1
				+ 2.0 * (1.0 - closestParam) * closestParam * y2
				+ closestParam * closestParam * y3;
		*/
		
		debug("given: " 
			+ "( " + x + ", " + y + "), " 
			+ "( " + x1 + ", " + y1 + "), " 
			+ "( " + x2 + ", " + y2 + "), "
			+ "( " + x3 + ", " + y3 + ")");
		
		
		debug("roots: " + roots);
		debug("params: " + params);
		debug("closest param: " + closestParam);
		return minDistanceSquared;
	}
	
	CanvasRenderer.prototype.sqDistanceToFiniteLine = function(x, y, x1, y1, x2, y2) {
		var offset = [x - x1, y - y1];
		var line = [x2 - x1, y2 - y1];
		
		var lineSq = line[0] * line[0] + line[1] * line[1];
		var hypSq = offset[0] * offset[0] + offset[1] * offset[1];
		
		var dotProduct = offset[0] * line[0] + offset[1] * line[1];
		var adjSq = dotProduct * dotProduct / lineSq;
		
		if (dotProduct < 0) {
			return hypSq;
		}
		
		if (adjSq > lineSq) {
			return (x - x2) * (x - x2) + (y - y2) * (y - y2);
		}
		
		return (hypSq - adjSq)
	}
	
	}
	}
	
	var debug = function(){};
	$$("renderer", "canvas", CanvasRenderer);
	
})( cytoscape );
