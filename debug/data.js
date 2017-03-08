$(function(){

	function displayElementData(element, position){
		var content = '';
		var data = element.data();

		$.each(data, function(name, value){
			content += ('<p><code><strong>' + name + '</strong></code> = ' + value + '</p>');
		});

		notify(
			'Data for ' + element.data("id"),
			content
		);
	}

	cy.on("click", "node, edge", function(e){
		if( e.metaKey ){
			displayElementData(this);
		}
	});

});
