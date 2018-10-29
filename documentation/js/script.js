/* global window, document, loadCy, _gaq, showCy, hideCy, cy, cytoscape */

var cy;

var loadCy = function(){

// initialise cytoscape.js on a html dom element with some options:
cy = cytoscape( options = {
  container: document.getElementById('cy'),

  minZoom: 0.5,
  maxZoom: 2,

  // style can be specified as plain JSON, a stylesheet string (probably a CSS-like
  // file pulled from the server), or in a functional format
  style: [
    {
      selector: 'node',
      style: {
        'content': 'data(name)',
        'font-family': 'helvetica',
        'font-size': 14,
        'text-outline-width': 3,
        'text-outline-color': '#999',
        'text-valign': 'center',
        'color': '#fff',
        'width': 'mapData(weight, 30, 80, 20, 50)',
        'height': 'mapData(height, 0, 200, 10, 45)',
        'border-color': '#fff'
      }
    },

    {
      selector: ':selected',
      style: {
        'background-color': '#000',
        'line-color': '#000',
        'target-arrow-color': '#000',
        'text-outline-color': '#000'
      }
    },

    {
      selector: 'edge',
      style: {
        'width': 2,
        'curve-style': 'bezier',
        'target-arrow-shape': 'triangle'
      }
    },

    {
      selector: '.foo',
      style: {
        'border-width': 4,
        'border-color': 'red'
      }
    }
  ],

  // specify the elements in the graph
  elements: [
      { data: { id: 'j', name: 'Jerry', weight: 65, height: 174 } },
      { data: { id: 'e', name: 'Elaine', weight: 48, height: 160 } },
      { data: { id: 'k', name: 'Kramer', weight: 75, height: 185 } },
      { data: { id: 'g', name: 'George', weight: 70, height: 150 } },

      { data: { source: 'j', target: 'e', id: 'je', closeness: 0.85 } },
      { data: { source: 'j', target: 'k', id: 'jk', closeness: 0.5 } },
      { data: { source: 'j', target: 'g', id: 'jg', closeness: 0.7 } },

      { data: { source: 'e', target: 'j', id: 'ej', closeness: 0.9 } },
      { data: { source: 'e', target: 'k', id: 'ek', closeness: 0.6 } },

      { data: { source: 'k', target: 'j', id: 'kj', closeness: 0.9 } },
      { data: { source: 'k', target: 'e', id: 'ke', closeness: 0.9 } },
      { data: { source: 'k', target: 'g', id: 'kg', closeness: 0.9 } },

      { data: { source: 'g', target: 'j', id: 'gj', closeness: 0.8 } }
  ]
} );

};

loadCy();

(function(){
  var $$ = function( sel ){
    var els = document.querySelectorAll(sel);
    var ret = [];

    for( var i = 0; i < els.length; i++ ){
      ret.push( els[i] );
    }

    return ret;
  };

  var $ = function( sel ){
    return document.querySelector( sel );
  };

  var show = function( $e ){
    if( $e.length != null ){
      $e.forEach( show );
    } else {
      $e.style.display = '';
    }
  };

  var hide = function( $e ){
    if( $e.length != null ){
      $e.forEach( hide );
    } else {
      $e.style.display = 'none';
    }
  };

  // fix for old safari/chrome
  ('wheel mousewheel DOMMouseScroll MozMousePixelScroll scroll').split(' ').forEach(function( evt ){
    $('#navigation').addEventListener(evt, function(e) {
      e.stopPropagation();
    });
  });

  $('#open-navigation').addEventListener('click', function() {
    $('body').classList.add('navigation-open');
  });

  $('#open-navigation-bg, #navigation a').addEventListener('click', function() {
    $('body').classList.remove('navigation-open');
  });

  var $nav = $('#navigation');

  // avoid weird rendering bug in chrome etc
  $('#navigation a').addEventListener('click', function() {
    var scroll = $('#navigation').scrollTop;

    // force navigation to rerender, because some browsers (like old chrome)
    // don't render properly after clicking one of the links
    setTimeout(function() {
      $nav.scrollTop = (scroll + 10);
      $nav.scrollTop = (scroll - 10);
      $nav.scrollTop = (scroll);
    }, 0);
  });

  function debounce(fn, delay) {
    var timeout;

    return function() {
      var context = this;
      var args = arguments;

      clearTimeout(timeout);
      timeout = setTimeout(function() {
        timeout = null;

        fn.apply(context, args);
      }, delay);
    };
  }

  var $toclinks = $$('.section > .toclink');
  var $tocinput = $('#toc-input');
  var $tocsections = $('#toc-sections');
  var lastTxt;
  var txt;

  var nodes = [];
  var roots = [];
  var leaves = [];
  var prev = {};

  $toclinks.forEach(function( $ele ){
    var $section = $ele.parentNode;
    var lvl = $section.classList.contains('lvl1') ? 1 : $section.classList.contains('lvl2') ? 2 : 3;
    var parent;

    var node = {
      lvl: lvl,
      $ele: $ele,
      text: $ele.innerText.toLowerCase(),
      children: [],
      parent: null
    };

    if( lvl === 1 ){
      roots.push( node );
    } else {
      parent = prev[ lvl - 1 ];
      parent.children.push( node );
      node.parent = parent;
    }

    nodes.push( node );

    prev[ lvl ] = node;
  });

  nodes.forEach(function(n){
    if( n.children.length === 0 ){
      leaves.push(n);
    }
  });

  var traverseDown = function( nodes, visit ){
    nodes.forEach(function( node ){
      visit( node );

      traverseDown( node.children, visit );
    });
  };

  var traverseUp = function( nodes, visit ){
    nodes.forEach(function( node ){
      visit( node );

      if( node.parent ){
        traverseUp( [node.parent], visit );
      }
    });
  };

  var filterSections = debounce(function() {
    txt = $tocinput.value.toLowerCase();

    nodes.forEach(function(n){
      n.matches = n.descMatches = n.ancMatches = false;

      n.matches = n.text.indexOf( txt ) >= 0;
    });

    traverseDown(roots, function(node){
      if( node.parent && (node.parent.matches || node.parent.ancMatches) ){
        node.ancMatches = true;
      }
    });

    traverseUp(leaves, function(node){
      if( node.children.some(function(n){ return n.matches || n.descMatches; }) ){
        node.descMatches = true;
      }
    });

    nodes.forEach(function(n){
      hide( n.$ele );
    });

    nodes.filter(function(n){
      return n.matches || n.ancMatches || n.descMatches;
    }).forEach(function(n){
      show( n.$ele );
    });

    $tocsections.classList.remove('toc-sections-searching');
  }, 250);

  var onChangeSearch = function(){
    txt = $tocinput.value.toLowerCase();

    if (txt === lastTxt) {
      return;
    }
    lastTxt = txt;

    $tocsections.classList.add('toc-sections-searching');

    filterSections();
  };

  ('keydown keyup keypress change').split(' ').forEach(function( evt ){
    $tocinput.addEventListener(evt, onChangeSearch);
  });

  $('#toc-clear').addEventListener('click', function() {
    $tocinput.value = '';

    onChangeSearch();
  });

  loadCy();

  $('#cy-refresh').addEventListener('click', function() {
    loadCy();

    $('#cy').setAttribute('style', ''); // because some example fiddles w/ this
  });

  window.showCy = function($ele) {
    $$('#cy, #cy-hide, #cy-refresh, #cy-label').forEach(function($e){
      $e.classList.remove('hidden');
    });

    $('#cy-show').classList.add('hidden');

    if ($ele) {
      var $etc = $('#cy-etc');

      $etc.classList.remove('hidden');
      $etc.parentNode.removeChild( $etc );

      $ele.insertAdjacentElement('afterend', $etc);
    }

    cy.resize();
  };

  window.hideCy = function() {
    $$('#cy, #cy-hide, #cy-refresh, #cy-label, #cy-etc').forEach(function($e){
      $e.classList.add('hidden');
    });

    $('#cy-show').classList.remove('hidden');
  };

  $('#cy-hide').addEventListener('click', function() {
    hideCy();
  });

  $('#cy-show').addEventListener('click', function() {
    showCy();
  });

  $$('.run.run-inline-code').forEach(function($e){
    $e.addEventListener('click', function() {
      var $run = $e;
      var $pre = $e.previousElementSibling;

      showCy($run);

      var text = $pre.innerText;

      setTimeout(function(){
        var ret = eval(text);

        var isEles = function(o) {
          return o != null && o.isNode != null;
        };

        if (isEles(ret) && ret.length > 0) {

          var css = {
            'text-outline-color': '#4183C4',
            'background-color': '#4183C4',
            'line-color': '#4183C4',
            'target-arrow-color': '#4183C4',
            'source-arrow-color': '#4183C4'
          };

          var delay = 200;

          ret
            .stop(true)

            .animate({
              style: css
            })

            .delay(delay, function() {
              ret.removeCss();
            })

            .animate({
              style: css
            })

            .delay(delay, function() {
              ret.removeCss();
            })

            .animate({
              style: css
            })

            .delay(delay, function() {
              ret.removeCss();
            });
        }
      }, 500);
    });
  });

})();
