/* global $, cy */

(function(){

	function selectFromFilter(){
		var selector = $("#filter-selector").value;
		var toSelect = cy.elements(selector);

		toSelect.select();
		cy.elements().not(toSelect).unselect();
	}
	
	$("#filter-button").addEventListener('click', function(){
		selectFromFilter();
	});

	$("#filter-selector").addEventListener("keydown", function(e){
		if( e.which == 13 ){
			selectFromFilter();
		}
	});

})();
