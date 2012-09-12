(function($, $$){


	var debug = function(o) {
		if (false) {
			console.log(o);
		}
	}

	// TODO put default options here
	var defaults = {
		minZoom: 0.001,
		maxZoom: 1000,
		maxPan: -1 >>> 1,
		minPan: (-(-1>>>1)-1),
		selectionToPanDelay: 500,
		dragToSelect: true,
		dragToPan: true,
	};
	
	var defaultNode = {
		shape: "ellipse",
		sizeFactor: 0.2,
		selectedColor: "#AADDAA",
		hoveredColor: "#AAAAFF",
		regularColor: "#AAAAAA",
	
		borderWidth: 6,
		selectedBorderColor: "#BBDDBB",
		hoveredBorderColor: "#BBBBFF",
		regularBorderColor: "#BBBBBB",
		
		labelFontStyle: "normal",
		labelFontSize: "12px",
		labelFontFamily: "Arial",
		
		labelTextAlign: "center",
		labelTextColor: "#666666",
	};
	
	var defaultEdge = {
		selectedColor: "#AADDAA",
		hoveredColor: "#CDCDFF",
		regularColor: "#CDCDCD",
		
		/*
		[ [ ‘font-style’ || ‘font-variant’ || ‘font-weight’ ]? 
			‘font-size’ [ / ‘line-height’ ]? font-family ] 
			| caption | icon | menu | message-box | small-caption | status-bar | inherit
		*/
		
		endShape: "arrow",
		
		widthFactor: 1 / 26.0,
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
	var minDistanceEdgeValue = 999;
	
	var minDistanceNode;
	var minDistanceNodeValue = 999;
	
	var arrowShapeDrawers = {};
	var arrowShapeSpacing = {};
	var arrowShapeGap = {};
	var nodeShapeDrawers = {};
	var nodeShapeIntersectLine = {};
	var nodeShapePoints = {};
	
	var nodeDragging = false;
	var draggingSelectedNode = false;
	var draggedNode;
	
	var nodesBeingDragged = [];
	var edgesBeingDragged = [];
	
	var cy;
	var renderer;
	
	// Timeout variable used to prevent mouseMove events from being triggered too often
	var mouseMoveTimeout = 0;
	
	// Timeout variable to prevent frequent redraws
	var redrawTimeout = 0;
	
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
		
		this.canvasNeedsRedraw = new Array(numCanvases);
		this.redrawReason = new Array(numCanvases);
		
		var container = this.options.cy.container();
		
		for (var i = 0; i < numCanvases; i++) {
			var canvas = document.createElement("canvas");
		
			canvas.width = container.clientHeight;
			canvas.height = container.clientWidth;
			
			canvas.style.position = "absolute";
			canvas.style.zIndex = String(-i);
			
			this.canvases[i] = canvas;
			this.canvasContexts[i] = canvas.getContext("2d");
			
			this.canvasNeedsRedraw[i] = false;
			this.redrawReason[i] = new Array();
			
			container.appendChild(canvas);
		}
		
		this.canvas = this.canvases[0];
		this.context = this.canvasContexts[0];
		
		//
		
		this.center = [container.clientWidth / 2, container.clientHeight / 2];
		this.scale = [1, 1];
		this.zoomLevel = 0;
		// this.zoomCenter = [container.clientWidth / 2, container.clientHeight / 2];
		
		renderer = this;
	}

	CanvasRenderer.prototype.notify = function(params) {
//		console.log("notify call: " + params);
//		console.log(params);
		
		var redrawEvents = ["draw", "viewport", "add", "style"];
		
		switch (params.type) {
			case "load":
				debug("load call");
				this.load();
//				this.initStyle();
				// redraw();
				
				this.canvasNeedsRedraw[2] = true;
				this.redrawReason[2].push("Load");
				
				this.canvasNeedsRedraw[4] = true;
				this.redrawReason[4].push("Load");
				
				this.redraw();
				break;
			case "draw":
				debug("draw call");
				break;
			case "viewport":
				this.canvasNeedsRedraw[2] = true;
				this.redrawReason[2].push("Viewport change");
				
				this.canvasNeedsRedraw[4] = true;
				this.redrawReason[4].push("Viewport change");
				
				break;
			case "style":
				// this.redraw();
				doSingleRedraw = true;

				this.canvasNeedsRedraw[2] = true;
				this.redrawReason[2].push("Style change");
				
				this.canvasNeedsRedraw[4] = true;
				this.redrawReason[4].push("Style change");

				break;
			case "add":
				this.canvasNeedsRedraw[2] = true;
				this.redrawReason[2].push("Elements added");
				
				this.canvasNeedsRedraw[4] = true;
				this.redrawReason[4].push("Elements added");
				
//				this.initStyle();
				break;
			default:
				console.log("event: " + params.type);
		}
		
//		console.log(params.type);
		if (redrawEvents.indexOf(params.type) != -1) {
			this.redraw();
		}
		
		// this.redraw();
	};
	
	CanvasRenderer.prototype.projectMouse = function(mouseEvent) {
		
		var x = mouseEvent.clientX - this.canvas.offsetParent.offsetLeft;
		var y = mouseEvent.clientY - this.canvas.offsetParent.offsetTop;

		x += (mouseEvent.pageX - mouseEvent.clientX);
		y += (mouseEvent.pageY - mouseEvent.clientY);
		
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
	
	CanvasRenderer.prototype.projectMouseOld = function(self, mouseX, mouseY, xOffset, yOffset) {
		var x = mouseX - xOffset;
		var y = mouseY - yOffset;
		
		/*
		x -= self.options.cy.container().width() / 2;
		y -= self.options.cy.container().height() / 2;
		*/
		
		/*		
		x /= self.scale[0];
		y /= self.scale[1];
		*/
		
		x -= cy.pan().x;
		y -= cy.pan().y;
		
		x /= cy.zoom();
		y /= cy.zoom();
		
		/*
		x += self.center[0];
		y += self.center[1];
		*/
		
		return [x, y];
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
	
	CanvasRenderer.prototype.mouseDownHandler = function(event) {
		var mouseDownEvent = event;
//		console.log(event);
		var nodes = cy.nodes();
		var edges = cy.edges();

		// Process middle button panning
		if (mouseDownEvent.button == 1
				&& mouseDownEvent.target == cy.renderer().canvas) {
		
			dragPanStartX = mouseDownEvent.clientX;
			dragPanStartY = mouseDownEvent.clientY;
			
			dragPanInitialCenter = [cy.renderer().center[0], cy.renderer().center[1]];
			
			dragPanMode = true;
			
			if (cy.renderer().canvas.style.cursor 
				!= cy.style()._private.coreStyle["panning-cursor"].value) {

				cy.renderer().canvas.style.cursor 
					= cy.style()._private.coreStyle["panning-cursor"].value;
			}
		}
		
		var start = cy.renderer().projectMouse(event);
		
		selectBox[0] = start[0];
		selectBox[1] = start[1];
				
		// Left button drag selectio
		if (mouseDownEvent.button == 0
				&& mouseDownEvent.target == cy.renderer().canvas
				&& minDistanceNode == undefined
				&& minDistanceEdge == undefined) {
						
			selectBox[4] = 1;
		}
		
		if (mouseDownEvent.button == 0
				&& mouseDownEvent.target == cy.renderer().canvas) {
			
			if (minDistanceNode != undefined) {
				
				nodeDragging = true;
				nodesBeingDragged = [];
				
				if (minDistanceNode.selected()) {
					draggingSelectedNode = true;
					
					for (var index = 0; index < nodes.length; index++) {
						if (nodes[index].selected()) {
							
							nodes[index]._private.rscratch.dragStartX = 
								nodes[index]._private.position.x;
							nodes[index]._private.rscratch.dragStartY =
								nodes[index]._private.position.y;
										
							nodesBeingDragged.push(nodes[index]);
							nodes[index]._private.rscratch.layer2 = true;
						}
					}
					
				} else {
					draggingSelectedNode = false;
					draggedNode = minDistanceNode;
					
					draggedNode._private.rscratch.dragStartX = 
						draggedNode._private.position.x;
					draggedNode._private.rscratch.dragStartY = 
						draggedNode._private.position.y;
					
					nodesBeingDragged.push(draggedNode);
					draggedNode._private.rscratch.layer2 = true;	

//					console.log(draggedNode);
				}
				
				/*
				edgesBeingDragged = renderer.findEdges(nodesBeingDragged);
				
				for (var i = 0; i < edgesBeingDragged.length; i++) {
					edgesBeingDragged[i]._private.rscratch.layer2 = true;
				}
				*/
				
				renderer.canvasNeedsRedraw[4] = true;
				renderer.redrawReason[4].push("nodes being dragged, moved to drag layer");
				
				renderer.canvasNeedsRedraw[2] = true;
				renderer.redrawReason[2].push("nodes being dragged, moved to drag layer");
				
			}
		}
		
		cy.renderer().redraw();
	}
	
	CanvasRenderer.prototype.mouseMoveHandler = function(e) {
		if (mouseMoveTimeout) {return;}
		
		mouseMoveTimeout = setTimeout(function(){
			mouseMoveTimeout = null;		
		}, 1000/100);
		
		var renderer = cy.renderer();
		
		// Get references to helper functions
		var dragHandler = renderer.mouseMoveHelper.dragHandler;
		var checkEdgeHover = renderer.mouseMoveHelper.checkEdgeHover;
		var checkStraightEdgeHover = renderer.mouseMoveHelper.checkStraightEdgeHover;
		var checkNodeHover = renderer.mouseMoveHelper.checkNodeHover;
		var hoverHandler = renderer.mouseMoveHelper.hoverHandler;
		
		// Offset for Cytoscape container
		// var mouseOffsetX = cy.container().offset().left + 2;
		// var mouseOffsetY = cy.container().offset().top + 2;
		
		var edges = cy.edges();
		var nodes = cy.nodes();
		
		//cy.renderer().canvas.style.cursor = "default";
		
		// Drag pan
		if (dragPanMode) {
			dragHandler(e);
		}
		
		var current = cy.renderer().projectMouse(e);
		
		// Update selection box
		selectBox[2] = current[0];
		selectBox[3] = current[1];
		
		if (!selectBox[4]) {
			hoverHandler(nodes, edges, e);
		}
		
		if (minDistanceNode != undefined
			&& cy.renderer().canvas.style.cursor != 
				minDistanceNode._private.style["cursor"].value) {
			cy.renderer().canvas.style.cursor = 
				minDistanceNode._private.style["cursor"].value;
		} else if (minDistanceEdge != undefined
			&& cy.renderer().canvas.style.cursor != 
				minDistanceEdge._private.style["cursor"].value) {
			cy.renderer().canvas.style.cursor = 
				minDistanceEdge._private.style["cursor"].value;
		} else if (!minDistanceNode
			&& !minDistanceEdge
			&& cy.renderer().canvas.style.cursor != "auto") {
			cy.renderer().canvas.style.cursor = "auto";
		}
		
		if (nodeDragging) {
		
			for (var index = 0; index < nodes.length; index++) {
				if ((draggingSelectedNode && nodes[index].selected())
					|| (!draggingSelectedNode && nodes[index] == draggedNode)) {
					nodes[index]._private.position.x = 
						nodes[index]._private.rscratch.dragStartX
						+ (selectBox[2] - selectBox[0]);
					nodes[index]._private.position.y = 
						nodes[index]._private.rscratch.dragStartY
						+ (selectBox[3] - selectBox[1]);
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
		
//		if (dragPanMode || nodeDragging) {
			cy.renderer().redraw();
//		}
	}
	
	CanvasRenderer.prototype.mouseUpHandler = function(event) {
	
		var edges = cy.edges();
		var nodes = cy.nodes();
	
		var nodeBeingDragged = nodeDragging
				&& (Math.abs(selectBox[2] - selectBox[0]) 
				+ Math.abs(selectBox[3] - selectBox[1]) > 1);

		/*	
		if (draggedNode != undefined) {
			draggedNode._private.rscratch.layer2 = false;
		}
		*/
		
		for (var i = 0; i < nodesBeingDragged.length; i++) {
			nodesBeingDragged[i]._private.rscratch.layer2 = false;
		}
		
		for (var i = 0; i < edgesBeingDragged.length; i++) {
			edgesBeingDragged[i]._private.rscratch.layer2 = false;
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
		
		if (cy.renderer().canvas.style.cursor != "auto") {
			cy.renderer().canvas.style.cursor = "auto";
		}
		
		selectBox[4] = 0;
		
		renderer.canvasNeedsRedraw[0] = true;
		renderer.redrawReason[0].push("Selection box gone");
		
		if (nodeBeingDragged) {
			renderer.canvasNeedsRedraw[4] = true;
			renderer.redrawReason[4].push("Node drag completed");
		}
		
		// Stop node dragging on mouseup
		nodeDragging = false;
		
		cy.renderer().redraw();
	}
	
	CanvasRenderer.prototype.mouseWheelHandler = function(event) {
		
		event.preventDefault();
		
		// console.log(event);
		
		var deltaY = event.wheelDeltaY;
		
		cy.renderer().zoomLevel -= deltaY / 5.0 / 500;
		
		//console.log("zoomLevel: " + cy.renderer().zoomLevel);
		cy.renderer().scale[0] = Math.pow(10, -cy.renderer().zoomLevel);
		cy.renderer().scale[1] = Math.pow(10, -cy.renderer().zoomLevel);
		
		var current = cy.renderer().projectMouse(event);
		
		var zoomLevel = cy.zoom() * Math.pow(10, event.wheelDeltaY / 500);

		zoomLevel = Math.min(zoomLevel, 100);
		zoomLevel = Math.max(zoomLevel, 0.01);

		// console.log(current);
		
		cy.zoom({level: zoomLevel, 
				position: {x: event.offsetX, 
							y: event.offsetY}});
		
		
		/*
		cy.zoom({level: zoomLevel, 
					renderedPosition: {x: current[0], 
							y: current[1]}});
		*/
		
		cy.renderer().redraw();
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
		
		var checkEdgeHover = function(mouseX, mouseY, edge) {
		
			var squaredDistanceLimit = 19; // Math.pow(edge._private.style["width"] * 30, 2);
		
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
				if (squaredDistance < squaredDistanceLimit) {
					
					if (squaredDistance < minDistanceEdgeValue) {
						minDistanceEdge = edge;
						minDistanceEdgeValue = squaredDistance;
					}
				}	
			}
		}
		
		var checkSelfEdgeHover = function(mouseX, mouseY, edge) {
			
			var squaredDistanceLimit = 19;
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
					
					if (squaredDistance < minDistanceEdgeValue) {
						minDistanceEdge = edge;
						minDistanceEdgeValue = squaredDistance;
						edgeFound = true;
					}
				}
			}
		}
		
		var checkStraightEdgeHover = function(mouseX, mouseY, edge, x1, y1, x2, y2) {
			
			var squaredDistanceLimit = 19;
			
			var nearEndOffsetX = mouseX - x1;
			var nearEndOffsetY = mouseY - y1;
			
			var farEndOffsetX = mouseX - x2;
			var farEndOffsetY = mouseY - y2;
			
			var displacementX = x2 - x1;
			var displacementY = y2 - y1;
			
			var distanceSquared;
			
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
				if (distanceSquared < minDistanceEdgeValue) {
					minDistanceEdge = edge;
					minDistanceEdgeValue = distanceSquared;
				}
			}
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
					node._private.style["height"].value) / 2, 2);
			
			var distanceSquared = dX * dX + dY * dY;
			
			if (boundingRadiusSquared > distanceSquared) {
				
				if (distanceSquared < minDistanceNodeValue) {
					minDistanceNode = node;
					minDistanceNodeValue = distanceSquared;
					
					nodeHovered = true;
				}
			}
		}
	
		var hoverHandler = function(nodes, edges, mouseMoveEvent) {
			
			// Project mouse coordinates to world absolute coordinates
			var projected = cy.renderer().projectMouse(mouseMoveEvent); 
			
			var mouseX = projected[0];
			var mouseY = projected[1];
			
			if (minDistanceNode != undefined) {
				minDistanceNode._private.rscratch.hovered = false;
				minDistanceNode = undefined;
				minDistanceNodeValue = 99999;
		
			} else if (minDistanceEdge != undefined) {
				minDistanceEdge._private.rscratch.hovered = false;
				minDistanceEdge = undefined;
				minDistanceEdgeValue = 99999;
			}
			
			nodeHovered = false;
			
			for (var index = 0; index < nodes.length; index++) {
				checkNodeHover(mouseX, mouseY, nodes[index]);
			}
			
			for (var index = 0; index < edges.length; index++) {
				if (nodeHovered) {
				
				} else if (edges[index]._private.rscratch.isStraightEdge) {
					checkStraightEdgeHover(mouseX, mouseY, edges[index],
						edges[index]._private.rscratch.startX,
						edges[index]._private.rscratch.startY,
						edges[index]._private.rscratch.endX,
						edges[index]._private.rscratch.endY);
				} else if (edges[index]._private.rscratch.isSelfEdge) {
					checkSelfEdgeHover(mouseX, mouseY, edges[index]);
				} else {
					checkEdgeHover(mouseX, mouseY, edges[index]);
				}
			}
			
			if (minDistanceNode != undefined) {
				minDistanceNode._private.rscratch.hovered = true;
			} else if (minDistanceEdge != undefined) {
				minDistanceEdge._private.rscratch.hovered = true;
			}
		}
		
		// Make these related functions (they reference each other) available
		this.mouseMoveHelper.dragHandler = dragHandler;
		this.mouseMoveHelper.checkEdgeHover = checkEdgeHover;
		this.mouseMoveHelper.checkStraightEdgeHover = checkStraightEdgeHover;
		this.mouseMoveHelper.checkNodeHover = checkNodeHover;
		this.mouseMoveHelper.hoverHandler = hoverHandler;
	}
	
	CanvasRenderer.prototype.load = function() {
		var self = this;
		
		this.mouseMoveHelper();
		
		document.addEventListener("keydown", this.keyDownHandler, false);
		document.addEventListener("keyup", this.keyUpHandler, false);
	
		this.canvas.addEventListener("mousedown", this.mouseDownHandler, false);
		this.canvas.addEventListener("mouseup", this.mouseUpHandler, false);
	
		this.canvas.addEventListener("mousemove", this.mouseMoveHandler, false);
		this.canvas.addEventListener("mousewheel", this.mouseWheelHandler, false);
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
	
	arrowShapeDrawers["arrow"] = function(context) {
		// context.scale(context.lineWidth, context.lineWidth);
		context.lineTo(-0.15, 0.3);
		context.lineTo(0, 0);
		context.lineTo(0.15, 0.3);
	}
	arrowShapeSpacing["arrow"] = 0;
	arrowShapeGap["arrow"] = 4;
	
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
	arrowShapeGap["circle"] = 0.1;
	
	arrowShapeDrawers["inhibitor"] = function(context) {
		// context.scale(context.lineWidth, context.lineWidth);
		context.lineTo(-0.25, 0);
		context.lineTo(-0.25, -0.1);
		context.lineTo(0.25, -0.1);
		context.lineTo(0.25, 0);
	}
	arrowShapeSpacing["inhibitor"] = 4;
	arrowShapeGap["inhibitor"] = 4;
	
	arrowShapeDrawers["tee"] = arrowShapeDrawers["inhibitor"];
	arrowShapeSpacing["tee"] = arrowShapeSpacing["inhibitor"];
	arrowShapeGap["tee"] = arrowShapeGap["inhibitor"];
	
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
		context.scale(context.lineWidth * 12, context.lineWidth * 12.1);
		
		context.beginPath();
		
		arrowShapeDrawers[shape](context);
		
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
			
			intersect = nodeShapeIntersectLine[target._private.style["shape"].value](
				target,
				target._private.style["width"].value,
				target._private.style["height"].value,
				cp[0], //halfPointX,
				cp[1] //halfPointY
			);
			
			var arrowEnd = this.shortenIntersection(intersect, cp,
				arrowShapeSpacing[edge._private.style["target-arrow-shape"].value]);
			var edgeEnd = this.shortenIntersection(intersect, cp,
				arrowShapeGap[edge._private.style["target-arrow-shape"].value]);
			
			edge._private.rscratch.endX = edgeEnd[0];
			edge._private.rscratch.endY = edgeEnd[1];
			
			edge._private.rscratch.arrowEndX = arrowEnd[0];
			edge._private.rscratch.arrowEndY = arrowEnd[1];
			
			var cp = [edge._private.rscratch.cp2ax, edge._private.rscratch.cp2ay];

			intersect = nodeShapeIntersectLine[source._private.style["shape"].value](
				source,
				source._private.style["width"].value,
				source._private.style["height"].value,
				cp[0], //halfPointX,
				cp[1] //halfPointY
			);
			
			var arrowStart = this.shortenIntersection(intersect, cp,
				arrowShapeSpacing[edge._private.style["source-arrow-shape"].value]);
			var edgeStart = this.shortenIntersection(intersect, cp,
				arrowShapeGap[edge._private.style["source-arrow-shape"].value]);
			
			edge._private.rscratch.startX = edgeStart[0];
			edge._private.rscratch.startY = edgeStart[1];
			
			edge._private.rscratch.arrowStartX = arrowStart[0];
			edge._private.rscratch.arrowStartY = arrowStart[1];
			
		} else if (edge._private.rscratch.isStraightEdge) {
			
			intersect = nodeShapeIntersectLine[target._private.style["shape"].value](
				target,
				target._private.style["width"].value,
				target._private.style["height"].value,
				source.position().x,
				source.position().y);
			
			var arrowEnd = this.shortenIntersection(intersect,
				[source.position().x, source.position().y],
				arrowShapeSpacing[edge._private.style["target-arrow-shape"].value]);
			var edgeEnd = this.shortenIntersection(intersect,
				[source.position().x, source.position().y],
				arrowShapeGap[edge._private.style["target-arrow-shape"].value]);

			edge._private.rscratch.endX = edgeEnd[0];
			edge._private.rscratch.endY = edgeEnd[1];
			
			edge._private.rscratch.arrowEndX = arrowEnd[0];
			edge._private.rscratch.arrowEndY = arrowEnd[1];
		
			intersect = nodeShapeIntersectLine[source._private.style["shape"].value](
				source,
				source._private.style["width"].value,
				source._private.style["height"].value,
				target.position().x,
				target.position().y);
			
			var arrowStart = this.shortenIntersection(intersect,
				[target.position().x, target.position().y],
				arrowShapeSpacing[edge._private.style["source-arrow-shape"].value]);
			var edgeStart = this.shortenIntersection(intersect,
				[target.position().x, target.position().y],
				arrowShapeGap[edge._private.style["source-arrow-shape"].value]);

			edge._private.rscratch.startX = edgeStart[0];
			edge._private.rscratch.startY = edgeStart[1];
			
			edge._private.rscratch.arrowStartX = arrowStart[0];
			edge._private.rscratch.arrowStartY = arrowStart[1];
			
		} else if (edge._private.rscratch.isBezierEdge) {
			
			var cp = [edge._private.rscratch.cp2x, edge._private.rscratch.cp2y];
			
			// Point at middle of Bezier
			var halfPointX = start[0] * 0.25 + end[0] * 0.25 + cp[0] * 0.5;
			var halfPointY = start[1] * 0.25 + end[1] * 0.25 + cp[1] * 0.5;
			
			intersect = nodeShapeIntersectLine[
				target._private.style["shape"].value](
				target,
				target._private.style["width"].value,
				target._private.style["height"].value,
				cp[0], //halfPointX,
				cp[1] //halfPointY
			);
			
			var arrowEnd = this.shortenIntersection(intersect, cp,
				arrowShapeSpacing[edge._private.style["target-arrow-shape"].value]);
			var edgeEnd = this.shortenIntersection(intersect, cp,
				arrowShapeGap[edge._private.style["target-arrow-shape"].value]);
			
			edge._private.rscratch.endX = edgeEnd[0];
			edge._private.rscratch.endY = edgeEnd[1];
			
			edge._private.rscratch.arrowEndX = arrowEnd[0];
			edge._private.rscratch.arrowEndY = arrowEnd[1];
			
			intersect = nodeShapeIntersectLine[
				source._private.style["shape"].value](
				source,
				source._private.style["width"].value,
				source._private.style["height"].value,
				cp[0], //halfPointX,
				cp[1] //halfPointY
			);
			
			var arrowStart = this.shortenIntersection(intersect, cp,
				arrowShapeSpacing[edge._private.style["source-arrow-shape"].value]);
			var edgeStart = this.shortenIntersection(intersect, cp,
				arrowShapeGap[edge._private.style["source-arrow-shape"].value]);
			
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
		
		dispX = edge.target().position().x - endX;
		dispY = edge.target().position().y - endY;
		
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
		node, width, height, x, y, nodeShape, numSides) {
		
		if (nodeShapePoints[nodeShape] == undefined) {
			nodeShapePoints[nodeShape] = generateUnitNgonPoints(numSides, 0);
		}
		
		var intersections = renderer.polygonIntersectLine(
			x, y,
			nodeShapePoints[nodeShape],
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
		
		return [offset[0] + lenRatio * disp[0], offset[1] + lenRatio * disp[1]]; 
	}

	CanvasRenderer.prototype.drawPolygon = function(
		x, y, width, height, nodeShape, numSides) {

		if (nodeShapePoints[nodeShape] == undefined) {
			nodeShapePoints[nodeShape] = generateUnitNgonPoints(numSides, 0);
		}
		
		var points = nodeShapePoints[nodeShape];

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
	
	var doSingleRedraw = false;
	
	CanvasRenderer.prototype.redraw = function(singleRedraw) {
		
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
			context.clearRect(0, 0, this.options.cy.container().clientWidth,
				this.options.cy.container().clientHeight);
			
			context.translate(this.cy.pan().x, this.cy.pan().y);
			context.scale(this.cy.zoom(), this.cy.zoom());
			
//			console.log(2, this.redrawReason[2]);
			
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
			
			this.canvasNeedsRedraw[2] = false;
			this.redrawReason[2] = [];
		}
		
		if (this.canvasNeedsRedraw[4]) {
			context = this.canvasContexts[4];
			this.context = context;
			
			context.setTransform(1, 0, 0, 1, 0, 0);
			context.clearRect(0, 0, this.options.cy.container().clientWidth,
				this.options.cy.container().clientHeight);
			
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
			
			this.canvasNeedsRedraw[4] = false;
			this.redrawReason[4] = [];
		}
		
		if (this.canvasNeedsRedraw[0]) {
			context = this.canvasContexts[0];
			
			context.setTransform(1, 0, 0, 1, 0, 0);
			context.clearRect(0, 0, this.canvases[0].width,
				this.canvases[0].height);
		
			context.translate(this.cy.pan().x, this.cy.pan().y);
			context.scale(this.cy.zoom(), this.cy.zoom());
			
			// console.log(0, this.redrawReason[0], selectBox[4]);
			
			if (selectBox[4] == 1) {
	
				var coreStyle = cy.style()._private.coreStyle;
			
				context.lineWidth = coreStyle["selection-box-border-width"].value;
			
				context.fillStyle = "rgba(" 
					+ coreStyle["selection-box-color"].value[0] + ","
					+ coreStyle["selection-box-color"].value[1] + ","
					+ coreStyle["selection-box-color"].value[2] + ","
					+ coreStyle["selection-box-opacity"].value + ")";
				
				context.fillRect(selectBox[0],
					selectBox[1],
					selectBox[2] - selectBox[0],
					selectBox[3] - selectBox[1]);
			
				context.strokeStyle = "rgba(" 
					+ coreStyle["selection-box-border-color"].value[0] + ","
					+ coreStyle["selection-box-border-color"].value[1] + ","
					+ coreStyle["selection-box-border-color"].value[2] + ","
					+ coreStyle["selection-box-opacity"].value + ")";
				
				context.strokeRect(selectBox[0],
					selectBox[1],
					selectBox[2] - selectBox[0],
					selectBox[3] - selectBox[1]);
			}
			
			this.canvasNeedsRedraw[0] = false;
			this.redrawReason[0] = [];
		}
	};
	
	CanvasRenderer.prototype.drawEdge = function(edge) {
		var context = renderer.context;
		var styleValue;
		
		var startNode, endNode;
		var labelStyle, labelSize, labelFamily, labelVariant, labelWeight;

		if (edge._private.style["visibility"].value != "visible") {
			return;
		}
		
		startNode = edge.source()[0];
		endNode = edge.target()[0];
		
		if (false && edge._private.rscratch.hovered) {
			styleValue = edge._private.rscratch.override.hoveredColor;
			context.strokeStyle = styleValue != undefined ? styleValue 
				: defaultEdge.hoveredColor;
		} else {
			// Edge color & opacity
			styleValue = "rgba(" + edge._private.style["line-color"].value[0] + ","
				+ edge._private.style["line-color"].value[1] + ","
				+ edge._private.style["line-color"].value[2] + ","
				+ edge._private.style.opacity.value + ")";
			
			context.strokeStyle = styleValue != undefined ? styleValue 
				: defaultEdge.regularColor;
		}
		
		// Edge line width
		// context.lineWidth = edge._private.style.width.value * 2;
		context.lineWidth = edge._private.style["width"].value;
//		console.log(context.lineWidth);
		
		// this.calculateEdgeMetrics(edge);
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
			
			context.beginPath();
			context.moveTo(
				edge._private.rscratch.startX,
				edge._private.rscratch.startY);

			context.lineTo(edge._private.rscratch.endX, 
				edge._private.rscratch.endY);
			context.stroke();
			
			// ***
			// this.drawStraightArrowhead(edge);
						
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
			
			// ***
			// this.drawArrowhead(edge);
		}
		
		this.drawArrowheads(edge);
		
		// Calculate text draw position
		
		context.textAlign = "center";
		context.textBaseline = "middle";
		
		var textX, textY;	
		var edgeCenterX, edgeCenterY;
		
		if (edge._private.rscratch.isSelfEdge) {
			textX = undefined;
			textY = undefined;
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
		
		
		//textX = edge._private.rscratch.cp2x;
		//textY = edge._private.rscratch.cp2y;
		
		textX = edgeCenterX;
		textY = edgeCenterY;
		
		if (!edge._private.rscratch.isSelfEdge) {
			this.drawText(edge, textX, textY);
		}
	}
	
	CanvasRenderer.prototype.drawNode = function(node) {
		var context = renderer.context;
		var styleValue;
		
		var labelStyle, labelSize, labelFamily, labelVariant, labelWeight;
		var textX, textY;
		
		var nodeWidth, nodeHeight;
		
		if (node._private.style["visibility"].value != "visible") {
			return;
		}
		
		if (false && node._private.rscratch.hovered == true) {
			styleValue = node._private.rscratch.override.hoveredColor;
			context.fillStyle = styleValue != undefined ? styleValue : defaultNode.hoveredColor;
			
			styleValue = node._private.rscratch.override.hoveredBorderColor;
			context.strokeStyle = styleValue != undefined? styleValue : defaultNode.hoveredBorderColor;
		} else {
			// Node color & opacity
			styleValue = "rgba(" + node._private.style["background-color"].value[0] + ","
				+ node._private.style["background-color"].value[1] + ","
				+ node._private.style["background-color"].value[2] + ","
				+ (node._private.style["background-opacity"].value 
				* node._private.style["opacity"].value) + ")";
				
			context.fillStyle = styleValue != undefined ? styleValue : defaultNode.regularColor;
			
			// Node border color & opacity
			styleValue = "rgba(" + node._private.style["border-color"].value[0] + ","
				+ node._private.style["border-color"].value[1] + ","
				+ node._private.style["border-color"].value[2] + ","
				+ (node._private.style["border-opacity"].value 
				* node._private.style["opacity"].value) + ")";	
			context.strokeStyle = styleValue != undefined? styleValue : defaultNode.regularBorderColor;
		}
		
		nodeWidth = node._private.style["width"].value;
		nodeHeight = node._private.style["height"].value;
		nodeShapeDrawers[node._private.style["shape"].value](
			node,
			nodeWidth,
			nodeHeight); //node._private.data.weight / 5.0
		
		// Node border width
		styleValue = node._private.style["border-width"].value;
		if (styleValue > 0) {
			context.lineWidth = styleValue != undefined? styleValue : defaultNode.borderWidth;
			context.stroke();
		}
		
		// Find text position
		styleValue = node._private.style["text-halign"].strValue;
		if (styleValue == "left") {
			// Align right boundary of text with left boundary of node
			context.textAlign = "right";
			textX = node._private.position.x - nodeWidth / 2;
		} else if (styleValue == "right") {
			// Align left boundary of text with right boundary of node
			context.textAlign = "left";
			textX = node._private.position.x + nodeWidth / 2;
		} else if (styleValue == "center") {
			context.textAlign = "center";
			textX = node._private.position.x;
		} else {
			// Same as center
			context.textAlign = "center";
			textX = node._private.position.x;
		}
		
		styleValue = node._private.style["text-valign"].strValue;
		if (styleValue == "top") {
			context.textBaseline = "bottom";
			textY = node._private.position.y - nodeHeight / 2;
		} else if (styleValue == "bottom") {
			context.textBaseline = "top";
			textY = node._private.position.y + nodeHeight / 2;
		} else if (styleValue == "middle" || styleValue == "center") {
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
		var styleValue;
		
		// Font style
//		styleValue = element._private.rscratch.override.labelFontStyle;
		labelStyle = element._private.style["font-style"].strValue;
		labelSize = element._private.style["font-size"].strValue;
		labelFamily = element._private.style["font-family"].strValue;
		labelVariant = element._private.style["font-variant"].strValue;
		labelWeight = element._private.style["font-weight"].strValue;
					
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
		//debug("pan called:");
		//debug(params);
		
		console.log("pan call");
		console.log(params);
		
		if (this.context != undefined) {
			
		}
	};
	
	CanvasRenderer.prototype.panBy = function(params){
		// this.transform[4] += params.x;
		// this.transform[5] += params.y;
		
		this.center[0] -= params.x;
		this.center[1] -= params.y;
		
		this.redraw();
		
		console.log("panBy call");
		console.log(params);
	};
	
	$$("renderer", "canvas", CanvasRenderer);

})( jQuery, jQuery.cytoscape );