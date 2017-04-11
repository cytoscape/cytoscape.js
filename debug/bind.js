$(function(){

	$("#bind-button").click(function(){
		var action = $("#bind-type-select").val();
		var event = $("#bind-event-select").val();
		var selector = $("#bind-selector").val();
		var delegate = $("#bind-delegate").val();

		notify('Binding applied',
			action + ' on `' + selector + '` for `' + event + '` with delegate `' + delegate + '`'
		);

		var callback = function(e){

			var title = 'Event triggered for ' + this.data("id");
			var text = action + ' on `' + selector + '` for ' + event + '` with delegate `' + delegate + '`';

			notify(
				title,
				text
			);
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

		notify(
			'Binding applied',
			action + ' on ' + target + ' for `' + event + '`' + '` with delegate `' + delegate + '`'
		);

		var callback = function(e){
			var title = 'Event triggered for core';
			var text = '`' + action + '` on ' + target + '  for `' + event + '`' + '` with delegate `' + delegate + '`';

			notify(
				title,
				text
			);
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
