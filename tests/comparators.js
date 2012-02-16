$(function(){
	
	defaultModule("Comparators");
	
	test("Same", function(){
		var n1 = cy.nodes("#n1");
		var n2 = cy.nodes("#n2");
		var n3 = cy.nodes("#n3");
		
		ok(n1.same(n1), "n1 is same as self");
		ok(!n1.same(n2), "n2 is not same as n1");
		ok(n1.add(n2).anySame(n1), "(n1, n2) is anySame to n1");
		ok(!n1.add(n2).anySame(n3), "(n1, n2) is not anySame to n3");
		ok(n1.add(n2).allSame(n2.add(n1)), "(n1, n2) allSame as (n2, n1)");
		ok(!n1.add(n2).allSame(n2.add(n3)), "(n1, n2) not allSame as (n2, n3)");
	});
	
});