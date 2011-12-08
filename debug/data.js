$(function(){

	$("#cytoscapeweb").cy(function(e){
		var cy = e.cy;
		
		function displayElementData(element, position){
			var content = $('<div></div>');
			var data = element.data();
			
			$.each(data, function(name, value){
				content.append('<p><em>' + name + '</em> = ' + value + '</p>');
			});
			
			$("body").commandtip({
				paper: false,
				position: {
					x: position.x,
					y: position.y
				},
				content: content
			});
		}
		
		cy.nodes().live("click", function(e){
			if( e.metaKey ){
				displayElementData(this, {
					x: $("#cytoscapeweb").offset().left + this.renderedPosition("x") + parseFloat( $("#cytoscapeweb").css("border-left-width") ),
					y: $("#cytoscapeweb").offset().top + this.renderedPosition("y") + this.renderedDimensions("height")/2
				});
			}
		});
		
		cy.edges().live("click", function(e){
			if( e.metaKey ){
				displayElementData(this, {
					x: e.clientX,
					y: e.clientY
				});
			}
		});
		
		cy.bind("zoom", function(){
			$(".ui-tooltip").hide();
		});
		
	});

});