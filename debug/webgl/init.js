/* eslint-disable no-console, no-unused-vars */
/* global $, cytoscape, options, cy, networks */

var cy;

const paramDefs = {
  networkID: {
    default: 'style_test',
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
  hover: {
    default: 'false',
    control: '#hover-check'
  },
  // webglDebugShowAtlases: {
  //   default: false,
  //   control: '#atlas-checkbox'
  // },
  webglTexSize: {
    default: 2048,
    control: '#texture-size-select'
  },
  webglTexRows: {
    default: 24,
    control: '#texture-rows-select'
  },
  webglBatchSize: {
    default: 2048,
    control: '#batch-size-select'
  },
  webglTexPerBatch: {
    default: 14,
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
    const options = {
      container: $('#cytoscape'),
      renderer: {
        name: 'canvas',
        showFps: true,
        webgl: params.webgl === 'true',
        webglDebug: true,
        webglDebugShowAtlases: params.webglDebugShowAtlases === 'true',
        webglTexSize: params.webglTexSize,
        webglTexRows: params.webglTexRows,
        webglBatchSize: params.webglBatchSize,
        webglTexPerBatch: params.webglTexPerBatch,
        webglUseBasis: true,
        webglBasisJsURL:   'http://localhost:8000/src/extensions/renderer/canvas/webgl/basis/basis_encoder.js',
        webglBasisWasmURL: 'http://localhost:8000/src/extensions/renderer/canvas/webgl/basis/basis_encoder.wasm'
      },
      style: style,
      elements: elements,
      layout: network.layout
    };
    options.layout.animate = false;
    cy = cytoscape(options);

    if(params.hover === 'true') { // add hover effect
      cy.ready(() => {
        const hoverMapping = {
          selector: `.hover`,
          style: {
            'underlay-color': 'lightblue',
            'underlay-padding': 12,
            'underlay-opacity': 0.7,
            'underlay-shape': 'roundrectangle',
          },
        };

        cy.style().fromJson(cy.style().json().concat(hoverMapping)).update();

        let lastHoveredElementID;

        cy.on('mouseover', 'node, edge', e => {
          const ele = e.target;
          ele.addClass('hover');
          lastHoveredElementID = ele.data('id');
        });
        cy.on('mouseout', 'node, edge', e => {
          const lastEle = cy.getElementById(lastHoveredElementID);
          if(lastEle !== undefined) {
            lastEle.removeClass('hover');
          }
          lastHoveredElementID = undefined;
        });
      });
    }
  }

  const network = networks[params.networkID];
  const style = network.style;

  if(style && style.file) {
    // style is in a separate file
    console.log('loading style from file: ', style.file);
    Promise.all([
      fetch(network.url).then(res => res.json()),
      fetch(style.file).then(res => res.json())
    ]).then(([networkJson, styleJson]) => {
      loadNetwork(networkJson.elements, styleJson.style);
    });
  } else {
    // style is in the same file as the network
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
      console.log(p);
      const control = $(paramDefs[p].control);
      const value = control.type == 'checkbox' ? control.checked : control.value;
      console.log(paramDefs[p], value, paramDefs[p].default);
      if(String(value) !== String(paramDefs[p].default)) {
        urlParams.set(p, value);
      }
    }
    
    window.location.href = origin + pathname + '?' + urlParams.toString();
  }

  $('#hide-commands').addEventListener('click', () => {
    document.body.classList.remove('commands-shown');
    document.body.classList.add('commands-hidden');
    if(cy) {
      cy.resize();
    }
  });

  $('#show-commands').addEventListener('click', () => {
    document.body.classList.add('commands-shown');
    document.body.classList.remove('commands-hidden');
		if(cy) {
		  cy.resize();
    }
  });
  
  $("#fit-button").addEventListener('click', () => cy.fit());
  $("#reset-button").addEventListener('click', () => reloadPage(true));

  $("#webgl-report").addEventListener('click', () => {
    function findWebGLContext() {
      const canvases = document.querySelectorAll('canvas');
      for (let canvas of canvases) {
        const gl = canvas.getContext('webgl2');
        if (gl) {
          return gl;
        }
      }
      return null;
    }

    const gl = findWebGLContext();
    const ext = gl.getExtension('GMAN_webgl_memory');
    if (ext) {
      console.log("WebGL Report");
      // memory info
      const info = ext.getMemoryInfo();
      // every texture, it's size, a stack of where it was created and a stack of where it was last updated.
      const textures = ext.getResourcesInfo(WebGLTexture);
      // every buffer, it's size, a stack of where it was created and a stack of where it was last updated.
      const buffers = ext.getResourcesInfo(WebGLBuffer);

      console.log('memory info', info);
      console.log('textures', textures);
      console.log('buffers', buffers);
    }
  });

  $("#gc-button").addEventListener('click', () => {
    cy.gc();
  });

  $("#save-atlas-button").addEventListener('click', () => {
    cy.webglCommand('png_save');
  });


  // $("#delete-button").addEventListener('click', () => {
  //   cy.remove(':selected');
  // });

  // $("#animate-button").addEventListener('click', () => {
  //   const nodes = cy.nodes(':selected');
  //   nodes.forEach(n => {
  //     const w = n.width();
  //     n.animate({
  //       style: { 'width': w + 100 }
  //     }, {
  //       duration: 1000
  //     })
  //     .delay(1000)
  //     .animate({
  //       style: { 'width': w }
  //     }, {
  //       duration: 1000
  //     });
  //   });
  // });

  // $("#select-button").addEventListener('click', () => {
  //   cy.nodes().select();
  // });

})();
