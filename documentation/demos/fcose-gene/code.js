/* global Promise, fetch, window, cytoscape, document, tippy, _ */

Promise.all([
  fetch('cy-style.json')
    .then(function(res) {
      return res.json();
    }),
  fetch('data.json')
    .then(function(res) {
      return res.json();
    })
])
  .then(function(dataArray) {
    var h = function(tag, attrs, children){
      var el = document.createElement(tag);

      Object.keys(attrs).forEach(function(key){
        var val = attrs[key];

        el.setAttribute(key, val);
      });

      children.forEach(function(child){
        el.appendChild(child);
      });

      return el;
    };

    var t = function(text){
      var el = document.createTextNode(text);

      return el;
    };

    var $ = document.querySelector.bind(document);

    var cy = window.cy = cytoscape({
      container: document.getElementById('cy'),
      style: dataArray[0],
      elements: dataArray[1],
      layout: { name: 'grid' } // fixed, non-equal positions ensure deterministic fcose results
    });

    // values modified by sliders
    var nodeRepulsionVal = 4500;
    var idealEdgeLengthVal = 1;

    var params = {
      name: 'fcose',
      nodeRepulsion: n => nodeRepulsionVal,
      idealEdgeLength: e => idealEdgeLengthVal / e.data('weight'),
      animate: true,
      randomize: false
    };
    var layout = makeLayout({ animate: false });

    layout.run();

    var $btnParam = h('div', {
      'class': 'param'
    }, []);

    var $config = $('#config');

    $config.appendChild( $btnParam );

    var sliders = [
      {
        label: 'Edge length',
        update: sliderVal => idealEdgeLengthVal = sliderVal,
        initVal: idealEdgeLengthVal,
        min: 1,
        max: 5,
        step: 0.1
      },

      {
        label: 'Node repulsion',
        update: sliderVal => nodeRepulsionVal = sliderVal,
        initVal: nodeRepulsionVal,
        min: 4500,
        max: 1000000,
        step: 1
      }
    ];

    var buttons = [
      {
        label: h('span', { 'class': 'fa fa-random' }, []),
        layoutOpts: {
          randomize: true,
          animate: true
        }
      },

      {
        label: h('span', { 'class': 'fa fa-play' }, []),
        layoutOpts: {
          randomize: false,
          animate: true
        }
      }
    ];

    sliders.forEach( makeSlider );

    buttons.forEach( makeButton );

    function makeLayout( opts ){
      params.randomize = (opts || {}).randomize || false;

      for( var i in opts ){
        params[i] = opts[i];
      }

      return cy.layout( Object.assign({}, params) );
    }

    function makeSlider( opts ){
      var $input = h('input', {
        id: 'slider-'+opts.param,
        type: 'range',
        min: opts.min,
        max: opts.max,
        step: opts.step,
        value: opts.initVal,
        'class': 'slider'
      }, []);

      var $param = h('div', { 'class': 'param' }, []);

      var $label = h('label', { 'class': 'label label-default', for: 'slider-'+opts.param }, [ t(opts.label) ]);

      $param.appendChild( $label );
      $param.appendChild( $input );

      $config.appendChild( $param );

      var update = _.throttle(function(){
        opts.update(parseFloat($input.value));

        layout.stop();
        layout = makeLayout({ animate: true });
        layout.run();
      }, 1000/4, { trailing: true });

      $input.addEventListener('input', update);
      $input.addEventListener('change', update);
    }

    function makeButton( opts ){
      var $button = h('button', { 'class': 'btn btn-default' }, [ opts.label ]);

      $btnParam.appendChild( $button );

      $button.addEventListener('click', function(){
        layout.stop();

        layout = makeLayout( opts.layoutOpts );
        layout.run();
      });
    }

    var makeTippy = function(node, html){
      return tippy( node.popperRef(), {
        html: html,
        trigger: 'manual',
        arrow: true,
        placement: 'bottom',
        hideOnClick: false,
        interactive: true
      } ).tooltips[0];
    };

    var hideTippy = function(node){
      var tippy = node.data('tippy');

      if(tippy != null){
        tippy.hide();
      }
    };

    var hideAllTippies = function(){
      cy.nodes().forEach(hideTippy);
    };

    cy.on('tap', function(e){
      if(e.target === cy){
        hideAllTippies();
      }
    });

    cy.on('tap', 'edge', function(e){
      hideAllTippies();
    });

    cy.on('zoom pan', function(e){
      hideAllTippies();
    });

    cy.nodes().forEach(function(n){
      var g = n.data('name');

      var $links = [
        {
          name: 'GeneCard',
          url: 'http://www.genecards.org/cgi-bin/carddisp.pl?gene=' + g
        },
        {
          name: 'UniProt search',
          url: 'http://www.uniprot.org/uniprot/?query='+ g +'&fil=organism%3A%22Homo+sapiens+%28Human%29+%5B9606%5D%22&sort=score'
        },
        {
          name: 'GeneMANIA',
          url: 'http://genemania.org/search/human/' + g
        }
      ].map(function( link ){
        return h('a', { target: '_blank', href: link.url, 'class': 'tip-link' }, [ t(link.name) ]);
      });

      var tippy = makeTippy(n, h('div', {}, $links));

      n.data('tippy', tippy);

      n.on('click', function(e){
        tippy.show();

        cy.nodes().not(n).forEach(hideTippy);
      });
    });

    $('#config-toggle').addEventListener('click', function(){
      $('body').classList.toggle('config-closed');

      cy.resize();
    });

  });
