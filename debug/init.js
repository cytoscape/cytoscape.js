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
  labelMinPx: {
    default: '0',
    control: '#label-min-input',
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

  console.log('params', params);
  $('#cytoscape').style.backgroundColor = params.bgcolor;

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

  function loadNetwork(gpuElements, networkID, def) {
    console.time('cytoscape init');

    let style = styles.sheet(params.style, networkID, gpuElements, def);

    if (params.labels !== 'true') {
      // the checkbox is a plain on/off over whatever the sheet declares — it
      // no longer *replaces* the mapping with data(id), which is what made
      // "labels on" show UUIDs on em-web and SUIDs on the NDEx sets
      style = stripLabels(style);
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

    cy = cytoscape({
      container: $('#cytoscape'),
      elements: elements,
      style: style,
      // a network with no positions is laid out at load; `def.layout` lets one
      // say how (the compound fixture needs v3's `cols: 3` to be readable)
      layout: gpuElements.hasPositions
        ? undefined
        : def.layout || { name: 'grid' },
      renderer: {
        edgeWidthFloor: parseFloat(params.edgeWidthFloor),
        nodeLodPx: parseFloat(params.nodeLodPx),
        hidePx: parseFloat(params.hidePx),
        edgeDimming: params.edgeDimming === 'true',
        labelMinPx: parseFloat(params.labelMinPx),
        renderScaleMin: parseFloat(params.renderScaleMin),
        renderScaleMax: parseFloat(params.renderScaleMax),
      },
    });

    console.timeEnd('cytoscape init');
    window.cy = cy;
    window.currentStyle = style;

    // The positions Preset restores (114.7): a snapshot taken here,
    // synchronously — the factory runs the load-time layout before it
    // returns (flow included; only its layoutstop is a microtask), and
    // the ?layout= run below waits for cy.ready, so this is the graph as
    // loaded, laid out or authored.  Nodes added later have no entry and
    // keep their place, which is preset's own rule.
    window.initialPositions = layoutConfig.snapshotPositions(cy);

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
      // unguarded chain threw uncaught on each.
      cy.ready.then(() => {
        const layout = cy.layout(
          layoutConfig.layoutOptions(
            params.layout,
            {
              animate: params.animate === 'true',
              live: params.live === 'true',
              seed: params.seed,
              positions: window.initialPositions,
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
        cy.fit(undefined, 30);
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
  function start(gpuElements) {
    try {
      loadNetwork(gpuElements, networkID, network);
    } catch (err) {
      console.error(err);
      showFatal(
        describe('init', err, {
          nodes: gpuElements.nodes.length,
          edges: gpuElements.edges.length,
        }),
      );
    }
  }

  if (network.generated) {
    start(fixtures.generate(network.generated, params.gen));
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

  for (const [id, def] of Object.entries(networks)) {
    const option = document.createElement('option');

    option.value = id;
    option.innerHTML = `${def.desc} (${def.nodes} nodes, ${def.edges} edges)`;
    $('#network-select').appendChild(option);
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

    window.location.href = origin + pathname + '?' + nextParams.toString();
  }

  window.reloadPage = reloadPage;

  $('#hide-commands').addEventListener('click', () => {
    document.body.classList.add('commands-hidden');
  });

  $('#show-commands').addEventListener('click', () => {
    document.body.classList.remove('commands-hidden');
  });

  $('#reset-button').addEventListener('click', () => reloadPage(true));
})();
