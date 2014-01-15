$(function(){

	$("#cytoscape").cy(function(e){
		var cy = this;
		
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
		
	});

});