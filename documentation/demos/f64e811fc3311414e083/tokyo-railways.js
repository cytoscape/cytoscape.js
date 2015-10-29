/*
This demo visualises the railway stations in Tokyo (東京) as a graph.

This demo gives examples of

- loading elements via ajax
- loading style via ajax
- using the preset layout with predefined positions in each element
- using motion blur for smoother viewport experience
- using `min-zoomed-font-size` to show labels only when needed for better performance
*/

$(function(){
  
  // get exported json from cytoscape desktop via ajax
  var graphP = $.ajax({
    url: 'https://cdn.rawgit.com/maxkfranz/934042c1ecc464a8de85/raw', // tokyo-railways.json
    type: 'GET',
    dataType: 'json'
  });
  
  // also get style via ajax
  var styleP = $.ajax({
    url: 'https://cdn.rawgit.com/maxkfranz/2c23fe9a23d0cc8d43af/raw', // tokyo-railways-style.cycss
    type: 'GET',
    dataType: 'text'
  });
  
  // when both graph export json and style loaded, init cy
  Promise.all([ graphP, styleP ]).then(initCy);
  
  function initCy( then ){
    var loading = document.getElementById('loading');
    var expJson = then[0];
    var styleJson = then[1];
    var elements = expJson.elements;
    
    loading.classList.add('loaded');
    
    var cy = window.cy = cytoscape({
      container: document.getElementById('cy'),
      layout: { name: 'preset' },
      style: styleJson,
      elements: elements,
      motionBlur: true,
      selectionType: 'single',
      boxSelectionEnabled: false
    });

    mendData();
    bindRouters();
  }

  function mendData(){
    // because the source data doesn't connect nodes properly, use the cytoscape api to mend it:

    cy.startBatch();

    // put nodes in bins based on name
    var nodes = cy.nodes();
    var bin = {};
    var metanames = [];
    for( var i = 0; i < nodes.length; i++ ){
      var node = nodes[i];
      var name = node.data('station_name');
      var nbin = bin[ name ] = bin[ name ] || [];

      nbin.push( node );
      
      if( nbin.length === 2 ){
        metanames.push( name );
      }
    }

    // connect all nodes together with walking edges
    for( var i = 0; i < metanames.length; i++ ){
      var name = metanames[i];
      var nbin = bin[ name ];

      for( var j = 0; j < nbin.length; j++ ){
        for( var k = j + 1; k < nbin.length; k++ ){
          var nj = nbin[j];
          var nk = nbin[k];
          
          cy.add({
            group: 'edges',
            data: {
              source: nj.id(),
              target: nk.id(),
              is_walking: true
            }
          });
          
          //.css({
        //    'line-color': 'yellow'
          // });
        }
      }

    }

    cy.endBatch(); //.autolock( true );
  }

  var start, end;
  var $body = $('body');

  function selectStart( node ){
    clear();

    $body.addClass('has-start');

    start = node;

    start.addClass('start');
  }

  function selectEnd( node ){
    $body.addClass('has-end calc');

    end = node;

    cy.startBatch();

    end.addClass('end');

    setTimeout(function(){
      var aStar = cy.elements().aStar({
        root: start,
        goal: end,
        weight: function( e ){
          if( e.data('is_walking') ){
            return 0.25; // assume very little time to walk inside stn
          }
          
          return e.data('is_bullet') ? 1 : 3; // assume bullet is ~3x faster
        }
      });

      if( !aStar.found ){
        $body.removeClass('calc');
        clear();

        cy.endBatch();
        return;
      }

      cy.elements().not( aStar.path ).addClass('not-path');
      aStar.path.addClass('path');

      cy.endBatch();

      $body.removeClass('calc');
    }, 300);
  }

  function clear(){
    $body.removeClass('has-start has-end');
    cy.elements().removeClass('path not-path start end');
  }

  function bindRouters(){
    
    var $clear = $('#clear');

    cy.nodes().qtip({
      content: {
        text: function(){
          var $ctr = $('<div class="select-buttons"></div>');
          var $start = $('<button id="start">START</button>');
          var $end = $('<button id="end">END</button>');
          
          $start.on('click', function(){
            var n = cy.$('node:selected');

            selectStart( n );

            n.qtip('api').hide();
          });

          $end.on('click', function(){
            var n = cy.$('node:selected');

            selectEnd( n );

            n.qtip('api').hide();
          });
          
          $ctr.append( $start ).append( $end );
          
          return $ctr;
        }
      },
      show: {
        solo: true
      },
      position: {
        my: 'top center',
        at: 'bottom center',
        adjust: {
          method: 'flip'
        }
      },
      style: {
        classes: 'qtip-bootstrap',
        tip: {
          width: 16,
          height: 8
        }
      }
    });

    $clear.on('click', clear);
  }
});
