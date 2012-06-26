$v(function(jQuery, $, version){
	
	defaultModule("Events");
	
	asyncTest("Select a node", function(){
		expect(4);
		
		var node = cy.nodes().eq(0);
		
		node.bind("select", function(){
			ok(true, "Selection listener fired");
			
			ok( node.selected(), "Node state selected" );
		});
		
		node.bind("unselect", function(){
			ok(true, "Unselection listener fired");
			
			ok( !node.selected(), "Node state unselected" );
			
			start();
		});
		
		setTimeout(function(){
			node.select();
		}, 100);
		
		setTimeout(function(){
			node.unselect();
		}, 200);
		
	});
	
	asyncTest("Unbind selection", function(){
		
		var node = cy.nodes().eq(0);
		var fired = 0;
				
		node.bind("select", function(){
			fired++;
		});
		
		setTimeout(function(){
			node.select();
		}, 100);
		
		setTimeout(function(){
			equal( fired, 1, "Listener was fired when bound" );
			fired = 0;
			node.unbind("select");
		}, 200);
		
		setTimeout(function(){
			node.select();
		}, 300);
		
		setTimeout(function(){
			equal( fired, 0, "Listener was not fired when unbound" );
			start();
		}, 400);
		
	});
	
	asyncTest("Unbind API", function(){
		var node = cy.nodes().eq(0);
		
		var handler1Calls = 0;
		var handler1 = function(){
			handler1Calls++;
		};
		
		var handler2Calls = 0;
		var handler2 = function(){
			handler2Calls++;
		};
		
		node.bind("click", handler1);
		node.bind("click", handler2);
		
		async(function(){
			node.trigger("click");
		});
		
		async(function(){
			equal( handler1Calls, 1, "handler1 called first time" );
			equal( handler2Calls, 1, "handler2 called first time" );
			
			node.unbind("click", handler2);
			node.trigger("click");
		});
		
		async(function(){
			equal( handler1Calls, 2, "handler1 called again" );
			equal( handler2Calls, 1, "handler2 not called" );
			
			node.unbind("click");
			node.trigger("click");
		});
		
		async(function(){
			equal( handler1Calls, 2, "no change for handler1" );
			equal( handler2Calls, 1, "no change for handler2" );

			node.bind("click", handler1);
			node.bind("click", handler2);
		});
		
		async(function(){
			node.unbind();
			node.trigger("click");
		});
		
		async(function(){
			equal( handler1Calls, 2, "no change for handler1 after unbind all" );
			equal( handler2Calls, 1, "no change for handler2 after unbind all" );
			
			start();
		});
		
	});
	
	asyncTest("`once` with click", function(){
		var triggers = 0;
		
		cy.nodes().once("click", function(){
			triggers++;
		});
		
		async(function(){
			cy.nodes().eq(0).trigger("click");
		});
		
		async(function(){
			equal(triggers, 1, "Triggered once");
		});
		
		async(function(){
			cy.nodes().eq(0).trigger("click");
		});
		
		async(function(){
			equal(triggers, 1, "Not triggered again after clicking same node");
		});
		
		async(function(){
			cy.nodes().eq(1).trigger("click");
		});
		
		async(function(){
			equal(triggers, 1, "Not triggered again after clicking different node");
			
			start();
		});
	});
	
	asyncTest("Unbinding `once`", function(){
		var triggers = 0;
		var handler = function(){
			triggers++;
		};
		
		cy.nodes().once("click", handler);
		cy.nodes().unbind("click", handler);
		cy.nodes().eq(0).trigger("click");
		
		async(function(){
			equal(triggers, 0, "Handler never triggered");
			
			start();
		});
	});
	
	asyncTest("Manual event binding & triggering", function(){
		
		var events = [ "data", "position", "select", "unselect", "lock", "unlock", "mouseover", "mouseout", "mousemove", "mousedown", "mouseup", "click", "grabify", "ungrabify", "grab", "free", "touchstart", "touchmove", "touchend" ];
		var triggered = {};
		var cyTriggered = {};
		var aliasTriggered = {};
		
		var node = cy.nodes()[0];
		$.each(events, function(i, event){
			node.bind(event, function(e, d){
				triggered[event] = triggered[event] != null ? triggered[event] + 1 : 1;
			});
			
			node[event](function(){
				aliasTriggered[event] = aliasTriggered[event] != null ? aliasTriggered[event] + 1 : 1;
			});
			
			cy.bind(event, function(e, d){
				cyTriggered[event] = cyTriggered[event] != null ? cyTriggered[event] + 1 : 1;
			});
			
			setTimeout(function(){
				node.trigger(event);
			}, 100);
		});
		
		setTimeout(function(){
			
			$.each(events, function(i, event){
				equal(triggered[event], 1, "Handler fired for `" + event + "`");
				equal(aliasTriggered[event], 1, "Handler fired for `" + event + "` alias");
				equal(cyTriggered[event], 1, "Handler bubbled up to core for `" + event + "`");
			});
			
			start();
		}, 500);
		
		
	});

	asyncTest("Event data", function(){
		asyncExpect(2);
		var targets = {
			node: cy.nodes().eq(0),
			cy: cy
		};

		$.each(targets, function(name, self){
			self.bind("click", { foo: "bar" }, function(e, param1, param2){
				equal( e.data.foo, "bar", "eventObj.data passed properly for " + name );
				ok( e.cy == cy, "eventObj.cy defined for " + name );

				equal(param1, "foo", "trigger param1 passed properly for " + name );
				equal(param2, "bar", "trigger param2 passed properly for " + name);

				asyncStart();
			});

			self.bind("touchstart", function(e, param){
				equal(param, "foo", "trigger param1 passed properly for " + name );

				asyncStart();
			});

			self.trigger("click", ["foo", "bar"]);
			self.trigger($.Event("touchstart"), "foo");

		});
	});
	
});