;(function($){

	// shortcuts
	var console = $.cytoscapeweb.console;
	var is = $.cytoscapeweb.is;
	var copy = $.cytoscapeweb.util.copy;
	
	// factory for generating edge ids when no id is specified for a new element
	var idFactory = {
		prefix: {
			nodes: "n",
			edges: "e"
		},
		id: {
			nodes: 0,
			edges: 0
		},
		generate: function(element, tryThisId){
			var group = element._private.group;
			var structs = element._private.cy._private;
			var id = tryThisId != null ? tryThisId : this.prefix[group] + this.id[group];
			
			while( structs[group][id] != null ){
				id = this.prefix[group] + ( ++this.id[group] );
			}
			
			return id;
		}
	};
	
	// CyElement
	////////////////////////////////////////////////////////////////////////////////////////////////////
	
	// represents a node or an edge
	function CyElement(cy, params){
		var self = this;
		
		if( cy === undefined || params === undefined || cy.$ == null ){
			console.error("An element must have a core reference and parameters set");
			return;
		}
		
		// validate group
		if( params.group != "nodes" && params.group != "edges" ){
			console.error("An element must be of type `nodes` or `edges`; you specified `%s`", params.group);
			return;
		}
		
		this._private = {
			cy: cy,
			data: copy( params.data ) || {}, // data object
			position: copy( params.position ) || {}, // fields x, y, etc (could be 3d or radial coords; renderer decides)
			listeners: {}, // map ( type => array of function spec objects )
			group: params.group, // string; "nodes" or "edges"
			bypass: copy( params.bypass ) || {}, // the bypass object
			style: {}, // the rendered style populated by the renderer
			removed: true, // whether it's inside the vis; true if removed (set true here since we call restore)
			selected: params.selected ? true : false, // whether it's selected
			locked: params.locked ? true : false, // whether the element is locked (cannot be moved)
			grabbed: false, // whether the element is grabbed by the mouse; renderer sets this privately
			grabbable: params.grabbable || params.grabbable === undefined ? true : false, // whether the element can be grabbed
			classes: {}, // map ( className => true )
			animation: { // object for currently-running animations
				current: [],
				queue: []
			},
			renderer: {}, // object in which the renderer can store information
			scratch: {} // scratch objects
		};
		
		// renderedPosition overrides if specified
		// you shouldn't and can't use this option with cy.load() since we don't have access to the renderer yet
		// AND the initial state of the graph is such that renderedPosition and position are the same
		if( params.renderedPosition != null ){
			var renderer = cy.renderer(); // TODO remove reference after refactoring
			this._private.position = renderer.modelPoint(params.renderedPosition);
		}
		
		if( is.string(params.classes) ){
			$.each(params.classes.split(/\s+/), function(i, cls){
				if( cls != "" ){
					self._private.classes[cls] = true;
				}
			});
		}
		
		this.restore();
	}
	$.cytoscapeweb.CyElement = CyElement; // expose
	
	CyElement.prototype.cy = function(){
		return this._private.cy;
	};
	
	CyElement.prototype.scratch = function( name, val ){
		var self = this;
		
		if( name === undefined ){
			return self._private.scratch;
		}
		
		var fields = name.split(".");
		
		function set(){
			var obj = self._private.scratch;
			$.each(fields, function(i, field){
				if( i == fields.length - 1 ){ return; }
				
				obj = obj[field];
			});
			
			var lastField = fields[ fields.length - 1 ];
			
			obj[ lastField ] = val;
		}
		
		function get(){
			var obj = self._private.scratch;
			$.each(fields, function(i, field){
				obj = obj[field];
			});
			
			return obj;
		}
		
		if( val === undefined ){
			return get(); 
		} else {
			set();
		}
		
		return this;
	};
	
	CyElement.prototype.removeScratch = function( name ){
		var self = this;
		
		if( name === undefined ){
			self._private.scratch = {};
		} else {
			var names = name.split(/\s+/);
			$.each(names, function(i, name){
				eval( "delete self._private.scratch." + name + ";" );
			});
		}
		
		return this;
	};
	
	CyElement.prototype.json = function(){
		var p = this._private;
		
		var json = copy({
			data: p.data,
			position: p.position,
			group: p.group,
			bypass: p.bypass,
			removed: p.removed,
			selected: p.selected,
			locked: p.locked,
			grabbed: p.grabbed,
			grabbable: p.grabbable,
			classes: "",
			scratch: p.scratch
		});
		
		var classes = [];
		$.each(p.classes, function(cls, bool){
			classes.push(cls);
		});
		
		$.each(classes, function(i, cls){
			json.classes += cls + ( i < classes.length - 1 ? " " : "" );
		});
		
		return json;
	};
	
	CyElement.prototype.element = function(){
		return this;
	};
	
	CyElement.prototype.collection = function(){
		return new CyCollection(this.cy(), [ this ]);
	};
	
	CyElement.prototype.grabbed = function(){
		return this._private.grabbed;
	};
	
	CyElement.prototype.group = function(){
		return this._private.group;
	};
	
	CyElement.prototype.addClass = function(classes){
		classes = classes.split(/\s+/);
		var self = this;
		var added = false;
		
		$.each(classes, function(i, cls){
			if( cls == null || cls == "" ){ return; }
			
			added = added || self._private.classes[cls] === undefined;
			self._private.classes[cls] = true;
		});
		
		if( added ){
			self.rtrigger("class");
		}
		
		return self;
	};
	
	CyElement.prototype.hasClass = function(className){
		return this._private.classes[className] == true;
	};
	
	CyElement.prototype.toggleClass = function(classesStr, toggle){
		var classes = classesStr.split(/\s+/);
		var self = this;
		var toggled = false;
		
		function remove(cls){
			toggled = toggled || self._private.classes[cls] !== undefined;
			delete self._private.classes[cls];
		}
		
		function add(cls){
			toggled = toggled || self._private.classes[cls] === undefined;
			self._private.classes[cls] = true;
		}
		
		$.each(classes, function(i, cls){
			if( toggle === undefined ){
				if( self.hasClass(cls) ){
					remove(cls);
				} else {
					add(cls);
				}
			} else if( toggle ){
				add(cls);
			} else {
				remove(cls);
			}
		});
		
		if( toggled ){
			self.rtrigger("class");
		}
		
		return self;
	};
	
	CyElement.prototype.removeClass = function(classes){
		classes = classes.split(/\s+/);
		var self = this;
		var removed = false;
		
		
		$.each(classes, function(i, cls){
			removed = removed || self._private.classes[cls] !== undefined;
			delete self._private.classes[cls];
		});
		
		if( removed ){
			self.rtrigger("class");
		}
		
		return self;
	};
	
	CyElement.prototype.removed = function(){
		return this._private.removed;
	};
	
	CyElement.prototype.restore = function(){
		if( !this.removed() ){
			// don't need to do anything
		}
		
		var structs = this.cy()._private; // TODO remove ref to `structs` after refactoring
		
		// set id and validate
		if( this._private.data.id == null ){
			this._private.data.id = idFactory.generate( this, this._private.group );
		} else if( structs[ this._private.group ][ this._private.data.id ] != null ){
			console.error("Can not create element: an element in the visualisation in group `%s` already has ID `%s`", this._private.group, this._private.data.id);
			return this;
		}
		
		// validate source and target for edges
		if( this.isEdge() ){
			
			var fields = ["source", "target"];
			for(var i = 0; i < fields.length; i++){
				
				var field = fields[i];
				var val = this._private.data[field];
				
				if( val == null || val == "" ){
					console.error("Can not create edge with id `%s` since it has no `%s` attribute set in `data` (must be non-empty value)", this._private.data.id, field);
					return this;
				} else if( structs.nodes[val] == null ){ 
					console.error("Can not create edge with id `%s` since it specifies non-existant node as its `%s` attribute with id `%s`",  this._private.data.id, field, val);
					return this;
				} 
			}
			
			this.cy().addParallelEdgeToMap(this);
			
		} 
		 
		this._private.removed = false;
		structs[ this._private.group ][ this._private.data.id ] = this;
		
		// add to map of edges belonging to nodes
		if( this._private.group == "edges" ){
			if( structs.nodeToEdges[ this._private.data.source ] == null ){
				structs.nodeToEdges[this._private.data.source ] = {};
			}
			
			if( structs.nodeToEdges[ this._private.data.target ] == null ){
				structs.nodeToEdges[this._private.data.target ] = {};
			}
			
			structs.nodeToEdges[ this._private.data.source ][ this._private.data.id ] = this;
			structs.nodeToEdges[ this._private.data.target ][ this._private.data.id ] = this;
		} else if( this._private.group == "nodes" ){
			structs.nodeToEdges[ this._private.data.id ] = {};
		}
		
		// update mapper structs
		var self = this;
		$.each(this._private.data, function(name, val){
			self.cy().addContinuousMapperBounds(self, name, val);
		});
		
		this.rtrigger("add");
		
		return this;
	};
	
	// remove from cytoweb
	CyElement.prototype.remove = function(){
		var structs = this.cy()._private; // TODO remove ref to `structs` after refactoring
		
		if( !this._private.removed ){
			delete structs[ this._private.group ][ this._private.data.id ];
			this._private.removed = true;
			var group = this._private.group;
			var self = this;
			
			// remove from map of edges belonging to nodes
			if( this._private.group == "edges" ){
				delete structs.nodeToEdges[ this._private.data.source ][ this._private.data.id ];
				delete structs.nodeToEdges[ this._private.data.target ][ this._private.data.id ];
				self.cy().removeParallelEdgeFromMap(this);
			} 
			
			// remove connected edges
			else if( this._private.group == "nodes" ){
				$.each(structs.nodeToEdges[ this._private.data.id ], function(id, edge){
					edge.remove();
				});
				
				structs.nodeToEdges[ this._private.data.id ] = {};
			}
			
			$.each(this._private.data, function(attr, val){
				self.cy().removeContinuousMapperBounds(self, attr, val);
			});
			
			// must manually notify since trigger won't do this automatically once removed
			({
				type: "remove",
				collection: [ this ]
			});
			this.rtrigger("remove");
			
		}
		
		return this;
	};
	
	function switchFunction(params){
		return function(fn){
			if( is.fn(fn) ){
				this.bind(params.event, fn);
			} else if( this._private[params.field] != params.value ) {
				this._private[params.field] = params.value;
				
				this.rtrigger(params.event);
			}
			
			return this;
		}
	}
	
	CyElement.prototype.locked = function(){
		return this._private.locked;
	};
	
	CyElement.prototype.lock = switchFunction({ event: "lock", field: "locked", value: true });
	CyElement.prototype.unlock = switchFunction({ event: "unlock", field: "locked", value: false });
	
	CyElement.prototype.grabbable = function(){
		return this._private.grabbable;
	};
	
	CyElement.prototype.grabify = switchFunction({ event: "grabify", field: "grabbable", value: true });
	CyElement.prototype.ungrabify = switchFunction({ event: "ungrabify", field: "grabbable", value: false });
	
	function setterGetterFunction(params){
		return function(key, val){

			// bind to event
			if( is.fn(key) ){
				var handler = key;
				this.bind(params.event, handler);
			}
			
			// bind to event with data
			else if( is.fn(val) ){
				var data = key;
				var handler = val;
				this.bind(params.event, data, handler);
			}
			
			// set or get field with key
			else if( is.string(key) ){
				if( val === undefined ){
					return copy( this._private[params.field][key] );
				} else {
					this._private[params.field][key] = copy( val );
					this.rtrigger(params.event);
				}
			}
			
			// update via object
			else if( is.plainObject(key) ) {
				var map = key;
				var current = this._private[params.field];
				
				this._private[params.field] = $.extend(true, {}, current, map);
				this.rtrigger(params.event);
			}
			
			// return the whole object
			else if( key === undefined ){
				return copy( this._private[params.field] );
			}
			
			return this;
		};
	};
	
	function removerFunction(params){
		return function(key){
			var self = this;
			
			// remove all
			if( key === undefined ){
				this._private[params.field] = {};
			}
			
			else {
				var keys = key.split(/\s+/);
				for(var i = 0; i < keys.length; i++){
					delete this._private[params.field][ keys[i] ];
				}
			}
				
			if( params.event != null ){
				this.rtrigger(params.event);
			}					
			
			return this;
		};
	};
	
	CyElement.prototype.removeBypass = removerFunction({ field: "bypass", event: "bypass" });
	CyElement.prototype.bypass = setterGetterFunction({ field: "bypass", event: "bypass" });
				
	CyElement.prototype.data = function(attr, val){
		var ret;
		var self = this;
		
		// get whole field
		if( attr === undefined ){
			return copy( this._private.data );
		} 
		
		if( attr == "id" && val !== undefined ){
			console.error("Can not change ID of element with group `%s` and ID `%s`", this._private.group, this._private.data.id);
			return this;
		}
		
		// bind to event
		else if( is.fn(attr) ){
			var handler = attr;
			this.bind("data", handler);
			ret = this;
		}
		
		// bind to event with data
		else if( is.fn(val) ){
			var data = attr;
			var handler = val;
			this.bind("data", data, handler);
			ret = this;
		}
		
		// set whole field from obj
		else if( is.plainObject(attr) ){
			var newValObj = attr;
			
			for(var field in newValObj){
				var val = newValObj[field];
				
				if( field == "id" || ( this._private.group == "edges" && ( field == "source" || field == "target" ) ) ){
					console.error("Can not change immutable field `%s` for element with group `%s` and ID `%s` to `%o`", field, this._private.group, this._private.data.id, val);
				} else {
					updateContinuousMapperBounds(self, field, self._private.data[field], val);
					self._private.data[field] = copy( val );
				}
			}
			
			this.rtrigger("data");
			ret = this;
		} 
		
		// get attr val by name
		else if( val === undefined ){
			ret = this._private.data[ attr ];
			ret =  ( typeof ret == "object" ? copy(ret) : ret );
		}
		
		// set attr val by name
		else {
			if( attr == "id" ){
				console.error("Can not change `%s` of element with ID %s --- you can not change IDs", attr, this._private.data.id);
				return this;
			}
			
			if( this._private.group == "edges" ){
				if( attr == "source" || attr == "target" ){
					console.error("Can not change `%s` of edge with ID %s --- you can not change IDs", attr, this._private.data.id);
					return this;
				}
			}
			
			var oldVal = this._private.data[ attr ];
			this._private.data[ attr ] = ( typeof val == "object" ? copy(val) : val );
			ret = this;
			
			updateContinuousMapperBounds(this, attr, oldVal, val);
			
			this.rtrigger("data");
		}		
		
		return ret;
	};
	
	CyElement.prototype.removeData = function(field){
		if( field == undefined ){
			// delete all non-essential data
			var oldData = this._private.data;
			var self = this;
			
			$.each(this._private.data, function(attr, val){
				self.cy().removeContinuousMapperBounds(self, attr, val);
			});
			
			if( this.isNode() ){
				this._private.data = {
					id: oldData.id
				};
			} else if( this.isEdge() ){
				this._private.data = {
					id: oldData.id,
					source: oldData.source,
					target: oldData.target
				};
			}
		} else {
			// delete only one field
			
			if( field == "id" ){
				console.error("You can not delete the `id` data field; tried to delete on element with group `%s` and ID `%s`", this._private.group, this._private.data.id);
				return this;
			}
			
			if( this.isEdge() && ( field == "source" || field == "target" ) ){
				console.error("You can not delete the `%s` data field; tried to delete on edge `%s`", field, this._private.data.id);
				return this;
			} 
			
			self.cy().removeContinuousMapperBounds(this, field, this._private.data[field]);
			delete this._private.data[field];
		}
		
		this.rtrigger("data");
		return this;
	};
	
	CyElement.prototype.target = function(){
		var structs = this.cy()._private; // TODO remove ref to `structs` after refactoring
		
		if( this.isNode() ){
			console.error("Can not call `target` on node `%s`; only edges have targets", this._private.data.id);
			return this;
		}
		
		return structs.nodes[ this._private.data.target ];
	};
	
	CyElement.prototype.source = function(){
		var structs = this.cy()._private; // TODO remove ref to `structs` after refactoring
		
		if( this.isNode() ){
			console.error("Can not call `source` on node `%s`; only edges have sources", this._private.data.id);
			return this;
		}
		
		return structs.nodes[ this._private.data.source ];
	};
	
	CyElement.prototype.connectedNodes = function( selector ){
		var structs = this.cy()._private; // TODO remove ref to `structs` after refactoring
		
		if( this.isNode() ){
			console.error("Can not call `connectedNodes` on node `%s`; only edges have a source and target", this._private.data.id);
			return this;
		}
		
		var source = structs.nodes[ this._private.data.source ];
		var target = structs.nodes[ this._private.data.target ];
		
		return source.collection().add(target).filter( selector );
	};
	
	CyElement.prototype.edgesWith = function(otherNode){
		if( otherNode.isEdge() ){
			console.error("Can not call `edgesWith` on edge `%s`; only nodes have edges", this._private.data.id);
			return this;
		}
		
		var nodes = otherNode.collection();
		var elements = [];
		
		for(var i = 0; i < nodes.size(); i++){
			var map = this.cy().getEdgesBetweenNodes(this, nodes[i]);
			for(var i in map){
				var element = map[i];
				elements.push(element);
			}
		}
		
		
		return new CyCollection(this.cy(), elements);
	}
	
	CyElement.prototype.parallelEdges = function(selector){
		if( this.isNode() ){
			console.error("Can not call `parallelEdges` on node `%s`; only edges have sources", this._private.data.id);
			return this;
		}
		
		var map = this.cy().getParallelEdgesForEdge(this);
		var elements = [];
		for(var i in map){
			var element = map[i];
			elements.push(element);
		}
		
		var collection = new CyCollection(this.cy(), elements);
		
		if( is.string(selector) ){
			collection = collection.filter(selector);
		}
		
		return collection;
	};
	
	CyElement.prototype.position = function(val){
		
		var self = this;
		
		if( val === undefined ){
			if( this.isNode() ){
				return copy( this._private.position );
			} else {
				console.warn("Can not get position for edge with ID `%s`; edges have no position", this._private.data.id);
				return null;
			}
		} else if( is.fn(val) ){
			var fn = val;
			this.bind("position", fn);
		} else if( this.isEdge() ){
			console.warn("Can not move edge with ID `%s`; edges can not be moved", this._private.data.id);
		} else if( this.locked() ) {
			console.warn("Can not move locked node with ID `%s`", this._private.data.id);
		} else if( is.string(val) ) {
			var param = arguments[0];
			var value = arguments[1];
			
			if( value === undefined ){
				 return this._private.position[param];
			} else {
				this._private.position[param] = copy(value);
			}
		} else if( is.plainObject(val) ) {
			$.each(val, function(k, v){
				self._private.position[k] = copy( v );
			});
			this.rtrigger("position");
		} else {
			console.error("Can not set position on node `%s` with non-object `%o`", this._private.data.id, val);
		}
		
		return this;
		
	};
	
	CyElement.prototype.positions = function(fn){
		var positionOpts = fn.apply(this, [0, this]);
		
		if( is.plainObject(positionOpts) ){
			this.position(positionOpts);
		}
	};
	
	CyElement.prototype.animated = function(){
		return this._private.animation.current.length > 0;
	};
	
	CyElement.prototype.clearQueue = function(){
		this._private.animation.queue = [];
	};
	
	CyElement.prototype.delay = function( time ){
		this.animate({
			delay: time
		}, {
			duration: time
		});
		
		return this;
	};
	
	CyElement.prototype.animate = function( properties, params ){
		var self = this;
		var callTime = +new Date;
		var startPosition = copy( self._private.position );
		var startStyle = copy( self.style() );
		var structs = this.cy()._private; // TODO remove ref to `structs` after refactoring
		
		params = $.extend(true, {}, {
			duration: 400
		}, params);
		
		switch( params.duration ){
		case "slow":
			params.duration = 600;
			break;
		case "fast":
			params.duration = 200;
			break;
		}
		
		if( properties == null || (properties.position == null && properties.bypass == null && properties.delay == null) ){
			return; // nothing to animate
		}
		
		if( self.animated() && (params.queue === undefined || params.queue) ){
			enqueue();
		} else {
			run();
		}
		
		var q;
		
		function enqueue(){
			q = self._private.animation.queue;
			add();
		}
		
		function run(){
			q = self._private.animation.current;
			add();
		} 
		
		function add(){
			q.push({
				properties: properties,
				params: params,
				callTime: callTime,
				startPosition: startPosition,
				startStyle: startStyle
			});
			
			structs.animation.elements = structs.animation.elements.add( self );
		}
		
		return this;
	};
	
	CyElement.prototype.stop = function(clearQueue, jumpToEnd){
		var self = this;
		
		$.each(self._private.animation.current, function(i, animation){				
			if( jumpToEnd ){
				$.each(animation.properties, function(propertyName, property){
					$.each(property, function(field, value){
						self._private[propertyName][field] = value;
					});
				});
			}
		});
		
		self._private.animation.current = [];
		
		if( clearQueue ){
			self._private.animation.queue = [];
		}

		// we have to notify (the animation loop doesn't do it for us on `stop`)
		({
			collection: self.collection(),
			type: "draw"
		});
		
		return this;
	};
	
	CyElement.prototype.show = function(){
		this.cy().renderer().showElements(this.collection());
		
		return this;
	};
	
	CyElement.prototype.hide = function(){
		this.cy().renderer().hideElements(this.collection());
		
		return this;
	};
	
	CyElement.prototype.visible = function(){
		return this.cy().renderer().elementIsVisible(this);
	};
	
	CyElement.prototype.renderedPosition = function(coord, val){
		if( this.isEdge() ){
			$.cytoscapeweb("warn", "Can not access rendered position for edge `" + this._private.data.id + "`; edges have no position");
			return null;
		}
		var renderer = this.cy().renderer(); // TODO remove reference after refactoring
		
		var pos = renderer.renderedPosition(this);
		
		if( coord === undefined ){
			return pos;
		} else if( is.string(coord) ) {
			if( val === undefined ){
				return pos[coord];
			} else {
				pos[coord] = val;
				this.position( renderer.modelPoint(pos) );
			}
		} else if( is.plainObject(coord) ){
			pos = $.extend(true, {}, pos, coord);
			this.position( renderer.modelPoint(pos) );
		}
		
		return this;
	};
	
	CyElement.prototype.renderedDimensions = function(dimension){
		var renderer = this.cy().renderer(); // TODO remove reference after refactoring
		var dim = renderer.renderedDimensions(this);
		
		if( dimension === undefined ){
			return dim;
		} else {
			return dim[dimension];
		}
	};
	
	CyElement.prototype.style = function(){
		// the renderer should populate this field and keep it up-to-date
		return copy( this._private.style );
	};
	
	function bind(opts){
		return function(events, data, callback){
			var self = this;
			
			if( callback === undefined ){
				callback = data;
				data = undefined;
			}
			
			var defaults = {
				one: false,
				data: data
			};
			var options = $.extend({}, defaults, opts);
			
			$.each(events.split(/\s+/), function(i, event){
				if(event == "") return this;
				
				if( self._private.listeners[event] == null ){
					self._private.listeners[event] = [];
				}				
				
				options.callback = callback;
				self._private.listeners[event].push(options);
			});
			
			return this;
		};
	}
	
	CyElement.prototype.bind = bind({ one: false });
	CyElement.prototype.one = bind({ one: true });
	
	CyElement.prototype.live = function(){
		console.error("You can not call `live` on an element");
		return this;
	};
	
	CyElement.prototype.die = function(){
		console.error("You can not call `die` on an element");
		return this;
	};
	
	CyElement.prototype.on = function(events, data, callback){
		return this.bind(events, data, callback);
	};
	
	CyElement.prototype.off = function(events, callback){
		return this.unbind(events, callback);
	};
	
	CyElement.prototype.unbind = function(events, callback){
		var self = this;
		
		if( events === undefined ){
			self._private.listeners = {};
			return this;
		}
		
		$.each(events.split(/\s+/), function(j, event){
			if(event == "") return this;
		
			var listeners = self._private.listeners[event];
			
			if( listeners != null ){
				for(var i = 0; i < listeners.length; i++){
					var listener = listeners[i];
					
					if( callback == null || callback == listener.callback ){
						listeners.splice(i, 1);
						i--;
					}
				}
			}
		
		});
		
		return this;
	};
	
	CyElement.prototype.rtrigger = function(event, data){
		// notify renderer unless removed
		if( !this.removed() ){
			this.cy().notify({
				type: event,
				collection: [ this ]
			});
		}
		
		this.trigger(event, data);
	};
	
	CyElement.prototype.trigger = function(event, data){
		var self = this;
		var type = is.plainObject(event) ? event.type : event;
		var structs = this.cy()._private; // TODO remove ref to `structs` after refactoring
		
		var listeners = this._private.listeners[type];
		
		function fire(listener, eventData){
			if( listener != null && is.fn(listener.callback) ){
				var eventData = is.plainObject(event) ? event : jQuery.Event(type);
				eventData.data = listener.data;
				eventData.cy = eventData.cytoscapeweb = cy;
				
				var args = [eventData];
				
				if( data != null ){
					$.each(data, function(i, arg){
						args.push(arg);
					});
				}
				
				listener.callback.apply(self, args);
			}
		}
		
		// trigger regularly bound listeners
		if( listeners != null ){
			$.each(listeners, function(i, listener){
				fire(listener);
			});
			
			for(var i = 0; i < listeners.length; i++){
				if( listeners[i].one ){
					listeners.splice(i, 1);
					i--;
				} else if( listeners[i].once ){
					var listener = listeners[i];
					
					// remove listener for other elements
					listener.collection.each(function(j, ele){
						if( !ele.same(self) ){
							ele.unbind(type, listener.callback);
						}
					});
					
					// remove listener from global once struct
					for(var j = 0; j < structs.once.length; j++){
						if( listener == structs.once[j] ){
							structs.once.splice(j, 1);
							j--;
						}
					}
					
					// remove listener for self
					listeners.splice(i, 1);
					i--;
				}
			}
		}
		
		// trigger element live events
		if( structs.live[type] != null ){
			$.each(structs.live[type], function(key, callbackDefns){
				
				var selector = new CySelector( self.cy(), key );
				var filtered = selector.filter( self.collection() );
				
				if( filtered.size() > 0 ){
					$.each(callbackDefns, function(i, listener){
						fire(listener);
					});
				}
			});
		}
		
		// bubble up element events to the core
		self.cy().trigger(event, data);
		
		return this;
	};
	
	CyElement.prototype.selected = function(){
		return this._private.selected;
	};
	
	CyElement.prototype.select = switchFunction({ event: "select", field: "selected", value: true });
	
	CyElement.prototype.unselect = switchFunction({ event: "unselect", field: "selected", value: false });
	
	CyElement.prototype.source = function(){
		var structs = this.cy()._private; // TODO remove ref to `structs` after refactoring
		
		if( this._private.group == "nodes" ){
			console.error("Can call `source` only on edges---tried to call on node `%s`", this._private.data.id);
			return this;
		}
		
		return structs.nodes[ this._private.data.source ];
	};
	
	CyElement.prototype.target = function(){
		var structs = this.cy()._private; // TODO remove ref to `structs` after refactoring
		
		if( this._private.group == "nodes" ){
			console.error("Can call `target` only on edges---tried to call on node `%s`", this._private.data.id);
			return this;
		}
		
		return structs.nodes[ this._private.data.target ];
	};
	
	CyElement.prototype.isNode = function(){
		return this._private.group == "nodes";
	};
	
	CyElement.prototype.isEdge = function(){
		return this._private.group == "edges";
	};
	
	CyElement.prototype.same = function(element){
		return this == element.element();
	};
	
	CyElement.prototype.is = function(selector){
		return new CySelector(this.cy(), selector).filter(this.collection()).size() > 0;
	};
	
	CyElement.prototype.allAre = function(selector){
		return this.is(selector);
	};
	
	CyElement.prototype.allAreNeighbours = CyElement.prototype.allAreNeighbors = function(collection){
		collection = collection.collection();
		var adjacents = this.neighborhood();
		
		if( this.isNode() ){
			var self = this;
			adjacents.edges().each(function(i, edge){
				if( edge._private.data.source == edge._private.data.target ){
					adjacents = adjacents.add(self);
				}
			});
		}
		
		var ret = true;
		
		for(var i = 0; i < collection.size(); i++){
			var element = collection[i];
			var inCollection = false;
			
			for(var j = 0; j < adjacents.size(); j++){
				var adjacent = adjacents[j];
				
				if( element == adjacent){
					inCollection = true;
					break;
				}
			}
			
			ret = ret && inCollection;
			if(ret == false){
				break;
			}
		}
		
		return ret;
	};
	
	CyElement.prototype.closedNeighbourhood = CyElement.prototype.closedNeighborhood = function(selector){
		return new CySelector(this.cy(), selector).filter( this.neighborhood().add(this) );
	};
	
	CyElement.prototype.openNeighbourhood = CyElement.prototype.openNeighborhood = function(selector){
		return this.neighborhood(selector);
	};
	
	CyElement.prototype.neighbourhood = CyElement.prototype.neighborhood = function(selector){
		var structs = this.cy()._private; // TODO remove ref to `structs` after refactoring
		var collection;
		
		if( this.group() == "nodes" ) {
			var node = this;
			var neighbors = [];
			var nodes = {};
			$.each(structs.nodeToEdges[ this._private.data.id ], function(id, edge){
				neighbors.push(edge);
				
				$.each([ edge._private.data.source, edge._private.data.target ], function(i, nodeId){
					
					if( nodes[nodeId] == null ){
						if( (nodeId != node._private.data.id) ){
							nodes[nodeId] = true;
							neighbors.push( structs.nodes[nodeId] );
						}
					}
					
				});
			});
			collection = new CyCollection(this.cy(), neighbors);
			
		} else if( this.group() == "edges" ){
			
			var neighbors = [];
			var nodes = {};
			var edge = this;
			$.each([ edge._private.data.source, edge._private.data.target ], function(i, nodeId){
				
				if( nodes[nodeId] == null ){
					nodes[nodeId] = true;
					
					neighbors.push( structs.nodes[nodeId] );
				}
				
			});
			collection = new CyCollection(this.cy(), neighbors);
			
		}
		
		collection = new CySelector(this.cy(), selector).filter(collection);
		
		return collection;
	};

	function degreeFunction(callback){
		return function(){
			var structs = this.cy()._private; // TODO remove ref to `structs` after refactoring
			
			if( this._private.group == "nodes" && !this._private.removed ){
				var degree = 0;
				var edges = structs.nodeToEdges[this._private.data.id];
				var node = this;
				
				if( edges != null ){
					$.each(edges, function(i, edge){
						degree += callback(node, edge);
					});
				}
				
				return degree;
			} else {
				return undefined;
			}
		};
	}
	
	CyElement.prototype.degree = degreeFunction(function(node, edge){
		if( edge._private.data.source == edge._private.data.target ){
			return 2;
		} else {
			return 1;
		}
	});
	
	CyElement.prototype.indegree = degreeFunction(function(node, edge){
		if( node._private.data.id == edge._private.data.target ){
			return 1;
		} else {
			return 0;
		}
	});
	
	CyElement.prototype.outdegree = degreeFunction(function(node, edge){
		if( node._private.data.id == edge._private.data.source ){
			return 1;
		} else {
			return 0;
		}
	});
	
	function listenerAlias(params){
		return function(data, callback){
			if( is.fn(callback) ){
				return this.bind(params.name, data, callback);
			} else if( is.fn(data) ){
				var handler = data;
				return this.bind(params.name, handler);						
			} else {
				return this.rtrigger(params.name, data);
			}
		};
	}
	
	// aliases to listeners, e.g. node.click(fn) => node.bind("click", fn)
	// TODO add more
	CyElement.prototype.mousedown = listenerAlias({ name : "mousedown" });
	CyElement.prototype.mouseup = listenerAlias({ name : "mouseup" });
	CyElement.prototype.mouseover = listenerAlias({ name : "mouseover" });
	CyElement.prototype.mouseout = listenerAlias({ name : "mouseout" });
	CyElement.prototype.mousemove = listenerAlias({ name : "mousemove" });
	CyElement.prototype.click = listenerAlias({ name : "click" });
	CyElement.prototype.touchstart = listenerAlias({ name : "touchstart" });
	CyElement.prototype.touchmove = listenerAlias({ name : "touchmove" });
	CyElement.prototype.touchend = listenerAlias({ name : "touchend" });
	CyElement.prototype.grab = listenerAlias({ name : "grab" });
	CyElement.prototype.drag = listenerAlias({ name : "drag" });
	CyElement.prototype.free = listenerAlias({ name : "free" });
	
	
	// CyCollection
	////////////////////////////////////////////////////////////////////////////////////////////////////
				
	// represents a set of nodes, edges, or both together
	function CyCollection(cy, elements){
		
		if( cy === undefined || cy.$ == null ){
			console.error("A collection must have a reference to the core");
			return;
		}
		
		if( elements == null ){
			elements = [];
		}
		
		for(var i = 0; i < elements.length; i++){
			this[i] = elements[i];
		}
		
		this.length = elements.length;
		
		this._private = {
			cy: cy
		};
	}
	$.cytoscapeweb.CyCollection = CyCollection; // expose
	
	// what functions in CyElement update the renderer
	// each one has the same name as its event 
	// TODO keep in sync as more alias functions are added
	var rendererFunctions = [
	                         "remove",
	                         "data",
	                         "bypass", 
	                         "position",
	                         "select", "unselect",
	                         "lock", "unlock",
	                         "mouseover", "mouseout", "mousemove", "mousedown", "mouseup", "click",
	                         "touchstart", "touchmove", "touchend",
	                         "grabify", "ungrabify"
	                         ];
	var getters = [ "data", "bypass", "position" ];
	
	// functions in element can also be used on collections
	$.each(CyElement.prototype, function(name, func){
		CyCollection.prototype[name] = function(){
			
			var rets = [];
			var returnsSelf = true; // whether the function returns itself
			var returnsCollection = true; // whether the function returns a collection
			var collection = new CyCollection( this._private.cy );
		
			// disable renderer notifications during loop
			// just notify at the end of the loop with the whole collection
			var isRendererFn = $.inArray(name, rendererFunctions) >= 0;
			var hasPassedFn = is.fn(arguments[0]);
			var isGetter = $.inArray(name, getters) >= 0 && ( arguments[0] === undefined || (is.string(arguments[0]) && arguments[1] === undefined));
			
			var joinNotifications = isRendererFn && !hasPassedFn && !isGetter;
			
			if( joinNotifications ){
				this._private.cy.notificationsEnabled(false);
			}
		
			for(var i = 0; i < this.size(); i++){
				var element = this[i];
				var ret = func.apply(element, arguments);
				
				if( ret !== undefined ){
					rets.push(ret);
				}
				
				returnsSelf = returnsSelf && (ret == element);
				returnsCollection = returnsCollection && (ret instanceof CyCollection || ret instanceof CyElement);
				
				if(returnsCollection){
					collection = collection.add(ret);
				}
				
				if( !returnsSelf && !returnsCollection ){
					break;
				}
			}
			
			// notify the renderer of the call on the whole collection
			// (more efficient than sending each in a row---may have flicker?)
			if( joinNotifications ){
				this._private.cy.notificationsEnabled(true);
				this._private.cy.notify({
					type: name,
					collection: this
				});
			}
			
			if( !returnsSelf && !returnsCollection ){
				return rets[0];
			}
			
			if( returnsSelf || rets.length == 0 ) {
				return this; // if fn returns the element, then return the same collection
			} else if( returnsCollection ){
				return collection;
			}
			
			return rets;
		};
	});
	
	// NOTE: any functions with the same name in element and collection must go here for collection
	//       if the implementation differs

	CyCollection.prototype.toArray = function(){
		var array = [];
		
		for(var i = 0; i < this.size(); i++){
			array.push( this.eq(i) );
		}
		
		return array;
	};
	
	CyCollection.prototype.slice = function(start, end){
		var array = [];
		
		if( end == null ){
			end = this.size();
		}
		
		if( start < 0 ){
			start = this.size() + start;
		}
		
		for(var i = start; i >= 0 && i < end && i < this.size(); i++){
			array.push( this.eq(i) );
		}
		
		return new CyCollection(this.cy(), array);
	};
	
	CyCollection.prototype.size = function(){
		return this.length;
	};
	
	CyCollection.prototype.eq = function(i){
		return this[i];
	};
	
	CyCollection.prototype.empty = function(){
		return this.size() == 0;
	};
	
	CyCollection.prototype.live = function(){
		console.error("`live` can be called only on collections made from top-level selectors");
	};
	
	CyCollection.prototype.die = function(){
		console.error("`die` can be called only on collections made from top-level selectors");
	};
	
	CyCollection.prototype.each = function(fn){
		for(var i = 0; i < this.size(); i++){
			if( is.fn(fn) ){
				fn.apply( this.eq(i), [ i, this.eq(i) ] );
			}
		}
		return this;
	};
	
	CyCollection.prototype.add = function(toAdd){
		
		if(toAdd == null){
			return this;
		}
		
		if( is.string(toAdd) ){
			var selector = toAdd;
			toAdd = elementsCollection({ selector: selector });
		}
		
		var elements = [];
		var ids = {
			nodes: {},
			edges: {}
		};
	
		function add(element){
			if( element == null ){
				return;
			}
			
			if( ids[element._private.group][element._private.data.id] == null ){
				elements.push(element);
				ids[element._private.group][element._private.data.id] = true;
			}
		}
		
		// add own
		this.each(function(i, element){
			add(element);
		});
		
		// add toAdd
		var collection = toAdd.collection();
		collection.each(function(i, element){
			add(element);
		});
		
		return new CyCollection(this.cy(), elements);
	};
	
	CyCollection.prototype.not = function(toRemove){
		
		if(toRemove == null){
			return this;
		} else {
		
			if( is.string(toRemove) ){
				toRemove = this.filter(toRemove);
			}
			
			var elements = [];
			var collection = toRemove.collection();
			
			this.each(function(i, element){
				
				var remove = false;
				for(var j = 0; j < collection.size(); j++){
					var c = collection.eq(j);
					
					if( c.element() == element.element() ){
						remove = true;
						break;
					}
				}
				
				if(!remove){
					elements.push(element);
				}
				
			});
			
			return new CyCollection(this.cy(), elements);
		} 
	};
	
	CyCollection.prototype.filter = function(filter){
		var cy = this.cy();
		
		if( is.fn(filter) ){
			var elements = [];
			this.each(function(i, element){
				if( !is.fn(filter) || filter.apply(element, [i, element]) ){
					elements.push(element);
				}
			});
			
			return new CyCollection(this.cy(), elements);
		} else if( is.string(filter) ){
			return new CySelector(this.cy(), filter).filter(this);
		} 

		console.error("You must pass a function or a selector to `filter`");
	};
	
	CyCollection.prototype.nodes = function(selector){
		return this.filter(function(i, element){
			return element.group() == "nodes";
		});
	};
	
	CyCollection.prototype.edges = function(selector){
		return this.filter(function(i, element){
			return element.group() == "edges";
		});
	};
	
	CyCollection.prototype.positions = function(fn){
		
		var collection = this;
		
		this.cy().noNotifications(function(){
			collection.each(function(i, element){
				var positionOpts = fn.apply(element, [i, element]);
				
				if( is.plainObject(positionOpts) ){
					element.position(positionOpts);
				}
			});
		});

		this.cy().notify({
			type: "position",
			collection: this
		});
	};
	
	CyCollection.prototype.allSame = function(collection){
		collection = collection.collection();
		
		// cheap check to make sure A.allSame(B) == B.allSame(A)
		if( collection.size() != this.size() ){
			return false;
		}
		
		var ret = true;
		for(var i = 0; i < collection.size(); i++){
			var collectionElement = collection.eq(i);
			
			var hasCollectionElement = false;
			for(var j = 0; j < this.size(); j++){
				var thisElement = this.eq(j);
				
				hasCollectionElement = thisElement.same(collectionElement);
				if(hasCollectionElement) break;
			}
			
			ret = ret && hasCollectionElement;
			if(!ret) break;
		}
		
		return ret;
	};
	
	CyCollection.prototype.anySame = function(collection){
		collection = collection.collection();
		
		var ret = false;
		for(var i = 0; i < collection.size(); i++){
			var collectionElement = collection.eq(i);
			
			for(var j = 0; j < this.size(); j++){
				var thisElement = this.eq(j);
				
				ret = ret || thisElement.same(collectionElement);
				if(ret) break;
			}
			if(ret) break;
		}
		
		return ret;
	};
	
	
	CyCollection.prototype.show = function(){
		var renderer = this.cy().renderer(); // TODO remove reference after refactoring
		renderer.showElements(this);
		
		return this;
	};
	
	CyCollection.prototype.hide = function(){
		var renderer = this.cy().renderer(); // TODO remove reference after refactoring
		renderer.hideElements(this);
		
		return this;
	};
	
	CyCollection.prototype.once = function(event, data, handler){
		var self = this;
		var structs = this.cy()._private; // TODO remove ref to `structs` after refactoring
		
		if( handler === undefined ){
			handler = data;
			data = undefined;
		}
		
		var events = event.split(/\s+/);
		$.each(events, function(i, type){
			var listener = {
				once: true,
				callback: handler,
				collection: new CyCollection( self.cy() )
			};
			
			structs.once.push(listener);
			
			self.each(function(i, ele){
				if( ele._private.listeners[type] == null ){
					ele._private.listeners[type] = [];
				}
				
				ele._private.listeners[type].push(listener);
				listener.collection = listener.collection.add(ele);
			});
		});
		
		return this;
	};
	
	CyCollection.prototype.rtrigger = function(event, data){
		
		var collection = this;
		
		this.cy().noNotifications(function(){
			collection.each(function(i, element){
				element.rtrigger(event, data);
			});
		});

		this.cy().notify({
			type: event,
			collection: this
		});
		
		return this;
	};
	
	CyCollection.prototype.collection = function(){
		return this;
	};
	
	function degreeBoundsFunction(degreeFn, callback){
		return function(){
			var ret = null;
			var degrees = this[degreeFn]();
			this.each(function(i, ele){
				var degree = ele[degreeFn]();
				if( degree != null && (ret == null || callback(degree, ret)) ){
					ret = degree;
				}
			});
			return ret;
		};
	}
	
	CyCollection.prototype.minDegree = degreeBoundsFunction("degree", function(degree, min){
		return degree < min;
	});
	
	CyCollection.prototype.maxDegree = degreeBoundsFunction("degree", function(degree, max){
		return degree > max;
	});

	CyCollection.prototype.minIndegree = degreeBoundsFunction("indegree", function(indegree, min){
		return indegree < min;
	});
	
	CyCollection.prototype.maxIndegree = degreeBoundsFunction("indegree", function(indegree, max){
		return indegree > max;
	});
	
	CyCollection.prototype.minOutdegree = degreeBoundsFunction("outdegree", function(outdegree, min){
		return outdegree < min;
	});
	
	CyCollection.prototype.maxOutdegree = degreeBoundsFunction("outdegree", function(outdegree, max){
		return outdegree > max;
	});
	
	CyCollection.prototype.totalDegree = function(){
		var total = 0;
		
		this.each(function(i, ele){
			if( ele.isNode() ){
				total += ele.degree();
			}
		});

		return total;
	};
	
	CyCollection.prototype.allAreNeighbours = CyCollection.prototype.allAreNeighbors = function(collection){
		collection = collection.collection();
		var ret = true;
		
		for(var i = 0; i < this.size(); i++){
			var element = this.eq(i);
			ret = ret && element.allAreNeighbors(collection);
			
			if( ret == false ){
				break;
			}
		}
		
		return ret;
	};
				
	CyCollection.prototype.allAre = function(selector){
		return this.filter(selector).size() == this.size();
	};
	
	CyCollection.prototype.is = function(selector){
		return this.filter(selector).size() > 0;
	};
	
	CyCollection.prototype.toggleClass = function(className, toggle){
		var collection = this;
		var classes = className.split(/\s+/);
		
		this.cy().noNotifications(function(){
			$.each(classes, function(i, cls){
				collection.each(function(j, ele){
					
					function add(){ ele.addClass(cls); }
					function remove(){ ele.removeClass(cls); }
					function has(){ return ele.hasClass(cls); }
					
					if( toggle === undefined ){
						if( has() ){
							remove();
						} else {
							add();
						}
					} else if( toggle && !has() ){
						add();
					} else if( !toggle && has() ) {
						remove();
					}
					
				});
			});
		});
		
		this.cy().notify({
			type: "class",
			collection: collection
		});
		
		return this;
	};
	
	CyCollection.prototype.addClass = function(className){
		var collection = this;
		
		this.cy().noNotifications(function(){
			collection.each(function(i, element){
				element.addClass(className);
			});
		});

		this.cy().notify({
			type: "class",
			collection: collection
		});
		
		return this;
	};
	
	CyCollection.prototype.removeClass = function(className){
		var collection = this;
		
		this.cy().noNotifications(function(){
			collection.each(function(i, element){
				element.removeClass(className);
			});
		});

		this.cy().notify({
			type: "class",
			collection: collection
		});
		
		return this;
	};
	
	CyCollection.prototype.removeData = function(field){
		var collection = this;
		
		this.cy().noNotifications(function(){
			collection.each(function(i, element){
				element.removeData(field);
			});
		});

		this.cy().notify({
			type: "data",
			collection: collection
		});
		
		return this;
	};
	
	CyCollection.prototype.removeBypass = function(field){
		var collection = this;
		
		this.cy().noNotifications(function(){
			collection.each(function(i, element){
				element.removeBypass(field);
			});
		});

		this.cy().notify({
			type: "bypass",
			collection: collection
		});
		return this;
	};
	
	CyCollection.prototype.remove = function(){
		var collection = this;
		
		var elementsRemoved = collection.add( collection.neighborhood().edges() );
		
		this.cy().noNotifications(function(){
			collection.edges().each(function(i, element){
				element.remove();
			});
			
			collection.nodes().each(function(i, element){
				element.remove();
			});
		});
		
		this.cy().notify({
			type: "remove",
			collection: elementsRemoved
		});
		return this;
	};
	
	CyCollection.prototype.restore = function(){
		var collection = this.filter(":removed");
		
		this.cy().noNotifications(function(){
			collection.nodes().each(function(i, element){
				element.restore();
			});
			
			collection.edges().each(function(i, element){
				element.restore();
			});
		});

		this.cy().notify({
			type: "add",
			collection: collection
		});
		return this;
	};
	
	CyCollection.prototype.element = function(){
		return this[0];
	};
			
	CyCollection.prototype.stop = function(){
		var args = arguments;
		
		this.each(function(i, ele){
			ele.stop.apply( ele, args );
		});
		
		this.cy().notify({
			type: "draw",
			collection: this
		});
		
		return this;
	};
	
	CyCollection.prototype.cy = function(foo){ // get cy
		return this._private.cy;
	};
	
	// Add registered collection functions
	////////////////////////////////////////////////////////////////////////////////////////////////////
	
	// add each function to the CyCollection prototype
	// automatically added also to CyElement via code below
	$.each($.cytoscapeweb.reg.collection, function(name, func){
		if( CyCollection.prototype[name] == null ){
			CyCollection.prototype[name] = func;
		} else {
			console.error("Can not override collection function `%s`; already has an implementation", name);
		}
	});
	
	// CyElement functions based on CyCollection functions (to make same API)
	////////////////////////////////////////////////////////////////////////////////////////////////////
	
	$.each(CyCollection.prototype, function(name, func){
		if( CyElement.prototype[name] == null ){
			CyElement.prototype[name] = function(){
				var collection = this.collection();
				
				return func.apply(collection, arguments);
			};
		}
	});
	
	// CySelector
	////////////////////////////////////////////////////////////////////////////////////////////////////
	
	function CySelector(cy, onlyThisGroup, selector){
		
		if( cy === undefined || cy.$ == null ){
			console.error("A selector must have a reference to the core");
			return;
		}
		
		if( selector === undefined && onlyThisGroup !== undefined ){
			selector = onlyThisGroup;
			onlyThisGroup = undefined;
		}
		
		var self = this;
		
		self._private = {
			selectorText: null,
			invalid: true,
			cy: cy
		}
	
		function newQuery(){
			return {
				classes: [],
				colonSelectors: [],
				data: [],
				group: onlyThisGroup,
				ids: [],
				meta: [],
				collection: null,
				filter: null
			};
		}
		
		if( selector == null || ( is.string(selector) && selector.match(/^\s*$/) ) ){
			
			if( onlyThisGroup == null ){
				// ignore
				self.length = 0;
			} else {
				
				// NOTE: need to update this with fields as they are added to logic in else if
				self[0] = newQuery();
				self.length = 1;
			}
							
		} else if( selector instanceof CyElement ){
			var collection = new CyCollection(self.cy(), [ selector ]);
			
			self[0] = newQuery();
			self[0].collection = collection;
			self.length = 1;
			
		} else if( selector instanceof CyCollection ){
			self[0] = newQuery();
			self[0].collection = selector;
			self.length = 1;
			
		} else if( is.fn(selector) ) {
			self[0] = newQuery();
			self[0].filter = selector;
			self.length = 1;
			
		} else if( is.string(selector) ){
		
			// these are the actual tokens in the query language
			var metaChar = "[\\!\\\"\\#\\$\\%\\&\\\'\\(\\)\\*\\+\\,\\.\\/\\:\\;\\<\\=\\>\\?\\@\\[\\]\\^\\`\\{\\|\\}\\~]"; // chars we need to escape in var names, etc
			var variable = "(?:[\\w-]|(?:\\\\"+ metaChar +"))+"; // a variable name
			var comparatorOp = "=|\\!=|>|>=|<|<=|\\$=|\\^=|\\*="; // binary comparison op (used in data selectors)
			var boolOp = "\\?|\\!|\\^"; // boolean (unary) operators (used in data selectors)
			var string = '"(?:\\\\"|[^"])+"' + "|" + "'(?:\\\\'|[^'])+'"; // string literals (used in data selectors) -- doublequotes | singlequotes
			var number = "\\d*\\.\\d+|\\d+|\\d*\\.\\d+[eE]\\d+"; // number literal (used in data selectors) --- e.g. 0.1234, 1234, 12e123
			var value = string + "|" + number; // a value literal, either a string or number
			var meta = "degree|indegree|outdegree"; // allowed metadata fields (i.e. allowed functions to use from CyCollection)
			var separator = "\\s*,\\s*"; // queries are separated by commas; e.g. edge[foo = "bar"], node.someClass
			var className = variable; // a class name (follows variable conventions)
			var id = variable; // an element id (follows variable conventions)
			
			// when a token like a variable has escaped meta characters, we need to clean the backslashes out
			// so that values get compared properly in CySelector.filter()
			function cleanMetaChars(str){
				return str.replace(new RegExp("\\\\(" + metaChar + ")", "g"), "\1");
			}
			
			// add @ variants to comparatorOp
			$.each( comparatorOp.split("|"), function(i, op){
				comparatorOp += "|@" + op;
			} );
			
			// NOTE: add new expression syntax here to have it recognised by the parser;
			// a query contains all adjacent (i.e. no separator in between) expressions;
			// the current query is stored in self[i] --- you can use the reference to `this` in the populate function;
			// you need to check the query objects in CySelector.filter() for it actually filter properly, but that's pretty straight forward
			var exprs = {
				group: {
					regex: "(node|edge)",
					populate: function( group ){
						this.group = group + "s";
					}
				},
				
				state: {
					regex: "(:selected|:unselected|:locked|:unlocked|:visible|:hidden|:grabbed|:free|:removed|:inside|:grabbable|:ungrabbable|:animated|:unanimated)",
					populate: function( state ){
						this.colonSelectors.push( state );
					}
				},
				
				id: {
					regex: "\\#("+ id +")",
					populate: function( id ){
						this.ids.push( cleanMetaChars(id) );
					}
				},
				
				className: {
					regex: "\\.("+ className +")",
					populate: function( className ){
						this.classes.push( cleanMetaChars(className) );
					}
				},
				
				dataExists: {
					regex: "\\[\\s*("+ variable +")\\s*\\]",
					populate: function( variable ){
						this.data.push({
							field: cleanMetaChars(variable)
						});
					}
				},
				
				dataCompare: {
					regex: "\\[\\s*("+ variable +")\\s*("+ comparatorOp +")\\s*("+ value +")\\s*\\]",
					populate: function( variable, comparatorOp, value ){
						this.data.push({
							field: cleanMetaChars(variable),
							operator: comparatorOp,
							value: value
						});
					}
				},
				
				dataBool: {
					regex: "\\[\\s*("+ boolOp +")\\s*("+ variable +")\\s*\\]",
					populate: function( boolOp, variable ){
						this.data.push({
							field: cleanMetaChars(variable),
							operator: boolOp
						});
					}
				},
				
				metaCompare: {
					regex: "\\{\\s*("+ meta +")\\s*("+ comparatorOp +")\\s*("+ number +")\\s*\\}",
					populate: function( meta, comparatorOp, number ){
						this.meta.push({
							field: cleanMetaChars(meta),
							operator: comparatorOp,
							value: number
						});
					}
				}
			};
			
			self._private.selectorText = selector;
			var remaining = selector;
			var i = 0;
			
			// of all the expressions, find the first match in the remaining text
			function consumeExpr(){
				var expr;
				var match;
				var name;
				
				$.each(exprs, function(n, e){
					var m = remaining.match(new RegExp( "^" + e.regex ));
					
					if( m != null ){
						match = m;
						expr = e;
						name = n;
						
						var consumed = m[0];
						remaining = remaining.substring( consumed.length );								
						
						return false;
					}
				});
				
				return {
					expr: expr,
					match: match,
					name: name
				};
			}
			
			// consume all leading whitespace
			function consumeWhitespace(){
				var match = remaining.match(/^\s+/);
				
				if( match ){
					var consumed = match[0];
					remaining = remaining.substring( consumed.length );
				}
			}
			
			// consume query separators
			function consumeSeparators(){
				var match = remaining.match(new RegExp( "^" + separator ));
				
				// if we've matched to a separator, consume it
				if( match ){
					var consumed = match[0];
					remaining = remaining.substring( consumed.length );
					self[++i] = newQuery();
				}
			}
			
			self[0] = newQuery(); // get started
			
			consumeWhitespace(); // get rid of leading whitespace
			for(;;){
				consumeSeparators();
				
				var check = consumeExpr();
				
				if( check.name == "group" && onlyThisGroup != null && self[i].group != onlyThisGroup ){
					console.error("Group `%s` conflicts with implicit group `%s` in selector `%s`", self[i].group, onlyThisGroup, selector);
					return;
				}
				
				if( check.expr == null ){
					console.error("The selector `%s` is invalid", selector);
					return;
				} else {
					var args = [];
					for(var j = 1; j < check.match.length; j++){
						args.push( check.match[j] );
					}
					
					// let the token populate the selector object (i.e. in self[i])
					check.expr.populate.apply( self[i], args );
				}
				
				// we're done when there's nothing left to parse
				if( remaining.match(/^\s*$/) ){
					break;
				}
			}
			
			self.length = i + 1;
			
		} else {
			console.error("A selector must be created from a string; found %o", selector);
			return;
		}

		self._private.invalid = false;
		
		
	}
	$.cytoscapeweb.CySelector = CySelector;
	
	CySelector.prototype.cy = function(){
		return this._private.cy;
	};
	
	CySelector.prototype.size = function(){
		return this.length;
	};
	
	CySelector.prototype.eq = function(i){
		return this[i];
	};
	
	CySelector.prototype.filter = function(collection, addLiveFunction){
		var self = this;
		
		// don't bother trying if it's invalid
		if( self._private.invalid ){
			return new CyCollection( self.cy() );
		}
		
		var selectorFunction = function(i, element){
			for(var j = 0; j < self.length; j++){
				var query = self[j];
				
				// check group
				if( query.group != null && query.group != element._private.group ){
					continue;
				}
				
				// check colon selectors
				var allColonSelectorsMatch = true;
				for(var k = 0; k < query.colonSelectors.length; k++){
					var sel = query.colonSelectors[k];
					var renderer = self.cy().renderer(); // TODO remove reference after refactoring
					
					switch(sel){
					case ":selected":
						allColonSelectorsMatch = element.selected();
						break;
					case ":unselected":
						allColonSelectorsMatch = !element.selected();
						break;
					case ":locked":
						allColonSelectorsMatch = element.locked();
						break;
					case ":unlocked":
						allColonSelectorsMatch = !element.locked();
						break;
					case ":visible":
						allColonSelectorsMatch = renderer.elementIsVisible(element);
						break;
					case ":hidden":
						allColonSelectorsMatch = !renderer.elementIsVisible(element);
						break;
					case ":grabbed":
						allColonSelectorsMatch = element.grabbed();
						break;
					case ":free":
						allColonSelectorsMatch = !element.grabbed();
						break;
					case ":removed":
						allColonSelectorsMatch = element.removed();
						break;
					case ":inside":
						allColonSelectorsMatch = !element.removed();
						break;
					case ":grabbable":
						allColonSelectorsMatch = element.grabbable();
						break;
					case ":ungrabbable":
						allColonSelectorsMatch = !element.grabbable();
						break;
					case ":animated":
						allColonSelectorsMatch = element.animated();
						break;
					case ":unanimated":
						allColonSelectorsMatch = !element.animated();
						break;
					}
					
					if( !allColonSelectorsMatch ) break;
				}
				if( !allColonSelectorsMatch ) continue;
				
				// check id
				var allIdsMatch = true;
				for(var k = 0; k < query.ids.length; k++){
					var id = query.ids[k];
					var actualId = element._private.data.id;
					
					allIdsMatch = allIdsMatch && (id == actualId);
					
					if( !allIdsMatch ) break;
				}
				if( !allIdsMatch ) continue;
				
				// check classes
				var allClassesMatch = true;
				for(var k = 0; k < query.classes.length; k++){
					var cls = query.classes[k];
					
					allClassesMatch = allClassesMatch && element.hasClass(cls);
					
					if( !allClassesMatch ) break;
				}
				if( !allClassesMatch ) continue;
				
				// generic checking for data/metadata
				function operandsMatch(params){
					var allDataMatches = true;
					for(var k = 0; k < query[params.name].length; k++){
						var data = query[params.name][k];
						var operator = data.operator;
						var value = data.value;
						var field = data.field;
						var matches;
						
						if( operator != null && value != null ){
							
							var fieldStr = "" + params.fieldValue(field);
							var valStr = "" + eval(value);
							
							var caseInsensitive = false;
							if( operator.charAt(0) == "@" ){
								fieldStr = fieldStr.toLowerCase();
								valStr = valStr.toLowerCase();
								
								operator = operator.substring(1);
								caseInsensitive = true;
							}
							
							if( operator == "=" ){
								operator = "==";
							}
							
							switch(operator){
							case "*=":
								matches = fieldStr.search(valStr) >= 0;
								break;
							case "$=":
								matches = new RegExp(valStr + "$").exec(fieldStr) != null;
								break;
							case "^=":
								matches = new RegExp("^" + valStr).exec(fieldStr) != null;
								break;
							default:
								// if we're doing a case insensitive comparison, then we're using a STRING comparison
								// even if we're comparing numbers
								if( caseInsensitive ){
									// eval with lower case strings
									var expr = "fieldStr " + operator + " valStr";
									matches = eval(expr);
								} else {
									// just eval as normal
									var expr = params.fieldRef(field) + " " + operator + " " + value;
									matches = eval(expr);
								}
								
							}
						} else if( operator != null ){
							switch(operator){
							case "?":
								matches = params.fieldTruthy(field);
								break;
							case "!":
								matches = !params.fieldTruthy(field);
								break;
							case "^":
								matches = params.fieldUndefined(field);
								break;
							}
						} else { 	
							matches = !params.fieldUndefined(field);
						}
						
						if( !matches ){
							allDataMatches = false;
							break;
						}
					} // for
					
					return allDataMatches;
				} // operandsMatch
				
				// check data matches
				var allDataMatches = operandsMatch({
					name: "data",
					fieldValue: function(field){
						return element._private.data[field];
					},
					fieldRef: function(field){
						return "element._private.data." + field;
					},
					fieldUndefined: function(field){
						return element._private.data[field] === undefined;
					},
					fieldTruthy: function(field){
						if( element._private.data[field] ){
							return true;
						}
						return false;
					}
				});
				
				if( !allDataMatches ){
					continue;
				}
				
				// check metadata matches
				var allMetaMatches = operandsMatch({
					name: "meta",
					fieldValue: function(field){
						return element[field]();
					},
					fieldRef: function(field){
						return "element." + field + "()";
					},
					fieldUndefined: function(field){
						return element[field]() == undefined;
					},
					fieldTruthy: function(field){
						if( element[field]() ){
							return true;
						}
						return false;
					}
				});
				
				if( !allMetaMatches ){
					continue;
				}
				
				// check collection
				if( query.collection != null ){
					var matchesAny = false;
					
					for(var k = 0; k < query.collection.size(); k++){								
						if( query.collection.eq(k).same(element) ){
							matchesAny = true;
							break;
						}
					}
					
					if( !matchesAny ){
						continue;
					}
				}
				
				// check filter function
				if( query.filter != null && element.collection().filter( query.filter ).size() == 0 ){
					continue;
				}
				
				// we've reached the end, so we've matched everything for this query
				return true;
			}
			
			return false;
		};
		
		if( self._private.selectorText == null ){
			selectorFunction = function(){ return true; };
		}
		
		var filteredCollection = collection.filter(selectorFunction);
		
		if(addLiveFunction){
			
			var key = self.selector();
			var structs = self.cy()._private; // TODO remove ref to `structs` after refactoring
			
			filteredCollection.live = function(events, data, callback){
				
				var evts = events.split(/\s+/);
				$.each(evts, function(i, event){
				
					if( event == "" ){
						return;
					}
					
					if( callback === undefined ){
						callback = data;
						data = undefined;
					}
					
					if( structs.live[event] == null ){
						structs.live[event] = {};
					}
					
					if( structs.live[event][key] == null ){
						structs.live[event][key] = [];
					}
					
					structs.live[event][key].push({
						callback: callback,
						data: data
					});
					
				});						
				
				return this;
			};
			
			filteredCollection.die = function(event, callback){
				if( event == null ){
					$.each(structs.live, function(event){
						if( structs.live[event] != null ){
							delete structs.live[event][key];
						}
					});
				} else {
					var evts = event.split(/\s+/);
					
					$.each(evts, function(j, event){
						if( callback == null ){
							if( structs.live[event] != null ){
								delete structs.live[event][key];
							}
						} else if( structs.live[event] != null && structs.live[event][key] != null ) {
							for(var i = 0; i < structs.live[event][key].length; i++){
								if( structs.live[event][key][i].callback == callback ){
									structs.live[event][key].splice(i, 1);
									i--;
								}
							}
						}
					});
					
				}
				
				return this;
			};
		}
		
		return filteredCollection;
	};
	
	// ith query to string
	CySelector.prototype.selector = function(){
		
		var str = "";
		
		function clean(obj){
			if( is.string(obj) ){
				return obj;
			} 
			return "";
		}
		
		for(var i = 0; i < this.length; i++){
			var query = this[i];
			
			var group = clean(query.group);
			str += group.substring(0, group.length - 1);
			
			for(var j = 0; j < query.data.length; j++){
				var data = query.data[j];
				str += "[" + data.field + clean(data.operator) + clean(data.value) + "]"
			}
			
			for(var j = 0; j < query.colonSelectors.length; j++){
				var sel = query.colonSelectors[i];
				str += sel;
			}
			
			for(var j = 0; j < query.ids.length; j++){
				var sel = "#" + query.ids[i];
				str += sel;
			}
			
			for(var j = 0; j < query.classes.length; j++){
				var sel = "." + query.classes[i];
				str += sel;
			}
			
			if( this.length > 1 && i < this.length - 1 ){
				str += ", ";
			}
		}
		
		return str;
	};
	
})(jQuery);