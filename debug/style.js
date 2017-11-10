/* global cy, $ */

(function(){
	$("#string-stylesheet-apply-button").addEventListener("click", function(){
		var stylesheetStr = $('#string-stylesheet').value;

		cy.style().fromString( stylesheetStr ).update();
	});
}());
