/* eslint-disable no-console, no-unused-vars */
/* global $, cytoscape, networks, styles, fixtures, loadError, layoutConfig, SpiralLayout */

var cy;

const paramDefs = {
  network: {
    default: 'em-web',
    control: '#network-select',
  },
  style: {
    default: 'production',
    control: '#style-select',
  },
  gen: {
    default: '10000x30000',
    control: '#gen-input',
  },
  bgcolor: {
    default: 'white',
    control: '#bg-color-select',
  },
  layout: {
    // `live` params keep their place in the URL (a control change used to wipe
    // ?layout and ?seed, because they were read outside paramDefs) but do not
    // reload the page — layout.js applies them to the running instance
    default: '',
    control: '#layout-select',
    live: true,
  },
  seed: {
    default: '1',
    control: '#seed-input',
    live: true,
  },
  animate: {
    // 87.4: the animate toggle is linkable state, forwarded to every
    // named layout (layout.js reads it on Apply; the ?layout load path
    // reads it below).  Since 114.5 it means the same thing on force as
    // everywhere else: a tween to the finished positions
    default: 'true',
    control: '#layout-animate-check',
    live: true,
  },
  live: {
    // 114.7: force's streaming run (animateLive) — the pre-114 animate
    default: 'false',
    control: '#layout-live-check',
    live: true,
  },
  edgeTypes: {
    // 114.7: re-apply the sheet with the curve style the layout reads
    // best with when a layout runs (layout-config.js has the table)
    default: 'true',
    control: '#layout-edge-types-check',
    live: true,
  },
  hover: {
    // 114.7: dim or hide everything outside the hovered neighbourhood
    default: 'none',
    control: '#hover-select',
    live: true,
  },
  avoidOverlap: {
    // 115: the layouts' avoidOverlap, forwarded to every named layout
    // that has one.  Off by default on this page (the maintainer's
    // call while the overlap rules settle): the library's own default
    // stays per layout
    default: 'false',
    control: '#layout-avoid-overlap-check',
    live: true,
  },
  overlapLabels: {
    // 115: nodeDimensionsIncludeLabels — space by label boxes too
    default: 'false',
    control: '#layout-overlap-labels-check',
    live: true,
  },
  spacing: {
    // 115.6: the slider's multiple of the layout's own spacingFactor
    // (v3's spacingFactor, on every layout that scales its result)
    default: '1',
    control: '#spacing-input',
    live: true,
  },
  edgeWidthFloor: {
    default: '1',
    control: '#edge-floor-input',
  },
  nodeLodPx: {
    default: '3',
    control: '#node-lod-input',
  },
  hidePx: {
    default: '1',
    control: '#hide-px-input',
  },
  edgeDimming: {
    default: 'false',
    control: '#edge-dim-check',
  },
  arrows: {
    default: 'false',
    control: '#arrows-check',
  },
  labels: {
    // round 43.6: on by default.  A production app draws labels, and the
    // fixtures all carry a good key for one now.
    default: 'true',
    control: '#labels-check',
  },
  columnar: {
    default: 'false',
    control: '#columnar-check',
  },
  binary: {
    default: 'false',
    control: '#binary-check',
  },
  progressive: {
    // round 103: load through cy.load() in this many chunks (0 = the
    // factory's one-shot load) — nodes first, then the edges, so the
    // first frame is the whole layout and the one fit is the final one
    default: '0',
    control: '#progressive-input',
  },
  labelMinPx: {
    default: '0',
    control: '#label-min-input',
  },
  declutter: {
    // round 104: the core label-declutter — 'cull' hides each node label
    // that would overlap a higher-priority one
    default: 'false',
    control: '#declutter-check',
  },
  labelPriority: {
    // round 104: what ranks the labels — 'none' (all equal), or 'degree'
    // (written into data before load, then mapped: the GeneMANIA shape,
    // importance from the graph); it also orders the zoom fade
    default: 'none',
    control: '#label-priority-select',
  },
  renderScaleMin: {
    default: '0.5',
    control: '#render-scale-min-input',
  },
  renderScaleMax: {
    default: '1',
    control: '#render-scale-max-input',
  },
};

(function () {
  const params = {};
  const urlParams = new URLSearchParams(window.location.search);

  for (const p of Object.keys(paramDefs)) {
    params[p] = urlParams.get(p) || paramDefs[p].default;
  }

  // Feature scenes share one route without expanding the network dropdown
  // into a separate entry for every view.  These are owned by the contextual
  // scene modules, so their controls can add them after cy is ready.
  for (const p of ['scene', 'view', 'rendererWorker', 'gallery']) {
    params[p] = urlParams.get(p) || '';
  }

  // Feature and workflow controls own their query keys so a reload restores
  // the same focused values.  Keep unknown keys in the shared params object
  // instead of silently dropping them at the harness boundary.
  for (const [key, value] of urlParams.entries()) {
    if (!Object.hasOwn(params, key)) {
      params[key] = value;
    }
  }

  console.log('params', params);
  window.debugParams = params;
  $('#cytoscape').style.backgroundColor = params.bgcolor;
  const statsElement = $('#stats');
  const statsHome = document.createComment(' renderer stats home ');
  statsElement.after(statsHome);

  // The control sections (view.js, layout.js, …) load after this file and need
  // the core, which only exists once the fixture has been fetched.  Anything
  // that must bind at creation time registers here; plain button handlers can
  // just read `window.cy` when they fire.
  const pending = [];

  window.onCy = (fn) => {
    if (cy != null) {
      fn(cy);
    } else {
      pending.push(fn);
    }
  };

  // Curated scene definitions already match the library's element schema.
  // Keep per-element state (collapsed/locked/etc.) intact; the fetched-file
  // converter is intentionally lossy for its own wire/legacy boundary.
  function sceneElements(elements) {
    const list = Array.isArray(elements)
      ? elements
      : (elements?.nodes || []).concat(elements?.edges || []);
    const nodes = Array.isArray(elements)
      ? list.filter(
          (element) =>
            element.data?.source == null || element.data?.target == null,
        )
      : elements?.nodes || [];
    const edges = Array.isArray(elements)
      ? list.filter(
          (element) =>
            element.data?.source != null && element.data?.target != null,
        )
      : elements?.edges || [];

    return {
      ...(Array.isArray(elements) ? {} : elements),
      nodes,
      edges,
      hasPositions:
        !Array.isArray(elements) && elements?.hasPositions != null
          ? elements.hasPositions
          : nodes.some((node) => node.position != null),
    };
  }

  function replaceContextRoute(updates) {
    const next = new URLSearchParams(window.location.search);

    for (const [key, value] of Object.entries(updates)) {
      if (value == null || value === '') {
        next.delete(key);
        params[key] = '';
      } else {
        next.set(key, String(value));
        params[key] = String(value);
      }
    }

    const query = next.toString();

    window.history.replaceState(
      null,
      '',
      window.location.pathname + (query ? `?${query}` : ''),
    );
  }

  // -- the status line --
  //
  // `showFatal` wins over the stats overlay for good.  It has to: the overlay
  // rewrites `#stats` every 500 ms, so before this the *most common* real
  // failure — `cy.ready` rejecting because no GPU adapter could be acquired —
  // wrote its message and had it erased within half a second.  What was left
  // was a blank canvas above a plausible-looking "569 nodes, 6899 edges,
  // 0 glyphs", with the actual error only in the console.
  let fatal = null;

  function showFatal(text) {
    fatal = text;
    $('#stats').textContent = text;
  }

  function showStats(text) {
    if (fatal == null) {
      $('#stats').textContent = text;
    }
  }

  // -- loading --

  function loadNetwork(gpuElements, networkID, def, scene) {
    console.time('cytoscape init');

    let style =
      scene?.style ?? styles.sheet(params.style, networkID, gpuElements, def);

    if (params.labels !== 'true') {
      // the checkbox is a plain on/off over whatever the sheet declares — it
      // no longer *replaces* the mapping with data(id), which is what made
      // "labels on" show UUIDs on em-web and SUIDs on the NDEx sets
      style = stripLabels(style);
    }

    if (params.declutter === 'true') {
      style = {
        ...style,
        core: { ...style.core, 'label-declutter': 'cull' },
      };
    }

    if (params.labelPriority === 'degree') {
      gpuElements = fixtures.withDegree(gpuElements);
      style = {
        ...style,
        nodes: {
          ...style.nodes,
          'label-priority': { data: '_degree', fallback: 0 },
        },
      };
    }

    if (params.arrows === 'true') {
      style = {
        ...style,
        edges: {
          ...style.edges,
          'target-arrow-shape': 'triangle',
          'target-arrow-color': '#666',
        },
      };
    }

    let elements = { nodes: gpuElements.nodes, edges: gpuElements.edges };

    if (params.columnar === 'true') {
      console.time('toColumnarElements');
      elements = cytoscape.toColumnarElements(elements);
      console.timeEnd('toColumnarElements');
    }

    if (params.binary === 'true') {
      console.time('serializeElements');
      elements = cytoscape.serializeElements(elements);
      console.timeEnd('serializeElements');
      console.log(
        'serialized elements: ' +
          (elements.byteLength / 1048576).toFixed(1) +
          ' MB',
      );
    }

    // round 103: progressive ingest — only for a positioned network, since
    // no layout may run while a load streams the graph in
    const chunks = Math.max(0, Math.floor(Number(params.progressive)) || 0);
    const progressive = chunks >= 2 && gpuElements.hasPositions;

    if (chunks >= 2 && !progressive) {
      console.log(
        'progressive load skipped: this network is laid out at load, and ' +
          'no layout may run while cy.load() streams the graph in',
      );
    }

    const sceneOptions = scene?.options || {};

    cy = cytoscape({
      ...sceneOptions,
      container: $('#cytoscape'),
      elements: progressive ? undefined : elements,
      style: style,
      // a network with no positions is laid out at load; `def.layout` lets one
      // say how (the compound fixture needs v3's `cols: 3` to be readable)
      layout: gpuElements.hasPositions
        ? undefined
        : def.layout || { name: 'grid' },
      renderer: {
        ...sceneOptions.renderer,
        edgeWidthFloor: parseFloat(params.edgeWidthFloor),
        nodeLodPx: parseFloat(params.nodeLodPx),
        hidePx: parseFloat(params.hidePx),
        edgeDimming: params.edgeDimming === 'true',
        labelMinPx: parseFloat(params.labelMinPx),
        renderScaleMin: parseFloat(params.renderScaleMin),
        renderScaleMax: parseFloat(params.renderScaleMax),
        worker: params.rendererWorker === 'true',
      },
    });

    const emphasizedIds = scene?.initialState?.emphasize;

    if (Array.isArray(emphasizedIds)) {
      let emphasized = cy.collection();

      for (const id of emphasizedIds) {
        const element = cy.$id(id);

        if (element.length > 0) {
          emphasized = emphasized.union(element);
        }
      }

      cy.emphasize(emphasized);
    }

    console.timeEnd('cytoscape init');

    // the load's completion (or, one-shot, readiness) gates what needs
    // the whole graph: the positions snapshot and a ?layout= run
    const loaded = progressive
      ? loadProgressively(cy, gpuElements, chunks)
      : cy.ready;

    window.cy = cy;
    window.currentStyle = style;
    // the fixture's definition (120): the combo layout reads its
    // signed field off it
    window.currentNetwork = def;

    // The positions Preset restores (114.7): a snapshot taken here,
    // synchronously — the factory runs the load-time layout before it
    // returns (flow included; only its layoutstop is a microtask), and
    // the ?layout= run below waits for cy.ready, so this is the graph as
    // loaded, laid out or authored.  Nodes added later have no entry and
    // keep their place, which is preset's own rule.
    window.initialPositions = layoutConfig.snapshotPositions(cy);

    if (progressive) {
      loaded
        .then(() => {
          window.initialPositions = layoutConfig.snapshotPositions(cy);
        })
        .catch(() => {});
    }

    for (const fn of pending.splice(0)) {
      fn(cy);
    }

    if (params.layout !== '') {
      // 87.4: the animate toggle forwards to every named layout (it
      // used to be hardcoded true for force and dropped for the rest);
      // seed stays force-only.  114.7: the same helper Apply uses, so
      // the URL and the button spell one run — spiral included.  The
      // timing chain guards promise() — the discrete built-ins don't
      // have one (the lifecycle-unification hook), and the old
      // unguarded chain threw uncaught on each.  Round 103: after a
      // progressive load's completion — a layout is refused mid-load.
      loaded.then(() => {
        const layout = cy.layout(
          layoutConfig.layoutOptions(
            params.layout,
            {
              animate: params.animate === 'true',
              live: params.live === 'true',
              seed: params.seed,
              positions: window.initialPositions,
              avoidOverlap: params.avoidOverlap === 'true',
              overlapLabels: params.overlapLabels === 'true',
              spacing: params.spacing,
            },
            SpiralLayout,
          ),
        );

        window.applyEdgeTypes(cy, params.layout);
        console.time(params.layout + ' layout');
        layout.run();

        const done =
          typeof layout.promise === 'function'
            ? layout.promise()
            : Promise.resolve();

        done
          .then(() => console.timeEnd(params.layout + ' layout'))
          .catch((err) => console.error(err));
      });
    }

    cy.ready
      .then(() => {
        console.log('webgpu ready');

        // a progressive load fits once itself, to its first chunk
        if (!progressive) {
          cy.fit(undefined, 30);
        }
      })
      .catch((err) => {
        console.error(err);
        showFatal(
          describe('init', err, {
            nodes: gpuElements.nodes.length,
            edges: gpuElements.edges.length,
          }),
        );
      });

    // A route-specific panel is mounted only for its matching family.  A
    // scene/view change reloads with a shareable URL; pagehide calls the
    // returned disposer before the old controls lose their core.
    if (networkID === 'features' || networkID === 'workflows') {
      cy.ready
        .then(() => mountContextualControls(scene, networkID))
        .catch(() => {});
    }

    cy.on('error', (e, message) => {
      console.error('gpu error', message);
      showFatal('GPU error: ' + message);
    });

    cy.on('pan zoom', () => {
      const { x, y } = cy.pan();

      $('#pan').innerHTML = `Pan: x: ${x.toFixed(2)}, y: ${y.toFixed(2)}`;
      $('#zoom').innerHTML = `Zoom: ${cy.zoom().toFixed(4)}`;
    });

    startStats();

    if (def.chartDemo) {
      const panel = $('#chart-demo');
      const min = $('#chart-domain-min');
      const max = $('#chart-domain-max');
      const status = $('#chart-domain-status');
      const updateChartLegend = () => {
        const entry = cy.legend().entries.find((item) => item.kind === 'chart');
        const domain = entry?.chart?.colorDomain;
        panel.hidden = false;
        if (domain == null) {
          min.textContent = 'unresolved';
          max.textContent = '';
          status.textContent = 'Waiting for usable NES values.';
        } else {
          min.textContent = Number(domain[0]).toFixed(2);
          max.textContent = Number(domain[domain.length - 1]).toFixed(2);
          status.textContent = `Shared chart domain; local override: ${def.chartDemoOverrideId}`;
        }
      };

      cy.on('legendchange', updateChartLegend);
      cy.ready.then(updateChartLegend);
      $('#chart-extreme-button').addEventListener('click', () => {
        const extreme = cy.$id(def.chartDemoExtremeId);
        const domain = cy.legend().entries.find((item) => item.kind === 'chart')
          ?.chart?.colorDomain;
        const currentMax = domain?.[domain.length - 1] ?? 3;
        extreme.data('chartSeries', [Math.max(currentMax + 2, 8)]);
        $('#chart-extreme-button').disabled = true;
        $('#chart-extreme-button').textContent =
          `Updated ${def.chartDemoExtremeId}`;
      });
    } else {
      $('#chart-demo').hidden = true;
    }
  }

  /**
   * Round 103: load through `cy.load()` — every node in the first chunk,
   * the edges over the rest, each chunk a wire buffer carrying its cut
   * edges as node references (or definitions, with ?binary=false) — and
   * log the first-chunk and completion times.
   */
  function loadProgressively(cy, gpuElements, k) {
    const nodes = gpuElements.nodes;
    const edges = gpuElements.edges;
    const per = Math.ceil(edges.length / (k - 1));
    const defs = [{ nodes, edges: [] }];

    for (let i = 0; i < edges.length; i += per) {
      defs.push({ nodes: [], edges: edges.slice(i, i + per) });
    }

    const chunks =
      params.binary === 'true'
        ? defs.map((c) =>
            cytoscape.serializeElements(
              cytoscape.toColumnarElements(c, { refs: true }),
            ),
          )
        : defs;
    const t0 = performance.now();
    const ms = () => (performance.now() - t0).toFixed(0) + ' ms';

    cy.on('loadchunk', (e) =>
      console.log(`progressive: chunk ${e.progress.chunks}/${k} in, ${ms()}`),
    );
    cy.ready.then(() => console.log(`progressive: first chunk drawn, ${ms()}`));

    const done = cy.load(chunks, { padding: 30 });

    done.then(
      (p) =>
        console.log(
          `progressive: complete — ${p.nodes} nodes, ${p.edges} edges, ${ms()}`,
        ),
      (err) => console.error(err),
    );

    return done;
  }

  /** Remove the label channel from every group of a sheet. */
  function stripLabels(style) {
    const out = {};

    for (const [group, props] of Object.entries(style)) {
      if (group === 'core' || props == null) {
        out[group] = props;
        continue;
      }

      const copy = { ...props };

      delete copy.label;
      out[group] = copy;
    }

    return out;
  }

  // -- stats overlay: fps, counts, dirty-upload bytes, pick latency --

  function startStats() {
    let lastFrames = 0;
    let lastBytes = 0;
    let lastTime = performance.now();

    setInterval(() => {
      // cy.stats() is the public snapshot since round 90 (renderer() is
      // @internal); null when there is no renderer yet
      const stats = cy && cy.stats();

      if (stats == null) {
        return;
      }

      const now = performance.now();
      const dt = (now - lastTime) / 1000;
      const fps = (stats.frames - lastFrames) / dt;
      const kbps = (stats.uploadedBytes - lastBytes) / dt / 1024;

      lastFrames = stats.frames;
      lastBytes = stats.uploadedBytes;
      lastTime = now;

      const gpuMs =
        stats.gpuFrameMs > 0
          ? `${stats.gpuFrameMs.toFixed(1)} ms GPU`
          : 'GPU n/a';
      const shaped = stats.labelShapeHits + stats.labelShapeMisses;
      const hitRate =
        shaped > 0
          ? ` (${((100 * stats.labelShapeHits) / shaped).toFixed(0)}% memo hits)`
          : '';

      showStats(
        `${stats.nodes} nodes, ${stats.edges} edges, ${stats.glyphs} glyphs${hitRate}\n` +
          `${fps.toFixed(0)} fps (rendered), ${stats.cpuFrameMs.toFixed(2)} ms CPU / ${gpuMs} per frame, scale ${stats.renderScale}\n` +
          `${kbps.toFixed(1)} KiB/s uploaded (${(stats.uploadedBytes / 1024 / 1024).toFixed(1)} MiB total)\n` +
          `mapper: ${(stats.mapperUploadedBytes / 1024).toFixed(0)} KiB in ${stats.mapperDispatches} dispatches\n` +
          `pick latency ${stats.pickLatencyMs.toFixed(1)} ms` +
          (stats.pickDeferrals > 0
            ? ` (${stats.pickDeferrals} ring-deferred frames)`
            : ''),
      );
    }, 500);
  }

  // -- fetch + dispatch --

  const networkID =
    networks[params.network] != null
      ? params.network
      : paramDefs.network.default;
  const network = networks[networkID];

  // Round 46.5: which *form* of the fixture is fetched.
  //
  // The status build ships each fixture as v4's own binary wire format
  // (`.cyge`) beside a manifest naming them, because 102.5 MiB of JSON becomes
  // 37.5 MiB — which is what puts every fixture under Cloudflare Pages' 25 MiB
  // per-file cap and lets the hosted harness serve all nine networks from the
  // deploy itself.  `npm run watch` has no manifest, so it reads the JSON and
  // nothing about local development changes.
  const wireUrl = (window.DEBUG_FIXTURE_WIRE || {})[networkID];
  const fixtureUrl = wireUrl != null ? wireUrl : network.url;
  const isWire = wireUrl != null;

  /**
   * The message for a failed load, with the *phase* passed in rather than
   * inferred — see debug/load-error.js for why that distinction is the whole
   * point.
   */
  function describe(phase, err, counts) {
    return loadError.describeLoadFailure({
      phase: phase,
      networkID: networkID,
      url: fixtureUrl,
      isWire: isWire,
      protocol: window.location.protocol,
      error: err,
      counts: counts,
    });
  }

  /** Fetch and decode the fixture. Rejects with `[phase, error]`. */
  function fetchFixture() {
    return fetch(fixtureUrl)
      .then(
        (res) => {
          if (!res.ok) {
            throw [
              'http',
              new Error(`${res.status} ${res.statusText} for ${fixtureUrl}`),
            ];
          }

          return (isWire ? res.arrayBuffer() : res.json()).catch((err) => {
            throw ['decode', err];
          });
        },
        (err) => {
          // fetch() rejects only when the request never completed: no server,
          // a blocked origin, or a file:// page
          throw ['network', err];
        },
      )
      .then((payload) => {
        try {
          // the wire buffer already holds the output of toGpuElements — the
          // build ran it — so both paths converge on the same shape here
          const gpuElements = isWire
            ? fixtures.fromColumnar(cytoscape.deserializeElements(payload))
            : fixtures.toGpuElements(payload.elements);

          return fixtures.derive(network.derive, gpuElements);
        } catch (err) {
          throw ['decode', err];
        }
      });
  }

  /**
   * Build the instance, reporting a failure as its own error.
   *
   * This runs *outside* the fetch chain deliberately: when `loadNetwork` was
   * called inside it, the fetch's `.catch` swallowed every library error and
   * reported it as a broken fixture — and only for the networks that load from
   * a fixture, which is why the binary ones looked uniquely broken.
   */
  function start(gpuElements, scene) {
    const create = () => {
      try {
        loadNetwork(gpuElements, networkID, network, scene);
      } catch (err) {
        console.error(err);
        showFatal(
          describe('init', err, {
            nodes: gpuElements.nodes.length,
            edges: gpuElements.edges.length,
          }),
        );
      }
    };

    if (
      networkID === 'features' &&
      scene?.familyId === 'labels' &&
      scene?.viewId === 'font-keywords' &&
      (params.fontFamily == null ||
        params.fontFamily === '' ||
        params.fontFamily === 'Open Sans') &&
      document.fonts?.load
    ) {
      const weight = params.fontWeight || '400';
      const style = params.fontStyle || 'normal';

      document.fonts
        .load(`${style} ${weight} 20px "Open Sans"`)
        .then(create)
        .catch((err) => {
          console.error(err);
          showFatal(`Feature font failed to load: ${err.message || err}`);
        });
      return;
    }

    create();
  }

  if (network.featureScenes) {
    const catalog = window.featureScenes?.catalog || [];
    const family =
      catalog.find((entry) => entry.id === params.scene) || catalog[0];
    const view =
      family?.views?.find((entry) => entry.id === params.view) ||
      family?.views?.[0];

    if (family == null || typeof window.featureScenes?.create !== 'function') {
      showFatal('Feature scene catalog did not load.');
    } else {
      try {
        const scene = window.featureScenes.create(family.id, view.id, params);

        replaceContextRoute({ scene: scene.familyId, view: scene.viewId });
        start(sceneElements(scene.elements), scene);
      } catch (err) {
        console.error(err);
        showFatal(`Feature scene failed to build: ${err.message || err}`);
      }
    }
  } else if (network.generated) {
    // the generated scenes take a derivation as the fetched ones do
    // (125.10: the workflow DAGs' source-band edge colour)
    const gpuElements = fixtures.derive(
      network.derive,
      fixtures.generate(network.generated, params.gen),
    );

    if (networkID === 'workflows') {
      const catalog = window.featureWorkflows?.scenes || [];
      const workflow =
        catalog.find((entry) => entry.id === params.scene) || catalog[0];
      const sceneId = workflow?.id || '';

      if (sceneId) {
        replaceContextRoute({ scene: sceneId, view: '' });
      }
      start(gpuElements, { sceneId, id: sceneId, ...workflow });
    } else {
      start(gpuElements);
    }
  } else {
    // a missing fixture used to reject silently and render nothing at all
    fetchFixture().then(start, (failure) => {
      const [phase, err] = Array.isArray(failure)
        ? failure
        : ['decode', failure];

      console.error(err);
      showFatal(describe(phase, err));
    });
  }

  // -- controls --

  const regularNetworks = document.createElement('optgroup');
  regularNetworks.label = 'Networks and scale fixtures';
  const featureNetworks = document.createElement('optgroup');
  featureNetworks.label = 'Deterministic feature demos';

  $('#network-select').append(regularNetworks, featureNetworks);

  for (const [id, def] of Object.entries(networks)) {
    const option = document.createElement('option');

    option.value = id;
    option.textContent =
      def.category === 'feature'
        ? def.desc
        : `${def.desc} (${def.nodes} nodes, ${def.edges} edges)`;
    (def.category === 'feature' ? featureNetworks : regularNetworks).append(
      option,
    );
  }

  // Say which source served this fixture.  A hosted page silently reading a
  // local file — or a local page silently reaching the network — is exactly
  // the invisible pass this harness keeps being caught by.
  $('#network-note').textContent =
    (network.note || '') +
    (isWire ? '\nLoaded from the binary wire form (.cyge), not JSON.' : '');

  for (const p of Object.keys(paramDefs)) {
    const control = $(paramDefs[p].control);

    if (control == null) {
      continue;
    }

    if (control.type === 'checkbox') {
      control.checked = params[p] === 'true';

      if (!paramDefs[p].live) {
        control.addEventListener('click', () => reloadPage());
      }
    } else {
      control.value = params[p];

      if (!paramDefs[p].live) {
        control.addEventListener('change', () => reloadPage());
      }
    }
  }

  $('#network-select').value = networkID;
  const isFeatureScene = network.featureScenes === true;
  const isContextualDemo = isFeatureScene || networkID === 'workflows';

  $('#contextual-tools').hidden =
    networkID !== 'features' && networkID !== 'workflows';
  document.body.classList.toggle('feature-scenes-active', isFeatureScene);
  document.body.classList.toggle('contextual-demo-active', isContextualDemo);

  if (isContextualDemo) {
    $('#contextual-stats').append(statsElement);
  } else {
    statsHome.before(statsElement);
  }

  function reloadPage(reset = false) {
    const { origin, pathname } = window.location;

    if (reset) {
      window.location.href = origin + pathname;

      return;
    }

    const nextParams = new URLSearchParams();

    for (const p of Object.keys(paramDefs)) {
      const control = $(paramDefs[p].control);

      if (control == null) {
        continue;
      }

      const value =
        control.type === 'checkbox' ? control.checked : control.value;

      if (String(value) !== String(paramDefs[p].default)) {
        nextParams.set(p, value);
      }
    }

    // Scene, view, gallery and construction-time renderer parameters are
    // owned by contextual controls and do not have fixed DOM controls here.
    // Preserve them across changes to the shared harness controls.
    const selectedNetwork = $('#network-select').value;
    const contextual =
      selectedNetwork === 'features' || selectedNetwork === 'workflows';

    for (const [key, value] of new URLSearchParams(
      window.location.search,
    ).entries()) {
      if (Object.hasOwn(paramDefs, key)) {
        continue;
      }

      if (!contextual && ['scene', 'view', 'rendererWorker'].includes(key)) {
        continue;
      }

      nextParams.set(key, value);
    }

    window.location.href = origin + pathname + '?' + nextParams.toString();
  }

  window.reloadPage = reloadPage;

  function cleanupContextualControls() {
    const dispose = window.featureControlsDispose;

    window.featureControlsDispose = null;

    if (typeof dispose === 'function') {
      dispose();
    }
  }

  window.addEventListener('pagehide', cleanupContextualControls, {
    once: true,
  });

  function setParams(updates) {
    const nextParams = new URLSearchParams(window.location.search);

    for (const [key, value] of Object.entries(updates || {})) {
      if (value == null || value === '') {
        nextParams.delete(key);
      } else {
        nextParams.set(key, String(value));
      }
    }

    cleanupContextualControls();
    const query = nextParams.toString();

    window.location.href =
      window.location.origin +
      window.location.pathname +
      (query ? `?${query}` : '');
  }

  window.setDebugParams = setParams;

  function mountContextualControls(scene, networkID) {
    const panel = $('#contextual-tools');
    const controls = $('#contextual-controls');
    const catalog =
      networkID === 'features'
        ? window.featureScenes?.catalog || []
        : window.featureWorkflows?.scenes || [];
    const catalogId = (item) =>
      typeof item === 'string' ? item : item?.id || item?.scene;
    const id =
      scene?.familyId ||
      scene?.sceneId ||
      scene?.id ||
      params.scene ||
      catalogId(catalog[0]);
    const entry = catalog.find((item) => catalogId(item) === id) || catalog[0];

    if (entry == null) {
      panel.hidden = true;
      return;
    }

    const sceneId = catalogId(entry);
    const descriptor =
      typeof entry === 'string'
        ? { id: entry, label: entry, purpose: '', expected: '' }
        : entry;
    const viewId =
      scene?.viewId ||
      descriptor.views?.find((view) => view.id === params.view)?.id ||
      descriptor.views?.[0]?.id ||
      '';

    panel.hidden = false;
    $('#contextual-title').textContent = descriptor.label || 'Feature controls';
    $('#contextual-purpose').textContent = descriptor.purpose || '';
    $('#contextual-expected').textContent = descriptor.expected || '';
    controls.replaceChildren();

    const onViewChange = (nextScene, nextView) =>
      setParams({ scene: nextScene, view: nextView });
    let dispose;

    if (networkID === 'features') {
      const mount = window.featureScenes?.mountControls;

      if (typeof mount !== 'function') {
        $('#contextual-expected').textContent =
          'Feature controls did not load. Reload the page after rebuilding the harness.';
        return;
      }

      dispose = mount({
        cy,
        container: controls,
        sceneId,
        viewId,
        onViewChange,
        params,
      });
    } else {
      const mount = window.featureWorkflows?.mountControls;

      if (typeof mount !== 'function') {
        $('#contextual-expected').textContent =
          'Workflow controls did not load. Reload the page after rebuilding the harness.';
        return;
      }

      dispose = mount({
        cy,
        container: controls,
        scene: sceneId,
        params,
        setParams,
        onViewChange,
      });
    }

    window.featureControlsDispose =
      typeof dispose === 'function'
        ? dispose
        : typeof dispose?.destroy === 'function'
          ? () => dispose.destroy()
          : typeof dispose?.dispose === 'function'
            ? () => dispose.dispose()
            : null;
  }

  $('#reset-scene-button').addEventListener('click', () => {
    const catalogId = (item) =>
      typeof item === 'string' ? item : item?.id || item?.scene;
    const currentScene = network.featureScenes
      ? window.featureScenes?.catalog.find((entry) => entry.id === params.scene)
      : window.featureWorkflows?.scenes.find(
          (entry) => catalogId(entry) === params.scene,
        );
    const updates = { scene: catalogId(currentScene) || params.scene };

    // Context-specific values are linkable controls.  Reset their state too,
    // while keeping the current route and construction-time renderer choice.
    for (const key of Object.keys(params)) {
      if (
        !Object.hasOwn(paramDefs, key) &&
        !['scene', 'view', 'rendererWorker', 'gallery'].includes(key)
      ) {
        updates[key] = null;
      }
    }

    if (network.featureScenes) {
      updates.view =
        currentScene?.views?.find((view) => view.id === params.view)?.id ||
        currentScene?.views?.[0]?.id ||
        params.view;
    }

    setParams(updates);
  });

  const overlay = $('#gallery-overlay');
  const frame = $('#gallery-frame');
  let previousFocus = null;

  function setGalleryParam(name) {
    const nextParams = new URLSearchParams(window.location.search);

    if (name) {
      nextParams.set('gallery', name);
    } else {
      nextParams.delete('gallery');
    }

    const query = nextParams.toString();

    window.history.replaceState(
      null,
      '',
      window.location.pathname + (query ? `?${query}` : ''),
    );
    params.gallery = name || '';
  }

  function openGallery(name, updateUrl = true) {
    const galleries = {
      arrows: {
        title: 'Arrow comparison — v3 / v4',
        src: 'arrow-gallery.html',
      },
      hulls: { title: 'Compound hull controls', src: 'compound-hulls.html' },
    };
    const gallery = galleries[name];

    if (gallery == null) {
      return;
    }

    previousFocus = document.activeElement;
    $('#gallery-title').textContent = gallery.title;
    frame.title = gallery.title;
    frame.src = gallery.src;
    overlay.hidden = false;
    if (updateUrl) {
      setGalleryParam(name);
    }
    $('#gallery-close').focus();
  }

  function closeGallery(updateUrl = true) {
    if (overlay.hidden) {
      return;
    }

    overlay.hidden = true;
    frame.src = 'about:blank';
    if (updateUrl) {
      setGalleryParam('');
    }
    if (cy != null) {
      cy.resize();
    }
    previousFocus?.focus?.();
  }

  window.closeDebugGallery = closeGallery;

  $('#open-arrow-gallery').addEventListener('click', () =>
    openGallery('arrows'),
  );
  $('#open-hull-gallery').addEventListener('click', () => openGallery('hulls'));
  $('#gallery-close').addEventListener('click', () => closeGallery());
  frame.addEventListener('load', () => {
    try {
      frame.contentWindow.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          closeGallery();
        }
      });
    } catch {
      // The frame is same-origin in the debug harness. Keep the parent close
      // control usable if a future gallery is hosted elsewhere.
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeGallery();
    }
  });

  if (params.gallery) {
    openGallery(params.gallery, false);
  }

  $('#hide-commands').addEventListener('click', () => {
    document.body.classList.add('commands-hidden');
  });

  $('#show-commands').addEventListener('click', () => {
    document.body.classList.remove('commands-hidden');
  });

  $('#reset-button').addEventListener('click', () => reloadPage(true));
})();
