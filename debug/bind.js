/* global $, notify, cy */

$("#bind-button").addEventListener('click', function(){
	var action = $("#bind-type-select").value;
	var event = $("#bind-event-select").value;
	var selector = $("#bind-selector").value;
	var delegate = $("#bind-delegate").value;

	notify('Binding applied',
		action + ' on `' + selector + '` for `' + event + '` with delegate `' + delegate + '`'
	);

	var callback = function(){
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
	if( event ){ args.push(event); }
	if( delegate ){ args.push(delegate); }
	if( callback ){ args.push(callback); }

	var eles = cy.elements(selector);

	eles[action].apply( eles, args );
});

$("#core-bind-button").addEventListener('click', function(){
	var action = $("#core-bind-type-select").value;
	var event = $("#core-bind-event-select").value;
	var delegate = $("#core-bind-delegate").value;
	var target = "core";

	notify(
		'Binding applied',
		action + ' on ' + target + ' for `' + event + '`' + '` with delegate `' + delegate + '`'
	);

	var callback = function(){
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
	if( event ){ args.push(event); }
	if( delegate ){ args.push(delegate); }
	if( callback ){ args.push(callback); }

	cy[action].apply( cy, args );
});
