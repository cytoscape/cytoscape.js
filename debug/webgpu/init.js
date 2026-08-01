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
  arrows: {
    default: 'false',
    control: '#arrows-check'
  },
  labels: {
    default: 'false',
    control: '#labels-check'
  },
  columnar: {
    default: 'false',
    control: '#columnar-check'
  },
  binary: {
    default: 'false',
    control: '#binary-check'
  },
  labelMinPx: {
    default: '0',
    control: '#label-min-input'
  },
  renderScaleMin: {
    default: '0.5',
    control: '#render-scale-min-input'
  },
  renderScaleMax: {
    default: '1',
    control: '#render-scale-max-input'
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
    'label', 'font-size', 'color',
    'source-arrow-shape', 'source-arrow-color', 'target-arrow-shape', 'target-arrow-color'
  ]);
  const SUPPORTED_ARROW_SHAPES = new Set([ 'none', 'triangle' ]);
  const SUPPORTED_SHAPES = new Set([
    'ellipse', 'circle', 'rectangle', 'round-rectangle', 'roundrectangle'
  ]);
  // best-effort conversion of a v3 block stylesheet into the v4 sheet
  // ({ nodes, edges }): constant values of in-scope props on plain group
  // selectors fold into the group's props (later blocks win, as in v3
  // document order); #id/:selected/class blocks are dropped — v4 styles
  // per element via fn styles, which a fixture stylesheet can't express
  function sanitizeStyle(blocks) {
    const sheet = {};

    const mergeInto = (groupKey, style) => {
      sheet[groupKey] = Object.assign(sheet[groupKey] || {}, style);
    };

    for(const block of blocks || []) {
      const selector = (block.selector || '').trim();

      if(selector !== 'node' && selector !== 'edge' && selector !== '*') { continue; }

      const style = {};

      for(const [prop, value] of Object.entries(block.style || block.css || {})) {
        if(!SUPPORTED_PROPS.has(prop)) { continue; }
        // data(key) label mappers are supported now; other mappers are not
        if(typeof value === 'string' && /mapData\s*\(/.test(value)) { continue; }
        if(typeof value === 'string' && /data\s*\(/.test(value) && !(prop === 'label' && /^\s*data\s*\(\s*[\w-]+\s*\)\s*$/.test(value))) { continue; }
        if(prop === 'shape' && !SUPPORTED_SHAPES.has(value)) { continue; }
        if(/-arrow-shape$/.test(prop) && !SUPPORTED_ARROW_SHAPES.has(value)) { continue; }

        style[prop] = value;
      }

      if(Object.keys(style).length === 0) { continue; }

      if(selector === 'node' || selector === '*') { mergeInto('nodes', style); }
      if(selector === 'edge' || selector === '*') { mergeInto('edges', style); }
    }

    return sheet;
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
          ...data, // sidecar data() keys flow through
          id: data.id != null ? String(data.id) : undefined,
          source: String(data.source),
          target: String(data.target)
        } });
      } else {
        nodes.push({
          data: { ...data, id: data.id != null ? String(data.id) : undefined },
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

    const style = {
      nodes: { 'width': 12, 'height': 12, 'background-color': '#4a7dbd' },
      edges: { 'width': 1, 'line-color': '#bbb', 'opacity': 0.6 }
    };

    return { nodes, edges, hasPositions: true, style };
  }

  // round 14: clustered compound generator — N leaves under ~N/20
  // parents (every 4th parent nested under the previous one), leaves
  // blobbed per cluster, mostly intra-cluster edges plus a sprinkle of
  // child->parent edges to exercise the compound loops
  function generateCompoundNetwork(spec) {
    const match = /^(\d+)x(\d+)$/.exec(spec) || [null, '10000', '20000'];
    const n = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const clusterSize = 20;
    const clusters = Math.max(1, Math.floor(n / clusterSize));
    const side = Math.ceil(Math.sqrt(clusters)) * 400;
    const nodes = [];
    const edges = [];

    for(let c = 0; c < clusters; c++) {
      const nested = c % 4 === 3; // every 4th parent nests under its predecessor
      const parentDef = { data: { id: 'p' + c } };

      if(nested) { parentDef.data.parent = 'p' + (c - 1); }

      nodes.push(parentDef);
    }

    const cx = i => (i % Math.ceil(Math.sqrt(clusters))) * 400;
    const cyy = i => Math.floor(i / Math.ceil(Math.sqrt(clusters))) * 400;

    for(let i = 0; i < n; i++) {
      const c = i % clusters;

      nodes.push({
        data: { id: 'n' + i, parent: 'p' + c },
        position: {
          x: cx(c) + Math.random() * 220,
          y: cyy(c) + Math.random() * 220
        }
      });
    }

    for(let j = 0; j < m; j++) {
      if(j % 50 === 49) { // a sprinkle of child->parent edges (compound loops)
        const i = Math.floor(Math.random() * n);

        edges.push({ data: { id: 'e' + j, source: 'n' + i, target: 'p' + (i % clusters) } });
        continue;
      }

      const c = Math.floor(Math.random() * clusters);
      const perCluster = Math.floor(n / clusters);
      // leaves of cluster c are the ids i with i % clusters === c
      const pick = () => c + Math.min(perCluster - 1, Math.floor(Math.random() * perCluster)) * clusters;
      const intra = j % 5 !== 0; // 4 in 5 edges stay inside a cluster

      edges.push({ data: {
        id: 'e' + j,
        source: 'n' + (intra ? pick() : Math.floor(Math.random() * n)),
        target: 'n' + (intra ? pick() : Math.floor(Math.random() * n))
      } });
    }

    const style = {
      nodes: { 'width': 12, 'height': 12, 'background-color': '#4a7dbd' },
      parents: { 'padding': 14 },
      edges: { 'width': 1, 'line-color': '#bbb', 'opacity': 0.6 }
    };

    return { nodes, edges, hasPositions: true, style };
  }

  // -- loading --

  function loadNetwork(gpuElements, style) {
    console.time('cytoscapeGpu init');

    style = style || {};

    if(params.labels === 'true') {
      style = { ...style, nodes: { ...style.nodes, 'label': 'data(id)', 'font-size': 10, 'color': '#333' } };
    }

    if(params.arrows === 'true') {
      style = { ...style, edges: { ...style.edges, 'target-arrow-shape': 'triangle', 'target-arrow-color': '#666' } };
    }

    let elements = { nodes: gpuElements.nodes, edges: gpuElements.edges };

    if(params.columnar === 'true') {
      console.time('toColumnarElements');
      elements = cytoscapeGpu.toColumnarElements(elements);
      console.timeEnd('toColumnarElements');
    }

    if(params.binary === 'true') {
      console.time('serializeElements');
      elements = cytoscapeGpu.serializeElements(elements);
      console.timeEnd('serializeElements');
      console.log('serialized elements: ' + (elements.byteLength / 1048576).toFixed(1) + ' MB');
    }

    // the extension-contract worked example (round 17.5/17.6): a spiral
    // layout as a plain class — no registry, passed straight to
    // cy.layout({ impl }).  Try it with ?layout=spiral
    class SpiralLayout {
      run(ctx) {
        const slots = ctx.nodeSlots();
        const xy = [];
        const step = Number(ctx.options.spiralStep || 14);

        for(let i = 0; i < slots.length; i++) {
          const t = Math.sqrt(i) * 0.9;

          xy.push(Math.cos(t * 2 * Math.PI) * t * step, Math.sin(t * 2 * Math.PI) * t * step);
        }

        ctx.setPositions(slots, xy);
        cy.fit(undefined, 30);
      }
    }

    cy = cytoscapeGpu({
      container: $('#cytoscape'),
      elements: elements,
      style: style,
      layout: gpuElements.hasPositions ? undefined : { name: 'grid' },
      renderer: {
        edgeWidthFloor: parseFloat(params.edgeWidthFloor),
        nodeLodPx: parseFloat(params.nodeLodPx),
        hidePx: parseFloat(params.hidePx),
        edgeDimming: params.edgeDimming === 'true',
        labelMinPx: parseFloat(params.labelMinPx),
        renderScaleMin: parseFloat(params.renderScaleMin),
        renderScaleMax: parseFloat(params.renderScaleMax)
      }
    });

    console.timeEnd('cytoscapeGpu init');
    window.cy = cy;
    window.SpiralLayout = SpiralLayout;

    if(urlParams.get('layout') === 'spiral') {
      cy.ready.then(() => cy.layout({ impl: SpiralLayout }).run());
    }

    // the round-18 force layout, live: ?layout=force (add &seed=N to vary)
    if(urlParams.get('layout') === 'force') {
      cy.ready.then(() => {
        console.time('force layout');
        cy.layout({
          name: 'force',
          animate: true,
          seed: parseInt(urlParams.get('seed') || '1', 10)
        }).run().promise().then(() => console.timeEnd('force layout'));
      });
    }


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
        `${fps.toFixed(0)} fps (rendered), ${stats.cpuFrameMs.toFixed(2)} ms CPU / ${gpuMs} per frame, scale ${stats.renderScale}\n` +
        `${kbps.toFixed(1)} KiB/s uploaded (${(stats.uploadedBytes / 1024 / 1024).toFixed(1)} MiB total)\n` +
        `pick latency ${stats.pickLatencyMs.toFixed(1)} ms`;
    }, 500);
  }

  const network = networks[params.network] || networks[paramDefs.network.default];

  if(network.generated) {
    const generated = network.generated === 'compound'
      ? generateCompoundNetwork(params.gen)
      : generateNetwork(params.gen);

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
