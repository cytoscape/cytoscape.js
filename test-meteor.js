'use strict';

Tinytest.add('Cytoscape.init', function(test){
  test.ok(cytoscape({ headless: true }) != null, 'nonnull');
});

Tinytest.add('Cytoscape.eles', function(test){
  test.ok(cytoscape({ headless: true }).elements().length === 0, 'gets empty eles collection');
});