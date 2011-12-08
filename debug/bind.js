$(function(){
	
	$("#cytoscapeweb").cy(function(e){
		var cy = e.cy;
		
		$("#bind-button").click(function(){
			var action = $("#bind-type-select").val();
			var event = $("#bind-event-select").val();
			var selector = $("#bind-selector").val();
			
			$.gritter.add({
				title: 'Binding applied',
				text: action + ' on `' + selector + '` for ' + event
			});	
			
			var callback = function(){
				$.gritter.add({
					title: 'Event triggered for ' + this.data("id"),
					text: action + ' on `' + selector + '` for ' + event
				});
			};
			
			if( action == "unbind" || action == "die" ){
				callback = undefined;
			}
			
			cy.elements(selector)[action](event, callback);
		});
	});
	
});

