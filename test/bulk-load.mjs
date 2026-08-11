import { expect } from 'chai';
import cytoscape from '../src/index.mjs';
import { GraphStore } from '../src/store/graph-store.mjs';
import { ColumnTable } from '../src/store/table.mjs';
import { StyleEngine } from '../src/style.mjs';
import { columnSpecsForGroup } from '../src/contract.mjs';
import { partitionDefs } from '../src/element-defs.mjs';

describe('gpu/bulk-load', function () {
  describe('partitionDefs', function () {
    it('partitions a flat array by inferred group', function () {
      const { nodes, edges } = partitionDefs([
        { data: { id: 'a' } },
        { data: { id: 'ab', source: 'a', target: 'b' } },
        { data: { id: 'b' } },
      ]);

      expect(nodes.map((def) => def.data.id)).to.deep.equal(['a', 'b']);
      expect(edges.map((def) => def.data.id)).to.deep.equal(['ab']);
    });

    it('lets the bucket decide the group in map form', function () {
      // v3 stamped the bucket's group onto each def; the bucket must win
      // even when the def looks like the other group
      const { nodes, edges } = partitionDefs({
        nodes: [{ data: { id: 'x', source: 'a', target: 'b' } }],
        edges: [],
      });

      expect(nodes).to.have.length(1);
      expect(edges).to.have.length(0);
    });

    it('wraps a single def', function () {
      expect(partitionDefs({ data: { id: 'a' } }).nodes).to.have.length(1);
      expect(
        partitionDefs({ data: { id: 'e', source: 'a', target: 'b' } }).edges,
      ).to.have.length(1);
    });

    it('respects an explicit group over the data shape', function () {
      const { nodes } = partitionDefs([
        { group: 'nodes', data: { id: 'x', source: 'a', target: 'b' } },
      ]);

      expect(nodes).to.have.length(1);
    });

    it('throws on an invalid group', function () {
      expect(() =>
        partitionDefs([{ group: 'nope', data: { id: 'x' } }]),
      ).to.throw();
    });
  });

  describe('ColumnTable.reserve', function () {
    it('grows once to the ×2 curve and reports it', function () {
      const table = new ColumnTable('nodes', columnSpecsForGroup('nodes'), 32);

      expect(table.reserve(1000)).to.be.true;
      expect(table.cap).to.equal(1024);
      expect(table.reserve(1000)).to.be.false; // already sufficient
      expect(table.cap).to.equal(1024);
    });

    it('preserves contents and generations', function () {
      const table = new ColumnTable('nodes', columnSpecsForGroup('nodes'), 32);
      const { slot } = table.alloc();
      const pos = table.column('node.position');

      pos[slot * 2] = 7;
      pos[slot * 2 + 1] = 8;
      table.freeSlot(slot);
      table.alloc(); // gen 1 now lives at the reused slot

      table.reserve(500);

      expect(table.gen[slot]).to.equal(1);
      expect(table.column('node.position')[slot * 2]).to.equal(0); // re-alloc zeroed it
      expect(table.cap).to.equal(512);
    });
  });

  describe('GraphStore.reserve', function () {
    it('preallocates so a bulk add never resizes mid-loop', function () {
      const store = new GraphStore();

      store.reserve(100, 200);
      store.takeDelta(); // clear the reserve's own resized flag

      for (let i = 0; i < 100; i++) {
        store.addNode('n' + i, i, i);
      }

      for (let i = 0; i < 200; i++) {
        store.addEdge('e' + i, 'n' + (i % 100), 'n' + ((i + 1) % 100));
      }

      const delta = store.takeDelta();

      expect(delta.resized.nodes).to.be.false;
      expect(delta.resized.edges).to.be.false;
      expect(store.count('nodes')).to.equal(100);
      expect(store.count('edges')).to.equal(200);
    });

    it('marks resized when it grows', function () {
      const store = new GraphStore();

      store.reserve(100, 0);

      const delta = store.takeDelta();

      expect(delta.resized.nodes).to.be.true;
      expect(delta.resized.edges).to.be.false;
    });

    it('accounts for reusable free slots', function () {
      const store = new GraphStore();

      for (let i = 0; i < 20; i++) {
        store.addNode('n' + i, 0, 0);
      }

      for (let i = 0; i < 10; i++) {
        store.removeNode(store.lookup('n' + i).slot);
      }

      const cap = store.capacity('nodes');

      store.reserve(10, 0); // covered entirely by the free list

      expect(store.capacity('nodes')).to.equal(cap);
    });
  });

  describe('StyleEngine.applyBulk', function () {
    const sheet = {
      nodes: { width: 11, height: 12, 'background-color': '#f00' },
      edges: { width: 3, 'line-color': '#0f0' },
    };

    const storeWith = () => {
      const store = new GraphStore();

      store.addNode('a', 0, 0);
      store.addNode('b', 0, 0, { selected: true });
      store.addEdge('ab', 'a', 'b');

      return store;
    };

    it('matches per-element apply exactly', function () {
      const bulk = storeWith();
      const perEle = storeWith();

      const bulkEngine = new StyleEngine(bulk);
      const perEleEngine = new StyleEngine(perEle);

      bulkEngine.setSheet(sheet); // applyAll routes through applyBulk

      // the per-element reference: apply() per ref overwrites whatever
      // setSheet wrote, so the columns end up as pure apply() output
      perEleEngine.setSheet(sheet);
      perEle.forEachAlive('nodes', (slot) =>
        perEleEngine.apply(perEle.ref('nodes', slot)),
      );
      perEle.forEachAlive('edges', (slot) =>
        perEleEngine.apply(perEle.ref('edges', slot)),
      );

      for (const id of [
        'node.size',
        'node.fillColor',
        'node.shape',
        'edge.width',
        'edge.lineColor',
      ]) {
        expect(Array.from(bulk.column(id)), id).to.deep.equal(
          Array.from(perEle.column(id)),
        );
      }
    });

    it('evaluates per-element case mappers', function () {
      const store = storeWith();
      const engine = new StyleEngine(store);

      engine.setSheet({
        nodes: {
          'background-color': {
            case: [{ when: { data: 'id', eq: 'a' }, then: '#ff0' }],
            else: '#00f',
          },
        },
      });

      const fill = store.column('node.fillColor');
      const a = store.lookup('a').slot;
      const b = store.lookup('b').slot;

      expect(Array.from(fill.slice(a * 4, a * 4 + 3))).to.deep.equal([
        255, 255, 0,
      ]);
      expect(Array.from(fill.slice(b * 4, b * 4 + 3))).to.deep.equal([
        0, 0, 255,
      ]);
    });

    it('an else-less case falls back to the channel default', function () {
      const store = storeWith();
      const engine = new StyleEngine(store);

      engine.setSheet({
        nodes: {
          'background-color': {
            case: [{ when: { data: 'id', eq: 'a' }, then: '#ff0' }],
            else: '#999',
          },
        },
      });

      const fill = store.column('node.fillColor');
      const a = store.lookup('a').slot;
      const b = store.lookup('b').slot;

      expect(Array.from(fill.slice(a * 4, a * 4 + 3))).to.deep.equal([
        255, 255, 0,
      ]);
      expect(Array.from(fill.slice(b * 4, b * 4 + 3))).to.deep.equal([
        153, 153, 153,
      ]); // #999
    });
  });

  describe('factory bulk path', function () {
    const options = () => ({
      elements: {
        nodes: [
          { data: { id: 'a' }, position: { x: 1, y: 2 } },
          { data: { id: 'b' }, position: { x: 3, y: 4 }, selected: true },
        ],
        edges: [{ data: { id: 'ab', source: 'a', target: 'b' } }],
      },
      style: { nodes: { width: 20, height: 20 } },
    });

    it('loads elements without add events and with styles applied', function () {
      const cy = cytoscape(options());

      expect(cy.nodes()).to.have.length(2);
      expect(cy.edges()).to.have.length(1);
      expect(cy.getElementById('a').position()).to.deep.equal({ x: 1, y: 2 });
      expect(cy.getElementById('b').selected()).to.be.true;
      expect(cy.getElementById('a').width()).to.equal(20);
      expect(cy.getElementById('ab').source().id()).to.equal('a');
    });

    it('produces the same model as the per-element add path', function () {
      const bulk = cytoscape(options());
      const incremental = cytoscape({ style: options().style });

      incremental.add(options().elements);

      for (const id of [
        'node.position',
        'node.size',
        'node.flags',
        'edge.endpoints',
      ]) {
        expect(Array.from(bulk._store.column(id)), id).to.deep.equal(
          Array.from(incremental._store.column(id)),
        );
      }
    });
  });

  // Round 66: the factory's definition-form load converts to the columnar
  // form and ingests that, because convert-then-ingest measures 1.28-1.70x
  // the def loop from 4k to 800k elements.  Everything here is a parity
  // assertion between the two routes, and every one of them was run with
  // the routing disabled (so both sides are the def path) and with the
  // relevant half of the routing broken, to check it can fail.
  describe('definition payloads route through the columnar ingest', function () {
    // one fixture carrying every feature a def can express: ids and
    // generated ids, positions, compound parents, all five flags, sidecar
    // data of both kinds, and an edge whose endpoints are declared after
    // it
    const fixture = () => ({
      nodes: [
        { data: { id: 'p' } },
        {
          data: { id: 'a', parent: 'p', label: 'A', score: 3 },
          position: { x: 1, y: 2 },
          selected: true,
        },
        {
          data: { id: 'b', parent: 'p', label: 'B', score: -1 },
          position: { x: 3, y: 4 },
          selectable: false,
          locked: true,
        },
        {
          data: { id: 'c', label: 'C' },
          position: { x: 5, y: 6 },
          grabbable: false,
          pannable: true,
        },
        { data: { label: 'generated' }, position: { x: 7, y: 8 } },
      ],
      edges: [
        { data: { id: 'ab', source: 'a', target: 'b', w: 2 } },
        {
          data: { id: 'bc', source: 'b', target: 'c' },
          selected: true,
          pannable: false,
        },
        { data: { source: 'c', target: 'a' }, selectable: false },
      ],
    });

    const sheet = {
      nodes: {
        width: 20,
        height: 20,
        'background-color': { data: 'score', range: ['#000', '#fff'] },
      },
      edges: { width: 1 },
    };

    /** Load the same defs both ways: the factory (routed) and add() (not). */
    const bothWays = () => {
      const bulk = cytoscape({ elements: fixture(), style: sheet });
      const incremental = cytoscape({ style: sheet });

      incremental.add(fixture());

      return { bulk, incremental };
    };

    it('produces an identical model, column for column', function () {
      const { bulk, incremental } = bothWays();

      for (const group of ['nodes', 'edges']) {
        for (const spec of columnSpecsForGroup(group)) {
          expect(
            Array.from(bulk._store.column(spec.id)),
            spec.id,
          ).to.deep.equal(Array.from(incremental._store.column(spec.id)));
        }
      }
    });

    it('carries every data() key, on both groups', function () {
      const { bulk, incremental } = bothWays();

      for (const id of ['a', 'b', 'c', 'ab']) {
        expect(bulk.getElementById(id).data(), id).to.deep.equal(
          incremental.getElementById(id).data(),
        );
      }

      // a node's parent is hierarchy, never sidecar data, on both routes:
      // data() reports it (synthesized from the parent column) while the
      // sidecar itself holds nothing under the key
      expect(bulk.getElementById('a').parent().id()).to.equal('p');
      expect(bulk.getElementById('a').data().parent).to.equal('p');

      for (const cy of [bulk, incremental]) {
        const { slot } = cy._store.lookup('a');

        expect(cy._store.data.get('nodes', slot, 'parent')).to.be.undefined;
      }
    });

    it('keeps locked, grabbable and pannable, which no column carries', function () {
      // the control for this one: with _applyFlagOverrides not called,
      // every assertion below fails
      const cy = cytoscape({ elements: fixture(), style: sheet });

      expect(cy.getElementById('b').locked(), 'locked').to.be.true;
      expect(cy.getElementById('a').locked(), 'unlocked').to.be.false;
      expect(cy.getElementById('c').grabbable(), 'grabbable').to.be.false;
      expect(cy.getElementById('a').grabbable(), 'grabbable default').to.be
        .true;
      expect(cy.getElementById('c').pannable(), 'node pannable').to.be.true;
      expect(cy.getElementById('a').pannable(), 'node default').to.be.false;
      expect(cy.getElementById('bc').pannable(), 'edge pannable').to.be.false;
      expect(cy.getElementById('ab').pannable(), 'edge default').to.be.true;
    });

    it('keeps selected and selectable, which columns do carry', function () {
      const cy = cytoscape({ elements: fixture(), style: sheet });

      expect(cy.getElementById('a').selected()).to.be.true;
      expect(cy.getElementById('b').selectable()).to.be.false;
      expect(cy.getElementById('bc').selected()).to.be.true;
    });

    it('resolves a ::locked condition against the written flag', function () {
      // ::locked and ::grabbable are styleable conditions (contract.mts),
      // so a flag the columnar columns cannot carry still has to reach the
      // sheet.  Note what this does *not* test: the override write sits
      // before the style pass (where the def path has it, and so it costs
      // no second pass), but moving it after keeps every assertion here
      // green — `setFlag` notes a condition-flag change and the affected
      // slot restyles, so the ordering is not observable in the end state.
      // The control that does land is not writing the flags at all.
      const cy = cytoscape({
        elements: fixture(),
        style: {
          nodes: {
            width: {
              case: [{ when: { locked: true }, then: 50 }],
              else: 20,
            },
            height: 20,
          },
        },
      });

      expect(cy.getElementById('b').width(), 'locked node').to.equal(50);
      expect(cy.getElementById('a').width(), 'unlocked node').to.equal(20);
    });

    it('generates the same ids for defs without one', function () {
      const { bulk, incremental } = bothWays();

      expect(bulk.nodes().map((n) => n.id())).to.deep.equal(
        incremental.nodes().map((n) => n.id()),
      );
      expect(bulk.edges().map((e) => e.id())).to.deep.equal(
        incremental.edges().map((e) => e.id()),
      );
    });

    it('falls back to the def path for an edge naming an absent node', function () {
      // not self-contained, so buildColumnar answers null and the def
      // path runs — and reports it in *its* words, not the converter's
      // ("... is not a node in this payload"), which is the message a
      // caller has always seen here
      expect(() =>
        cytoscape({
          elements: {
            nodes: [{ data: { id: 'a' } }],
            edges: [{ data: { id: 'e', source: 'a', target: 'zz' } }],
          },
        }),
      ).to.throw("Can not create edge 'e' with nonexistant target 'zz'");
    });

    it('reports a missing endpoint in the def path’s words', function () {
      expect(() =>
        cytoscape({
          elements: {
            nodes: [{ data: { id: 'a' } }],
            edges: [{ data: { id: 'e', source: 'a' } }],
          },
        }),
      ).to.throw("Can not create edge 'e' without a source and target");
    });

    it('still rejects a duplicate id', function () {
      expect(() =>
        cytoscape({
          elements: { nodes: [{ data: { id: 'a' } }, { data: { id: 'a' } }] },
        }),
      ).to.throw("Can not create second element with id 'a'");
    });

    it('warns and orphans a node whose parent is not in the payload', function () {
      const warnings = [];
      const warn = console.warn;

      console.warn = (msg) => warnings.push(msg);

      try {
        const cy = cytoscape({
          elements: { nodes: [{ data: { id: 'a', parent: 'nope' } }] },
        });

        expect(cy.getElementById('a').parent()).to.have.length(0);
      } finally {
        console.warn = warn;
      }

      expect(warnings).to.have.length(1);
      expect(warnings[0]).to.contain("nonexistant parent 'nope'");
    });

    it('leaves add() on the def path, so it can still cross-reference', function () {
      // the route is the *bulk* path's; add() into a populated graph may
      // legitimately name nodes that are already there
      const cy = cytoscape({ elements: { nodes: [{ data: { id: 'a' } }] } });

      cy.add([
        { data: { id: 'b' } },
        { data: { id: 'ab', source: 'a', target: 'b' } },
      ]);

      expect(cy.getElementById('ab').source().id()).to.equal('a');
    });

    it('takes the route for the flat array and single-def forms too', function () {
      const flat = cytoscape({
        elements: [
          { data: { id: 'a' }, position: { x: 1, y: 2 } },
          { data: { id: 'ab', source: 'a', target: 'b' } },
          { data: { id: 'b' }, position: { x: 3, y: 4 } },
        ],
      });

      expect(flat.nodes()).to.have.length(2);
      expect(flat.getElementById('ab').target().id()).to.equal('b');

      const single = cytoscape({ elements: { data: { id: 'only' } } });

      expect(single.nodes().map((n) => n.id())).to.deep.equal(['only']);
    });

    it('loads an empty and a node-only payload', function () {
      expect(
        cytoscape({ elements: { nodes: [], edges: [] } }).elements(),
      ).to.have.length(0);
      expect(
        cytoscape({ elements: { nodes: [{ data: { id: 'a' } }] } }).nodes(),
      ).to.have.length(1);
    });
  });

  describe('add() event parity', function () {
    it('emits add per element when a listener exists', function () {
      const cy = cytoscape();
      const ids = [];

      cy.on('add', (evt) => ids.push(evt.target.id()));

      cy.add([
        { data: { id: 'a' } },
        { data: { id: 'b' } },
        { data: { id: 'ab', source: 'a', target: 'b' } },
      ]);

      expect(ids).to.deep.equal(['a', 'b', 'ab']);
    });

    it('returns a fully indexable collection without listeners', function () {
      const cy = cytoscape();
      const added = cy.add([{ data: { id: 'a' } }, { data: { id: 'b' } }]);

      expect(added).to.have.length(2);
      expect(added[0].id()).to.equal('a');
      expect(added[1].id()).to.equal('b');
      expect(added[0]).to.equal(cy.getElementById('a')); // interned handle
    });
  });
});
