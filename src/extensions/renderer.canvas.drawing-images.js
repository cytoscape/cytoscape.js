;(function($$){

	var CanvasRenderer = $$('renderer', 'canvas');

	
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
		
		CanvasRenderer.nodeShapes[r.getNodeShape(node)].drawPath(
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
		
		if (node._private.style["border-width"].value > 0) {
			context.stroke();
		}
		
	};

	
})( cytoscape );