;(function($, $$){

	/**
	 * Represents an edge sprite that contains the information about both
	 * hands of an edge using references for source and target nodes.
	 * 
	 * The function other makes it possible to get the other side of the
	 * edge given one of source or target node.
	 *  
	 * This prototype is based on Flare's flare.vis.data.EdgeSprite
	 */
	
	EdgeSprite = function( id, source, target, data) {
		this.id = id; // id of this edge sprite
		this.source = source; // reference to the source node sprite
		this.target = target; // reference to the target node sprite
		this.data = typeof(data) !== 'undefined' ? data : {};
		// data of this edge sprite, it is the original edge element
	}
	
	/**
	 * other - returns the other end of the edge given one hand
	 * n - node sprite on one side of this edge sprite
	 */
	EdgeSprite.prototype.other = function(n) {
		if (n.id == this.source.id) return this.target;
		if (n.id == this.target.id) return this.source;
		else return null;	
	}	

})(jQuery, jQuery.cytoscapeweb);
