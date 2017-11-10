/* global document, $, cy, $$ */

(function(){

	$$('button.toggler').forEach(function(el){
		el.addEventListener('click', function(){
			var name = el.innerText;

			cy.$(':selected')[name]();
		});
	});

  $('#hide-commands').addEventListener('click', function(){
    document.body.classList.remove('commands-shown');
    document.body.classList.add('commands-hidden');

		cy.resize();
  });

  $('#show-commands').addEventListener('click', function(){
    document.body.classList.add('commands-shown');
    document.body.classList.remove('commands-hidden');

		cy.resize();
  });

})();
