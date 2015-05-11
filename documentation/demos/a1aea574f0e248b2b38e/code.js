// a very simple example of angular/cytoscape.js integration

// context (rightclick/2finger) drag to resize in graph
// use text boxes to resize in angular

var app = angular.module('app', []);

// use a factory instead of a directive, because cy.js is not just for visualisation; you need access to the graph model and events etc 
app.factory('peopleGraph', [ '$q', function( $q ){
  var cy;
  var peopleGraph = function(people){
    var deferred = $q.defer();
    
    // put people model in cy.js
    var eles = [];
    for( var i = 0; i < people.length; i++ ){
      eles.push({
        group: 'nodes',
        data: {
          id: people[i].id,
          weight: people[i].weight,
          name: people[i].name
        }
      });
    }
    
    $(function(){ // on dom ready
      
      cy = cytoscape({
        container: $('#cy')[0],
        
        style: cytoscape.stylesheet()
          .selector('node')
            .css({
              'content': 'data(name)',
              'height': 80,
              'width': 'mapData(weight, 1, 200, 1, 200)',
               'text-valign': 'center',
                'color': 'white',
                'text-outline-width': 2,
                'text-outline-color': '#888'
             })
          .selector('edge')
            .css({
              'target-arrow-shape': 'triangle'
            })
          .selector(':selected')
            .css({
              'background-color': 'black',
              'line-color': 'black',
              'target-arrow-color': 'black',
              'source-arrow-color': 'black',
              'text-outline-color': 'black'
          }),

        layout: {
          name: 'cose',
          padding: 10
        },
        
        elements: eles,

        ready: function(){
          deferred.resolve( this );
          
          cy.on('cxtdrag', 'node', function(e){
            var node = this;
            var dy = Math.abs( e.cyPosition.x - node.position().x );
            var weight = Math.round( dy*2 );
            
            node.data('weight', weight);
            
            fire('onWeightChange', [ node.id(), node.data('weight') ]);
          });
        }
      });

    }); // on dom ready
    
    return deferred.promise;
  };
  
  peopleGraph.listeners = {};
  
  function fire(e, args){
    var listeners = peopleGraph.listeners[e];
    
    for( var i = 0; listeners && i < listeners.length; i++ ){
      var fn = listeners[i];
      
      fn.apply( fn, args );
    }
  }
  
  function listen(e, fn){
    var listeners = peopleGraph.listeners[e] = peopleGraph.listeners[e] || [];
    
    listeners.push(fn);
  }
  
  peopleGraph.setPersonWeight = function(id, weight){
    cy.$('#' + id).data('weight', weight);
  };
  
  peopleGraph.onWeightChange = function(fn){
    listen('onWeightChange', fn);
  };
  
  return peopleGraph;
  
  
} ]);

app.controller('PeopleCtrl', [ '$scope', 'peopleGraph', function( $scope, peopleGraph ){
  var cy; // maybe you want a ref to cy
  // (usually better to have the srv as intermediary)
  
  $scope.people = [
    { id: 'l', name: 'Laurel', weight: 65 },
    { id: 'h', name: 'Hardy', weight: 110 }
  ];
  
  var peopleById = {};
  for( var i = 0; i < $scope.people.length; i++ ){
    var p = $scope.people[i];
    
    peopleById[ p.id ] = p;
  }
  
  // you would probably want some ui to prevent use of PeopleCtrl until cy is loaded
  peopleGraph( $scope.people ).then(function( peopleCy ){
    cy = peopleCy;
    
    // use this variable to hide ui until cy loaded if you want
    $scope.cyLoaded = true;
  });
  
  $scope.onWeightChange = function(person){
     peopleGraph.setPersonWeight( person.id, person.weight );
  };
  
  peopleGraph.onWeightChange(function(id, weight){
    peopleById[id].weight = weight;
    
    $scope.$apply();
  });
 
} ]);