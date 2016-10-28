$(function(){
	$("#string-stylesheet-apply-button").on("click", function(){
		var stylesheetStr = $('#string-stylesheet').val();

		cy.style().fromString( stylesheetStr ).update();
	});	
});