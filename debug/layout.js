$(function(){

	$("#layout-button").bind("click", function(){
		cy.layout({
			name: $("#layout-select").val()
		}).run();
	});

	var start, end;
	cy.bind("layoutstart", function(){
		start = +new Date;
	}).bind("layoutstop", function(){
		end = +new Date;
		var time = end - start;

		if( !isNaN(time) ){
			$("#layout-time").html( (time) + " ms" );
		}
	});


	$("#run-cose").on("click", function(){
		cy2.layout({
			name: 'cose'
		}).run();
	});


});
