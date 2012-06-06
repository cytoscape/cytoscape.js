$(function(){

	$("#cytoscape").cy(function(e){
		var cy = e.cy;
		
		function displayElementData(element, position){
			var content = '';
			var data = element.data();
			
			$.each(data, function(name, value){
				content += ('<p><code><strong>' + name + '</strong></code> = ' + value + '</p>');
			});
			
			$.gritter.add({
				title: 'Data for ' + element.data("id"),
				text: content
			});
		}
		
		cy.$("node, edge").live("click", function(e){
			if( e.metaKey ){
				displayElementData(this);
			}
		});
		
	});

});