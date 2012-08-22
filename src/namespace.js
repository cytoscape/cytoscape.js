// this is put as a global var in the browser
// or it's just a global to this module if commonjs
var cytoscape;

(function(){

	// the object iteself is a function that init's an instance of cytoscape
	cytoscape = function(){
		return cytoscape.init.apply(cytoscape, arguments);
	};
	
	// define the function namespace here, since it has members in many places
	cytoscape.fn = {};

	// TODO test that this works:
	// if( typeof exports !== 'undefined' ){ // expose as a commonjs module
	// 	exports = module.exports = cytoscape;
	// }
	
})();
