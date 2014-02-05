$v(function(jQuery, $, version){
	
	defaultModule("Statistics");
	
	test("ele.degree() et al", function(){
		var n2 = cy.$("#n2");

		equal( cy.$("#n1n2").degree(), undefined, "degree undefined for edges" );
		
		equal( n2.degree(), 2, "n2 degree" );
		
		equal( n2.indegree(), 1, "n2 indegree" );
		equal( n2.outdegree(), 1, "n2 outdegree" );
		
		equal( cy.nodes().minDegree(), 1, "minDegree" );
		equal( cy.nodes().maxDegree(), 2, "maxDegree" );

		equal( cy.nodes().minIndegree(), 0, "minIndegree" );
		equal( cy.nodes().maxIndegree(), 1, "maxIndegree" );

		equal( cy.nodes().minOutdegree(), 0, "minOutdegree" );
		equal( cy.nodes().maxOutdegree(), 1, "maxOutdegree" );

		equal( cy.nodes().totalDegree(), 4, "totalDegree" );
	});
	
});