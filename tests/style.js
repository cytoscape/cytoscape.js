$v(function(jQuery, $, version){
	
	defaultModule("Style");
	
	asyncTest("Bypass", function(){
		var n1 = cy.nodes("#n1");
		
		n1.one("bypass", function(){
			deepEqual( this.bypass(), {
				foo: 1
			}, "bypass has foo" );
		});
		n1.bypass({
			foo: 1
		});
		
		n1.one("bypass", function(){
			deepEqual( this.bypass(), {
				foo: 1,
				bar: 2
			}, "bypass has foo & bar" );
		});
		n1.bypass({
			bar: 2
		});
		
		n1.one("bypass", function(){
			deepEqual( this.bypass(), {
				bar: 2
			}, "bypass has bar" );
		});
		n1.removeBypass("foo");
		
		n1.one("bypass", function(){
			deepEqual( this.bypass(), {
			}, "bypass is empty" );
			
			start();
		});
		n1.removeBypass("bar");
	});
	
});