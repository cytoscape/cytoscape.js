$v(function(jQuery, $, version){
	
	defaultModule("Comparitors");
	
	test("eles.same() et al", function(){
		var n1 = cy.nodes("#n1");
		var n2 = cy.nodes("#n2");
		var n3 = cy.nodes("#n3");
		
		ok(n1.same(n1), "n1 is same as self");
		ok(!n1.same(n2), "n2 is not same as n1");
		ok(n1.add(n2).anySame(n1), "(n1, n2) is anySame to n1");
		ok(!n1.add(n2).anySame(n3), "(n1, n2) is not anySame to n3");
		ok(n1.add(n2).same(n2.add(n1)), "(n1, n2) same as (n2, n1)");
		ok(!n1.add(n2).same(n2.add(n3)), "(n1, n2) not same as (n2, n3)");
	});
	
	test("eles.is() et al", function(){
		var n1 = cy.nodes("#n1");
		var n2 = cy.nodes("#n2");
		var n3 = cy.nodes("#n3");
		var n1n2 = cy.edges("#n1n2");
		
		ok(n1.is("#n1"), "n1 is self by id");
		ok(n1.is("node"), "n1 is a node");
		ok(n1.is("[foo = 'one']"), "n1 contains data");
		ok(!n1.is("edge"), "n1 is not an edge");
		
		ok(n1.is(function(){
			return true;
		}), "a dummy filter function works");
		
		ok(n1.is(function(){
			return this.data("id") == "n1";
		}), "n1 is n1 by id via a filter function");
		
		ok(n1.add(n2).allAre("node"), "n1, n2 are both nodes");
		ok(n1n2.add(n1).is("node"), "(n1n2, n1) at least one is node");
		ok(n1.add(n3).allAreNeighbors(n2), "(n1, n3) allAreNeighbors of n2");
	});
	
});