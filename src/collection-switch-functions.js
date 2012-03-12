function switchFunction(params){
		return function(fn){
			if( $$.is.fn(fn) ){
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
	
	CyElement.prototype.selected = function(){
		return this._private.selected;
	};
	
	CyElement.prototype.select = switchFunction({ event: "select", field: "selected", value: true });
	
	CyElement.prototype.unselect = switchFunction({ event: "unselect", field: "selected", value: false });
	
	

	
	CyElement.prototype.grabbed = function(){
		return this._private.grabbed;
	};