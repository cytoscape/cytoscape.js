$(function(){

	$("#cytoscapeweb").cy(function(e){
		var cy = e.cy;
		
		$("#layout-button").bind("click", function(){
			cy.layout({
				name: $("#layout-select").val()
			});
		});
		
	});

});