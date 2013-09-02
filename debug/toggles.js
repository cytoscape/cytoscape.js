$(function(){

	$(document).on("click", "button.toggler", function(){
		var $this = $(this);
		var name = $this.text();

		cy.$(":selected")[name]();
	});

});