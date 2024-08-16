/* eslint-disable no-console, no-unused-vars */
/* global $, cytoscape, options, cy, networks, styles */

var cy;

const paramDefs = {
  networkID: {
    default: 'em-web',
    control: '#network-select'
  },
  bgcolor: {
    default: 'white',
    control: '#bg-color-select'
  },
  webgl: {
    default: 'true',
    control: '#webgl-check'
  },
  webglTexSize: {
    default: 4096,
    control: '#texture-size-select'
  },
  webglTexRows: {
    default: 24,
    control: '#texture-rows-select'
  },
  webglBatchSize: {
    default: 1024,
    control: '#batch-size-select'
  },
  webglTexPerBatch: {
    default: 12,
    control: '#texture-units-select'
  },
};



(function(){

  const params = {};

  // Load URL params
  const urlParams = new URLSearchParams(window.location.search);
  for(const p of Object.keys(paramDefs)) {
    const def = paramDefs[p];
    params[p] = urlParams.get(p) || def.default;
  }

  console.log('params', params);
  $('#cytoscape').style.backgroundColor = params.bgcolor;

  // Load network and style
  function loadNetwork(elements, style) {
    options = {
      container: $('#cytoscape'),
  
      renderer: {
        name: 'canvas',
        showFps: true,
        webgl: params.webgl === 'true',
        webglDebug: true,
        webglTexSize: params.webglTexSize,
        webglTexRows: params.webglTexRows,
        webglBatchSize: params.webglBatchSize,
        webglTexPerBatch: params.webglTexPerBatch
      },

      style: style,
      elements: elements,
      layout: network.layout
    };
    options.layout.animate = false;
    cy = cytoscape(options);
  }

  const network = networks[params.networkID];
  const style = styles[params.networkID];

  if(style && style.file) {
    console.log('loading style from file: ', style.file);
    Promise.all([
      fetch(network.url).then(res => res.json()),
      fetch(style.file).then(res => res.json())
    ]).then(([networkJson, styleJson]) => {
      loadNetwork(networkJson.elements, styleJson.style);
    });
  } else {
    fetch(network.url)
    .then(res => res.json())
    .then(networkJson => {
      loadNetwork(networkJson.elements, networkJson.style);
    });
  }

  // Initialize controls
  for(const [networkID, network] of Object.entries(networks)) {
    const option = document.createElement('option');
    option.value = networkID;
    option.innerHTML = `${network.desc} (${network.nodes} nodes, ${network.edges} edges)`;
    $("#network-select").appendChild(option);
  }

  for(const p of Object.keys(paramDefs)) {
    const control = $(paramDefs[p].control);
    if(control.type == 'checkbox') {
      control.checked = params[p] === 'true';
      control.addEventListener('click', () => reloadPage());
    } else {
      control.value = params[p];
      control.addEventListener('change', () => reloadPage());
    }
  }

  
  // Add listeners to controls
  function reloadPage(reset = false) {
    const { origin, pathname } = window.location;
    if(reset) {
      window.location.href = origin + pathname;
      return;
    }

    const urlParams = new URLSearchParams();
    for(const p of Object.keys(paramDefs)) {
      const control = $(paramDefs[p].control);
      const value = control.type == 'checkbox' ? control.checked : control.value;
      urlParams.set(p, value);
    }

    window.location.href = origin + pathname + '?' + urlParams.toString();
  }
  
  $("#fit-button").addEventListener('click', () => cy.fit());
  $("#reset-button").addEventListener('click', () => reloadPage(true));

  $("#delete-button").addEventListener('click', () => {
    cy.remove(':selected');
  });

  $("#select-button").addEventListener('click', () => {
    cy.nodes().select();
  });

  $("#gc-button").addEventListener('click', () => {
    cy.gc();
  });

})();
