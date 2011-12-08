$(function(){

	$("#cytoscapeweb").cy(function(e){
		var cy = e.cy;
		
		function selectFromFilter(){
			var selector = $("#filter-selector").val();
			var toSelect = cy.elements(selector);
			
			toSelect.select();
			cy.elements().not(toSelect).unselect();
		}
		$("#filter-button").click(function(){
			selectFromFilter();
		});
		
		$("#filter-selector").bind("keydown", function(e){
			if( e.which == 13 ){
				selectFromFilter();
			}
		});
	});

});