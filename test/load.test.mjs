import { expect } from 'chai';
import cytoscape from '../src/index.mjs';
import headless from '../src/headless.mjs';
import { COLUMN_SPECS, COL } from '../src/contract.mjs';

/*
Round 103: `cy.load()` — progressive ingest, and the node references
(`refs`) that let a columnar or wire chunk carry its cut edges.

The plan's control is columns-equal: a chunked load's end state must equal
the monolithic load of the same fixture, every `COLUMN_SPECS` column id by
id (the round-42 method applied to store state) plus every element's data —
from every chunk form, and for both chunk shapes (vertex-closed, where an
edge travels with its later endpoint, and nodes first).  Its own control is
a chunked load with one value moved, which the comparison must reject.

The fixture is built to exercise what a chunk boundary can break: a bezier
bundle whose members arrive in different chunks, a self-loop, a compound
parent whose child arrives later (a parent reference), a compound relation
edge, a mapped style, a selected and a locked element.

"First chunk drawn" is asserted with its precondition (the 48.5 rule): the
source is a gate the spec holds shut, so `cy.ready` resolving while chunk
two has knowably not been handed over is the property, not a race.
*/

const STYLE = {
  nodes: {
    label: 'data(label)',
    width: { data: 'w', domain: [0, 10], range: [10, 40] },
    'background-color': { data: 'w', domain: [0, 10], range: 'viridis' },
  },
  edges: {
    'curve-style': 'bezier',
    width: { data: 'ew', domain: [0, 10], range: [1, 5] },
  },
};

/** 12 nodes on a grid, a compound, a bundle, a loop, a relation. */
const fixture = () => {
  // the compound parent comes first: a reference names what an *earlier*
  // chunk loaded, so a parent precedes its children, as an endpoint
  // precedes its edges
  const nodes = [{ data: { id: 'p', label: 'P' } }];

  for (let i = 0; i < 12; i++) {
    nodes.push({
      data: { id: 'n' + i, w: i % 10, label: 'N' + i },
      position: { x: (i % 4) * 100, y: Math.floor(i / 4) * 80 },
    });
  }

  // a compound whose child (n9) arrives chunks after it
  nodes[10].data.parent = 'p';
  nodes[2].selected = true;
  nodes[6].locked = true;

  const edges = [];
  const edge = (id, source, target, ew = 1) =>
    edges.push({ data: { id, source, target, ew } });

  for (let i = 0; i < 11; i++) {
    edge('e' + i, 'n' + i, 'n' + (i + 1), i % 10);
  }

  // a three-member bezier bundle between n0 and n11, a loop on n6, a
  // cross edge back to n2, and a compound relation (p's child to p)
  edge('b1', 'n0', 'n11', 2);
  edge('b2', 'n11', 'n0', 3);
  edge('b3', 'n0', 'n11', 4);
  edge('loop', 'n6', 'n6', 5);
  edge('x', 'n10', 'n2', 6);
  edge('rel', 'n9', 'p', 7);
  edges[3].selected = true;

  return { nodes, edges };
};

/** Split a fixture into k vertex-closed chunks: nodes in order, an edge
 * with its later endpoint's chunk. */
const vertexClosed = (graph, k) => {
  const per = Math.ceil(graph.nodes.length / k);
  const chunkOf = new Map();
  const chunks = Array.from({ length: k }, () => ({ nodes: [], edges: [] }));

  graph.nodes.forEach((n, i) => {
    chunkOf.set(n.data.id, Math.floor(i / per));
    chunks[Math.floor(i / per)].nodes.push(n);
  });

  for (const e of graph.edges) {
    const c = Math.max(chunkOf.get(e.data.source), chunkOf.get(e.data.target));

    chunks[c].edges.push(e);
  }

  return chunks;
};

/** Chunk one every node, then the edges in k − 1 chunks. */
const nodesFirst = (graph, k) => {
  const chunks = [{ nodes: graph.nodes, edges: [] }];
  const per = Math.ceil(graph.edges.length / (k - 1));

  for (let i = 0; i < graph.edges.length; i += per) {
    chunks.push({ nodes: [], edges: graph.edges.slice(i, i + per) });
  }

  return chunks;
};

/** Each form: a chunk in it, and the whole graph in it (the public
 * converter drops `locked`, so the monolithic reference is the same
 * form's whole load, not the definitions'). */
const FORMS = {
  definition: { chunk: (c) => c, whole: (g) => g },
  columnar: {
    chunk: (c) => cytoscape.toColumnarElements(c, { refs: true }),
    whole: (g) => cytoscape.toColumnarElements(g),
  },
  wire: {
    chunk: (c) =>
      cytoscape.serializeElements(
        cytoscape.toColumnarElements(c, { refs: true }),
      ),
    whole: (g) => cytoscape.serializeElements(g),
  },
};

const clone = (x) => structuredClone(x);

/**
 * Every `COLUMN_SPECS` column of every element, id by id, endpoints as
 * ids, derived state flushed on both sides — plus every element's data.
 */
const expectSameGraph = (loaded, fresh) => {
  loaded._store.flushDerived();
  fresh._store.flushDerived();

  expect(loaded.nodes().length).to.equal(fresh.nodes().length);
  expect(loaded.edges().length).to.equal(fresh.edges().length);

  for (const spec of COLUMN_SPECS) {
    const a = loaded._store.column(spec.id);
    const b = fresh._store.column(spec.id);
    const n = spec.components;
    const eles = spec.group === 'nodes' ? fresh.nodes() : fresh.edges();

    for (let i = 0; i < eles.length; i++) {
      const id = eles[i].id();
      const sb = fresh._store.lookup(id).slot;
      const ref = loaded._store.lookup(id);

      expect(ref, `${id} was loaded`).to.not.equal(undefined);

      for (let c = 0; c < n; c++) {
        let va = a[ref.slot * n + c];
        let vb = b[sb * n + c];

        if (spec.id === COL.EDGE_ENDPOINTS) {
          va = loaded._store.idAt('nodes', va);
          vb = fresh._store.idAt('nodes', vb);
        }

        expect(va, `${spec.id}[${c}] of '${id}'`).to.deep.equal(vb);
      }
    }
  }

  fresh.elements().forEach((ele) => {
    expect(loaded.$id(ele.id()).data(), `data of '${ele.id()}'`).to.deep.equal(
      ele.data(),
    );
    expect(loaded.$id(ele.id()).locked()).to.equal(ele.locked());
  });
};

/** An async source that hands over one chunk per `open()` — a permit
 * counter, so an open that lands before the source asks is kept. */
const gated = (chunks) => {
  let permits = 0;
  let waiting = null;
  let handed = 0;
  let closed = false;
  const gate = { handed: () => handed, closed: () => closed };

  gate.open = () => {
    permits++;
    waiting?.();
    waiting = null;
  };
  gate.source = (async function* () {
    try {
      for (const chunk of chunks) {
        while (permits === 0) {
          await new Promise((resolve) => {
            waiting = resolve;
          });
        }

        permits--;
        handed++;
        yield chunk;
      }
    } finally {
      closed = true;
    }
  })();

  return gate;
};

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const census = (cy) => {
  const events = [];

  for (const type of ['loadstart', 'loadchunk', 'loadready', 'loadstop']) {
    cy.on(type, (e) =>
      events.push({ type, ...e.progress, cancelled: e.cancelled === true }),
    );
  }

  return events;
};

describe('cy.load() (round 103)', function () {
  describe('end state: columns-equal to the monolithic load', function () {
    for (const [form, { chunk: make, whole }] of Object.entries(FORMS)) {
      for (const [shape, split] of [
        ['vertex-closed', (g) => vertexClosed(g, 4)],
        ['nodes-first', (g) => nodesFirst(g, 4)],
      ]) {
        it(`from ${form} chunks, ${shape}`, async function () {
          const fresh = cytoscape({ elements: whole(fixture()), style: STYLE });
          const cy = cytoscape({ style: STYLE });

          await cy.load(split(fixture()).map((c) => make(clone(c))));
          expectSameGraph(cy, fresh);
        });
      }
    }

    it('rejects a chunked load with one value moved (the control)', async function () {
      const fresh = cytoscape({ elements: fixture(), style: STYLE });
      const cy = cytoscape({ style: STYLE });
      const chunks = vertexClosed(fixture(), 4);

      chunks
        .flatMap((c) => c.edges)
        .find((e) => e.data.id === 'b2').data.ew = 9;
      await cy.load(chunks.map((c) => FORMS.wire.chunk(c)));
      expect(() => expectSameGraph(cy, fresh)).to.throw();
    });

    it('rejects a chunked load missing a chunk (the control)', async function () {
      const fresh = cytoscape({ elements: fixture(), style: STYLE });
      const cy = cytoscape({ style: STYLE });

      await cy.load(nodesFirst(fixture(), 4).slice(0, 3));
      expect(() => expectSameGraph(cy, fresh)).to.throw();
    });

    it('re-derives a bundle whose members arrive in different chunks', async function () {
      const cy = cytoscape({ style: STYLE });
      const g = fixture();
      const b = (id) => g.edges.find((e) => e.data.id === id);

      await cy.load([
        { nodes: g.nodes, edges: [b('b1')] },
        [b('b2')],
        FORMS.wire.chunk({ edges: [b('b3')] }),
      ]);

      const fresh = cytoscape({
        elements: {
          nodes: fixture().nodes,
          edges: [b('b1'), b('b2'), b('b3')],
        },
        style: STYLE,
      });

      expect(cy.$id('b3').controlPoints()).to.deep.equal(
        fresh.$id('b3').controlPoints(),
      );
      expect(cy.$id('b1').controlPoints()).to.deep.equal(
        fresh.$id('b1').controlPoints(),
      );
      // three members fan: the middle one is straight, the outer two bow
      expect(cy.$id('b1').controlPoints()).to.not.deep.equal(
        cy.$id('b3').controlPoints(),
      );
    });
  });

  describe('cy.ready: the first chunk drawn', function () {
    it('holds an initial load’s cy.ready until the first chunk, while chunk two is knowably absent', async function () {
      const chunks = vertexClosed(fixture(), 3);
      const gate = gated(chunks);
      const cy = headless({ style: STYLE });
      const before = cy.ready;
      let ready = false;

      const run = cy.load(gate.source);

      expect(cy.ready).to.not.equal(before);
      expect(cy.isReady()).to.equal(false);
      cy.ready.then(() => {
        ready = true;
      });

      await tick();
      expect(ready, 'no chunk handed over yet').to.equal(false);

      gate.open();
      await tick();
      await tick();

      // the precondition: chunk two has not been handed over
      expect(gate.handed()).to.equal(1);
      expect(ready).to.equal(true);
      expect(cy.isReady()).to.equal(true);
      expect(cy.nodes().length).to.equal(chunks[0].nodes.length);

      gate.open();
      gate.open();
      await tick();
      gate.open();

      const progress = await run;

      expect(progress.chunks).to.equal(3);
      expect(cy.nodes().length).to.equal(13);
    });

    it('leaves cy.ready alone for a load into a populated graph', async function () {
      const cy = cytoscape({
        elements: [{ data: { id: 'z' } }],
        style: STYLE,
      });
      const before = cy.ready;

      const run = cy.load(nodesFirst(fixture(), 3));

      expect(cy.ready).to.equal(before);
      expect(cy.isReady()).to.equal(true);
      await run;
    });

    it('releases cy.ready at the end of a load with no chunk', async function () {
      const cy = cytoscape({});
      const progress = await cy.load([]);

      expect(progress).to.deep.equal({ chunks: 0, nodes: 0, edges: 0 });
      expect(await cy.ready).to.equal(cy);
      expect(cy.isReady()).to.equal(true);
    });
  });

  describe('events', function () {
    it('opens, reports each chunk, the first drawn, and closes — in that order', async function () {
      const cy = cytoscape({ style: STYLE });
      const events = census(cy);
      let adds = 0;

      cy.on('add', () => adds++);
      await cy.load(nodesFirst(fixture(), 3));

      expect(events.map((e) => e.type)).to.deep.equal([
        'loadstart',
        'loadchunk',
        'loadready',
        'loadchunk',
        'loadchunk',
        'loadstop',
      ]);
      expect(events[0]).to.deep.include({ chunks: 0, nodes: 0, edges: 0 });
      expect(events[1]).to.deep.include({ chunks: 1, nodes: 13, edges: 0 });
      expect(events.at(-1)).to.deep.include({
        chunks: 3,
        nodes: 13,
        edges: 17,
        cancelled: false,
      });
      // `add` per element while anyone listens, as the bulk path emits it
      expect(adds).to.equal(30);
    });

    it('gives the renderer a turn between chunks of a synchronous source', async function () {
      const cy = cytoscape({ style: STYLE });
      const seen = [];

      cy.on('loadchunk', (e) => {
        seen.push(`chunk ${e.progress.chunks}`);
        setTimeout(() => seen.push(`task after ${e.progress.chunks}`), 0);
      });
      await cy.load(nodesFirst(fixture(), 3));

      // a macrotask queued by chunk one runs before chunk two lands
      expect(seen.slice(0, 3)).to.deep.equal([
        'chunk 1',
        'task after 1',
        'chunk 2',
      ]);
    });
  });

  describe('the viewport and graph data', function () {
    it('fits an initial load once, to the first chunk, then holds', async function () {
      const cy = cytoscape({ style: STYLE });
      const chunks = vertexClosed(fixture(), 3);
      const viewports = [];

      cy.on('loadchunk', () =>
        viewports.push({ zoom: cy.zoom(), pan: { ...cy.pan() } }),
      );
      await cy.load(chunks, { padding: 10 });

      const firstOnly = cytoscape({ elements: chunks[0], style: STYLE });

      firstOnly.fit(undefined, 10);
      expect(viewports[0].zoom).to.equal(firstOnly.zoom());
      expect(viewports[0].pan).to.deep.equal(firstOnly.pan());
      // the later chunks extend past the first's box; the screen holds
      expect(viewports[2]).to.deep.equal(viewports[0]);
      expect(cy.zoom()).to.equal(viewports[0].zoom);
    });

    it('keeps the viewport under fit: false, and by default into a populated graph', async function () {
      for (const [opts, elements] of [
        [{ fit: false }, undefined],
        [{}, [{ data: { id: 'z' } }]],
      ]) {
        const cy = cytoscape({ elements, style: STYLE, zoom: 2 });

        cy.pan({ x: 7, y: 9 });
        await cy.load(vertexClosed(fixture(), 3), opts);
        expect(cy.zoom()).to.equal(2);
        expect(cy.pan()).to.deep.equal({ x: 7, y: 9 });
      }
    });

    it('applies a wire chunk’s graph data on an initial load only', async function () {
      const payload = cytoscape.serializeElements({
        columnar: true,
        nodes: { count: 1, ids: ['q'] },
        data: { title: 'streamed' },
      });
      const initial = cytoscape({});
      const populated = cytoscape({ elements: [{ data: { id: 'z' } }] });

      await initial.load([payload]);
      await populated.load([payload]);
      expect(initial.data('title')).to.equal('streamed');
      expect(populated.data('title')).to.equal(undefined);
    });
  });

  describe('cancel, destroy and failure', function () {
    it('cancel() stops pulling, closes the source, keeps what landed', async function () {
      const gate = gated(vertexClosed(fixture(), 3));
      const cy = cytoscape({ style: STYLE });
      const events = census(cy);
      const run = cy.load(gate.source);

      gate.open();
      await tick();
      await tick();
      expect(cy.nodes().length).to.be.greaterThan(0);

      const kept = cy.elements().length;

      expect(run.cancel()).to.equal(true);
      expect(run.cancel()).to.equal(false);

      let err = null;

      try {
        await run;
      } catch (e) {
        err = e;
      }

      expect(err?.name).to.equal('CancelledError');
      // the source was mid-`next()`: it closes once that settles, and
      // hands nothing more to the graph
      gate.open();
      await tick();
      expect(gate.closed(), 'the source was closed').to.equal(true);
      expect(gate.handed()).to.equal(2);
      expect(cy.elements().length).to.equal(kept);
      expect(events.at(-1)).to.deep.include({
        type: 'loadstop',
        cancelled: true,
      });
      // the lifecycle closed: a new load may start
      await cy.load([[{ data: { id: 'late' } }]]);
      expect(cy.$id('late').length).to.equal(1);
    });

    it('closes the source at cancel() when cancelled between chunks', async function () {
      const gate = gated(vertexClosed(fixture(), 3));
      const cy = cytoscape({});
      const run = cy.load(gate.source);

      cy.on('loadchunk', () => run.cancel());
      gate.open();
      gate.open();

      let err = null;

      try {
        await run;
      } catch (e) {
        err = e;
      }

      expect(err?.name).to.equal('CancelledError');

      // an async generator's return() settles over a few microtasks —
      // well before the load's next macrotask, where a load that did not
      // close the source on cancel() would notice and close it itself
      for (let i = 0; i < 5; i++) {
        await null;
      }

      expect(gate.closed(), 'closed by cancel()').to.equal(true);
      expect(gate.handed()).to.equal(1);
    });

    it('answers false from cancel() once the load has completed', async function () {
      const cy = cytoscape({});
      const run = cy.load([[{ data: { id: 'a' } }]]);

      await run;
      expect(run.cancel()).to.equal(false);
    });

    it('is cancelled by cy.destroy(), with its loadstop delivered first', async function () {
      const gate = gated(vertexClosed(fixture(), 3));
      const cy = cytoscape({});
      const events = census(cy);
      const run = cy.load(gate.source);

      gate.open();
      await tick();
      cy.destroy();

      let err = null;

      try {
        await run;
      } catch (e) {
        err = e;
      }

      expect(err?.name).to.equal('CancelledError');
      expect(events.at(-1)).to.deep.include({
        type: 'loadstop',
        cancelled: true,
      });
    });

    it('rejects on a chunk naming a node no chunk loaded, keeping the chunks before it whole', async function () {
      const cy = cytoscape({});
      const events = census(cy);
      const run = cy.load([
        [{ data: { id: 'a' } }, { data: { id: 'b' } }],
        cytoscape.serializeElements(
          cytoscape.toColumnarElements(
            {
              nodes: [{ data: { id: 'c' } }],
              edges: [
                { data: { id: 'ca', source: 'c', target: 'a' } },
                { data: { id: 'cx', source: 'c', target: 'nope' } },
              ],
            },
            { refs: true },
          ),
        ),
      ]);

      let err = null;

      try {
        await run;
      } catch (e) {
        err = e;
      }

      expect(err?.message).to.match(
        /Can not create edge 'cx': its node reference 'nope' is not a node in the graph/,
      );
      // nothing of the failing chunk was added
      expect(cy.elements().map((e) => e.id())).to.deep.equal(['a', 'b']);
      expect(events.at(-1)).to.deep.include({
        type: 'loadstop',
        chunks: 1,
        cancelled: false,
      });
    });

    it('rejects when the source itself throws', async function () {
      const cy = cytoscape({});

      const source = (function* () {
        yield [{ data: { id: 'a' } }];
        throw new Error('the stream broke');
      })();

      let err = null;

      try {
        await cy.load(source);
      } catch (e) {
        err = e;
      }

      expect(err?.message).to.equal('the stream broke');
      expect(cy.nodes().length).to.equal(1);
    });
  });

  describe('refusals', function () {
    it('throws on a source that is not an iterable of chunks', function () {
      const cy = cytoscape({});

      for (const bad of [null, 42, 'abc', { nodes: [] }]) {
        expect(() => cy.load(bad)).to.throw(
          /cy.load\(\) takes an iterable or async iterable of chunks/,
        );
      }
    });

    it('refuses one payload passed whole, which is iterable only by accident', function () {
      const cy = cytoscape({});
      const buffer = cytoscape.serializeElements([{ data: { id: 'a' } }]);

      expect(() => cy.load(buffer)).to.throw(/pass \[ payload \]/);
      expect(() => cy.load(new Uint8Array(buffer))).to.throw(
        /pass \[ payload \]/,
      );
      expect(() =>
        cy.load(cytoscape.toColumnarElements([{ data: { id: 'a' } }])),
      ).to.throw(/pass \[ payload \]/);
    });

    it('throws on an unknown option', function () {
      expect(() => cytoscape({}).load([], { fitt: true })).to.throw(
        /Unknown load option 'fitt'/,
      );
    });

    it('throws while another load is running, and on a destroyed instance', async function () {
      const cy = cytoscape({});
      const run = cy.load([[{ data: { id: 'a' } }]]);

      expect(() => cy.load([])).to.throw(/a load is already running/);
      await run;

      cy.destroy();
      expect(() => cy.load([])).to.throw(/destroyed instance/);
    });

    it('refuses a layout while a load runs, and runs one after', async function () {
      const gate = gated(nodesFirst(fixture(), 2));
      const cy = cytoscape({ style: STYLE });
      const run = cy.load(gate.source);

      expect(() => cy.layout({ name: 'grid' }).run()).to.throw(
        /A layout cannot run while cy.load\(\) is streaming/,
      );
      gate.open();
      gate.open();
      await tick();
      gate.open();
      await run;
      cy.layout({ name: 'grid' }).run();
    });
  });
});
