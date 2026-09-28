/*
Round 131: the cross-runtime smoke's checks, split from the loader
(`smoke.mjs`) so that every host runs the same assertions — Node, Bun and
Deno through `smoke.mjs`, a WinterTC-shaped `node:vm` isolate through
`isolate.mjs`, and Cloudflare's own runtime through `workerd-main.mjs`.
**No imports at all**: this module is loaded as-is inside an isolate and
inside workerd, where there is no `node:` anything to import
(`test/modules/runtime-smoke.mjs` lints it).  See `smoke.mjs`'s header for
what the checks cover and why they assert on values.
*/

let assertions = 0;

/** The assertions run so far, for the ok line. */
export const assertionCount = () => assertions;

export const assert = (ok, what) => {
  assertions++;

  if (!ok) {
    throw new Error(`smoke assertion failed: ${what}`);
  }
};

export const eq = (actual, expected, what) =>
  assert(
    actual === expected,
    `${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );

export const near = (actual, expected, what, tol = 1e-9) =>
  assert(
    typeof actual === 'number' && Math.abs(actual - expected) <= tol,
    `${what}: expected ~${expected}, got ${actual}`,
  );

export const FIXTURE = () => ({
  nodes: [
    { data: { id: 'a', label: 'alpha', score: 2 }, position: { x: 1, y: 2 } },
    {
      data: { id: 'b', label: 'beta', score: 5 },
      position: { x: 3, y: 4 },
      selected: true,
    },
    // 'alpha' repeats so the label column dictionary-encodes on the wire
    { data: { id: 'c', label: 'alpha', score: 10 }, position: { x: 5, y: 6 } },
  ],
  edges: [
    { data: { id: 'ab', source: 'a', target: 'b', kind: 'x' } },
    { data: { id: 'bc', source: 'b', target: 'c', kind: 'y' } },
  ],
});

export const SHEET = () => ({
  nodes: {
    width: 30,
    'background-color': '#ff0000',
    height: {
      data: 'score',
      scale: 'linear',
      domain: [0, 10],
      range: [10, 50],
    },
  },
  bypasses: { b: { width: 55 } },
});

export const HEADLESS = { headlessWidth: 640, headlessHeight: 480 };

/**
 * The round-46.5 dict-as-array control: read every dictionary column as if
 * it were a plain array (`col[ i ]` instead of
 * `col.dict[ col.indices[ i ] - 1 ]`), which hands back `undefined` for
 * every string value — the plausible-looking graph with no labels.  The
 * value assertions below must then fail, on every runtime.
 */
export const degradeDictColumns = (payload) => {
  for (const group of [payload.nodes, payload.edges]) {
    for (const [key, col] of Object.entries(group.data ?? {})) {
      if (col != null && col.dict != null) {
        group.data[key] = Array.from(col.indices, (_, i) => col[i]);
      }
    }
  }

  return payload;
};

/** Assert the graph the fixture describes, value for value. */
export const checkGraph = (cy, label) => {
  eq(cy.nodes().length, 3, `${label}: node count`);
  eq(cy.edges().length, 2, `${label}: edge count`);

  // every dictionary column still carries values — the 46.5 lesson
  eq(cy.$id('a').data('label'), 'alpha', `${label}: a.label`);
  eq(cy.$id('b').data('label'), 'beta', `${label}: b.label`);
  eq(cy.$id('c').data('label'), 'alpha', `${label}: c.label`);
  eq(cy.$id('ab').data('kind'), 'x', `${label}: ab.kind`);
  eq(cy.$id('bc').data('kind'), 'y', `${label}: bc.kind`);

  // the numeric column and the flags column
  eq(cy.$id('c').data('score'), 10, `${label}: c.score`);
  eq(cy.$id('b').selected(), true, `${label}: b.selected`);
  eq(cy.$id('a').selected(), false, `${label}: a.selected`);

  // positions
  eq(cy.$id('a').position().x, 1, `${label}: a.x`);
  eq(cy.$id('c').position().y, 6, `${label}: c.y`);
};

export const smokeOneBundle = async (cytoscape, label, control = null) => {
  // ── factory + headless init, sizes set explicitly (the standing rule)
  const cy = cytoscape({ ...HEADLESS, elements: FIXTURE(), style: SHEET() });

  eq(cy.width(), 640, `${label}: headlessWidth`);
  eq(cy.height(), 480, `${label}: headlessHeight`);
  checkGraph(cy, `${label}: definition form`);

  // ── the wire round-trip: definition form → buffer → columnar → instance
  const buffer = cytoscape.serializeElements(FIXTURE());

  assert(
    buffer instanceof ArrayBuffer && buffer.byteLength > 0,
    `${label}: serializeElements returns a non-empty ArrayBuffer`,
  );

  const payload = cytoscape.deserializeElements(buffer);

  eq(payload.columnar, true, `${label}: wire payload is columnar`);

  const wired = cytoscape({
    ...HEADLESS,
    elements:
      control === 'dict-as-array' ? degradeDictColumns(payload) : payload,
    style: SHEET(),
  });

  checkGraph(wired, `${label}: wire round trip`);

  // ── style: constants, the scale mapper and the bypass, read as values
  eq(cy.$id('a').width(), 30, `${label}: constant width`);
  eq(cy.$id('b').width(), 55, `${label}: bypass width wins`);
  eq(
    cy.$id('a').style('background-color'),
    'rgb(255,0,0)',
    `${label}: constant colour readback`,
  );
  near(cy.$id('a').height(), 18, `${label}: mapped height (score 2)`);
  near(cy.$id('c').height(), 50, `${label}: mapped height (score 10)`);

  // ── the bypasses section export rides json()
  eq(
    JSON.stringify(cy.json().style.bypasses),
    JSON.stringify({ b: { width: 55 } }),
    `${label}: json().style.bypasses`,
  );

  // ── layouts: grid, then a few CPU-force ticks
  cy.layout({ name: 'grid', fit: false }).run();

  const gridPositions = cy.nodes().map((n) => ({ ...n.position() }));

  assert(
    gridPositions.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)),
    `${label}: grid positions are finite`,
  );
  assert(
    new Set(gridPositions.map((p) => `${p.x},${p.y}`)).size === 3,
    `${label}: grid positions are distinct`,
  );

  await cy
    .layout({ name: 'force', seed: 7, iterations: 5, fit: false })
    .run()
    .promise();

  const forcePositions = cy.nodes().map((n) => ({ ...n.position() }));

  assert(
    forcePositions.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)),
    `${label}: force positions are finite`,
  );
  assert(
    forcePositions.some(
      (p, i) => p.x !== gridPositions[i].x || p.y !== gridPositions[i].y,
    ),
    `${label}: force ticks moved the nodes`,
  );

  // ── algorithms: one sync, one async through the promise tier on the CPU
  const depths = {};

  cy.elements().bfs({
    roots: cy.$id('a'),
    visit: (v, _e, _u, _i, depth) => {
      depths[v.id()] = depth;
    },
  });
  eq(
    JSON.stringify(depths),
    JSON.stringify({ a: 0, b: 1, c: 2 }),
    `${label}: bfs depths`,
  );

  const ranks = await cy
    .elements()
    .pageRank({ iterations: 20, executor: 'cpu' });
  const rank = (id) => ranks.rank(cy.$id(id));

  near(
    rank('a') + rank('b') + rank('c'),
    1,
    `${label}: pageRank ranks sum to 1`,
    1e-6,
  );
  assert(
    rank('c') > rank('b') && rank('b') > rank('a'),
    `${label}: pageRank ranks the directed chain tail > middle > head`,
  );

  // ── events: synchronous dispatch, with extra parameters, in order
  const seen = [];

  cy.on('smoke', (event, extra) => {
    seen.push(['handler', event.type, extra]);
  });
  cy.emit('smoke', ['payload']);
  seen.push(['after-emit']);
  eq(
    JSON.stringify(seen),
    JSON.stringify([['handler', 'smoke', 'payload'], ['after-emit']]),
    `${label}: event dispatch order and arguments`,
  );

  // ── json(): the export carries the values put in
  const json = cy.json();

  eq(json.headless, true, `${label}: json().headless`);
  eq(json.elements.nodes.length, 3, `${label}: json() node defs`);
  eq(json.style.nodes.width, 30, `${label}: json() sheet constant`);

  cy.destroy();
  wired.destroy();
};

export const NO_RENDERER = "this build has no renderer — import 'cytoscape'";
export const NO_GPU =
  "this build has no GPU executors — import 'cytoscape/headless-gpu' or " +
  "'cytoscape'";

/** The rejection a promise settles with, or null when it resolves. */
export const settledError = (promise) =>
  promise.then(
    () => null,
    (err) => err,
  );

/**
 * What only the entry's own build carries (round 131): the slim builds
 * refuse a container with the build's message and ship no render worker
 * entry; `cytoscape/headless` refuses an explicit 'gpu' — algorithm and
 * force — with its own message, while the GPU-carrying builds never give
 * that message (what they do give depends on the runtime's WebGPU, so
 * the assertion is on the one message they must not produce).
 */
export const smokeKind = async (cytoscape, kind, label) => {
  const slim = kind !== 'full';
  let thrown = null;

  try {
    cytoscape({ ...HEADLESS, container: {} }).destroy();
  } catch (err) {
    thrown = err;
  }

  if (slim) {
    eq(thrown?.message, NO_RENDERER, `${label}: a container is refused`);
  }

  eq(
    typeof cytoscape.__runRenderWorker__,
    slim ? 'undefined' : 'function',
    `${label}: the render worker entry`,
  );
  eq(
    typeof cytoscape.__runForceSimWorker__,
    'function',
    `${label}: the force sim worker entry`,
  );

  const cy = cytoscape({ ...HEADLESS, elements: FIXTURE() });
  const gpuErr = await settledError(
    cy.elements().pageRank({ iterations: 5, executor: 'gpu' }),
  );

  if (kind === 'headless') {
    eq(gpuErr?.message, NO_GPU, `${label}: executor 'gpu' names the build`);

    let forceErr = null;

    try {
      cy.layout({ name: 'force', executor: 'gpu' }).run();
    } catch (err) {
      forceErr = err;
    }

    eq(
      forceErr?.message,
      "force layout: executor 'gpu' needs the GPU integrator — " + NO_GPU,
      `${label}: force executor 'gpu' names the build`,
    );
  } else {
    assert(
      gpuErr == null || gpuErr.message !== NO_GPU,
      `${label}: a GPU build never answers with the headless build's message`,
    );
  }

  cy.destroy();
};

/**
 * Where no worker can be constructed (an edge isolate), `executor: 'auto'`
 * must run on the calling thread: the algorithm pool and the force sim
 * worker never spawn, and the answers are the reference's (round 131).
 */
export const smokeCpuOnly = async (cytoscape, label) => {
  const algoBefore = cytoscape.__algoWorkersStats__();
  const forceBefore = cytoscape.__forceWorkerStats__();
  const cy = cytoscape({ ...HEADLESS, elements: FIXTURE() });
  const auto = await cy.elements().pageRank({ iterations: 20 });
  const ref = await cy.elements().pageRank({ iterations: 20, executor: 'cpu' });

  for (const id of ['a', 'b', 'c']) {
    eq(
      auto.rank(cy.$id(id)),
      ref.rank(cy.$id(id)),
      `${label}: 'auto' pageRank of ${id} is the reference's`,
    );
  }

  const seed = cy.nodes().map((n) => ({ ...n.position() }));

  await cy
    .layout({ name: 'force', seed: 7, iterations: 5, fit: false })
    .run()
    .promise();

  assert(
    cy
      .nodes()
      .map((n) => n.position())
      .some((p, i) => p.x !== seed[i].x || p.y !== seed[i].y),
    `${label}: an 'auto' force run moved the nodes`,
  );
  eq(
    JSON.stringify(cytoscape.__algoWorkersStats__()),
    JSON.stringify(algoBefore),
    `${label}: the algorithm pool never spawned`,
  );
  eq(
    JSON.stringify(cytoscape.__forceWorkerStats__()),
    JSON.stringify(forceBefore),
    `${label}: the force sim worker never spawned`,
  );
  cy.destroy();
};
