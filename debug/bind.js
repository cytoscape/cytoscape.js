$(function(){
	
	$("#cytoscape").cy(function(e){
		var cy = e.cy;
		
		$("#bind-button").click(function(){
			var action = $("#bind-type-select").val();
			var event = $("#bind-event-select").val();
			var selector = $("#bind-selector").val();
			var delegate = $("#bind-delegate").val();
			
			$.gritter.add({
				title: 'Binding applied',
				text: action + ' on `' + selector + '` for `' + event + '` with delegate `' + delegate + '`'
			});	
			
			var callback = function(){
				$.gritter.add({
					title: 'Event triggered for ' + this.data("id"),
					text: action + ' on `' + selector + '` for ' + event + '` with delegate `' + delegate + '`'
				});
			};
			
			if( action == "unbind" || action == "off" ){
				callback = undefined;
			}
			
			if( event == "" ){
				event = undefined;
			}

			var args = [];
			if( event ){ args.push(event) }
			if( delegate ){ args.push(delegate) }
			if( callback ){ args.push(callback) }
			
			var eles = cy.elements(selector);

			eles[action].apply( eles, args );
		});
		
		$("#core-bind-button").click(function(){
			var action = $("#core-bind-type-select").val();
			var event = $("#core-bind-event-select").val();
			var delegate = $("#core-bind-delegate").val();
			var target = "core";
			
			$.gritter.add({
				title: 'Binding applied',
				text: action + ' on ' + target + ' for `' + event + '`' + '` with delegate `' + delegate + '`'
			});
			
			var callback = function(){
				$.gritter.add({
					title: 'Event triggered for core',
					text: '`' + action + '` on ' + target + '  for `' + event + '`' + '` with delegate `' + delegate + '`'
				});
			};
			
			if( action == "unbind" || action == "off" ){
				callback = undefined;
			}
			
			if( event == "" ){
				event = undefined;
			}

			var args = [];
			if( event ){ args.push(event) }
			if( delegate ){ args.push(delegate) }
			if( callback ){ args.push(callback) }
			
			cy[action].apply( cy, args );
		});
	});
	
});

