/* global window, document, loadCy, $, _gaq, showCy, hideCy, cy */

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

  // setTimeout(function(){
  //   cytoscape.defaults( window.options );
  // }, 100);

  // fix for webkit
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

    // force navigation to rerender, because some browsers (looking at you, chrome)
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

      var bb = $('#cy').getBoundingClientRect();
      var scrollDelta = bb.bottom - window.innerHeight;

      var text = $pre.innerText;

      if( scrollDelta > 0 ){
        window.scroll(0, window.scrollY + scrollDelta);
      }

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
              css: css
            })

            .delay(delay, function() {
              ret.removeCss();
            })

            .animate({
              css: css
            })

            .delay(delay, function() {
              ret.removeCss();
            })

            .animate({
              css: css
            })

            .delay(delay, function() {
              ret.removeCss();
            });
        }
      }, 500);
    });
  });

  $('#download-button').addEventListener('click', function() {
    if (_gaq) {
      _gaq.push(['_trackEvent', 'Actions', 'Download']);
    }
  });

})();
