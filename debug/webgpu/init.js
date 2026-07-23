/* eslint-disable no-console, no-unused-vars */
/* global $, cytoscapeGpu, networks */

var cy;

const paramDefs = {
  network: {
    default: 'em-web',
    control: '#network-select'
  },
  gen: {
    default: '10000x30000',
    control: '#gen-input'
  },
  bgcolor: {
    default: 'white',
    control: '#bg-color-select'
  },
  edgeWidthFloor: {
    default: '1',
    control: '#edge-floor-input'
  },
  nodeLodPx: {
    default: '3',
    control: '#node-lod-input'
  },
  hidePx: {
    default: '1',
    control: '#hide-px-input'
  },
  edgeDimming: {
    default: 'false',
    control: '#edge-dim-check'
  },
  labels: {
    default: 'false',
    control: '#labels-check'
  },
  labelMinPx: {
    default: '0',
    control: '#label-min-input'
  }
};

(function(){

  const params = {};
  const urlParams = new URLSearchParams(window.location.search);

  for(const p of Object.keys(paramDefs)) {
    params[p] = urlParams.get(p) || paramDefs[p].default;
  }

  console.log('params', params);
  $('#cytoscape').style.backgroundColor = params.bgcolor;

  // -- fixture conversion (v3 JSON -> gpu prototype scope) --

  const SUPPORTED_PROPS = new Set([
    'background-color', 'width', 'height', 'shape', 'opacity',
    'border-color', 'border-width', 'line-color',
    'label', 'font-size', 'color'
  ]);
  const SUPPORTED_SHAPES = new Set([
    'ellipse', 'circle', 'rectangle', 'round-rectangle', 'roundrectangle'
  ]);
  const SUPPORTED_SELECTOR = /^(\*|node|edge|#[^\s:#,[\]]+)?(:(selected|unselected))*$/;

  // keep only constant values of in-scope props on in-scope selectors
  function sanitizeStyle(blocks) {
    const out = [];

    for(const block of blocks || []) {
      const selector = (block.selector || '').trim();

      if(!SUPPORTED_SELECTOR.test(selector) || selector === '') { continue; }

      const style = {};

      for(const [prop, value] of Object.entries(block.style || block.css || {})) {
        if(!SUPPORTED_PROPS.has(prop)) { continue; }
        if(typeof value === 'string' && /(mapData|data)\s*\(/.test(value) && value !== 'data(id)') { continue; } // no mappers (except data(id))
        if(prop === 'shape' && !SUPPORTED_SHAPES.has(value)) { continue; }

        style[prop] = value;
      }

      if(Object.keys(style).length > 0) {
        out.push({ selector, style });
      }
    }

    return out;
  }

  function toGpuElements(elements) {
    const list = Array.isArray(elements)
      ? elements
      : [ ...(elements.nodes || []), ...(elements.edges || []) ];

    const nodes = [];
    const edges = [];

    for(const ele of list) {
      const data = ele.data || {};

      if(data.source != null && data.target != null) {
        edges.push({ data: {
          id: data.id != null ? String(data.id) : undefined,
          source: String(data.source),
          target: String(data.target)
        } });
      } else {
        nodes.push({
          data: { id: data.id != null ? String(data.id) : undefined },
          position: ele.position
        });
      }
    }

    return { nodes, edges, hasPositions: nodes.some(n => n.position != null) };
  }

  function generateNetwork(spec) {
    const match = /^(\d+)x(\d+)$/.exec(spec) || [null, '10000', '30000'];
    const n = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const side = Math.ceil(Math.sqrt(n)) * 50;
    const nodes = [];
    const edges = [];

    for(let i = 0; i < n; i++) {
      nodes.push({
        data: { id: 'n' + i },
        position: { x: Math.random() * side, y: Math.random() * side }
      });
    }

    for(let j = 0; j < m; j++) {
      edges.push({ data: {
        id: 'e' + j,
        source: 'n' + Math.floor(Math.random() * n),
        target: 'n' + Math.floor(Math.random() * n)
      } });
    }

    const style = [
      { selector: 'node', style: { 'width': 12, 'height': 12, 'background-color': '#4a7dbd' } },
      { selector: 'edge', style: { 'width': 1, 'line-color': '#bbb', 'opacity': 0.6 } }
    ];

    return { nodes, edges, hasPositions: true, style };
  }

  // -- loading --

  function loadNetwork(gpuElements, style) {
    console.time('cytoscapeGpu init');

    if(params.labels === 'true') {
      style = (style || []).concat([
        { selector: 'node', style: { 'label': 'data(id)', 'font-size': 10, 'color': '#333' } }
      ]);
    }

    cy = cytoscapeGpu({
      container: $('#cytoscape'),
      elements: { nodes: gpuElements.nodes, edges: gpuElements.edges },
      style: style,
      layout: gpuElements.hasPositions ? undefined : { name: 'grid' },
      renderer: {
        edgeWidthFloor: parseFloat(params.edgeWidthFloor),
        nodeLodPx: parseFloat(params.nodeLodPx),
        hidePx: parseFloat(params.hidePx),
        edgeDimming: params.edgeDimming === 'true',
        labelMinPx: parseFloat(params.labelMinPx)
      }
    });

    console.timeEnd('cytoscapeGpu init');
    window.cy = cy;

    cy.ready.then(() => {
      console.log('webgpu ready');
      cy.fit(undefined, 30);
    }).catch(err => {
      console.error(err);
      $('#stats').textContent = String(err);
    });

    cy.on('error', (e, message) => {
      console.error('gpu error', message);
      $('#stats').textContent = 'GPU error: ' + message;
    });

    cy.on('pan zoom', () => {
      const { x, y } = cy.pan();

      $('#pan').innerHTML = `Pan: x: ${x.toFixed(2)}, y: ${y.toFixed(2)}`;
      $('#zoom').innerHTML = `Zoom: ${cy.zoom().toFixed(4)}`;
    });

    cy.on('mouseover', e => console.log('mouseover', e.target.id()));
    cy.on('select', e => console.log('select', e.target.id()));

    startStats();
  }

  // -- stats overlay: fps, counts, dirty-upload bytes, pick latency --

  function startStats() {
    let lastFrames = 0;
    let lastBytes = 0;
    let lastTime = performance.now();

    setInterval(() => {
      const renderer = cy && cy._renderer;

      if(renderer == null) { return; }

      const stats = renderer.stats();
      const now = performance.now();
      const dt = (now - lastTime) / 1000;
      const fps = (stats.frames - lastFrames) / dt;
      const kbps = (stats.uploadedBytes - lastBytes) / dt / 1024;

      lastFrames = stats.frames;
      lastBytes = stats.uploadedBytes;
      lastTime = now;

      const gpuMs = stats.gpuFrameMs > 0 ? `${stats.gpuFrameMs.toFixed(1)} ms GPU` : 'GPU n/a';

      $('#stats').textContent =
        `${stats.nodes} nodes, ${stats.edges} edges, ${stats.glyphs} glyphs\n` +
        `${fps.toFixed(0)} fps (rendered), ${stats.cpuFrameMs.toFixed(2)} ms CPU / ${gpuMs} per frame\n` +
        `${kbps.toFixed(1)} KiB/s uploaded (${(stats.uploadedBytes / 1024 / 1024).toFixed(1)} MiB total)\n` +
        `pick latency ${stats.pickLatencyMs.toFixed(1)} ms`;
    }, 500);
  }

  const network = networks[params.network] || networks[paramDefs.network.default];

  if(network.generated) {
    const generated = generateNetwork(params.gen);

    loadNetwork(generated, generated.style);
  } else if(network.styleUrl) {
    Promise.all([
      fetch(network.url).then(res => res.json()),
      fetch(network.styleUrl).then(res => res.json())
    ]).then(([networkJson, styleJson]) => {
      loadNetwork(toGpuElements(networkJson.elements), sanitizeStyle(styleJson.style));
    });
  } else {
    fetch(network.url)
      .then(res => res.json())
      .then(networkJson => {
        loadNetwork(toGpuElements(networkJson.elements), sanitizeStyle(networkJson.style));
      });
  }

  // -- controls --

  for(const [networkID, def] of Object.entries(networks)) {
    const option = document.createElement('option');

    option.value = networkID;
    option.innerHTML = `${def.desc} (${def.nodes} nodes, ${def.edges} edges)`;
    $('#network-select').appendChild(option);
  }

  for(const p of Object.keys(paramDefs)) {
    const control = $(paramDefs[p].control);

    if(control.type === 'checkbox') {
      control.checked = params[p] === 'true';
      control.addEventListener('click', () => reloadPage());
    } else {
      control.value = params[p];
      control.addEventListener('change', () => reloadPage());
    }
  }

  function reloadPage(reset = false) {
    const { origin, pathname } = window.location;

    if(reset) {
      window.location.href = origin + pathname;

      return;
    }

    const nextParams = new URLSearchParams();

    for(const p of Object.keys(paramDefs)) {
      const control = $(paramDefs[p].control);
      const value = control.type === 'checkbox' ? control.checked : control.value;

      if(String(value) !== String(paramDefs[p].default)) {
        nextParams.set(p, value);
      }
    }

    window.location.href = origin + pathname + '?' + nextParams.toString();
  }

  $('#hide-commands').addEventListener('click', () => {
    document.body.classList.add('commands-hidden');
  });

  $('#show-commands').addEventListener('click', () => {
    document.body.classList.remove('commands-hidden');
  });

  $('#fit-button').addEventListener('click', () => cy.fit(undefined, 30));
  $('#reset-button').addEventListener('click', () => reloadPage(true));

})();
