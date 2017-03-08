$(function(){

	$("#zoom-pan-button").click(function(){
		cy.reset();
	});

	$("#fit-button").click(function(){
		cy.fit();
	});

	$("#fit-selected-button").click(function(){
		cy.fit( cy.elements(":selected") );
	});

	$("#center-selected-button").click(function(){
		cy.center( cy.elements(":selected") );
	});

	$("#enable-panning").click(function(){
		cy.panningEnabled(true);
	});

	$("#disable-panning").click(function(){
		cy.panningEnabled(false);
	});

	$("#enable-user-panning").click(function(){
		cy.userPanningEnabled(true);
	});

	$("#disable-user-panning").click(function(){
		cy.userPanningEnabled(false);
	});

	$("#enable-zooming").click(function(){
		cy.zoomingEnabled(true);
	});

	$("#disable-zooming").click(function(){
		cy.zoomingEnabled(false);
	});

	$("#enable-user-zooming").click(function(){
		cy.userZoomingEnabled(true);
	});

	$("#disable-user-zooming").click(function(){
		cy.userZoomingEnabled(false);
	});

	$("#enable-autolock").click(function(){
		cy.autolock(true);
	});

	$("#disable-autolock").click(function(){
		cy.autolock(false);
	});

	$("#enable-autoungrabify").click(function(){
		cy.autoungrabify(true);
	});

	$("#disable-autoungrabify").click(function(){
		cy.autoungrabify(false);
	});

	$("#enable-autounselectify").click(function(){
		cy.autounselectify(true);
	});

	$("#disable-autounselectify").click(function(){
		cy.autounselectify(false);
	});

	$("#show-debug").click(function(){
		cy.renderer().debug = true;

		// force redraws
		cy.panBy({ x: 1 });
		cy.panBy({ x: -1 });
	});

	$("#hide-debug").click(function(){
		cy.renderer().debug = false;

		// force redraws
		cy.panBy({ x: 1 });
		cy.panBy({ x: -1 });
	});

	$("#show-bb").click(function(){
		var eles = cy.$(':selected');

		if( eles.length === 0 ){
			eles = cy.elements();
		}

		eles.showBB();
	});

	cytoscape('collection', 'showBB', function(){
		var bb = this.renderedBoundingBox();
		var os = $('#cytoscape').offset();

		$('#bb').css({
			left: bb.x1 + os.left + 1,
			top: bb.y1 + os.top + 1,
			width: bb.x2 - bb.x1,
			height: bb.y2 - bb.y1
		}).show();

		return this;
	});

	$("#hide-bb").click(function(){
		$('#bb').hide();
	});
});
