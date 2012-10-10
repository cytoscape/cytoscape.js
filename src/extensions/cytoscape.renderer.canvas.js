(function($$){

	var debug = function(o) {
		if (false) {
			console.log(o);
		}
	}

	var defaults = {
		minZoom: 0.001,
		maxZoom: 1000,
		maxPan: -1 >>> 1,
		minPan: (-(-1>>>1)-1),
		selectionToPanDelay: 500,
		dragToSelect: true,
		dragToPan: true,
	};
	
	var debugStats = {};
	
	// The 5th element in the array can be used to indicate whether 
	// the box should be drawn (0=hide)
	var selectBox = [0, 0, 0, 0, 0];
	
	var dragPanStartX;
	var dragPanStartY;
	var dragPanInitialCenter;
	var dragPanMode = false;
	
	var shiftDown = false;
	
	var nodeHovered = false;
	
	var minDistanceEdge;
	var minDistanceEdges = [];
	var minDistanceEdgeValue = 999;
	
	var minDistanceNode;
	var minDistanceNodes = [];
	var minDistanceNodeValue = 999;
	
	var arrowShapes = {};
	var arrowShapeDrawers = {};
	var arrowShapeSpacing = {};
	var arrowShapeGap = {};
	var nodeShapes = {};
	var nodeShapeDrawers = {};
	var nodeShapeIntersectLine = {};
	var nodeShapePoints = {};
	
	var nodeDragging = false;
	var draggingSelectedNode = false;
	var draggedNode;
	
	var draggedElementsMovedLayer = false;
	var nodesBeingDragged = [];
	var edgesBeingDragged = [];
	
	var cy;
	var renderer;
	
	var curTouch1Position = new Array(2);
	var curTouch2Position = new Array(2);
	var curTouchDistance;
	
	var prevTouch1Position = new Array(2);
	var prevTouch2Position = new Array(2);
	var prevTouchDistance;
	
	var skipNextViewportRedraw = false;
	
	// Timeout variable used to prevent mouseMove events from being triggered too often
	var mouseMoveTimeout = 0;
	
	// Timeout variable to prevent frequent redraws
	var redrawTimeout = 0;
	
	var currentMouseDownNode = undefined;
	var currentMouseDownEdge = undefined;
	var currentMouseDownInCanvas = false;
	var currentMouseDownUnmoved = false;
	
	// Used for mouseover/mouseout
	var currentHoveredNode = undefined
	var currentHoveredEdge = undefined;
	var currentMouseInCanvas = false;
	var mouseJustEnteredCanvas = false;
	
	var wheelZoomEnabled = false;
	
	var previousMouseX = undefined;
	var currentMouseX = undefined;
	
	var secondsElapsed = 0;
	var mouseDownTime = undefined;
	
	function CanvasRenderer(options) {
		this.options = $.extend(true, {}, defaults, options);
		this.cy = options.cy;
		
		cy = options.cy;
		
		this.init();
		
		// Information about the number of edges between each pair of nodes
		// used to find different curvatures for the edges
		this.nodePairEdgeData = {};		
		
		var numCanvases = 5;
		
		// Create canvases, place in container
		
		this.canvases = new Array(numCanvases);
		this.canvasContexts = new Array(numCanvases);
		
		var numBufferCanvases = 2;
		this.bufferCanvases = new Array(numBufferCanvases);
		this.bufferCanvasContexts = new Array(numBufferCanvases);
		
		this.canvasNeedsRedraw = new Array(numCanvases);
		this.redrawReason = new Array(numCanvases);
		
		var container = this.options.cy.container();
		this.container = container;
		
		setInterval(function() {
			secondsElapsed++;
		}, 450);
		
		for (var i = 0; i < numCanvases + numBufferCanvases; i++) {
			var canvas = document.createElement("canvas");
			
			canvas.width = container.clientWidth;
			canvas.height = container.clientHeight;
			// console.log(canvas)
			
			/*
			canvas.style.width = '100%';
			canvas.style.height = '100%';			
			*/
			canvas.style.position = "absolute";
			
			if (i < numCanvases) {
				// Create main set of canvas layers for drawing
				canvas.id = "layer" + i;
				canvas.style.zIndex = String(-i - numBufferCanvases);
				canvas.style.visibility = "hidden";
				
				this.canvases[i] = canvas;
				this.canvasContexts[i] = canvas.getContext("2d");
				
				this.canvasNeedsRedraw[i] = false;
				this.redrawReason[i] = new Array();
				
			} else {
				// Create the buffer canvas which is the cached drawn result
				canvas.id = "buffer" + (i - numCanvases);
				canvas.style.zIndex = -(i - numCanvases);
				
				this.bufferCanvases[i - numCanvases] = canvas;
				this.bufferCanvasContexts[i - numCanvases] = canvas.getContext("2d");
			}
			
			container.appendChild(canvas);
		}
		
		this.bufferCanvases[0].style.visibility = "visible";
//		this.bufferCanvases[0].style.visibility = "hidden";
		
		this.bufferCanvases[1].style.visibility = "hidden";
//		this.bufferCanvases[1].style.visibility = "visible";
		
		this.canvas = this.bufferCanvases[0];
		this.context = this.bufferCanvasContexts[0];
		
		this.center = [container.clientWidth / 2, container.clientHeight / 2];
		this.scale = [1, 1];
		this.zoomLevel = 0;
		
		renderer = this;
	}

	CanvasRenderer.prototype.notify = function(params) {

		if (params.type == "load") {
			this.load();
			
			this.canvasNeedsRedraw[2] = true;
			this.redrawReason[2].push("Load");
				
			this.canvasNeedsRedraw[4] = true;
			this.redrawReason[4].push("Load");
			
			this.redraw();
		
		} else if (params.type == "viewport") {
		
			if (!skipNextViewportRedraw) {
				this.canvasNeedsRedraw[2] = true;
				this.redrawReason[2].push("Viewport change");
				
				this.canvasNeedsRedraw[4] = true;
				this.redrawReason[4].push("Viewport change");
				
				this.redraw();
			} else {
				skipNextViewportRedraw = false;
			}
		} else if (params.type == "style") {
			
			doSingleRedraw = true;

			this.canvasNeedsRedraw[2] = true;
			this.redrawReason[2].push("Style change");
			
			this.canvasNeedsRedraw[4] = true;
			this.redrawReason[4].push("Style change");
			
			this.redraw();
			
		} else if (params.type == "add"
			|| params.type == "remove") {
			
			this.canvasNeedsRedraw[4] = true;
			this.redrawReason[4].push("Elements added/removed");
			
			this.redraw();
		} else if (params.type == "draw") {
			this.canvasNeedsRedraw[2] = true;
			this.redrawReason[2].push("Draw call");
			
			this.canvasNeedsRedraw[4] = true;
			this.redrawReason[4].push("Draw call");
			
			this.redraw();
		} else if (params.type == "position") {
			this.canvasNeedsRedraw[2] = true;
			this.redrawReason[2].push("Position call");
			
			this.canvasNeedsRedraw[4] = true;
			this.redrawReason[4].push("Position call");
			
			this.redraw();	
		} else {
			console.log("event: " + params.type);
		}
	};
	
	CanvasRenderer.prototype.projectMouse = function(mouseEvent) {
		
		/* sept25-2012
		var x = mouseEvent.clientX - this.canvas.offsetParent.offsetLeft - 2;
		var y = mouseEvent.clientY - this.canvas.offsetParent.offsetTop - 2;

		x += (mouseEvent.pageX - mouseEvent.clientX);
		y += (mouseEvent.pageY - mouseEvent.clientY);
		*/
		
		/*
		console.log(renderer.container.HTMLElement);
		console.log(renderer.container);
		*/
		var x, y;
		/*
		if (mouseEvent.offsetX !== undefined && mouseEvent.offsetY !== undefined) {
			x = mouseEvent.offsetX;
			y = mouseEvent.offsetY;
		} else {
		*/	
		
		var offsetLeft = 0;
		var offsetTop = 0;
		var n;
		
		n = cy.container();
		while (n != null) {
			if (typeof(n.offsetLeft) == "number") {
				offsetLeft += n.offsetLeft;
				offsetTop += n.offsetTop;
			}
			
			n = n.parentNode;
		}
		// console.log(offsetLeft, offsetTop);
		
		x = mouseEvent.pageX - offsetLeft;
		y = mouseEvent.pageY - offsetTop;
		//}
			
		x -= cy.pan().x;
		y -= cy.pan().y;
		
		x /= cy.zoom();
		y /= cy.zoom();
		
		return [x, y];
		
		/*
		mouseDownEvent.clientX,
		mouseDownEvent.clientY,
		cy.container().offset().left + 2, // container offsets
		cy.container().offset().top + 2);
		*/
	}
	
	CanvasRenderer.prototype.findEdgeMetrics = function(edges) {
		this.nodePairEdgeData = {};
		
		var edge, nodePairId;
		for (var i = 0; i < edges.length; i++) {
			edge = edges[i];
			nodePairId = edge._private.data.source <= edge._private.data.target?
				edge._private.data.source + edge._private.data.target
				: edge._private.data.target + edge._private.data.source;
				
			if (this.nodePairEdgeData[nodePairId] == undefined) {
				this.nodePairEdgeData[nodePairId] = 1;
			} else {
				this.nodePairEdgeData[nodePairId]++;
			}
			
			edge._private.rscratch.nodePairId = nodePairId;
			edge._private.rscratch.nodePairEdgeNum = this.nodePairEdgeData[nodePairId];
		}
		
		// console.log(this.nodePairEdgeData);
	}
	
	CanvasRenderer.prototype.findEdges = function(nodeSet) {
		
		var edges = cy.edges();
		
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
	
	CanvasRenderer.prototype.checkPointInPolygon = function(x, y, points, padding) {
		var expandedLines = renderer.expandLines(points, padding);
		
//		var newPoints = renderer.
		
	}
	
	CanvasRenderer.prototype.findEdgeControlPoints = function(edges) {
		var hashTable = {};
		
		var pairId;
		for (var i = 0; i < edges.length; i++) {
			
			pairId = edges[i]._private.data.source > edges[i]._private.data.target ?
				edges[i]._private.data.target + edges[i]._private.data.source :
				edges[i]._private.data.source + edges[i]._private.data.target;

			if (hashTable[pairId] == undefined) {
				hashTable[pairId] = [];
			}
			
			hashTable[pairId].push(edges[i]); // ._private.data.id);
		}
	
		var src, tgt;
	
		// Nested for loop is OK; total number of iterations for both loops = edgeCount	
		for (var pairId in hashTable) {
		
			src = cy.getElementById(hashTable[pairId][0]._private.data.source);
			tgt = cy.getElementById(hashTable[pairId][0]._private.data.target);
			
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
							
				// Self-edge
				if (src._private.data.id == tgt._private.data.id) {
					var stepSize = edge._private.style["control-point-step-size"].pxValue;
						
					edge._private.rscratch.isSelfEdge = true;
					
					edge._private.rscratch.cp2ax = src._private.position.x;
					edge._private.rscratch.cp2ay = src._private.position.y
						- 1.3 * stepSize * (i / 3 + 1);
					
					edge._private.rscratch.cp2cx = src._private.position.x
						- 1.3 * stepSize * (i / 3 + 1);
					edge._private.rscratch.cp2cy = src._private.position.y;
					
					edge._private.rscratch.selfEdgeMidX =
						(edge._private.rscratch.cp2ax + edge._private.rscratch.cp2cx) / 2.0;
				
					edge._private.rscratch.selfEdgeMidY =
						(edge._private.rscratch.cp2ay + edge._private.rscratch.cp2cy) / 2.0;
						
				// Straight edge	
				} else if (hashTable[pairId].length % 2 == 1
					&& i == Math.floor(hashTable[pairId].length / 2)) {
					
					edge._private.rscratch.isStraightEdge = true;
					
				// Bezier edge
				} else {
					var stepSize = edge._private.style["control-point-step-size"].value;
					var distanceFromMidpoint = (0.5 - hashTable[pairId].length / 2 + i) * stepSize;
					
					edge._private.rscratch.isBezierEdge = true;
					
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
	
	CanvasRenderer.prototype.findEdgeControlPoints2 = function(edges) {
		var visitedEdges = {};
		
		var parallelEdges;
		for (var i = 0; i < edges.length; i++) {
			if (visitedEdges[edges[i]._private.data.id] == undefined) {
				parallelEdges = edges[i].parallelEdges();
				
				for (var j = 0; j < edges.length; j++) {
					visitedEdges[edges[i]._private.data.id] = true;
				}
				
				$$.styfn.calculateControlPoints(parallelEdges);
			}
		}
	}
	
	CanvasRenderer.prototype.checkRecordPinchCoordinates = function(touchEvent) {
		
		if (touchEvent.touches.length >= 2) {
			prevTouch1 = touchEvent.touches[0];
			prevTouch2 = touchEvent.touches[1];
			
			prevTouch1.offsetX = prevTouch1.clientX + renderer.canvas.parentElement.offsetLeft;
			prevTouch1.offsetY = prevTouch1.clientY + renderer.canvas.parentElement.offsetTop;
			
			prevTouch2.offsetX = prevTouch2.clientX + renderer.canvas.parentElement.offsetLeft;
			prevTouch2.offsetY = prevTouch2.clientY + renderer.canvas.parentElement.offsetTop;
		} else {
			prevTouch1 = undefined;
			prevTouch2 = undefined;
		}
	}
	
	CanvasRenderer.prototype.mouseDownHandler = function(event) {
		var nodes = cy.nodes();
		var edges = cy.edges();

		var touch = false;
		
		var originalEvent = event;
		if (event.changedTouches) {					
			event.preventDefault();
			touch = true;
				
			// Check for 2-finger, prepare for pinch-to-zoom
			if (event.touches.length >= 2) {
				firstTouchFinger = event.touches[0];
				secondTouchFinger = event.touches[1];
				
				var canvasOffset = [
					renderer.canvas.parentElement.offsetLeft,
					-renderer.canvas.parentElement.offsetTop];
				
				prevTouch1Position[0] = event.touches[0].clientX + canvasOffset[0];
				prevTouch1Position[1] = event.touches[0].clientY + canvasOffset[1];
				
				prevTouch2Position[0] = event.touches[1].clientX + canvasOffset[0];
				prevTouch2Position[1] = event.touches[1].clientY + canvasOffset[1];
				
				prevTouchDistance = Math.sqrt(
					Math.pow(prevTouch2Position[0] - prevTouch1Position[0], 2)
					+ Math.pow(prevTouch2Position[1] - prevTouch1Position[1], 2));
			}
			
			event = event.changedTouches[0];
			event.button = 0;
			event.touch = 1;
			
			// Look for nodes and edges under the touch event			
			// minDistanceNode = minDistanceEdge = undefined;
			renderer.mouseMoveHelper.hoverHandler(nodes, edges, event);
		}
		
		var mouseDownEvent = event;
		
		mouseDownTime = secondsElapsed;
		
		clearTimeout( this.panTimeout );
		if( !minDistanceNode && !touch){
			this.panTimeout = setTimeout(function() {
			
				// Delayed pan
				if (mouseDownTime !== undefined
					&& !touch
					&& event.button === 0) {
					
					dragPanStartX = mouseDownEvent.clientX;
					dragPanStartY = mouseDownEvent.clientY;
					
		//			dragPanInitialCenter = [cy.renderer().center[0], cy.renderer().center[1]];
					
					dragPanMode = true;
					
					if (cy.renderer().canvas.style.cursor 
						!= cy.style()._private.coreStyle["panning-cursor"].value) {
		
						cy.renderer().canvas.style.cursor 
							= cy.style()._private.coreStyle["panning-cursor"].value;
					}
					
					// Cancel selection box
					selectBox[4] = 0;
					
					renderer.canvasNeedsRedraw[0] = true;
					renderer.redrawReason[0].push("selection boxed removed");
					
					mouseDownTime = undefined;
				}
			}, 250);
		}
				
		// Process middle button panning
		if ((!event.touch
				&& mouseDownEvent.button == 1
				&& mouseDownEvent.target == cy.renderer().canvas)
				||
			(event.touch
				&& minDistanceNode == undefined
				&& minDistanceEdge == undefined)) {
		
			dragPanStartX = mouseDownEvent.clientX;
			dragPanStartY = mouseDownEvent.clientY;
			
//			dragPanInitialCenter = [cy.renderer().center[0], cy.renderer().center[1]];
			
			dragPanMode = true;
			
			if (cy.renderer().canvas.style.cursor 
				!= cy.style()._private.coreStyle["panning-cursor"].value) {

				cy.renderer().canvas.style.cursor 
					= cy.style()._private.coreStyle["panning-cursor"].value;
			}
		}
		
		currentMouseDownInCanvas = true;
		currentMouseDownUnmoved = true;
		
		var start = cy.renderer().projectMouse(event);
		
		/*
		console.log("x: " + start[0]);
		console.log("y: " + start[1]);
		console.log(mouseDownEvent);
		console.log(mouseDownEvent.target);
		console.log(mouseDownEvent.button);
		*/
		
		selectBox[0] = start[0];
		selectBox[1] = start[1];
		
		/*
		// The lower right corner shouldn't have a coordinate,
		// but this prevents the default 0, 0 from being used for touch
		selectBox[2] = start[0];
		selectBox[3] = start[1];
		*/
		
		// Left button drag selection
		if (mouseDownEvent.button == 0
				&& mouseDownEvent.target == cy.renderer().canvas
				&& minDistanceNode == undefined
				&& minDistanceEdge == undefined
				&& !touch) {
		
			selectBox[4] = 1;
		}
		
		if (mouseDownEvent.button == 0) {
		
			if (minDistanceNode != undefined && minDistanceNode.grabbable()) {
				
				nodeDragging = true;
				nodesBeingDragged = [];
				
				if (minDistanceNode.selected()) {
					draggingSelectedNode = true;
					
					for (var index = 0; index < nodes.length; index++) {
						if (nodes[index].selected() && nodes[index].grabbable()) {
							
							nodes[index]._private.rscratch.dragStartX = 
								nodes[index]._private.position.x;
							nodes[index]._private.rscratch.dragStartY =
								nodes[index]._private.position.y;
										
							nodesBeingDragged.push(nodes[index]);
//**						nodes[index]._private.rscratch.layer2 = true;
							
							// Proxy grab() event
							nodes[index]._private.grabbed = true;
							nodes[index].trigger("grab");
						}
					}
					
				} else if( minDistanceNode.grabbable() ) {
					draggingSelectedNode = false;
					draggedNode = minDistanceNode;
					
					draggedNode._private.rscratch.dragStartX = 
						draggedNode._private.position.x;
					draggedNode._private.rscratch.dragStartY = 
						draggedNode._private.position.y;
					
					nodesBeingDragged.push(draggedNode);
					draggedNode._private.rscratch.layer2 = true;	

					// Proxy grab() event
					draggedNode._private.grabbed = true;
					draggedNode.trigger("grab");
				}
				
				edgesBeingDragged = renderer.findEdges(nodesBeingDragged);
				
				for (var i = 0; i < edgesBeingDragged.length; i++) {
//**				edgesBeingDragged[i]._private.rscratch.layer2 = true;
				}
				
/***
				renderer.canvasNeedsRedraw[4] = true;
				renderer.redrawReason[4].push("nodes being dragged, moved to drag layer");
				
				renderer.canvasNeedsRedraw[2] = true;
				renderer.redrawReason[2].push("nodes being dragged, moved to drag layer");
***/

				draggedElementsMovedLayer = false;
				
				// Proxy touchstart/mousedown to core
				if (touch) {
					minDistanceNode.trigger("touchstart");
				} else {
					minDistanceNode.trigger("mousedown");
				}
				
				currentMouseDownNode = minDistanceNode;
			} else if (minDistanceEdge != undefined) {
				// Proxy touchstart/mousedown to core
				if (touch) {
					minDistanceEdge.trigger("touchstart");
				} else {
					minDistanceEdge.trigger("mousedown");
				}
				
				currentMouseDownEdge = minDistanceEdge;
			} else {
			
				// Proxy touchstart/mousedown to core
				if (touch) {
					cy.trigger("touchstart");
				} else {
					cy.trigger("mousedown");
				}
				
				currentMouseDownInCanvas = true;
			}
		}
		
		cy.renderer().redraw();
	}
	
	CanvasRenderer.prototype.mouseOverHandler = function(event) {
		mouseJustEnteredCanvas = true;
		currentMouseInCanvas = true;
	}
	
	CanvasRenderer.prototype.mouseOutHandler = function(event) {
		wheelZoomEnabled = false;
		currentMouseInCanvas = false;
		
		cy.trigger("mouseout");
		
		previousMouseX = undefined;
		
		// Possibly move this later
//		dragPanMode = false;
	}
	
	CanvasRenderer.prototype.touchStartHandler = function(event) {
	
	}
	
	CanvasRenderer.prototype.touchStartHandler = function(event) {
	
	}
	
	
	
	CanvasRenderer.prototype.documentMouseMoveHandler = function(event) {
		
		var touch = false;
		var eventWithCoords = event;
		
		if (event.touches) {
			touch = true;
			eventWithCoords = event.touches[0];
		}
		
//		if (eventWithCoords.target == this.bufferCanvases[0]) {
//			if (
//		}
	}
	
	CanvasRenderer.prototype.mouseMoveHandler = function(e) {
		
		/*
		if (currentMouseInCanvas === true) {
		//	wheelZoomEnabled = true;
		} else {
			currentMouseInCanvas = true;
		}
		*/
		
		currentMouseInCanvas = true;

		mouseMoveTimeout = setTimeout(function() {
			mouseMoveTimeout = null;		
		}, 1000/100);
		
		var event = e;
		var touch = false;
		
		if (e.touches) {						
			e.preventDefault();
			touch = true;
			
			// Pinch to zoom
			if (e.touches.length >= 2) {
				var canvasOffset = [
					renderer.canvas.parentElement.offsetLeft,
					-renderer.canvas.parentElement.offsetTop];
				
				curTouch1Position[0] = event.touches[0].clientX + canvasOffset[0];
				curTouch1Position[1] = event.touches[0].clientY + canvasOffset[1];
				
				curTouch2Position[0] = event.touches[1].clientX + canvasOffset[0];
				curTouch2Position[1] = event.touches[1].clientY + canvasOffset[1];
				
				curTouchDistance = Math.sqrt(
					Math.pow(prevTouch2Position[0] - prevTouch1Position[0], 2)
					+ Math.pow(prevTouch2Position[1] - prevTouch1Position[1], 2));
				
				var displacement1 = 
					[curTouch1Position[0] - prevTouch1Position[0],
					curTouch1Position[1] - prevTouch1Position[1]];
					
				var displacement2 = 
					[curTouch2Position[0] - prevTouch2Position[0],
					curTouch2Position[1] - prevTouch2Position[1]];
						
				var averageDisplacement =
					[(displacement1[0] + displacement2[0]) / 2,
					(displacement2[1] + displacement2[1]) / 2];
				
				var zoomFactor = curTouchDistance / prevTouchDistance;
				
				if (zoomFactor > 1) {
					zoomFactor = (zoomFactor - 1) * 1.5 + 1;
				} else {
					zoomFactor = 1 - (1 - zoomFactor) * 1.5;
				}
				
				skipNextViewportRedraw = true;
				
				cy.panBy({x: averageDisplacement[0], 
							y: averageDisplacement[1]});
				
				cy.zoom({level: cy.zoom() * zoomFactor,
					position: {x: (curTouch1Position[0] + curTouch2Position[0]) / 2,
								y: (curTouch1Position[1] + curTouch2Position[1]) / 2}});
				
				prevTouch1Position[0] = curTouch1Position[0];
				prevTouch1Position[1] = curTouch1Position[1];
				
				prevTouch2Position[0] = curTouch2Position[0];
				prevTouch2Position[1] = curTouch2Position[1];
				
				prevTouchDistance = curTouchDistance;
				
//				console.log(">= 2 touches, exiting");
				return;	
			}
			
			e = e.touches[0];
			e.button = 0;
		}
		
		var mouseDownEvent = event;
		
//		var renderer = cy.renderer();
		
		// Get references to helper functions
		var dragHandler = renderer.mouseMoveHelper.dragHandler;
		var checkBezierEdgeHover = renderer.mouseMoveHelper.checkBezierEdgeHover;
		var checkStraightEdgeHover = renderer.mouseMoveHelper.checkStraightEdgeHover;
		var checkNodeHover = renderer.mouseMoveHelper.checkNodeHover;
		var hoverHandler = renderer.mouseMoveHelper.hoverHandler;
		
		// Offset for Cytoscape container
		// var mouseOffsetX = cy.container().offset().left + 2;
		// var mouseOffsetY = cy.container().offset().top + 2;
		
		var edges = cy.edges();
		var nodes = cy.nodes();
		
		//cy.renderer().canvas.style.cursor = "default";
		
		mouseDownTime = undefined;
		
		// Drag pan
		if (dragPanMode) {
			dragHandler(e);
		}
		
		var current = cy.renderer().projectMouse(e);
		
		currentMouseX = e.screenX;
		// console.log(previousMouseX, currentMouseX);
		if (previousMouseX !== undefined && Math.abs(previousMouseX - currentMouseX) > 1) {
			// console.log(previousMouseX, currentMouseX);
			wheelZoomEnabled = true;
		}
		
		previousMouseX = currentMouseX;
		
//		console.log("current: " + current[0] + ", " + current[1]);
		
		// Update selection box
		selectBox[2] = current[0];
		selectBox[3] = current[1];
		
//		console.log("sel after: " + selectBox[2] + ", " + selectBox[3]);
		
		if (!selectBox[4]) {
			hoverHandler(nodes, edges, e);
		}
		
		// No mouseclick
		currentMouseDownNode = undefined;
		currentMouseDownEdge = undefined;
		currentMouseDownUnmoved = false;
		
		if (minDistanceNode != undefined) {
		
			if (cy.renderer().canvas.style.cursor != 
					minDistanceNode._private.style["cursor"].value) {

				cy.renderer().canvas.style.cursor = 
					minDistanceNode._private.style["cursor"].value;
			}
			
			if (currentHoveredNode !== minDistanceNode) {

				// Proxy mouseout
				if (currentHoveredNode !== undefined) {
					if (touch) {
//						event.type = "touchend";
					} else {
//						event.type = "mouseout";
						currentHoveredNode.trigger("mouseout");
					}					
				}
				
				currentHoveredNode = minDistanceNode;
				
				var nodeGrabbed = minDistanceNode.grabbed();
				
				// Proxy mouseover
				if (touch && !nodeGrabbed) {
//					event.type = "touchmove";
				} else if (!touch && !nodeGrabbed) {
//					event.type = "mouseover";
					minDistanceNode.trigger("mouseover");
				}
				
			} else {
			
				// Proxy mousemove/touchmove
				if (touch) {
//					event.type = "touchmove";
					minDistanceNode.trigger("touchmove");
				} else {
//					event.type = "mousemove";
					minDistanceNode.trigger("mousemove");
				}
			}
			
		} else if (minDistanceEdge != undefined) {
		
			if (cy.renderer().canvas.style.cursor != 
					minDistanceEdge._private.style["cursor"].value) {

				cy.renderer().canvas.style.cursor = 
					minDistanceEdge._private.style["cursor"].value;
			}
			
			if (currentHoveredEdge !== minDistanceEdge) {

				// Proxy mouseout
				if (currentHoveredEdge !== undefined) {
					if (touch) {

					} else {
						currentHoveredEdge.trigger("mouseout");
					}
				}
				
				currentHoveredEdge = minDistanceEdge;
				
				var edgeGrabbed = minDistanceEdge.grabbed();
				
				// Proxy mouseover
				if (touch && !edgeGrabbed) {

				} else if (!touch && !edgeGrabbed) {
					minDistanceEdge.trigger("mouseover");
				}
				
			} else {
			
				// Proxy mousemove/touchmove
				if (touch) {
					minDistanceEdge.trigger("touchmove");
				} else {
					minDistanceEdge.trigger("mousemove");
				}
			}
			
			/*
			if (currentMouseInCanvas) {
			
				// Proxy mousemove/touchmove
				if (touch) {
					minDistanceEdge.trigger("touchmove");
				} else {
					minDistanceEdge.trigger("mousemove");
				}
				
			} else {
				
				// Proxy mouseover/touchstart
				if (touch) {
					minDistanceEdge.trigger("touchstart");
				} else {
					minDistanceEdge.trigger("mouseover");
				}
				
				currentMouseInCanvas = true;
			}
			*/
			
		} else {
		
			if (!minDistanceNode
				&& !minDistanceEdge
				&& cy.renderer().canvas.style.cursor != "default") {

					cy.renderer().canvas.style.cursor = "default";
			}
			
			// Proxy mouseout for elements
			if (currentHoveredEdge !== undefined) {
				if (touch) {

				} else {
					currentHoveredEdge.trigger("mouseout");
				}
				
				currentHoveredEdge = undefined;
			}
			
			if (currentHoveredNode !== undefined) {
				if (touch) {
					
				} else {
					currentHoveredNode.trigger("mouseout");
				}
				
				currentHoveredNode = undefined;
			}
			
			if (mouseJustEnteredCanvas) {
				// Proxy mouseover
				if (touch) {
	
				} else {
					cy.trigger("mouseover");
				}
				
				currentMouseInCanvas = true;
				mouseJustEnteredCanvas = false;
				
			} else {
//				console.log(currentMouseInCanvas);
				// Proxy mousemove/touchmove
				if (currentMouseInCanvas) {

					if (touch) {
						cy.trigger("touchmove");
					} else {
						cy.trigger("mousemove");
					}
				}
			}	
		}
		
		if (nodeDragging) {
		
			if (!draggedElementsMovedLayer) {
				for (var i = 0; i < nodesBeingDragged.length; i++) {
					nodesBeingDragged[i]._private.rscratch.layer2 = true;
				}
				
				for (var i = 0; i < edgesBeingDragged.length; i++) {
					edgesBeingDragged[i]._private.rscratch.layer2 = true;
				}
				
				renderer.canvasNeedsRedraw[4] = true;
				renderer.redrawReason[4].push("nodes being dragged, moved to drag layer");
				
				renderer.canvasNeedsRedraw[2] = true;
				renderer.redrawReason[2].push("nodes being dragged, moved to drag layer");
				
				draggedElementsMovedLayer = true;
			}
		
			for (var index = 0; index < nodes.length; index++) {
			
				/*
				if ((draggingSelectedNode && nodes[index].selected())
					|| (!draggingSelectedNode && nodes[index] == draggedNode)) {
				*/
				
				if ((draggingSelectedNode && nodes[index].selected())
					|| (!draggingSelectedNode && nodes[index] == draggedNode)) {
					
					if ( !nodes[index]._private.locked && nodes[index]._private.grabbable ) {					
						nodes[index]._private.position.x = 
							nodes[index]._private.rscratch.dragStartX
							+ (selectBox[2] - selectBox[0]);
						nodes[index]._private.position.y = 
							nodes[index]._private.rscratch.dragStartY
							+ (selectBox[3] - selectBox[1]);
							
						// Proxy event
						nodes[index].trigger("drag");
						nodes[index].trigger("position");
					}
				}
			}
			
			renderer.canvasNeedsRedraw[2] = true;
			renderer.redrawReason[2].push("nodes being dragged");
			
			/*
			if (draggingSelectedNode) {
				
			} else {
				draggedNode._private.position.x ==
					draggedNode._private.rscratch.dragStartX
					+ (selectBox[2] - selectBox[0]);
				draggedNode._private.position.y ==
					draggedNode._private.rscratch.dragStartY
					+ (selectBox[3] - selectBox[1]);
					
				console.log("dragging");
				console.log(draggedNode._private.rscratch.dragStartX 
					+ (selectBox[2] - selectBox[0]));
				
				console.log(draggedNode.position());
				console.log("pos:" + draggedNode._private.position.x);
			}
			*/
		}
		
		if (selectBox[4]) {
			renderer.canvasNeedsRedraw[0] = true;
			renderer.redrawReason[0].push("selection boxed moved");
		}
		
		if (dragPanMode || nodeDragging || selectBox[4]) {
			cy.renderer().redraw();
		}
	}
	
	CanvasRenderer.prototype.mouseUpHandler = function(event) {
	
		var touchEvent = undefined;
		
		if (event.changedTouches) {						
			event.preventDefault();
			
//			console.log("touchUp, " + event.changedTouches.length);
			
			touchEvent = event;
			
			event = event.changedTouches[0];
			event.button = 0;

			selectBox[2] = renderer.projectMouse(event)[0];
			selectBox[3] = renderer.projectMouse(event)[1];
		}
		
		var mouseDownEvent = event;
	
		var edges = cy.edges();
		var nodes = cy.nodes();
	
		var nodeBeingDragged = nodeDragging
				&& (Math.abs(selectBox[2] - selectBox[0]) 
				+ Math.abs(selectBox[3] - selectBox[1]) > 1);
				
		/*
		console.log("dx: " + Math.abs(selectBox[2] - selectBox[0]));
		console.log("dy: " + Math.abs(selectBox[3] - selectBox[1]));
		console.log("start: " + selectBox[0] + ", " + selectBox[1]);
		console.log("end: " + selectBox[2] + ", " + selectBox[3]);
		*/
		
		/*	
		if (draggedNode != undefined) {
			draggedNode._private.rscratch.layer2 = false;
		}
		*/
		
		for (var i = 0; i < nodesBeingDragged.length; i++) {
			nodesBeingDragged[i]._private.rscratch.layer2 = false;

			// Proxy free() event
			nodesBeingDragged[i]._private.grabbed = false;
			nodesBeingDragged[i].trigger("free");
		}
		
		nodesBeingDragged = [];
		
		for (var i = 0; i < edgesBeingDragged.length; i++) {
			edgesBeingDragged[i]._private.rscratch.layer2 = false;
		}
		
		// Proxy mouseup event
		var mouseUpElement = undefined;
		if (minDistanceNode !== undefined) {
			mouseUpElement = minDistanceNode;
		} else if (minDistanceEdge !== undefined) {
			mouseUpElement = minDistanceEdge;
		}
		
		mouseDownTime = undefined;
		
		var mouseUpEventName = undefined;
		if (touchEvent) {
			mouseUpEventName = "touchend";
		} else {
			mouseUpEventName = "mouseup";
		}
		
		if (mouseUpElement != undefined) {
			mouseUpElement.trigger(mouseUpEventName);

			if (mouseUpElement === currentMouseDownNode ||
				mouseUpElement === currentMouseDownEdge) {
				
				mouseUpElement.trigger("click");
			}
		} else {
			cy.trigger(mouseUpEventName);
		
			if (currentMouseDownUnmoved) {
				cy.trigger("click");
			}
		}
		
		// Deselect if not dragging or selecting additional
		if (!shiftDown && 
			!nodeBeingDragged) {
			
			var elementsToUnselect = cy.collection();
			
			for (var index = 0; index < nodes.length; index++) {
				nodes[index]._private.rscratch.selected = false;
				if (nodes[index]._private.selected) {
					// nodes[index].unselect();
					
					elementsToUnselect = elementsToUnselect.add(nodes[index]);
				}
			}
			
			for (var index = 0; index < edges.length; index++) {
				edges[index]._private.rscratch.selected = false;
				if (edges[index]._private.selected) {
					// edges[index].unselect();
					
					elementsToUnselect = elementsToUnselect.add(edges[index]);
				}
			}
			
			if (elementsToUnselect.length > 0) {
				elementsToUnselect.unselect();
			}
		}
		
		if (selectBox[4] == 1
			&& !nodeDragging
			&& Math.abs(selectBox[2] - selectBox[0]) 
				+ Math.abs(selectBox[3] - selectBox[1]) > 2) {
			
			var padding = 2;
			
			var edgeSelected;
			var select;
			
			var elementsToSelect = cy.collection();
			
			for (var index = 0; index < edges.length; index++) {
			
				edgeSelected = edges[index]._private.selected;

				var boxInBezierVicinity;
				var rscratch = edges[index]._private.rscratch;
				
				if (edges[index]._private.rscratch.isStraightEdge) {
				
					boxInBezierVicinity = $$.math.boxInBezierVicinity(
						selectBox[0], selectBox[1],
						selectBox[2], selectBox[3],
						edges[index]._private.rscratch.startX,
						edges[index]._private.rscratch.startY,
						(edges[index]._private.rscratch.startX + 
						 edges[index]._private.rscratch.endX) / 2,
						(edges[index]._private.rscratch.startY + 
						 edges[index]._private.rscratch.endY) / 2,
						edges[index]._private.rscratch.endX,
						edges[index]._private.rscratch.endY, padding);
						
				} else if (edges[index]._private.rscratch.isSelfEdge) {
				
					boxInBezierVicinity = $$.math.boxInBezierVicinity(
						selectBox[0], selectBox[1],
						selectBox[2], selectBox[3],
						edges[index]._private.rscratch.startX,
						edges[index]._private.rscratch.startY,
						edges[index]._private.rscratch.cp2ax,
						edges[index]._private.rscratch.cp2ay,
						edges[index]._private.rscratch.selfEdgeMidX,
						edges[index]._private.rscratch.selfEdgeMidY, padding);
					
					if (boxInBezierVicinity == 0) {
					
						boxInBezierVicinity = $$.math.boxInBezierVicinity(
							selectBox[0], selectBox[1],
							selectBox[2], selectBox[3],
							edges[index]._private.rscratch.selfEdgeMidX,
							edges[index]._private.rscratch.selfEdgeMidY,
							edges[index]._private.rscratch.cp2cx,
							edges[index]._private.rscratch.cp2cy,
							edges[index]._private.rscratch.endX,
							edges[index]._private.rscratch.endY, padding);
						
					}
					
				} else {
					
					boxInBezierVicinity = $$.math.boxInBezierVicinity(
							selectBox[0], selectBox[1],
							selectBox[2], selectBox[3],
							edges[index]._private.rscratch.startX,
							edges[index]._private.rscratch.startY,
							edges[index]._private.rscratch.cp2x,
							edges[index]._private.rscratch.cp2y,
							edges[index]._private.rscratch.endX,
							edges[index]._private.rscratch.endY, padding);
					
				}
				
				if (boxInBezierVicinity == 2) {
					select = true;
				} else if (boxInBezierVicinity == 1) {
					
					if (edges[index]._private.rscratch.isSelfEdge) {
					
						select = $$.math.checkBezierCrossesBox(
								selectBox[0], selectBox[1],
								selectBox[2], selectBox[3],
								edges[index]._private.rscratch.startX,
								edges[index]._private.rscratch.startY,
								edges[index]._private.rscratch.cp2ax,
								edges[index]._private.rscratch.cp2ay,
								edges[index]._private.rscratch.selfEdgeMidX,
								edges[index]._private.rscratch.selfEdgeMidY, padding);
						
						if (!select) {
						
							select = $$.math.checkBezierCrossesBox(
								selectBox[0], selectBox[1],
								selectBox[2], selectBox[3],
								edges[index]._private.rscratch.selfEdgeMidX,
								edges[index]._private.rscratch.selfEdgeMidY,
								edges[index]._private.rscratch.cp2cx,
								edges[index]._private.rscratch.cp2cy,
								edges[index]._private.rscratch.endX,
								edges[index]._private.rscratch.endY, padding);
						}
										
					} else if (edges[index]._private.rscratch.isStraightEdge) {
						
						select = $$.math.checkStraightEdgeCrossesBox(
								selectBox[0], selectBox[1],
								selectBox[2], selectBox[3],
								edges[index]._private.rscratch.startX,
								edges[index]._private.rscratch.startY,
								edges[index]._private.rscratch.endX,
								edges[index]._private.rscratch.endY, padding);
	
					} else {
						
						select = $$.math.checkBezierCrossesBox(
								selectBox[0], selectBox[1],
								selectBox[2], selectBox[3],
								edges[index]._private.rscratch.startX,
								edges[index]._private.rscratch.startY,
								edges[index]._private.rscratch.cp2x,
								edges[index]._private.rscratch.cp2y,
								edges[index]._private.rscratch.endX,
								edges[index]._private.rscratch.endY, padding);
						
					}
				} else {
					select = false;
				}
				
				if (select && !edgeSelected) {
					// edges[index].select();
					
					elementsToSelect = elementsToSelect.add(edges[index]);
				} else if (!select && edgeSelected) {
					// edges[index].unselect();
				}
			}
			
			var boxMinX = Math.min(selectBox[0], selectBox[2]);
			var boxMinY = Math.min(selectBox[1], selectBox[3]);
			var boxMaxX = Math.max(selectBox[0], selectBox[2]);
			var boxMaxY = Math.max(selectBox[1], selectBox[3]);
			
			var nodeSelected, select;
			
			var nodePosition, boundingRadius;
			for (var index = 0; index < nodes.length; index++) {
				nodeSelected = nodes[index]._private.selected;

				nodePosition = nodes[index].position();
				boundingRadius = nodes[index]._private.data.weight / 5.0;
				
				if (nodePosition.x > boxMinX
						- boundingRadius
					&& nodePosition.x < boxMaxX 
						+ boundingRadius
					&& nodePosition.y > boxMinY
						- boundingRadius
					&& nodePosition.y < boxMaxY
						+ boundingRadius) {
					
					select = true;
					nodes[index]._private.rscratch.selected = true;		
				} else {
					select = false;
					nodes[index]._private.rscratch.selected = false;
				}
				
				if (select && !nodeSelected) {
					// nodes[index].select();	
					
					elementsToSelect = elementsToSelect.add(nodes[index]);
				} else if (!select && nodeSelected) {
					// nodes[index].unselect();				
				}
			}
			
			if (elementsToSelect.length > 0) {
				elementsToSelect.select();
			}
			
		} else if (selectBox[4] == 0 && !nodeBeingDragged) {

			// Single node/edge selection
			if (minDistanceNode != undefined) {
				minDistanceNode._private.rscratch.hovered = false;
				minDistanceNode._private.rscratch.selected = true;
				
				if (!minDistanceNode._private.selected) {
					minDistanceNode.select();
				}
			} else if (minDistanceEdge != undefined) {
				minDistanceEdge._private.rscratch.hovered = false;
				minDistanceEdge._private.rscratch.selected = true;
				
				if (!minDistanceEdge._private.selected) {
					minDistanceEdge.select();
				}
			}
		}
	
		// Stop drag panning on mouseup
		dragPanMode = false;
//		console.log("drag pan stopped");
		
		if (cy.renderer().canvas.style.cursor != "default") {
			cy.renderer().canvas.style.cursor = "default";
		}
		
		selectBox[4] = 0;
//		selectBox[2] = selectBox[0];
//		selectBox[3] = selectBox[1];
		
		
		renderer.canvasNeedsRedraw[0] = true;
		renderer.redrawReason[0].push("Selection box gone");
		
		if (nodeBeingDragged) {
			renderer.canvasNeedsRedraw[2] = true;
			renderer.redrawReason[2].push("Node drag completed");
			
			renderer.canvasNeedsRedraw[4] = true;
			renderer.redrawReason[4].push("Node drag completed");
		}
		
		// Stop node dragging on mouseup
		nodeDragging = false;
		
		cy.renderer().redraw();
		
		if (touchEvent && touchEvent.touches.length == 1) {
			dragPanStartX = touchEvent.touches[0].clientX;
			dragPanStartY = touchEvent.touches[0].clientY;
			
			dragPanMode = true;
			
			if (cy.renderer().canvas.style.cursor 
				!= cy.style()._private.coreStyle["panning-cursor"].value) {

				cy.renderer().canvas.style.cursor 
					= cy.style()._private.coreStyle["panning-cursor"].value;
			}
		}
	}
	
	CanvasRenderer.prototype.windowMouseDownHandler = function(event) {
		
	}
	
	CanvasRenderer.prototype.windowMouseMoveHandler = function(event) {
		
	}
	
	CanvasRenderer.prototype.windowMouseUpHandler = function(event) {
		
	}
	
	CanvasRenderer.prototype.mouseWheelHandler = function(event) {
		
		if (!wheelZoomEnabled) {
			return;
		} else {
			event.preventDefault();
		}
		
		var deltaY = event.wheelDeltaY;
		
		cy.renderer().zoomLevel -= deltaY / 5.0 / 500;
		
		//console.log("zoomLevel: " + cy.renderer().zoomLevel);
		cy.renderer().scale[0] = Math.pow(10, -cy.renderer().zoomLevel);
		cy.renderer().scale[1] = Math.pow(10, -cy.renderer().zoomLevel);
		
		var current = cy.renderer().projectMouse(event);
		
		var zoomLevel = cy.zoom() * Math.pow(10, event.wheelDeltaY / 500);

		zoomLevel = Math.min(zoomLevel, 100);
		zoomLevel = Math.max(zoomLevel, 0.01);
		
		cy.zoom({level: zoomLevel, 
				position: {x: event.offsetX, 
							y: event.offsetY}});
		
		
		/*
		cy.zoom({level: zoomLevel, 
					renderedPosition: {x: current[0], 
							y: current[1]}});
		*/
		
//		cy.renderer().redraw();
	}
	
	CanvasRenderer.prototype.keyDownHandler = function(event) {
		if (event.keyCode == 16 && selectBox[4] != 1) {
			shiftDown = true;
		}
	}
	
	CanvasRenderer.prototype.keyUpHandler = function(event) {
		if (event.keyCode == 16) {
			selectBox[4] = 0;
			shiftDown = false;
		}
	}
	
	CanvasRenderer.prototype.mouseMoveHelper = function() {
		var dragHandler = function(mouseMoveEvent) {
			var offsetX = mouseMoveEvent.clientX - dragPanStartX;
			var offsetY = mouseMoveEvent.clientY - dragPanStartY;
			
			cy.panBy({x: offsetX, y: offsetY});

			dragPanStartX = mouseMoveEvent.clientX;
			dragPanStartY = mouseMoveEvent.clientY;

			/*
			cy.renderer().center[0] = dragPanInitialCenter[0] - offsetX / cy.renderer().scale[0];
			cy.renderer().center[1] = dragPanInitialCenter[1] - offsetY / cy.renderer().scale[1];
			*/
		};
		
		var checkBezierEdgeHover = function(mouseX, mouseY, edge) {
		
			// var squaredDistanceLimit = 19;
			var squaredDistanceLimit = Math.pow(edge._private.style["width"].value / 2, 2);
			var edgeWithinDistance = false;
		
			if ($$.math.inBezierVicinity(
					mouseX, mouseY,
					edge._private.rscratch.startX,
					edge._private.rscratch.startY,
					edge._private.rscratch.cp2x,
					edge._private.rscratch.cp2y,
					edge._private.rscratch.endX,
					edge._private.rscratch.endY,
					squaredDistanceLimit)) {
				
				//console.log("in vicinity")
				
				// edge._private.rscratch.selected = true;
				
				var squaredDistance = $$.math.sqDistanceToQuadraticBezier(
					mouseX,
					mouseY,
					edge._private.rscratch.startX,
					edge._private.rscratch.startY,
					edge._private.rscratch.cp2x,
					edge._private.rscratch.cp2y,
					edge._private.rscratch.endX,
					edge._private.rscratch.endY);
				
				// debug(distance);
				if (squaredDistance <= squaredDistanceLimit) {
					edgeWithinDistance = true;
					
					if (squaredDistance < minDistanceEdgeValue) {
						minDistanceEdge = edge;
						minDistanceEdgeValue = squaredDistance;
					}
				}	
			}
			
			return edgeWithinDistance;
		}
		
		var checkSelfEdgeHover = function(mouseX, mouseY, edge) {
			
			// var squaredDistanceLimit = 19;
			var squaredDistanceLimit = Math.pow(edge._private.style["width"].value / 2, 2);
			var edgeWithinDistance = false;
			var edgeFound = false;
			
			if ($$.math.inBezierVicinity(
					mouseX, mouseY,
					edge._private.rscratch.startX,
					edge._private.rscratch.startY,
					edge._private.rscratch.cp2ax,
					edge._private.rscratch.cp2ay,
					edge._private.rscratch.selfEdgeMidX,
					edge._private.rscratch.selfEdgeMidY)) {
				
				var squaredDistance = $$.math.sqDistanceToQuadraticBezier(
					mouseX, mouseY,
					edge._private.rscratch.startX,
					edge._private.rscratch.startY,
					edge._private.rscratch.cp2ax,
					edge._private.rscratch.cp2ay,
					edge._private.rscratch.selfEdgeMidX,
					edge._private.rscratch.selfEdgeMidY);
				
				// debug(distance);
				if (squaredDistance < squaredDistanceLimit) {
					
					edgeWithinDistance = true;
					
					if (squaredDistance < minDistanceEdgeValue) {
						minDistanceEdge = edge;
						minDistanceEdgeValue = squaredDistance;
						edgeFound = true;
					}
				}
			}
			
			// Perform the check with the second of the 2 quadratic Beziers
			// making up the self-edge if the first didn't pass
			if (!edgeFound && $$.math.inBezierVicinity(
					mouseX, mouseY,
					edge._private.rscratch.selfEdgeMidX,
					edge._private.rscratch.selfEdgeMidY,
					edge._private.rscratch.cp2cx,
					edge._private.rscratch.cp2cy,
					edge._private.rscratch.endX,
					edge._private.rscratch.endY)) {
				
				var squaredDistance = $$.math.sqDistanceToQuadraticBezier(
					mouseX, mouseY,
					edge._private.rscratch.selfEdgeMidX,
					edge._private.rscratch.selfEdgeMidY,
					edge._private.rscratch.cp2cx,
					edge._private.rscratch.cp2cy,
					edge._private.rscratch.endX,
					edge._private.rscratch.endY);
					
				// debug(distance);
				if (squaredDistance < squaredDistanceLimit) {
					
					edgeWithinDistance = true;
					
					if (squaredDistance < minDistanceEdgeValue) {
						minDistanceEdge = edge;
						minDistanceEdgeValue = squaredDistance;
						edgeFound = true;
					}
				}
			}
			
			return edgeWithinDistance;
		}
		
		var checkStraightEdgeHover = function(mouseX, mouseY, edge, x1, y1, x2, y2) {
			
			// var squaredDistanceLimit = 19;
			var squaredDistanceLimit = Math.pow(edge._private.style["width"].value / 2, 2);
			
			var nearEndOffsetX = mouseX - x1;
			var nearEndOffsetY = mouseY - y1;
			
			var farEndOffsetX = mouseX - x2;
			var farEndOffsetY = mouseY - y2;
			
			var displacementX = x2 - x1;
			var displacementY = y2 - y1;
			
			var distanceSquared;
			var edgeWithinDistance = false;
			
			if (nearEndOffsetX * displacementX 
				+ nearEndOffsetY * displacementY <= 0) {
				
					distanceSquared = (Math.pow(x1 - mouseX, 2)
						+ Math.pow(y1 - mouseY, 2));
			
			} else if (farEndOffsetX * displacementX 
				+ farEndOffsetY * displacementY >= 0) {
				
					distanceSquared = (Math.pow(x2 - mouseX, 2)
						+ Math.pow(y2 - mouseY, 2));
				
			} else {
				var rotatedX = displacementY;
				var rotatedY = -displacementX;
			
				// Use projection on rotated vector
				distanceSquared = Math.pow(nearEndOffsetX * rotatedX 
					+ nearEndOffsetY * rotatedY, 2)
					/ (rotatedX * rotatedX + rotatedY * rotatedY);
			}
			
			if (distanceSquared <= squaredDistanceLimit) {
				edgeWithinDistance = true;
			
				if (distanceSquared < minDistanceEdgeValue) {
					minDistanceEdge = edge;
					minDistanceEdgeValue = distanceSquared;
				}
			}
			
			return edgeWithinDistance;
		}
		
		var checkNodeHover = function(mouseX, mouseY, node) {
			var dX = mouseX - node.position().x;
			var dY = mouseY - node.position().y;
			
			/*
			console.log(node._private.rscratch.boundingRadiusSquared);
			console.log(dX * dX + dY * dY);
			*/
			
			var boundingRadiusSquared = Math.pow(
				Math.max(
					node._private.style["width"].value, 
					node._private.style["height"].value
						+ node._private.style["border-width"].value) / 2, 2);
			
			var distanceSquared = dX * dX + dY * dY;
			
			if (boundingRadiusSquared > distanceSquared) {
				
				if (distanceSquared < minDistanceNodeValue) {
					minDistanceNode = node;
					minDistanceNodeValue = distanceSquared;
					
					nodeHovered = true;
				}
				
				return true;
			}
			
			return false;
		}
	
		var hoverHandler = function(nodes, edges, mouseMoveEvent) {
			
			// Project mouse coordinates to world absolute coordinates
			var projected = cy.renderer().projectMouse(mouseMoveEvent); 

			/*
			console.log("projected x: " + projected[0]);
			console.log("projected y: " + projected[1]);
			cy.nodes()[0]._private.position.x = projected[0];
			cy.nodes()[0]._private.position.y = projected[1];
			*/
			
			var mouseX = projected[0];
			var mouseY = projected[1];
			
			if (minDistanceNode != undefined) {
				minDistanceNode = undefined;
				minDistanceNodeValue = 99999;
		
			} else if (minDistanceEdge != undefined) {
				minDistanceEdge = undefined;
				minDistanceEdgeValue = 99999;
			}
			
			nodeHovered = false;
			
			for (var index = 0; index < nodes.length; index++) {
				checkNodeHover(mouseX, mouseY, nodes[index]);
			}
			
			var edgeWithinDistance = false;
			var potentialPickedEdges = [];
			
			for (var index = 0; index < edges.length; index++) {
				if (nodeHovered) {
					break;
				} else if (edges[index]._private.rscratch.isStraightEdge) {
					edgeWithinDistance = checkStraightEdgeHover(
						mouseX, mouseY, edges[index],
						edges[index]._private.rscratch.startX,
						edges[index]._private.rscratch.startY,
						edges[index]._private.rscratch.endX,
						edges[index]._private.rscratch.endY);
				} else if (edges[index]._private.rscratch.isSelfEdge) {
					edgeWithinDistance = checkSelfEdgeHover(
						mouseX, mouseY, edges[index]);
				} else {
					edgeWithinDistance = checkBezierEdgeHover(
						mouseX, mouseY, edges[index]);
				}
				
				if (edgeWithinDistance) {
					potentialPickedEdges.push(edges[index]);
				}
				
				edgeWithinDistance = false;
			}
			
			if (potentialPickedEdges.length > 0) {
				potentialPickedEdges.sort(function(a, b) {
					return b._private.data.id.localeCompare(a._private.data.id);
				});
				
				potentialPickedEdges.sort(function(a, b) {
					return b._private.style["z-index"].value
						- a._private.style["z-index"].value
				});
				
				minDistanceEdge = potentialPickedEdges[0];
			} else {
				minDistanceEdge = undefined;
			}
			
			if (minDistanceNode != undefined) {
				minDistanceNode._private.rscratch.hovered = true;
			} else if (minDistanceEdge != undefined) {
				minDistanceEdge._private.rscratch.hovered = true;
			}
		}
		
		// Make these related functions (they reference each other) available
		this.mouseMoveHelper.dragHandler = dragHandler;
		this.mouseMoveHelper.checkBezierEdgeHover = checkBezierEdgeHover;
		this.mouseMoveHelper.checkStraightEdgeHover = checkStraightEdgeHover;
		this.mouseMoveHelper.checkNodeHover = checkNodeHover;
		this.mouseMoveHelper.hoverHandler = hoverHandler;
	}
	
	CanvasRenderer.prototype.load = function() {
		var self = this;
		
		this.mouseMoveHelper();
		
		document.addEventListener("keydown", this.keyDownHandler, false);
		document.addEventListener("keyup", this.keyUpHandler, false);
	
		this.bufferCanvases[0].addEventListener("mousedown", this.mouseDownHandler, false);
		window.addEventListener("mouseup", this.mouseUpHandler, false);
	
		window.addEventListener("mousemove", this.mouseMoveHandler, false);
		this.bufferCanvases[0].addEventListener("mouseout", this.mouseOutHandler, false);
		this.bufferCanvases[0].addEventListener("mouseover", this.mouseOverHandler, false);
		
		
		window.addEventListener("mousedown", this.windowMouseDownHandler, false);
		window.addEventListener("mousemove", this.windowMouseMoveHandler, false);
		window.addEventListener("mouseup", this.windowMouseUpHandler, false);
		
		this.bufferCanvases[0].addEventListener("mousewheel", this.mouseWheelHandler, false);
		
//		document.addEventListener("mousemove", this.documentMouseMoveHandler, false);
		
//		document.addEventListener("mousewheel", this.mouseWheelHandler, false);
	
		this.bufferCanvases[0].addEventListener("touchstart", this.mouseDownHandler, true);
		this.bufferCanvases[0].addEventListener("touchmove", this.mouseMoveHandler, true);
		this.bufferCanvases[0].addEventListener("touchend", this.mouseUpHandler, true);
		
		/*
		this.bufferCanvases[0].addEventListener("touchstart", this.mouseDownHandler, true);
		this.bufferCanvases[0].addEventListener("touchmove", this.mouseMoveHandler, true);
		this.bufferCanvases[0].addEventListener("touchend", this.mouseUpHandler, true);
		*/
	}
	
	CanvasRenderer.prototype.init = function() {}

	CanvasRenderer.prototype.complexSqrt = function(real, imaginary, zeroThreshold) {
		var hyp = Math.sqrt(real * real 
			+ imaginary * imaginary)
	
		var gamma = Math.sqrt(0.5 * (real + hyp));
			
		var sigma = Math.sqrt(0.5 * (hyp - real));
		if (imaginary < -zeroThreshold) {
			sigma = -sigma;
		} else if (imaginary < zeroThreshold) {
			sigma = 0;
		}
		
		return [gamma, sigma];
	}

	CanvasRenderer.prototype.initStyle = function() {
		var nodes = this.options.cy.nodes();
		var edges = this.options.cy.edges();
		
		var node;
		for (var index = 0; index < nodes.length; index++) {
			node = nodes[index];
			
			/*
			node._private.rscratch.boundingRadiusSquared = 
				Math.pow(node._private.style.size, 2);
				*/
			node._private.rscratch.override = {};
			
			// console.log(node._private.rscratch.override);
			
			var color = Math.max(Math.random(), 0.6);
			node._private.rscratch.override.regularColor = "rgba(" 
				+ String(Math.floor(color * 100 + 125)) + "," 
				+ String(Math.floor(color * 100 + 125)) + "," 
				+ String(Math.floor(color * 100 + 125)) + "," + 255 + ")"; 
			
			//String(color * 16777215);
			node._private.rscratch.override.regularBorderColor = "rgba(" 
				+ String(Math.floor(color * 70 + 160)) + "," 
				+ String(Math.floor(color * 70 + 160)) + "," 
				+ String(Math.floor(color * 70 + 160)) + "," + 255 + ")"; 
			
			var shape = Math.random();
			if (shape < 10.35) {
				node._private.rscratch.override.shape = "ellipse";
			} else if (shape < 0.49) {
				node._private.rscratch.override.shape = "hexagon";
			} else if (shape < 0.76) {
				node._private.rscratch.override.shape = "square";
			} else if (shape < 0.91) {
				node._private.rscratch.override.shape = "pentagon";
			} else {
				node._private.rscratch.override.shape = "octogon";
			}
			
			node._private.rscratch.canvas = document.createElement('canvas');
		}
		
		var edge;
		for (var index = 0; index < edges.length; index++) {
			edge = edges[index];
			
			edge._private.rscratch.cp2x = Math.random() 
				* this.options.cy.container().width();
			edge._private.rscratch.cp2y = Math.random() 
				* this.options.cy.container().height();
			
			edge._private.rscratch.override = {};
			
			if (Math.random() < 0.45) {
				edge._private.rscratch.override.endShape = "inhibitor";
			}
			
			edge._private.rscratch.override.regularColor = 
				edge.source()[0]._private.rscratch.override.regularBorderColor
				|| defaultNode.regularColor;
		}
	}
	
	CanvasRenderer.prototype.findBezierIntersection = function(edge, targetRadius) {
		
		var x1 = edge.source().position().x;
		var x3 = edge.target().position().x;
		var y1 = edge.source().position().y;
		var y3 = edge.target().position().y;
		
		var approxParam;
		
		var cp2x = edge._private.rscratch.cp2x;
		var cp2y = edge._private.rscratch.cp2y;
		
		approxParam = 0.5 + (0.5 - 0.5 * targetRadius / Math.sqrt(
			Math.pow(cp2x - x3, 2) + Math.pow(cp2y - y3, 2)));
		
		// console.log("approxParam: " + approxParam);
		
		var aX = x1 - 2 * cp2x + x3;
		var bX = -2 * x1 + 2 * cp2x;
		var cX = x1;

		var aY = y1 - 2 * cp2y + y3;
		var bY = -2 * y1 + 2 * cp2y;
		var cY = y1;
		
		var newEndPointX = aX * approxParam * approxParam + bX * approxParam + cX;
		var newEndPointY = aY * approxParam * approxParam + bY * approxParam + cY;
		
		var tan1ax = cp2x - x1;
		var tan1bx = x1;
		
		var tan1ay = cp2y - y1;
		var tan1by = y1;
		
		var tan2ax = newEndPointX - x3;
		var tan2bx = x3;
		
		var tan2ay = newEndPointY - y3;
		var tan2by = y3;
		
		var k;
		if (Math.abs(tan1ax) > 0.0001) {
			k = (tan1ay / tan1ax * (tan2bx - tan1bx) + tan1by - tan2by)
				/ (tan2ay - (tan1ay / tan1ax) * tan2ax);
		} else {
			k = (tan1bx - tan2bx) / (tan2ax);
		}
		
		// console.log("k: " + k);
		
		var newCp2x = tan2ax * k + tan2bx;
		var newCp2y = tan2ay * k + tan2by;

		edge._private.rscratch.newCp2x = newCp2x;
		edge._private.rscratch.newCp2y = newCp2y;
		
		edge._private.rscratch.newEndPointX = newEndPointX;
		edge._private.rscratch.newEndPointY = newEndPointY;
		
		/*
		console.log(newCp2x + ", " + newCp2y);
		console.log(newEndPointX + ", " + newEndPointY);
		*/
	}
	
	CanvasRenderer.prototype.findIntersection = function(x1, y1, x2, y2, targetRadius) {
		var dispX = x2 - x1;
		var dispY = y2 - y1;
		
		var len = Math.sqrt(dispX * dispX + dispY * dispY);
		
		var newLength = len - targetRadius;

		if (newLength < 0) {
			newLength = 0;
		}
		
		return [(newLength / len) * dispX + x1, (newLength / len) * dispY + y1];
	}
	
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
	
	// Finds new endpoints for a bezier edge based on desired source and target radii
	CanvasRenderer.prototype.findNewEndPoints 
		= function(startX, startY, cp2x, cp2y, endX, endY, radius1, radius2) {
		
		var startNearPt = this.findCircleNearPoint(startX, startY, radius1, cp2x, cp2y);
		var endNearPt = this.findCircleNearPoint(endX, endY, radius2, cp2x, cp2y);
		
		return [startNearPt[0], startNearPt[1], endNearPt[0], endNearPt[1]];
	}
	
	// Calculates new endpoints for all bezier edges based on desired source and 
	// target radii
	CanvasRenderer.prototype.calculateNewEndPoints = function() {
		
		var edges = cy.edges();
		var source, target;
		var endpoints;
		
		for (var i = 0; i < edges.length; i++) {
			source = edges[i].source()[0];
			target = edges[i].target()[0];
			
			if (edges[i]._private.rscratch.isStraightEdge) {
				continue;
			}
			
			endpoints = this.findNewEndPoints(
				source.position().x,
				source.position().y,
				edges[i]._private.rscratch.controlPointX,
				edges[i]._private.rscratch.controlPointY,
				target.position().x,
				target.position().y
			);
				
			edges[i]._private.rscratch.updatedStartX = endpoints[0];
			edges[i]._private.rscratch.updatedStartY = endpoints[1];
			edges[i]._private.rscratch.updatedEndX = endpoints[2];
			edges[i]._private.rscratch.updatedEndY = endpoints[3];
		}
		
	}
	
	// Contract for arrow shapes:
	// 0, 0 is arrow tip
	// (0, 1) is direction towards node
	// (1, 0) is right
	//
	// functional api:
	// collide: check x, y in shape
	// draw: draw
	// spacing: dist(arrowTip, nodeBoundary)
	// gap: dist(edgeTip, nodeBoundary), edgeTip may != arrowTip
		
	arrowShapes["arrow"] = {
		_points: [
			-0.15, -0.3,
			0, 0,
			0.15, -0.3
		],
		collide: function(x, y, centerX, centerY, width, height, direction, padding) {
			var points = arrowShapes["arrow"]._points;
			
			return renderer.pointInsidePolygon(
				x, y, points, centerX, width, height, direction, padding);
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
		collide: function(x, y, centerX, centerY, width, height, direction, padding) {
			// Transform x, y to get non-rotated ellipse
			
			y -= height * 0.15;
			
			if (width != height) {
				var angle = Math.asin(direction[1] / 
					(Math.sqrt(direction[0] * direction[0] 
						+ direction[1] * direction[1])));
			
				var cos = Math.cos(angle);
				var sin = Math.sin(angle);
				
				var rotatedPoint = 
					[x * cos - y * sin,
						y * cos + x * sin];
				
				var aspectRatio = (height + padding) / (width + padding);
				y /= aspectRatio;
				centerY /= aspectRatio;
				
				return (Math.pow(centerX - x, 2) 
					+ Math.pow(centerY - y, 2) <= Math.pow(width + padding, 2));
			} else {
				return (Math.pow(centerX - x, 2) 
					+ Math.pow(centerY - y, 2) <= Math.pow(width + padding, 2));
			}
		},
		draw: function(context) {
			context.translate(0, -0.15);
			context.arc(0, 0, 0.15, 0, Math.PI * 2, false);
		},
		spacing: function(edge) {
			return 0;
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
			
			return renderer.pointInsidePolygon(
				x, y, points, centerX, width, height, direction, padding);
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
			
			return renderer.pointInsidePolygon(
				x, y, points, centerX, width, height, direction, padding);
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
			0, 0.0
		],
		collide: function(x, y, centerX, centerY, width, height, direction, padding) {
			var points = arrowShapes["square"]._points;
			
			return renderer.pointInsidePolygon(
				x, y, points, centerX, width, height, direction, padding);
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
	
	/*
	arrowShapeDrawers["arrow"] = function(context) {
		// context.scale(context.lineWidth, context.lineWidth);
		context.lineTo(-0.15, 0.3);
		context.lineTo(0, 0);
		context.lineTo(0.15, 0.3);
	}
	arrowShapeSpacing["arrow"] = 0;
	arrowShapeGap["arrow"] = 4.5;
	
	arrowShapeDrawers["triangle"] = arrowShapeDrawers["arrow"];
	arrowShapeSpacing["triangle"] = arrowShapeSpacing["arrow"];
	arrowShapeGap["triangle"] = arrowShapeGap["arrow"];
	
	arrowShapeDrawers["none"] = function(context) {};
	arrowShapeSpacing["none"] = 0;
	arrowShapeGap["none"] = 0;
	
	arrowShapeDrawers["circle"] = function(context) {
		context.translate(0, -0.15);
		context.arc(0, 0, 0.15, 0, Math.PI * 2, false);
	};
	arrowShapeSpacing["circle"] = 0;
	arrowShapeGap["circle"] = 0.3;
	
	arrowShapeDrawers["inhibitor"] = function(context) {
		// context.scale(context.lineWidth, context.lineWidth);
		context.lineTo(-0.25, 0);
		context.lineTo(-0.25, -0.1);
		context.lineTo(0.25, -0.1);
		context.lineTo(0.25, 0);
	};
	arrowShapeSpacing["inhibitor"] = 4;
	arrowShapeGap["inhibitor"] = 4;
	
	arrowShapeDrawers["tee"] = arrowShapeDrawers["inhibitor"];
	arrowShapeSpacing["tee"] = arrowShapeSpacing["inhibitor"];
	arrowShapeGap["tee"] = arrowShapeGap["inhibitor"];
	*/
	
	CanvasRenderer.prototype.drawArrowShape = function(shape, x, y, dispX, dispY) {
		var angle = Math.asin(dispY / (Math.sqrt(dispX * dispX + dispY * dispY)));
						
		if (dispX < 0) {
			//context.strokeStyle = "AA99AA";
			angle = angle + Math.PI / 2;
		} else {
			//context.strokeStyle = "AAAA99";
			angle = - (Math.PI / 2 + angle);
		}
		
		var context = this.context;
		
		context.save();
		
		context.translate(x, y);
		
		context.moveTo(0, 0);
		context.rotate(-angle);
		
		var size = Math.max(Math.pow(context.lineWidth * 13.37, 0.9), 29);
		/// size = 100;
		context.scale(size, size);
		
		context.beginPath();
		
		arrowShapes[shape].draw(context);
		
		context.closePath();
		
//		context.stroke();
		context.fill();
		context.restore();
	}
	
	CanvasRenderer.prototype.findEndpoints = function(edge) {
		var intersect;

		var source = edge.source()[0];
		var target = edge.target()[0];
		
		var sourceRadius = Math.max(edge.source()[0]._private.style["width"].value,
			edge.source()[0]._private.style["height"].value);
		
		var targetRadius = Math.max(edge.target()[0]._private.style["width"].value,
			edge.target()[0]._private.style["height"].value);
		
		sourceRadius = 0;
		targetRadius /= 2;
		
		var start = [edge.source().position().x, edge.source().position().y];
		var end = [edge.target().position().x, edge.target().position().y];
		
		if (edge._private.rscratch.isSelfEdge) {
			
			var cp = [edge._private.rscratch.cp2cx, edge._private.rscratch.cp2cy];
			
			intersect = nodeShapes[target._private.style["shape"].value].intersectLine(
				target,
				target._private.style["width"].value,
				target._private.style["height"].value,
				cp[0], //halfPointX,
				cp[1] //halfPointY
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

			intersect = nodeShapes[source._private.style["shape"].value].intersectLine(
				source,
				source._private.style["width"].value,
				source._private.style["height"].value,
				cp[0], //halfPointX,
				cp[1] //halfPointY
			);
			
			var arrowStart = this.shortenIntersection(intersect, cp,
				arrowShapes[edge._private.style["source-arrow-shape"].value].spacing(edge));
			var edgeStart = this.shortenIntersection(intersect, cp,
				arrowShapes[edge._private.style["source-arrow-shape"].value].gap(edge));
			
			edge._private.rscratch.startX = edgeStart[0];
			edge._private.rscratch.startY = edgeStart[1];
			
			edge._private.rscratch.arrowStartX = arrowStart[0];
			edge._private.rscratch.arrowStartY = arrowStart[1];
			
		} else if (edge._private.rscratch.isStraightEdge) {
			
			intersect = nodeShapes[target._private.style["shape"].value].intersectLine(
				target,
				target._private.style["width"].value,
				target._private.style["height"].value,
				source.position().x,
				source.position().y);
				
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
		
			intersect = nodeShapes[source._private.style["shape"].value].intersectLine(
				source,
				source._private.style["width"].value,
				source._private.style["height"].value,
				target.position().x,
				target.position().y);
			
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
						
		} else if (edge._private.rscratch.isBezierEdge) {
			
			var cp = [edge._private.rscratch.cp2x, edge._private.rscratch.cp2y];
			
			// Point at middle of Bezier
			var halfPointX = start[0] * 0.25 + end[0] * 0.25 + cp[0] * 0.5;
			var halfPointY = start[1] * 0.25 + end[1] * 0.25 + cp[1] * 0.5;
			
			intersect = nodeShapes[
				target._private.style["shape"].value].intersectLine(
				target,
				target._private.style["width"].value,
				target._private.style["height"].value,
				cp[0], //halfPointX,
				cp[1] //halfPointY
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
				source._private.style["shape"].value].intersectLine(
				source,
				source._private.style["width"].value,
				source._private.style["height"].value,
				cp[0], //halfPointX,
				cp[1] //halfPointY
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
	
	CanvasRenderer.prototype.drawArrowhead = function(edge) {
		
		var endShape = edge._private.rscratch.override.endShape;
		endShape = endShape ? endShape : defaultEdge.endShape;
		
		var dispX = edge.target().position().x - edge._private.rscratch.newEndPointX;
		var dispY = edge.target().position().y - edge._private.rscratch.newEndPointY;
		
		this.drawArrowShape(edge, edge._private.rscratch.newEndPointX, 
			edge._private.rscratch.newEndPointY, dispX, dispY);
	}
	
	CanvasRenderer.prototype.drawArrowheads = function(edge) {
		// Displacement gives direction for arrowhead orientation
		var dispX, dispY;

		var startX = edge._private.rscratch.arrowStartX;
		var startY = edge._private.rscratch.arrowStartY;
		
		dispX = startX - edge.source().position().x;
		dispY = startY - edge.source().position().y;
		
		//this.context.strokeStyle = "rgba("
		this.context.fillStyle = "rgba("
			+ edge._private.style["source-arrow-color"].value[0] + ","
			+ edge._private.style["source-arrow-color"].value[1] + ","
			+ edge._private.style["source-arrow-color"].value[2] + ","
			+ edge._private.style.opacity.value + ")";
		
		this.context.lineWidth = edge._private.style["width"].value;
		
		this.drawArrowShape(edge._private.style["source-arrow-shape"].value, 
			startX, startY, dispX, dispY);
		
		var endX = edge._private.rscratch.arrowEndX;
		var endY = edge._private.rscratch.arrowEndY;
		
		dispX = -(edge.target().position().x - endX);
		dispY = -(edge.target().position().y - endY);
		
		//this.context.strokeStyle = "rgba("
		this.context.fillStyle = "rgba("
			+ edge._private.style["target-arrow-color"].value[0] + ","
			+ edge._private.style["target-arrow-color"].value[1] + ","
			+ edge._private.style["target-arrow-color"].value[2] + ","
			+ edge._private.style.opacity.value + ")";
		
		this.context.lineWidth = edge._private.style["width"].value;
		
		this.drawArrowShape(edge._private.style["target-arrow-shape"].value,
			endX, endY, dispX, dispY);
	}
	
	CanvasRenderer.prototype.drawStraightArrowhead = function(edge) {
		
		var dispX = edge.target().position().x 
			- edge._private.rscratch.newStraightEndX;
		var dispY = edge.target().position().y 
			- edge._private.rscratch.newStraightEndY;
		
		this.drawArrowShape(
			edge, edge._private.rscratch.newStraightEndX,
			edge._private.rscratch.newStraightEndY,
			dispX, dispY);
	}
	
	
	CanvasRenderer.prototype.calculateEdgeMetrics = function(edge) {
		if (edge._private.data.source == edge._private.data.target) {
			edge._private.rscratch.selfEdge = true;
			return;
		}
		
		// Calculate the 2nd control point
		var startNode = edge._private.data.source < edge._private.data.target ?
			edge.source()[0] : edge.target()[0];
		var endNode = edge._private.data.target < edge._private.data.source ? 
			edge.source()[0] : edge.target()[0];
		
		var middlePointX = 0.5 * (startNode._private.position.x + endNode._private.position.x);
		var middlePointY = 0.5 * (startNode._private.position.y + endNode._private.position.y);
		
		if (this.nodePairEdgeData[edge._private.rscratch.nodePairId] == 1) {
			edge._private.rscratch.straightEdge = true;
			edge._private.rscratch.cp2x = middlePointX;
			edge._private.rscratch.cp2y = middlePointY;
			
			return;
		}
	
		/*
		console.log(startNode._private);
		console.log(endNode._private);
		*/
		
		var numerator = edge._private.rscratch.nodePairEdgeNum - 1;
		var denominator = this.nodePairEdgeData[edge._private.rscratch.nodePairId] - 1;
		var offsetFactor = (numerator / denominator - 0.5);
		
		if (Math.abs(offsetFactor) < 0.0001) {
			edge._private.rscratch.straightEdge = true;
			edge._private.rscratch.cp2x = middlePointX;
			edge._private.rscratch.cp2y = middlePointY;
			//console.log(edge._private.rscratch.cp2x + ", " + edge._private.rscratch.cp2y);
			return;
		}
		
			
		var displacementX = endNode._private.position.x - startNode._private.position.x;
		var displacementY = endNode._private.position.y - startNode._private.position.y;
		
		var offsetX = displacementY * offsetFactor;
		var offsetY = -displacementX * offsetFactor;
		
		edge._private.rscratch.cp2x = middlePointX + offsetX;
		edge._private.rscratch.cp2y = middlePointY + offsetY;
	}
	
	var generateUnitNgonPoints = function(sides, rotationRadians) {
		
		var increment = 1.0 / sides * 2 * Math.PI;
		var startAngle = sides % 2 == 0 ? 
			Math.PI / 2.0 + increment / 2.0 : Math.PI / 2.0;
		
		startAngle += rotationRadians;
		
		var points = new Array(sides * 2);
		
		var currentAngle;
		for (var i = 0; i < sides; i++) {
			currentAngle = i * increment + startAngle;
			
			points[2 * i] = Math.cos(currentAngle);// * (1 + i/2);
			points[2 * i + 1] = Math.sin(-currentAngle);//  * (1 + i/2);
		}
		
		return points;
	}
	
	CanvasRenderer.prototype.findPolygonIntersection = function(
		node, width, height, x, y, points) {
		
		var intersections = renderer.polygonIntersectLine(
			x, y,
			points,
			node._private.position.x,
			node._private.position.y,
			width / 2, height / 2,
			node._private.style["border-width"].value / 2);
		
		// If there's multiple, only give the nearest
		return renderer.findNearestIntersection(intersections, x, y);
	}

	
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
	
	nodeShapeDrawers["ellipse"] = function(node, width, height) {
		var context = renderer.context;
	
		context.beginPath();
		context.save();
		context.translate(node._private.position.x, node._private.position.y);
		context.scale(width / 2, height / 2);
		// At origin, radius 1, 0 to 2pi
		context.arc(0, 0, 1, 0, Math.PI * 2, false);
		context.closePath();
		context.restore();
		context.fill();
	}
	
	// Intersect node shape vs line from (x, y) to node center
	nodeShapeIntersectLine["ellipse"] = function(
		node, width, height, x, y) {
	
		var intersect = renderer.intersectLineEllipse(
			x, y,
			node.position().x,
			node.position().y,
			width / 2 + node._private.style["border-width"].value / 2,
			height / 2 + node._private.style["border-width"].value / 2);
			
		return intersect;
	}
	
	// Node shape contract:
	//
	// draw: draw
	// intersectLine: report intersection from x, y, to node center
	// checkPoint: check x, y in node
	
	nodeShapes["ellipse"] = {
		draw: function(node, width, height) {
			var context = renderer.context;
		
			context.beginPath();
			context.save();
			context.translate(node._private.position.x, node._private.position.y);
			context.scale(width / 2, height / 2);
			// At origin, radius 1, 0 to 2pi
			context.arc(0, 0, 1, 0, Math.PI * 2, false);
			context.closePath();
			context.restore();
			context.fill();
		},
		
		intersectLine: function(node, width, height, x, y) {
			var intersect = renderer.intersectLineEllipse(
			x, y,
			node.position().x,
			node.position().y,
			width / 2 + node._private.style["border-width"].value / 2,
			height / 2 + node._private.style["border-width"].value / 2);
			
			return intersect;
		}
	}
	
	nodeShapes["triangle"] = {
		points: generateUnitNgonPoints(3, 0),
		
		draw: function(node, width, height) {
			renderer.drawPolygon(node._private.position.x,
				node._private.position.y, width, height, nodeShapes["triangle"].points);
		},
		intersectLine: function(node, width, height, x, y) {
			return renderer.findPolygonIntersection(
				node, width, height, x, y, nodeShapes["triangle"].points);
		}
	}
	
	nodeShapes["square"] = {
		points: generateUnitNgonPoints(4, 0),
		
		draw: function(node, width, height) {
			renderer.drawPolygon(node._private.position.x,
				node._private.position.y, width, height, nodeShapes["square"].points);
		},
		intersectLine: function(node, width, height, x, y) {
			return renderer.findPolygonIntersection(
				node, width, height, x, y, nodeShapes["square"].points);
		}
	}
	
	nodeShapes["rectangle"] = nodeShapes["square"];
	
	nodeShapes["pentagon"] = {
		points: generateUnitNgonPoints(5, 0),
		
		draw: function(node, width, height) {
			renderer.drawPolygon(node._private.position.x,
				node._private.position.y, width, height, nodeShapes["pentagon"].points);
		},
		intersectLine: function(node, width, height, x, y) {
			return renderer.findPolygonIntersection(
				node, width, height, x, y, nodeShapes["pentagon"].points);
		}
	}
	
	nodeShapes["hexagon"] = {
		points: generateUnitNgonPoints(6, 0),
		
		draw: function(node, width, height) {
			renderer.drawPolygon(node._private.position.x,
				node._private.position.y, width, height, nodeShapes["hexagon"].points);
		},
		intersectLine: function(node, width, height, x, y) {
			return renderer.findPolygonIntersection(
				node, width, height, x, y, nodeShapes["hexagon"].points);
		}
	}
	
	nodeShapes["heptagon"] = {
		points: generateUnitNgonPoints(7, 0),
		
		draw: function(node, width, height) {
			renderer.drawPolygon(node._private.position.x,
				node._private.position.y, width, height, nodeShapes["heptagon"].points);
		},
		intersectLine: function(node, width, height, x, y) {
			return renderer.findPolygonIntersection(
				node, width, height, x, y, nodeShapes["heptagon"].points);
		}
	}
	
	nodeShapes["octogon"] = {
		points: generateUnitNgonPoints(8, 0),
		
		draw: function(node, width, height) {
			renderer.drawPolygon(node._private.position.x,
				node._private.position.y, width, height, nodeShapes["octagon"].points);
		},
		intersectLine: function(node, width, height, x, y) {
			return renderer.findPolygonIntersection(
				node, width, height, x, y, nodeShapes["octagon"].points);
		}
	}
	
	nodeShapeDrawers["triangle"] = function(node, width, height) {
		cy.renderer().drawPolygon(node._private.position.x,
			node._private.position.y, width, height, "triangle", 3);
	}
	
	nodeShapeIntersectLine["triangle"] = function(node, width, height, x, y) {
		return renderer.findPolygonIntersection(node, width, height, x, y, "triangle", 3);
	}
	
	nodeShapeDrawers["square"] = function(node, width, height) {
		cy.renderer().drawPolygon(node._private.position.x,
			node._private.position.y, width, height, "square", 4);
	}
	
	nodeShapeIntersectLine["square"] = function(node, width, height, x, y) {
		return renderer.findPolygonIntersection(node, width, height, x, y, "square", 4);
	}
	
	nodeShapeDrawers["rectangle"] = nodeShapeDrawers["square"];
	nodeShapeIntersectLine["rectangle"] = nodeShapeIntersectLine["square"];
	
	nodeShapeDrawers["pentagon"] = function(node, width, height) {
		cy.renderer().drawNgon(node._private.position.x,
			node._private.position.y, width, height, "pentagon", 5);
	}
	
	nodeShapeIntersectLine["pentagon"] = function(node, width, height, x, y) {
		return renderer.findPolygonIntersection(node, width, height, x, y, "pentagon", 5);
	}
	
	nodeShapeDrawers["hexagon"] = function(node, width, height) {
		cy.renderer().drawNgon(node._private.position.x,
			node._private.position.y, width, height, "hexagon", 6);
	}
	
	nodeShapeIntersectLine["hexagon"] = function(node, width, height, x, y) {
		return renderer.findPolygonIntersection(node, width, height, x, y, "hexagon", 6);
	}
	
	nodeShapeDrawers["heptagon"] = function(node, width, height) {
		cy.renderer().drawNgon(node._private.position.x,
			node._private.position.y, width, height, "heptagon", 7);
	}
	
	nodeShapeIntersectLine["heptagon"] = function(node, width, height, x, y) {
		return renderer.findPolygonIntersection(node, width, height, x, y, "heptagon", 7);
	}
	
	nodeShapeDrawers["octagon"] = function(node, width, height) {
		cy.renderer().drawNgon(node._private.position.x,
			node._private.position.y, width, height, "octagon", 8);
	}
	
	nodeShapeIntersectLine["octagon"] = function(node, width, height, x, y) {
		return renderer.findPolygonIntersection(node, width, height, x, y, "octagon", 8);
	}
	
	// nodeShapeUnitPoints["triangle"] = generateNgonPoints(
	
	// Generates points for an n-sided polygon, using a circle of radius 1.
	/*
	CanvasRenderer.prototype.generateUnitNgonPoints = function(sides, rotationRadians) {
		
		var increment = 1.0 / sides * 2 * Math.PI;
		var startAngle = sides % 2 == 0 ? Math.PI / 2.0 + increment / 2.0 : Math.PI / 2.0;
		
		startAngle += rotationRadians;
		
		var points = new Array(sides * 2);
		
		var currentAngle;
		for (var i = 0; i < sides; i++) {
			currentAngle = i * increment + startAngle;
			
			points[2 * i] = Math.cos(currentAngle);
			points[2 * i + 1] = Math.sin(currentAngle);
		}
		
		return points;
	}
	*/
	
	CanvasRenderer.prototype.findNearestIntersection = function(intersections, x, y) {
		
		var distSquared;
		var minDistSquared;
		
		var minDistanceX;
		var minDistanceY;
		
		if (intersections.length == 0) {
			return [];
		}
		
		for (var i = 0; i < intersections.length / 2; i++) {
			distSquared = Math.pow(x - intersections[i * 2], 2)
				+ Math.pow(y - intersections[i * 2 + 1], 2);
			
			if (minDistSquared == undefined || minDistSquared > distSquared) {
				minDistSquared = distSquared;
				
				minDistanceX = intersections[i * 2];
				minDistanceY = intersections[i * 2 + 1];
			}
		}
		
		return [minDistanceX, minDistanceY];
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

	CanvasRenderer.prototype.drawPolygon = function(
		x, y, width, height, points) {

		var context = cy.renderer().context;
		context.save();
		context.translate(x, y);
		context.beginPath();
		
		context.scale(width / 2, height / 2);
		context.moveTo(points[0], points[1]);
		
		for (var i = 1; i < points.length / 2; i++) {
			context.lineTo(points[i * 2], points[i * 2 + 1]);
		}
		
		context.closePath();
		context.fill();
		
		context.restore();
	}

	CanvasRenderer.prototype.pointInsidePolygon = function(
		x, y, basePoints, centerX, centerY, width, height, direction, padding) {
		
		var transformedPoints = new Array(basePoints.length)
		
		var angle = Math.asin(direction[1] / (Math.sqrt(direction[0] * direction[0] 
			+ direction[1] * direction[1])));
		
		if (direction[0] < 0) {
			angle = angle + Math.PI / 2;
		} else {
			angle = -angle - Math.PI / 2;
		}
		
		for (var i = 0; i < transformedPoints.length / 2; i++) {
			transformedPoints[i * 2] = 
				width * (basePoints[i * 2] * Math.cos(angle) 
					- basePoints[i * 2 + 1] * Math.sin(angle));
			
			transformedPoints[i * 2 + 1] = 
				height * (basePoints[i * 2 + 1] * Math.cos(angle) 
					+ basePoints[i * 2] * Math.sin(angle));
			
			transformedPoints[i * 2] += centerX;
			transformedPoints[i * 2 + 1] += centerY;
		}
		
		var expandedLineSet = this.expandPolygon(
			transformedPoints,
			-padding);
		
		var points = this.joinLines(expandedLineSet);
		
		var x1, y1, x2, y2;
		var y3;
		
		// Intserect with vertical line through (x, y)
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
			} else {
				continue;
			}
			
		}
		
		if (up % 2 == 0) {
			return false;
		} else {
			return true;
		}
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
		
		var expandedLineSet = this.expandPolygon(
			transformedPoints,
			-padding);
		
		var points = this.joinLines(expandedLineSet);
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
	};
	
	CanvasRenderer.prototype.drawNgon = function(x, y, sides, width, height) {
		var context = cy.renderer().context;
		context.save();
		context.translate(x, y);
		context.beginPath();
		
		var increment = 1 / sides * 2 * Math.PI;
		var startAngle = sides % 2 == 0? Math.PI / 2 + increment / 2 : Math.PI / 2;
		
		context.scale(width / 2, height / 2);
		
		context.moveTo(Math.cos(startAngle), -Math.sin(startAngle));
		for (var angle = startAngle;
			angle < startAngle + 2 * Math.PI; angle += increment) {
		
			context.lineTo(Math.cos(angle), -Math.sin(angle));
		}
		
		context.closePath();
		context.fill();
		
		context.restore();
	}
	
	// Sizes canvas to container if different size
	CanvasRenderer.prototype.matchCanvasSize = function(container) {
		var width = container.clientWidth;
		var height = container.clientHeight;
		
		var canvas;
		for (var i = 0; i < this.canvases.length + this.bufferCanvases.length; i++) {
			
			if (i < this.canvases.length) {
				canvas = this.canvases[i];
			} else {
				canvas = this.bufferCanvases[i - this.canvases.length];
			}
			
			if (canvas.width !== width || canvas.height !== height) {
				
				canvas.width = width;
				canvas.height = height;
			
			}
		}
	}
	
	var doSingleRedraw = false;
	
	CanvasRenderer.prototype.redraw = function(singleRedraw) {
		
		renderer.matchCanvasSize(renderer.container);
		
		if (redrawTimeout) {
//			doSingleRedraw = true;
			// return;
		}
		
		redrawTimeout = setTimeout(function() {
			redrawTimeout = null;
			if (doSingleRedraw && !singleRedraw) {
				renderer.redraw(true);
				doSingleRedraw = false;
				
				// console.log("singleRedraw");
			}
		}, 1000 / 80);
		
		var context = this.context;
		var contexts = this.canvasContexts;
		
		var elements = this.options.cy.elements().toArray();
		var elementsLayer2 = [];
		var elementsLayer4 = [];
		
		if (this.canvasNeedsRedraw[2] || this.canvasNeedsRedraw[4]) {
		
			this.findEdgeControlPoints(this.options.cy.edges());
			
			elements.sort(function(a, b) {
				var result = a._private.style["z-index"].value
					- b._private.style["z-index"].value;
				
				if (result == 0) {
					if (a._private.group == "nodes"
						&& b._private.group == "edges") {
						
						return 1;
					} else if (a._private.group == "edges"
						&& b._private.group == "nodes") {
						
						return -1;
					}
				}
				
				return 0;
			});
		}
		
		if (this.canvasNeedsRedraw[2]) {
			context = this.canvasContexts[2];
			this.context = context;
			
			context.setTransform(1, 0, 0, 1, 0, 0);
			context.clearRect(0, 0, context.canvas.width, context.canvas.height);
			
			context.translate(this.cy.pan().x, this.cy.pan().y);
			context.scale(this.cy.zoom(), this.cy.zoom());
			
			var element;

			for (var index = 0; index < elements.length; index++) {
				element = elements[index];
				
				if (element._private.rscratch.layer2) {
					if (element._private.group == "nodes") {
						this.drawNode(element);
					} else if (element._private.group == "edges") {
						this.drawEdge(element);
					}
				}
			}
			
			for (var index = 0; index < elements.length; index++) {
				element = elements[index];
				
				if (element._private.rscratch.layer2) {
					if (element._private.group == "nodes") {
						this.drawNodeText(element);
					} else if (element._private.group == "edges") {
						this.drawEdgeText(element);
					}
				}
			}
			
			this.canvasNeedsRedraw[2] = false;
			this.redrawReason[2] = [];
		}
		
		if (this.canvasNeedsRedraw[4]) {
			context = this.canvasContexts[4];
			this.context = context;
			
			context.setTransform(1, 0, 0, 1, 0, 0);
			context.clearRect(0, 0, context.canvas.width, context.canvas.height);
			
			context.translate(this.cy.pan().x, this.cy.pan().y);
			context.scale(this.cy.zoom(), this.cy.zoom());
		
//			console.log(4, this.redrawReason[4]);
		
			var element;
			
			for (var index = 0; index < elements.length; index++) {
				element = elements[index];
				
				if (!element._private.rscratch.layer2) {
					if (element._private.group == "nodes") {
						this.drawNode(element);
					} else if (element._private.group == "edges") {
						this.drawEdge(element);
					}
				}
			}
			
			for (var index = 0; index < elements.length; index++) {
				element = elements[index];
				
				if (!element._private.rscratch.layer2) {
					if (element._private.group == "nodes") {
						this.drawNodeText(element);
					} else if (element._private.group == "edges") {
						this.drawEdgeText(element);
					}
				}
			}
			
			this.canvasNeedsRedraw[4] = false;
			this.redrawReason[4] = [];
		}
		
		if (this.canvasNeedsRedraw[0]) {
			context = this.canvasContexts[0];
			
			context.setTransform(1, 0, 0, 1, 0, 0);
			context.clearRect(0, 0, context.canvas.width, context.canvas.height);
		
			context.translate(this.cy.pan().x, this.cy.pan().y);
			context.scale(this.cy.zoom(), this.cy.zoom());
			
			// console.log(0, this.redrawReason[0], selectBox[4]);
			
			if (selectBox[4] == 1) {
				var coreStyle = cy.style()._private.coreStyle;
				var borderWidth = coreStyle["selection-box-border-width"].value;
				
				context.lineWidth = borderWidth;
				context.fillStyle = "rgba(" 
					+ coreStyle["selection-box-color"].value[0] + ","
					+ coreStyle["selection-box-color"].value[1] + ","
					+ coreStyle["selection-box-color"].value[2] + ","
					+ coreStyle["selection-box-opacity"].value + ")";
				
				context.fillRect(selectBox[0] + borderWidth / 2,
					selectBox[1] + borderWidth / 2,
					selectBox[2] - selectBox[0] - borderWidth / 2,
					selectBox[3] - selectBox[1] - borderWidth / 2);
				
				if (borderWidth > 0) {
					context.strokeStyle = "rgba(" 
						+ coreStyle["selection-box-border-color"].value[0] + ","
						+ coreStyle["selection-box-border-color"].value[1] + ","
						+ coreStyle["selection-box-border-color"].value[2] + ","
						+ coreStyle["selection-box-opacity"].value + ")";
					
					context.strokeRect(selectBox[0] + borderWidth / 2,
						selectBox[1] + borderWidth / 2,
						selectBox[2] - selectBox[0] - borderWidth / 2,
						selectBox[3] - selectBox[1] - borderWidth / 2);
				}
			}
			
			this.canvasNeedsRedraw[0] = false;
			this.redrawReason[0] = [];
		}
		
		// Rasterize the layers
		this.bufferCanvasContexts[1].globalCompositeOperation = "copy";
		this.bufferCanvasContexts[1].drawImage(this.canvases[4], 0, 0);
		this.bufferCanvasContexts[1].globalCompositeOperation = "source-over";
		this.bufferCanvasContexts[1].drawImage(this.canvases[2], 0, 0);
		this.bufferCanvasContexts[1].drawImage(this.canvases[0], 0, 0);

		this.bufferCanvasContexts[0].globalCompositeOperation = "copy";
		this.bufferCanvasContexts[0].drawImage(this.bufferCanvases[1], 0, 0);
	};
	
	CanvasRenderer.prototype.drawEdge = function(edge) {
		var context = renderer.context;
		
		var startNode, endNode;

		startNode = edge.source()[0];
		endNode = edge.target()[0];
		
		if (edge._private.style["visibility"].value != "visible"
			|| startNode._private.style["visibility"].value != "visible"
			|| endNode._private.style["visibility"].value != "visible") {
			return;
		}
		
		// Edge color & opacity
		context.strokeStyle = "rgba(" 
			+ edge._private.style["line-color"].value[0] + ","
			+ edge._private.style["line-color"].value[1] + ","
			+ edge._private.style["line-color"].value[2] + ","
			+ edge._private.style.opacity.value + ")";
		
		// Edge line width
		if (edge._private.style["width"].value <= 0) {
			return;
		}
		
		context.lineWidth = edge._private.style["width"].value;
		
		this.findEndpoints(edge);
		
		if (edge._private.rscratch.isSelfEdge) {
		
			context.beginPath();
			context.moveTo(
				edge._private.rscratch.startX,
				edge._private.rscratch.startY)
			
			context.quadraticCurveTo(
				edge._private.rscratch.cp2ax,
				edge._private.rscratch.cp2ay,
				edge._private.rscratch.selfEdgeMidX,
				edge._private.rscratch.selfEdgeMidY);
			
			context.moveTo(
				edge._private.rscratch.selfEdgeMidX,
				edge._private.rscratch.selfEdgeMidY);
			
			context.quadraticCurveTo(
				edge._private.rscratch.cp2cx,
				edge._private.rscratch.cp2cy,
				edge._private.rscratch.endX,
				edge._private.rscratch.endY);
			
			context.stroke();
			
		} else if (edge._private.rscratch.isStraightEdge) {
			
			// Check if the edge is inverted due to close node proximity
			var nodeDirectionX = endNode._private.position.x - startNode._private.position.x;
			var nodeDirectionY = endNode._private.position.y - startNode._private.position.y;
			
			var edgeDirectionX = edge._private.rscratch.endX - edge._private.rscratch.startX;
			var edgeDirectionY = edge._private.rscratch.endY - edge._private.rscratch.startY;
			
			if (nodeDirectionX * edgeDirectionX
				+ nodeDirectionY * edgeDirectionY < 0) {
				
				edge._private.rscratch.straightEdgeTooShort = true;	
			} else {			
				context.beginPath();
				context.moveTo(
					edge._private.rscratch.startX,
					edge._private.rscratch.startY);
	
				context.lineTo(edge._private.rscratch.endX, 
					edge._private.rscratch.endY);
				context.stroke();
				
				edge._private.rscratch.straightEdgeTooShort = false;	
			}	
		} else {
			
			context.beginPath();
			context.moveTo(
				edge._private.rscratch.startX,
				edge._private.rscratch.startY);
			
			context.quadraticCurveTo(
				edge._private.rscratch.cp2x, 
				edge._private.rscratch.cp2y, 
				edge._private.rscratch.endX, 
				edge._private.rscratch.endY);
			context.stroke();
			
		}
		
		if (edge._private.rscratch.noArrowPlacement !== true
				&& edge._private.rscratch.startX !== undefined) {
			this.drawArrowheads(edge);
		}
	}
	
	CanvasRenderer.prototype.drawEdgeText = function(edge) {
		var context = renderer.context;
	
		if (edge._private.style["visibility"].value != "visible") {
			return;
		}
	
		// Calculate text draw position
		
		context.textAlign = "center";
		context.textBaseline = "middle";
		
		var textX, textY;	
		var edgeCenterX, edgeCenterY;
		
		if (edge._private.rscratch.isSelfEdge) {
			edgeCenterX = edge._private.rscratch.selfEdgeMidX;
			edgeCenterY = edge._private.rscratch.selfEdgeMidY;
		} else if (edge._private.rscratch.isStraightEdge) {
			edgeCenterX = (edge._private.rscratch.startX
				+ edge._private.rscratch.endX) / 2;
			edgeCenterY = (edge._private.rscratch.startY
				+ edge._private.rscratch.endY) / 2;
		} else if (edge._private.rscratch.isBezierEdge) {
			edgeCenterX = Math.pow(1 - 0.5, 2) * edge._private.rscratch.startX
				+ 2 * (1 - 0.5) * 0.5 * edge._private.rscratch.cp2x
				+ (0.5 * 0.5) * edge._private.rscratch.endX;
			
			edgeCenterY = Math.pow(1 - 0.5, 2) * edge._private.rscratch.startY
				+ 2 * (1 - 0.5) * 0.5 * edge._private.rscratch.cp2y
				+ (0.5 * 0.5) * edge._private.rscratch.endY;
		}
		
		textX = edgeCenterX;
		textY = edgeCenterY;
		
		this.drawText(edge, textX, textY);
	}
	
	CanvasRenderer.prototype.drawNode = function(node) {
		var context = renderer.context;
		
		var nodeWidth, nodeHeight;
		
		if (node._private.style["visibility"].value != "visible") {
			return;
		}
		
		// Node color & opacity
		context.fillStyle = "rgba(" 
			+ node._private.style["background-color"].value[0] + ","
			+ node._private.style["background-color"].value[1] + ","
			+ node._private.style["background-color"].value[2] + ","
			+ (node._private.style["background-opacity"].value 
			* node._private.style["opacity"].value) + ")";
		
		// Node border color & opacity
		context.strokeStyle = "rgba(" 
			+ node._private.style["border-color"].value[0] + ","
			+ node._private.style["border-color"].value[1] + ","
			+ node._private.style["border-color"].value[2] + ","
			+ (node._private.style["border-opacity"].value 
			* node._private.style["opacity"].value) + ")";
		
		nodeWidth = node._private.style["width"].value;
		nodeHeight = node._private.style["height"].value;
		
		// Draw node
		nodeShapes[node._private.style["shape"].value].draw(
			node,
			nodeWidth,
			nodeHeight); //node._private.data.weight / 5.0
		
		// Border width, draw border
		context.lineWidth = node._private.style["border-width"].value;
		if (node._private.style["border-width"].value > 0) {
			context.stroke();
		}
	}
	
	CanvasRenderer.prototype.drawNodeText = function(node) {
		var context = renderer.context;
		
		if (node._private.style["visibility"].value != "visible") {
			return;
		}
	
		var textX, textY;
		
		var nodeWidth = node._private.style["width"].value;
		var nodeHeight = node._private.style["height"].value;
	
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
		
		this.drawText(node, textX, textY);
	}
	
	CanvasRenderer.prototype.drawText = function(element, textX, textY) {
		var context = renderer.context;
		
		// Font style
		var labelStyle = element._private.style["font-style"].strValue;
		var labelSize = element._private.style["font-size"].strValue;
		var labelFamily = element._private.style["font-family"].strValue;
		var labelVariant = element._private.style["font-variant"].strValue;
		var labelWeight = element._private.style["font-weight"].strValue;
					
		context.font = labelStyle + " " + labelVariant + " " + labelWeight + " " 
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
		
		context.fillStyle = "rgba(" 
			+ element._private.style["color"].value[0] + ","
			+ element._private.style["color"].value[1] + ","
			+ element._private.style["color"].value[2] + ","
			+ (element._private.style["text-opacity"].value
			* element._private.style["opacity"].value) + ")";
		
		context.strokeStyle = "rgba(" 
			+ element._private.style["text-outline-color"].value[0] + ","
			+ element._private.style["text-outline-color"].value[1] + ","
			+ element._private.style["text-outline-color"].value[2] + ","
			+ (element._private.style["text-opacity"].value
			* element._private.style["opacity"].value) + ")";
		
		context.fillText(text, textX, textY);
		
		var lineWidth = element._private.style["text-outline-width"].value;
		
		if (lineWidth > 0) {
			context.lineWidth = lineWidth;
			context.strokeText(text, textX, textY);
		}
	}
	
	CanvasRenderer.prototype.zoom = function(params){
		// debug(params);
		if (params != undefined && params.level != undefined) {
		
			this.scale[0] = params.level;
			this.scale[1] = params.level;
		}
		
		console.log("zoom call");
		console.log(params);
	};
	
	CanvasRenderer.prototype.fit = function(params){
		console.log("fit call");
		console.log(params);
	};
	
	CanvasRenderer.prototype.pan = function(params){
		console.log("pan call");
		console.log(params);
		
		if (this.context != undefined) {
			
		}
	};
	
	CanvasRenderer.prototype.panBy = function(params){
		this.center[0] -= params.x;
		this.center[1] -= params.y;
		
		this.redraw();
		
		console.log("panBy call");
		console.log(params);
	};
	
	$$("renderer", "canvas", CanvasRenderer);

})( cytoscape );
