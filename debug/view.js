$(function(){

	$("#cytoscape").cy(function(e){
		var cy = this;
		
		$("#zoom-pan-button").click(function(){
			cy.zoom(1);
			cy.pan({ x: 0, y: 0 });
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
		
	});

});