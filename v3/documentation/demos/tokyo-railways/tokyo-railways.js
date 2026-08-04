/*
This demo visualises the railway stations in Tokyo (東京) as a graph.

This demo gives examples of

- loading elements via http request
- loading style via http request
- using the preset layout with predefined positions in each element
- using motion blur for smoother viewport experience
- using `min-zoomed-font-size` to show labels only when needed for better performance
*/

/* global document, fetch, window, cy, cytoscape, Promise, tippy */

document.addEventListener('DOMContentLoaded', function(){

  var $ = function(sel){ return document.querySelector(sel); };

  // hyperscript-like function
  var h = function(tag, attrs, children){
    var el = document.createElement(tag);

    if(attrs != null && typeof attrs === typeof {}){
      Object.keys(attrs).forEach(function(key){
        var val = attrs[key];

        el.setAttribute(key, val);
      });
    } else if(typeof attrs === typeof []){
      children = attrs;
    }

    if(children != null && typeof children === typeof []){
      children.forEach(function(child){
        el.appendChild(child);
      });
    } else if(children != null && typeof children === typeof ''){
      el.appendChild(document.createTextNode(children));
    }

    return el;
  };

  var toJson = function(obj){ return obj.json(); };
  var toText = function(obj){ return obj.text(); };

  // get exported json from cytoscape desktop
  var graphP = fetch('tokyo-railways.json').then(toJson);

  // also get style
  var styleP = fetch('tokyo-railways.cycss').then(toText);

  // when both graph export json and style loaded, init cy
  Promise.all([ graphP, styleP ]).then(initCy);

  function initCy( then ){
    var loading = document.getElementById('loading');
    var expJson = then[0];
    var styleJson = then[1];
    var elements = expJson.elements;

    loading.classList.add('loaded');

    window.cy = cytoscape({
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
  var $body = document.body;

  function selectStart( node ){
    clear();

    $body.classList.add('has-start');

    start = node;

    start.addClass('start');
  }

  function selectEnd( node ){
    $body.classList.add('has-end', 'calc');

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
        $body.classList.remove('calc');
        clear();

        cy.endBatch();
        return;
      }

      cy.elements().not( aStar.path ).addClass('not-path');
      aStar.path.addClass('path');

      cy.endBatch();

      $body.classList.remove('calc');
    }, 300);
  }

  function clear(){
    $body.classList.remove('has-start', 'has-end');
    cy.elements().removeClass('path not-path start end');
  }

  var shownTippy;

  function makeTippy(node, html){
    removeTippy();

    shownTippy = tippy( node.popperRef(), {
      html: html,
      trigger: 'manual',
      arrow: true,
      placement: 'bottom',
      hideOnClick: false,
      duration: [250, 0],
      theme: 'light',
      interactive: true,
      onHidden: function(tip){
        if(tip != null){
          tip.destroy();
        }
      }
    } ).tooltips[0];

    shownTippy.show();

    return shownTippy;
  }

  function removeTippy(){
    if(shownTippy){
      shownTippy.hide();
    }
  }

  function bindRouters(){

    var $clear = $('#clear');

    cy.on('tap pan zoom', function(e){
      if(e.target === cy){
        removeTippy();
      }
    });

    cy.on('tap', 'node', function(e){
      var node = e.target;

      var start = h('button', { id: 'start' }, 'START');

      start.addEventListener('click', function(){
        var n = cy.$('node:selected');

        selectStart( n );

        removeTippy();
      });

      var end = h('button', { id: 'end', }, 'END');

      end.addEventListener('click', function(){
        var n = cy.$('node:selected');

        selectEnd( n );

        removeTippy();
      });

      var html = h('div', { className: 'select-buttons' }, [ start, end]);

      makeTippy(node, html);
    });

    /*
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
    */

    $clear.addEventListener('click', clear);
  }
});
