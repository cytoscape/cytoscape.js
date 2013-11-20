/*
  The canvas renderer was written by Yue Dong.

  Modifications tracked on Github.
*/

(function($$) {

	function CanvasRenderer(options) {
		
		CanvasRenderer.CANVAS_LAYERS = 5;
		CanvasRenderer.SELECT_BOX = 0;
		CanvasRenderer.DRAG = 2;
		CanvasRenderer.OVERLAY = 3;
		CanvasRenderer.NODE = 4;
		CanvasRenderer.BUFFER_COUNT = 2;

		this.options = options;

		this.data = {
				
			select: [undefined, undefined, undefined, undefined, 0], // Coordinates for selection box, plus enabled flag 
			renderer: this, cy: options.cy, container: options.cy.container(),
			
			canvases: new Array(CanvasRenderer.CANVAS_LAYERS),
			canvasRedrawReason: new Array(CanvasRenderer.CANVAS_LAYERS),
			canvasNeedsRedraw: new Array(CanvasRenderer.CANVAS_LAYERS),
			
			bufferCanvases: new Array(CanvasRenderer.BUFFER_COUNT)

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
		
		for (var i = 0; i < CanvasRenderer.CANVAS_LAYERS; i++) {
			this.data.canvases[i] = document.createElement("canvas");
			this.data.canvases[i].style.position = "absolute";
			this.data.canvases[i].setAttribute("data-id", "layer" + i);
			this.data.canvases[i].style.zIndex = String(CanvasRenderer.CANVAS_LAYERS - i);
			this.data.container.appendChild(this.data.canvases[i]);
			
			this.data.canvasRedrawReason[i] = new Array();
			this.data.canvasNeedsRedraw[i] = false;
		}

		this.data.canvases[CanvasRenderer.NODE].setAttribute("data-id", "layer" + CanvasRenderer.NODE + '-node');
		this.data.canvases[CanvasRenderer.SELECT_BOX].setAttribute("data-id", "layer" + CanvasRenderer.SELECT_BOX + '-selectbox');
		this.data.canvases[CanvasRenderer.DRAG].setAttribute("data-id", "layer" + CanvasRenderer.DRAG + '-drag');
		this.data.canvases[CanvasRenderer.OVERLAY].setAttribute("data-id", "layer" + CanvasRenderer.OVERLAY + '-overlay');
		
		for (var i = 0; i < CanvasRenderer.BUFFER_COUNT; i++) {
			this.data.bufferCanvases[i] = document.createElement("canvas");
			this.data.bufferCanvases[i].style.position = "absolute";
			this.data.bufferCanvases[i].setAttribute("data-id", "buffer" + i);
			this.data.bufferCanvases[i].style.zIndex = String(-i - 1);
			this.data.bufferCanvases[i].style.visibility = "hidden";
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

	CanvasRenderer.panOrBoxSelectDelay = 400;
	CanvasRenderer.isTouch = ('ontouchstart' in window) || window.DocumentTouch && document instanceof DocumentTouch;

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
			this.data.canvasNeedsRedraw[CanvasRenderer.SELECT_BOX] = true;
			this.data.canvasRedrawReason[CanvasRenderer.SELECT_BOX].push("viewchange");
		}
		
		this.data.canvasNeedsRedraw[CanvasRenderer.DRAG] = true; this.data.canvasRedrawReason[CanvasRenderer.DRAG].push("notify");
		this.data.canvasNeedsRedraw[CanvasRenderer.NODE] = true; this.data.canvasRedrawReason[CanvasRenderer.NODE].push("notify");

		this.redraws++;
		this.redraw();
	};

	CanvasRenderer.prototype.destroy = function(){
		this.destroyed = true;

		for( var i = 0; i < this.bindings.length; i++ ){
			var binding = this.bindings[i];
			var b = binding;

			b.target.removeEventListener(b.event, b.handler, b.useCapture);
		}
	};

	

	// copy the math functions into the renderer prototype
	// unfortunately these functions are used interspersed t/o the code
	// and this makes sure things work just in case a ref was missed in refactoring
	// TODO remove this eventually
	for( var fnName in $$.math ){
		CanvasRenderer.prototype[ fnName ] = $$.math[ fnName ];
	}
	
	
	var debug = function(){};
	$$("renderer", "canvas", CanvasRenderer);
	
})( cytoscape );
