
/* cytoscape.layout.null.js */

/**
 * This file is part of cytoscape.js 2.0.2.
 * 
 * Cytoscape.js is free software: you can redistribute it and/or modify it
 * under the terms of the GNU Lesser General Public License as published by the Free
 * Software Foundation, either version 3 of the License, or (at your option) any
 * later version.
 * 
 * Cytoscape.js is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU Lesser General Public License for more
 * details.
 * 
 * You should have received a copy of the GNU Lesser General Public License along with
 * cytoscape.js. If not, see <http://www.gnu.org/licenses/>.
 */
 
;(function($$){

	// default layout options
	var defaults = {
		ready: function(){},
		stop: function(){}
	};

	// constructor
	// options : object containing layout options
	function NullLayout( options ){
		this.options = $$.util.extend(true, {}, defaults, options); 
	}

	// runs the layout
	NullLayout.prototype.run = function(){
		var options = this.options;
		var cy = options.cy; // cy is automatically populated for us in the constructor

		// puts all nodes at (0, 0)
		cy.nodes().positions(function(){
			return {
				x: 0,
				y: 0
			};
		});

		// trigger layoutready when each node has had its position set at least once
		cy.one("layoutready", options.ready);
		cy.trigger("layoutready");

		// trigger layoutstop when the layout stops (e.g. finishes)
		cy.one("layoutstop", options.stop);
		cy.trigger("layoutstop");
	};

	// called on continuous layouts to stop them before they finish
	NullLayout.prototype.stop = function(){
		var options = this.options;

		cy.one("layoutstop", options.stop);
		cy.trigger("layoutstop");
	};

	// register the layout
	$$("layout", "null", NullLayout);

})(cytoscape);