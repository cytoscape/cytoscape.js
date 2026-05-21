/* global $, cy,  */

(function(){
  var idCounter = 0;

  function makeId(){
    return 'ele' + ( ++idCounter );
  }

  function number(group){
    var input = $('#' + group + '-number');
    var val = parseInt( input.value );

    if( isNaN(val) ){
      return 0;
    }

    return val;
  }

  function time(callback){
    var start = new Date();
    callback();
    var end = new Date();

    $('#add-remove-time').innerHTML = ( (end - start) + ' ms' );
  }

  $('#add-elements-button').addEventListener('click', function(){
    var n = number('nodes');
    var e = number('edges');
    var width = cy.width();
    var height = cy.height();

    var nodes = [];
    for(var i = 0; i < n; i++){
      nodes.push({
        group: 'nodes',
        data: { id: makeId(), weight: Math.round( Math.random() * 100 ) },
        position: { x: Math.random() * width, y: Math.random() * height }
      });
    }

    function randNodeId(){
      var pool = nodes.length ? nodes : cy.nodes().toArray();

      if( pool.length === 0 ){
        return null;
      }

      return pool[ Math.floor(Math.random() * pool.length) ].data.id;
    }

    var edges = [];
    for(var i = 0; i < e; i++){
      var source = randNodeId();
      var target = randNodeId();

      if( source == null || target == null ){
        continue;
      }

      edges.push({
        group: 'edges',
        data: {
          id: makeId(),
          weight: Math.round( Math.random() * 100 ),
          source: source,
          target: target
        }
      });
    }

    var eles = {
      nodes: nodes,
      edges: edges
    };

    time(function(){
      cy.add( eles );
    });
  });

  $('#remove-selected-button').addEventListener('click', function(){
    var eles = cy.elements(':selected');

    time(function(){
      eles.remove();
    });
  });
})();
