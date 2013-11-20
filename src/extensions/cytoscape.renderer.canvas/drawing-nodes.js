;(function($$){

	var CanvasRenderer = $$('renderer', 'canvas');

	// Draw node
	CanvasRenderer.prototype.drawNode = function(context, node, drawOverlayInstead) {

		var nodeWidth, nodeHeight;
		
		if ( !node.visible() ) {
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
		
		context.lineWidth = node._private.style["border-width"].pxValue;

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
								r.data.canvasNeedsRedraw[CanvasRenderer.NODE] = true;
								r.data.canvasRedrawReason[CanvasRenderer.NODE].push("image finished load");
								r.data.canvasNeedsRedraw[CanvasRenderer.DRAG] = true;
								r.data.canvasRedrawReason[CanvasRenderer.DRAG].push("image finished load");
								
								// Replace Image object with Canvas to solve zooming too far
								// into image graphical errors (Jan 10 2013)
								r.swapCachedImage(url);
								
								r.redraw();
							}
					);
					
					if (image.complete == false) {

						CanvasRenderer.nodeShapes[r.getNodeShape(node)].drawPath(
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
					CanvasRenderer.nodeShapes[this.getNodeShape(node)].draw(
						context,
						node._private.position.x,
						node._private.position.y,
						nodeWidth,
						nodeHeight); //node._private.data.weight / 5.0
				}
				
			}
			
			// Border width, draw border
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

				CanvasRenderer.nodeShapes[this.getNodeShape(node)].draw(
					context,
					node._private.position.x,
					node._private.position.y,
					nodeWidth + overlayPadding * 2,
					nodeHeight + overlayPadding * 2
				);
			}
		}

	};

	
})( cytoscape );