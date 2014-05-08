$(function(){

	$(document).on("click", "button.toggler", function(){
		var $this = $(this);
		var name = $this.text();

		cy.$(":selected")[name]();
	});

  $(document).on("click", "#hide-commands", function(){
    $("#commands").hide();
  });

  $(document).on("click", "#show-commands", function(){
    $("#commands").show();
  });

  $(document).on("click", "#goto-cy", function(){
    $(window).scrollTop(0);
  });

  $(document).on("click", "#goto-cy2", function(){
    $(window).scrollTop( $('body').height()/2 );
  });

});