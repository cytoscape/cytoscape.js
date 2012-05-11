$(function(){

	$("button.toggler").live("click", function(){
		var $this = $(this);
		var name = $this.text();

		cy.$(":selected")[name]();
	});

});