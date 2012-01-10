$(function(){
	
	$("#cytoscapeweb").cy(function(e){
		var cy = e.cy;
		
		$("#bind-button").click(function(){
			var action = $("#bind-type-select").val();
			var event = $("#bind-event-select").val();
			var selector = $("#bind-selector").val();
			
			$.gritter.add({
				title: 'Binding applied',
				text: action + ' on `' + selector + '` for `' + event + '`'
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
			
			if( event == "" ){
				event = undefined;
			}
			
			cy.elements(selector)[action](event, callback);
		});
		
		$("#core-bind-button").click(function(){
			var action = $("#core-bind-type-select").val();
			var event = $("#core-bind-event-select").val();
			var target = $("#core-bind-target-select").val();
			
			$.gritter.add({
				title: 'Binding applied',
				text: action + ' on ' + target + ' for `' + event + '`'
			});
			
			var callback = function(){
				$.gritter.add({
					title: 'Event triggered for core',
					text: '`' + action + '` on ' + target + '  for `' + event + '`'
				});
			};
			
			if( action == "unbind" || action == "die" ){
				callback = undefined;
			}
			
			if( event == "" ){
				event = undefined;
			}
			
			if( target == "core" ){
				cy[action](event, callback);
			} else if( target == "background" ){
				cy.background()[action](event, callback);
			}
		});
	});
	
});

