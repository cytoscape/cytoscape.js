// this is put as a global var in the browser
// or it's just a global to this module if commonjs
var cytoscape;

(function(){

	// make the jQuery plugin grab what we define init to be later
	cytoscape = function(){
		return cytoscape.init.apply(cytoscape, arguments);
	};
	
	// define the function namespace here, since it has members in many places
	cytoscape.fn = {};

	// TODO test that this works:
	if( typeof exports !== 'undefined' ){ // expose as a commonjs module
		exports = module.exports = cytoscape;
	}
	
})();
