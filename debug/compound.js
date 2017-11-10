/* global cy, loadCompoundGraph, $ */

var loadCompoundGraph = function(){
  cy.elements().remove();

  cy.add({
     nodes: [{ data: { id: 'n8', parent: 'n4' } },
       { data: { id: 'n9', parent: 'n4' } },
       { data: { id: 'n4', parent: 'n1' } },
       { data: { id: 'n5', parent: 'n1', shape: 'triangle' } },
       { data: { id: 'n1' } },
         { data: { id: 'n2' } },
         { data: { id: 'node-really-long-name-6', parent: 'n2' } },
         { data: { id: 'n7', parent: 'n2', shape: 'square' } },
       { data: { id: 'n3', parent: 'non-auto', shape: 'rectangle' } },
       { data: { id: 'non-auto'}}],
     edges: [ { data: { id: 'e1', source: 'n1', target: 'n3' } },
         { data: { id: 'e2', source: 'n3', target: 'n7' } },
         { data: { id: 'e3', source: 'node-really-long-name-6', target: 'n7' } },
         { data: { id: 'e4', source: 'node-really-long-name-6', target: 'n9' } },
         { data: { id: 'e5', source: 'n8', target: 'n9' } },
         { data: { id: 'e6', source: 'n5', target: 'n8' } },
         { data: { id: 'e7', source: 'n2', target: 'n4' } },
         { data: { id: 'e8', source: 'n8', target: 'n8' } },
         { data: { id: 'e9', source: 'n1', target: 'n1' } },
         { data: { id: 'e10', source: 'n1', target: 'n9' } },
         { data: { id: 'e11', source: 'n4', target: 'n1' } }
      ]
  });

  cy.layout({ name: 'grid', cols: 3 }).run();
};

$('#load-compound').addEventListener('click', loadCompoundGraph);
