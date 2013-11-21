;(function($$){

	var CanvasRenderer = $$('renderer', 'canvas');

	CanvasRenderer.prototype.createBuffer = function(w, h) {
		var buffer = document.createElement("canvas");
		buffer.width = w;
		buffer.height = h;
		
		return [buffer, buffer.getContext("2d")];
	}

	CanvasRenderer.prototype.png = function( options ){
		var data = this.data;
		var cy = data.cy;
		var width = this.data.container.clientWidth;
		var height = this.data.container.clientHeight;
		var buffCanvas = this.data.bufferCanvases[1];
		var buffCxt = data.bufferCanvases[1].getContext("2d");

		// Rasterize the layers, but only if container has nonzero size
		if (width > 0 && height > 0) {

			buffCxt.clearRect( 0, 0, width, height );

			if( options.bg ){
				buffCxt.fillStyle = options.bg;
				buffCxt.rect( 0, 0, width, height );
				buffCxt.fill();
			}

			buffCxt.globalCompositeOperation = "source-over";
			for( var i = CanvasRenderer.CANVAS_LAYERS - 1; i >=0; i-- ){
				if( i === CanvasRenderer.OVERLAY ){ continue }

				buffCxt.drawImage(data.canvases[i], 0, 0);
			}
		}

		return buffCanvas.toDataURL("image/png");
	};

	CanvasRenderer.prototype.renderTo = function( cxt, zoom, pan ){
		this.redraw( cxt, true, zoom, pan );
	};

})( cytoscape );