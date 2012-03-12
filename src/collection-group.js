	
	CyElement.prototype.isNode = function(){
		return this._private.group == "nodes";
	};
	
	CyElement.prototype.isEdge = function(){
		return this._private.group == "edges";
	};
	
	CyElement.prototype.group = function(){
		return this._private.group;
	};