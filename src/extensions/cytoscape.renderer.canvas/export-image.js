;(function($$){

	var CanvasRenderer = $$('renderer', 'canvas');

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

	CanvasRenderer.prototype.renderTo = function( cxt, zoom, pan ){
		this.redraw( cxt, true, zoom, pan );
	};

})( cytoscape );