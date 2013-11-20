;(function($$){

	var CanvasRenderer = $$('renderer', 'canvas');

	// Redraw frame
	CanvasRenderer.prototype.redraw = function( forcedContext, drawAll, forcedZoom, forcedPan ) {
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
		var effectiveZoom = forcedZoom !== undefined ? forcedZoom : zoom;
		var pan = cy.pan();
		var effectivePan = {
			x: pan.x,
			y: pan.y
		};

		if( forcedPan ){
			effectivePan = forcedPan;
		}

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

	

		if (data.canvasNeedsRedraw[CanvasRenderer.DRAG] || data.canvasNeedsRedraw[CanvasRenderer.NODE] || drawAll) {
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
		if (data.canvasNeedsRedraw[CanvasRenderer.NODE] || drawAll) {
			// console.log("redrawing node layer", data.canvasRedrawReason[CanvasRenderer.NODE]);
		  
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

			var context = forcedContext || data.canvases[CanvasRenderer.NODE].getContext("2d");

			context.setTransform(1, 0, 0, 1, 0, 0);
			context.clearRect(0, 0, context.canvas.width, context.canvas.height);
			
			if( !drawAll ){
				context.translate(effectivePan.x, effectivePan.y);
				context.scale(effectiveZoom, effectiveZoom);
			}
			if( forcedPan ){
				context.translate(forcedPan.x, forcedPan.y);
			} 
			if( forcedZoom ){
				context.scale(forcedZoom, forcedZoom);
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
				data.canvasNeedsRedraw[CanvasRenderer.NODE] = false; data.canvasRedrawReason[CanvasRenderer.NODE] = [];
			}
		}
		
		if (data.canvasNeedsRedraw[CanvasRenderer.DRAG] || drawAll) {
			// console.log("redrawing drag layer", data.canvasRedrawReason[CanvasRenderer.DRAG]);
		  
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

			var context = forcedContext || data.canvases[CanvasRenderer.DRAG].getContext("2d");
			
			if( !drawAll ){
				context.setTransform(1, 0, 0, 1, 0, 0);
				context.clearRect(0, 0, context.canvas.width, context.canvas.height);
				
				context.translate(effectivePan.x, effectivePan.y);
				context.scale(effectiveZoom, effectiveZoom);
			} 
			if( forcedPan ){
				context.translate(forcedPan.x, forcedPan.y);
			} 
			if( forcedZoom ){
				context.scale(forcedZoom, forcedZoom);
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
				data.canvasNeedsRedraw[CanvasRenderer.DRAG] = false; data.canvasRedrawReason[CanvasRenderer.DRAG] = [];
			}
		}
		
		if (data.canvasNeedsRedraw[CanvasRenderer.SELECT_BOX]) {
			// console.log("redrawing selection box", data.canvasRedrawReason[CanvasRenderer.SELECT_BOX]);
		  
			var context = forcedContext || data.canvases[CanvasRenderer.SELECT_BOX].getContext("2d");
			
			if( !drawAll ){
				context.setTransform(1, 0, 0, 1, 0, 0);
				context.clearRect(0, 0, context.canvas.width, context.canvas.height);
			
				context.translate(effectivePan.x, effectivePan.y);
				context.scale(effectiveZoom, effectiveZoom);		
			} 
			if( forcedPan ){
				context.translate(forcedPan.x, forcedPan.y);
			} 
			if( forcedZoom ){
				context.scale(forcedZoom, forcedZoom);
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
				data.canvasNeedsRedraw[CanvasRenderer.SELECT_BOX] = false; data.canvasRedrawReason[CanvasRenderer.SELECT_BOX] = [];
			}
		}

		if( r.options.showOverlay ){
			var context = data.canvases[CanvasRenderer.OVERLAY].getContext("2d");

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


		if( !forcedContext && !r.initrender ){
			r.initrender = true;
			cy.trigger('initrender');
		}

		// end on thread ready
		}, 0);
	};
	
})( cytoscape );
