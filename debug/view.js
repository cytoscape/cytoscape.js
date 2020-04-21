/* global $, cy */

(function(){

	$("#zoom-pan-button").addEventListener('click', function(){
		cy.reset();
	});

	$("#fit-button").addEventListener('click', function(){
		cy.fit();
	});

	$("#fit-selected-button").addEventListener('click', function(){
		cy.fit( cy.elements(":selected") );
	});

	$("#center-selected-button").addEventListener('click', function(){
		cy.center( cy.elements(":selected") );
	});

	$("#enable-panning").addEventListener('click', function(){
		cy.panningEnabled(true);
	});

	$("#disable-panning").addEventListener('click', function(){
		cy.panningEnabled(false);
	});

	$("#enable-user-panning").addEventListener('click', function(){
		cy.userPanningEnabled(true);
	});

	$("#disable-user-panning").addEventListener('click', function(){
		cy.userPanningEnabled(false);
	});

	$("#enable-panning-with-right-mouse-button").addEventListener('click', function(){
		cy.panningWithRightMouseButton(true);
	});

	$("#disable-panning-with-right-mouse-button").addEventListener('click', function(){
		cy.panningWithRightMouseButton(false);
	});

	$("#enable-zooming").addEventListener('click', function(){
		cy.zoomingEnabled(true);
	});

	$("#disable-zooming").addEventListener('click', function(){
		cy.zoomingEnabled(false);
	});

	$("#enable-user-zooming").addEventListener('click', function(){
		cy.userZoomingEnabled(true);
	});

	$("#disable-user-zooming").addEventListener('click', function(){
		cy.userZoomingEnabled(false);
	});

	$("#enable-autolock").addEventListener('click', function(){
		cy.autolock(true);
	});

	$("#disable-autolock").addEventListener('click', function(){
		cy.autolock(false);
	});

	$("#enable-autoungrabify").addEventListener('click', function(){
		cy.autoungrabify(true);
	});

	$("#disable-autoungrabify").addEventListener('click', function(){
		cy.autoungrabify(false);
	});

	$("#enable-autounselectify").addEventListener('click', function(){
		cy.autounselectify(true);
	});

	$("#disable-autounselectify").addEventListener('click', function(){
		cy.autounselectify(false);
	});

	$("#show-debug").addEventListener('click', function(){
		cy.renderer().debug = true;

		// force redraws
		cy.panBy({ x: 1 });
		cy.panBy({ x: -1 });
	});

	$("#hide-debug").addEventListener('click', function(){
		cy.renderer().debug = false;

		// force redraws
		cy.panBy({ x: 1 });
		cy.panBy({ x: -1 });
	});

	var showBB = function( eles, opts ){
		var bb = eles.renderedBoundingBox(opts);

		var $bb = $('#bb');

		var style = {
			left: bb.x1 + 'px',
			top: bb.y1 + 'px',
			width: (bb.x2 - bb.x1) + 'px',
			height: (bb.y2 - bb.y1) + 'px',
			display: 'block'
		};

		Object.keys( style ).forEach(function( key ){
			var val = style[key];

			$bb.style[ key ] = val;
		});
	};

	$("#show-bb").addEventListener('click', function(){
		var eles = cy.$(':selected');

		if( eles.length === 0 ){
			eles = cy.elements();
		}

		showBB( eles );
	});

	$("#hide-bb").addEventListener('click', function(){
		$('#bb').style.display = 'none';
	});

	$("#show-bb-lbl").addEventListener('click', function(){
		var eles = cy.$(':selected');

		if( eles.length === 0 ){
			eles = cy.elements();
		}

		showBB( eles, { includeNodes: false, includeEdges: false, includeOverlays: false, includeLabels: true } );
	});

	$("#show-bb-lbl-main").addEventListener('click', function(){
		var eles = cy.$(':selected');

		if( eles.length === 0 ){
			eles = cy.elements();
		}

		showBB( eles, { includeNodes: false, includeEdges: false, includeOverlays: false, includeLabels: true, includeMainLabels: true, includeSourceLabels: false, includeTargetLabels: false } );
	});

	$("#show-bb-lbl-src").addEventListener('click', function(){
		var eles = cy.$(':selected');

		if( eles.length === 0 ){
			eles = cy.elements();
		}

		showBB( eles, { includeNodes: false, includeEdges: false, includeOverlays: false, includeLabels: true, includeMainLabels: false, includeSourceLabels: true, includeTargetLabels: false } );
	});

	$("#show-bb-lbl-tgt").addEventListener('click', function(){
		var eles = cy.$(':selected');

		if( eles.length === 0 ){
			eles = cy.elements();
		}

		showBB( eles, { includeNodes: false, includeEdges: false, includeOverlays: false, includeLabels: true, includeMainLabels: false, includeSourceLabels: false, includeTargetLabels: true } );
	});

	$('#mount').addEventListener('click', function(){
		cy.mount( $('#cytoscape') );
	});

	$('#unmount').addEventListener('click', function(){
		cy.unmount();
	});
})();
