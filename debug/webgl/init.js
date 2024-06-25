/* eslint-disable no-console, no-unused-vars */
/* global $, cytoscape, options, cy, networks, styles */

var cy;

var params = {};

(function(){

  const urlParams = new URLSearchParams(window.location.search);
  params.networkID = urlParams.get('networkID') || networks.def;
  params.webgl  = urlParams.get('webgl') || false;

  const network = networks[params.networkID];
  const style = styles[params.networkID];


  function load(elements, style) {
    console.log('style', style);
    options = {
      container: $('#cytoscape'),
  
      renderer: {
        name: 'canvas',
        showFps: true,
        webgl: params.webgl,
      },

      style: style,
      elements: elements,
      layout: network.layout
    };
    options.layout.animate = false;
    cy = cytoscape(options);
  }

  if(style.file) {
    console.log('loading style from file: ', style.file);
    Promise.all([
      fetch(network.file).then(res => res.json()),
      fetch(style.file).then(res => res.json())
    ]).then(([networkJson, styleJson]) => {
      load(networkJson.elements, styleJson.style);
    });
  } else {
    fetch(network.file)
    .then(res => res.json())
    .then(networkJson => {
      const style = styles[params.networkID];
      load(networkJson.elements, style);
    });
  }

})();
