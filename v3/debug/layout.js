/* global $, cy, cy2 */

(function(){

	$("#layout-button").addEventListener("click", function(){
		cy.layout({
			name: $("#layout-select").value
		}).run();
	});

	var start, end;
	cy.bind("layoutstart", function(){
		start = +new Date;
	}).bind("layoutstop", function(){
		end = +new Date;
		var time = end - start;

		if( !isNaN(time) ){
			$("#layout-time").innerHTML = ( (time) + " ms" );
		}
	});

})();
