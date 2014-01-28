;(function($$){

	var CanvasRenderer = $$('renderer', 'canvas');

	// Draw edge text
	CanvasRenderer.prototype.drawEdgeText = function(context, edge) {
	
		if( !edge.visible() ){
			return;
		}

		if( this.hideEdgesOnViewport && (this.dragData.didDrag || this.pinching || this.hoverData.dragging || this.data.wheel || this.swipePanning) ){ return; } // save cycles on pinching

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

	// Draw node text
	CanvasRenderer.prototype.drawNodeText = function(context, node) {
		
		if ( !node.visible() ) {
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
		var labelSize = element._private.style["font-size"].pxValue + "px";
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

	
})( cytoscape );